// Monte Carlo net-worth simulation. Monthly returns ~ Normal(mean/12,
// stdDev/sqrt(12)) via Box-Muller over a mulberry32 seeded PRNG so tests
// (and reloads) are reproducible. Percentile bands are computed per year.

import type { LumpSum } from './forecast'

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MonteCarloConfig {
  startBalance: number
  monthlySavings: number
  years: number
  meanReturnPct: number
  stdDevPct: number
  contributionStepUpPct?: number
  lumpSums?: LumpSum[]
  runs?: number
  seed?: number
}

export interface PercentileBand {
  year: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface MonteCarloResult {
  bands: PercentileBand[]
  finalBalances: number[]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]
}

export function runMonteCarlo(config: MonteCarloConfig): MonteCarloResult {
  const runs = config.runs ?? 500
  const rand = mulberry32(config.seed ?? 42)
  const months = Math.max(1, Math.round(config.years * 12))
  const meanMonthly = config.meanReturnPct / 100 / 12
  const sdMonthly = config.stdDevPct / 100 / Math.sqrt(12)
  const stepUp = config.contributionStepUpPct ?? 0
  const lumpsByMonth = new Map<number, number>()
  for (const l of config.lumpSums ?? []) {
    lumpsByMonth.set(l.month, (lumpsByMonth.get(l.month) ?? 0) + l.amount)
  }

  // Box-Muller pair; cache the spare value.
  let spare: number | null = null
  const gaussian = (): number => {
    if (spare !== null) {
      const v = spare
      spare = null
      return v
    }
    let u = 0
    let v = 0
    while (u === 0) u = rand()
    while (v === 0) v = rand()
    const mag = Math.sqrt(-2 * Math.log(u))
    spare = mag * Math.sin(2 * Math.PI * v)
    return mag * Math.cos(2 * Math.PI * v)
  }

  const years = Math.ceil(months / 12)
  const yearly: number[][] = Array.from({ length: years }, () => [])
  const finalBalances: number[] = []

  for (let run = 0; run < runs; run++) {
    let balance = config.startBalance
    for (let m = 1; m <= months; m++) {
      const yearsElapsed = Math.floor((m - 1) / 12)
      const contribution = config.monthlySavings * Math.pow(1 + stepUp / 100, yearsElapsed)
      const monthlyReturn = sdMonthly === 0 ? meanMonthly : meanMonthly + sdMonthly * gaussian()
      balance = balance * (1 + monthlyReturn) + contribution + (lumpsByMonth.get(m) ?? 0)
      if (m % 12 === 0 || m === months) yearly[Math.ceil(m / 12) - 1].push(balance)
    }
    finalBalances.push(balance)
  }

  const bands: PercentileBand[] = yearly.map((balances, i) => {
    const sorted = [...balances].sort((a, b) => a - b)
    return {
      year: i + 1,
      p10: percentile(sorted, 10),
      p25: percentile(sorted, 25),
      p50: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p90: percentile(sorted, 90),
    }
  })
  return { bands, finalBalances }
}

export function probabilityOfSuccess(finalBalances: number[], target: number): number {
  if (finalBalances.length === 0) return 0
  return finalBalances.filter((b) => b >= target).length / finalBalances.length
}
