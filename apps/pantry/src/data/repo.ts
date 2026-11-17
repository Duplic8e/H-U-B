import { barcodeId } from './barcode';
import { PantryDB } from './db';
import type { Dump, Item } from './types';

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
        quantity: Math.max(1, Math.round(input.quantity)), expiresOn: input.expiresOn || undefined,
      });
      changed();
      return id;
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
