import { describe, expect, it } from 'vitest';
import { forgetLookup, lookupBarcode, lookupOnce, parseProduct, type LookupResult } from '../src/data/lookup';

const nutella = { code: '3017620422003', status: 1, product: { product_name: 'Nutella', brands: 'Ferrero, Nutella', quantity: '400 g e', image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.200.jpg' } };

describe('reading a product', () => {
  it('reads the name, size, first brand and photo', () => {
    expect(parseProduct(nutella)).toEqual({ name: 'Nutella, 400 g', brand: 'Ferrero', imageUrl: nutella.product.image_front_small_url, category: 'sweets' });
  });
  it('does not repeat a size the name already has', () => {
    expect(parseProduct({ status: 1, product: { product_name: 'Cola 330 ml', quantity: '330 ml' } })?.name).toBe('Cola 330 ml');
  });
  it('prefers the English name, then finds a name in any other field or language', () => {
    expect(parseProduct({ status: 1, product: { product_name: 'Croustilles', product_name_en: 'Rolled tortilla chips' } })?.name).toBe('Rolled tortilla chips');
    expect(parseProduct({ status: 1, product: { product_name: '', product_name_fr: 'Cure-dents ronds' } })?.name).toBe('Cure-dents ronds');
    expect(parseProduct({ status: 1, product: { product_name: ' ', generic_name: 'Oat drink' } })?.name).toBe('Oat drink');
    expect(parseProduct({ status: 1, product: { product_name: '', product_name_nl: 'Intense Nacho' } })?.name).toBe('Intense Nacho');
  });
  it('falls back to the brand when no name is recorded', () => {
    expect(parseProduct({ status: 1, product: { brands: 'Takis' } })).toEqual({ name: 'Takis', brand: 'Takis', imageUrl: undefined, category: 'snacks' });
  });
  it('treats a missing product as not found and ignores a photo that is not https', () => {
    expect(parseProduct({ status: 0, status_verbose: 'product not found' })).toBeNull();
    expect(parseProduct({ status: 1, product: {} })).toBeNull();
    expect(parseProduct(null)).toBeNull();
    expect(parseProduct({ status: 1, product: { product_name: 'X', image_front_small_url: 'http://example.com/x.jpg' } })?.imageUrl).toBeUndefined();
  });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const missing = () => json({ status: 0, status_verbose: 'product not found' }, 404);
const down = () => new Response('<html>Page temporarily unavailable</html>', { status: 503 });
const builtIn = (url: string) => url.includes('/barcodes/');
const lookup = (code: string, f: (url: string) => Response | Promise<Response>) => lookupBarcode(code, async (url) => f(url), 1000, undefined, 1);

describe('looking a barcode up', () => {
  it('asks every database and the built-in copy for the barcode and nothing else', async () => {
    const asked: string[] = [];
    const result = await lookup('3017620422003', (url) => { asked.push(url); return url.includes('world.openfoodfacts') ? json(nutella) : missing(); });
    expect(result).toMatchObject({ status: 'found', source: 'Open Food Facts', product: { name: 'Nutella, 400 g' } });
    expect(asked.map((u) => (builtIn(u) ? 'built-in' : new URL(u).host)).sort()).toEqual(['built-in', 'world.openbeautyfacts.org', 'world.openfoodfacts.org', 'world.openpetfoodfacts.org', 'world.openproductsfacts.org']);
    for (const u of asked) expect(u.replace(/3017620422003/g, '')).not.toMatch(/\d{6,}/);
  });
  it('uses another database when the first does not know the product', async () => {
    const beauty = await lookup('3600542525787', (url) => (url.includes('openbeautyfacts') ? json({ status: 1, product: { product_name: 'Shampoo' } }) : missing()));
    expect(beauty).toMatchObject({ status: 'found', source: 'Open Beauty Facts' });
  });
  it('gives a database that fails a second try', async () => {
    let tries = 0;
    const result = await lookup('3017620422003', (url) => {
      if (!url.includes('world.openfoodfacts')) return missing();
      return ++tries === 1 ? down() : json(nutella);
    });
    expect(tries).toBe(2);
    expect(result).toMatchObject({ status: 'found', source: 'Open Food Facts' });
  });
  it('says so when a database could not be reached, instead of "not found"', async () => {
    expect(await lookup('1', (url) => (url.includes('world.openfoodfacts') ? down() : missing()))).toEqual({ status: 'incomplete' });
    expect(await lookup('1', (url) => (url.includes('world.openfoodfacts') ? Promise.reject(new TypeError('Failed to fetch')) : missing()))).toEqual({ status: 'incomplete' });
  });
  it('tells an unknown product from no connection', async () => {
    expect(await lookup('1', () => missing())).toEqual({ status: 'not_found' });
    expect(await lookup('1', (url) => (builtIn(url) ? down() : missing()))).toEqual({ status: 'not_found' });
    expect(await lookup('1', () => down())).toEqual({ status: 'offline' });
    expect(await lookup('1', (url) => (builtIn(url) ? new Response('', { status: 404 }) : Promise.reject(new TypeError('Failed to fetch'))))).toEqual({ status: 'offline' });
    expect(await lookup('1', () => Promise.reject(new TypeError('Failed to fetch')))).toEqual({ status: 'offline' });
  });
});

describe('one lookup per product', () => {
  it('shares one lookup between everyone asking, and retries only failures', async () => {
    let calls = 0;
    const found = async (): Promise<LookupResult> => { calls++; return { status: 'found', source: 'x', product: { name: 'A' } }; };
    const [a, b] = await Promise.all([lookupOnce('111', found), lookupOnce('111', found)]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
    await lookupOnce('111', found);
    expect(calls).toBe(1);
    forgetLookup('111');
    await lookupOnce('111', found);
    expect(calls).toBe(2);

    let fails = 0;
    const offline = async (): Promise<LookupResult> => { fails++; return { status: 'offline' }; };
    await lookupOnce('222', offline);
    await new Promise((r) => setTimeout(r, 0));
    await lookupOnce('222', offline);
    expect(fails).toBe(2);
    expect(await lookupOnce('333', () => Promise.reject(new Error('boom')))).toEqual({ status: 'offline' });
  });
});
