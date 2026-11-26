import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { categoryFromTags, categoryFromWords, categoryLabel, categoryOf, CATEGORIES } from '../src/data/categories';
import { PantryDB } from '../src/data/db';
import { lookupBarcode, parseProduct } from '../src/data/lookup';
import { createRepo } from '../src/data/repo';

describe('categories', () => {
  it('reads Open Food Facts category tags', () => {
    expect(categoryFromTags(['en:plant-based-foods', 'en:cereals-and-potatoes', 'en:breads', 'en:sliced-breads'])).toBe('carbs');
    expect(categoryFromTags(['en:meats', 'en:poultries', 'en:chickens'])).toBe('protein');
    expect(categoryFromTags(['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'])).toBe('sweets');
    expect(categoryFromTags(['en:snacks', 'en:salty-snacks', 'en:appetizers', 'en:chips-and-fries', 'en:crisps', 'en:corn-chips'])).toBe('snacks');
    expect(categoryFromTags(['en:beverages', 'en:plant-based-beverages', 'en:milk-substitutes'])).toBe('dairy');
    expect(categoryFromTags(['en:beverages', 'en:fruit-juices'])).toBe('drinks');
    expect(categoryFromTags(['fr:inconnu'])).toBeUndefined();
    expect(categoryFromTags(undefined)).toBeUndefined();
  });
  it('guesses from a name, in English or French', () => {
    expect(categoryFromWords('Whole wheat bread')).toBe('carbs');
    expect(categoryFromWords('Chicken breasts')).toBe('protein');
    expect(categoryFromWords('Pain tranché')).toBe('carbs');
    expect(categoryFromWords('Lait 2%')).toBe('dairy');
    expect(categoryFromWords('Round toothpicks, 250 pcs')).toBe('household');
    expect(categoryFromWords('Takis Fuego')).toBe('snacks');
    expect(categoryFromWords('Chopped tomatoes, 400 g')).toBe('produce');
    expect(categoryFromWords('The Original')).toBeUndefined(); // "the" is not tea
    expect(categoryFromWords('')).toBeUndefined();
  });
  it('falls back to a guess, then to Other', () => {
    expect(categoryOf({ name: 'Spaghetti' })).toBe('carbs');
    expect(categoryOf({ name: 'Spaghetti', category: 'meals' })).toBe('meals');
    expect(categoryOf({ name: 'Mystery thing' })).toBe('other');
    expect(categoryLabel('produce')).toBe('Fruits & veg');
    expect(new Set(CATEGORIES.map((c) => c.code)).size).toBe(CATEGORIES.length);
  });
  it('comes back from lookups', async () => {
    expect(parseProduct({ status: 1, product: { product_name: 'Bread', categories_tags: ['en:breads'] } })?.category).toBe('carbs');
    const r = await lookupBarcode('0011225139499', async (url) => (url.includes('openproductsfacts') ? new Response(JSON.stringify({ status: 1, product: { product_name: 'Thing' } })) : new Response('{}', { status: 404 })), 1000, undefined, 1);
    expect(r).toMatchObject({ status: 'found', product: { category: 'household' } });
  });
});

let n = 0;
const fresh = () => createRepo(new PantryDB(`pantry-cat-${++n}`));
const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';

describe('use up by scanning', () => {
  it('takes one out, removes the last one, says when it is not there, and undoes', async () => {
    const repo = fresh();
    await repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 2 });
    expect(await repo.useUpByBarcode('3017620422003')).toMatchObject({ left: 1, item: { name: 'Nutella' } });
    const last = await repo.useUpByBarcode('3017620422003');
    expect(last?.left).toBe(0);
    expect(await repo.listItems()).toEqual([]);
    expect(await repo.useUpByBarcode('3017620422003')).toBeNull();
    expect(await repo.useUpByBarcode('0000000000017')).toBeNull();
    await repo.undoUseUp(last!.item.id);
    expect(await repo.listItems()).toMatchObject([{ name: 'Nutella', quantity: 1 }]);
    await repo.useUpByBarcode('3017620422003');
    await repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 3 });
    await repo.useUpByBarcode('3017620422003');
    await repo.undoUseUp('b:3017620422003');
    expect(await repo.listItems()).toMatchObject([{ quantity: 3 }]);
  });
});

describe('scan photos', () => {
  it('keeps the scan photo only for products without a photo of their own', async () => {
    const repo = fresh();
    await repo.saveItem({ barcode: '1', name: 'Mystery', quantity: 1, photo: PHOTO });
    await repo.saveItem({ barcode: '2', name: 'Known', quantity: 1, photo: PHOTO, imageUrl: 'https://images.openfoodfacts.org/x.jpg' });
    const items = Object.fromEntries((await repo.listItems()).map((i) => [i.name, i]));
    expect(items['Mystery']!.photo).toBe(PHOTO);
    expect(items['Known']!.photo).toBeUndefined();
  });
  it('drops the scan photo once a background lookup finds a real one, and fills the category', async () => {
    const repo = fresh();
    const id = await repo.saveItem({ barcode: '3017620422003', name: '', quantity: 1, photo: PHOTO });
    await repo.applyLookup(id, { status: 'found', source: 'x', product: { name: 'Nutella', imageUrl: 'https://images.openfoodfacts.org/n.jpg', category: 'sweets' } });
    expect((await repo.listItems())[0]).toMatchObject({ name: 'Nutella', category: 'sweets', photo: undefined });
  });
  it('carries photos and categories from scanned groceries into the pantry', async () => {
    const repo = fresh();
    await repo.addScan('0000000000017', PHOTO);
    await repo.addScan('0000000000017', 'data:image/jpeg;base64,second');
    await repo.updateScan('0000000000017', { lookup: 'not_found', name: 'Mom\'s cookies', edited: true, category: 'sweets' });
    await repo.addScansToPantry();
    expect((await repo.listItems())[0]).toMatchObject({ name: 'Mom\'s cookies', photo: PHOTO, category: 'sweets', quantity: 2 });
  });
  it('files fresh meat under Protein', async () => {
    const repo = fresh();
    await repo.addMeat({ key: 'chicken-wing', name: 'Chicken wings', quantity: 12, unit: 'pieces', storage: 'fridge' });
    expect((await repo.listItems())[0]!.category).toBe('protein');
  });
});
