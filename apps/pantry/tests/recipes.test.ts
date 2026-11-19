import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { PantryDB } from '../src/data/db';
import { findInPantry, fit, ingredientLine, parseIngredientLine } from '../src/data/recipes';
import { createRepo } from '../src/data/repo';
import type { Item } from '../src/data/types';

const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({ id, updatedAt: '', name, quantity: 1, ...extra });
const PANTRY = [item('b:1', 'Chopped tomatoes, 400 g', { brand: 'Mutti' }), item('b:2', 'Spaghetti'), item('b:3', 'Eggs', { quantity: 0 }), item('b:4', 'Old cheese', { deletedAt: 'x' })];

describe('recipes against the pantry', () => {
  it('finds ingredients by link, then by name', () => {
    expect(findInPantry({ name: 'whatever', amount: '', itemId: 'b:2' }, PANTRY)?.id).toBe('b:2');
    expect(findInPantry({ name: 'chopped tomato', amount: '' }, PANTRY)?.id).toBe('b:1');
    expect(findInPantry({ name: 'Mutti tomatoes', amount: '' }, PANTRY)?.id).toBe('b:1');
    expect(findInPantry({ name: 'eggs', amount: '' }, PANTRY)).toBeUndefined(); // none left
    expect(findInPantry({ name: 'cheese', amount: '' }, PANTRY)).toBeUndefined(); // used up
    expect(findInPantry({ name: 'basil', amount: '' }, PANTRY)).toBeUndefined();
  });
  it('counts what is there, what is missing, and kitchen basics apart', () => {
    const f = fit({ ingredients: [{ name: 'spaghetti', amount: '' }, { name: 'salt', amount: '' }, { name: 'olive oil', amount: '' }, { name: 'basil', amount: '' }] }, PANTRY);
    expect(f.have).toBe(1);
    expect(f.basics).toBe(2);
    expect(f.missing.map((m) => m.name)).toEqual(['basil']);
  });
  it('reads typed ingredient lines', () => {
    expect(parseIngredientLine('2 tbsp olive oil')).toEqual({ amount: '2 tbsp', name: 'olive oil' });
    expect(parseIngredientLine('1 can chopped tomatoes')).toEqual({ amount: '1 can', name: 'chopped tomatoes' });
    expect(parseIngredientLine('200 g spaghetti')).toEqual({ amount: '200 g', name: 'spaghetti' });
    expect(parseIngredientLine('½ cup milk')).toEqual({ amount: '½ cup', name: 'milk' });
    expect(parseIngredientLine('3 eggs')).toEqual({ amount: '3', name: 'eggs' });
    expect(parseIngredientLine('salt to taste')).toEqual({ amount: '', name: 'salt to taste' });
    expect(ingredientLine({ amount: '2 tbsp', name: 'olive oil' })).toBe('2 tbsp olive oil');
  });
  it('saves, deletes and undoes, and merges recipes from a backup', async () => {
    const repo = createRepo(new PantryDB('recipes-book'));
    const id = await repo.saveRecipe({ title: ' Pasta ', source: 'mine', ingredients: [{ name: ' spaghetti ', amount: '200 g' }, { name: ' ', amount: '' }], steps: ['Boil.', ' '] });
    expect(await repo.listRecipes()).toMatchObject([{ id, title: 'Pasta', ingredients: [{ name: 'spaghetti', amount: '200 g' }], steps: ['Boil.'] }]);
    await repo.removeRecipe(id);
    expect(await repo.listRecipes()).toEqual([]);
    await repo.restoreRecipe(id);
    expect(await repo.listRecipes()).toHaveLength(1);
    // A backup from before recipes existed still loads.
    await repo.mergeAll({ items: [item('b:9', 'Rice')] });
    await repo.mergeAll({ items: [], recipes: [{ id: 'r2', updatedAt: '2030-01-01T00:00:00Z', title: 'Fried rice', source: 'gemini', ingredients: [], steps: [] }] });
    expect((await repo.listRecipes()).map((r) => r.title)).toEqual(['Fried rice', 'Pasta']);
  });
});
