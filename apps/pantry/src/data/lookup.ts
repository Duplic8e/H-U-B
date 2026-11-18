import { readShard, shardOf, withSize } from './catalog';
import { fromOpenFoodFacts, type Nutrition } from './nutrition';

/** What a barcode lookup can tell us about a product. */
export interface Product {
  name: string;
  brand?: string;
  imageUrl?: string;
  nutrition?: Nutrition;
}

/** `incomplete`: some databases could not be reached and none of the others know the product. */
export type LookupResult = { status: 'found'; product: Product; source: string } | { status: 'not_found' } | { status: 'incomplete' } | { status: 'offline' };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// Every place a product's name can be. Canadian products often have only an English or French one.
const NAME_FIELDS = ['product_name_en', 'product_name', 'product_name_fr', 'abbreviated_product_name', 'generic_name_en', 'generic_name', 'generic_name_fr',
  'product_name_es', 'product_name_de', 'product_name_it', 'product_name_nl', 'product_name_pt'] as const;

/** Reads an Open Food Facts v2 product response (its sister databases answer the same way). Null when it holds no usable name. */
export function parseProduct(raw: unknown): Product | null {
  const body = raw as { status?: unknown; product?: Record<string, unknown> } | null;
  const p = body?.product;
  if (!p || (body.status !== 1 && body.status !== 'success')) return null;
  const brand = text(p.brands)?.split(',')[0]?.trim() || undefined;
  // With no name at all, the brand ("Takis") beats an empty box.
  const base = NAME_FIELDS.map((f) => text(p[f])).find(Boolean) ?? brand;
  if (!base) return null;
  // Drops the EU "℮" estimate mark, which the database stores as a trailing "e".
  const size = text(p.quantity)?.replace(/\s*\be$/, '').trim() || undefined;
  const image = text(p.image_front_small_url) ?? text(p.image_small_url) ?? text(p.image_front_url);
  const nutrition = fromOpenFoodFacts(p) ?? undefined;
  return { name: withSize(base, size), brand, imageUrl: image?.startsWith('https://') ? image : undefined, ...(nutrition ? { nutrition } : {}) };
}

interface Source {
  name: string;
  url: (barcode: string) => string;
  /** The product, or null when this database does not have it. Throws when it could not answer. */
  read: (res: Response, barcode: string) => Promise<(Product & { source?: string }) | null>;
  /** The copy served with the app; its failures do not mean the online databases are unreachable. */
  builtIn?: boolean;
}

const FIELDS = `fields=${[...NAME_FIELDS, 'brands', 'quantity', 'image_front_small_url', 'image_small_url', 'image_front_url', 'nutriments', 'serving_size', 'serving_quantity', 'product_quantity_unit'].join(',')}`;
const facts = (name: string, host: string): Source => ({
  name,
  url: (b) => `https://${host}/api/v2/product/${encodeURIComponent(b)}.json?${FIELDS}`,
  read: async (res) => {
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return parseProduct(await res.json());
  },
});

const builtIn = (base: string): Source => ({
  name: 'Built-in copy',
  url: (b) => `${base}barcodes/${shardOf(b)}.gz`,
  read: readShard,
  builtIn: true,
});

/** Every place asked, best first: when two know the product, the earlier one's answer is used.
 *  The live databases have this week's additions; the built-in copy (Open Food Facts and its sister
 *  databases, plus USDA's US branded foods) answers when they are slow or down. Only the barcode is sent. */
export function sources(base: string = import.meta.env.BASE_URL): Source[] {
  return [
    facts('Open Food Facts', 'world.openfoodfacts.org'),
    builtIn(base),
    facts('Open Products Facts', 'world.openproductsfacts.org'),
    facts('Open Beauty Facts', 'world.openbeautyfacts.org'),
    facts('Open Pet Food Facts', 'world.openpetfoodfacts.org'),
  ];
}

const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
});

/** Asks every database at once, giving each that fails a second try. */
export async function lookupBarcode(barcode: string, doFetch: Fetch = (i, init) => fetch(i, init), timeoutMs = 10000, list: Source[] = sources(), retryMs = 700): Promise<LookupResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const ask = async (s: Source) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return { product: await s.read(await doFetch(s.url(barcode), { signal: abort.signal }), barcode) };
      } catch {
        if (attempt >= 1 || abort.signal.aborted) return 'failed' as const;
        await pause(retryMs, abort.signal);
      }
    }
  };
  try {
    const answers = await Promise.all(list.map(ask));
    const found = answers.map((a, i) => (a === 'failed' || !a.product ? null : { ...a.product, source: a.product.source ?? list[i]!.name })).filter((a) => !!a);
    const best = found[0];
    if (best) {
      const { source, ...product } = best;
      // The best answer names the product; nutrition can come from the next one that has it.
      const nutrition = found.find((f) => f.nutrition)?.nutrition;
      return { status: 'found', product: { ...product, ...(nutrition ? { nutrition } : {}) }, source };
    }
    const online = answers.filter((_, i) => !list[i]!.builtIn);
    if (online.every((a) => a === 'failed')) return { status: 'offline' };
    return online.some((a) => a === 'failed') ? { status: 'incomplete' } : { status: 'not_found' };
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map<string, Promise<LookupResult>>();

/** One lookup per barcode for this visit, shared by the scan sheet, groceries and the background
 *  resolver, so a product is never asked for twice at once. Failures are forgotten, so the next ask retries. */
export function lookupOnce(barcode: string, lookup: (b: string) => Promise<LookupResult> = (b) => lookupBarcode(b)): Promise<LookupResult> {
  const have = cache.get(barcode);
  if (have) return have;
  const p = lookup(barcode).catch((): LookupResult => ({ status: 'offline' }));
  cache.set(barcode, p);
  void p.then((r) => { if (r.status === 'incomplete' || r.status === 'offline') cache.delete(barcode); });
  return p;
}

export function forgetLookup(barcode: string) {
  cache.delete(barcode);
}
