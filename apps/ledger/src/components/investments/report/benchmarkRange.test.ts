import { describe, expect, it } from 'vitest'
import type { PABenchmarkPoint, PACumulativePoint } from '../../../utils/investments/ibkrPortfolioAnalyst'
import {
  availableRanges, benchmarkView, cumulativeGrowth, rangeStartMonth,
} from './benchmarkRange'

const monthly: PABenchmarkPoint[] = [
  { month: '202401', account: 10, benchmarks: { SPX: 5 } },
  { month: '202501', account: 10, benchmarks: { SPX: 5 } },
  { month: '202601', account: 10, benchmarks: { SPX: 5 } },
  { month: '202608', account: -50, benchmarks: { SPX: 0 } },
]

const cumulative: PACumulativePoint[] = [
  { date: '01/01/26', account: 0, benchmarks: { SPX: 0 } },
  { date: '08/26/26', account: 4.57, benchmarks: { SPX: 12.97 } },
]

describe('rangeStartMonth', () => {
  it('counts back inclusively, so 1Y over Aug 2026 is twelve months', () => {
    expect(rangeStartMonth('1y', '202608')).toBe('202509')
  })

  it('handles a January latest month without slipping a year', () => {
    expect(rangeStartMonth('1y', '202601')).toBe('202502')
    expect(rangeStartMonth('3y', '202601')).toBe('202302')
  })

  it('keeps everything for max', () => {
    expect(rangeStartMonth('max', '202608')).toBe('')
  })

  it('keeps everything when the latest month is not a valid YYYYMM', () => {
    expect(rangeStartMonth('1y', 'nonsense')).toBe('')
  })
})

describe('cumulativeGrowth', () => {
  it('converts cumulative percentages directly instead of compounding them', () => {
    // These values are already cumulative from the period start, so 4.57%
    // is 104.57, not 100 compounded by 4.57% twice.
    const { names, data } = cumulativeGrowth(cumulative)
    expect(names).toEqual(['Account', 'SPX'])
    expect(data[0].Account).toBe(100)
    expect(data[1].Account).toBe(104.57)
    expect(data[1].SPX).toBe(112.97)
  })

  it('returns nothing for an empty series', () => {
    expect(cumulativeGrowth([])).toEqual({ names: [], data: [] })
  })
})

describe('benchmarkView', () => {
  it('reads the cumulative section for the report period, and says it is daily', () => {
    const v = benchmarkView('period', cumulative, monthly)
    expect(v.daily).toBe(true)
    expect(v.data.map((d) => d.month)).toEqual(['01/01/26', '08/26/26'])
  })

  it('rebases a shorter range to 100 rather than clipping mid-line', () => {
    const v = benchmarkView('1y', cumulative, monthly)
    expect(v.daily).toBe(false)
    // Only 202601 and 202608 fall inside the last year.
    expect(v.data.map((d) => d.month)).toEqual(['202601', '202608'])
    // Rebased: the first point compounds from 100, not from its running value.
    expect(v.data[0].Account).toBe(110)
    expect(v.data[1].Account).toBe(55)
  })

  it('keeps the whole monthly series for max', () => {
    expect(benchmarkView('max', cumulative, monthly).data).toHaveLength(4)
  })

  it('returns nothing rather than throwing when there is no monthly data', () => {
    expect(benchmarkView('3y', cumulative, []).data).toEqual([])
  })
})

describe('availableRanges', () => {
  it('offers the period and max, plus only the windows the data actually covers', () => {
    // The series spans 202401 to 202608, so 3Y and 5Y would both just be max.
    expect(availableRanges(cumulative, monthly)).toEqual(['period', '1y', 'max'])
  })

  it('drops the report period when the cumulative section is missing', () => {
    expect(availableRanges([], monthly)).toEqual(['1y', 'max'])
  })

  it('offers nothing when the report carries no benchmark data at all', () => {
    expect(availableRanges([], [])).toEqual([])
  })
})
