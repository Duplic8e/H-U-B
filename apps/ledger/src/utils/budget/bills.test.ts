import { describe, expect, it } from 'vitest'
import type { Category, Transaction } from '../../types/budget'
import { billCategoryIds, billSettingOf, detectBillCategories } from './bills'
import { billPace, expectedByNow, paceOf } from './pace'

const cat = (id: string, extra: Partial<Category> = {}): Category => ({ id, groupId: 'g', name: id, targetAmount: 100, ...extra })
const tx = (id: string, date: string, amount: number, description: string, categoryId: string): Transaction =>
  ({ id, date, amount, description, type: 'expense', categoryId })
const monthly = (prefix: string, categoryId: string, amount = 1100, description = 'Landlord Rent') =>
  ['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((d, i) => tx(`${prefix}${i}`, d, amount, description, categoryId))
const byId = (list: Transaction[]) => Object.fromEntries(list.map((t) => [t.id, t]))

describe('detectBillCategories', () => {
  it('finds a category that is only a monthly recurring payment', () => {
    const found = detectBillCategories(byId(monthly('r', 'rent')), { rent: cat('rent') })
    expect([...found]).toEqual(['rent'])
  })

  it('leaves a category with too few repeats alone', () => {
    const found = detectBillCategories(byId(monthly('r', 'rent').slice(0, 2)), { rent: cat('rent') })
    expect(found.size).toBe(0)
  })

  it('does not call a weekly or biweekly payment a bill', () => {
    const dates = ['2026-08-01', '2026-08-15', '2026-08-29', '2026-09-12']
    const list = dates.map((d, i) => tx(`b${i}`, d, 500, 'Rent half', 'rent'))
    expect(detectBillCategories(byId(list), { rent: cat('rent') }).size).toBe(0)
  })

  it('keeps a category that mixes a fixed charge with everyday spending as everyday', () => {
    const list = [
      ...monthly('m', 'food', 40, 'Meal Kit'),
      ...['2026-06-04', '2026-06-18', '2026-07-05', '2026-07-19', '2026-08-03', '2026-08-23'].map((d, i) => tx(`g${i}`, d, 120 + i * 7, `Market ${i} stall`, 'food')),
    ]
    expect(detectBillCategories(byId(list), { food: cat('food') }).size).toBe(0)
  })

  it('counts only the share of a split that lands in the category', () => {
    const list = monthly('r', 'rent').map((t) => ({ ...t, categoryId: undefined, splits: [{ categoryId: 'rent', amount: 1000 }, { categoryId: 'fees', amount: 100 }] }))
    const found = detectBillCategories(byId(list as Transaction[]), { rent: cat('rent'), fees: cat('fees') })
    expect([...found].sort()).toEqual(['fees', 'rent'])
  })

  it('never auto-detects an annual category', () => {
    expect(detectBillCategories(byId(monthly('r', 'ins')), { ins: cat('ins', { cadence: 'annual' }) }).size).toBe(0)
  })

  it('ignores income and an unknown category', () => {
    const list = monthly('r', 'gone').map((t) => ({ ...t, type: 'income' as const }))
    expect(detectBillCategories(byId(list), {}).size).toBe(0)
  })
})

describe('billCategoryIds', () => {
  const txs = byId(monthly('r', 'rent'))

  it('treats a detected category on Auto as a bill', () => {
    expect(billCategoryIds(txs, { rent: cat('rent') }).has('rent')).toBe(true)
  })

  it('lets Everyday override detection and Bill override a lack of it', () => {
    expect(billCategoryIds(txs, { rent: cat('rent', { billing: 'everyday' }) }).has('rent')).toBe(false)
    expect(billCategoryIds({}, { ins: cat('ins', { billing: 'bill' }) }).has('ins')).toBe(true)
  })

  it('reads an absent setting as auto', () => {
    expect(billSettingOf(cat('x'))).toBe('auto')
  })
})

describe('pace', () => {
  it('judges a bill by whether it is paid, not by the day', () => {
    expect(billPace(0, 1100)).toBe('due')
    expect(billPace(600, 1100)).toBe('due')
    expect(billPace(1021, 1100)).toBe('paid')
    expect(billPace(1100.5, 1100)).toBe('paid')
    expect(billPace(1300, 1100)).toBe('overBudget')
  })

  it('still reads everyday spending against the calendar', () => {
    expect(paceOf(1021, 600)).toBe('over')
    expect(paceOf(540, 600)).toBe('on')
    expect(paceOf(100, 600)).toBe('under')
  })

  it('counts a bill in full and the rest by the day when working out what is expected', () => {
    const rows = [{ target: 1000, bill: true }, { target: 600, bill: false }]
    expect(expectedByNow(rows, 0.5)).toBe(1300)
    expect(expectedByNow(rows, 1)).toBe(1600)
  })
})
