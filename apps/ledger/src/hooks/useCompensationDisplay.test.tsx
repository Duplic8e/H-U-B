import { renderHook, waitFor, act } from '@testing-library/react'
import { useCompensationDisplay } from './useCompensationDisplay'
import { useCompensationStore } from '../store/useCompensationStore'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { __setProviders, __resetProviders } from '../services/marketData/marketDataService'
import { __resetMinInterval } from '../services/marketData/throttle'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
})
afterEach(() => __resetProviders())

describe('useCompensationDisplay', () => {
  it('falls back to the manual companyCurrentPrice when no live price is available and conversion is off', async () => {
    useCompensationStore.getState().setPrimaryPackage({ companyTicker: 'AAPL', companyCurrentPrice: 100 })
    __setProviders({
      fetchQuote: async () => { throw new Error('no data') },
      fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.5, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
    })
    const { result } = renderHook(() => useCompensationDisplay())
    await waitFor(() => expect(result.current.priceStatus).toBe('error'))
    // no live price resolved -> pkg falls back to the store's manual companyCurrentPrice
    expect(result.current.pkg.companyCurrentPrice).toBe(100)
  })

  it('applies the live price even when CAD conversion is off (live price is independent of the toggle)', async () => {
    useCompensationStore.getState().setPrimaryPackage({ companyTicker: 'AAPL', companyCurrentPrice: 100 })
    __setProviders({
      fetchQuote: async () => ({ ticker: 'AAPL', price: 150, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }),
      fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.5, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
    })
    const { result } = renderHook(() => useCompensationDisplay())
    await waitFor(() => expect(result.current.priceStatus).toBe('success'))
    // conversion disabled, but the live-resolved price should still be applied (no CAD conversion)
    expect(result.current.pkg.companyCurrentPrice).toBe(150)
  })

  it('converts companyCurrentPrice to CAD using the live FX rate when conversion is on', async () => {
    useCompensationStore.getState().setPrimaryPackage({ companyTicker: 'AAPL', companyCurrentPrice: 100 })
    useCompensationStore.getState().toggleCadConversion()
    __setProviders({
      fetchQuote: async () => ({ ticker: 'AAPL', price: 100, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }),
      fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.35, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
    })
    const { result } = renderHook(() => useCompensationDisplay())
    await waitFor(() => expect(result.current.fxStatus).toBe('success'))
    await waitFor(() => expect(result.current.priceStatus).toBe('success'))
    await waitFor(() => expect(result.current.pkg.companyCurrentPrice).toBeCloseTo(135, 5))
  })

  it('setManualPrice sets a manual override reflected in rawPrice', async () => {
    useCompensationStore.getState().setPrimaryPackage({ companyTicker: 'AAPL', companyCurrentPrice: 100 })
    __setProviders({
      fetchQuote: async () => ({ ticker: 'AAPL', price: 150, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }),
      fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.5, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
    })
    const { result } = renderHook(() => useCompensationDisplay())
    await waitFor(() => expect(result.current.priceStatus).toBe('success'))
    act(() => result.current.setManualPrice(250))
    await waitFor(() => expect(result.current.priceSource).toBe('override'))
    expect(result.current.rawPrice).toBe(250)
  })
})
