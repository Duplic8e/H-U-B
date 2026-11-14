import { fetchErApiFxRate, ER_API_BASE } from './erApi'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function mockFetchOnce(json: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(json),
  }) as unknown as typeof fetch
}

describe('fetchErApiFxRate', () => {
  it('fetches latest rates for the base currency and picks the target', async () => {
    mockFetchOnce({ result: 'success', base_code: 'USD', rates: { BDT: 117.5 } })
    const fx = await fetchErApiFxRate('USD', 'BDT')
    expect(globalThis.fetch).toHaveBeenCalledWith(`${ER_API_BASE}/latest/USD`, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(fx.rate).toBe(117.5)
    expect(fx.from).toBe('USD')
    expect(fx.to).toBe('BDT')
  })

  it('throws when the response is not success or the rate is missing', async () => {
    mockFetchOnce({ result: 'error' })
    await expect(fetchErApiFxRate('USD', 'BDT')).rejects.toThrow()
    mockFetchOnce({ result: 'success', rates: {} })
    await expect(fetchErApiFxRate('USD', 'BDT')).rejects.toThrow('missing target rate')
  })

  it('short-circuits identical currencies with rate 1 and no fetch', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
    const fx = await fetchErApiFxRate('BDT', 'BDT')
    expect(fx.rate).toBe(1)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
