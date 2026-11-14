// Recurring-charge detection. Groups transactions by normalized description
// + type, then accepts a group as recurring when: >=3 occurrences, the
// median gap between consecutive dates is 5-95 days with every gap within
// ±40% of the median, and every amount is within ±25% of the median amount.

import type { Transaction } from '../../types/budget'

export function normalizeDescription(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/[#*]?\d[\w\d]*/g, '') // reference numbers / alphanumeric refs starting with a digit
    .replace(/[#*-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface RecurringItem {
  key: string
  description: string
  type: 'expense' | 'income'
  avgAmount: number
  intervalDays: number
  occurrences: number
  lastDate: string
  nextExpected: string
  monthlyEstimate: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function detectRecurring(transactions: Record<string, Transaction>): RecurringItem[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of Object.values(transactions)) {
    const norm = normalizeDescription(t.description)
    if (!norm) continue
    const key = `${t.type}:${norm}`
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }

  const items: RecurringItem[] = []
  for (const [key, list] of groups) {
    if (list.length < 3) continue
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(
        Math.round(
          (new Date(`${sorted[i].date}T00:00:00`).getTime() -
            new Date(`${sorted[i - 1].date}T00:00:00`).getTime()) / DAY_MS,
        ),
      )
    }
    const gapMed = median(gaps)
    if (gapMed < 5 || gapMed > 95) continue
    if (!gaps.every((g) => Math.abs(g - gapMed) <= gapMed * 0.4)) continue

    const amounts = sorted.map((t) => t.amount)
    const amtMed = median(amounts)
    if (amtMed <= 0 || !amounts.every((a) => Math.abs(a - amtMed) <= amtMed * 0.25)) continue

    const last = sorted[sorted.length - 1]
    const next = new Date(`${last.date}T00:00:00`)
    next.setDate(next.getDate() + Math.round(gapMed))
    // Built from local date parts deliberately, not next.toISOString(). The
    // date was parsed at local midnight above, and toISOString reads back in
    // UTC: for users ahead of UTC that reports the previous day, which makes
    // upcomingWithin's `nextExpected >= todayISO` check false on the charge's
    // actual due date and drops it from the upcoming window.
    const nextExpected = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
    items.push({
      key,
      description: last.description,
      type: last.type,
      avgAmount: amtMed,
      intervalDays: Math.round(gapMed),
      occurrences: sorted.length,
      lastDate: last.date,
      nextExpected,
      monthlyEstimate: amtMed * (30 / Math.round(gapMed)),
    })
  }
  return items.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate)
}

/** Charges expected between today and `days` from today, inclusive at both
 *  ends, soonest first. Dates are compared as YYYY-MM-DD strings, which sort
 *  lexicographically. The window end is computed in UTC so the host timezone
 *  cannot shift the final boundary day. */
export function upcomingWithin(
  items: RecurringItem[],
  todayISO: string,
  days: number,
): RecurringItem[] {
  const [y, m, d] = todayISO.split('-').map(Number)
  const end = new Date(Date.UTC(y, m - 1, d + days))
  const endISO = end.toISOString().slice(0, 10)
  return items
    .filter((i) => i.nextExpected >= todayISO && i.nextExpected <= endISO)
    .sort((a, b) => a.nextExpected.localeCompare(b.nextExpected))
}
