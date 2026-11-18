/** Nutrition facts for a product, per 100 g (or 100 ml for drinks), as the databases give them. */
export interface Nutrition {
  per: 'g' | 'ml';
  kcal?: number;
  fat?: number;
  saturatedFat?: number;
  transFat?: number;
  cholesterolMg?: number;
  carbs?: number;
  fiber?: number;
  sugars?: number;
  protein?: number;
  sodiumMg?: number;
  /** One serving as printed, e.g. "28 g". */
  serving?: string;
  /** Grams (or ml) in one serving, for the per-serving column. */
  servingSize?: number;
}

/** The amounts, in the order the built-in copy stores them. Must match scripts/build-catalog.mjs. */
export const AMOUNTS = ['kcal', 'fat', 'saturatedFat', 'transFat', 'cholesterolMg', 'carbs', 'fiber', 'sugars', 'protein', 'sodiumMg'] as const;
type Amount = (typeof AMOUNTS)[number];

/** Largest believable value per 100 g; anything above (or below 0) is a typo in the database. */
const MAX: Record<Amount, number> = { kcal: 900, fat: 100, saturatedFat: 100, transFat: 100, cholesterolMg: 3000, carbs: 100, fiber: 100, sugars: 100, protein: 100, sodiumMg: 40000 };
const round = (k: Amount, v: number) => (k === 'kcal' || k.endsWith('Mg') ? Math.round(v) : Math.round(v * 10) / 10);

/** Keeps believable amounts, rounded. Null unless calories or at least three amounts are known. */
export function clean(raw: Partial<Record<Amount, unknown>>, per: 'g' | 'ml', serving?: string, servingSize?: unknown): Nutrition | null {
  const n: Nutrition = { per };
  let count = 0;
  for (const k of AMOUNTS) {
    const v = typeof raw[k] === 'string' ? Number(raw[k]) : raw[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX[k]) continue;
    n[k] = round(k, v);
    count++;
  }
  if (n.kcal === undefined && count < 3) return null;
  const size = typeof servingSize === 'string' ? Number(servingSize) : servingSize;
  if (serving?.trim()) n.serving = serving.trim();
  if (typeof size === 'number' && Number.isFinite(size) && size > 0 && size < 5000) n.servingSize = Math.round(size * 10) / 10;
  return n;
}

/** Drinks are labelled per 100 ml. */
export const liquid = (quantity?: string) => /\d\s*(ml|cl|dl|l|fl\.? ?oz)\b/i.test(quantity ?? '');

/** Reads the `nutriments` of an Open Food Facts product. */
export function fromOpenFoodFacts(p: Record<string, unknown>): Nutrition | null {
  const m = p.nutriments as Record<string, unknown> | undefined;
  if (!m || typeof m !== 'object') return null;
  const g = (key: string) => m[`${key}_100g`];
  const mg = (key: string) => { const v = Number(g(key)); return g(key) === undefined || !Number.isFinite(v) ? undefined : v * 1000; };
  return clean({
    kcal: g('energy-kcal'), fat: g('fat'), saturatedFat: g('saturated-fat'), transFat: g('trans-fat'), cholesterolMg: mg('cholesterol'),
    carbs: g('carbohydrates'), fiber: g('fiber'), sugars: g('sugars'), protein: g('proteins'), sodiumMg: mg('sodium'),
  }, liquid(typeof p.quantity === 'string' ? p.quantity : undefined) || p.product_quantity_unit === 'ml' ? 'ml' : 'g',
  typeof p.serving_size === 'string' ? p.serving_size : undefined, p.serving_quantity);
}

/** One tab-free field of the built-in copy: per;amounts;serving size;serving. */
export function decode(field: string): Nutrition | null {
  if (!field) return null;
  const [per, amounts = '', size = '', serving = ''] = field.split(';');
  const values = amounts.split(',');
  return clean(Object.fromEntries(AMOUNTS.map((k, i) => [k, values[i] === '' || values[i] === undefined ? undefined : Number(values[i])])), per === 'ml' ? 'ml' : 'g', serving || undefined, size || undefined);
}

export interface FactRow { label: string; key: Amount; unit: 'kcal' | 'g' | 'mg'; indent?: boolean }

/** The Canadian Nutrition Facts table, in its order. */
export const FACT_ROWS: FactRow[] = [
  { label: 'Calories', key: 'kcal', unit: 'kcal' },
  { label: 'Fat', key: 'fat', unit: 'g' },
  { label: 'Saturated', key: 'saturatedFat', unit: 'g', indent: true },
  { label: 'Trans', key: 'transFat', unit: 'g', indent: true },
  { label: 'Carbohydrate', key: 'carbs', unit: 'g' },
  { label: 'Fibre', key: 'fiber', unit: 'g', indent: true },
  { label: 'Sugars', key: 'sugars', unit: 'g', indent: true },
  { label: 'Protein', key: 'protein', unit: 'g' },
  { label: 'Cholesterol', key: 'cholesterolMg', unit: 'mg' },
  { label: 'Sodium', key: 'sodiumMg', unit: 'mg' },
];

/** An amount for display, scaled from per 100 to `size`. */
export function amount(n: Nutrition, row: FactRow, size = 100): string | undefined {
  const v = n[row.key];
  if (v === undefined) return undefined;
  const scaled = (v * size) / 100;
  const shown = row.unit === 'g' ? (scaled < 10 ? Math.round(scaled * 10) / 10 : Math.round(scaled)) : Math.round(scaled);
  return row.unit === 'kcal' ? String(shown) : `${shown} ${row.unit}`;
}
