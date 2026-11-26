import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { PantryDB } from '../src/data/db';
import { MEAT, suggestedExpiry, withUnit } from '../src/data/meat';
import { createRepo } from '../src/data/repo';

let n = 0;
const fresh = () => createRepo(new PantryDB(`pantry-meat-${++n}`));
const kind = (key: string) => MEAT.find((m) => m.key === key)!;

describe('fresh meat', () => {
  it('suggests a use-by date for the fridge or the freezer', () => {
    expect(suggestedExpiry(kind('chicken-breast'), 'fridge', '2026-11-26')).toBe('2026-11-28');
    expect(suggestedExpiry(kind('beef-ground'), 'fridge', '2026-11-30')).toBe('2026-12-01');
    expect(suggestedExpiry(kind('beef-ground'), 'freezer', '2026-11-26')).toBe('2027-02-26');
    expect(suggestedExpiry(kind('chicken-whole'), 'freezer', '2026-11-26')).toBe('2027-11-26');
  });
  it('words counts with their unit', () => {
    expect(withUnit(1, 'pieces')).toBe('1 piece');
    expect(withUnit(4, 'pieces')).toBe('4 pieces');
    expect(withUnit(2, 'lb')).toBe('2 lb');
    expect(withUnit(3)).toBe('3');
  });
  it('keeps one row per cut and place, adding to it, the earliest date winning', async () => {
    const repo = fresh();
    expect(await repo.addMeat({ key: 'chicken-thigh', name: 'Chicken thighs', quantity: 4, unit: 'pieces', storage: 'fridge', expiresOn: '2026-11-28' })).toBe(4);
    expect(await repo.addMeat({ key: 'chicken-thigh', name: 'Chicken thighs', quantity: 2, unit: 'pieces', storage: 'fridge', expiresOn: '2026-11-27' })).toBe(6);
    expect(await repo.addMeat({ key: 'chicken-thigh', name: 'Chicken thighs', quantity: 8, unit: 'pieces', storage: 'freezer', expiresOn: '2027-08-26' })).toBe(8);
    const items = Object.fromEntries((await repo.listItems()).map((i) => [i.id, i]));
    expect(items['m:chicken-thigh:fridge']).toMatchObject({ name: 'Chicken thighs', quantity: 6, unit: 'pieces', storage: 'fridge', expiresOn: '2026-11-27' });
    expect(items['m:chicken-thigh:freezer']).toMatchObject({ name: 'Chicken thighs (frozen)', quantity: 8 });
    // A different unit replaces the count rather than adding pieces to pounds.
    expect(await repo.addMeat({ key: 'chicken-thigh', name: 'Chicken thighs', quantity: 2, unit: 'lb', storage: 'fridge' })).toBe(2);
    // Used up and bought again: starts afresh.
    await repo.remove('m:chicken-thigh:fridge');
    expect(await repo.addMeat({ key: 'chicken-thigh', name: 'Chicken thighs', quantity: 3, unit: 'pieces', storage: 'fridge' })).toBe(3);
  });
  it('keeps the unit when the item is edited', async () => {
    const repo = fresh();
    await repo.addMeat({ key: 'beef-ground', name: 'Ground beef', quantity: 2, unit: 'packs', storage: 'freezer' });
    await repo.saveItem({ id: 'm:beef-ground:freezer', name: 'Ground beef (frozen)', quantity: 1, unit: 'packs', storage: 'freezer' });
    expect((await repo.listItems())[0]).toMatchObject({ quantity: 1, unit: 'packs', storage: 'freezer' });
  });
  it("remembers the kitchen's appliances and backs them up", async () => {
    const repo = fresh();
    expect((await repo.getPrefs()).appliances).toEqual([]);
    await repo.setAppliances([' Air fryer', 'Microwave', 'Air fryer', '']);
    expect((await repo.getPrefs()).appliances).toEqual(['Air fryer', 'Microwave']);
    expect((await repo.dumpAll()).prefs).toMatchObject([{ id: 'prefs', appliances: ['Air fryer', 'Microwave'] }]);
    const other = fresh();
    await other.mergeAll(await repo.dumpAll());
    expect((await other.getPrefs()).appliances).toEqual(['Air fryer', 'Microwave']);
  });
});
