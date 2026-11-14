import { beforeEach } from 'vitest'
import { useMarketDataStore } from './useMarketDataStore'
import { quoteKey } from '../services/marketData/cacheKey'

beforeEach(() => {
  localStorage.clear()
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
})

describe('useMarketDataStore', () => {
  it('stores and retrieves a quote by ticker/exchange', () => {
    const s = useMarketDataStore.getState()
    s.setQuote({ ticker: 'AAPL', exchange: 'NASDAQ', price: 100, currency: 'USD', asOf: '2026-07-01T00:00:00Z' })
    const cached = useMarketDataStore.getState().getQuote('aapl', 'nasdaq')
    expect(cached?.value.price).toBe(100)
    expect(typeof cached?.fetchedAt).toBe('string')
  })

  it('stores and retrieves an fx rate by directional dated key', () => {
    const s = useMarketDataStore.getState()
    s.setFx({ from: 'USD', to: 'CAD', rate: 1.35, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' })
    const cached = useMarketDataStore.getState().getFx('USD', 'CAD', '2026-07-01')
    expect(cached?.value.rate).toBe(1.35)
  })

  it('stores and clears a manual override', () => {
    const key = quoteKey('AAPL', 'NASDAQ')
    useMarketDataStore.getState().setOverride(key, 250)
    expect(useMarketDataStore.getState().getOverride(key)).toBe(250)
    useMarketDataStore.getState().clearOverride(key)
    expect(useMarketDataStore.getState().getOverride(key)).toBeUndefined()
  })

  it('persists to the ledger-market-data LocalStorage key', () => {
    useMarketDataStore.getState().setQuote({ ticker: 'MSFT', price: 1, currency: 'USD', asOf: '2026-07-01T00:00:00Z' })
    expect(localStorage.getItem('ledger-market-data')).not.toBeNull()
  })
})

describe('useMarketDataStore api key', () => {
  afterEach(() => {
    useMarketDataStore.getState().clearApiKey()
  })

  it('starts with no key', () => {
    expect(useMarketDataStore.getState().apiKey).toBeUndefined()
  })

  it('stores and clears a trimmed key', () => {
    useMarketDataStore.getState().setApiKey('  ABC123  ')
    expect(useMarketDataStore.getState().apiKey).toBe('ABC123')
    useMarketDataStore.getState().clearApiKey()
    expect(useMarketDataStore.getState().apiKey).toBeUndefined()
  })
})
