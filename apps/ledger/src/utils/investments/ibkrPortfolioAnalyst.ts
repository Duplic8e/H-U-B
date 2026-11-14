// IBKR PortfolioAnalyst report CSV parser. The file is multi-section
// positional: Section,RowType,...cells. Each section re-announces its
// columns with a Header row (some sections have several header variants);
// Data rows are zipped against the most recent header of their section.

import Papa from 'papaparse'

export interface PAKeyStats {
  beginningNav: number; endingNav: number; cumulativeReturn: number;
  bestReturn: number; bestReturnDate: string; worstReturn: number; worstReturnDate: string;
  depositsWithdrawals: number; dividends: number; interest: number;
  feesCommissions: number; changeInNav: number;
}
export interface PABenchmarkPoint { month: string; account: number; benchmarks: Record<string, number> }
/** A row of the Cumulative Benchmark Comparison section: cumulative percent
 *  return since the start of the report period, so it already begins at 0 and
 *  needs no compounding. Unlike the historical monthly series, this section is
 *  bounded to the report's own analysis period. */
export interface PACumulativePoint { date: string; account: number; benchmarks: Record<string, number> }
export interface PABenchmarkSummaryRow {
  name: string; mtd: number; qtd: number; ytd: number;
  oneYear: number; threeYear: number; fiveYear: number; inception: number;
}
export interface PAAllocationRow { name: string; endingNav: number; endingPct: number }
export interface PASymbolPerf {
  symbol: string; description: string; instrument: string; sector: string;
  avgWeight: number; totalReturn: number; contribution: number;
  unrealizedPl: number; realizedPl: number; open: boolean;
}
export interface PADividend { payDate: string; symbol: string; quantity: number; perShare: number; amount: number }
export interface PAProjectedIncomeRow {
  symbol: string; description: string; frequency: string; quantity: number;
  value: number; currentYieldPct: number; estAnnualIncome: number;
}
export interface PAFeeRow { date: string; description: string; amount: number }
export interface PAOpenPosition {
  date: string; instrument: string; currency: string; symbol: string; description: string;
  sector: string; quantity: number; closePrice: number; value: number; costBasis: number; unrealizedPl: number;
}
export interface PAReport {
  period: string; baseCurrency: string; accountAlias?: string;
  /** The broker's account id, e.g. U1234567. The benchmark summary lists this
   *  as one of its rows, which is the only reliable way to tell the account
   *  apart from the benchmarks: real exports put it last, not first. */
  accountId: string;
  /** Each benchmark section declares its own analysis period, and they differ:
   *  the historical one runs since inception while the cumulative one matches
   *  the report. Kept so a chart can say which span it is actually drawing. */
  historicalPeriod: string;
  cumulativePeriod: string;
  keyStats?: PAKeyStats;
  benchmarkSeries: PABenchmarkPoint[];
  cumulativeSeries: PACumulativePoint[];
  benchmarkSummary: PABenchmarkSummaryRow[];
  sectorAllocation: PAAllocationRow[];
  regionAllocation: PAAllocationRow[];
  assetClassAllocation: PAAllocationRow[];   // from latest Allocation by Asset Class date row
  performanceBySymbol: PASymbolPerf[];
  dividends: PADividend[];
  projectedIncome: PAProjectedIncomeRow[];
  fees: PAFeeRow[];
  openPositions: PAOpenPosition[];
}

/** Strict sibling of num(): null when the cell is not a number at all.
 *  IBKR writes a bare dash for a period it has no data for, which parseFloat
 *  turns into NaN and num() then flattens to 0. A 0 is a real return, so a
 *  caller that cannot tell the two apart draws fabricated flat points. */
function numOrNull(raw: unknown): number | null {
  const cell = String(raw ?? '').trim()
  if (cell === '' || cell === '-') return null
  const n = parseFloat(cell.replace(/[",]/g, ''))
  return Number.isFinite(n) ? n : null
}

function num(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(/[",]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function isPortfolioAnalystCsv(text: string): boolean {
  return text.replace(/^\uFEFF/, '').startsWith('Introduction,')
}

type Rec = Record<string, string>

export function parsePortfolioAnalyst(text: string): PAReport {
  const rows = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: true }).data

  const report: PAReport = {
    period: '', baseCurrency: '', accountId: '',
    historicalPeriod: '', cumulativePeriod: '',
    benchmarkSeries: [], cumulativeSeries: [], benchmarkSummary: [],
    sectorAllocation: [], regionAllocation: [], assetClassAllocation: [],
    performanceBySymbol: [], dividends: [], projectedIncome: [], fees: [], openPositions: [],
  }

  const headers: Record<string, string[]> = {}
  let lastAssetClassRow: Rec | null = null
  let assetClassHeader: string[] = []

  for (const row of rows) {
    const [section, rowType, ...cells] = row
    if (!section || !rowType) continue
    if (rowType === 'Header') {
      headers[section] = cells
      if (section === 'Allocation by Asset Class') assetClassHeader = cells
      continue
    }
    if (rowType === 'MetaInfo') {
      if (cells[0] === 'Analysis Period') {
        if (section === 'Historical Performance Benchmark Comparison') report.historicalPeriod = cells[1] ?? ''
        else if (section === 'Cumulative Benchmark Comparison') report.cumulativePeriod = cells[1] ?? ''
      }
      continue
    }
    if (rowType !== 'Data') continue
    const header = headers[section]
    if (!header) continue
    const rec: Rec = {}
    header.forEach((h, i) => { rec[h] = cells[i] ?? '' })

    switch (section) {
      case 'Introduction':
        report.period = rec['AnalysisPeriod'] ?? ''
        report.baseCurrency = rec['BaseCurrency'] ?? ''
        report.accountId = rec['Account'] ?? ''
        report.accountAlias = rec['Alias'] || undefined
        break
      case 'Key Statistics':
        report.keyStats = {
          beginningNav: num(rec['BeginningNAV']), endingNav: num(rec['EndingNAV']),
          cumulativeReturn: num(rec['CumulativeReturn']),
          bestReturn: num(rec['BestReturn']), bestReturnDate: rec['BestReturnDate'] ?? '',
          worstReturn: num(rec['WorstReturn']), worstReturnDate: rec['WorstReturnDate'] ?? '',
          depositsWithdrawals: num(rec['Deposits & Withdrawals']), dividends: num(rec['Dividends']),
          interest: num(rec['Interest']), feesCommissions: num(rec['Fees & Commissions']),
          changeInNav: num(rec['ChangeInNAV']),
        }
        break
      case 'Cumulative Benchmark Comparison': {
        // The account column is named after the account id, so it cannot be
        // looked up by a fixed key. It is always the final pair in the header.
        if (header[0] !== 'Date') break
        const benchmarks: Record<string, number> = {}
        for (const bm of ['BM1', 'BM2', 'BM3']) {
          if (rec[bm]) benchmarks[rec[bm]] = num(rec[`${bm}Return`])
        }
        const accountReturn = numOrNull(rec[header[header.length - 1]])
        if (accountReturn !== null) {
          report.cumulativeSeries.push({ date: rec['Date'] ?? '', account: accountReturn, benchmarks })
        }
        break
      }
      case 'Historical Performance Benchmark Comparison':
        if (header[0] === 'Month') {
          const benchmarks: Record<string, number> = {}
          for (const bm of ['BM1', 'BM2', 'BM3']) {
            if (rec[bm]) benchmarks[rec[bm]] = num(rec[`${bm}Return`])
          }
          // A dash means the month is outside the account's life (before
          // inception, or still in the future). Skipping beats scoring it 0.
          const accountReturn = numOrNull(rec['AccountReturn'])
          if (accountReturn !== null) {
            report.benchmarkSeries.push({ month: rec['Month'] ?? '', account: accountReturn, benchmarks })
          }
        } else if (header[0] === 'Account') {
          report.benchmarkSummary.push({
            name: rec['Account'] ?? '', mtd: num(rec['MTD']), qtd: num(rec['QTD']), ytd: num(rec['YTD']),
            oneYear: num(rec['1 Year']), threeYear: num(rec['3 Year']), fiveYear: num(rec['5 Year']),
            inception: num(rec['Since Inception']),
          })
        }
        break
      case 'Allocation by Asset Class':
        lastAssetClassRow = rec // keep only the newest date row
        break
      case 'Allocation and Performance by Sector':
        if (header[0] === 'Allocation by Sector' && rec['Allocation by Sector'] && rec['Allocation by Sector'] !== 'Total') {
          report.sectorAllocation.push({ name: rec['Allocation by Sector'], endingNav: num(rec['Ending NAV']), endingPct: num(rec['Ending %']) })
        }
        break
      case 'Allocation and Performance by Region':
        if (header[0] === 'Allocation by Region' && rec['Allocation by Region'] && rec['Allocation by Region'] !== 'Total') {
          report.regionAllocation.push({ name: rec['Allocation by Region'], endingNav: num(rec['Ending NAV']), endingPct: num(rec['Ending %']) })
        }
        break
      case 'Performance by Symbol':
        if (rec['Symbol'] && !rec['Symbol'].startsWith('Total')) {
          report.performanceBySymbol.push({
            symbol: rec['Symbol'], description: rec['Description'] ?? '',
            instrument: rec['FinancialInstrument'] ?? '', sector: rec['Sector'] ?? '',
            avgWeight: num(rec['AvgWeight']), totalReturn: num(rec['Return']),
            contribution: num(rec['Contribution']),
            unrealizedPl: num(rec['Unrealized_P&L']), realizedPl: num(rec['Realized_P&L']),
            open: rec['Open'] === 'Yes',
          })
        }
        break
      case 'Dividends':
        if (rec['Symbol']) {
          report.dividends.push({
            payDate: rec['PayDate'] ?? '', symbol: rec['Symbol'],
            quantity: num(rec['Quantity']), perShare: num(rec['DividendPerShare']), amount: num(rec['Amount']),
          })
        }
        break
      case 'Projected Income':
        if (rec['Symbol']) {
          report.projectedIncome.push({
            symbol: rec['Symbol'], description: rec['Description'] ?? '', frequency: rec['Frequency'] ?? '',
            quantity: num(rec['Quantity']), value: num(rec['Value']),
            currentYieldPct: num(rec['Current Yield (%)']), estAnnualIncome: num(rec['Est. Annual Income']),
          })
        }
        break
      case 'Fee Summary':
        if (rec['Description']) {
          report.fees.push({ date: rec['Date'] ?? '', description: rec['Description'], amount: num(rec['Amount']) })
        }
        break
      case 'Open Position Summary':
        if (rec['Date'] && rec['Date'] !== 'Total' && rec['Symbol']) {
          report.openPositions.push({
            date: rec['Date'], instrument: rec['FinancialInstrument'] ?? '', currency: rec['Currency'] ?? '',
            symbol: rec['Symbol'].trim(), description: rec['Description'] ?? '', sector: rec['Sector'] ?? '',
            quantity: num(rec['Quantity']), closePrice: num(rec['ClosePrice']), value: num(rec['Value']),
            costBasis: num(rec['Cost Basis']), unrealizedPl: num(rec['UnrealizedP&L']),
          })
        }
        break
      default:
        break // ignored section (ESG, Concentration, Risk Measures, ...)
    }
  }

  // Latest asset-class snapshot: header is Date,<class...>,NAV.
  if (lastAssetClassRow && assetClassHeader.length > 2) {
    const nav = num(lastAssetClassRow['NAV'])
    for (const col of assetClassHeader) {
      if (col === 'Date' || col === 'NAV') continue
      const endingNav = num(lastAssetClassRow[col])
      report.assetClassAllocation.push({
        name: col, endingNav, endingPct: nav > 0 ? (endingNav / nav) * 100 : 0,
      })
    }
  }

  return report
}
