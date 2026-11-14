import type { Category } from '../../types/budget'
import {
  annualTarget, cadenceOf, elapsedMonthsInYear, isAnnual, monthlyEquivalent, setAsideExpected,
} from './cadence'

const cat = (targetAmount: number, cadence?: 'monthly' | 'annual'): Category => ({
  id: 'c1', groupId: 'g1', name: 'Test', targetAmount, cadence,
})

describe('cadenceOf', () => {
  it('defaults to monthly when absent', () => {
    expect(cadenceOf(cat(100))).toBe('monthly')
  })

  it('respects an explicit cadence', () => {
    expect(cadenceOf(cat(100, 'annual'))).toBe('annual')
  })
})

describe('isAnnual', () => {
  it('is false for an untagged category', () => {
    expect(isAnnual(cat(100))).toBe(false)
  })

  it('is true for an annual category', () => {
    expect(isAnnual(cat(2400, 'annual'))).toBe(true)
  })
})

describe('monthlyEquivalent', () => {
  it('returns the target unchanged for monthly', () => {
    expect(monthlyEquivalent(cat(200))).toBe(200)
  })

  it('divides an annual target across twelve months', () => {
    expect(monthlyEquivalent(cat(2400, 'annual'))).toBe(200)
  })
})

describe('annualTarget', () => {
  it('multiplies a monthly target by twelve', () => {
    expect(annualTarget(cat(200))).toBe(2400)
  })

  it('returns an annual target unchanged', () => {
    expect(annualTarget(cat(2400, 'annual'))).toBe(2400)
  })
})

describe('elapsedMonthsInYear', () => {
  it('counts months through the current one', () => {
    expect(elapsedMonthsInYear(2026, new Date(2026, 3, 15))).toBe(4)
  })

  it('returns 12 for a past year', () => {
    expect(elapsedMonthsInYear(2025, new Date(2026, 3, 15))).toBe(12)
  })

  it('returns 0 for a future year', () => {
    expect(elapsedMonthsInYear(2027, new Date(2026, 3, 15))).toBe(0)
  })

  it('returns 1 in January and 12 in December', () => {
    expect(elapsedMonthsInYear(2026, new Date(2026, 0, 1))).toBe(1)
    expect(elapsedMonthsInYear(2026, new Date(2026, 11, 31))).toBe(12)
  })
})

describe('setAsideExpected', () => {
  it('prorates the annual target across elapsed months', () => {
    expect(setAsideExpected(2400, 4)).toBe(800)
  })

  it('is zero before the year starts', () => {
    expect(setAsideExpected(2400, 0)).toBe(0)
  })

  it('is the full target at year end', () => {
    expect(setAsideExpected(2400, 12)).toBe(2400)
  })
})
