import { holdingsFromReport } from './holdingsFromReport'
import type { PAReport, PAOpenPosition } from '../../utils/investments/ibkrPortfolioAnalyst'

function position(over: Partial<PAOpenPosition>): PAOpenPosition {
  return {
    date: '2026-06-30', instrument: 'Stocks', currency: 'USD', symbol: 'AAPL',
    description: 'Apple', sector: 'Technology', quantity: 10, closePrice: 200,
    value: 2000, costBasis: 1800, unrealizedPl: 200, ...over,
  }
}

function report(openPositions: PAOpenPosition[]): PAReport {
  return {
    period: '2026-06', baseCurrency: 'CAD', accountId: 'U1234567',
    historicalPeriod: '', cumulativePeriod: '',
    benchmarkSeries: [], cumulativeSeries: [], benchmarkSummary: [],
    sectorAllocation: [], regionAllocation: [], assetClassAllocation: [],
    performanceBySymbol: [], dividends: [], projectedIncome: [], fees: [],
    openPositions,
  }
}

describe('holdingsFromReport currency mapping', () => {
  it('keeps a EUR position as EUR, not CAD', () => {
    const r = report([position({ symbol: 'ASML', currency: 'EUR', quantity: 10, costBasis: 6000 })])
    const holdings = holdingsFromReport(r)
    expect(holdings).toHaveLength(1)
    expect(holdings[0].currency).toBe('EUR')
  })

  it('keeps a USD position as USD', () => {
    const r = report([position({ symbol: 'AAPL', currency: 'USD', quantity: 10, costBasis: 1800 })])
    const holdings = holdingsFromReport(r)
    expect(holdings[0].currency).toBe('USD')
  })

  it('returns null for an unsupported or blank currency rather than guessing CAD', () => {
    const r = report([
      position({ symbol: 'XXX', currency: 'ZWL', quantity: 10, costBasis: 1000 }),
      position({ symbol: 'YYY', currency: '', quantity: 10, costBasis: 1000 }),
    ])
    const holdings = holdingsFromReport(r)
    expect(holdings[0].currency).toBeNull()
    expect(holdings[1].currency).toBeNull()
  })
})
