// Pure selectors over budget transactions. Kept store-free so calculators
// (4b Emergency Fund, 4e forecaster auto-feed) can call them with
// useBudgetStore.getState().transactions or any snapshot.

import type { Category, CategoryGroup, Transaction } from '../types/budget'
import { countsAsIncome } from '../utils/budget/sharedExpenses'
import { monthlyEquivalent } from '../utils/budget/cadence'
import { monthKeyOf } from '../utils/budget/period'

export function monthlyExpenseTotal(
  transactions: Record<string, Transaction>,
  month: string,
): number {
  return Object.values(transactions)
    .filter((t) => t.type === 'expense' && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0)
}

export function monthlyIncomeTotal(
  transactions: Record<string, Transaction>,
  month: string,
): number {
  return Object.values(transactions)
    .filter((t) => countsAsIncome(t) && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0)
}

/** 'YYYY-MM' keys for the N completed months before refDate (most recent first). */
function completedMonthKeys(monthsBack: number, refDate: Date): string[] {
  const keys: string[] = []
  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

export function averageMonthlyExpenses(
  transactions: Record<string, Transaction>,
  monthsBack: number,
  refDate: Date = new Date(),
): number {
  if (monthsBack <= 0) return 0
  const months = completedMonthKeys(monthsBack, refDate)
  const total = months.reduce((sum, m) => sum + monthlyExpenseTotal(transactions, m), 0)
  return total / monthsBack
}

export function averageMonthlyNetSavings(
  transactions: Record<string, Transaction>,
  monthsBack: number,
  refDate: Date = new Date(),
): number {
  if (monthsBack <= 0) return 0
  const months = completedMonthKeys(monthsBack, refDate)
  const total = months.reduce(
    (sum, m) => sum + monthlyIncomeTotal(transactions, m) - monthlyExpenseTotal(transactions, m),
    0,
  )
  return total / monthsBack
}

/** Sum of expense-category monthly budget contributions. Annual categories
 *  contribute one twelfth. Income categories excluded. */
export function totalMonthlyBudget(
  categories: Record<string, Category>,
  categoryGroups: Record<string, CategoryGroup>,
): number {
  return Object.values(categories)
    .filter((c) => categoryGroups[c.groupId]?.kind === 'expense')
    .reduce((sum, c) => sum + monthlyEquivalent(c), 0)
}

export interface MonthlyFlow {
  month: string
  income: number
  expense: number
}

/** Income and expense totals for the N months ending at refDate (oldest
 *  first). Empty months are zero. Reimbursements are excluded from income
 *  because monthlyIncomeTotal filters them out via countsAsIncome. */
export function incomeExpenseSeries(
  transactions: Record<string, Transaction>,
  monthsBack: number,
  refDate: Date = new Date(),
): MonthlyFlow[] {
  const series: MonthlyFlow[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
    const month = monthKeyOf(d)
    series.push({
      month,
      income: monthlyIncomeTotal(transactions, month),
      expense: monthlyExpenseTotal(transactions, month),
    })
  }
  return series
}

/** Savings rate over a set of monthly flows: (income - expense) / income.
 *  Returns null when total income is zero, so callers can render a neutral
 *  placeholder rather than dividing by zero. */
export function savingsRate(series: MonthlyFlow[]): number | null {
  const income = series.reduce((sum, m) => sum + m.income, 0)
  const expense = series.reduce((sum, m) => sum + m.expense, 0)
  if (income <= 0) return null
  return (income - expense) / income
}
