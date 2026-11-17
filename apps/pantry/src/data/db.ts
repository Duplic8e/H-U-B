import Dexie, { type Table } from 'dexie';
import type { Item } from './types';

/** Device-local values (sync bookkeeping). Never synced or exported. */
export interface KvRow {
  key: string;
  value: unknown;
}

export class PantryDB extends Dexie {
  items!: Table<Item, string>;
  kv!: Table<KvRow, string>;

  constructor(name = 'pantry') {
    super(name);
    this.version(1).stores({ items: 'id, barcode', kv: 'key' });
  }
}
