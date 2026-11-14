import type { Category, CategoryGroup, Transaction } from '../types/budget'
import { STORAGE_KEYS } from '../store/storageKeys'

export const DEMO_FLAG_KEY = STORAGE_KEYS.demo

export function isDemoActive(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(DEMO_FLAG_KEY) !== null
}

const listeners = new Set<() => void>()

/** The banner in Layout is the only on-screen signal that the figures shown
 *  are sample data, so it has to track the flag exactly. A plain localStorage
 *  read cannot do that: nothing re-renders when the value changes, which left
 *  the banner on screen after the data behind it was cleared. */
export function subscribeDemoActive(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

export function setDemoActive(on: boolean): void {
  if (typeof localStorage === 'undefined') return
  if (on) localStorage.setItem(DEMO_FLAG_KEY, 'on')
  else localStorage.removeItem(DEMO_FLAG_KEY)
  for (const l of listeners) l()
}

const DEMO_GROUP_EXPENSE = 'demo-group-expense'
const DEMO_GROUP_INCOME = 'demo-group-income'

/** Category groups backing the demo categories. Not part of buildDemoData's
 *  return shape (categories/transactions only), but a category's groupId
 *  must resolve to something real or it renders under no group. Callers that
 *  apply demo data to the budget store should merge these in alongside
 *  buildDemoData's categories. */
export function buildDemoCategoryGroups(): Record<string, CategoryGroup> {
  return {
    [DEMO_GROUP_EXPENSE]: { id: DEMO_GROUP_EXPENSE, name: 'Everyday', kind: 'expense' },
    [DEMO_GROUP_INCOME]: { id: DEMO_GROUP_INCOME, name: 'Income', kind: 'income' },
  }
}

export function buildDemoData(): {
  transactions: Record<string, Transaction>
  categories: Record<string, Category>
} {
  const categories: Record<string, Category> = {
    'demo-cat-1': { id: 'demo-cat-1', groupId: DEMO_GROUP_EXPENSE, name: 'Groceries', targetAmount: 400 },
    'demo-cat-2': { id: 'demo-cat-2', groupId: DEMO_GROUP_EXPENSE, name: 'Transport', targetAmount: 200 },
    'demo-cat-3': { id: 'demo-cat-3', groupId: DEMO_GROUP_INCOME, name: 'Salary', targetAmount: 0 },
  }

  // 'prev' and 'cur' below stand for the previous and current month, resolved
  // from the real date at call time so demo data always lands in the app's
  // default current-month views, regardless of when demo mode is loaded.
  const seed: Array<[string, number, string, 'income' | 'expense', 'prev' | 'cur', number]> = [
    ['Grocery run', 82.4, 'demo-cat-1', 'expense', 'prev', 6],
    ['Transit pass', 156, 'demo-cat-2', 'expense', 'prev', 8],
    ['Paycheque', 3200, 'demo-cat-3', 'income', 'prev', 15],
    ['Grocery run', 61.15, 'demo-cat-1', 'expense', 'prev', 18],
    ['Rideshare', 24.8, 'demo-cat-2', 'expense', 'prev', 20],
    ['Grocery run', 94.02, 'demo-cat-1', 'expense', 'prev', 27],
    ['Paycheque', 3200, 'demo-cat-3', 'income', 'prev', 30],
    ['Grocery run', 77.6, 'demo-cat-1', 'expense', 'cur', 4],
    ['Transit pass', 156, 'demo-cat-2', 'expense', 'cur', 8],
    ['Paycheque', 3200, 'demo-cat-3', 'income', 'cur', 15],
    ['Grocery run', 88.31, 'demo-cat-1', 'expense', 'cur', 19],
    ['Rideshare', 18.45, 'demo-cat-2', 'expense', 'cur', 24],
  ]

  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() // 0-based
  // January (curMonth 0) rolls the previous month back to December of the prior year.
  const prevYear = curMonth === 0 ? curYear - 1 : curYear
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1

  const monthPrefix = (year: number, month: number): string =>
    `${year}-${String(month + 1).padStart(2, '0')}`

  const transactions: Record<string, Transaction> = {}
  seed.forEach(([description, amount, categoryId, type, which, day], i) => {
    const id = `demo-tx-${i + 1}`
    const prefix = which === 'cur' ? monthPrefix(curYear, curMonth) : monthPrefix(prevYear, prevMonth)
    transactions[id] = {
      id,
      date: `${prefix}-${String(day).padStart(2, '0')}`,
      amount,
      description,
      type,
      categoryId,
    }
  })

  return { transactions, categories }
}
