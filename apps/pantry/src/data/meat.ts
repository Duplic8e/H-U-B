/** Fresh chicken and beef, which has no barcode to scan. */
export interface MeatKind {
  key: string;
  name: string;
  group: 'Chicken' | 'Beef';
  /** What it is usually counted in. */
  unit: string;
  /** Days it keeps raw in the fridge, months in the freezer (for best quality). */
  fridgeDays: number;
  freezerMonths: number;
}

// Keeping times follow common food-safety guidance (raw poultry and ground meat 1-2 days in the fridge,
// whole cuts 3-5; frozen whole cuts 6-12 months, ground meat 3-4). The shorter end is used.
export const MEAT: MeatKind[] = [
  { key: 'chicken-breast', name: 'Chicken breasts', group: 'Chicken', unit: 'pieces', fridgeDays: 2, freezerMonths: 9 },
  { key: 'chicken-thigh', name: 'Chicken thighs', group: 'Chicken', unit: 'pieces', fridgeDays: 2, freezerMonths: 9 },
  { key: 'chicken-wing', name: 'Chicken wings', group: 'Chicken', unit: 'pieces', fridgeDays: 2, freezerMonths: 9 },
  { key: 'chicken-drumstick', name: 'Chicken drumsticks', group: 'Chicken', unit: 'pieces', fridgeDays: 2, freezerMonths: 9 },
  { key: 'chicken-whole', name: 'Whole chicken', group: 'Chicken', unit: 'whole', fridgeDays: 2, freezerMonths: 12 },
  { key: 'chicken-ground', name: 'Ground chicken', group: 'Chicken', unit: 'packs', fridgeDays: 1, freezerMonths: 3 },
  { key: 'beef-ground', name: 'Ground beef', group: 'Beef', unit: 'packs', fridgeDays: 1, freezerMonths: 3 },
  { key: 'beef-steak', name: 'Steaks', group: 'Beef', unit: 'pieces', fridgeDays: 3, freezerMonths: 9 },
  { key: 'beef-stewing', name: 'Stewing beef', group: 'Beef', unit: 'packs', fridgeDays: 2, freezerMonths: 6 },
  { key: 'beef-roast', name: 'Beef roast', group: 'Beef', unit: 'pieces', fridgeDays: 3, freezerMonths: 9 },
];

export const UNITS = ['pieces', 'packs', 'whole', 'lb', 'kg'] as const;

/** The suggested "use by" date, YYYY-MM-DD, counted from `today` (local date). */
export function suggestedExpiry(kind: Pick<MeatKind, 'fridgeDays' | 'freezerMonths'>, storage: 'fridge' | 'freezer', today: string): string {
  const [y = 2000, m = 1, d = 1] = today.split('-').map(Number);
  const date = storage === 'fridge' ? new Date(y, m - 1, d + kind.fridgeDays) : new Date(y, m - 1 + kind.freezerMonths, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "4 pieces", "1 lb", "2 packs": a count with its unit. */
export function withUnit(quantity: number, unit?: string): string {
  if (!unit) return String(quantity);
  const one = { pieces: 'piece', packs: 'pack' }[unit];
  return `${quantity} ${quantity === 1 && one ? one : unit}`;
}
