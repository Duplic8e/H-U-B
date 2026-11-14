import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'
import type { Cached, FxRate, HistoricalPrice, Quote } from '../services/marketData/types'
import { fxKey, historicalKey, quoteKey } from '../services/marketData/cacheKey'

interface MarketDataState {
  quotes: Record<string, Cached<Quote>>
  historical: Record<string, Cached<HistoricalPrice>>
  fx: Record<string, Cached<FxRate>>
  overrides: Record<string, number>
  apiKey?: string

  setQuote: (q: Quote) => void
  setHistorical: (h: HistoricalPrice) => void
  setFx: (r: FxRate) => void
  getQuote: (ticker: string, exchange?: string) => Cached<Quote> | undefined
  getHistorical: (ticker: string, exchange: string | undefined, dateKey: string) => Cached<HistoricalPrice> | undefined
  getFx: (from: string, to: string, dateKey: string) => Cached<FxRate> | undefined
  setOverride: (key: string, price: number) => void
  clearOverride: (key: string) => void
  getOverride: (key: string) => number | undefined
  setApiKey: (key: string) => void
  clearApiKey: () => void
}

const now = () => new Date().toISOString()

export const useMarketDataStore = create<MarketDataState>()(
  persist(
    (set, get) => ({
      quotes: {},
      historical: {},
      fx: {},
      overrides: {},
      apiKey: undefined,

      setQuote: (q) =>
        set((state) => ({
          quotes: { ...state.quotes, [quoteKey(q.ticker, q.exchange)]: { value: q, fetchedAt: now() } },
        })),
      setHistorical: (h) =>
        set((state) => ({
          historical: {
            ...state.historical,
            [historicalKey(h.ticker, h.exchange, h.date)]: { value: h, fetchedAt: now() },
          },
        })),
      setFx: (r) =>
        set((state) => ({
          fx: { ...state.fx, [fxKey(r.from, r.to, r.date)]: { value: r, fetchedAt: now() } },
        })),

      getQuote: (ticker, exchange) => get().quotes[quoteKey(ticker, exchange)],
      getHistorical: (ticker, exchange, dateKey) => get().historical[historicalKey(ticker, exchange, dateKey)],
      getFx: (from, to, dateKey) => get().fx[fxKey(from, to, dateKey)],

      setOverride: (key, price) => set((state) => ({ overrides: { ...state.overrides, [key]: price } })),
      clearOverride: (key) =>
        set((state) => {
          const next = { ...state.overrides }
          delete next[key]
          return { overrides: next }
        }),
      getOverride: (key) => get().overrides[key],
      setApiKey: (key) => set({ apiKey: key.trim() || undefined }),
      clearApiKey: () => set({ apiKey: undefined }),
    }),
    {
      name: STORAGE_KEYS.marketData,
      version: 1,
      // Existing installs wrote version 0 with this exact shape, so v0 to v1
      // is an identity migration. It exists so the next schema change has a
      // hook instead of a silent reinterpretation of whatever is on disk.
      migrate: (persisted: unknown) => persisted,
    },
  ),
)
