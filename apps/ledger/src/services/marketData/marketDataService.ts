import type { Currency, FetchStatus, FxRate, HistoricalPrice, Quote } from './types'
import { fetchAlphaVantageHistorical, fetchAlphaVantageQuote } from './providers/alphaVantage'
import { fetchFxRateRouted } from './providers/fxRouter'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { SingleFlight, minInterval } from './throttle'
import { fxKey, historicalKey, quoteKey } from './cacheKey'
import { toDateKey, todayKey } from './dateKey'

export const MIN_FETCH_INTERVAL_MS = 60_000
export const STALE_AFTER_MS = 15 * 60_000
export const QUOTE_FRESH_MS = 4 * 60 * 60 * 1000

export interface Resolved<T> {
  value: T
  source: 'override' | 'live' | 'cache'
  status: FetchStatus
  asOf: string
  stale: boolean
}

// Provider indirection for testability.
interface Providers {
  fetchQuote: typeof fetchAlphaVantageQuote
  fetchHistorical: typeof fetchAlphaVantageHistorical
  fetchFxRate: typeof fetchFxRateRouted
}
const defaultProviders: Providers = {
  fetchQuote: fetchAlphaVantageQuote,
  fetchHistorical: fetchAlphaVantageHistorical,
  fetchFxRate: fetchFxRateRouted,
}
let providers: Providers = { ...defaultProviders }
export function __setProviders(p: Partial<Providers>): void { providers = { ...defaultProviders, ...p } }
export function __resetProviders(): void { providers = { ...defaultProviders } }

const flight = new SingleFlight()

export function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > STALE_AFTER_MS
}

/** A quote fetched within the last QUOTE_FRESH_MS is considered fresh. See R9. */
export function isQuoteFresh(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < QUOTE_FRESH_MS
}

export async function getCurrentPrice(
  ticker: string,
  exchange?: string,
  opts?: { force?: boolean },
): Promise<Resolved<Quote>> {
  const store = useMarketDataStore.getState()
  const key = quoteKey(ticker, exchange)

  const override = store.getOverride(key)
  if (override !== undefined) {
    const asOf = new Date().toISOString()
    // The currency here is a placeholder and is NOT authoritative. An
    // override is entered by the user in whatever currency they were
    // looking at, and this function has no holding context to name it.
    // Holding-aware callers must resolve it with quoteCurrencyForHolding
    // in src/utils/investments/portfolioMetrics.ts rather than reading
    // this field. Quote.currency is not nullable, so a placeholder it is.
    return {
      value: { ticker: ticker.trim(), exchange, price: override, currency: 'USD', asOf },
      source: 'override', status: 'success', asOf, stale: false,
    }
  }

  const cached = store.quotes[key]
  if (!opts?.force && cached && isQuoteFresh(cached.fetchedAt)) {
    return { value: cached.value, source: 'cache', status: 'success', asOf: cached.fetchedAt, stale: false }
  }

  const allowed = opts?.force || minInterval(key, MIN_FETCH_INTERVAL_MS)
  if (allowed) {
    try {
      const quote = await flight.run(key, () => providers.fetchQuote(ticker, exchange))
      useMarketDataStore.getState().setQuote(quote)
      return { value: quote, source: 'live', status: 'success', asOf: quote.asOf, stale: false }
    } catch {
      return fromQuoteCache(key, 'error')
    }
  }
  return fromQuoteCache(key, 'stale')
}

function fromQuoteCache(key: string, status: FetchStatus): Resolved<Quote> {
  const cached = useMarketDataStore.getState().quotes[key]
  if (!cached) throw new Error('No market data available')
  return { value: cached.value, source: 'cache', status, asOf: cached.fetchedAt, stale: !isQuoteFresh(cached.fetchedAt) }
}

export async function getHistoricalPrice(
  ticker: string,
  exchange: string | undefined,
  date: string,
): Promise<Resolved<HistoricalPrice>> {
  const dateKey = toDateKey(date)
  const key = historicalKey(ticker, exchange, dateKey)

  const allowed = minInterval(key, MIN_FETCH_INTERVAL_MS)
  if (allowed) {
    try {
      const hist = await flight.run(key, () => providers.fetchHistorical(ticker, exchange, dateKey))
      useMarketDataStore.getState().setHistorical(hist)
      return { value: hist, source: 'live', status: 'success', asOf: hist.asOf, stale: false }
    } catch {
      return fromHistoricalCache(key, 'error')
    }
  }
  return fromHistoricalCache(key, 'stale')
}

function fromHistoricalCache(key: string, status: FetchStatus): Resolved<HistoricalPrice> {
  const cached = useMarketDataStore.getState().historical[key]
  if (!cached) throw new Error('No market data available')
  return { value: cached.value, source: 'cache', status, asOf: cached.fetchedAt, stale: isStale(cached.fetchedAt) }
}

export async function getFxRate(
  from: Currency,
  to: Currency,
  date?: string,
): Promise<Resolved<FxRate>> {
  const dateKey = date ? toDateKey(date) : todayKey()
  const key = fxKey(from, to, dateKey)

  const override = useMarketDataStore.getState().getOverride(key)
  if (override !== undefined) {
    const asOf = new Date().toISOString()
    return { value: { from, to, rate: override, date: dateKey, asOf }, source: 'override', status: 'success', asOf, stale: false }
  }

  if (from === to) {
    const asOf = new Date().toISOString()
    return { value: { from, to, rate: 1, date: dateKey, asOf }, source: 'live', status: 'success', asOf, stale: false }
  }

  const allowed = minInterval(key, MIN_FETCH_INTERVAL_MS)
  if (allowed) {
    try {
      const rate = await flight.run(key, () => providers.fetchFxRate(from, to, date))
      useMarketDataStore.getState().setFx(rate)
      return { value: rate, source: 'live', status: 'success', asOf: rate.asOf, stale: false }
    } catch {
      return fromFxCache(from, to, key, 'error', date === undefined)
    }
  }
  return fromFxCache(from, to, key, 'stale', date === undefined)
}

/** Newest cached rate or manual override for the pair across ALL dates.
 *  Used only for non-historical requests when today's data is missing. */
function latestFxForPair(
  from: Currency,
  to: Currency,
): { rate: number; date: string; fetchedAt: string; source: 'cache' | 'override' } | undefined {
  const state = useMarketDataStore.getState()
  const prefix = `${from.trim().toUpperCase()}-${to.trim().toUpperCase()}@`
  let best: { rate: number; date: string; fetchedAt: string; source: 'cache' | 'override' } | undefined
  for (const [key, cached] of Object.entries(state.fx)) {
    if (!key.startsWith(prefix)) continue
    const date = key.slice(prefix.length)
    if (!best || date > best.date) {
      best = { rate: cached.value.rate, date, fetchedAt: cached.fetchedAt, source: 'cache' }
    }
  }
  for (const [key, rate] of Object.entries(state.overrides)) {
    if (!key.startsWith(prefix)) continue
    const date = key.slice(prefix.length)
    if (!best || date > best.date) {
      best = { rate, date, fetchedAt: new Date().toISOString(), source: 'override' }
    }
  }
  return best
}

function fromFxCache(
  from: Currency,
  to: Currency,
  key: string,
  status: FetchStatus,
  allowCrossDateFallback: boolean,
): Resolved<FxRate> {
  const cached = useMarketDataStore.getState().fx[key]
  if (cached) {
    return { value: cached.value, source: 'cache', status, asOf: cached.fetchedAt, stale: isStale(cached.fetchedAt) }
  }
  if (allowCrossDateFallback) {
    const fb = latestFxForPair(from, to)
    if (fb) {
      return {
        value: { from, to, rate: fb.rate, date: fb.date, asOf: fb.fetchedAt },
        source: fb.source, status, asOf: fb.fetchedAt, stale: true,
      }
    }
  }
  throw new Error('No market data available')
}
