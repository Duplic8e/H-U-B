import type { Currency, FxRate } from '../types'
import { fetchFxRate } from './frankfurter'
import { fetchErApiFxRate } from './erApi'

/** Currencies served by Frankfurter (ECB reference rates). BDT and HKD are not. */
export const FRANKFURTER_CURRENCIES: ReadonlySet<string> = new Set([
  'USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'KRW', 'INR',
  'CHF', 'SGD', 'NZD', 'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'CNY', 'PLN', 'ZAR',
])

/** Frankfurter for pairs it supports (incl. historical dates); er-api
 *  otherwise (latest only, the date is intentionally dropped). */
export function fetchFxRateRouted(from: Currency, to: Currency, date?: string): Promise<FxRate> {
  if (FRANKFURTER_CURRENCIES.has(from) && FRANKFURTER_CURRENCIES.has(to)) {
    return fetchFxRate(from, to, date)
  }
  return fetchErApiFxRate(from, to)
}
