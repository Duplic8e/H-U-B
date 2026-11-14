import type { Transaction } from '../../types/budget'
import type { RecurringItem } from './recurring'
import { forecastMonthEnd } from './cashFlowForecast'

let id = 0
const tx = (date: string, amount: number, type: 'expense' | 'income'): Transaction =>
  ({ id: `t${id++}`, date, amount, description: 'x', type })
const reimbursementTx = (date: string, amount: number): Transaction =>
  ({ id: `t${id++}`, date, amount, description: 'x', type: 'income', reimbursement: { from: 'Roommate' } })
const asRecord = (list: Transaction[]) => Object.fromEntries(list.map((t) => [t.id, t]))

const recurringItem = (over: Partial<RecurringItem>): RecurringItem => ({
  key: 'k', description: 'ITEM', type: 'expense', avgAmount: 100, intervalDays: 30,
  occurrences: 3, lastDate: '2026-06-20', nextExpected: '2026-07-20', monthlyEstimate: 100,
  ...over,
})

describe('forecastMonthEnd', () => {
  it('keeps forecast net unchanged by ordinary receipt conversion and honors receipt month', () => {
    const rows = asRecord([tx('2026-10-01', 2000, 'income'), tx('2026-10-02', 120, 'expense')])
    const receipt = tx('2026-10-03', 40, 'income')
    const before = { ...rows, [receipt.id]: receipt }
    const after = { ...rows, [receipt.id]: { ...receipt, type: 'expense' as const, amount: -40 } }
    expect(forecastMonthEnd(before, [], '2026-10', '2026-10-04').projectedNet).toBe(1920)
    expect(forecastMonthEnd(after, [], '2026-10', '2026-10-04').projectedNet).toBe(1920)
    expect(forecastMonthEnd(after, [], '2026-09', '2026-09-30').projectedNet).toBe(0)
  })
  const txs = asRecord([
    tx('2026-07-01', 4000, 'income'),
    tx('2026-07-05', 1500, 'expense'),
    tx('2026-06-30', 999, 'expense'), // other month - ignored
  ])

  it('nets recorded flows and adds pending recurring items in-month', () => {
    const f = forecastMonthEnd(
      txs,
      [
        recurringItem({ description: 'RENT', avgAmount: 1000, nextExpected: '2026-07-28' }),
        recurringItem({ description: 'PAYROLL', type: 'income', avgAmount: 2500, nextExpected: '2026-07-15' }),
        recurringItem({ description: 'ALREADY HAPPENED', nextExpected: '2026-07-03' }), // before today
        recurringItem({ description: 'NEXT MONTH', nextExpected: '2026-08-02' }),
      ],
      '2026-07',
      '2026-07-10',
    )
    expect(f.netSoFar).toBe(2500)
    expect(f.expectedIn).toBe(2500)
    expect(f.expectedOut).toBe(1000)
    expect(f.projectedNet).toBe(4000)
    expect(f.pending.map((p) => p.description).sort()).toEqual(['PAYROLL', 'RENT'])
  })

  it('excludes reimbursement income from netSoFar and projectedNet', () => {
    const withoutReimbursement = forecastMonthEnd(txs, [], '2026-07', '2026-07-10')

    const txsWithReimbursement = asRecord([
      ...Object.values(txs),
      reimbursementTx('2026-07-06', 300),
    ])
    const withReimbursement = forecastMonthEnd(txsWithReimbursement, [], '2026-07', '2026-07-10')

    expect(withReimbursement.netSoFar).toBe(withoutReimbursement.netSoFar)
    expect(withReimbursement.projectedNet).toBe(withoutReimbursement.projectedNet)
  })

  it('projects multiple occurrences of short-interval items within the month', () => {
    const f = forecastMonthEnd(txs, [
      recurringItem({ description: 'WEEKLY', avgAmount: 50, intervalDays: 7, nextExpected: '2026-07-12' }),
    ], '2026-07', '2026-07-10')
    // 12, 19, 26 July → 3 × 50
    expect(f.expectedOut).toBe(150)
    expect(f.pending).toHaveLength(3)
  })
})
