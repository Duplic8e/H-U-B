import { renderHook, waitFor } from '@testing-library/react'
import { useFxRates, ratesKey } from './useFxRates'
import { __resetProviders, __setProviders } from '../services/marketData/marketDataService'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { __resetMinInterval } from '../services/marketData/throttle'

const fx = (from: string, to: string, rate: number) => ({
  from, to, rate, date: '2026-07-21', asOf: '2026-07-21T00:00:00.000Z',
})

describe('ratesKey', () => {
  it('is order independent', () => {
    expect(ratesKey(['USD', 'EUR'])).toBe(ratesKey(['EUR', 'USD']))
  })

  it('drops nulls and collapses duplicates', () => {
    expect(ratesKey(['USD', null, 'USD'])).toBe('USD')
  })

  it('is empty for an empty list', () => {
    expect(ratesKey([])).toBe('')
  })

  it('does not special-case CAD out of the key', () => {
    expect(ratesKey(['CAD'])).toBe('CAD')
  })
})

describe('useFxRates', () => {
  beforeEach(() => {
    useMarketDataStore.setState({ quotes: {}, fx: {}, historical: {}, overrides: {} })
    __resetMinInterval()
    __setProviders({
      fetchFxRate: async (from, to) => {
        if (from === 'GBP') throw new Error('no rate')
        return fx(from, to, from === 'USD' ? 1.37 : 1.47) as never
      },
    })
  })

  afterEach(() => {
    __resetProviders()
  })

  it('resolves a rate for each requested currency', async () => {
    const { result } = renderHook(() => useFxRates(['USD', 'EUR']))
    await waitFor(() => expect(result.current.rates.USD).toBeCloseTo(1.37, 5))
    expect(result.current.rates.EUR).toBeCloseTo(1.47, 5)
    expect(result.current.status).toBe('success')
  })

  it('needs no fetch for CAD', async () => {
    const { result } = renderHook(() => useFxRates(['CAD']))
    await waitFor(() => expect(result.current.rates.CAD).toBe(1))
  })

  it('ignores nulls and duplicates', async () => {
    const { result } = renderHook(() => useFxRates(['USD', null, 'USD']))
    await waitFor(() => expect(result.current.rates.USD).toBeCloseTo(1.37, 5))
    expect(result.current.missing).toEqual([])
  })

  it('reports a currency it could not resolve', async () => {
    const { result } = renderHook(() => useFxRates(['USD', 'GBP']))
    await waitFor(() => expect(result.current.rates.USD).toBeCloseTo(1.37, 5))
    expect(result.current.missing).toEqual(['GBP'])
  })

  it('reports the source of a resolved currency', async () => {
    const { result } = renderHook(() => useFxRates(['USD']))
    await waitFor(() => expect(result.current.rates.USD).toBeCloseTo(1.37, 5))
    expect(result.current.sources.USD).toBe('live')
  })

  it('is idle for an empty list', async () => {
    const { result } = renderHook(() => useFxRates([]))
    await waitFor(() => expect(result.current.status).toBe('idle'))
    expect(result.current.rates).toEqual({})
  })

  // This does NOT pin down key-normalization by itself: the market-data
  // service's own FX cache means a genuine refetch on the second render
  // would also leave `calls` unchanged (the provider call is skipped either
  // way once the pair is cached). That guarantee is covered directly by the
  // `ratesKey` unit tests above. This test only confirms the hook keeps
  // working, without error or a stuck status, when callers pass a fresh
  // array of unchanged content on every render, which is the realistic
  // calling pattern this hook needs to tolerate.
  it('resolves without error when the caller passes a new array each render', async () => {
    const calls: string[] = []
    __setProviders({
      fetchFxRate: async (from, to) => {
        calls.push(from)
        return fx(from, to, 1.37) as never
      },
    })
    const { result, rerender } = renderHook(({ list }) => useFxRates(list), {
      initialProps: { list: ['USD'] as ('USD' | null)[] },
    })
    await waitFor(() => expect(result.current.rates.USD).toBeCloseTo(1.37, 5))
    const before = calls.length
    rerender({ list: ['USD'] })
    await waitFor(() => expect(result.current.rates.USD).toBeCloseTo(1.37, 5))
    expect(calls.length).toBe(before)
  })
})
