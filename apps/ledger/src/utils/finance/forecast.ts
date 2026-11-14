// Deterministic net-worth forecast. Monthly compounding (rate/12), end-of-
// month contributions stepping up annually, lump sums on real month offsets,
// conservative/base/optimistic = return ∓/+ scenarioSpreadPct, real = base
// deflated by inflation. monthlyDrag models debt service ending at a month.

export interface LumpSum {
  month: number // offset from now, 1-based
  amount: number
  label?: string
}

export interface ForecastConfig {
  startBalance: number
  monthlySavings: number
  annualReturnPct: number
  annualInflationPct: number
  contributionStepUpPct: number
  years: number
  lumpSums?: LumpSum[]
  scenarioSpreadPct?: number
  monthlyDrag?: { amount: number; untilMonth: number }
}

export interface ForecastPoint {
  month: number
  base: number
  conservative: number
  optimistic: number
  real: number
  contributed: number
  growth: number
  contributedReal: number
  growthReal: number
  conservativeReal: number
  optimisticReal: number
}

export function buildForecast(config: ForecastConfig): ForecastPoint[] {
  const spread = config.scenarioSpreadPct ?? 2
  const months = Math.max(1, Math.round(config.years * 12))
  const rates = {
    base: config.annualReturnPct / 100 / 12,
    conservative: (config.annualReturnPct - spread) / 100 / 12,
    optimistic: (config.annualReturnPct + spread) / 100 / 12,
  }
  const lumpsByMonth = new Map<number, number>()
  for (const l of config.lumpSums ?? []) {
    lumpsByMonth.set(l.month, (lumpsByMonth.get(l.month) ?? 0) + l.amount)
  }

  const points: ForecastPoint[] = [{
    month: 0,
    base: config.startBalance,
    conservative: config.startBalance,
    optimistic: config.startBalance,
    real: config.startBalance,
    contributed: config.startBalance,
    growth: 0,
    contributedReal: config.startBalance,
    growthReal: 0,
    conservativeReal: config.startBalance,
    optimisticReal: config.startBalance,
  }]

  let balBase = config.startBalance
  let balCons = config.startBalance
  let balOpt = config.startBalance
  let contributed = config.startBalance

  for (let m = 1; m <= months; m++) {
    const yearsElapsed = Math.floor((m - 1) / 12)
    let contribution = config.monthlySavings * Math.pow(1 + config.contributionStepUpPct / 100, yearsElapsed)
    if (config.monthlyDrag && m <= config.monthlyDrag.untilMonth) {
      contribution -= config.monthlyDrag.amount
    }
    const lump = lumpsByMonth.get(m) ?? 0

    balBase = balBase * (1 + rates.base) + contribution + lump
    balCons = balCons * (1 + rates.conservative) + contribution + lump
    balOpt = balOpt * (1 + rates.optimistic) + contribution + lump
    contributed += contribution + lump

    const deflator = Math.pow(1 + config.annualInflationPct / 100, m / 12)
    points.push({
      month: m,
      base: balBase,
      conservative: balCons,
      optimistic: balOpt,
      real: balBase / deflator,
      contributed,
      growth: balBase - contributed,
      contributedReal: contributed / deflator,
      growthReal: (balBase - contributed) / deflator,
      conservativeReal: balCons / deflator,
      optimisticReal: balOpt / deflator,
    })
  }
  return points
}
