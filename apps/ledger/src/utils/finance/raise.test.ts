import { nominalRaisePct, realRaisePct } from './raise'

describe('nominalRaisePct', () => {
  it('computes the percent change', () => {
    expect(nominalRaisePct(100_000, 105_000)).toBeCloseTo(5, 10)
    expect(nominalRaisePct(0, 50_000)).toBe(0) // guard: no old salary, no meaningful raise
  })
})

describe('realRaisePct', () => {
  it('applies the Fisher equation, not naive subtraction', () => {
    // (1.05 / 1.03) − 1 = 1.9417%
    expect(realRaisePct(5, 3)).toBeCloseTo(1.9417, 3)
  })

  it('is negative when inflation outpaces the raise', () => {
    expect(realRaisePct(2, 4)).toBeLessThan(0)
  })

  it('is zero when raise equals inflation', () => {
    expect(realRaisePct(3, 3)).toBeCloseTo(0, 10)
  })
})
