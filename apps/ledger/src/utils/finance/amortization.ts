// Loan amortization math. Conventions: rates are PERCENT (6 = 6%), interest
// compounds monthly at annualRate/12 (consumer-loan convention; Canadian
// fixed mortgages legally use semi-annual compounding - difference is small
// and documented here as a simplification), payments at end of month.

export interface AmortizationPoint {
  month: number
  interestPaid: number
  principalPaid: number
  balance: number
}

export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12)
  if (n <= 0) return principal
  const r = annualRatePct / 100 / 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

/** Largest principal a given monthly payment can service - inverse of monthlyPayment. */
export function principalFromPayment(payment: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12)
  if (n <= 0) return 0
  const r = annualRatePct / 100 / 12
  if (r === 0) return payment * n
  return (payment * (1 - Math.pow(1 + r, -n))) / r
}

export function amortizationSchedule(
  principal: number,
  annualRatePct: number,
  years: number,
  extraMonthly = 0,
): AmortizationPoint[] {
  const r = annualRatePct / 100 / 12
  const basePayment = monthlyPayment(principal, annualRatePct, years)
  const points: AmortizationPoint[] = []
  let balance = principal
  const maxMonths = Math.round(years * 12) + 1 // extra guard month for rounding
  for (let m = 1; m <= maxMonths && balance > 1e-6; m++) {
    const interest = balance * r
    const principalPortion = Math.min(basePayment + extraMonthly - interest, balance)
    balance = Math.max(0, balance - principalPortion)
    points.push({ month: m, interestPaid: interest, principalPaid: principalPortion, balance })
  }
  return points
}

export function scheduleTotalInterest(schedule: Array<{ interestPaid: number }>): number {
  return schedule.reduce((sum, p) => sum + p.interestPaid, 0)
}

export interface ExtraPayment {
  id: string
  kind: 'recurring' | 'oneTime'
  amount: number // dollars per month (recurring) or total (oneTime)
  fromYear: number // 1-based year the extra starts (oneTime: the year it lands, applied in that year's first month)
  toYear: number // recurring only: last year inclusive; ignored for oneTime
}

/** Base schedule plus extra payments: recurring monthly extras active during
 *  [fromYear, toYear], and one-time lump sums applied in the first month of
 *  fromYear. Payments never exceed the remaining balance. */
export function amortizationScheduleWithExtras(
  principal: number,
  annualRatePct: number,
  years: number,
  extras: ExtraPayment[],
): AmortizationPoint[] {
  const r = annualRatePct / 100 / 12
  const basePayment = monthlyPayment(principal, annualRatePct, years)
  const points: AmortizationPoint[] = []
  let balance = principal
  const maxMonths = Math.round(years * 12) + 1
  for (let m = 1; m <= maxMonths && balance > 1e-6; m++) {
    const year = Math.ceil(m / 12)
    const recurring = extras
      .filter((e) => e.kind === 'recurring' && year >= e.fromYear && year <= e.toYear)
      .reduce((s, e) => s + Math.max(0, e.amount), 0)
    const lump = extras
      .filter((e) => e.kind === 'oneTime' && m === (e.fromYear - 1) * 12 + 1)
      .reduce((s, e) => s + Math.max(0, e.amount), 0)
    const interest = balance * r
    const principalPortion = Math.min(basePayment + recurring + lump - interest, balance)
    balance = Math.max(0, balance - principalPortion)
    points.push({ month: m, interestPaid: interest, principalPaid: principalPortion, balance })
  }
  return points
}

export interface BiweeklyPoint {
  period: number
  interestPaid: number
  principalPaid: number
  balance: number
}

/** Accelerated biweekly: pay monthlyPayment/2 every two weeks (26/yr - one
 *  extra monthly payment per year), interest accruing at annualRate/26 per
 *  period. This is the "biweekly" Canadian lenders offer; it retires the
 *  loan years early. */
export function acceleratedBiweeklySchedule(
  principal: number,
  annualRatePct: number,
  years: number,
): BiweeklyPoint[] {
  const payment = monthlyPayment(principal, annualRatePct, years) / 2
  const r = annualRatePct / 100 / 26
  const points: BiweeklyPoint[] = []
  let balance = principal
  const maxPeriods = Math.round(years * 26) + 2 // guard; accelerated always finishes early
  for (let p = 1; p <= maxPeriods && balance > 1e-6; p++) {
    const interest = balance * r
    const principalPortion = Math.min(payment - interest, balance)
    balance = Math.max(0, balance - principalPortion)
    points.push({ period: p, interestPaid: interest, principalPaid: principalPortion, balance })
  }
  return points
}
