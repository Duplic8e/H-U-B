// Shared-bill IOU tracking, derived from transactions. amount on a shared
// expense is the user's own share; the remainder is owed by sharedWith.

import type { Transaction } from '../../types/budget'

/** Income that should count in income totals (reimbursements do not). */
export function countsAsIncome(t: Transaction): boolean {
  return t.type === 'income' && !t.reimbursement
}

/** Per-person outstanding balance: shared remainders minus reimbursements.
 *  Negative means the person overpaid. */
export function iouBalances(
  transactions: Record<string, Transaction>,
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const t of Object.values(transactions)) {
    if (t.type === 'expense' && t.shared) {
      const owed = t.shared.totalAmount - t.amount
      if (owed !== 0) {
        balances[t.shared.sharedWith] = (balances[t.shared.sharedWith] ?? 0) + owed
      }
    } else if (t.type === 'income' && t.reimbursement) {
      balances[t.reimbursement.from] = (balances[t.reimbursement.from] ?? 0) - t.amount
    }
  }
  return balances
}

/** Unique person names seen on shared bills or reimbursements. */
export function sharedPeople(transactions: Record<string, Transaction>): string[] {
  const names = new Set<string>()
  for (const t of Object.values(transactions)) {
    if (t.shared?.sharedWith) names.add(t.shared.sharedWith)
    if (t.reimbursement?.from) names.add(t.reimbursement.from)
  }
  return [...names]
}
