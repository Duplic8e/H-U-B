import type { Currency, FxRate } from '../types'
import { toDateKey, todayKey } from '../dateKey'
import { fetchWithTimeout } from '../fetchWithTimeout'

export const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1'

interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

export async function fetchFxRate(from: Currency, to: Currency, date?: string): Promise<FxRate> {
  const now = new Date().toISOString()
  if (from === to) {
    return { from, to, rate: 1, date: date ? toDateKey(date) : todayKey(), asOf: now }
  }

  const path = date ? toDateKey(date) : 'latest'
  const res = await fetchWithTimeout(`${FRANKFURTER_BASE}/${path}?from=${from}&to=${to}`)
  if (!res.ok) throw new Error(`Frankfurter request failed: ${res.status}`)
  const json = (await res.json()) as FrankfurterResponse
  const rate = json.rates?.[to]
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new Error('Frankfurter response missing target rate')
  }
  return { from, to, rate, date: json.date ?? (date ? toDateKey(date) : todayKey()), asOf: now }
}
