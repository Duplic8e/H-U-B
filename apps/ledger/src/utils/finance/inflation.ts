// Time-value conversions for the Inflation Adjuster utility.

export function futureCost(amountToday: number, inflationPct: number, years: number): number {
  return amountToday * Math.pow(1 + inflationPct / 100, years)
}

export function presentValue(futureAmount: number, inflationPct: number, years: number): number {
  return futureAmount / Math.pow(1 + inflationPct / 100, years)
}

/** Percent change in what a dollar buys over the period (negative = loss). */
export function purchasingPowerChangePct(inflationPct: number, years: number): number {
  return (1 / Math.pow(1 + inflationPct / 100, years) - 1) * 100
}
