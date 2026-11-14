import { buildForecast } from './forecast'
import { coastFiNumber, fiNumber, monthsToReach } from './fire'

describe('fiNumber', () => {
  it('is annual spending over the withdrawal rate', () => {
    expect(fiNumber(40_000, 4)).toBe(1_000_000)
    expect(fiNumber(60_000, 3)).toBeCloseTo(2_000_000, 6)
  })
  it('returns Infinity for a zero rate', () => {
    expect(fiNumber(40_000, 0)).toBe(Infinity)
  })
})

describe('monthsToReach', () => {
  const points = buildForecast({
    startBalance: 0, monthlySavings: 1_000, annualReturnPct: 0,
    annualInflationPct: 0, contributionStepUpPct: 0, years: 3,
  })
  it('finds the first month at/above the target', () => {
    expect(monthsToReach(points, 12_000)).toBe(12)
    expect(monthsToReach(points, 0)).toBe(0)
  })
  it('returns null when never reached', () => {
    expect(monthsToReach(points, 1e9)).toBeNull()
  })
})

describe('coastFiNumber', () => {
  it('discounts FI back by the return rate', () => {
    // 1,000,000 at 7.0% (monthly compounding) over 10y ≈ /2.00966
    expect(coastFiNumber(1_000_000, 7, 10)).toBeCloseTo(1_000_000 / Math.pow(1 + 0.07 / 12, 120), 4)
  })
})
