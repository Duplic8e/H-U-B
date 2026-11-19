import { barcodeId } from './barcode';
import { PantryDB } from './db';
import type { LookupResult } from './lookup';
import type { Nutrition } from './nutrition';
import type { Dump, Item, Recipe, Scan } from './types';

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
        await db.items.put({
          ...row, updatedAt: at, lookup: undefined,
          name: row.name.trim() || p.name, brand: row.brand ?? p.brand, imageUrl: row.imageUrl ?? p.imageUrl, nutrition: row.nutrition ?? p.nutrition,
        });
      }
      changed();
    },
    /** Fills in nutrition looked up after the item was saved. */
    async setNutrition(id: string, nutrition: Nutrition) {
      const row = await db.items.get(id);
      if (!row || row.nutrition) return;
      await db.items.put({ ...row, nutrition, updatedAt: stamp() });
      changed();
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
    async addScan(barcode: string): Promise<Scan> {
      return db.transaction('rw', db.scans, db.items, async () => {
        const have = await db.scans.get(barcode);
        if (have) {
          const next = { ...have, count: have.count + 1 };
          await db.scans.put(next);
          return next;
        }
        const known = await db.items.get(barcodeId(barcode));
        const scan: Scan = known
          ? { barcode, count: 1, scannedAt: stamp(), lookup: 'known', name: known.name, brand: known.brand, imageUrl: known.imageUrl, nutrition: known.nutrition }
          : { barcode, count: 1, scannedAt: stamp(), name: '' };
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
            lookup: name ? undefined : s.lookup === 'not_found' ? 'not_found' : 'pending',
          });
          await db.scans.delete(s.barcode);
        }
      });
      if (scans.length) changed();
      return { added: scans.reduce((n, s) => n + s.count, 0) };
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
      return { items: await db.items.toArray(), recipes: await db.recipes.toArray() };
    },
    /** Merges rows by id; the newer `updatedAt` wins, ties keep this device's row. */
    async mergeAll(remote: { items: Item[]; recipes?: Recipe[] }) {
      quiet = true;
      try {
        await db.transaction('rw', db.items, db.recipes, async () => {
          const merge = async <T extends { id: string; updatedAt: string }>(table: import('dexie').Table<T, string>, rows: T[]) => {
            const local = new Map((await table.bulkGet(rows.map((r) => r.id))).filter((r): r is T => !!r).map((r) => [r.id, r]));
            const winners = rows.filter((r) => { const mine = local.get(r.id); return !mine || r.updatedAt > mine.updatedAt; });
            if (winners.length) await table.bulkPut(winners);
          };
          await merge(db.items, remote.items);
          // Backups written before recipes existed have none.
          await merge(db.recipes, remote.recipes ?? []);
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
