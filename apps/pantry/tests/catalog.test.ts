// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { findInShard, readShard, shardOf } from '../src/data/catalog';
import { lookupBarcode } from '../src/data/lookup';

const tsv = (rows: string[][]) => gzipSync(rows.map((r) => r.join('\t')).join('\n') + '\n');
const HEAD = ['code', 'product_name', 'abbreviated_product_name', 'generic_name', 'quantity', 'brands', 'image_small_url'];
const csv = (rows: string[][]) => rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';

/** Runs the real build script on small files laid out like the real downloads. */
function build() {
  const dir = mkdtempSync(join(tmpdir(), 'pantry-catalog-'));
  writeFileSync(join(dir, 'off.csv.gz'), tsv([HEAD,
    ['3017620422003', 'Nutella', '', '', '400 g e', 'Ferrero,Nutella', 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.200.jpg'],
    ['757528051723', 'Takis Fuego', '', '', '', 'Takis', 'https://images.openfoodfacts.org/images/products/075/752/805/1723/front_en.8.200.jpg'],
    ['0757528049102', '', '', '', '', 'Takis', ''],
    ['12345', 'Not a real barcode', '', '', '', '', ''],
    ['3017620422004', 'Wrong check digit', '', '', '', '', ''],
  ]));
  writeFileSync(join(dir, 'opf.csv.gz'), tsv([HEAD,
    ['0011225139499', 'Round toothpicks', '', '', '250 pcs', 'Simply Done', 'https://images.openproductsfacts.org/images/products/001/122/513/9499/front_en.7.200.jpg'],
    ['3017620422003', 'Should lose to Open Food Facts', '', '', '', '', ''],
  ]));
  mkdirSync(join(dir, 'usda'));
  writeFileSync(join(dir, 'usda', 'branded_food.csv'), csv([
    ['fdc_id', 'brand_owner', 'brand_name', 'gtin_upc', 'ingredients', 'package_weight', 'available_date', 'discontinued_date'],
    ['1', 'The Coca-Cola Company', 'COCA-COLA', '049000028904', 'WATER, "SUGAR"\nAND MORE', '20 OZA/591 mL', '2020-01-01', ''],
    ['2', 'The Coca-Cola Company', 'COCA-COLA', '00049000028904', '', '20 OZA/591 mL', '2024-06-01', ''],
    ['3', 'Gone Foods', 'GONE', '00012000161155', '', '', '2024-01-01', '2024-05-01'],
    ['4', 'Mutti', 'MUTTI', '3017620422003', '', '', '2024-01-01', ''],
  ]));
  writeFileSync(join(dir, 'usda', 'food.csv'), csv([
    ['fdc_id', 'data_type', 'description'],
    ['1', 'branded_food', 'OLD COLA NAME'], ['2', 'branded_food', 'COCA-COLA CLASSIC'], ['3', 'branded_food', 'GONE'], ['4', 'branded_food', 'NOT THIS'],
  ]));
  const out = join(dir, 'out');
  execFileSync('node', ['scripts/build-catalog.mjs', '--facts', `o=${join(dir, 'off.csv.gz')},p=${join(dir, 'opf.csv.gz')}`, '--usda', join(dir, 'usda'), '--out', out], { stdio: 'pipe' });
  return out;
}

describe('the built-in copy', () => {
  const out = build();
  const shard = (code: string) => readFileSync(join(out, `${shardOf(code)}.gz`));
  const find = async (code: string) => readShard(existsSync(join(out, `${shardOf(code)}.gz`)) ? new Response(shard(code)) : new Response('', { status: 404 }), code);

  it('finds products from every source, by any length of the same code', async () => {
    expect(await find('3017620422003')).toEqual({ name: 'Nutella, 400 g', brand: 'Ferrero', imageUrl: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.200.jpg', source: 'Open Food Facts (built-in copy)' });
    expect(await find('0757528051723')).toMatchObject({ name: 'Takis Fuego', imageUrl: 'https://images.openfoodfacts.org/images/products/075/752/805/1723/front_en.8.200.jpg' });
    expect(await find('0757528049102')).toMatchObject({ name: 'Takis' });
    expect(await find('0011225139499')).toMatchObject({ name: 'Round toothpicks, 250 pcs', imageUrl: 'https://images.openproductsfacts.org/images/products/001/122/513/9499/front_en.7.200.jpg', source: 'Open Products Facts (built-in copy)' });
  });
  it('takes USDA\'s latest label, in normal capitals, with a readable size', async () => {
    expect(await find('0049000028904')).toEqual({ name: 'Coca-Cola Classic, 20 fl oz', brand: 'Coca-Cola', imageUrl: undefined, source: 'USDA FoodData Central (built-in copy)' });
  });
  it('leaves out discontinued products and codes that cannot be scanned', async () => {
    expect(await find('0012000161155')).toBeNull();
    const meta = JSON.parse(readFileSync(join(out, 'meta.json'), 'utf8'));
    expect(meta).toMatchObject({ products: 5, bySource: { o: 3, p: 1, u: 1 } });
  });
  it('treats a missing file as "not in the copy"', async () => {
    expect(await readShard(new Response('', { status: 404 }), '1')).toBeNull();
    expect(findInShard('', '1')).toBeNull();
  });

  it('answers a scan when every online database is down', async () => {
    const result = await lookupBarcode('0011225139499', async (url) => {
      if (url.includes('/barcodes/')) return new Response(shard('0011225139499'));
      return new Response('Page temporarily unavailable', { status: 503 });
    }, 2000, undefined, 1);
    expect(result).toMatchObject({ status: 'found', source: 'Open Products Facts (built-in copy)', product: { name: 'Round toothpicks, 250 pcs' } });
  });
});
