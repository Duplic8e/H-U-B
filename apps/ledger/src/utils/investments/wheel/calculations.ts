import type { TickerState } from './types'

export function calculateBreakeven(d: TickerState): number {
  if (d.opSharesHeld > 0) {
    return (d.displayCost - d.premiumCollected - d.displayRealized) / d.opSharesHeld
  } else if (d.openPutContracts > 0) {
    const putShares = d.openPutContracts * 100
    const totalStrikeObligation = d.openPutStrikeSum * 100
    return (totalStrikeObligation - d.premiumCollected - d.displayRealized) / putShares
  }
  return NaN
}

export function calculateNetPL(d: TickerState, dynamicSpotPrice: number): number {
  if (d.opSharesHeld > 0) {
    const dynamicMarketValue = dynamicSpotPrice * d.opSharesHeld
    return dynamicMarketValue + d.premiumCollected + d.displayRealized - d.displayCost
  } else if (d.openPutContracts > 0) {
    // Options-only math: above breakeven the puts expire worthless and the
    // full premium is kept; below it, losses scale with the gap.
    const breakeven = calculateBreakeven(d)
    if (dynamicSpotPrice >= breakeven) {
      return d.premiumCollected
    }
    const putShares = d.openPutContracts * 100
    return d.premiumCollected - (breakeven - dynamicSpotPrice) * putShares
  }

  return d.marketValue + d.premiumCollected + d.displayRealized - d.displayCost
}

export function formatCurr(val: number): string {
  if (isNaN(val)) return 'N/A'
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** formatCurr in the ticker's own currency (`$` for USD, `₩` for KRW, `CA$` for
 *  CAD). Falls back to formatCurr when the currency is unknown or not a code
 *  Intl accepts. */
export function formatWheelMoney(val: number, currency?: string): string {
  if (isNaN(val)) return 'N/A'
  if (!currency) return formatCurr(val)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val)
  } catch {
    return formatCurr(val)
  }
}
