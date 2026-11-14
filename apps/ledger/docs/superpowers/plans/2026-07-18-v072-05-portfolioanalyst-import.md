# v0.7.2 Plan 5: PortfolioAnalyst Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Portfolio tab recognizes IBKR PortfolioAnalyst report CSVs, persists a curated report (key stats, benchmark comparison, allocations, per-symbol performance, dividends, projected income, fees, open positions), renders it below holdings, and offers to update holdings from the report.

**Architecture:** The PortfolioAnalyst export is a multi-section positional CSV: every row is `Section,RowType,...` where RowType is `Header`, `Data`, `MetaInfo`, or `Total`. A generic section walker keeps the latest Header per section and zips Data rows into keyed records; per-section mappers build a typed `PAReport`. The report lives in its own persisted store, replaced on each upload.

**Tech Stack:** TypeScript, papaparse, zustand persist, recharts, vitest.

**Reference file:** the user's real export `C:\Users\misha\Downloads\Mishat_Hassan_January_01_2026_July_17_2026.csv` (verify against it at the end).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-v0.7.2-beta-design.md` section 9
- Curated sections only; ESG, Concentration, Risk Measures, Corporate Actions, Trade Summary are ignored
- Malformed or unrecognized rows are skipped, never fatal
- Theme vars, `formatMoney`, `chartTooltipStyles` from `src/utils/chartTheme` for the chart; no em dashes in copy
- Run `npx tsc -b && npx vitest run` before each commit

---

### Task 1: Parser

**Files:**
- Create: `src/utils/investments/ibkrPortfolioAnalyst.ts`
- Test: `src/utils/investments/ibkrPortfolioAnalyst.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2-4):
  ```ts
  export interface PAKeyStats {
    beginningNav: number; endingNav: number; cumulativeReturn: number;
    bestReturn: number; bestReturnDate: string; worstReturn: number; worstReturnDate: string;
    depositsWithdrawals: number; dividends: number; interest: number;
    feesCommissions: number; changeInNav: number;
  }
  export interface PABenchmarkPoint { month: string; account: number; benchmarks: Record<string, number> }
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
    keyStats?: PAKeyStats;
    benchmarkSeries: PABenchmarkPoint[];
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
  export function isPortfolioAnalystCsv(text: string): boolean
  export function parsePortfolioAnalyst(text: string): PAReport
  ```

- [ ] **Step 1: Write the failing test with a trimmed fixture**

Create `src/utils/investments/ibkrPortfolioAnalyst.test.ts`. The fixture is a faithful miniature of the real file (section names, Header/Data discriminators, and column orders copied verbatim from the real export):

```ts
import { describe, expect, it } from 'vitest'
import { isPortfolioAnalystCsv, parsePortfolioAnalyst } from './ibkrPortfolioAnalyst'

const FIXTURE = [
  'Introduction,Header,Name,Account,Alias,BaseCurrency,AccountType,AnalysisPeriod,PerformanceMeasure',
  'Introduction,Data,Mishat Hassan,U1234567,,CAD,Individual,"January 1, 2026 to July 17, 2026 (Daily)",TWR',
  'Key Statistics,MetaInfo,Analysis Period,"January 1, 2026 - July 17, 2026"',
  'Key Statistics,Header,BeginningNAV,EndingNAV,CumulativeReturn,5DayReturn,5DayReturnDateRange,10DayReturn,10DayReturnDateRange,BestReturn,BestReturnDate,WorstReturn,WorstReturnDate,MTM,Deposits & Withdrawals,Dividends,Interest,Fees & Commissions,Other,ChangeInNAV',
  'Key Statistics,Data,115596.40,155142.25,-4.86,-8.37,20260713 - 20260717,-10.84,20260706 - 20260717,8.88,20260206,-7.97,20260605,-10052.68,46120.26,11.11,662.33,-598.79,3403.61,39545.84',
  'Historical Performance Benchmark Comparison,Header,Account,MTD,QTD,YTD,1 Year,3 Year,5 Year,Since Inception',
  'Historical Performance Benchmark Comparison,Data,SPXTR,-0.51,-0.51,9.63,20.49,72.32,85.21,93.56',
  'Historical Performance Benchmark Comparison,Data,U1234567,-13.52,-13.52,-4.86,2.69,57.38,14.59,-58.12',
  'Historical Performance Benchmark Comparison,Header,Month,BM1,BM1Return,BM2,BM2Return,BM3,BM3Return,Account,AccountReturn',
  'Historical Performance Benchmark Comparison,Data,202601,SPXTR,1.45,EFA,4.90,VT,3.11,U1234567,-0.23',
  'Historical Performance Benchmark Comparison,Data,202602,SPXTR,-0.75,EFA,4.60,VT,1.64,U1234567,-7.24',
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
    expect(report.benchmarkSummary).toHaveLength(2)
    expect(report.benchmarkSummary[1]).toMatchObject({ name: 'U1234567', ytd: -4.86 })
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/investments/ibkrPortfolioAnalyst.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the parser**

Create `src/utils/investments/ibkrPortfolioAnalyst.ts`:

```ts
// IBKR PortfolioAnalyst report CSV parser. The file is multi-section
// positional: Section,RowType,...cells. Each section re-announces its
// columns with a Header row (some sections have several header variants);
// Data rows are zipped against the most recent header of their section.

import Papa from 'papaparse'

/* [PAReport and row interfaces exactly as in the Interfaces block above] */

function num(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(/[",]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function isPortfolioAnalystCsv(text: string): boolean {
  return text.replace(/^﻿/, '').startsWith('Introduction,')
}

type Rec = Record<string, string>

export function parsePortfolioAnalyst(text: string): PAReport {
  const rows = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: true }).data

  const report: PAReport = {
    period: '', baseCurrency: '',
    benchmarkSeries: [], benchmarkSummary: [],
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
    if (rowType !== 'Data') continue
    const header = headers[section]
    if (!header) continue
    const rec: Rec = {}
    header.forEach((h, i) => { rec[h] = cells[i] ?? '' })

    switch (section) {
      case 'Introduction':
        report.period = rec['AnalysisPeriod'] ?? ''
        report.baseCurrency = rec['BaseCurrency'] ?? ''
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
      case 'Historical Performance Benchmark Comparison':
        if (header[0] === 'Month') {
          const benchmarks: Record<string, number> = {}
          for (const bm of ['BM1', 'BM2', 'BM3']) {
            if (rec[bm]) benchmarks[rec[bm]] = num(rec[`${bm}Return`])
          }
          report.benchmarkSeries.push({ month: rec['Month'] ?? '', account: num(rec['AccountReturn']), benchmarks })
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
```

(Include the full interface definitions from the Interfaces block at the top of the file.)

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run src/utils/investments/ibkrPortfolioAnalyst.test.ts`
Expected: PASS.

```bash
git add src/utils/investments/ibkrPortfolioAnalyst.ts src/utils/investments/ibkrPortfolioAnalyst.test.ts
git commit -m "feat(investments): PortfolioAnalyst report CSV parser"
```

---

### Task 2: Report store

**Files:**
- Create: `src/store/usePortfolioReportStore.ts`

**Interfaces:**
- Consumes: `PAReport` from Task 1
- Produces: `usePortfolioReportStore` with `{ report: PAReport | null; uploadedAt: string | null; setReport(r: PAReport): void; clearReport(): void }`, persisted as `ledger-portfolio-report`

- [ ] **Step 1: Implement (small enough to skip a dedicated test)**

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PAReport } from '../utils/investments/ibkrPortfolioAnalyst'

interface PortfolioReportState {
  report: PAReport | null
  uploadedAt: string | null
  setReport: (report: PAReport) => void
  clearReport: () => void
}

/** Latest uploaded PortfolioAnalyst report; replaced wholesale on upload. */
export const usePortfolioReportStore = create<PortfolioReportState>()(
  persist(
    (set) => ({
      report: null,
      uploadedAt: null,
      setReport: (report) => set({ report, uploadedAt: new Date().toISOString() }),
      clearReport: () => set({ report: null, uploadedAt: null }),
    }),
    { name: 'ledger-portfolio-report' },
  ),
)
```

- [ ] **Step 2: Verify build, commit**

Run: `npx tsc -b`
Expected: PASS.

```bash
git add src/store/usePortfolioReportStore.ts
git commit -m "feat(investments): persisted PortfolioAnalyst report store"
```

---

### Task 3: Upload integration + holdings prompt

**Files:**
- Modify: `src/components/investments/PortfolioImport.tsx`

**Interfaces:**
- Consumes: `isPortfolioAnalystCsv`, `parsePortfolioAnalyst`, `PAReport`, `PAOpenPosition` (Task 1); `usePortfolioReportStore` (Task 2); `usePortfolioStore.importHoldings(account, mode, rows)`; `ConfirmDialog` from `../ui/ConfirmDialog`
- Produces: uploading a PA CSV through the existing "Import broker CSV" button stores the report and opens a confirm prompt to also update holdings

- [ ] **Step 1: Detect PA files in onFile**

In `PortfolioImport.tsx` add imports:

```tsx
import { isPortfolioAnalystCsv, parsePortfolioAnalyst, type PAReport } from '../../utils/investments/ibkrPortfolioAnalyst'
import { usePortfolioReportStore } from '../../store/usePortfolioReportStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'
```

Add state and store binding:

```tsx
const setReport = usePortfolioReportStore((s) => s.setReport)
const [holdingsPrompt, setHoldingsPrompt] = useState<Omit<Holding, 'id' | 'account'>[] | null>(null)
```

Add a mapper above the component:

```tsx
/** Stock/ETF long positions from the report, as importable holdings. */
function holdingsFromReport(report: PAReport): Omit<Holding, 'id' | 'account'>[] {
  return report.openPositions
    .filter((p) => (p.instrument === 'Stocks' || p.instrument === 'ETFs') && p.quantity > 0 && p.costBasis > 0)
    .map((p) => ({
      ticker: p.symbol.toUpperCase(),
      name: p.description || undefined,
      quantity: p.quantity,
      avgCost: p.costBasis / p.quantity,
      currency: p.currency === 'USD' ? ('USD' as const) : ('CAD' as const),
    }))
}
```

Rework `onFile` to check PA first:

```tsx
const onFile = async (file: File) => {
  setMessage('')
  const text = await file.text()
  if (isPortfolioAnalystCsv(text)) {
    try {
      const report = parsePortfolioAnalyst(text)
      setReport(report)
      const rows = holdingsFromReport(report)
      setMessage(`PortfolioAnalyst report imported (${report.period}).`)
      if (rows.length > 0) setHoldingsPrompt(rows)
    } catch (err) {
      setMessage(`Could not parse PortfolioAnalyst report: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
    return
  }
  const result = await parsePortfolioText(text)  // switch from parsePortfolioCSV(file) since text is already read; import parsePortfolioText instead
  if ('unrecognized' in result) {
    setPending(result)
    setMapping({ ticker: result.headers[0] ?? '', quantity: '', totalCost: '', currency: '' })
    return
  }
  doImport(result, '')
}
```

(`parsePortfolioText` is exported from `../../utils/portfolioCsv`; it is synchronous, drop the `await`.)

- [ ] **Step 2: Render the prompt**

Before the component's closing tag add:

```tsx
<ConfirmDialog
  open={holdingsPrompt !== null}
  title="Update holdings too?"
  message={`The report contains ${holdingsPrompt?.length ?? 0} stock/ETF positions. Replace the "${account.trim() || DEFAULT_ACCOUNT}" account's holdings with them? The report itself is already saved either way.`}
  confirmLabel="Update holdings"
  onConfirm={() => {
    if (holdingsPrompt) importHoldings(account.trim() || DEFAULT_ACCOUNT, 'replace', holdingsPrompt)
    setHoldingsPrompt(null)
  }}
  onCancel={() => setHoldingsPrompt(null)}
/>
```

Update the helper copy paragraph to mention the new capability:

```tsx
Interactive Brokers holdings, Wealthsimple, and IBKR PortfolioAnalyst reports are detected automatically; anything else opens the column mapper.
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc -b && npx vitest run`
Expected: PASS.

```bash
git add src/components/investments/PortfolioImport.tsx
git commit -m "feat(investments): PortfolioAnalyst detection on upload with holdings prompt"
```

---

### Task 4: Report view

**Files:**
- Create: `src/components/investments/PortfolioReport.tsx`
- Modify: `src/components/investments/PortfolioView.tsx`

**Interfaces:**
- Consumes: `usePortfolioReportStore`; `PAReport` types; `formatMoney`; `chartTooltipStyles` from `../../utils/chartTheme`; recharts `LineChart/Line/XAxis/YAxis/Tooltip/Legend/ResponsiveContainer`
- Produces: `PortfolioReport` React component (no props), rendered by `PortfolioView` after the holdings blocks (and also when there are no holdings)

- [ ] **Step 1: Build the component**

Create `src/components/investments/PortfolioReport.tsx`. Structure: null when no report; otherwise a `themed-card` per section with a shared collapsible wrapper. Complete skeleton:

```tsx
import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import {
  Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { usePortfolioReportStore } from '../../store/usePortfolioReportStore'
import { formatMoney } from '../planner/format'
import { chartTooltipStyles } from '../../utils/chartTheme'

const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="themed-card rounded-lg p-4">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="w-4 h-4 text-text-secondary" /> : <ChevronRight className="w-4 h-4 text-text-secondary" />}
        <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

export const PortfolioReport: React.FC = () => {
  const report = usePortfolioReportStore((s) => s.report)
  const uploadedAt = usePortfolioReportStore((s) => s.uploadedAt)
  const clearReport = usePortfolioReportStore((s) => s.clearReport)
  if (!report) return null

  // Benchmark chart: cumulative growth of 100 from monthly % returns.
  const seriesNames = ['Account', ...Object.keys(report.benchmarkSeries[0]?.benchmarks ?? {})]
  const cumulative: Record<string, number> = Object.fromEntries(seriesNames.map((n) => [n, 100]))
  const chartData = report.benchmarkSeries.map((p) => {
    cumulative['Account'] *= 1 + p.account / 100
    for (const [bm, r] of Object.entries(p.benchmarks)) cumulative[bm] *= 1 + r / 100
    return { month: p.month, ...Object.fromEntries(seriesNames.map((n) => [n, Number(cumulative[n].toFixed(2))])) }
  })
  const chartColors = ['var(--accent)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)']

  const stats = report.keyStats

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-text-primary">
          PortfolioAnalyst Report <span className="text-text-secondary font-normal text-[13px]">{report.period}</span>
        </h2>
        <button onClick={clearReport} className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-error transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Clear report
        </button>
      </div>

      {stats && (
        <Section title="Key Statistics" defaultOpen>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
            {[
              ['Beginning NAV', formatMoney(stats.beginningNav)],
              ['Ending NAV', formatMoney(stats.endingNav)],
              ['Cumulative Return', pct(stats.cumulativeReturn)],
              ['Change in NAV', formatMoney(stats.changeInNav)],
              ['Deposits & Withdrawals', formatMoney(stats.depositsWithdrawals)],
              ['Dividends', formatMoney(stats.dividends)],
              ['Interest', formatMoney(stats.interest)],
              ['Fees & Commissions', formatMoney(stats.feesCommissions)],
              ['Best Day', `${pct(stats.bestReturn)} (${stats.bestReturnDate})`],
              ['Worst Day', `${pct(stats.worstReturn)} (${stats.worstReturnDate})`],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-[11px] uppercase tracking-wide text-text-secondary">{label}</p>
                <p className="font-medium text-text-primary">{value}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {chartData.length > 1 && (
        <Section title="Benchmark Comparison (growth of 100)" defaultOpen>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip {...chartTooltipStyles} />
                <Legend />
                {seriesNames.map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n} stroke={chartColors[i % chartColors.length]} strokeWidth={n === 'Account' ? 2 : 1.5} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {report.benchmarkSummary.length > 0 && (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-[12px] min-w-[560px]">
                <thead><tr className="text-left text-text-secondary border-b border-border">
                  {['', 'MTD', 'QTD', 'YTD', '1Y', '3Y', '5Y', 'Incept.'].map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {report.benchmarkSummary.map((r) => (
                    <tr key={r.name} className="border-b border-border/50">
                      <td className="py-1 pr-3 text-text-primary">{r.name}</td>
                      {[r.mtd, r.qtd, r.ytd, r.oneYear, r.threeYear, r.fiveYear, r.inception].map((v, i) => (
                        <td key={i} className={`py-1 pr-3 ${v >= 0 ? 'text-accent' : 'text-error'}`}>{pct(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {(report.assetClassAllocation.length > 0 || report.sectorAllocation.length > 0 || report.regionAllocation.length > 0) && (
        <Section title="Allocations">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              ['By Asset Class', report.assetClassAllocation],
              ['By Sector', report.sectorAllocation],
              ['By Region', report.regionAllocation],
            ].map(([title, rows]) => (
              <div key={title as string} className="flex flex-col gap-2">
                <p className="text-[12px] uppercase tracking-wide text-text-secondary">{title as string}</p>
                {(rows as { name: string; endingNav: number; endingPct: number }[]).map((a) => (
                  <div key={a.name} className="flex flex-col gap-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-text-primary">{a.name}</span>
                      <span className="text-text-secondary">{a.endingPct.toFixed(1)}% · {formatMoney(a.endingNav)}</span>
                    </div>
                    <div className="h-1.5 rounded bg-bg-primary/50 overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, a.endingPct))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.performanceBySymbol.length > 0 && (
        <Section title={`Performance by Symbol (${report.performanceBySymbol.length})`}>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[12px] min-w-[720px]">
              <thead><tr className="text-left text-text-secondary border-b border-border sticky top-0 bg-[var(--card-bg)]">
                {['Symbol', 'Sector', 'Avg Weight', 'Return', 'Contribution', 'Unrealized P/L', 'Realized P/L', 'Open'].map((h) => (
                  <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[...report.performanceBySymbol].sort((a, b) => b.contribution - a.contribution).map((s) => (
                  <tr key={`${s.symbol}-${s.instrument}`} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 text-text-primary" title={s.description}>{s.symbol}</td>
                    <td className="py-1.5 pr-3 text-text-secondary">{s.sector}</td>
                    <td className="py-1.5 pr-3">{s.avgWeight.toFixed(2)}%</td>
                    <td className={`py-1.5 pr-3 ${s.totalReturn >= 0 ? 'text-accent' : 'text-error'}`}>{pct(s.totalReturn)}</td>
                    <td className={`py-1.5 pr-3 ${s.contribution >= 0 ? 'text-accent' : 'text-error'}`}>{pct(s.contribution)}</td>
                    <td className={`py-1.5 pr-3 ${s.unrealizedPl >= 0 ? 'text-accent' : 'text-error'}`}>{formatMoney(s.unrealizedPl)}</td>
                    <td className={`py-1.5 pr-3 ${s.realizedPl >= 0 ? 'text-accent' : 'text-error'}`}>{formatMoney(s.realizedPl)}</td>
                    <td className="py-1.5 pr-3 text-text-secondary">{s.open ? 'Yes' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {(report.dividends.length > 0 || report.projectedIncome.length > 0) && (
        <Section title="Dividends & Projected Income">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[13px]">
            <div>
              <p className="text-[12px] uppercase tracking-wide text-text-secondary mb-2">
                Received ({formatMoney(report.dividends.reduce((s, d) => s + d.amount, 0))})
              </p>
              {report.dividends.map((d, i) => (
                <div key={i} className="flex justify-between py-0.5">
                  <span className="text-text-primary">{d.symbol} <span className="text-text-secondary">{d.payDate}</span></span>
                  <span>{formatMoney(d.amount)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-wide text-text-secondary mb-2">
                Projected annual ({formatMoney(report.projectedIncome.reduce((s, p) => s + p.estAnnualIncome, 0))})
              </p>
              {report.projectedIncome.map((p, i) => (
                <div key={i} className="flex justify-between py-0.5">
                  <span className="text-text-primary">{p.symbol} <span className="text-text-secondary">{p.frequency}, {p.currentYieldPct.toFixed(2)}%</span></span>
                  <span>{formatMoney(p.estAnnualIncome)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {report.fees.length > 0 && (
        <Section title={`Fees (${formatMoney(report.fees.reduce((s, f) => s + f.amount, 0))} net)`}>
          <div className="max-h-[240px] overflow-y-auto text-[13px]">
            {report.fees.map((f, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span className="text-text-secondary">{f.date} <span className="text-text-primary">{f.description}</span></span>
                <span className={f.amount >= 0 ? 'text-accent' : 'text-error'}>{formatMoney(f.amount)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <p className="text-[12px] text-text-secondary">
        Report uploaded {uploadedAt ? new Date(uploadedAt).toLocaleString() : ''} · base currency {report.baseCurrency}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Mount in PortfolioView**

In `PortfolioView.tsx`: `import { PortfolioReport } from './PortfolioReport'` and render `<PortfolioReport />` as the last child of the outer `flex flex-col gap-6` div, outside the holdings ternary (so it shows even with zero holdings).

- [ ] **Step 3: Verify with the real file**

Run: `npx tsc -b && npx vitest run`
Expected: PASS.

Browser: Investments > Portfolio > Import broker CSV with `C:\Users\misha\Downloads\Mishat_Hassan_January_01_2026_July_17_2026.csv`. Expect: report sections render with real numbers (ending NAV 155,142.25, cumulative return -4.86%), benchmark chart shows 4 lines, the holdings prompt lists the stock/ETF positions, accepting it fills the Portfolio table. If a section renders empty against the real file, debug the mapper against the actual header row (the real file's headers are authoritative).

- [ ] **Step 4: Commit**

```bash
git add src/components/investments/PortfolioReport.tsx src/components/investments/PortfolioView.tsx
git commit -m "feat(investments): PortfolioAnalyst report view in Portfolio tab"
```

---

## Self-Review Checklist

- Spec section 9 covered: detection before flat parsers (T3), curated sections (T1), persisted store (T2), collapsible report below holdings (T4), holdings prompt (T3).
- `PAReport` field names consistent between parser, store, import, and view.
- Real-file verification step present (T4 Step 3).
