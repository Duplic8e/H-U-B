import { describe, expect, it } from 'vitest'
import { calculateBreakeven, calculateNetPL, formatCurr } from './calculations'
import type { TickerState } from './types'

const base: TickerState = {
  ticker: 'AAPL',
  opSharesHeld: 0,
  displayCost: 0,
  displayRealized: 0,
  currentPrice: 0,
  marketValue: 0,
  openPutContracts: 0,
  openPutStrikeSum: 0,
  premiumCollected: 0,
  hasOpenPosition: false,
  history: [],
}

describe('wheel calculations', () => {
  it('computes breakeven and net P/L for a stock wheel', () => {
    const d: TickerState = { ...base, opSharesHeld: 100, displayCost: 15001, premiumCollected: 248.95 }
    expect(calculateBreakeven(d)).toBeCloseTo(147.5205, 4)
    // spot 155: 15500 + 248.95 + 0 - 15001
    expect(calculateNetPL(d, 155)).toBeCloseTo(747.95, 2)
  })

  it('options-only: keeps full premium at/above breakeven, loses below it', () => {
    const d: TickerState = { ...base, openPutContracts: 2, openPutStrikeSum: 300, premiumCollected: 500, hasOpenPosition: true }
    // breakeven = (300*100 - 500 - 0) / 200 = 147.5
    expect(calculateBreakeven(d)).toBeCloseTo(147.5, 4)
    expect(calculateNetPL(d, 150)).toBe(500)
    // at 140: 500 - (147.5 - 140) * 200
    expect(calculateNetPL(d, 140)).toBeCloseTo(-1000, 2)
  })

  it('breakeven is NaN with no shares and no open puts', () => {
    expect(Number.isNaN(calculateBreakeven(base))).toBe(true)
  })

  it('formats currency with two decimals and N/A for NaN', () => {
    expect(formatCurr(1234.5)).toBe('$1,234.50')
    expect(formatCurr(NaN)).toBe('N/A')
  })
})
