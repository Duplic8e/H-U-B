import { describe, expect, it } from 'vitest'
import {
  inRange, isSingleMonth, monthKeysInRange, monthKeyOf, monthsInRange, rangeOf, shiftMonthKey,
} from './period'

const now = new Date(2026, 6, 18) // 2026-07-18

describe('period helpers', () => {
  it('monthKeyOf and shiftMonthKey handle year boundaries', () => {
    expect(monthKeyOf(now)).toBe('2026-07')
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2025-12', 1)).toBe('2026-01')
  })

  it('rangeOf month mode is that single month', () => {
    expect(rangeOf({ kind: 'month', month: '2026-07' }, now)).toEqual({ from: '2026-07', to: '2026-07' })
  })

  it('rangeOf presets end at the current month', () => {
    expect(rangeOf({ kind: 'preset', preset: 'last3' }, now)).toEqual({ from: '2026-05', to: '2026-07' })
    expect(rangeOf({ kind: 'preset', preset: 'last12' }, now)).toEqual({ from: '2025-08', to: '2026-07' })
    expect(rangeOf({ kind: 'preset', preset: 'ytd' }, now)).toEqual({ from: '2026-01', to: '2026-07' })
  })

  it('inRange compares by month prefix', () => {
    const r = { from: '2026-05', to: '2026-07' }
    expect(inRange('2026-05-01', r)).toBe(true)
    expect(inRange('2026-07-31', r)).toBe(true)
    expect(inRange('2026-04-30', r)).toBe(false)
    expect(inRange('2026-08-01', r)).toBe(false)
  })

  it('monthKeysInRange and monthsInRange enumerate inclusively', () => {
    const r = { from: '2025-11', to: '2026-02' }
    expect(monthKeysInRange(r)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthsInRange(r)).toBe(4)
    expect(isSingleMonth(r)).toBe(false)
    expect(isSingleMonth({ from: '2026-07', to: '2026-07' })).toBe(true)
  })
})
