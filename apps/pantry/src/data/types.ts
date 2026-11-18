import type { Nutrition } from './nutrition';

/** Every synced row carries these, so two devices merge by id with the newest edit winning. */
export interface Synced {
  id: string;
  updatedAt: string;
  /** Set instead of deleting, so the deletion reaches other devices. */
  deletedAt?: string;
}

/** One product in the pantry. A used-up product stays as a deleted row, so scanning it
 *  again brings back its name and photo without a lookup. */
export interface Item extends Synced {
  /** Digits only; a 12-digit UPC-A is stored as 13 digits with a leading zero. Absent for items added by hand. */
  barcode?: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  quantity: number;
  /** Local calendar date, YYYY-MM-DD. One date per product: the earliest pack. */
  expiresOn?: string;
  /** From the product databases, when they have it. */
  nutrition?: Nutrition;
}

/** A product scanned in groceries mode, waiting to be added. */
export interface Scan {
  barcode: string;
  /** How many packs were scanned. */
  count: number;
  scannedAt: string;
  /** Unset while it is being looked up. `known`: Pantry already had the product. */
  lookup?: 'found' | 'known' | 'not_found' | 'incomplete' | 'offline';
  name: string;
  brand?: string;
  imageUrl?: string;
  nutrition?: Nutrition;
  expiresOn?: string;
  /** Set once the name was typed or changed, so a late lookup does not overwrite it. */
  edited?: boolean;
}

/** Everything that syncs, as one document. */
export interface Dump {
  items: Item[];
}
