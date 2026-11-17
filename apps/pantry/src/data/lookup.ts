/** What a barcode lookup can tell us about a product. */
export interface Product {
  name: string;
  brand?: string;
  imageUrl?: string;
}

export type LookupResult = { status: 'found'; product: Product; source: string } | { status: 'not_found' } | { status: 'offline' };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Reads an Open Food Facts v2 product response (its sister databases answer the same way). Null when it holds no usable name. */
export function parseProduct(raw: unknown): Product | null {
  const body = raw as { status?: unknown; product?: Record<string, unknown> } | null;
  const p = body?.product;
  if (!p || (body.status !== 1 && body.status !== 'success')) return null;
  const base = text(p.product_name) ?? text(p.product_name_en) ?? text(p.generic_name);
  if (!base) return null;
  // "500 g", "6 x 330 ml": tells two sizes of the same product apart in the list.
  const size = text(p.quantity)?.replace(/\s*\be$/, '').trim() || undefined; // drops the EU "℮" estimate mark, stored as a trailing "e"
  const image = text(p.image_front_small_url) ?? text(p.image_small_url) ?? text(p.image_front_url);
  return {
    name: size && !base.toLowerCase().includes(size.toLowerCase()) ? `${base}, ${size}` : base,
    brand: text(p.brands)?.split(',')[0]?.trim() || undefined,
    imageUrl: image?.startsWith('https://') ? image : undefined,
  };
}

const bare = (code: string) => code.replace(/\D/g, '').replace(/^0+/, '');
/** "COCA-COLA CLASSIC" → "Coca-Cola Classic": USDA names are in capitals. */
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-/(&])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : s);

/** Reads a USDA FoodData Central search response, keeping only a food whose barcode is this one. */
export function parseUsda(raw: unknown, barcode: string): Product | null {
  const foods = (raw as { foods?: unknown } | null)?.foods;
  if (!Array.isArray(foods)) return null;
  const hit = (foods as Array<Record<string, unknown>>).find((f) => typeof f?.gtinUpc === 'string' && bare(f.gtinUpc) === bare(barcode) && text(f.description));
  if (!hit) return null;
  const base = titleCase(text(hit.description)!);
  const size = text(hit.packageWeight)?.split('/')[0]?.trim();
  const brand = text(hit.brandName) ?? text(hit.brandOwner);
  return { name: size && !base.toLowerCase().includes(size.toLowerCase()) ? `${base}, ${size}` : base, brand: brand ? titleCase(brand) : undefined };
}

export const USDA_KEY_STORAGE = 'pantry-usda-key';
/** The user's own free USDA key if they saved one; otherwise the shared demo key, which allows only a few lookups an hour. */
export function usdaKey(): string {
  try { return globalThis.localStorage?.getItem(USDA_KEY_STORAGE)?.trim() || 'DEMO_KEY'; } catch { return 'DEMO_KEY'; }
}

interface Source {
  name: string;
  url: (barcode: string) => string;
  /** The product, or null when this database does not have it. */
  read: (res: Response, barcode: string) => Promise<Product | null>;
}

const FIELDS = 'fields=product_name,product_name_en,generic_name,brands,quantity,image_front_small_url,image_small_url,image_front_url';
const facts = (name: string, host: string): Source => ({
  name,
  url: (b) => `https://${host}/api/v2/product/${encodeURIComponent(b)}.json?${FIELDS}`,
  read: async (res) => {
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return parseProduct(await res.json());
  },
});

/** Every database asked, best first: when two know the product, the earlier one's answer is used.
 *  All are free, need no account, and allow calls from a browser. Only the barcode is sent. */
export const SOURCES: Source[] = [
  facts('Open Food Facts', 'world.openfoodfacts.org'),
  {
    name: 'USDA FoodData Central',
    url: (b) => `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(bare(b))}&dataType=Branded&pageSize=10&api_key=${encodeURIComponent(usdaKey())}`,
    read: async (res, barcode) => {
      if (!res.ok) throw new Error(`USDA ${res.status}`);
      return parseUsda(await res.json(), barcode);
    },
  },
  facts('Open Products Facts', 'world.openproductsfacts.org'),
  facts('Open Beauty Facts', 'world.openbeautyfacts.org'),
  facts('Open Pet Food Facts', 'world.openpetfoodfacts.org'),
];

/** Asks every database at once. Found if any has it; offline only if none could be reached. */
export async function lookupBarcode(barcode: string, doFetch: Fetch = (i, init) => fetch(i, init), timeoutMs = 8000, sources: Source[] = SOURCES): Promise<LookupResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const answers = await Promise.all(sources.map(async (s) => {
      try { return { product: await s.read(await doFetch(s.url(barcode), { signal: abort.signal }), barcode) }; } catch { return 'failed' as const; }
    }));
    const i = answers.findIndex((a) => a !== 'failed' && a.product);
    const hit = answers[i];
    if (hit && hit !== 'failed' && hit.product) return { status: 'found', product: hit.product, source: sources[i]!.name };
    return answers.every((a) => a === 'failed') ? { status: 'offline' } : { status: 'not_found' };
  } finally {
    clearTimeout(timer);
  }
}
