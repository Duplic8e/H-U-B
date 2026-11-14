import { splitParts, amountForCategory, splitRemainder, round2 } from './splits'
import type { Transaction } from '../../types/budget'

const base: Transaction = {
  id: 't1',
  date: '2026-08-04',
  amount: 180,
  description: 'Costco',
  type: 'expense',
  categoryId: 'groceries',
}

describe('splitParts', () => {
  it('gives an unsplit transaction one part for its whole amount', () => {
    expect(splitParts(base)).toEqual([{ categoryId: 'groceries', amount: 180 }])
  })

  it('treats an empty splits array as unsplit', () => {
    expect(splitParts({ ...base, splits: [] })).toEqual([{ categoryId: 'groceries', amount: 180 }])
  })

  it('returns the split parts when they cover the full amount', () => {
    const tx = { ...base, splits: [
      { categoryId: 'groceries', amount: 120 },
      { categoryId: 'household', amount: 60 },
    ] }
    expect(splitParts(tx)).toEqual([
      { categoryId: 'groceries', amount: 120 },
      { categoryId: 'household', amount: 60 },
    ])
  })

  it('keeps an uncovered remainder on the transaction category so totals never shrink', () => {
    const tx = { ...base, splits: [{ categoryId: 'household', amount: 50 }] }
    expect(splitParts(tx)).toEqual([
      { categoryId: 'household', amount: 50 },
      { categoryId: 'groceries', amount: 130 },
    ])
  })

  it('takes an over-covering remainder back off the transaction category', () => {
    const tx = { ...base, splits: [{ categoryId: 'household', amount: 200 }] }
    expect(splitParts(tx)).toEqual([
      { categoryId: 'household', amount: 200 },
      { categoryId: 'groceries', amount: -20 },
    ])
  })

  it('carries an undefined categoryId through as uncategorized', () => {
    const tx = { ...base, categoryId: undefined, splits: [{ amount: 180 }] }
    expect(splitParts(tx)).toEqual([{ categoryId: undefined, amount: 180 }])
  })
})

describe('amountForCategory', () => {
  it('sums every part matching the category', () => {
    const tx = { ...base, splits: [
      { categoryId: 'household', amount: 40 },
      { categoryId: 'household', amount: 20 },
      { categoryId: 'groceries', amount: 120 },
    ] }
    expect(amountForCategory(tx, 'household')).toBe(60)
  })

  it('is zero for a category the transaction does not touch', () => {
    expect(amountForCategory(base, 'rent')).toBe(0)
  })
})

describe('splitRemainder', () => {
  it('keeps negative slices and an uncovered cent remainder signed', () => {
    const tx = { ...base, amount: -100, splits: [
      { categoryId: 'household', amount: -33.33 },
      { categoryId: 'dining', amount: -33.33 },
    ] }
    expect(splitParts(tx)).toEqual([
      { categoryId: 'household', amount: -33.33 },
      { categoryId: 'dining', amount: -33.33 },
      { categoryId: 'groceries', amount: -33.34 },
    ])
    expect(amountForCategory(tx, 'household')).toBe(-33.33)
    expect(splitRemainder(tx.amount, tx.splits)).toBe(-33.34)
  })

  it('returns fully allocated negative slices without a remainder', () => {
    expect(splitParts({ ...base, amount: -40, splits: [
      { categoryId: 'household', amount: -25 }, { categoryId: 'dining', amount: -15 },
    ] })).toEqual([
      { categoryId: 'household', amount: -25 }, { categoryId: 'dining', amount: -15 },
    ])
  })

  it('reports what is left to allocate, rounded to cents', () => {
    expect(splitRemainder(100, [{ amount: 33.33 }, { amount: 33.33 }])).toBe(33.34)
  })
})

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

describe('the parts always sum to the transaction amount', () => {
  const tx = (amount: number, splits: { categoryId: string; amount: number }[]) =>
    ({ id: 't', date: '2026-08-01', amount, type: 'expense', description: 'x', categoryId: 'c-main', splits }) as unknown as Transaction

  it('when the slices under-cover, the shortfall lands on the parent category', () => {
    const parts = splitParts(tx(100, [{ categoryId: 'c-a', amount: 60 }]))
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(100)
    expect(parts).toContainEqual({ categoryId: 'c-main', amount: 40 })
  })

  it('when the slices cover exactly, there is no extra part', () => {
    const parts = splitParts(tx(100, [{ categoryId: 'c-a', amount: 60 }, { categoryId: 'c-b', amount: 40 }]))
    expect(parts).toHaveLength(2)
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(100)
  })

  it('when the slices over-cover, the excess is taken back off the parent category', () => {
    // This is the case that silently inflated every budget total: the parts
    // used to sum to 150 for a 100 transaction.
    const parts = splitParts(tx(100, [{ categoryId: 'c-a', amount: 80 }, { categoryId: 'c-b', amount: 70 }]))
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(100)
    expect(parts).toContainEqual({ categoryId: 'c-main', amount: -50 })
  })
})
