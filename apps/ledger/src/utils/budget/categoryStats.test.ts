import type { Category, Transaction } from '../../types/budget'
import { categoryExpenseBreakdown, categoryMonthlySeries, categoryMonthlyTotal, detectAnomalies } from './categoryStats'

let id = 0
const tx = (date: string, amount: number, categoryId: string): Transaction =>
  ({ id: `t${id++}`, date, amount, categoryId, description: 'x', type: 'expense' })
const asRecord = (list: Transaction[]) => Object.fromEntries(list.map((t) => [t.id, t]))

describe('categoryExpenseBreakdown', () => {
  it.each([[120, 40, 80], [60, 100, -40], [0, 40, -40]])(
    'separates purchases %s and payments %s with net %s', (purchase, offset, net) => {
      const rows = asRecord([tx('2026-10-01', purchase, 'food'), tx('2026-10-02', -offset, 'food')])
      expect(categoryExpenseBreakdown(rows, 'food', '2026-10')).toEqual({ purchases: purchase, offsets: offset, net })
    },
  )
  it('attributes split payments and remainder in their real month, excluding income', () => {
    const payment = { ...tx('2026-10-02', -100, 'food'), splits: [{ categoryId: 'house', amount: -30 }] }
    const rows = asRecord([tx('2026-09-01', 120, 'food'), payment, { ...tx('2026-10-03', 2000, 'food'), type: 'income' }])
    expect(categoryExpenseBreakdown(rows, 'food', '2026-09')).toEqual({ purchases: 120, offsets: 0, net: 120 })
    expect(categoryExpenseBreakdown(rows, 'food', '2026-10')).toEqual({ purchases: 0, offsets: 70, net: -70 })
    expect(categoryExpenseBreakdown(rows, 'house', '2026-10')).toEqual({ purchases: 0, offsets: 30, net: -30 })
  })
  it('rounds purchase, payment and net totals to cents', () => {
    const rows = asRecord([tx('2026-10-01', 0.1, 'food'), tx('2026-10-02', 0.2, 'food'), tx('2026-10-03', -0.1, 'food')])
    expect(categoryExpenseBreakdown(rows, 'food', '2026-10')).toEqual({ purchases: 0.3, offsets: 0.1, net: 0.2 })
  })
})

const categories: Record<string, Category> = {
  dining: { id: 'dining', groupId: 'g', name: 'Dining', targetAmount: 200 },
  rent: { id: 'rent', groupId: 'g', name: 'Rent', targetAmount: 1000 },
}

const txs = asRecord([
  tx('2026-04-10', 100, 'dining'), tx('2026-05-12', 120, 'dining'), tx('2026-06-15', 110, 'dining'),
  tx('2026-07-01', 400, 'dining'), // July blowout: avg(100,120,110)=110 → ratio 3.6
  tx('2026-04-01', 1000, 'rent'), tx('2026-05-01', 1000, 'rent'),
  tx('2026-06-01', 1000, 'rent'), tx('2026-07-01', 1000, 'rent'), // steady
])

describe('categoryMonthlyTotal / series', () => {
  it('sums a category month', () => {
    expect(categoryMonthlyTotal(txs, 'dining', '2026-05')).toBe(120)
    expect(categoryMonthlyTotal(txs, 'dining', '2026-01')).toBe(0)
  })

  it('builds an oldest-to-newest series ending at the reference month', () => {
    const s = categoryMonthlySeries(txs, 'dining', 4, new Date('2026-07-15T12:00:00'))
    expect(s.map((p) => p.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07'])
    expect(s.map((p) => p.total)).toEqual([100, 120, 110, 400])
  })
})

describe('detectAnomalies', () => {
  it('flags the blowout month and not the steady category', () => {
    const anomalies = detectAnomalies(txs, categories, '2026-07', new Date('2026-07-15T12:00:00'))
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({ categoryId: 'dining', monthSpend: 400, rollingAvg: 110 })
    expect(anomalies[0].ratio).toBeCloseTo(400 / 110, 6)
  })

  it('ignores small-dollar spikes (under the $50 floor)', () => {
    const small = asRecord([
      tx('2026-04-10', 10, 'dining'), tx('2026-05-12', 10, 'dining'),
      tx('2026-06-15', 10, 'dining'), tx('2026-07-01', 40, 'dining'),
    ])
    expect(detectAnomalies(small, categories, '2026-07', new Date('2026-07-15T12:00:00'))).toHaveLength(0)
  })
})

describe('categoryMonthlyTotal with splits', () => {
  it('counts only the slice belonging to the category', () => {
    const transactions = {
      t1: {
        id: 't1',
        date: '2026-08-04',
        amount: 180,
        description: 'Costco',
        type: 'expense' as const,
        categoryId: 'groceries',
        splits: [
          { categoryId: 'groceries', amount: 120 },
          { categoryId: 'household', amount: 60 },
        ],
      },
    }
    expect(categoryMonthlyTotal(transactions, 'groceries', '2026-08')).toBe(120)
    expect(categoryMonthlyTotal(transactions, 'household', '2026-08')).toBe(60)
  })
})
