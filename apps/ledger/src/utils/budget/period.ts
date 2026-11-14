// Month-granular reporting periods. A range is a pair of inclusive
// YYYY-MM keys; date membership is a simple prefix comparison, which is
// correct because YYYY-MM strings sort lexicographically.

export interface MonthRange { from: string; to: string }
export type PeriodPreset = 'last3' | 'last6' | 'last12' | 'ytd'
export type Period =
  | { kind: 'month'; month: string }
  | { kind: 'preset'; preset: PeriodPreset }

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonthKey(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return monthKeyOf(new Date(y, m - 1 + delta, 1))
}

export function rangeOf(period: Period, now: Date = new Date()): MonthRange {
  if (period.kind === 'month') return { from: period.month, to: period.month }
  const current = monthKeyOf(now)
  switch (period.preset) {
    case 'last3': return { from: shiftMonthKey(current, -2), to: current }
    case 'last6': return { from: shiftMonthKey(current, -5), to: current }
    case 'last12': return { from: shiftMonthKey(current, -11), to: current }
    case 'ytd': return { from: `${now.getFullYear()}-01`, to: current }
  }
}

export function inRange(dateStr: string, range: MonthRange): boolean {
  const m = dateStr.slice(0, 7)
  return m >= range.from && m <= range.to
}

export function monthKeysInRange(range: MonthRange): string[] {
  const keys: string[] = []
  for (let k = range.from; k <= range.to; k = shiftMonthKey(k, 1)) keys.push(k)
  return keys
}

export function monthsInRange(range: MonthRange): number {
  return monthKeysInRange(range).length
}

export function isSingleMonth(range: MonthRange): boolean {
  return range.from === range.to
}
