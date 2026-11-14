import { buildForecast, type LumpSum } from '../../../utils/finance/forecast'
import { coastFiNumber, fiNumber, monthsToReach } from '../../../utils/finance/fire'
import type { useForecasterSettings } from './useForecasterSettings'

export type ForecasterData = ReturnType<typeof useForecasterSettings>

/** Everything the forecaster derives from its settings once a starting balance is known. */
export function buildForecastModel(data: ForecasterData, startBalance: number) {
  const { settings, events, goals, autoFeed, resolved } = data
  const eventLumps: LumpSum[] = events.map((e) => ({
    month: Math.max(1, Math.round(e.yearsFromNow * 12)),
    amount: e.amount,
    label: e.label,
  }))
  const lumps = [...autoFeed.compLumps, ...eventLumps]

  const points = buildForecast({
    startBalance,
    monthlySavings: resolved.monthlySavings,
    annualReturnPct: settings.annualReturnPct,
    annualInflationPct: settings.inflationPct,
    contributionStepUpPct: settings.stepUpPct,
    years: settings.years,
    lumpSums: lumps,
    scenarioSpreadPct: settings.spreadPct,
    monthlyDrag: autoFeed.debtDrag ?? undefined,
  })

  const fi = fiNumber(settings.annualSpending, settings.withdrawalRatePct)
  const fiMonth = monthsToReach(points, fi)
  const coast = coastFiNumber(fi, settings.annualReturnPct, settings.years)
  const goalMarkers = goals.map((g) => ({ label: g.label, month: monthsToReach(points, g.amount), amount: g.amount }))
  return { lumps, points, fi, fiMonth, coast, goalMarkers }
}

export function formatMonthsOut(m: number | null): string {
  if (m === null) return 'Beyond horizon'
  if (m === 0) return 'Reached'
  const d = new Date()
  d.setMonth(d.getMonth() + m)
  return `${d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })} (${Math.floor(m / 12)}y ${m % 12}m)`
}
