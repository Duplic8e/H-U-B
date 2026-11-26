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
  /** What the quantity counts, for things weighed or bought loose ("pieces", "lb"). Packs when absent. */
  unit?: string;
  /** Where fresh meat is kept, which sets its suggested expiry. */
  storage?: 'fridge' | 'freezer';
  /** Saved before its lookup finished (`pending`, filled in in the background, retried until the
   *  databases answer), or no database knew it (`not_found`, waiting for a name). */
  lookup?: 'pending' | 'not_found';
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

/** One line of a recipe. */
export interface RecipeIngredient {
  name: string;
  /** As written, e.g. "2 tbsp" or "1 can". */
  amount: string;
  /** The pantry item it uses, when it comes from the pantry. */
  itemId?: string;
}

/** A recipe in the recipe book: suggested by Gemini and saved, or typed in. */
export interface Recipe extends Synced {
  title: string;
  summary?: string;
  minutes?: number;
  servings?: number;
  /** Gemini's estimate; absent for typed recipes. */
  kcalPerServing?: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Appliances the recipe needs, as Gemini listed them. */
  appliances?: string[];
  source: 'gemini' | 'mine';
}

/** Household preferences, one synced row. */
export interface Prefs extends Synced {
  /** The appliances in this kitchen; recipes use only these. Empty means not set. */
  appliances: string[];
}

export const PREFS_ID = 'prefs';

/** Everything that syncs, as one document. The Gemini key is not in it: it never leaves the phone. */
export interface Dump {
  items: Item[];
  recipes: Recipe[];
  prefs: Prefs[];
}
