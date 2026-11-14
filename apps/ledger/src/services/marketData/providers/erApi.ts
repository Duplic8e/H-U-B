import type { Currency, FxRate } from '../types'
import { todayKey } from '../dateKey'
import { fetchWithTimeout } from '../fetchWithTimeout'

export const ER_API_BASE = 'https://open.er-api.com/v6'

interface ErApiResponse {
  result: string
  base_code: string
  rates: Record<string, number>
}

/** Free fallback FX source (no key). Latest rates only, no historical dates. */
export async function fetchErApiFxRate(from: Currency, to: Currency): Promise<FxRate> {
  const now = new Date().toISOString()
  if (from === to) {
    return { from, to, rate: 1, date: todayKey(), asOf: now }
  }

  const res = await fetchWithTimeout(`${ER_API_BASE}/latest/${from}`)
  if (!res.ok) throw new Error(`er-api request failed: ${res.status}`)
  const json = (await res.json()) as ErApiResponse
  if (json.result !== 'success') throw new Error('er-api returned an error')
  const rate = json.rates?.[to]
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new Error('er-api response missing target rate')
  }
  return { from, to, rate, date: todayKey(), asOf: now }
}
