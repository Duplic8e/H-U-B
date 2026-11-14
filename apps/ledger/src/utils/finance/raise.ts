// "Is my raise a real raise?" - nominal vs inflation-adjusted (Fisher) raise.
// All rates are PERCENT in and out.

export function nominalRaisePct(oldSalary: number, newSalary: number): number {
  if (oldSalary <= 0) return 0
  return ((newSalary - oldSalary) / oldSalary) * 100
}

export function realRaisePct(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100
}
