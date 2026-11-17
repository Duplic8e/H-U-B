import type { Item } from './types';

export const SOON_DAYS = 7;

/** Today's local calendar date as YYYY-MM-DD. */
export function today(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Whole days from `from` to `date` (both YYYY-MM-DD); negative once the date has passed. */
export function daysUntil(date: string, from: string): number {
  const utc = (d: string) => { const [y = 0, m = 1, day = 1] = d.split('-').map(Number); return Date.UTC(y, m - 1, day); };
  return Math.round((utc(date) - utc(from)) / 86_400_000);
}

export type ExpiryState = 'expired' | 'soon' | 'ok';

export function expiryState(date: string | undefined, from: string): ExpiryState | undefined {
  if (!date) return undefined;
  const d = daysUntil(date, from);
  return d < 0 ? 'expired' : d <= SOON_DAYS ? 'soon' : 'ok';
}

export function expiryLabel(date: string, from: string): string {
  const d = daysUntil(date, from);
  if (d < -1) return `Expired ${-d} days ago`;
  if (d === -1) return 'Expired yesterday';
  if (d === 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  if (d <= 14) return `Expires in ${d} days`;
  const [y = 0, m = 1, day = 1] = date.split('-').map(Number);
  const sameYear = y === Number(from.slice(0, 4));
  return `Expires ${new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' })}`;
}

/** Dated items first, soonest first; then the rest by name. */
export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    if (a.expiresOn && b.expiresOn) return a.expiresOn.localeCompare(b.expiresOn) || a.name.localeCompare(b.name);
    if (a.expiresOn) return -1;
    if (b.expiresOn) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function matches(item: Item, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || item.name.toLowerCase().includes(q) || (item.brand ?? '').toLowerCase().includes(q) || (item.barcode ?? '').includes(q);
}
