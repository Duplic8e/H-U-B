import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyWithCents, formatMoneyCompact } from './format'

describe('formatMoneyCompact', () => {
  it('formats sub-thousand values as plain dollars', () => {
    expect(formatMoneyCompact(0)).toBe('$0')
    expect(formatMoneyCompact(950)).toBe('$950')
  })
  it('formats thousands with k', () => {
    expect(formatMoneyCompact(12_000)).toBe('$12k')
    expect(formatMoneyCompact(500_000)).toBe('$500k')
    expect(formatMoneyCompact(1_499)).toBe('$1k')
  })
  it('formats millions with one decimal under 10M, whole above', () => {
    expect(formatMoneyCompact(1_200_000)).toBe('$1.2M')
    expect(formatMoneyCompact(3_000_000)).toBe('$3M')
    expect(formatMoneyCompact(12_000_000)).toBe('$12M')
  })
  it('is negative-safe', () => {
    expect(formatMoneyCompact(-1_200_000)).toBe('-$1.2M')
    expect(formatMoneyCompact(-500)).toBe('-$500')
  })
})

describe('formatMoney (existing, unchanged)', () => {
  it('still formats full dollars', () => {
    expect(formatMoney(1234567)).toBe('$1,234,567')
  })
})

describe('formatMoney (symmetric rounding)', () => {
  it('rounds a positive half-dollar tie up in magnitude', () => {
    expect(formatMoney(21.50)).toBe('$22')
  })
  it('rounds a negative half-dollar tie up in magnitude, not toward +Infinity', () => {
    expect(formatMoney(-21.50)).toBe('-$22')
  })
  it('rounds a small positive half tie up in magnitude', () => {
    expect(formatMoney(0.5)).toBe('$1')
  })
  it('rounds a small negative half tie up in magnitude', () => {
    expect(formatMoney(-0.5)).toBe('-$1')
  })
  it('renders a value that rounds to zero as $0, never -$0', () => {
    expect(formatMoney(-0.4)).toBe('$0')
  })
})

it('formats money with cents for exact transaction effects', () => {
  expect(formatMoneyWithCents(40)).toBe('$40.00')
  expect(formatMoneyWithCents(0.01)).toBe('$0.01')
  expect(formatMoneyWithCents(1234.567)).toBe('$1,234.57')
  expect(formatMoneyWithCents(-0.01)).toBe('-$0.01')
})
