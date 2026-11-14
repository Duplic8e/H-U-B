// Tax haircut for auto-fed comp event lump sums (RSU, bonus, ESPP). Comp
// lumps stack on top of salary, so the marginal rate (not effective rate)
// is the right approximation. Manual life events are never taxed.

import { salaryMarginalRate, type Province } from './canadaTax'
import type { LumpSum } from './forecast'

export function applyLumpTax(lumps: LumpSum[], rate: number): LumpSum[] {
  if (rate <= 0) return lumps
  const r = Math.min(rate, 1)
  return lumps.map((l) => ({ ...l, amount: l.amount * (1 - r) }))
}

export interface CompTaxConfig {
  enabled: boolean
  auto: boolean
  manualPct: number
  income: number
  province: Province
}

/** Fraction (0..1) to withhold from comp lumps. */
export function resolveCompTaxRate(cfg: CompTaxConfig): number {
  if (!cfg.enabled) return 0
  if (cfg.auto) return salaryMarginalRate(cfg.income, cfg.province) / 100
  return Math.min(Math.max(cfg.manualPct, 0), 100) / 100
}
