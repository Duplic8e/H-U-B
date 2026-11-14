import { describe, it, expect } from 'vitest'
import { aprToApy, apyToApr, periodicRatePct, cagrPct, totalReturnPct } from './rates'

describe('rate conversions', () => {
  it('APR to APY with monthly compounding', () => {
    // 6% APR monthly: (1 + 0.06/12)^12 - 1 = 6.1678%
    expect(aprToApy(6, 12)).toBeCloseTo(6.1678, 3)
  })

  it('APY to APR inverts the conversion', () => {
    expect(apyToApr(aprToApy(6, 12), 12)).toBeCloseTo(6, 6)
  })

  it('annual compounding is identity', () => {
    expect(aprToApy(5, 1)).toBeCloseTo(5, 10)
  })

  it('periodic rate is APR / periods', () => {
    expect(periodicRatePct(6, 12)).toBeCloseTo(0.5, 10)
  })
})

describe('CAGR', () => {
  it('computes annualized return', () => {
    // 10000 -> 14000 in 3 years: (1.4)^(1/3) - 1 = 11.869%
    expect(cagrPct(10000, 14000, 3)).toBeCloseTo(11.869, 2)
  })

  it('handles losses', () => {
    expect(cagrPct(10000, 8000, 2)).toBeCloseTo(-10.557, 2)
  })

  it('returns null for invalid inputs', () => {
    expect(cagrPct(0, 14000, 3)).toBeNull()
    expect(cagrPct(10000, 14000, 0)).toBeNull()
  })

  it('total return pct', () => {
    expect(totalReturnPct(10000, 14000)).toBeCloseTo(40, 10)
    expect(totalReturnPct(0, 14000)).toBeNull()
  })
})
