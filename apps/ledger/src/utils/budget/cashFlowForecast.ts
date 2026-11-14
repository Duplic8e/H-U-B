// Month-end cash-flow forecast: actual net so far this month, plus every
// projected occurrence of detected recurring items that lands later in the
// same month.

import type { Transaction } from '../../types/budget'
import type { RecurringItem } from './recurring'

export interface CashFlowForecast {
  netSoFar: number
  expectedIn: number
  expectedOut: number
  projectedNet: number
  pending: { description: string; amount: number; type: 'expense' | 'income'; expectedDate: string }[]
}

export function forecastMonthEnd(
  transactions: Record<string, Transaction>,
  recurring: RecurringItem[],
  month: string, // YYYY-MM
  today: string, // YYYY-MM-DD
  /** Hand-entered bills not yet paid this month (see unpaidBillsThisMonth). */
  plannedUnpaid: CashFlowForecast['pending'] = [],
): CashFlowForecast {
  let netSoFar = 0
  for (const t of Object.values(transactions)) {
    if (!t.date.startsWith(month) || t.date > today) continue
    if (t.type === 'income' && t.reimbursement) continue
    netSoFar += t.type === 'income' ? t.amount : -t.amount
  }

  const pending: CashFlowForecast['pending'] = []
  for (const item of recurring) {
    const cursor = new Date(`${item.nextExpected}T00:00:00`)
    for (let guard = 0; guard < 32; guard++) {
      const dateStr = cursor.toISOString().slice(0, 10)
      if (dateStr.slice(0, 7) > month) break
      if (dateStr.slice(0, 7) === month && dateStr > today) {
        pending.push({ description: item.description, amount: item.avgAmount, type: item.type, expectedDate: dateStr })
      }
      cursor.setDate(cursor.getDate() + item.intervalDays)
    }
  }

  pending.push(...plannedUnpaid)

  const expectedIn = pending.filter((p) => p.type === 'income').reduce((s, p) => s + p.amount, 0)
  const expectedOut = pending.filter((p) => p.type === 'expense').reduce((s, p) => s + p.amount, 0)
  return { netSoFar, expectedIn, expectedOut, projectedNet: netSoFar + expectedIn - expectedOut, pending }
}
