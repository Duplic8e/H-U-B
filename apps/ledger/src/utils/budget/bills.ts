// Bill categories: spending that is one payment (Rent, Utilities, a subscription) rather than something spread
// across the month. Pace only makes sense for spread spending, so a bill is judged as Due, Paid or Over Budget.

import type { Category, Transaction } from '../../types/budget'
import { isAnnual } from './cadence'
import { detectRecurring, normalizeDescription } from './recurring'
import { splitParts } from './splits'

export type BillSetting = 'auto' | 'bill' | 'everyday'

/** What the user chose for a category. Absent means Auto, so no migration is needed for older saves. */
export const billSettingOf = (cat: Category): BillSetting => cat.billing ?? 'auto'

/** Share of a category's spending that must come from monthly recurring payments before Auto calls it a bill. A
 *  category that mixes a fixed charge with everyday spending (Food with a meal kit) stays everyday. */
export const AUTO_BILL_SHARE = 0.8

/** A recurring payment counts as monthly when its gap is about a month; weekly and biweekly ones do not. */
const isMonthly = (intervalDays: number) => intervalDays >= 26 && intervalDays <= 35

/** Categories whose spending is almost all monthly recurring payments. Annual categories are never detected,
 *  since a yearly payment has too few repeats to see; mark those as a Bill by hand. */
export function detectBillCategories(transactions: Record<string, Transaction>, categories: Record<string, Category>): Set<string> {
  const monthly = new Set(detectRecurring(transactions).filter((r) => r.type === 'expense' && isMonthly(r.intervalDays)).map((r) => r.key))
  if (monthly.size === 0) return new Set()
  const total = new Map<string, number>()
  const recurring = new Map<string, number>()
  for (const t of Object.values(transactions)) {
    if (t.type !== 'expense') continue
    const isRecurring = monthly.has(`expense:${normalizeDescription(t.description)}`)
    for (const part of splitParts(t)) {
      if (!part.categoryId) continue
      total.set(part.categoryId, (total.get(part.categoryId) ?? 0) + part.amount)
      if (isRecurring) recurring.set(part.categoryId, (recurring.get(part.categoryId) ?? 0) + part.amount)
    }
  }
  const out = new Set<string>()
  for (const [id, sum] of total) {
    const cat = categories[id]
    if (!cat || isAnnual(cat) || sum <= 0) continue
    if ((recurring.get(id) ?? 0) / sum >= AUTO_BILL_SHARE) out.add(id)
  }
  return out
}

/** Whether a category is a bill: marked Bill, or left on Auto and found by detection. */
export function isBillCategory(cat: Category, detected: Set<string>): boolean {
  const setting = billSettingOf(cat)
  return setting === 'bill' || (setting === 'auto' && detected.has(cat.id))
}

/** The categories treated as bills: the ones marked Bill, plus the detected ones left on Auto. */
export function billCategoryIds(transactions: Record<string, Transaction>, categories: Record<string, Category>): Set<string> {
  const detected = detectBillCategories(transactions, categories)
  const out = new Set<string>()
  for (const cat of Object.values(categories)) if (isBillCategory(cat, detected)) out.add(cat.id)
  return out
}
