// Pure portfolio valuation. Per-holding numbers stay in the holding's own
// currency; totals are normalized to CAD through a currency-to-CAD rate map.

import type { Currency } from '../../services/marketData/types'
import type { Holding } from '../../store/usePortfolioStore'

/** Rates into CAD, keyed by source currency. CAD is implicitly 1 and need
 *  not be present. A missing entry means the value cannot be converted. */
export type FxRates = Partial<Record<Currency, number>>

function rateToCad(currency: Currency, rates: FxRates): number | undefined {
  return currency === 'CAD' ? 1 : rates[currency]
}

export function bookValue(h: Holding): number {
  return h.quantity * h.avgCost
}

export function marketValue(h: Holding, price: number): number {
  return h.quantity * price
}

export function holdingPlDollars(h: Holding, price: number): number {
  return marketValue(h, price) - bookValue(h)
}

export function holdingPlPct(h: Holding, price: number): number | null {
  const book = bookValue(h)
  return book > 0 ? (holdingPlDollars(h, price) / book) * 100 : null
}

/** null when the currency is unknown or has no rate. */
export function toCad(value: number, currency: Currency | null, rates: FxRates): number | null {
  if (currency === null) return null
  const r = rateToCad(currency, rates)
  return r === undefined ? null : value * r
}

/** Cross rate through CAD. null when either leg is unavailable. */
export function convertAmount(
  value: number,
  from: Currency | null,
  to: Currency | null,
  rates: FxRates,
): number | null {
  if (from === null || to === null) return null
  if (from === to) return value
  const rf = rateToCad(from, rates)
  const rt = rateToCad(to, rates)
  if (rf === undefined || rt === undefined || rt === 0) return null
  return (value * rf) / rt
}

export interface PortfolioTotals {
  investedCad: number
  valueCad: number
  plCad: number
  plPct: number | null
  /** Holdings left out of the totals for want of a rate. */
  excludedCount: number
}

export function portfolioTotals(
  rows: { holding: Holding; price: number }[],
  rates: FxRates,
): PortfolioTotals {
  let investedCad = 0
  let valueCad = 0
  let excludedCount = 0
  for (const { holding, price } of rows) {
    const book = toCad(bookValue(holding), holding.currency, rates)
    const value = toCad(marketValue(holding, price), holding.currency, rates)
    if (book === null || value === null) {
      excludedCount += 1
      continue
    }
    investedCad += book
    valueCad += value
  }
  const plCad = valueCad - investedCad
  return {
    investedCad,
    valueCad,
    plCad,
    plPct: investedCad > 0 ? (plCad / investedCad) * 100 : null,
    excludedCount,
  }
}

/** A quote price converted into the holding's own currency, or null when the
 *  quote's currency does not match and no rate bridges them. Same currency
 *  passes the price through unchanged, including when both are null (an
 *  unset holding currency and no known quote currency). */
export function convertedPrice(
  holding: Holding,
  price: number,
  currency: Currency | null,
  rates: FxRates,
): number | null {
  return currency === holding.currency ? price : convertAmount(price, currency, holding.currency, rates)
}

/** The price to value a holding at for totals: the live or cached price
 *  when one is known and converts into the holding's own currency, and the
 *  holding's cost basis otherwise, be that no quote at all or a quote whose
 *  currency cannot be bridged into the holding's currency. This is the one
 *  place that decides whether a price is safe to use for a holding's total,
 *  so PortfolioView and PortfolioRollupWidget call it instead of each
 *  reimplementing the rule and risking disagreement. */
export function safeHoldingPrice(
  holding: Holding,
  price: number | undefined,
  currency: Currency | null | undefined,
  rates: FxRates,
): number {
  if (price === undefined) return holding.avgCost
  return convertedPrice(holding, price, currency ?? null, rates) ?? holding.avgCost
}

export type AllocationBy = 'holding' | 'account' | 'currency'

export interface AllocationSlice {
  name: string
  valueCad: number
  pct: number
}

/** Slices of CAD market value, largest first. Holdings whose currency has no
 *  rate are dropped entirely, so percentages always sum to 100. */
export function allocationBreakdown(
  rows: { holding: Holding; price: number }[],
  rates: FxRates,
  by: AllocationBy,
  /** Fold everything past this many slices into a single "Other" entry. The
   *  by-holding cut is otherwise unbounded: seventeen holdings drew seventeen
   *  segments and a seventeen-entry legend, which on a phone put more than a
   *  screen of preamble in front of the first holding. Omit for no cap, which
   *  is what the account and currency cuts want. */
  maxSlices?: number,
): AllocationSlice[] {
  const byName = new Map<string, number>()
  let total = 0
  for (const { holding, price } of rows) {
    const value = toCad(marketValue(holding, price), holding.currency, rates)
    if (value === null) continue
    const name =
      by === 'holding' ? holding.ticker : by === 'account' ? holding.account : (holding.currency as string)
    byName.set(name, (byName.get(name) ?? 0) + value)
    total += value
  }
  const all = [...byName.entries()]
    .map(([name, valueCad]) => ({ name, valueCad, pct: total > 0 ? (valueCad / total) * 100 : 0 }))
    .sort((a, b) => b.valueCad - a.valueCad)

  if (maxSlices === undefined || all.length <= maxSlices) return all

  const head = all.slice(0, maxSlices - 1)
  const tail = all.slice(maxSlices - 1)
  const tailValue = tail.reduce((s, x) => s + x.valueCad, 0)
  return [...head, { name: 'Other', valueCad: tailValue, pct: total > 0 ? (tailValue / total) * 100 : 0 }]
}

/** The currency a holding's resolved quote should be read in.
 *
 *  A manual price override is typed by the user while looking at one
 *  holding, so it is already denominated in that holding's own currency.
 *  getCurrentPrice has no holding context and stamps a placeholder currency
 *  on the override it returns, so that value must not be believed: doing so
 *  converts the price a second time and inflates value, P/L and allocation
 *  by the exchange rate. The row, the card and PortfolioRollupWidget all
 *  call this. The widget used to hand-roll its own copy of the rule, kept
 *  equal only by the parity test in portfolioTotalsParity.test.tsx; that
 *  test now guards a single implementation rather than the agreement of
 *  two. */
export function quoteCurrencyForHolding(
  holding: Holding,
  quoteCurrency: Currency | null | undefined,
  source: 'override' | 'live' | 'cache' | undefined,
): Currency | null {
  if (source === 'override') return holding.currency
  return quoteCurrency ?? holding.currency
}
