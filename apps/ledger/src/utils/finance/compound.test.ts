import { futureValue, growthSeries, monthlyRate } from './compound'

describe('monthlyRate', () => {
  it('converts annual percent to monthly decimal', () => {
    expect(monthlyRate(12)).toBeCloseTo(0.01, 10)
    expect(monthlyRate(0)).toBe(0)
  })
})

describe('futureValue', () => {
  it('compounds a lump sum monthly: 1000 at 12% for 12 months', () => {
    // 1000 * 1.01^12
    expect(futureValue(1000, 12, 12)).toBeCloseTo(1126.83, 2)
  })

  it('grows an annuity: 100/month at 12% for 12 months', () => {
    // 100 * ((1.01^12 - 1) / 0.01)
    expect(futureValue(0, 12, 12, 100)).toBeCloseTo(1268.25, 2)
  })

  it('handles zero rate as simple accumulation', () => {
    expect(futureValue(1000, 0, 12, 100)).toBe(2200)
  })

  it('returns principal for zero months', () => {
    expect(futureValue(1000, 7, 0, 100)).toBe(1000)
  })
})

describe('growthSeries', () => {
  it('starts at month 0 with principal and zero growth', () => {
    const s = growthSeries(1000, 7, 100, 24)
    expect(s[0]).toEqual({ month: 0, balance: 1000, contributed: 1000, growth: 0 })
    expect(s).toHaveLength(25)
  })

  it('final balance agrees with futureValue', () => {
    const s = growthSeries(1000, 7, 100, 24)
    expect(s[24].balance).toBeCloseTo(futureValue(1000, 7, 24, 100), 6)
  })

  it('tracks contributed and growth consistently', () => {
    const s = growthSeries(1000, 7, 100, 24)
    const last = s[24]
    expect(last.contributed).toBe(1000 + 100 * 24)
    expect(last.growth).toBeCloseTo(last.balance - last.contributed, 10)
  })
})
