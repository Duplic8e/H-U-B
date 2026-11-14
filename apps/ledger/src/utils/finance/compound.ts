// Pure compound-interest math. Conventions: rates are PERCENT (7 = 7%),
// compounding is monthly, contributions are made at the END of each month.

export interface GrowthPoint {
  month: number
  balance: number
  /** Principal plus all contributions made so far. */
  contributed: number
  /** balance - contributed. */
  growth: number
}

export function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12
}

export function futureValue(
  principal: number,
  annualRatePct: number,
  months: number,
  monthlyContribution = 0,
): number {
  const r = monthlyRate(annualRatePct)
  if (r === 0) return principal + monthlyContribution * months
  const g = Math.pow(1 + r, months)
  return principal * g + monthlyContribution * ((g - 1) / r)
}

export function growthSeries(
  principal: number,
  annualRatePct: number,
  monthlyContribution: number,
  months: number,
): GrowthPoint[] {
  const r = monthlyRate(annualRatePct)
  const points: GrowthPoint[] = [
    { month: 0, balance: principal, contributed: principal, growth: 0 },
  ]
  let balance = principal
  let contributed = principal
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + r) + monthlyContribution
    contributed += monthlyContribution
    points.push({ month: m, balance, contributed, growth: balance - contributed })
  }
  return points
}
