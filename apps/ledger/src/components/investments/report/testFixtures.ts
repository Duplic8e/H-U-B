import type { PAReport } from '../../../utils/investments/ibkrPortfolioAnalyst'

export const sampleReport: PAReport = {
  period: 'Jan 2026 - Jun 2026',
  baseCurrency: 'CAD',
  accountId: 'U1234567',
  historicalPeriod: 'May 12, 2021 - Jun 30, 2026',
  cumulativePeriod: 'Jan 1, 2026 - Jun 30, 2026',
  keyStats: {
    beginningNav: 100000, endingNav: 118000, cumulativeReturn: 18,
    bestReturn: 3.2, bestReturnDate: '2026-02-10', worstReturn: -2.4, worstReturnDate: '2026-03-11',
    depositsWithdrawals: 5000, dividends: 900, interest: 100,
    feesCommissions: -120, changeInNav: 18000,
  },
  benchmarkSeries: [
    { month: '2026-01', account: 4, benchmarks: { SPX: 3 } },
    { month: '2026-02', account: -2, benchmarks: { SPX: -1 } },
  ],
  // Benchmarks first, the account LAST and named by its id. This mirrors a
  // real PortfolioAnalyst export. The fixture used to name the account
  // "Account" and list it first, which is why an off-by-position bug in
  // benchmarkDelta went green for as long as it did.
  benchmarkSummary: [
    { name: 'SPX', mtd: 1, qtd: 1, ytd: 12, oneYear: 12, threeYear: 0, fiveYear: 0, inception: 12 },
    { name: 'U1234567', mtd: 1, qtd: 2, ytd: 18, oneYear: 18, threeYear: 0, fiveYear: 0, inception: 18 },
  ],
  cumulativeSeries: [
    { date: '01/01/26', account: 0, benchmarks: { SPX: 0 } },
    { date: '06/30/26', account: 18, benchmarks: { SPX: 12 } },
  ],
  sectorAllocation: [{ name: 'Technology', endingNav: 70800, endingPct: 60 }],
  regionAllocation: [{ name: 'North America', endingNav: 94400, endingPct: 80 }],
  assetClassAllocation: [{ name: 'Stocks', endingNav: 118000, endingPct: 100 }],
  performanceBySymbol: [
    { symbol: 'AAPL', description: 'Apple', instrument: 'STK', sector: 'Technology', avgWeight: 20, totalReturn: 25, contribution: 5, unrealizedPl: 4000, realizedPl: 0, open: true },
    { symbol: 'XYZ', description: 'Xyz', instrument: 'STK', sector: 'Energy', avgWeight: 5, totalReturn: -20, contribution: -1.5, unrealizedPl: -900, realizedPl: 0, open: true },
  ],
  dividends: [{ payDate: '2026-03-01', symbol: 'AAPL', quantity: 100, perShare: 0.24, amount: 24 }],
  projectedIncome: [{ symbol: 'AAPL', description: 'Apple', frequency: 'Quarterly', quantity: 100, value: 20000, currentYieldPct: 0.5, estAnnualIncome: 96 }],
  fees: [{ date: '2026-01-15', description: 'Commission', amount: -12 }],
  openPositions: [],
}
