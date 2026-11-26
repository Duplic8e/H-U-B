import { bareBarcode } from './barcode';
import type { Product } from './lookup';
import { decode } from './nutrition';
import { categoryFromCode, categoryFromWords } from './categories';

/** Pantry's own copy of the product databases, built weekly by scripts/build-catalog.mjs and served
 *  with the app: one small gzip file per shard, so a lookup downloads about 10 KB. */

/** Which file a code is in: the 4 digits before its check digit. Must match the build script. */
export const shardOf = (code: string) => bareBarcode(code).padStart(5, '0').slice(-5, -1);

export const SOURCE_NAMES: Record<string, string> = {
  o: 'Open Food Facts', p: 'Open Products Facts', b: 'Open Beauty Facts', f: 'Open Pet Food Facts', u: 'USDA FoodData Central',
};
const IMAGE_HOSTS: Record<string, string> = { o: 'openfoodfacts', p: 'openproductsfacts', b: 'openbeautyfacts', f: 'openpetfoodfacts' };

/** The Open Food Facts photo folder for a code: padded to 13 digits, split 3/3/3/rest. */
export const imageFolder = (code: string) => code.padStart(13, '0').replace(/^(\d{3})(\d{3})(\d{3})(\d+)$/, '$1/$2/$3/$4');

export function withSize(name: string, size?: string): string {
  return size && !name.toLowerCase().includes(size.toLowerCase()) ? `${name}, ${size}` : name;
}

/** Finds a code in one shard's text. */
export function findInShard(text: string, barcode: string): (Product & { source: string }) | null {
  const want = bareBarcode(barcode);
  for (const line of text.split('\n')) {
    const [code = '', name = '', brand = '', quantity = '', image = '', source = '', facts = '', cat = ''] = line.split('\t');
    if (!name || bareBarcode(code) !== want) continue;
    const host = IMAGE_HOSTS[source];
    return {
      name: withSize(name, quantity || undefined),
      brand: brand || undefined,
      imageUrl: image && host ? `https://images.${host}.org/images/products/${image.includes('/') ? image : `${imageFolder(code)}/${image}`}` : undefined,
      source: `${SOURCE_NAMES[source] ?? 'Built-in copy'} (built-in copy)`,
      ...(decode(facts) ? { nutrition: decode(facts)! } : {}),
      category: categoryFromCode(cat) ?? (source === 'f' ? 'pet' : source === 'p' || source === 'b' ? 'household' : categoryFromWords(`${name} ${brand}`)),
    };
  }
  return null;
}

/** Reads a fetched shard. Null when the app was built without the copy (the file is missing). */
export async function readShard(res: Response, barcode: string): Promise<(Product & { source: string }) | null> {
  if (res.status === 404) return null;
  if (!res.ok || !res.body) throw new Error(`Built-in copy ${res.status}`);
  const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
  return findInShard(text, barcode);
}

export interface CatalogMeta { builtAt: string; products: number }

export async function catalogMeta(base: string = import.meta.env.BASE_URL): Promise<CatalogMeta | null> {
  try {
    const res = await fetch(`${base}barcodes/meta.json`);
    if (!res.ok) return null;
    const meta = (await res.json()) as Partial<CatalogMeta>;
    return typeof meta.products === 'number' && typeof meta.builtAt === 'string' ? { products: meta.products, builtAt: meta.builtAt } : null;
  } catch {
    return null;
  }
}
