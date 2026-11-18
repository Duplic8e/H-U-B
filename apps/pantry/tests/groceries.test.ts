import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { PantryDB } from '../src/data/db';
import { GroceryLookups } from '../src/data/groceryLookups';
import type { LookupResult } from '../src/data/lookup';
import { createRepo } from '../src/data/repo';
import { repeatFilter } from '../src/ui/Scanner';

let n = 0;
const fresh = () => createRepo(new PantryDB(`pantry-groceries-${++n}`));
const NUT = { per: 'g' as const, kcal: 536 };

describe('scanning groceries', () => {
  it('counts a pack only after it has left the camera\'s view', () => {
    const fresh = repeatFilter(1000);
    expect(fresh('A', 0)).toBe(true);
    expect(fresh('A', 120)).toBe(false); // still in front of the camera
    expect(fresh('A', 900)).toBe(false);
    expect(fresh('B', 1000)).toBe(true);
    expect(fresh('A', 2500)).toBe(true); // gone for 1.6 s, then back: another pack
  });

  it('keeps one row per product, counting packs, and knows products the pantry has', async () => {
    const repo = fresh();
    await repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 1 });
    await repo.addScan('0757528051723');
    await repo.addScan('0757528051723');
    const known = await repo.addScan('3017620422003');
    expect(known).toMatchObject({ lookup: 'known', name: 'Nutella', count: 1 });
    expect((await repo.listScans()).map((s) => [s.barcode, s.count, s.lookup])).toEqual([['0757528051723', 2, undefined], ['3017620422003', 1, 'known']]);
  });

  it('looks scans up a few at a time, keeping a name the user typed', async () => {
    const repo = fresh();
    const asked: string[] = [];
    let open = 0, most = 0;
    const lookups = new GroceryLookups(repo, async (b): Promise<LookupResult> => {
      asked.push(b); open++; most = Math.max(most, open);
      await new Promise((r) => setTimeout(r, 10));
      open--;
      if (b === '1') return { status: 'not_found' };
      if (b === '2') return { status: 'incomplete' };
      return { status: 'found', source: 'x', product: { name: `Product ${b}`, brand: 'B', nutrition: NUT } };
    }, 2);
    for (const b of ['1', '2', '3', '4', '5']) await repo.addScan(b);
    await repo.updateScan('5', { name: 'My name', edited: true });
    lookups.update(await repo.listScans());
    await lookups.idle();
    expect(most).toBe(2);
    expect(asked.sort()).toEqual(['1', '2', '3', '4', '5']);
    const byCode = Object.fromEntries((await repo.listScans()).map((s) => [s.barcode, s]));
    expect(byCode['1']).toMatchObject({ lookup: 'not_found', name: '' });
    expect(byCode['2']).toMatchObject({ lookup: 'incomplete' });
    expect(byCode['3']).toMatchObject({ lookup: 'found', name: 'Product 3', nutrition: NUT });
    expect(byCode['5']).toMatchObject({ lookup: 'found', name: 'My name', nutrition: NUT });
    // Nothing is asked twice.
    lookups.update(await repo.listScans());
    await lookups.idle();
    expect(asked).toHaveLength(5);
  });

  it('fills in nutrition for a known product, once', async () => {
    const repo = fresh();
    await repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 1 });
    await repo.addScan('3017620422003');
    let asked = 0;
    const lookups = new GroceryLookups(repo, async () => { asked++; return { status: 'found', source: 'x', product: { name: 'Other', nutrition: NUT } }; });
    lookups.update(await repo.listScans());
    await lookups.idle();
    lookups.update(await repo.listScans());
    await lookups.idle();
    expect(asked).toBe(1);
    expect((await repo.listScans())[0]).toMatchObject({ lookup: 'known', name: 'Nutella', nutrition: NUT });
  });

  it('adds everything named to the pantry at once, and leaves what still needs a name', async () => {
    const repo = fresh();
    await repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 2, expiresOn: '2027-05-01' });
    for (const b of ['3017620422003', '3017620422003', '0757528051723', '0000000000017']) await repo.addScan(b);
    await repo.updateScan('3017620422003', { expiresOn: '2027-02-01' });
    await repo.updateScan('0757528051723', { lookup: 'found', name: 'Takis Fuego', nutrition: NUT, count: 3 });
    await repo.updateScan('0000000000017', { lookup: 'not_found' });
    let pushes = 0;
    repo.onLocalChange(() => pushes++);
    expect(await repo.addScansToPantry()).toEqual({ added: 5, left: 1 });
    expect(pushes).toBe(1);
    const items = Object.fromEntries((await repo.listItems()).map((i) => [i.name, i]));
    expect(items['Nutella']).toMatchObject({ quantity: 4, expiresOn: '2027-02-01' });
    expect(items['Takis Fuego']).toMatchObject({ quantity: 3, nutrition: NUT, barcode: '0757528051723' });
    expect((await repo.listScans()).map((s) => s.barcode)).toEqual(['0000000000017']);
  });

  it('brings a used-up product back with the scanned count', async () => {
    const repo = fresh();
    const id = await repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 1 });
    await repo.remove(id);
    await repo.addScan('3017620422003');
    await repo.updateScan('3017620422003', { name: 'Nutella', lookup: 'found' });
    await repo.addScansToPantry();
    expect(await repo.listItems()).toMatchObject([{ id, quantity: 1 }]);
  });
});
