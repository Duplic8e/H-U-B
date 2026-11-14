import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types/budget';
import { cashMovement, encodeEntryAmounts, entryKindOf, hasValidOffsetCategory, hasValidPendingCategory } from './transactionKinds';
import { splitParts } from './splits';

const receipt: Transaction = {
  id: 'receipt', date: '2026-10-12', description: 'Incoming payment',
  type: 'income', amount: 40, categoryId: 'salary',
};

describe('transaction entry kinds and cash direction', () => {
  it('identifies purchases with outgoing cash', () => {
    const purchase = { ...receipt, type: 'expense' as const };
    expect(entryKindOf(purchase)).toBe('expense');
    expect(cashMovement(purchase)).toBe(-40);
  });

  it('identifies ordinary income with incoming cash', () => {
    expect(entryKindOf(receipt)).toBe('income');
    expect(cashMovement(receipt)).toBe(40);
  });

  it('identifies legacy negative expenses as incoming refund payments', () => {
    expect(entryKindOf({ ...receipt, type: 'expense', amount: -40 })).toBe('refund-payment');
    expect(cashMovement({ ...receipt, type: 'expense', amount: -40 })).toBe(40);
  });

  it('keeps shared settlements classified as income', () => {
    const settlement = { ...receipt, reimbursement: { from: 'Alex' } };
    expect(entryKindOf(settlement)).toBe('income');
    expect(cashMovement(settlement)).toBe(40);
  });
});

describe('encodeEntryAmounts', () => {
  it('stores refund payments and their slices as negative expenses', () => {
    const slices = [{ categoryId: 'groceries', amount: 25 }, { categoryId: 'dining', amount: 15 }];
    expect(encodeEntryAmounts('refund-payment', 40, slices)).toEqual({
      type: 'expense', amount: -40,
      splits: [{ categoryId: 'groceries', amount: -25 }, { categoryId: 'dining', amount: -15 }],
    });
    expect(slices[0].amount).toBe(25);
  });

  it.each(['expense', 'income'] as const)('keeps %s parent and slices positive', (kind) => {
    expect(encodeEntryAmounts(kind, 40, [{ categoryId: 'category', amount: 20 }])).toEqual({
      type: kind, amount: 40, splits: [{ categoryId: 'category', amount: 20 }],
    });
  });

  it('omits empty splits and rounds amounts to cents', () => {
    expect(encodeEntryAmounts('refund-payment', 40.004)).toEqual({ type: 'expense', amount: -40, splits: undefined });
  });

  it('leaves the signed cent remainder on the parent category', () => {
    const encoded = encodeEntryAmounts('refund-payment', 100, [
      { categoryId: 'groceries', amount: 33.334 }, { categoryId: 'dining', amount: 33.334 },
    ]);
    expect(splitParts({ ...receipt, ...encoded, categoryId: 'household' })).toEqual([
      { categoryId: 'groceries', amount: -33.33 }, { categoryId: 'dining', amount: -33.33 },
      { categoryId: 'household', amount: -33.34 },
    ]);
  });
});


it('requires an existing expense category only for offsets', () => {
  const categories = { g: { id: 'g', groupId: 'food', name: 'Groceries', targetAmount: 0 }, s: { id: 's', groupId: 'earn', name: 'Salary', targetAmount: 0 } };
  const groups = { food: { id: 'food', name: 'Food', kind: 'expense' as const }, earn: { id: 'earn', name: 'Income', kind: 'income' as const } };
  const offset = { type: 'expense' as const, amount: -40 };
  expect(hasValidOffsetCategory(offset, categories, groups)).toBe(false);
  expect(hasValidOffsetCategory({ ...offset, categoryId: 'missing' }, categories, groups)).toBe(false);
  expect(hasValidOffsetCategory({ ...offset, categoryId: 's' }, categories, groups)).toBe(false);
  expect(hasValidOffsetCategory({ ...offset, categoryId: 'g' }, categories, groups)).toBe(true);
  expect(hasValidOffsetCategory({ ...offset, categoryId: 'g' }, categories, {})).toBe(false);
  expect(hasValidOffsetCategory({ type: 'income', amount: 40 }, categories, groups)).toBe(true);
  expect(hasValidOffsetCategory({ type: 'expense', amount: 40 }, categories, groups)).toBe(true);
});


it('requires review of populated incompatible ordinary categories but permits uncategorized rows', () => {
  const categories = { g: { id: 'g', groupId: 'food', name: 'Groceries', targetAmount: 0 }, s: { id: 's', groupId: 'earn', name: 'Salary', targetAmount: 0 } };
  const groups = { food: { id: 'food', name: 'Food', kind: 'expense' as const }, earn: { id: 'earn', name: 'Income', kind: 'income' as const } };
  for (const type of ['income', 'expense'] as const) {
    expect(hasValidPendingCategory({ type, amount: 40 }, categories, groups)).toBe(true);
    expect(hasValidPendingCategory({ type, amount: 40, categoryId: '' }, categories, groups)).toBe(true);
    expect(hasValidPendingCategory({ type, amount: 40, categoryId: 'deleted' }, categories, groups)).toBe(false);
    expect(hasValidPendingCategory({ type, amount: 40, categoryId: type === 'income' ? 'g' : 's' }, categories, groups)).toBe(false);
    expect(hasValidPendingCategory({ type, amount: 40, categoryId: type === 'income' ? 's' : 'g' }, categories, groups)).toBe(true);
  }
  expect(hasValidPendingCategory({ type: 'expense', amount: -40 }, categories, groups)).toBe(false);
});
