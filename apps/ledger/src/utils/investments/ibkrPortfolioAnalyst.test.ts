import { describe, expect, it } from 'vitest'
import { isPortfolioAnalystCsv, parsePortfolioAnalyst } from './ibkrPortfolioAnalyst'

const FIXTURE = [
  'Introduction,Header,Name,Account,Alias,BaseCurrency,AccountType,AnalysisPeriod,PerformanceMeasure',
  'Introduction,Data,Mishat Hassan,U1234567,,CAD,Individual,"January 1, 2026 to July 17, 2026 (Daily)",TWR',
  'Key Statistics,MetaInfo,Analysis Period,"January 1, 2026 - July 17, 2026"',
  'Key Statistics,Header,BeginningNAV,EndingNAV,CumulativeReturn,5DayReturn,5DayReturnDateRange,10DayReturn,10DayReturnDateRange,BestReturn,BestReturnDate,WorstReturn,WorstReturnDate,MTM,Deposits & Withdrawals,Dividends,Interest,Fees & Commissions,Other,ChangeInNAV',
  'Key Statistics,Data,115596.40,155142.25,-4.86,-8.37,20260713 - 20260717,-10.84,20260706 - 20260717,8.88,20260206,-7.97,20260605,-10052.68,46120.26,11.11,662.33,-598.79,3403.61,39545.84',
  'Historical Performance Benchmark Comparison,MetaInfo,Analysis Period,"May 12, 2021 - July 17, 2026"',
  'Historical Performance Benchmark Comparison,Header,Account,MTD,QTD,YTD,1 Year,3 Year,5 Year,Since Inception',
  // Real exports list every benchmark first and the account LAST. A fixture
  // with the account first hides an off-by-position bug in benchmarkDelta.
  'Historical Performance Benchmark Comparison,Data,SPXTR,-0.51,-0.51,9.63,20.49,72.32,85.21,93.56',
  'Historical Performance Benchmark Comparison,Data,EFA,-0.40,-0.40,8.00,18.00,60.00,55.00,62.92',
  'Historical Performance Benchmark Comparison,Data,U1234567,-13.52,-13.52,-4.86,2.69,57.38,14.59,-58.12',
  'Historical Performance Benchmark Comparison,Header,Month,BM1,BM1Return,BM2,BM2Return,BM3,BM3Return,Account,AccountReturn',
  // IBKR pads the grid to whole calendar years and writes a dash where there
  // is no data: before inception, and for months that have not happened yet.
  'Historical Performance Benchmark Comparison,Data,202012,SPXTR,-,EFA,-,VT,-,U1234567,-',
  'Historical Performance Benchmark Comparison,Data,202601,SPXTR,1.45,EFA,4.90,VT,3.11,U1234567,-0.23',
  'Historical Performance Benchmark Comparison,Data,202602,SPXTR,-0.75,EFA,4.60,VT,1.64,U1234567,-7.24',
  'Historical Performance Benchmark Comparison,Data,202612,SPXTR,-,EFA,-,VT,-,U1234567,-',
  'Cumulative Benchmark Comparison,MetaInfo,Analysis Period,"January 1, 2026 - July 17, 2026"',
  'Cumulative Benchmark Comparison,Header,Date,BM1,BM1Return,BM2,BM2Return,BM3,BM3Return,U1234567,U1234567Return',
  'Cumulative Benchmark Comparison,Data,01/01/26,SPXTR,0,EFA,0,VT,0,U1234567,0.0078',
  'Cumulative Benchmark Comparison,Data,01/02/26,SPXTR,0.2126,EFA,1.0517,VT,0.7372,U1234567,2.1955',
  'Cumulative Benchmark Comparison,Data,07/17/26,SPXTR,9.63,EFA,8.00,VT,8.50,U1234567,-4.86',
  'Allocation by Asset Class,Header,Date,Equities,Cash,NAV',
  'Allocation by Asset Class,Data,20260101,12051.12,103554.30,115605.42',
  'Allocation by Asset Class,Data,20260717,100383.74,54758.51,155142.25',
  'Allocation and Performance by Sector,Header,Allocation by Sector,Ending NAV,Ending %,MTD NAV,MTD %,QTD NAV,QTD %,YTD NAV,YTD %',
  'Allocation and Performance by Sector,Data,Technology,50000,32.2,49000,31,49000,31,48000,30',
  'Allocation and Performance by Sector,Data,Total,155142.25,100,,,,,,',
  'Allocation and Performance by Region,Header,Allocation by Region,Ending NAV,Ending %,MTD NAV,MTD %,QTD NAV,QTD %,YTD NAV,YTD %',
  'Allocation and Performance by Region,Data,North America,140000,90.2,,,,,,',
  'Performance by Symbol,Header,Symbol,Description,FinancialInstrument,Sector,AvgWeight,Return,Contribution,Unrealized_P&L,Realized_P&L,Open',
  'Performance by Symbol,Data,KORU,DIREXION DLY M SK BULL 3X-UI,ETFs,Broad,2.95,-60.85,-2.56,"-4,732.02",0.00,Yes',
  'Performance by Symbol,Data,Total ETFs,,,,2.95,-60.85,-2.56,"-4,732.02",0.00,',
  'Dividends,Header,PayDate,Ex-Date,Symbol,Quantity,DividendPerShare,Amount',
  'Dividends,Data,20260115,20251231,FMC,100,0.11,11.11',
  'Projected Income,Header,Financial Inst.,Symbol,Description,Frequency,Quantity,Price,Value,Current Yield (%),Principal,Est. Annual Income,Est. 2026 Remaining Income',
  'Projected Income,Data,Stocks,FMC,FMC CORP,Quarterly,100,40,4000,1.1,4000,44,22',
  'Fee Summary,Header,Date,Description,Amount',
  'Fee Summary,Data,20260105,Market data subscription,-13.73',
  'Open Position Summary,Header,Date,FinancialInstrument,Currency,Symbol,Description,Sector,Quantity,ClosePrice,Value,Cost Basis,UnrealizedP&L,FXRateToBase',
  'Open Position Summary,Data,07/17/2026,ETFs,USD,KORU,DIREXION DLY M SK BULL 3X-UI,Broad,140,18.26,2556.4,5931.35,-3374.95,1.4021',
  'Open Position Summary,Data,Total,ETFs,USD,,,,,,2556.4,5931.35,-3374.95',
  'Open Position Summary,Data,07/17/2026,Options,USD,ALIT  260821C00023000,ALIT 21AUG26 23 C,Technology,-1,3.40,-340.74,-398.95,58.21,1.4021',
  'ESG,Header,Whatever,Cols',
  'ESG,Data,ignored,1',
].join('\n')

describe('isPortfolioAnalystCsv', () => {
  it('detects by the Introduction section', () => {
    expect(isPortfolioAnalystCsv(FIXTURE)).toBe(true)
    expect(isPortfolioAnalystCsv('﻿Introduction,Header,Name')).toBe(true)
    expect(isPortfolioAnalystCsv('Symbol,Quantity,Cost Basis\nAAPL,1,100')).toBe(false)
  })
})

describe('parsePortfolioAnalyst', () => {
  const report = parsePortfolioAnalyst(FIXTURE)

  it('reads intro metadata', () => {
    expect(report.baseCurrency).toBe('CAD')
    expect(report.period).toBe('January 1, 2026 to July 17, 2026 (Daily)')
  })

  it('reads key statistics', () => {
    expect(report.keyStats?.beginningNav).toBe(115596.40)
    expect(report.keyStats?.endingNav).toBe(155142.25)
    expect(report.keyStats?.cumulativeReturn).toBe(-4.86)
    expect(report.keyStats?.feesCommissions).toBe(-598.79)
  })

  it('reads benchmark summary and monthly series', () => {
    expect(report.benchmarkSummary).toHaveLength(3)
    expect(report.benchmarkSummary[2]).toMatchObject({ name: 'U1234567', ytd: -4.86 })
    expect(report.benchmarkSeries).toHaveLength(2)
    expect(report.benchmarkSeries[0]).toEqual({
      month: '202601',
      account: -0.23,
      benchmarks: { SPXTR: 1.45, EFA: 4.90, VT: 3.11 },
    })
  })

  it('takes the latest asset-class allocation row and skips Totals in sector rows', () => {
    expect(report.assetClassAllocation).toEqual([
      { name: 'Equities', endingNav: 100383.74, endingPct: expect.closeTo(64.7, 0.1) },
      { name: 'Cash', endingNav: 54758.51, endingPct: expect.closeTo(35.3, 0.1) },
    ])
    expect(report.sectorAllocation).toEqual([{ name: 'Technology', endingNav: 50000, endingPct: 32.2 }])
    expect(report.regionAllocation).toEqual([{ name: 'North America', endingNav: 140000, endingPct: 90.2 }])
  })

  it('reads per-symbol performance, skipping Total rows, parsing quoted negatives', () => {
    expect(report.performanceBySymbol).toHaveLength(1)
    expect(report.performanceBySymbol[0]).toMatchObject({ symbol: 'KORU', unrealizedPl: -4732.02, open: true })
  })

  it('reads dividends, projected income, fees', () => {
    expect(report.dividends[0]).toMatchObject({ symbol: 'FMC', amount: 11.11 })
    expect(report.projectedIncome[0]).toMatchObject({ symbol: 'FMC', estAnnualIncome: 44 })
    expect(report.fees[0]).toMatchObject({ amount: -13.73 })
  })

  it('reads open positions, skipping Total rows', () => {
    expect(report.openPositions).toHaveLength(2)
    expect(report.openPositions[0]).toMatchObject({ symbol: 'KORU', instrument: 'ETFs', quantity: 140, costBasis: 5931.35 })
  })
})

describe('benchmark series bounds', () => {
  const report = parsePortfolioAnalyst(FIXTURE)

  it('records the account id so the account row can be found by name, not position', () => {
    expect(report.accountId).toBe('U1234567')
  })

  it('drops padded months that carry a dash instead of scoring them as a flat 0%', () => {
    // parseFloat('-') is NaN, and the shared num() helper turns that into 0.
    // Left alone, a pre-inception month and a month in the future both become
    // real 0% points and stretch the axis years past the data.
    const months = report.benchmarkSeries.map((p) => p.month)
    expect(months).toEqual(['202601', '202602'])
    expect(months).not.toContain('202012')
    expect(months).not.toContain('202612')
  })

  it('parses the cumulative series, which is already bounded to the report period', () => {
    expect(report.cumulativeSeries).toHaveLength(3)
    expect(report.cumulativeSeries[0]).toEqual({
      date: '01/01/26', account: 0.0078, benchmarks: { SPXTR: 0, EFA: 0, VT: 0 },
    })
    expect(report.cumulativeSeries[2].account).toBe(-4.86)
  })

  it('keeps each benchmark section its own declared period', () => {
    expect(report.cumulativePeriod).toBe('January 1, 2026 - July 17, 2026')
    expect(report.historicalPeriod).toBe('May 12, 2021 - July 17, 2026')
  })
})
