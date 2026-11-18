import { describe, expect, it } from 'vitest';
import { amount, clean, decode, FACT_ROWS, fromOpenFoodFacts, liquid } from '../src/data/nutrition';
import { lookupBarcode } from '../src/data/lookup';

const takis = {
  product_name: 'Takis Fuego', quantity: '280 g', serving_size: '28 g', serving_quantity: 28,
  nutriments: { 'energy-kcal_100g': 535.714285714286, fat_100g: 28.5714285714286, 'saturated-fat_100g': 8.9, 'trans-fat_100g': 0, cholesterol_100g: 0,
    carbohydrates_100g: 60.7142857142857, fiber_100g: 3.57142857142857, sugars_100g: 3.6, proteins_100g: 7.14, sodium_100g: 1.5 },
};
const row = (key: string) => FACT_ROWS.find((r) => r.key === key)!;

describe('nutrition', () => {
  it('reads Open Food Facts amounts per 100 g, with sodium and cholesterol in mg', () => {
    expect(fromOpenFoodFacts(takis)).toEqual({ per: 'g', kcal: 536, fat: 28.6, saturatedFat: 8.9, transFat: 0, cholesterolMg: 0, carbs: 60.7, fiber: 3.6, sugars: 3.6, protein: 7.1, sodiumMg: 1500, serving: '28 g', servingSize: 28 });
  });
  it('labels drinks per 100 ml', () => {
    expect(liquid('355 mL')).toBe(true);
    expect(liquid('12 x 12 fl oz')).toBe(true);
    expect(liquid('2 l')).toBe(true);
    expect(liquid('280 g')).toBe(false);
    expect(fromOpenFoodFacts({ quantity: '355 ml', nutriments: { 'energy-kcal_100g': 42 } })?.per).toBe('ml');
  });
  it('drops impossible values and needs calories or three amounts', () => {
    expect(clean({ kcal: 4000, fat: -1, sugars: 120, protein: 5, carbs: 10, fiber: 1 }, 'g')).toEqual({ per: 'g', protein: 5, carbs: 10, fiber: 1 });
    expect(clean({ protein: 5, fat: 2 }, 'g')).toBeNull();
    expect(clean({ kcal: 0 }, 'g')).toEqual({ per: 'g', kcal: 0 });
    expect(fromOpenFoodFacts({ nutriments: {} })).toBeNull();
    expect(fromOpenFoodFacts({})).toBeNull();
  });
  it('reads the built-in copy\'s field', () => {
    expect(decode('g;536,28.6,8.9,0,0,60.7,3.6,3.6,7.1,1500;28;28 g')).toEqual(fromOpenFoodFacts(takis));
    expect(decode('ml;42,,,,,10.6,,10.6,,10')).toEqual({ per: 'ml', kcal: 42, carbs: 10.6, sugars: 10.6, sodiumMg: 10 });
    expect(decode('')).toBeNull();
  });
  it('works out a serving', () => {
    const n = fromOpenFoodFacts(takis)!;
    expect(amount(n, row('kcal'), 28)).toBe('150');
    expect(amount(n, row('fat'), 28)).toBe('8 g');
    expect(amount(n, row('saturatedFat'), 28)).toBe('2.5 g');
    expect(amount(n, row('sodiumMg'), 28)).toBe('420 mg');
    expect(amount(n, row('fat'))).toBe('29 g');
    expect(amount({ per: 'g' }, row('fat'))).toBeUndefined();
  });
  it('takes nutrition from another database when the best match has none', async () => {
    const result = await lookupBarcode('0757528051723', async (url) => {
      if (url.includes('world.openfoodfacts')) return new Response(JSON.stringify({ status: 1, product: { product_name: 'Takis Fuego' } }));
      if (url.includes('openproductsfacts')) return new Response(JSON.stringify({ status: 1, product: { ...takis, product_name: 'Other name' } }));
      return new Response('{}', { status: 404 });
    }, 1000, undefined, 1);
    expect(result).toMatchObject({ status: 'found', product: { name: 'Takis Fuego', nutrition: { kcal: 536 } } });
  });
});
