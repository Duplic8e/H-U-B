// Everything the portfolio summary band shows, derived from holdings that
// are already in the store. Pure: no DOM, no store access, no fetching.

import type { Holding } from '../../store/usePortfolioStore'
import {
  allocationBreakdown, holdingPlPct, portfolioTotals,
  type FxRates, type PortfolioTotals,
} from './portfolioMetrics'

export interface Highlight {
  ticker: string
  plPct: number
}

export interface Weight {
  name: string
  pct: number
}

export interface PortfolioHighlights {
  totals: PortfolioTotals
  /** Best and worst by percentage return. A large position that crept up
   *  should not outrank a small one that doubled, so these rank on percent
   *  rather than dollars. Null when nothing has a computable return. */
  strongest: Highlight | null
  weakest: Highlight | null
  largestWeight: Weight | null
  currencySplit: Weight[]
  holdingCount: number
  accountCount: number
}

export function portfolioHighlights(
  rows: { holding: Holding; price: number }[],
  rates: FxRates,
): PortfolioHighlights {
  const ranked: Highlight[] = []
  for (const { holding, price } of rows) {
    const plPct = holdingPlPct(holding, price)
    // null means there is no cost basis to measure against. Letting that
    // fall through as 0 would hand it the weakest slot on a technicality.
    if (plPct === null) continue
    ranked.push({ ticker: holding.ticker, plPct })
  }
  ranked.sort((a, b) => b.plPct - a.plPct)

  const byHolding = allocationBreakdown(rows, rates, 'holding')
  const byCurrency = allocationBreakdown(rows, rates, 'currency')

  return {
    totals: portfolioTotals(rows, rates),
    strongest: ranked.length > 0 ? ranked[0] : null,
    // A single ranked holding is both the best and worst return there is,
    // which would render as the same ticker and number twice in
    // contradictory colours. Weakest stays null until there is a genuine
    // second data point to contrast it with.
    weakest: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    largestWeight: byHolding.length > 0 ? { name: byHolding[0].name, pct: byHolding[0].pct } : null,
    currencySplit: byCurrency.map((s) => ({ name: s.name, pct: s.pct })),
    holdingCount: rows.length,
    accountCount: new Set(rows.map((r) => r.holding.account)).size,
  }
}
