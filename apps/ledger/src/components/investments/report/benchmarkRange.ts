// Which slice of the benchmark comparison to draw.
//
// A PortfolioAnalyst export carries two benchmark series with different spans,
// and picking the wrong one is what made the chart open in 2021 for a report
// covering January to August 2026:
//
//   Cumulative Benchmark Comparison   bounded to the report period, daily,
//                                     already cumulative so it starts at 0
//   Historical Performance ...        since account inception, monthly, and
//                                     padded out to whole calendar years
//
// "Report period" reads the first. Every other range reads the second and
// rebases it, so each option restarts at 100 and is comparable with the rest.

import type { PABenchmarkPoint, PACumulativePoint } from '../../../utils/investments/ibkrPortfolioAnalyst'
import { rebasedGrowth, type GrowthPoint } from './reportMetrics'

export type BenchmarkRange = 'period' | '1y' | '3y' | '5y' | 'max'

export const BENCHMARK_RANGES: { id: BenchmarkRange; label: string }[] = [
  { id: 'period', label: 'Report period' },
  { id: '1y', label: '1Y' },
  { id: '3y', label: '3Y' },
  { id: '5y', label: '5Y' },
  { id: 'max', label: 'Max' },
]

const YEARS_BACK: Partial<Record<BenchmarkRange, number>> = { '1y': 1, '3y': 3, '5y': 5 }

/** The earliest YYYYMM a range should include, given the newest month present.
 *  Returns '' for 'max', which keeps everything. Exported for testing: the
 *  arithmetic is easy to get wrong by a month at a year boundary. */
export function rangeStartMonth(range: BenchmarkRange, latestMonth: string): string {
  const years = YEARS_BACK[range]
  if (years === undefined) return ''
  const m = /^(\d{4})(\d{2})$/.exec(latestMonth)
  if (!m) return ''
  // Inclusive of the same month N years earlier, so 1Y over Aug 2026 starts at
  // Sep 2025 and yields twelve months rather than thirteen.
  const start = Number(m[1]) * 12 + (Number(m[2]) - 1) - years * 12 + 1
  const year = Math.floor(start / 12)
  const month = (start % 12) + 1
  return `${year}${String(month).padStart(2, '0')}`
}

/** Growth of 100 from the cumulative section. Those values are already
 *  cumulative percentages from the period's start, so they are converted
 *  directly rather than compounded. */
export function cumulativeGrowth(points: PACumulativePoint[]): { names: string[]; data: GrowthPoint[] } {
  if (points.length === 0) return { names: [], data: [] }
  const names = ['Account', ...Object.keys(points[0].benchmarks)]
  const data = points.map((p) => {
    const row: GrowthPoint = { month: p.date }
    row.Account = Number((100 * (1 + p.account / 100)).toFixed(2))
    for (const [bm, v] of Object.entries(p.benchmarks)) {
      if (names.includes(bm)) row[bm] = Number((100 * (1 + v / 100)).toFixed(2))
    }
    return row
  })
  return { names, data }
}

export interface BenchmarkView {
  names: string[]
  data: GrowthPoint[]
  /** True when the x values are dates from the cumulative section rather than
   *  YYYYMM months, so the caller knows not to run them through the month
   *  formatter. */
  daily: boolean
}

/** The series to draw for a range, or empty when that range has no data. */
export function benchmarkView(
  range: BenchmarkRange,
  cumulative: PACumulativePoint[],
  monthly: PABenchmarkPoint[],
): BenchmarkView {
  if (range === 'period') {
    return { ...cumulativeGrowth(cumulative), daily: true }
  }
  if (monthly.length === 0) return { names: [], data: [], daily: false }
  const latest = monthly.reduce((a, p) => (p.month > a ? p.month : a), monthly[0].month)
  return { ...rebasedGrowth(monthly, rangeStartMonth(range, latest)), daily: false }
}

/** Ranges worth offering for a given report. A range is dropped when it would
 *  show the same span as Max, so a two year old account does not get 3Y and 5Y
 *  buttons that all draw an identical line. */
export function availableRanges(
  cumulative: PACumulativePoint[],
  monthly: PABenchmarkPoint[],
): BenchmarkRange[] {
  const out: BenchmarkRange[] = []
  if (cumulative.length > 1) out.push('period')
  if (monthly.length > 1) {
    const months = monthly.map((p) => p.month).sort()
    const earliest = months[0]
    const latest = months[months.length - 1]
    for (const id of ['1y', '3y', '5y'] as BenchmarkRange[]) {
      if (rangeStartMonth(id, latest) > earliest) out.push(id)
    }
    out.push('max')
  }
  return out
}
