// FIRE arithmetic. FI number = annual spending / withdrawal rate. Coast-FI =
// the balance that reaches FI with no further contributions (monthly
// compounding, consistent with ./forecast.ts and ./compound.ts).

import type { ForecastPoint } from './forecast'

export function fiNumber(annualSpending: number, withdrawalRatePct: number): number {
  if (withdrawalRatePct <= 0) return Infinity
  return annualSpending / (withdrawalRatePct / 100)
}

export function monthsToReach(
  points: ForecastPoint[],
  target: number,
  key: 'base' | 'real' = 'base',
): number | null {
  for (const p of points) {
    if (p[key] >= target) return p.month
  }
  return null
}

export function coastFiNumber(fi: number, annualReturnPct: number, yearsRemaining: number): number {
  const months = Math.round(yearsRemaining * 12)
  return fi / Math.pow(1 + annualReturnPct / 100 / 12, months)
}
