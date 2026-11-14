import type { Trade } from '../../types/trades'

export interface TickerResult {
  ticker: string
  /** Units still held after every trade. */
  quantity: number
  /** Average cost per unit of what is still held, fees included. */
  avgCost: number
  /** proceeds - costOfSold, over every sell. */
  realized: number
  proceeds: number
  costOfSold: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Moving average cost, which is the method Canadian adjusted cost base uses.
 *  A sell realises proceeds (net of fees) minus the average cost of the units
 *  sold at that moment; it does not change the average cost of what remains.
 *  Trades are processed oldest first, so entry order does not matter.
 *
 *  Positions are tracked per ticker across accounts, matching how ACB is
 *  computed for a Canadian return. It is deliberately NOT per account. */
export function resultsByTicker(trades: Trade[]): TickerResult[] {
  const byTicker = new Map<string, Trade[]>()
  for (const t of trades) {
    const list = byTicker.get(t.ticker) ?? []
    list.push(t)
    byTicker.set(t.ticker, list)
  }

  const results: TickerResult[] = []
  for (const [ticker, list] of byTicker) {
    let quantity = 0
    let bookCost = 0
    let proceeds = 0
    let costOfSold = 0

    for (const t of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
      if (t.side === 'buy') {
        quantity += t.quantity
        bookCost += t.quantity * t.price + t.fees
      } else {
        // A sell of more than is held closes the position rather than going
        // short: this app tracks holdings, not short positions.
        const sold = Math.min(t.quantity, quantity)
        // No units change hands when nothing is held to sell, so there is
        // nothing to realise. Do not subtract the fee: that would invent a
        // loss with no economic basis.
        if (sold > 0) {
          const avg = bookCost / quantity
          proceeds += sold * t.price - t.fees
          costOfSold += sold * avg
          quantity -= sold
          bookCost = quantity > 0 ? bookCost - sold * avg : 0
        }
      }
    }

    results.push({
      ticker,
      quantity: round2(quantity),
      avgCost: quantity > 0 ? round2(bookCost / quantity) : 0,
      realized: round2(proceeds - costOfSold),
      proceeds: round2(proceeds),
      costOfSold: round2(costOfSold),
    })
  }
  return results
}

/** Realised gain across every ticker. With `year`, only sells dated in that
 *  calendar year contribute, which is the figure a tax return asks for. */
export function totalRealized(trades: Trade[], year?: number): number {
  if (year === undefined) {
    return round2(resultsByTicker(trades).reduce((s, r) => s + r.realized, 0))
  }
  const upToYearEnd = trades.filter((t) => t.date <= `${year}-12-31`)
  const upToYearStart = trades.filter((t) => t.date < `${year}-01-01`)
  const through = resultsByTicker(upToYearEnd).reduce((s, r) => s + r.realized, 0)
  const before = resultsByTicker(upToYearStart).reduce((s, r) => s + r.realized, 0)
  return round2(through - before)
}
