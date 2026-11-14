import type { Currency, HistoricalPrice, Quote } from '../types'
import { toDateKey } from '../dateKey'
import { useMarketDataStore } from '../../../store/useMarketDataStore'
import { fetchWithTimeout } from '../fetchWithTimeout'

export const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query'

/** Thrown before any network call when the user hasn't saved a key yet. */
export class MissingApiKeyError extends Error {
  constructor() {
    super('Alpha Vantage API key missing. Add one in Market Data settings.')
    this.name = 'MissingApiKeyError'
  }
}

const TSX_MAIN = new Set(['TSX', 'TSE', 'TORONTO'])
const TSX_VENTURE = new Set(['TSXV', 'TSX-V', 'VENTURE'])

/** Alpha Vantage uses .TRT (Toronto) / .TRV (Venture) suffixes. See R7. */
export function toAlphaVantageSymbol(ticker: string, exchange?: string): string {
  const t = ticker.trim().toUpperCase()
  if (t.includes('.')) return t
  const ex = exchange?.trim().toUpperCase() ?? ''
  if (TSX_MAIN.has(ex)) return `${t}.TRT`
  if (TSX_VENTURE.has(ex)) return `${t}.TRV`
  return t
}

/** Alpha Vantage returns no currency field; infer from the suffix. See R8. */
function currencyFor(symbol: string): Currency {
  return symbol.endsWith('.TRT') || symbol.endsWith('.TRV') ? 'CAD' : 'USD'
}

function requireKey(): string {
  const key = useMarketDataStore.getState().apiKey
  if (!key) throw new MissingApiKeyError()
  return key
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Alpha Vantage request failed: ${res.status}`)
  const json = (await res.json()) as Record<string, unknown>
  // Rate-limit and error replies come back as HTTP 200 with these keys. See R11.
  const notice = json['Note'] ?? json['Information'] ?? json['Error Message']
  if (typeof notice === 'string') throw new Error(`Alpha Vantage: ${notice}`)
  return json
}

export async function fetchAlphaVantageQuote(ticker: string, exchange?: string): Promise<Quote> {
  const key = requireKey()
  const symbol = toAlphaVantageSymbol(ticker, exchange)
  const json = await getJson(
    `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`,
  )
  const quote = json['Global Quote'] as Record<string, string> | undefined
  const price = Number(quote?.['05. price'])
  if (!quote || !Number.isFinite(price)) throw new Error('Alpha Vantage response missing price')
  const tradingDay = quote['07. latest trading day']
  const asOf = tradingDay ? new Date(`${tradingDay}T00:00:00Z`).toISOString() : new Date().toISOString()
  return { ticker: ticker.trim(), exchange, price, currency: currencyFor(symbol), asOf }
}

export async function fetchAlphaVantageHistorical(
  ticker: string,
  exchange: string | undefined,
  date: string,
): Promise<HistoricalPrice> {
  const key = requireKey()
  const symbol = toAlphaVantageSymbol(ticker, exchange)
  const targetKey = toDateKey(date)
  // compact = last 100 trading days; older dates need the full series. See R10.
  const ageDays = (Date.now() - new Date(`${targetKey}T00:00:00Z`).getTime()) / 86_400_000
  const outputsize = ageDays > 120 ? 'full' : 'compact'
  const json = await getJson(
    `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}&apikey=${key}`,
  )
  const series = json['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined
  if (!series) throw new Error('Alpha Vantage response missing time series')

  // Nearest close on/before the target, within a 15-day window (weekends/holidays).
  let chosen: number | undefined
  let chosenDay = ''
  const floor = new Date(`${targetKey}T00:00:00Z`).getTime() - 15 * 86_400_000
  for (const [day, values] of Object.entries(series)) {
    if (day > targetKey) continue
    if (new Date(`${day}T00:00:00Z`).getTime() < floor) continue
    const close = Number(values['4. close'])
    if (Number.isFinite(close) && (chosen === undefined || day > chosenDay)) {
      chosen = close
      chosenDay = day
    }
  }
  if (chosen === undefined) throw new Error('Alpha Vantage historical: no close on/before date')

  return { ticker: ticker.trim(), exchange, date: targetKey, close: chosen, currency: currencyFor(symbol), asOf: new Date().toISOString() }
}
