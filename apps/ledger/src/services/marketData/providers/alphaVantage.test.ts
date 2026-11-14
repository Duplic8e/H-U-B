import { fetchAlphaVantageQuote, fetchAlphaVantageHistorical, toAlphaVantageSymbol, MissingApiKeyError } from './alphaVantage'
import { useMarketDataStore } from '../../../store/useMarketDataStore'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
  useMarketDataStore.getState().clearApiKey()
})

function mockFetchOnce(json: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(json),
  }) as unknown as typeof fetch
}

describe('toAlphaVantageSymbol', () => {
  it('appends .TRT for TSX exchange values', () => {
    expect(toAlphaVantageSymbol('SHOP', 'TSX')).toBe('SHOP.TRT')
    expect(toAlphaVantageSymbol('shop', 'tse')).toBe('SHOP.TRT')
  })
  it('appends .TRV for venture exchange values', () => {
    expect(toAlphaVantageSymbol('GPV', 'TSXV')).toBe('GPV.TRV')
  })
  it('passes through tickers that already have a suffix', () => {
    expect(toAlphaVantageSymbol('SHOP.TRT', 'TSX')).toBe('SHOP.TRT')
  })
  it('leaves US tickers bare', () => {
    expect(toAlphaVantageSymbol('AAPL')).toBe('AAPL')
    expect(toAlphaVantageSymbol('AAPL', 'NASDAQ')).toBe('AAPL')
  })
})

describe('fetchAlphaVantageQuote', () => {
  it('throws MissingApiKeyError when no key is set', async () => {
    await expect(fetchAlphaVantageQuote('AAPL')).rejects.toBeInstanceOf(MissingApiKeyError)
  })

  it('parses price and trading day; CAD for .TRT symbols', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({ 'Global Quote': { '01. symbol': 'SHOP.TRT', '05. price': '123.4500', '07. latest trading day': '2026-07-10' } })
    const q = await fetchAlphaVantageQuote('SHOP', 'TSX')
    expect(q.price).toBe(123.45)
    expect(q.currency).toBe('CAD')
    expect(q.asOf).toBe(new Date('2026-07-10T00:00:00Z').toISOString())
  })

  it('treats a rate-limit Note/Information body as an error', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({ Information: 'rate limit reached' })
    await expect(fetchAlphaVantageQuote('AAPL')).rejects.toThrow(/rate limit|missing/i)
  })

  it('throws on empty Global Quote (unknown symbol)', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({ 'Global Quote': {} })
    await expect(fetchAlphaVantageQuote('ZZZZ')).rejects.toThrow()
  })
})

describe('fetchAlphaVantageHistorical', () => {
  it('finds the close on/before the requested date', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({
      'Time Series (Daily)': {
        '2026-07-10': { '4. close': '101.00' },
        '2026-07-08': { '4. close': '99.50' },
      },
    })
    const h = await fetchAlphaVantageHistorical('AAPL', undefined, '2026-07-09')
    expect(h.close).toBe(99.5)
    expect(h.date).toBe('2026-07-09')
  })

  it('throws when no close exists on/before date', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({ 'Time Series (Daily)': { '2026-07-10': { '4. close': '101.00' } } })
    await expect(fetchAlphaVantageHistorical('AAPL', undefined, '2020-01-01')).rejects.toThrow()
  })
})
