import { quoteKey, historicalKey, fxKey } from './cacheKey'

describe('cache keys', () => {
  it('quoteKey uppercases and includes exchange when present', () => {
    expect(quoteKey('aapl', 'nasdaq')).toBe('NASDAQ:AAPL')
    expect(quoteKey(' msft ')).toBe('MSFT')
  })

  it('historicalKey appends the date', () => {
    expect(historicalKey('aapl', 'nasdaq', '2026-01-02')).toBe('NASDAQ:AAPL@2026-01-02')
  })

  it('fxKey builds a directional dated key', () => {
    expect(fxKey('usd', 'cad', '2026-01-02')).toBe('USD-CAD@2026-01-02')
  })
})
