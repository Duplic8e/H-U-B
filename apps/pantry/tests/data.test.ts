import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { expandUpcE, normalizeBarcode, validCheckDigit } from '../src/data/barcode';
import { PantryDB } from '../src/data/db';
import { daysUntil, expiryLabel, expiryState, matches, sortItems, today } from '../src/data/expiry';
import { createRepo } from '../src/data/repo';
import type { Item } from '../src/data/types';

let n = 0;
function fresh() {
  let t = Date.parse('2026-11-17T10:00:00Z');
  return createRepo(new PantryDB(`pantry-data-${++n}`), () => new Date((t += 1000)));
}

describe('barcodes', () => {
  it('stores UPC-A and EAN-13 readings of one product under one key', () => {
    expect(normalizeBarcode('049000028904')).toBe('0049000028904');
    expect(normalizeBarcode('0049000028904')).toBe('0049000028904');
    expect(normalizeBarcode('3017620422003')).toBe('3017620422003');
    expect(normalizeBarcode('96385074')).toBe('96385074');
  });
  it('writes out the short UPC-E code on small packs in full', () => {
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(expandUpcE('01234565')).toBe('012345000065');
    expect(expandUpcE('01234531')).toBe('012300000451');
    expect(normalizeBarcode('04252614', 'upc_e')).toBe('0042100005264');
    expect(normalizeBarcode('0042100005264', 'upc_e')).toBe('0042100005264');
    expect(validCheckDigit('0042100005264')).toBe(true);
    expect(normalizeBarcode('96385074', 'ean_8')).toBe('96385074');
  });
  it('rejects anything that is not a retail barcode', () => {
    expect(normalizeBarcode('https://example.com')).toBeNull();
    expect(normalizeBarcode('12345')).toBeNull();
  });
});

describe('pantry items', () => {
  it('adds a scanned product and counts a second pack on the same row', async () => {
    const repo = fresh();
    const id = await repo.saveItem({ barcode: '3017620422003', name: ' Nutella ', brand: 'Ferrero', quantity: 1 });
    const again = await repo.findByBarcode('3017620422003');
    expect(again).toMatchObject({ id, name: 'Nutella', quantity: 1 });
    await repo.saveItem({ id, barcode: '3017620422003', name: 'Nutella', quantity: again!.quantity + 1, expiresOn: '2027-03-01' });
    expect(await repo.listItems()).toMatchObject([{ id, quantity: 2, expiresOn: '2027-03-01' }]);
  });

  it('uses items up, removes at zero, and undoes the removal', async () => {
    const repo = fresh();
    const id = await repo.saveItem({ name: 'Bananas', quantity: 2 });
    expect(await repo.adjust(id, -1)).toBe(1);
    expect(await repo.adjust(id, -1)).toBe(0);
    expect(await repo.listItems()).toEqual([]);
    await repo.restore(id);
    expect(await repo.listItems()).toMatchObject([{ name: 'Bananas', quantity: 1 }]);
    expect((await repo.listItems())[0]).not.toHaveProperty('deletedAt');
  });

  it('remembers a used-up product for the next scan', async () => {
    const repo = fresh();
    const id = await repo.saveItem({ barcode: '5000112637922', name: 'Typed by hand', quantity: 1 });
    await repo.remove(id);
    const remembered = await repo.findByBarcode('5000112637922');
    expect(remembered).toMatchObject({ name: 'Typed by hand' });
    expect(remembered!.deletedAt).toBeTruthy();
    await repo.saveItem({ barcode: '5000112637922', name: remembered!.name, quantity: 1 });
    expect(await repo.listItems()).toMatchObject([{ id, name: 'Typed by hand', quantity: 1 }]);
  });

  it('tells sync about local edits but not about merges', async () => {
    const repo = fresh();
    let calls = 0;
    repo.onLocalChange(() => calls++);
    await repo.saveItem({ name: 'Rice', quantity: 1 });
    expect(calls).toBe(1);
    await repo.mergeAll({ items: [{ id: 'x', updatedAt: '2030-01-01T00:00:00Z', name: 'Oats', quantity: 3 }] });
    expect(calls).toBe(1);
    expect((await repo.listItems()).map((i) => i.name).sort()).toEqual(['Oats', 'Rice']);
  });

  it('merges by row, newest edit winning', async () => {
    const repo = fresh();
    const id = await repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 1 });
    const mine = (await repo.listItems())[0]!;
    await repo.mergeAll({ items: [{ ...mine, quantity: 9, updatedAt: '2020-01-01T00:00:00Z' }] });
    expect((await repo.listItems())[0]!.quantity).toBe(1);
    await repo.mergeAll({ items: [{ ...mine, quantity: 4, updatedAt: '2030-01-01T00:00:00Z' }] });
    expect((await repo.listItems())[0]).toMatchObject({ id, quantity: 4 });
  });
});

describe('expiry', () => {
  const item = (name: string, expiresOn?: string): Item => ({ id: name, updatedAt: '', name, quantity: 1, expiresOn });

  it('counts whole calendar days', () => {
    expect(daysUntil('2026-11-20', '2026-11-17')).toBe(3);
    expect(daysUntil('2026-11-16', '2026-11-17')).toBe(-1);
    expect(daysUntil('2027-03-29', '2027-03-27')).toBe(2); // across a clock change
    expect(today(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('flags expired and soon-to-expire items', () => {
    expect(expiryState(undefined, '2026-11-17')).toBeUndefined();
    expect(expiryState('2026-11-16', '2026-11-17')).toBe('expired');
    expect(expiryState('2026-11-17', '2026-11-17')).toBe('soon');
    expect(expiryState('2026-11-24', '2026-11-17')).toBe('soon');
    expect(expiryState('2026-11-25', '2026-11-17')).toBe('ok');
  });
  it('words the date', () => {
    expect(expiryLabel('2026-11-14', '2026-11-17')).toBe('Expired 3 days ago');
    expect(expiryLabel('2026-11-16', '2026-11-17')).toBe('Expired yesterday');
    expect(expiryLabel('2026-11-17', '2026-11-17')).toBe('Expires today');
    expect(expiryLabel('2026-11-18', '2026-11-17')).toBe('Expires tomorrow');
    expect(expiryLabel('2026-11-22', '2026-11-17')).toBe('Expires in 5 days');
  });
  it('lists dated items soonest first, then the rest by name', () => {
    const sorted = sortItems([item('Rice'), item('Milk', '2026-11-19'), item('Beans'), item('Yogurt', '2026-11-18')]);
    expect(sorted.map((i) => i.name)).toEqual(['Yogurt', 'Milk', 'Beans', 'Rice']);
  });
  it('searches name, brand and barcode', () => {
    const i: Item = { ...item('Chopped Tomatoes'), brand: 'Mutti', barcode: '8005110070013' };
    expect(matches(i, ' tomat ')).toBe(true);
    expect(matches(i, 'mutti')).toBe(true);
    expect(matches(i, '80051')).toBe(true);
    expect(matches(i, 'beans')).toBe(false);
  });
});
