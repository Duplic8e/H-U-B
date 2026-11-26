import { barcodeId } from './barcode';
import { PantryDB } from './db';
import type { LookupResult } from './lookup';
import type { Nutrition } from './nutrition';
import { PREFS_ID, type Dump, type Item, type Prefs, type Recipe, type Scan } from './types';

const uid = () => crypto.randomUUID();
const clean = (s?: string) => s?.trim() || undefined;

export interface ItemInput {
  id?: string;
  barcode?: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  quantity: number;
  expiresOn?: string;
  nutrition?: Nutrition;
  lookup?: Item['lookup'];
  unit?: string;
  storage?: Item['storage'];
  category?: string;
  photo?: string;
}

export function createRepo(db: PantryDB, now: () => Date = () => new Date()) {
  const stamp = () => now().toISOString();
  const listeners = new Set<() => void>();
  let quiet = false;
  /** Every local write calls this, so sync knows to push. Merges from the cloud do not. */
  const changed = () => { if (!quiet) listeners.forEach((l) => l()); };

  const repo = {
    db,
    onLocalChange(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** What is in the pantry now. */
    async listItems(): Promise<Item[]> {
      return (await db.items.toArray()).filter((i) => !i.deletedAt);
    },
    /** The row for a barcode, including a used-up product that is only remembered. */
    async findByBarcode(barcode: string): Promise<Item | undefined> {
      return db.items.get(barcodeId(barcode));
    },
    /** Adds or updates an item, and puts a used-up one back in the pantry. */
    async saveItem(input: ItemInput): Promise<string> {
      const id = input.id ?? (input.barcode ? barcodeId(input.barcode) : uid());
      await db.items.put({
        id, updatedAt: stamp(), barcode: input.barcode, name: input.name.trim(), brand: clean(input.brand), imageUrl: clean(input.imageUrl),
        quantity: Math.max(1, Math.round(input.quantity)), expiresOn: input.expiresOn || undefined, nutrition: input.nutrition,
        // A name typed or found ends the wait; an item without one keeps waiting for its lookup.
        lookup: input.name.trim() ? undefined : input.lookup ?? (input.barcode ? 'pending' : undefined),
        ...(input.unit ? { unit: input.unit } : {}), ...(input.storage ? { storage: input.storage } : {}),
        ...(input.category ? { category: input.category } : {}),
        // A product's own photo makes the scan photo unnecessary.
        ...(input.photo && !clean(input.imageUrl) ? { photo: input.photo } : {}),
      });
      changed();
      return id;
    },
    /** Fills in what a background lookup found for an item saved before it finished. Anything the
     *  user typed in the meantime stays. */
    async applyLookup(id: string, result: LookupResult) {
      const row = await db.items.get(id);
      if (!row || row.lookup !== 'pending') return;
      if (result.status === 'incomplete' || result.status === 'offline') return;
      const at = stamp();
      if (result.status === 'not_found') await db.items.put({ ...row, lookup: 'not_found', updatedAt: at });
      else {
        const p = result.product;
        const imageUrl = row.imageUrl ?? p.imageUrl;
        await db.items.put({
          ...row, updatedAt: at, lookup: undefined,
          name: row.name.trim() || p.name, brand: row.brand ?? p.brand, imageUrl, nutrition: row.nutrition ?? p.nutrition,
          category: row.category ?? p.category, photo: imageUrl ? undefined : row.photo,
        });
      }
      changed();
    },
    /** Fills in nutrition (and a category) looked up after the item was saved. */
    async setNutrition(id: string, nutrition: Nutrition | undefined, category?: string) {
      const row = await db.items.get(id);
      if (!row || ((row.nutrition || !nutrition) && (row.category || !category))) return;
      await db.items.put({ ...row, nutrition: row.nutrition ?? nutrition, category: row.category ?? category, updatedAt: stamp() });
      changed();
    },
    /** Uses up one pack of a scanned product. Null when the pantry has none. */
    async useUpByBarcode(barcode: string): Promise<{ item: Item; left: number } | null> {
      const row = await db.items.get(barcodeId(barcode));
      if (!row || row.deletedAt || row.quantity <= 0) return null;
      return { item: row, left: await repo.adjust(row.id, -1) };
    },
    /** Puts back one pack that was used up by mistake. */
    async undoUseUp(id: string) {
      const row = await db.items.get(id);
      if (!row) return;
      if (row.deletedAt) await repo.restore(id);
      else await repo.adjust(id, 1);
    },
    /** Adds to or uses up stock. Reaching zero removes the item. Returns the new quantity. */
    async adjust(id: string, delta: number): Promise<number> {
      const row = await db.items.get(id);
      if (!row || row.deletedAt) return 0;
      const quantity = Math.max(0, row.quantity + delta);
      const at = stamp();
      await db.items.put(quantity === 0 ? { ...row, deletedAt: at, updatedAt: at } : { ...row, quantity, updatedAt: at });
      changed();
      return quantity;
    },
    async remove(id: string) {
      const row = await db.items.get(id);
      if (!row || row.deletedAt) return;
      await db.items.put({ ...row, deletedAt: stamp(), updatedAt: stamp() });
      changed();
    },
    /** Undo for a removal: the item comes back as it was. */
    async restore(id: string) {
      const row = await db.items.get(id);
      if (!row?.deletedAt) return;
      const { deletedAt: _gone, ...rest } = row;
      await db.items.put({ ...rest, updatedAt: stamp() });
      changed();
    },

    // ---- groceries: scan many, review, add all ----
    async listScans(): Promise<Scan[]> {
      return db.scans.orderBy('scannedAt').toArray();
    },
    /** Counts one more pack of a product. A product Pantry already knows needs no lookup. */
    async addScan(barcode: string, photo?: string): Promise<Scan> {
      return db.transaction('rw', db.scans, db.items, async () => {
        const have = await db.scans.get(barcode);
        if (have) {
          const next = { ...have, count: have.count + 1 };
          await db.scans.put(next);
          return next;
        }
        const known = await db.items.get(barcodeId(barcode));
        const scan: Scan = known
          ? { barcode, count: 1, scannedAt: stamp(), lookup: 'known', name: known.name, brand: known.brand, imageUrl: known.imageUrl, nutrition: known.nutrition, category: known.category, photo: known.imageUrl ? undefined : known.photo }
          : { barcode, count: 1, scannedAt: stamp(), name: '', ...(photo ? { photo } : {}) };
        await db.scans.put(scan);
        return scan;
      });
    },
    async updateScan(barcode: string, patch: Partial<Omit<Scan, 'barcode'>>) {
      const have = await db.scans.get(barcode);
      if (have) await db.scans.put({ ...have, ...patch });
    },
    async removeScan(barcode: string) {
      await db.scans.delete(barcode);
    },
    async clearScans() {
      await db.scans.clear();
    },
    /** Adds every scan to the pantry: more of a product already there, or a new item. Ones still
     *  being looked up are added too and filled in in the background. Returns how many packs were added. */
    async addScansToPantry(): Promise<{ added: number }> {
      const scans = await db.scans.toArray();
      const at = stamp();
      await db.transaction('rw', db.items, db.scans, async () => {
        for (const s of scans) {
          const id = barcodeId(s.barcode);
          const row = await db.items.get(id);
          const live = row && !row.deletedAt ? row : undefined;
          const typed = s.name.trim();
          const name = s.edited || !live?.name ? typed : live.name;
          // One date per product: the earliest pack.
          const dates = [live?.expiresOn, s.expiresOn].filter((d): d is string => !!d).sort();
          await db.items.put({
            id, updatedAt: at, barcode: s.barcode, name,
            brand: (s.edited || !live ? clean(s.brand) : live.brand) ?? live?.brand,
            imageUrl: s.imageUrl ?? live?.imageUrl,
            quantity: (live?.quantity ?? 0) + s.count,
            expiresOn: dates[0],
            nutrition: live?.nutrition ?? s.nutrition ?? row?.nutrition,
            category: live?.category ?? s.category ?? row?.category,
            photo: (s.imageUrl ?? live?.imageUrl) ? undefined : (live?.photo ?? s.photo ?? row?.photo),
            lookup: name ? undefined : s.lookup === 'not_found' ? 'not_found' : 'pending',
          });
          await db.scans.delete(s.barcode);
        }
      });
      if (scans.length) changed();
      return { added: scans.reduce((n, s) => n + s.count, 0) };
    },

    // ---- preferences ----
    async getPrefs(): Promise<Prefs> {
      return (await db.prefs.get(PREFS_ID)) ?? { id: PREFS_ID, updatedAt: new Date(0).toISOString(), appliances: [] };
    },
    async setAppliances(appliances: string[]) {
      const prefs = await repo.getPrefs();
      const clean = [...new Set(appliances.map((a) => a.trim()).filter(Boolean))];
      await db.prefs.put({ ...prefs, appliances: clean, updatedAt: stamp() });
      changed();
    },

    // ---- fresh meat (no barcode) ----
    /** Adds fresh meat by kind and where it is kept. The same kind and place is one row; adding
     *  more adds to it (or replaces the count when the unit changed). Returns the new quantity. */
    async addMeat(input: { key: string; name: string; quantity: number; unit: string; storage: 'fridge' | 'freezer'; expiresOn?: string }): Promise<number> {
      const id = `m:${input.key}:${input.storage}`;
      const row = await db.items.get(id);
      const live = row && !row.deletedAt ? row : undefined;
      const sameUnit = live && (live.unit ?? 'packs') === input.unit;
      const quantity = Math.max(1, Math.round(input.quantity)) + (sameUnit ? live!.quantity : 0);
      const dates = [sameUnit ? live?.expiresOn : undefined, input.expiresOn].filter((d): d is string => !!d).sort();
      await db.items.put({
        id, updatedAt: stamp(), name: input.storage === 'freezer' ? `${input.name} (frozen)` : input.name,
        quantity, unit: input.unit, storage: input.storage, expiresOn: dates[0], category: 'protein',
      });
      changed();
      return quantity;
    },

    // ---- recipes ----
    async listRecipes(): Promise<Recipe[]> {
      return (await db.recipes.toArray()).filter((r) => !r.deletedAt).sort((a, b) => a.title.localeCompare(b.title));
    },
    async getRecipe(id: string): Promise<Recipe | undefined> {
      const r = await db.recipes.get(id);
      return r && !r.deletedAt ? r : undefined;
    },
    async saveRecipe(input: Omit<Recipe, 'id' | 'updatedAt'> & { id?: string }): Promise<string> {
      const id = input.id ?? uid();
      await db.recipes.put({
        ...input, id, updatedAt: stamp(), title: input.title.trim(),
        ingredients: input.ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), amount: i.amount.trim(), ...(i.itemId ? { itemId: i.itemId } : {}) })),
        steps: input.steps.map((s) => s.trim()).filter(Boolean),
      });
      changed();
      return id;
    },
    async removeRecipe(id: string) {
      const r = await db.recipes.get(id);
      if (!r || r.deletedAt) return;
      await db.recipes.put({ ...r, deletedAt: stamp(), updatedAt: stamp() });
      changed();
    },
    async restoreRecipe(id: string) {
      const r = await db.recipes.get(id);
      if (!r?.deletedAt) return;
      const { deletedAt: _gone, ...rest } = r;
      await db.recipes.put({ ...rest, updatedAt: stamp() });
      changed();
    },

    // ---- sync and backup ----
    async dumpAll(): Promise<Dump> {
      return { items: await db.items.toArray(), recipes: await db.recipes.toArray(), prefs: await db.prefs.toArray() };
    },
    /** Merges rows by id; the newer `updatedAt` wins, ties keep this device's row. */
    async mergeAll(remote: { items: Item[]; recipes?: Recipe[]; prefs?: Prefs[] }) {
      quiet = true;
      try {
        await db.transaction('rw', db.items, db.recipes, db.prefs, async () => {
          const merge = async <T extends { id: string; updatedAt: string }>(table: import('dexie').Table<T, string>, rows: T[]) => {
            const local = new Map((await table.bulkGet(rows.map((r) => r.id))).filter((r): r is T => !!r).map((r) => [r.id, r]));
            const winners = rows.filter((r) => { const mine = local.get(r.id); return !mine || r.updatedAt > mine.updatedAt; });
            if (winners.length) await table.bulkPut(winners);
          };
          await merge(db.items, remote.items);
          // Backups written before recipes existed have none.
          await merge(db.recipes, remote.recipes ?? []);
          await merge(db.prefs, remote.prefs ?? []);
        });
      } finally {
        quiet = false;
      }
    },
  };
  return repo;
}

export type Repo = ReturnType<typeof createRepo>;

let shared: Repo | undefined;
export function getRepo(): Repo {
  return (shared ??= createRepo(new PantryDB()));
}
