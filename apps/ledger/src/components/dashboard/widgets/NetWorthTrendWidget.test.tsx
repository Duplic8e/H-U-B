import { describe, expect, it } from 'vitest'
import { trendDomain } from './trendDomain'

describe('trendDomain', () => {
  it('pads min and max by 8% of the range and never forces zero', () => {
    const [lo, hi] = trendDomain([100000, 110000])
    expect(lo).toBeCloseTo(99200) // 100000 - 800
    expect(hi).toBeCloseTo(110800)
    expect(lo).toBeGreaterThan(0)
  })

  it('handles a flat series with a value-relative pad', () => {
    const [lo, hi] = trendDomain([50000, 50000])
    expect(lo).toBeLessThan(50000)
    expect(hi).toBeGreaterThan(50000)
  })

  it('handles an all-zero series without collapsing', () => {
    const [lo, hi] = trendDomain([0, 0])
    expect(hi).toBeGreaterThan(lo)
  })
})
