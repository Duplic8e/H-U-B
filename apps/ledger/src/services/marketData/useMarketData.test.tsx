import { beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCurrentPrice } from './useMarketData'
import { __setProviders, __resetProviders } from './marketDataService'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __resetMinInterval } from './throttle'

beforeEach(() => {
  localStorage.clear()
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
})
afterEach(() => __resetProviders())

describe('useCurrentPrice', () => {
  it('resolves a live price after mount', async () => {
    __setProviders({ fetchQuote: async () => ({ ticker: 'AAPL', exchange: 'NASDAQ', price: 199, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }) })
    const { result } = renderHook(() => useCurrentPrice('AAPL', 'NASDAQ'))
    await waitFor(() => expect(result.current.data?.value.price).toBe(199))
    expect(result.current.status).toBe('success')
  })

  it('setManual switches the source to override', async () => {
    __setProviders({ fetchQuote: async () => ({ ticker: 'AAPL', exchange: 'NASDAQ', price: 199, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }) })
    const { result } = renderHook(() => useCurrentPrice('AAPL', 'NASDAQ'))
    await waitFor(() => expect(result.current.data).toBeDefined())
    act(() => result.current.setManual(250))
    await waitFor(() => expect(result.current.data?.source).toBe('override'))
    expect(result.current.data?.value.price).toBe(250)
  })

  it('does not keep showing an override after clearing it when the live request fails', async () => {
    __setProviders({ fetchQuote: async () => { throw new Error('network down') } })
    useMarketDataStore.getState().setOverride('AAPL', 250)
    const { result } = renderHook(() => useCurrentPrice('AAPL'))
    await waitFor(() => expect(result.current.data?.source).toBe('override'))

    act(() => result.current.clearManual())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(useMarketDataStore.getState().getOverride('AAPL')).toBeUndefined()
    expect(result.current.data?.source).not.toBe('override')
  })

  it('stays idle for an empty ticker', () => {
    const { result } = renderHook(() => useCurrentPrice(''))
    expect(result.current.status).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('ends in an error state when the provider rejects with no cache and no override', async () => {
    __setProviders({ fetchQuote: async () => { throw new Error('network down') } })
    const { result } = renderHook(() => useCurrentPrice('AAPL', 'NASDAQ'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toBeUndefined()
  })

  it('reacts to an override set externally via the store (not through setManual)', async () => {
    __setProviders({ fetchQuote: async () => ({ ticker: 'AAPL', exchange: 'NASDAQ', price: 199, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }) })
    const { result } = renderHook(() => useCurrentPrice('AAPL', 'NASDAQ'))
    await waitFor(() => expect(result.current.data?.value.price).toBe(199))

    act(() => {
      useMarketDataStore.getState().setOverride('NASDAQ:AAPL', 321)
    })

    await waitFor(() => expect(result.current.data?.source).toBe('override'))
    expect(result.current.data?.value.price).toBe(321)
  })
})
