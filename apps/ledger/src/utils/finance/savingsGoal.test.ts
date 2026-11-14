import { futureValue } from './compound'
import {
  solveAnnualRate,
  solveMonthlyContribution,
  solveMonths,
  solveTarget,
} from './savingsGoal'

describe('solveTarget', () => {
  it('is futureValue by another name', () => {
    expect(solveTarget(1000, 12, 100, 12)).toBeCloseTo(futureValue(1000, 12, 12, 100), 10)
  })
})

describe('solveMonthlyContribution', () => {
  it('round-trips through futureValue', () => {
    const c = solveMonthlyContribution(100000, 10000, 5, 120)
    expect(c).not.toBeNull()
    expect(futureValue(10000, 5, 120, c as number)).toBeCloseTo(100000, 4)
  })

  it('handles zero rate with simple division', () => {
    expect(solveMonthlyContribution(2200, 1000, 0, 12)).toBeCloseTo(100, 10)
  })

  it('returns 0 when the goal is already met by growth alone', () => {
    expect(solveMonthlyContribution(1000, 10000, 5, 12)).toBe(0)
  })

  it('returns null for a non-positive horizon', () => {
    expect(solveMonthlyContribution(100000, 0, 5, 0)).toBeNull()
  })
})

describe('solveMonths', () => {
  it('returns 0 when principal already covers the target', () => {
    expect(solveMonths(1000, 1000, 5, 0)).toBe(0)
  })

  it('finds the first month the balance reaches the target', () => {
    const m = solveMonths(2200, 1000, 0, 100)
    expect(m).toBe(12)
  })

  it('reached month is consistent with futureValue', () => {
    const m = solveMonths(50000, 10000, 7, 300) as number
    expect(futureValue(10000, 7, m, 300)).toBeGreaterThanOrEqual(50000)
    expect(futureValue(10000, 7, m - 1, 300)).toBeLessThan(50000)
  })

  it('returns null when unreachable within maxMonths', () => {
    expect(solveMonths(1e12, 0, 0, 1)).toBeNull()
  })
})

describe('solveAnnualRate', () => {
  it('round-trips through futureValue', () => {
    const r = solveAnnualRate(100000, 10000, 300, 120)
    expect(r).not.toBeNull()
    expect(futureValue(10000, r as number, 120, 300)).toBeCloseTo(100000, 1)
  })

  it('returns 0 when contributions alone reach the goal', () => {
    expect(solveAnnualRate(2200, 1000, 100, 12)).toBe(0)
  })

  it('returns null when even 100% annual return cannot reach the goal', () => {
    expect(solveAnnualRate(1e15, 100, 0, 12)).toBeNull()
  })
})
