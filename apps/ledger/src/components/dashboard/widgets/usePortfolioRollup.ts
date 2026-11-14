import { useMemo } from 'react'
import { accountNames, usePortfolioStore } from '../../../store/usePortfolioStore'
import type { Holding } from '../../../store/usePortfolioStore'
import { useMarketDataStore } from '../../../store/useMarketDataStore'
import { quoteKey } from '../../../services/marketData'
import { useFxRates } from '../../../hooks/useFxRates'
import { bookValue, marketValue, portfolioTotals, quoteCurrencyForHolding, safeHoldingPrice, toCad } from '../../../utils/investments/portfolioMetrics'

export interface PortfolioLine {
  holding: Holding
  /** Market value and cost basis in CAD, null when no rate bridges the holding's currency. */
  value: number | null
  book: number | null
  pl: number | null
  plPct: number | null
}

/** The Dashboard Portfolio card's numbers: the same override > cached > avg-cost price rule the
 *  Investments page uses, converted to CAD, with a line per holding for the richer layouts. */
export function usePortfolioRollup() {
  const holdings = usePortfolioStore((s) => s.holdings)
  const importedAt = usePortfolioStore((s) => s.importedAt)
  const quotes = useMarketDataStore((s) => s.quotes)
  const overrides = useMarketDataStore((s) => s.overrides)
  // Rates are needed for both a holding's own currency and, when different, its cached quote's
  // currency, so a convertible mismatch is not mistaken for an unconvertible one.
  const currencies = useMemo(
    () => [
      ...holdings.map((h) => h.currency),
      ...holdings.map((h) => quotes[quoteKey(h.ticker, h.exchange)]?.value.currency ?? null),
    ],
    [holdings, quotes],
  )
  const fx = useFxRates(currencies)

  const rows = holdings.map((h) => {
    const key = quoteKey(h.ticker, h.exchange)
    const override = overrides[key]
    const cached = quotes[key]
    const source: 'override' | 'cache' | undefined = override !== undefined ? 'override' : cached ? 'cache' : undefined
    const nativePrice = override ?? cached?.value.price ?? h.avgCost
    const quoteCurrency = quoteCurrencyForHolding(h, cached?.value.currency, source)
    return { holding: h, price: safeHoldingPrice(h, nativePrice, quoteCurrency, fx.rates) }
  })
  const totals = portfolioTotals(rows, fx.rates)

  const lines: PortfolioLine[] = rows.map(({ holding, price }) => {
    const value = toCad(marketValue(holding, price), holding.currency, fx.rates)
    const book = toCad(bookValue(holding), holding.currency, fx.rates)
    const known = value !== null && book !== null
    return {
      holding,
      value,
      book,
      pl: known ? value - book : null,
      plPct: known && book > 0 ? ((value - book) / book) * 100 : null,
    }
  })

  // The rollup reads whatever quotes happen to be cached, so its freshness is the newest
  // fetchedAt across the quotes it actually used.
  const fetchedAts = holdings
    .map((h) => quotes[quoteKey(h.ticker, h.exchange)]?.fetchedAt)
    .filter((v): v is string => v !== undefined)
  const newestFetchedAt = fetchedAts.length > 0 ? fetchedAts.reduce((a, b) => (a > b ? a : b)) : undefined

  return { holdings, importedAt, totals, lines, newestFetchedAt, accounts: accountNames(holdings) }
}
