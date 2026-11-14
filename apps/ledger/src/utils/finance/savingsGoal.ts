// Savings-goal solvers: given three of {target, contribution, time, rate},
// solve for the fourth. Rates are PERCENT, time is in months, monthly
// compounding with end-of-month contributions (see ./compound.ts).
// A null return means the goal is unreachable with the given inputs.

import { futureValue, monthlyRate } from './compound'

export function solveTarget(
  principal: number,
  annualRatePct: number,
  monthlyContribution: number,
  months: number,
): number {
  return futureValue(principal, annualRatePct, months, monthlyContribution)
}

export function solveMonthlyContribution(
  target: number,
  principal: number,
  annualRatePct: number,
  months: number,
): number | null {
  if (months <= 0) return null
  const r = monthlyRate(annualRatePct)
  if (r === 0) return Math.max(0, (target - principal) / months)
  const g = Math.pow(1 + r, months)
  const needed = ((target - principal * g) * r) / (g - 1)
  return Math.max(0, needed)
}

export function solveMonths(
  target: number,
  principal: number,
  annualRatePct: number,
  monthlyContribution: number,
  maxMonths = 1200,
): number | null {
  if (principal >= target) return 0
  const r = monthlyRate(annualRatePct)
  let balance = principal
  for (let m = 1; m <= maxMonths; m++) {
    balance = balance * (1 + r) + monthlyContribution
    if (balance >= target) return m
  }
  return null
}

export function solveAnnualRate(
  target: number,
  principal: number,
  monthlyContribution: number,
  months: number,
): number | null {
  if (months <= 0) return null
  if (futureValue(principal, 0, months, monthlyContribution) >= target) return 0
  const MAX_RATE = 100
  if (futureValue(principal, MAX_RATE, months, monthlyContribution) < target) return null
  let lo = 0
  let hi = MAX_RATE
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (futureValue(principal, mid, months, monthlyContribution) < target) lo = mid
    else hi = mid
  }
  return hi
}
