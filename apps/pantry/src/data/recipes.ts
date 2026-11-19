import type { Item, Recipe, RecipeIngredient } from './types';

/** Kitchen basics a recipe may use without them being in the pantry. */
const BASICS = /^(salt|pepper|black pepper|salt and pepper|salt & pepper|water|ice|oil|cooking oil|olive oil|vegetable oil|canola oil)$/i;
export const isBasic = (i: RecipeIngredient) => BASICS.test(i.name.trim());

const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3).map((w) => w.replace(/(es|s)$/, ''));

/** The pantry item an ingredient uses: the one it was linked to, or one whose name has every word of it. */
export function findInPantry(ing: RecipeIngredient, items: Item[]): Item | undefined {
  const live = items.filter((i) => !i.deletedAt && i.quantity > 0);
  if (ing.itemId) {
    const linked = live.find((i) => i.id === ing.itemId);
    if (linked) return linked;
  }
  const want = words(ing.name);
  if (!want.length) return undefined;
  return live.find((i) => { const have = new Set(words(`${i.name} ${i.brand ?? ''}`)); return want.every((w) => have.has(w)); });
}

export interface Fit { have: number; missing: RecipeIngredient[]; basics: number }

/** How much of a recipe the pantry covers. */
export function fit(recipe: Pick<Recipe, 'ingredients'>, items: Item[]): Fit {
  const missing: RecipeIngredient[] = [];
  let have = 0, basics = 0;
  for (const ing of recipe.ingredients) {
    if (findInPantry(ing, items)) have++;
    else if (isBasic(ing)) basics++;
    else missing.push(ing);
  }
  return { have, missing, basics };
}

const UNIT = '(?:cups?|c\\.|tbsps?|tablespoons?|tsps?|teaspoons?|g|grams?|kg|ml|l|litres?|liters?|oz|lbs?|pounds?|cans?|tins?|cloves?|pinch(?:es)?|slices?|packs?|packets?|pcs|pieces?|bunch(?:es)?|handfuls?)';
const LINE = new RegExp(`^((?:[\\d½¼¾⅓⅔⅛.,/\\-\\s]|to\\b)+\\s*${UNIT}?\\.?)\\s+(.+)$`, 'i');

/** "2 tbsp olive oil" → { amount: "2 tbsp", name: "olive oil" }; a line without an amount is all name. */
export function parseIngredientLine(line: string): RecipeIngredient {
  const m = line.trim().match(LINE);
  return m ? { amount: m[1]!.trim(), name: m[2]!.trim() } : { amount: '', name: line.trim() };
}

export const ingredientLine = (i: RecipeIngredient) => [i.amount, i.name].filter(Boolean).join(' ');
