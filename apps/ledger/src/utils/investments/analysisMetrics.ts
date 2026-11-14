// Pure derivations for the investment decision journal. All lot amounts are
// in the position's own currency; FX is out of scope for 5a (5b handles it).

import type { BuyLot } from '../../store/useAnalysisStore'

export function sharesFromLots(lots: BuyLot[]): number {
  return lots.reduce((s, l) => s + (l.price > 0 ? l.amountInvested / l.price : 0), 0)
}

export function totalInvested(lots: BuyLot[]): number {
  return lots.reduce((s, l) => s + l.amountInvested, 0)
}

export function avgCostBasis(lots: BuyLot[]): number | null {
  const shares = sharesFromLots(lots)
  return shares > 0 ? totalInvested(lots) / shares : null
}

export function currentValue(lots: BuyLot[], currentPrice: number): number {
  return sharesFromLots(lots) * currentPrice
}

export function plDollars(lots: BuyLot[], currentPrice: number): number {
  return currentValue(lots, currentPrice) - totalInvested(lots)
}

export function plPct(lots: BuyLot[], currentPrice: number): number | null {
  const invested = totalInvested(lots)
  return invested > 0 ? (plDollars(lots, currentPrice) / invested) * 100 : null
}

export function thesisChangePct(startPrice: number, currentPrice: number): number | null {
  return startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : null
}

export function counterfactualValue(
  plannedAmount: number,
  startPrice: number,
  currentPrice: number,
): number {
  return startPrice > 0 ? (plannedAmount / startPrice) * currentPrice : plannedAmount
}

export function variance(plannedAmount: number, lots: BuyLot[]): number {
  return totalInvested(lots) - plannedAmount
}

export function allocationPct(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null
}
