// Pure derivations for the PortfolioAnalyst report. Kept free of React and
// recharts so the arithmetic can be tested directly.

import type {
  PABenchmarkPoint, PABenchmarkSummaryRow, PADividend, PAFeeRow,
  PAProjectedIncomeRow, PAReport, PASymbolPerf,
} from '../../../utils/investments/ibkrPortfolioAnalyst'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** IBKR reports the benchmark month as a bare YYYYMM string ("202601"), which
 *  is unreadable as an axis tick. Anything that is not a valid YYYYMM is passed
 *  through untouched rather than guessed at. */
export function formatReportMonth(month: string): string {
  const m = /^(\d{4})(\d{2})$/.exec(month)
  if (!m) return month
  const index = Number(m[2]) - 1
  if (index < 0 || index > 11) return month
  return `${MONTH_NAMES[index]} ${m[1]}`
}

export interface AccountValue {
  /** Ending NAV: holdings plus cash, net of any margin loan. */
  nav: number
  /** Cash sleeve, negative when the account is drawn on margin. */
  cash: number | null
  /** Currency the report is denominated in. Never converted here. */
  baseCurrency: string
}

/** Account value as the broker reports it, which unlike the sum of imported
 *  holdings includes cash and nets out a margin loan. Null when no report has
 *  been uploaded or it carried no key statistics. */
export function accountValue(report: PAReport | null): AccountValue | null {
  if (!report?.keyStats) return null
  const cashRow = report.assetClassAllocation.find((r) => r.name.toLowerCase() === 'cash')
  return {
    nav: report.keyStats.endingNav,
    cash: cashRow ? cashRow.endingNav : null,
    baseCurrency: report.baseCurrency || 'CAD',
  }
}

export interface GrowthPoint {
  month: string
  [series: string]: string | number
}

/** Cumulative growth of 100 from monthly percentage returns.
 *
 *  Points are sorted oldest-first before compounding. The report does not
 *  guarantee chronological rows, and order is not merely cosmetic here: each
 *  month multiplies into a running total, so an out-of-order input both draws
 *  the axis backwards and compounds the returns in the wrong sequence. Month
 *  keys are fixed-width ("202601"), so a lexicographic sort is chronological. */
export function growthSeries(points: PABenchmarkPoint[]): { names: string[]; data: GrowthPoint[] } {
  if (points.length === 0) return { names: [], data: [] }
  const ordered = [...points].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
  const names = ['Account', ...Object.keys(ordered[0].benchmarks)]
  const running: Record<string, number> = Object.fromEntries(names.map((n) => [n, 100]))
  const data = ordered.map((p) => {
    running.Account *= 1 + p.account / 100
    for (const [bm, r] of Object.entries(p.benchmarks)) {
      if (running[bm] !== undefined) running[bm] *= 1 + r / 100
    }
    return {
      month: p.month,
      ...Object.fromEntries(names.map((n) => [n, Number(running[n].toFixed(2))])),
    } as GrowthPoint
  })
  return { names, data }
}

/** Best and worst contributors. Buckets are disjoint: a symbol is either a
 *  positive contributor or a detractor, never both. Zeros are dropped. */
export function contributors(
  rows: PASymbolPerf[],
  n = 5,
): { top: PASymbolPerf[]; bottom: PASymbolPerf[] } {
  const sorted = [...rows].sort((a, b) => b.contribution - a.contribution)
  return {
    top: sorted.filter((r) => r.contribution > 0).slice(0, n),
    bottom: sorted.filter((r) => r.contribution < 0).slice(-n).reverse(),
  }
}

export function incomeTotals(
  dividends: PADividend[],
  projected: PAProjectedIncomeRow[],
): { dividends: number; projectedAnnual: number } {
  return {
    dividends: dividends.reduce((s, d) => s + d.amount, 0),
    projectedAnnual: projected.reduce((s, p) => s + p.estAnnualIncome, 0),
  }
}

export function feeTotal(fees: PAFeeRow[]): number {
  return fees.reduce((s, f) => s + f.amount, 0)
}

export interface BenchmarkDelta {
  /** Account since-inception return minus the benchmark's. */
  delta: number
  /** The benchmark it was measured against, for labelling. */
  benchmarkName: string
}

/** Account return minus the first benchmark's, since inception.
 *
 *  The account has to be found by id, not by position. IBKR lists every
 *  benchmark first and the account LAST, so reading row 0 as the account
 *  computes one benchmark minus another and presents it as the user's own
 *  outperformance. On a real export that produced "+36.53% vs EFA" for an
 *  account that was down 54% since inception. */
export function benchmarkDelta(
  summary: PABenchmarkSummaryRow[],
  accountId: string,
): BenchmarkDelta | null {
  if (!accountId) return null
  const account = summary.find((r) => r.name === accountId)
  if (!account) return null
  const benchmark = summary.find((r) => r.name !== accountId)
  if (!benchmark) return null
  return { delta: account.inception - benchmark.inception, benchmarkName: benchmark.name }
}

/** Growth of 100 from `start` onwards, with every series restarting at 100.
 *
 *  Clipping without rebasing would begin each line at whatever value it had
 *  already compounded to, so a "last 1 year" view could open at 46 and read
 *  as a catastrophe rather than as a starting point. Rebasing is what makes
 *  one range comparable with another. A start at or before the first point
 *  keeps the whole series. */
export function rebasedGrowth(
  points: PABenchmarkPoint[],
  start: string,
): { names: string[]; data: GrowthPoint[] } {
  const ordered = [...points].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
  const from = ordered.filter((p) => p.month >= start)
  return growthSeries(from.length > 0 ? from : ordered)
}
