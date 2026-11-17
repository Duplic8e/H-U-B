/** What a barcode lookup can tell us about a product. */
export interface Product {
  name: string;
  brand?: string;
  imageUrl?: string;
}

export type LookupResult = { status: 'found'; product: Product } | { status: 'not_found' } | { status: 'offline' };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Reads an Open Food Facts v2 product response. Null when it holds no usable name. */
export function parseProduct(raw: unknown): Product | null {
  const body = raw as { status?: unknown; product?: Record<string, unknown> } | null;
  const p = body?.product;
  if (!p || (body.status !== 1 && body.status !== 'success')) return null;
  const base = text(p.product_name) ?? text(p.product_name_en) ?? text(p.generic_name);
  if (!base) return null;
  // "500 g", "6 x 330 ml": tells two sizes of the same product apart in the list.
  const size = text(p.quantity);
  const image = text(p.image_front_small_url) ?? text(p.image_small_url) ?? text(p.image_front_url);
  return {
    name: size && !base.toLowerCase().includes(size.toLowerCase()) ? `${base}, ${size}` : base,
    brand: text(p.brands)?.split(',')[0]?.trim() || undefined,
    imageUrl: image?.startsWith('https://') ? image : undefined,
  };
}

/** Looks a barcode up in Open Food Facts. Only the barcode is sent. */
export async function lookupBarcode(barcode: string, doFetch: Fetch = (i, init) => fetch(i, init), timeoutMs = 8000): Promise<LookupResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,generic_name,brands,quantity,image_front_small_url,image_small_url,image_front_url`;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await doFetch(url, { signal: abort.signal });
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'offline' };
    const product = parseProduct(await res.json());
    return product ? { status: 'found', product } : { status: 'not_found' };
  } catch {
    return { status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
