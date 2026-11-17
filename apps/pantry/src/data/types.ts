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
}

/** Everything that syncs, as one document. */
export interface Dump {
  items: Item[];
}
