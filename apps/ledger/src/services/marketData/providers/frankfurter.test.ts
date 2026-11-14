import { fetchFxRate } from './frankfurter'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function mockFetchOnce(json: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(json),
  }) as unknown as typeof fetch
}

describe('fetchFxRate', () => {
  it('returns rate 1 without fetching when from === to', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
    const r = await fetchFxRate('CAD', 'CAD')
    expect(r.rate).toBe(1)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('reads the target rate from latest', async () => {
    mockFetchOnce({ amount: 1, base: 'USD', date: '2026-07-01', rates: { CAD: 1.36 } })
    const r = await fetchFxRate('USD', 'CAD')
    expect(r.rate).toBe(1.36)
    expect(r.from).toBe('USD')
    expect(r.to).toBe('CAD')
    expect(r.date).toBe('2026-07-01')
  })

  it('uses the dated endpoint and the effective date it returns', async () => {
    mockFetchOnce({ amount: 1, base: 'USD', date: '2026-01-02', rates: { CAD: 1.40 } })
    const r = await fetchFxRate('USD', 'CAD', '2026-01-03')
    expect(r.rate).toBe(1.40)
    expect(r.date).toBe('2026-01-02')
  })

  it('throws when the target currency is absent', async () => {
    mockFetchOnce({ amount: 1, base: 'USD', date: '2026-07-01', rates: {} })
    await expect(fetchFxRate('USD', 'CAD')).rejects.toThrow()
  })

  it('throws on a non-ok response', async () => {
    mockFetchOnce({}, false)
    await expect(fetchFxRate('USD', 'CAD')).rejects.toThrow()
  })

  it('calls the .dev v1 endpoint (the .app domain 301s without CORS headers)', async () => {
    mockFetchOnce({ amount: 1, base: 'USD', date: '2026-07-01', rates: { CAD: 1.36 } })
    await fetchFxRate('USD', 'CAD')
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.frankfurter.dev/v1/latest?from=USD&to=CAD', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})
