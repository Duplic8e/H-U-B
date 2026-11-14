import { useMemo } from 'react'
import { useBudgetStore } from '../store/useBudgetStore'
import { billCategoryIds, detectBillCategories } from '../utils/budget/bills'

/** The ids of the categories treated as bills right now. */
export function useBillIds(): Set<string> {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  return useMemo(() => billCategoryIds(transactions, categories), [transactions, categories])
}

/** The ids Auto would treat as bills, whatever each category is set to. Setup shows this next to the control. */
export function useDetectedBillIds(): Set<string> {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  return useMemo(() => detectBillCategories(transactions, categories), [transactions, categories])
}
