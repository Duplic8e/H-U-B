import type { TriageTransaction } from '../../types/triage'
import { merchantKey, merchantLabel } from './merchant'

/** One merchant's waiting transactions on the Categorize page. */
export interface MerchantGroup {
  /** merchantKey plus direction, so a refund from a store is not filed with its purchases. */
  id: string
  key: string
  label: string
  type: 'income' | 'expense'
  ids: string[]
  count: number
  /** Money out is positive for expenses, money in is positive for income. */
  total: number
  latestDate: string
  /** Up to three of the bank's own descriptions, so a vague key can be checked. */
  samples: string[]
  /** The category the bank suggested for most of these rows, if any. */
  suggestedCategoryId?: string
}

/** Rows the page can file in one go. Possible duplicates, card payments and
 *  rows held by an exclusion rule need the Transactions tab instead. */
export function isQueueRow(tx: TriageTransaction): boolean {
  return !tx.duplicate && !tx.flag && !tx.exclusionMatches?.length
}

/** ISO date `months` calendar months before `today`. */
export function monthsBefore(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 - months, d))
  return date.toISOString().slice(0, 10)
}

export function buildMerchantGroups(pending: TriageTransaction[], options: { since?: string } = {}): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup & { suggestions: Map<string, number> }>()
  for (const tx of pending) {
    if (!isQueueRow(tx)) continue
    if (options.since && tx.date < options.since) continue
    const key = merchantKey(tx.description)
    const id = `${tx.type}:${key}`
    let group = groups.get(id)
    if (!group) {
      group = { id, key, label: merchantLabel(key), type: tx.type, ids: [], count: 0, total: 0, latestDate: tx.date, samples: [], suggestions: new Map() }
      groups.set(id, group)
    }
    group.ids.push(tx.id)
    group.count += 1
    group.total += tx.amount
    if (tx.date > group.latestDate) group.latestDate = tx.date
    if (group.samples.length < 3 && !group.samples.includes(tx.description)) group.samples.push(tx.description)
    if (tx.categoryId) group.suggestions.set(tx.categoryId, (group.suggestions.get(tx.categoryId) ?? 0) + 1)
  }
  return [...groups.values()]
    .map(({ suggestions, ...group }) => {
      const top = [...suggestions.entries()].sort((a, b) => b[1] - a[1])[0]
      return { ...group, total: Math.round(group.total * 100) / 100, suggestedCategoryId: top?.[0] }
    })
    // Most recent first; among equals, the merchant with the most rows, since
    // filing it clears the most.
    .sort((a, b) => b.latestDate.localeCompare(a.latestDate) || b.count - a.count || a.label.localeCompare(b.label))
}

export type GroupSort = 'newest' | 'oldest' | 'most' | 'largest' | 'name'

export const GROUP_SORTS: ReadonlyArray<{ value: GroupSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most', label: 'Most transactions' },
  { value: 'largest', label: 'Largest total' },
  { value: 'name', label: 'Store name (A–Z)' },
]

/** Reorders merchant groups. Ties fall back to newest, then name, so the
 *  order never jumps around between renders. */
export function sortGroups(groups: MerchantGroup[], sort: GroupSort): MerchantGroup[] {
  const newest = (a: MerchantGroup, b: MerchantGroup) => b.latestDate.localeCompare(a.latestDate)
  const name = (a: MerchantGroup, b: MerchantGroup) => a.label.localeCompare(b.label)
  const compare: Record<GroupSort, (a: MerchantGroup, b: MerchantGroup) => number> = {
    newest: (a, b) => newest(a, b) || b.count - a.count || name(a, b),
    oldest: (a, b) => a.latestDate.localeCompare(b.latestDate) || b.count - a.count || name(a, b),
    most: (a, b) => b.count - a.count || newest(a, b) || name(a, b),
    largest: (a, b) => Math.abs(b.total) - Math.abs(a.total) || newest(a, b) || name(a, b),
    name: (a, b) => name(a, b) || newest(a, b),
  }
  return [...groups].sort(compare[sort])
}
