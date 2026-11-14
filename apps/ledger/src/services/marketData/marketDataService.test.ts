import { beforeEach, afterEach } from 'vitest'
import {
  getCurrentPrice, getFxRate, getHistoricalPrice,
  __setProviders, __resetProviders,
} from './marketDataService'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __resetMinInterval } from './throttle'
import { quoteKey } from './cacheKey'

beforeEach(() => {
  localStorage.clear()
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
})
afterEach(() => __resetProviders())

const quote = { ticker: 'AAPL', exchange: 'NASDAQ', price: 100, currency: 'USD' as const, asOf: '2026-07-01T00:00:00Z' }

describe('getCurrentPrice', () => {
  it('fetches live, caches, and reports source=live', async () => {
    __setProviders({ fetchQuote: async () => quote })
    const r = await getCurrentPrice('AAPL', 'NASDAQ')
    expect(r.value.price).toBe(100)
    expect(r.source).toBe('live')
    expect(useMarketDataStore.getState().getQuote('AAPL', 'NASDAQ')?.value.price).toBe(100)
  })

  it('prefers a manual override without fetching', async () => {
    let called = false
    __setProviders({ fetchQuote: async () => { called = true; return quote } })
    useMarketDataStore.getState().setOverride(quoteKey('AAPL', 'NASDAQ'), 250)
    const r = await getCurrentPrice('AAPL', 'NASDAQ')
    expect(r.value.price).toBe(250)
    expect(r.source).toBe('override')
    expect(called).toBe(false)
  })

  it('falls back to cache when the live fetch fails', async () => {
    useMarketDataStore.getState().setQuote(quote)
    __setProviders({ fetchQuote: async () => { throw new Error('network down') } })
    const r = await getCurrentPrice('AAPL', 'NASDAQ', { force: true })
    expect(r.value.price).toBe(100)
    expect(r.source).toBe('cache')
    expect(r.status).toBe('error')
  })

  it('throws only when there is no override, no live value, and no cache', async () => {
    __setProviders({ fetchQuote: async () => { throw new Error('network down') } })
    await expect(getCurrentPrice('ZZZ', undefined, { force: true })).rejects.toThrow('No market data available')
  })

  it('returns the cached quote without fetching when it was fetched 1 hour ago', async () => {
    const fetchQuote = vi.fn()
    __setProviders({ fetchQuote })
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString()
    useMarketDataStore.setState({
      quotes: {
        AAPL: {
          value: { ticker: 'AAPL', price: 100, currency: 'USD', asOf: oneHourAgo },
          fetchedAt: oneHourAgo,
        },
      },
    })
    const r = await getCurrentPrice('AAPL')
    expect(fetchQuote).not.toHaveBeenCalled()
    expect(r.source).toBe('cache')
    expect(r.status).toBe('success')
    expect(r.stale).toBe(false)
  })

  it('re-fetches a quote cached yesterday', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    const fetchQuote = vi.fn().mockResolvedValue({ ticker: 'AAPL', price: 101, currency: 'USD', asOf: new Date().toISOString() })
    __setProviders({ fetchQuote })
    useMarketDataStore.setState({
      quotes: {
        AAPL: { value: { ticker: 'AAPL', price: 100, currency: 'USD', asOf: yesterday }, fetchedAt: yesterday },
      },
    })
    const r = await getCurrentPrice('AAPL', undefined, { force: true })
    expect(fetchQuote).toHaveBeenCalled()
    expect(r.value.price).toBe(101)
  })

  it('re-fetches a quote cached 5 hours ago without needing force', async () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60_000).toISOString()
    const fetchQuote = vi.fn().mockResolvedValue({ ticker: 'AAPL', price: 102, currency: 'USD', asOf: new Date().toISOString() })
    __setProviders({ fetchQuote })
    useMarketDataStore.setState({
      quotes: {
        AAPL: { value: { ticker: 'AAPL', price: 100, currency: 'USD', asOf: fiveHoursAgo }, fetchedAt: fiveHoursAgo },
      },
    })
    const r = await getCurrentPrice('AAPL')
    expect(fetchQuote).toHaveBeenCalled()
    expect(r.source).toBe('live')
    expect(r.value.price).toBe(102)
  })
})

describe('getFxRate', () => {
  it('returns 1 for same-currency without touching providers', async () => {
    __setProviders({ fetchFxRate: async () => { throw new Error('should not be called') } })
    const r = await getFxRate('CAD', 'CAD')
    expect(r.value.rate).toBe(1)
  })

  it('fetches and caches a USD->CAD rate', async () => {
    __setProviders({ fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.36, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }) })
    const r = await getFxRate('USD', 'CAD')
    expect(r.value.rate).toBe(1.36)
    expect(r.source).toBe('live')
  })
})

describe('getFxRate fallback', () => {
  const yesterdayRate = {
    from: 'USD' as const, to: 'CAD' as const, rate: 1.37,
    date: '2026-07-17', asOf: '2026-07-17T20:00:00Z',
  }

  it('falls back to the newest prior-day cached rate when the fetch fails', async () => {
    useMarketDataStore.getState().setFx(yesterdayRate)
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    const r = await getFxRate('USD', 'CAD')
    expect(r.value.rate).toBe(1.37)
    expect(r.value.date).toBe('2026-07-17')
    expect(r.stale).toBe(true)
    expect(r.status).toBe('error')
  })

  it('falls back to a prior-day manual override when no cache exists', async () => {
    useMarketDataStore.getState().setOverride('USD-CAD@2026-07-16', 1.4)
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    const r = await getFxRate('USD', 'CAD')
    expect(r.value.rate).toBe(1.4)
    expect(r.source).toBe('override')
    expect(r.stale).toBe(true)
  })

  it('prefers the newer entry when both cache and override exist', async () => {
    useMarketDataStore.getState().setOverride('USD-CAD@2026-07-10', 1.5)
    useMarketDataStore.getState().setFx(yesterdayRate)
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    const r = await getFxRate('USD', 'CAD')
    expect(r.value.rate).toBe(1.37)
  })

  it('does not fall back across dates for explicit historical requests', async () => {
    useMarketDataStore.getState().setFx(yesterdayRate)
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    await expect(getFxRate('USD', 'CAD', '2026-01-05')).rejects.toThrow('No market data available')
  })

  it('still throws when the pair has never been seen', async () => {
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    await expect(getFxRate('USD', 'CAD')).rejects.toThrow('No market data available')
  })
})

describe('getHistoricalPrice', () => {
  it('returns cache when present without refetching in-window', async () => {
    __setProviders({
      fetchHistorical: async () => ({ ticker: 'AAPL', exchange: undefined, date: '2026-01-02', close: 42, currency: 'USD' as const, asOf: '2026-01-02T00:00:00Z' }),
    })
    const first = await getHistoricalPrice('AAPL', undefined, '2026-01-02')
    expect(first.value.close).toBe(42)
    expect(first.source).toBe('live')
    // second call is throttled → served from cache
    const second = await getHistoricalPrice('AAPL', undefined, '2026-01-02')
    expect(second.source).toBe('cache')
  })
})
