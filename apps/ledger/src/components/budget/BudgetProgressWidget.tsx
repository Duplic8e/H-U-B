import React from 'react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { formatMoney } from '../planner/format'
import { totalMonthlyBudget } from '../../store/budgetSelectors'
import { inRange, isSingleMonth, monthKeyOf, monthsInRange, type MonthRange } from '../../utils/budget/period'
import { annualTarget, elapsedMonthsInYear, isAnnual, setAsideExpected } from '../../utils/budget/cadence'
import { splitParts } from '../../utils/budget/splits'
import { billPace, isOverRow, PACE_LABELS, paceOf, type RowPace } from '../../utils/budget/pace'
import { useBillIds } from '../../hooks/useBillIds'

const paceLabel = (p: RowPace) => PACE_LABELS[p]

// Pace: expected-by-today = target × (day / days-in-month); >110% = over.
// Pace prorating only applies when the range is exactly the current single month.
// Annual categories are tracked separately against calendar-year spend.
export const BudgetProgressWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const categoryGroups = useBudgetStore((s) => s.categoryGroups)
  const bills = useBillIds()

  const months = monthsInRange(range)
  const currentMonthKey = monthKeyOf(new Date())
  const isCurrentSingleMonth = isSingleMonth(range) && range.to === currentMonthKey
  const [y, m] = range.to.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const monthFraction = isCurrentSingleMonth ? new Date().getDate() / daysInMonth : 1

  const txInRange = Object.values(transactions).filter(
    (t) => t.type === 'expense' && inRange(t.date, range),
  )
  const spentByCategory = new Map<string, number>()
  for (const t of txInRange) {
    for (const part of splitParts(t)) {
      const key = part.categoryId ?? ''
      spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + part.amount)
    }
  }

  const withTarget = Object.values(categories).filter((c) => c.targetAmount > 0)

  const rows = withTarget
    .filter((c) => !isAnnual(c))
    .map((c) => {
      const spent = spentByCategory.get(c.id) ?? 0
      const target = c.targetAmount * months
      const expected = target * monthFraction
      // A bill is judged on whether it has been paid, not on how far through the month we are.
      const pace = bills.has(c.id) && isCurrentSingleMonth ? billPace(spent, target) : paceOf(spent, expected)
      return { c, spent, target, pace }
    })

  // Annual rows: calendar-year spend for the year containing range.to,
  // counted through the viewed month.
  // Pace is anchored to the viewed month, not the wall clock, so the spend
  // window and the expected contribution always share one reference point.
  const year = y
  const elapsed = elapsedMonthsInYear(year, new Date(y, m - 1, 1))
  const yearRange: MonthRange = { from: `${year}-01`, to: range.to }
  const yearSpentByCategory = new Map<string, number>()
  for (const t of Object.values(transactions)) {
    if (t.type === 'expense' && inRange(t.date, yearRange)) {
      for (const part of splitParts(t)) {
        const key = part.categoryId ?? ''
        yearSpentByCategory.set(key, (yearSpentByCategory.get(key) ?? 0) + part.amount)
      }
    }
  }
  const annualRows = withTarget
    .filter(isAnnual)
    .map((c) => {
      const annual = annualTarget(c)
      const spent = yearSpentByCategory.get(c.id) ?? 0
      const expected = setAsideExpected(annual, elapsed)
      return { c, spent, annual, expected, pace: bills.has(c.id) ? billPace(spent, annual) : paceOf(spent, expected) }
    })

  const budgeted = totalMonthlyBudget(categories, categoryGroups) * months
  const totalSpent = txInRange.reduce((s, t) => s + t.amount, 0)
  const unbudgeted = txInRange
    .flatMap((t) => splitParts(t))
    .filter((p) => !p.categoryId || (categories[p.categoryId]?.targetAmount ?? 0) === 0)
    .reduce((s, p) => s + p.amount, 0)

  const hasAnything = rows.length > 0 || annualRows.length > 0

  return (
    <WidgetWrapper title="Budget vs. Actual">
      {!hasAnything ? (
        <p className="text-[13px] text-text-secondary mt-2">Set target amounts on categories to track progress.</p>
      ) : (
        <div className="flex flex-col gap-3 mt-2">
          {budgeted > 0 && (
            <div className="flex flex-col gap-1 text-[13px] pb-3 border-b border-border">
              <div className="flex justify-between font-semibold">
                <span className="text-text-primary">Total</span>
                <span className={totalSpent > budgeted ? 'text-error' : 'text-text-primary'}>
                  {formatMoney(totalSpent)} / {formatMoney(budgeted)}
                </span>
              </div>
              <div className="h-2 rounded bg-bg-primary/50 overflow-hidden">
                <div
                  className={`h-full ${totalSpent > budgeted ? 'bg-error' : 'bg-accent'}`}
                  style={{ width: `${Math.max(0, Math.min(100, (totalSpent / budgeted) * 100))}%` }}
                />
              </div>
            </div>
          )}
          {rows.map(({ c, spent, target, pace }) => (
            <div key={c.id} className="flex flex-col gap-1 text-[13px]">
              <div className="flex justify-between">
                <span className="text-text-primary">{c.name}</span>
                <span className={isOverRow(pace) ? 'text-error' : 'text-text-secondary'}>
                  {formatMoney(spent)} / {formatMoney(target)}
                  {isCurrentSingleMonth ? ` · ${paceLabel(pace)}` : ''}
                </span>
              </div>
              <div className="h-2 rounded bg-bg-primary/50 overflow-hidden">
                <div
                  className={`h-full ${isOverRow(pace) ? 'bg-error' : 'bg-accent'}`}
                  style={{ width: `${Math.max(0, Math.min(100, (spent / target) * 100))}%` }}
                />
              </div>
            </div>
          ))}

          {annualRows.length > 0 && (
            <div className="flex flex-col gap-3 pt-3 border-t border-border">
              <p className="text-[12px] uppercase tracking-wide text-text-secondary">Annual budgets</p>
              {annualRows.map(({ c, spent, annual, pace }) => (
                <div key={c.id} className="flex flex-col gap-1 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-text-primary">{c.name}</span>
                    <span className={isOverRow(pace) ? 'text-error' : 'text-text-secondary'}>
                      {formatMoney(spent)} / {formatMoney(annual)} · {paceLabel(pace)}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-bg-primary/50 overflow-hidden">
                    <div
                      className={`h-full ${isOverRow(pace) ? 'bg-error' : 'bg-accent'}`}
                      style={{ width: `${Math.max(0, Math.min(100, (spent / annual) * 100))}%` }}
                    />
                  </div>
                  <p className="text-meta text-text-secondary">
                    {formatMoney(spent)} spent · {formatMoney(Math.max(0, annual - spent))} left this year
                  </p>
                </div>
              ))}
            </div>
          )}

          {unbudgeted > 0 && (
            <div className="flex justify-between text-[13px] pt-2 border-t border-border">
              <span className="text-text-secondary">Unbudgeted spending</span>
              <span className="text-error font-medium">{formatMoney(unbudgeted)}</span>
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  )
}
