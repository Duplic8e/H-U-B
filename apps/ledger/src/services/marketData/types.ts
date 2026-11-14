export const CURRENCIES = [
  'USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'KRW', 'INR', 'BDT',
  'CHF', 'HKD', 'SGD', 'NZD', 'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'CNY', 'PLN', 'ZAR',
] as const
export type Currency = (typeof CURRENCIES)[number]

export interface Quote {
  ticker: string
  exchange?: string
  price: number
  currency: Currency
  asOf: string // ISO timestamp of the quote's source time
}

export interface HistoricalPrice {
  ticker: string
  exchange?: string
  date: string // YYYY-MM-DD requested/nearest
  close: number
  currency: Currency
  asOf: string // ISO
}

export interface FxRate {
  from: Currency
  to: Currency
  rate: number
  date: string // YYYY-MM-DD
  asOf: string // ISO
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'stale'

export interface Cached<T> {
  value: T
  fetchedAt: string // ISO when we last wrote it
}
