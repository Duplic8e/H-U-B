// Rate-format conversions for the Rate & Return Converter utility.

export function aprToApy(aprPct: number, periodsPerYear: number): number {
  return (Math.pow(1 + aprPct / 100 / periodsPerYear, periodsPerYear) - 1) * 100
}

export function apyToApr(apyPct: number, periodsPerYear: number): number {
  return (Math.pow(1 + apyPct / 100, 1 / periodsPerYear) - 1) * periodsPerYear * 100
}

/** The rate applied each compounding period, in percent. */
export function periodicRatePct(aprPct: number, periodsPerYear: number): number {
  return aprPct / periodsPerYear
}

/** Annualized return; null when inputs can't produce one (start <= 0 or years <= 0). */
export function cagrPct(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || endValue < 0 || years <= 0) return null
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
}

export function totalReturnPct(startValue: number, endValue: number): number | null {
  if (startValue <= 0) return null
  return ((endValue - startValue) / startValue) * 100
}
