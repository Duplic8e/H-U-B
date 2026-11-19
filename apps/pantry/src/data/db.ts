import Dexie, { type Table } from 'dexie';
import type { Item, Recipe, Scan } from './types';

/** Device-local values (sync bookkeeping). Never synced or exported. */
export interface KvRow {
  key: string;
  value: unknown;
}

export class PantryDB extends Dexie {
  items!: Table<Item, string>;
  kv!: Table<KvRow, string>;
  /** Groceries scanned in a row, waiting to be reviewed. This device only; never synced. */
  scans!: Table<Scan, string>;
  recipes!: Table<Recipe, string>;

  constructor(name = 'pantry') {
    super(name);
    this.version(1).stores({ items: 'id, barcode', kv: 'key' });
    this.version(2).stores({ scans: 'barcode, scannedAt' });
    this.version(3).stores({ recipes: 'id' });
  }
}
