import { toCurrency } from '../../utils/portfolioCsv'
import type { Holding } from '../../store/usePortfolioStore'
import type { PAReport } from '../../utils/investments/ibkrPortfolioAnalyst'

/** Stock/ETF long positions from the report, as importable holdings.
 *  Exported for testing: covers the same guess-CAD bug fixed in portfolioCsv.ts,
 *  so it must be exercised directly. */
export function holdingsFromReport(report: PAReport): Omit<Holding, 'id' | 'account'>[] {
  return report.openPositions
    .filter((p) => (p.instrument === 'Stocks' || p.instrument === 'ETFs') && p.quantity > 0 && p.costBasis > 0)
    .map((p) => ({
      ticker: p.symbol.toUpperCase(),
      name: p.description || undefined,
      quantity: p.quantity,
      avgCost: p.costBasis / p.quantity,
      currency: toCurrency(p.currency),
    }))
}
