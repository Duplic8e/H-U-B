import { describe, it, expect } from 'vitest'
import { futureCost, presentValue, purchasingPowerChangePct } from './inflation'

describe('inflation math', () => {
  it('futureCost compounds forward', () => {
    // $100 at 2.5% for 10 years = 100 * 1.025^10 = 128.0085...
    expect(futureCost(100, 2.5, 10)).toBeCloseTo(128.01, 2)
  })

  it('presentValue discounts back', () => {
    expect(presentValue(128.01, 2.5, 10)).toBeCloseTo(100, 2)
  })

  it('round-trips', () => {
    expect(presentValue(futureCost(5000, 3, 25), 3, 25)).toBeCloseTo(5000, 6)
  })

  it('zero years / zero inflation are identity', () => {
    expect(futureCost(100, 2.5, 0)).toBe(100)
    expect(futureCost(100, 0, 10)).toBe(100)
  })

  it('purchasing power change is negative under inflation', () => {
    // 1/1.025^10 - 1 = -21.88%
    expect(purchasingPowerChangePct(2.5, 10)).toBeCloseTo(-21.88, 2)
  })
})
