import { describe, expect, it } from 'vitest';
import { lookupBarcode, parseProduct } from '../src/data/lookup';

const nutella = { code: '3017620422003', status: 1, product: { product_name: 'Nutella', brands: 'Ferrero, Nutella', quantity: '400 g', image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.200.jpg' } };

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

  it('asks for the barcode and nothing else', async () => {
    let asked = '';
    const result = await lookupBarcode('3017620422003', async (url) => { asked = url; return new Response(JSON.stringify(nutella), { status: 200 }); });
    expect(result).toMatchObject({ status: 'found', product: { name: 'Nutella, 400 g' } });
    expect(new URL(asked).origin + new URL(asked).pathname).toBe('https://world.openfoodfacts.org/api/v2/product/3017620422003.json');
  });
  it('tells an unknown product from a failed connection', async () => {
    expect(await lookupBarcode('1', async () => new Response(JSON.stringify({ status: 0 }), { status: 404 }))).toEqual({ status: 'not_found' });
    expect(await lookupBarcode('1', async () => new Response(JSON.stringify({ status: 0 }), { status: 200 }))).toEqual({ status: 'not_found' });
    expect(await lookupBarcode('1', async () => new Response('busy', { status: 503 }))).toEqual({ status: 'offline' });
    expect(await lookupBarcode('1', async () => { throw new TypeError('Failed to fetch'); })).toEqual({ status: 'offline' });
    expect(await lookupBarcode('1', async () => new Response('<html>', { status: 200 }))).toEqual({ status: 'offline' });
  });
});
