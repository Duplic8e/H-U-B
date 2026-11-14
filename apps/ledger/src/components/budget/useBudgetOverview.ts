import { useBudgetStore } from '../../store/useBudgetStore'
import { useRecurringStore } from '../../store/useRecurringStore'
import { unpaidBillsThisMonth } from '../../utils/budget/cashPlan'
import { incomeExpenseSeries, savingsRate, totalMonthlyBudget } from '../../store/budgetSelectors'
import { countsAsIncome, iouBalances } from '../../utils/budget/sharedExpenses'
import { inRange, isSingleMonth, monthKeyOf, monthsInRange, type MonthRange } from '../../utils/budget/period'
import { splitParts } from '../../utils/budget/splits'
import { annualTarget, elapsedMonthsInYear, isAnnual, setAsideExpected } from '../../utils/budget/cadence'
import { detectRecurring } from '../../utils/budget/recurring'
import { forecastMonthEnd } from '../../utils/budget/cashFlowForecast'
import { billPace, paceOf, type RowPace } from '../../utils/budget/pace'
import { useBillIds } from '../../hooks/useBillIds'

export interface CategoryRow { id: string; name: string; spent: number; target: number; pace: RowPace }

/** Everything the phone Overview shows for a period, from the same rules the desktop widgets use. */
export function useBudgetOverview(range: MonthRange) {
  const transactions = useBudgetStore((s) => s.transactions)
  const plannedBills = useRecurringStore((s) => s.plannedBills)
  const categories = useBudgetStore((s) => s.categories)
  const categoryGroups = useBudgetStore((s) => s.categoryGroups)
  const bills = useBillIds()

  const inPeriod = Object.values(transactions).filter((t) => inRange(t.date, range))
  const incomeTx = inPeriod.filter((t) => countsAsIncome(t))
  const expenseTx = inPeriod.filter((t) => t.type === 'expense')
  const income = incomeTx.reduce((s, t) => s + t.amount, 0)
  const expense = expenseTx.reduce((s, t) => s + t.amount, 0)

  const bySource: Record<string, number> = {}
  for (const t of incomeTx) for (const p of splitParts(t)) {
    const name = (p.categoryId && categories[p.categoryId]?.name) || 'Other Income'
    bySource[name] = (bySource[name] ?? 0) + p.amount
  }
  const sources = Object.entries(bySource).sort((a, b) => b[1] - a[1])

  const byGroup: Record<string, number> = {}
  const spentByCategory = new Map<string, number>()
  for (const t of expenseTx) for (const p of splitParts(t)) {
    const groupId = p.categoryId ? categories[p.categoryId]?.groupId : undefined
    const name = (groupId && categoryGroups[groupId]?.name) || 'Uncategorized'
    byGroup[name] = (byGroup[name] ?? 0) + p.amount
    spentByCategory.set(p.categoryId ?? '', (spentByCategory.get(p.categoryId ?? '') ?? 0) + p.amount)
  }
  const groups = Object.entries(byGroup).sort((a, b) => b[1] - a[1])

  const months = monthsInRange(range)
  const now = new Date()
  const current = isSingleMonth(range) && range.to === monthKeyOf(now)
  const [y, m] = range.to.split('-').map(Number)
  const monthFraction = current ? now.getDate() / new Date(y, m, 0).getDate() : 1

  const withTarget = Object.values(categories).filter((c) => c.targetAmount > 0)
  const rows: CategoryRow[] = withTarget
    .filter((c) => !isAnnual(c))
    .map((c) => {
      const spent = spentByCategory.get(c.id) ?? 0
      const target = c.targetAmount * months
      const pace = bills.has(c.id) && current ? billPace(spent, target) : paceOf(spent, target * monthFraction)
      return { id: c.id, name: c.name, spent, target, pace }
    })
    .sort((a, b) => b.spent / b.target - a.spent / a.target)

  // Annual budgets count calendar-year spend through the viewed month.
  const yearRange: MonthRange = { from: `${y}-01`, to: range.to }
  const yearSpent = new Map<string, number>()
  for (const t of Object.values(transactions)) {
    if (t.type !== 'expense' || !inRange(t.date, yearRange)) continue
    for (const p of splitParts(t)) yearSpent.set(p.categoryId ?? '', (yearSpent.get(p.categoryId ?? '') ?? 0) + p.amount)
  }
  const elapsed = elapsedMonthsInYear(y, new Date(y, m - 1, 1))
  const annualRows: CategoryRow[] = withTarget.filter(isAnnual).map((c) => {
    const target = annualTarget(c)
    const spent = yearSpent.get(c.id) ?? 0
    return { id: c.id, name: c.name, spent, target, pace: bills.has(c.id) ? billPace(spent, target) : paceOf(spent, setAsideExpected(target, elapsed)) }
  })

  const budgeted = totalMonthlyBudget(categories, categoryGroups) * months
  const unbudgeted = expenseTx.flatMap((t) => splitParts(t))
    .filter((p) => !p.categoryId || (categories[p.categoryId]?.targetAmount ?? 0) === 0)
    .reduce((s, p) => s + p.amount, 0)

  const series = incomeExpenseSeries(transactions, months, new Date(`${range.to}-15T12:00:00`))
  const rate = savingsRate(series)
  // Unpaid hand-entered bills count too, so this agrees with the Dashboard.
  const detected = current ? detectRecurring(transactions) : []
  const projected = current
    ? forecastMonthEnd(transactions, detected, range.to, now.toISOString().slice(0, 10),
        unpaidBillsThisMonth(plannedBills, transactions, range.to, detected.map((d) => d.description))).projectedNet
    : null
  const owed = Object.values(iouBalances(transactions)).filter((v) => v > 0.005).reduce((s, v) => s + v, 0)

  return { income, expense, net: income - expense, sources, groups, rows, annualRows, budgeted, unbudgeted, rate, projected, owed, current, range }
}
export type BudgetOverview = ReturnType<typeof useBudgetOverview>
