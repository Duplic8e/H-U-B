import { lookupOnce, type LookupResult } from './lookup';
import type { Repo } from './repo';
import type { Item, Scan } from './types';

/** Looks scanned groceries up in the background, a few at a time, as they are scanned. Products
 *  Pantry already knows only get their nutrition filled in, once. */
export class GroceryLookups {
  private running = new Set<string>();
  private tried = new Set<string>();
  private queue: Scan[] = [];

  constructor(
    private readonly repo: Repo,
    private readonly lookup: (barcode: string) => Promise<LookupResult> = (b) => lookupOnce(b),
    private readonly limit = 3,
  ) {}

  /** Call with the current list whenever it changes. */
  update(scans: Scan[]) {
    this.queue = scans.filter((s) => !this.running.has(s.barcode) && (s.lookup === undefined || (s.lookup === 'known' && !s.nutrition && !this.tried.has(s.barcode))));
    this.pump();
  }

  /** Waits until nothing is being looked up (for tests). */
  async idle() {
    while (this.running.size) await new Promise((r) => setTimeout(r, 5));
  }

  private pump() {
    while (this.running.size < this.limit && this.queue.length) {
      const scan = this.queue.shift()!;
      if (this.running.has(scan.barcode)) continue;
      this.running.add(scan.barcode);
      this.tried.add(scan.barcode);
      void this.run(scan.barcode).finally(() => { this.running.delete(scan.barcode); this.pump(); });
    }
  }

  private async run(barcode: string) {
    let result: LookupResult;
    try { result = await this.lookup(barcode); } catch { result = { status: 'offline' }; }
    const now = (await this.repo.listScans()).find((s) => s.barcode === barcode);
    if (!now) return;
    if (now.lookup === 'known') {
      if (result.status === 'found' && result.product.nutrition && !now.nutrition) await this.repo.updateScan(barcode, { nutrition: result.product.nutrition });
      return;
    }
    if (result.status !== 'found') { await this.repo.updateScan(barcode, { lookup: result.status }); return; }
    const p = result.product;
    await this.repo.updateScan(barcode, {
      lookup: 'found', imageUrl: now.imageUrl ?? p.imageUrl, nutrition: now.nutrition ?? p.nutrition,
      ...(now.edited ? {} : { name: p.name, brand: p.brand }),
    });
  }
}

/** Finishes lookups for pantry items saved before theirs came back, a couple at a time. One that
 *  could not reach the databases is tried again on `retry` (the app calls it when the connection
 *  returns or the app is reopened). */
export class ItemLookups {
  private running = new Set<string>();
  private tried = new Set<string>();
  private latest: Item[] = [];

  constructor(
    private readonly repo: Repo,
    private readonly lookup: (barcode: string) => Promise<LookupResult> = (b) => lookupOnce(b),
    private readonly limit = 2,
  ) {}

  update(items: Item[]) {
    this.latest = items;
    this.pump();
  }

  retry() {
    this.tried.clear();
    this.pump();
  }

  async idle() {
    while (this.running.size) await new Promise((r) => setTimeout(r, 5));
  }

  private pump() {
    for (const item of this.latest) {
      if (this.running.size >= this.limit) return;
      if (item.lookup !== 'pending' || !item.barcode || this.running.has(item.id) || this.tried.has(item.id)) continue;
      this.running.add(item.id);
      this.tried.add(item.id);
      const barcode = item.barcode;
      void (async () => {
        let result: LookupResult;
        try { result = await this.lookup(barcode); } catch { result = { status: 'offline' }; }
        await this.repo.applyLookup(item.id, result);
      })().finally(() => { this.running.delete(item.id); this.pump(); });
    }
  }
}
