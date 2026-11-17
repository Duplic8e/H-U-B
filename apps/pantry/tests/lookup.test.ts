import { describe, expect, it } from 'vitest';
import { lookupBarcode, parseProduct, parseUsda } from '../src/data/lookup';

const nutella = { code: '3017620422003', status: 1, product: { product_name: 'Nutella', brands: 'Ferrero, Nutella', quantity: '400 g e', image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.200.jpg' } };

describe('Open Food Facts lookup', () => {
  it('reads the name, size, first brand and photo', () => {
    expect(parseProduct(nutella)).toEqual({ name: 'Nutella, 400 g', brand: 'Ferrero', imageUrl: nutella.product.image_front_small_url });
  });
  it('does not repeat a size the name already has, and falls back to other name fields', () => {
    expect(parseProduct({ status: 1, product: { product_name: 'Cola 330 ml', quantity: '330 ml' } })?.name).toBe('Cola 330 ml');
    expect(parseProduct({ status: 1, product: { product_name: ' ', generic_name: 'Oat drink' } })).toEqual({ name: 'Oat drink', brand: undefined, imageUrl: undefined });
  });
  it('treats a missing product or a nameless one as not found', () => {
    expect(parseProduct({ status: 0, status_verbose: 'product not found' })).toBeNull();
    expect(parseProduct({ status: 1, product: { brands: 'Acme' } })).toBeNull();
    expect(parseProduct(null)).toBeNull();
  });
  it('ignores a photo that is not https', () => {
    expect(parseProduct({ status: 1, product: { product_name: 'X', image_front_small_url: 'http://example.com/x.jpg' } })?.imageUrl).toBeUndefined();
  });

  it('reads a USDA branded food, matching the barcode whatever its padding', () => {
    const body = { foods: [
      { description: 'SOMETHING ELSE', gtinUpc: '049000000443' },
      { description: 'COCA-COLA CLASSIC', brandOwner: 'The Coca-Cola Company', brandName: 'COCA-COLA', gtinUpc: '00049000028904', packageWeight: '20 fl oz/591 mL' },
    ] };
    expect(parseUsda(body, '0049000028904')).toEqual({ name: 'Coca-Cola Classic, 20 fl oz', brand: 'Coca-Cola' });
    expect(parseUsda(body, '0049000028911')).toBeNull();
    expect(parseUsda({ error: { code: 'OVER_RATE_LIMIT' } }, '1')).toBeNull();
  });

  const off = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const missing = () => off({ status: 0, status_verbose: 'product not found' }, 404);

  it('asks every database for the barcode and nothing else', async () => {
    const asked: string[] = [];
    const result = await lookupBarcode('3017620422003', async (url) => { asked.push(url); return url.includes('openfoodfacts') ? off(nutella) : missing(); });
    expect(result).toMatchObject({ status: 'found', source: 'Open Food Facts', product: { name: 'Nutella, 400 g' } });
    expect(asked.map((u) => new URL(u).host).sort()).toEqual(['api.nal.usda.gov', 'world.openbeautyfacts.org', 'world.openfoodfacts.org', 'world.openpetfoodfacts.org', 'world.openproductsfacts.org']);
    for (const u of asked) expect(u.replace(/3017620422003/g, '')).not.toMatch(/\d{6,}/);
  });
  it('uses another database when the first does not know the product', async () => {
    const result = await lookupBarcode('0049000028904', async (url) => (url.includes('usda') ? off({ foods: [{ description: 'COLA', gtinUpc: '049000028904' }] }) : missing()));
    expect(result).toMatchObject({ status: 'found', source: 'USDA FoodData Central', product: { name: 'Cola' } });
    const beauty = await lookupBarcode('3600542525787', async (url) => (url.includes('openbeautyfacts') ? off({ status: 1, product: { product_name: 'Shampoo' } }) : url.includes('usda') ? off({}, 429) : missing()));
    expect(beauty).toMatchObject({ status: 'found', source: 'Open Beauty Facts' });
  });
  it('tells an unknown product from a failed connection', async () => {
    expect(await lookupBarcode('1', async () => missing())).toEqual({ status: 'not_found' });
    expect(await lookupBarcode('1', async (url) => (url.includes('usda') ? off({}, 429) : off({ status: 0 })))).toEqual({ status: 'not_found' });
    expect(await lookupBarcode('1', async () => new Response('busy', { status: 503 }))).toEqual({ status: 'offline' });
    expect(await lookupBarcode('1', async () => { throw new TypeError('Failed to fetch'); })).toEqual({ status: 'offline' });
    expect(await lookupBarcode('1', async () => new Response('<html>', { status: 200 }))).toEqual({ status: 'offline' });
  });
});
