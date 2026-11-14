import { describe, expect, it } from 'vitest'
import { buildCashPlan, inPeriod, unpaidBillsThisMonth, type PlannedBill } from './cashPlan'
import type { Transaction } from '../../types/budget'

const rent: PlannedBill = { id: 'r', name: 'Rent', amount: 2000, cadence: 'monthly', dueDay: 1, categoryId: 'housing' }
const phone: PlannedBill = { id: 'p', name: 'Virgin Plus', amount: 60, cadence: 'monthly', dueDay: 15 }
const gym: PlannedBill = { id: 'g', name: 'Gym', amount: 20, cadence: 'biweekly' }

describe('buildCashPlan', () => {
  const plan = buildCashPlan({
    grossSalary: 120000, netSalary: 86000, esppPercent: 10,
    bills: [rent, phone, gym],
    monthlyTargets: { housing: 2200, food: 600 },
  })

  it('takes tax and then ESPP off salary', () => {
    expect(plan.taxes).toBe(34000)
    expect(plan.espp).toBe(12000) // 10% of gross
    expect(plan.takeHome).toBe(74000)
  })

  it('adds up bills at their own cadence', () => {
    expect(plan.bills).toBe(2000 * 12 + 60 * 12 + 20 * 26)
  })

  it('does not count a bill twice against its category target', () => {
    // housing: 2200 target holds the 2000 rent, so 200 more; food: 600.
    expect(plan.otherBudget).toBe((200 + 600) * 12)
    expect(plan.leftover).toBe(plan.takeHome - plan.bills - plan.otherBudget)
  })

  it('scales to any period', () => {
    expect(inPeriod(plan.takeHome, 'monthly')).toBeCloseTo(6166.67, 2)
    expect(inPeriod(plan.takeHome, 'biweekly')).toBeCloseTo(2846.15, 2)
    expect(inPeriod(plan.takeHome, 'weekly')).toBeCloseTo(1423.08, 2)
  })

  it('handles no salary and no ESPP', () => {
    const empty = buildCashPlan({ grossSalary: 0, netSalary: 0, esppPercent: 10, bills: [rent], monthlyTargets: {} })
    expect(empty.espp).toBe(0)
    expect(empty.leftover).toBe(-24000)
  })
})

describe('unpaidBillsThisMonth', () => {
  const tx = (id: string, description: string, amount: number, extra: Partial<Transaction> = {}): Transaction =>
    ({ id, date: '2026-11-05', description, amount, type: 'expense', ...extra })

  it('lists monthly bills with no matching payment yet, on their due day', () => {
    expect(unpaidBillsThisMonth([rent, phone, gym], {}, '2026-11')).toEqual([
      { description: 'Rent', amount: 2000, type: 'expense', expectedDate: '2026-11-01' },
      { description: 'Virgin Plus', amount: 60, type: 'expense', expectedDate: '2026-11-15' },
    ])
  })

  it('treats a bill as paid by name or by category and amount', () => {
    const transactions = {
      a: tx('a', 'VIRGIN PLUS MONTREAL QC', 63.2),
      b: tx('b', 'E-TRANSFER 1 LANDLORD', 2000, { categoryId: 'housing' }),
    }
    expect(unpaidBillsThisMonth([rent, phone], transactions, '2026-11')).toEqual([])
  })

  it('skips a bill the forecast already expects from detected payments', () => {
    expect(unpaidBillsThisMonth([phone], {}, '2026-11', ['VIRGIN PLUS MONTREAL QC'])).toEqual([])
  })

  it('clamps a due day past the end of the month', () => {
    expect(unpaidBillsThisMonth([{ ...rent, dueDay: 31 }], {}, '2026-02')[0].expectedDate).toBe('2026-02-28')
  })
})
