import { barcodeId } from './barcode';
import { PantryDB } from './db';
import type { Nutrition } from './nutrition';
import type { Dump, Item, Scan } from './types';

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
      });
      changed();
      return id;
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
    /** Adds every named scan to the pantry: more of a product already there, or a new item.
     *  Scans still without a name stay on the list. Returns how many packs were added. */
    async addScansToPantry(): Promise<{ added: number; left: number }> {
      const scans = await db.scans.toArray();
      const ready = scans.filter((s) => s.name.trim());
      const at = stamp();
      await db.transaction('rw', db.items, db.scans, async () => {
        for (const s of ready) {
          const id = barcodeId(s.barcode);
          const row = await db.items.get(id);
          const live = row && !row.deletedAt ? row : undefined;
          // One date per product: the earliest pack.
          const dates = [live?.expiresOn, s.expiresOn].filter((d): d is string => !!d).sort();
          await db.items.put({
            id, updatedAt: at, barcode: s.barcode,
            name: s.edited || !live ? s.name.trim() : live.name,
            brand: (s.edited || !live ? clean(s.brand) : live.brand) ?? live?.brand,
            imageUrl: s.imageUrl ?? live?.imageUrl,
            quantity: (live?.quantity ?? 0) + s.count,
            expiresOn: dates[0],
            nutrition: live?.nutrition ?? s.nutrition ?? row?.nutrition,
          });
          await db.scans.delete(s.barcode);
        }
      });
      if (ready.length) changed();
      return { added: ready.reduce((n, s) => n + s.count, 0), left: scans.length - ready.length };
    },

    // ---- sync and backup ----
    async dumpAll(): Promise<Dump> {
      return { items: await db.items.toArray() };
    },
    /** Merges rows by id; the newer `updatedAt` wins, ties keep this device's row. */
    async mergeAll(remote: Dump) {
      quiet = true;
      try {
        await db.transaction('rw', db.items, async () => {
          const local = new Map((await db.items.bulkGet(remote.items.map((r) => r.id))).filter((r): r is Item => !!r).map((r) => [r.id, r]));
          const winners = remote.items.filter((r) => { const mine = local.get(r.id); return !mine || r.updatedAt > mine.updatedAt; });
          if (winners.length) await db.items.bulkPut(winners);
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
