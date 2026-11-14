# Phase 5b — Investments: Portfolio Viewer (CSV import)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone view of real holdings imported from broker CSVs (Interactive Brokers + Wealthsimple parsers + a generic column mapper), with per-holding cost basis, live value, P/L, allocation, and CAD-normalized multi-currency totals.

**Architecture:** A persisted `ledger-portfolio` store holds `Holding[]` (replaced wholesale on each import). CSV parsing follows the Budgeting pattern (`src/utils/csvParser.ts`): typed parser configs with `detect(headers)` + `parse(row)`, and an "unrecognized" result that drives a column-mapper UI. Valuation math is pure (`portfolioMetrics.ts`), FX via `useFxRate('USD','CAD')`. UI lands as a second tab on the Investments page (independent of 5a's journal data).

**Tech Stack:** React 19, Zustand v5 `persist`, PapaParse, `src/services/marketData` (`useCurrentPrice`, `useFxRate`), lucide-react, Tailwind v4, Vitest (globals: true).

**Spec authority:** `docs/superpowers/specs/2026-07-02-ledger-v2-design.md` → Phase 5b. Explicitly deferred: dividends, ACB/capital gains, rebalancing, benchmarks, watchlist. **Prerequisites:** Phases 1–3; Phase 5a (the Investments page rebuilt in 5a Task 5 is where the tab is added — if 5a hasn't run, add the tab to the existing page instead and note it).

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **Local-first persistence.** New store `ledger-portfolio` via Zustand `persist`.
- **Backup coverage.** `'ledger-portfolio'` appended to `BACKUP_KEYS` + registration test (Task 1).
- **CSV reuse.** Same PapaParse + bank-parser-config + generic-mapper pattern as `src/utils/csvParser.ts`.
- **Live data always has a manual fallback.** Holdings value from override > live > cache > avg cost; FX falls back to cache/override; the table renders with no network.
- **No hardcoded colors — theme CSS variables only.** ALL 5 themes.
- **Mobile + all 5 themes are acceptance gates** (final task).
- **Testing is minimal by direction of the user (2026-07-02):** store, CSV parsing, and metrics get tests; UI components get NO dedicated test files — manual gate covers them.
- **Commit after every task.** Lint enforces `react-hooks/set-state-in-effect`.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

---

### Task 1: Portfolio store + backup registration

**Files:**
- Create: `src/store/usePortfolioStore.ts`
- Create: `src/store/usePortfolioStore.test.ts`
- Modify: `src/utils/backup.ts` (append `'ledger-portfolio'`)
- Modify: `src/utils/backup.test.ts` (registration test)

**Interfaces:**
- Consumes: `Currency` from `src/services/marketData`.
- Produces (used by Tasks 2–5):
  - `interface Holding { id: string; ticker: string; name?: string; exchange?: string; quantity: number; avgCost: number; currency: Currency }` (`avgCost` = per-share cost basis in the holding's currency)
  - `usePortfolioStore` — `{ holdings: Holding[]; importedAt: string | null; setHoldings(holdings: Holding[]): void; clearHoldings(): void }` (`setHoldings` replaces everything and stamps `importedAt`)

- [x] **Step 1: Write the failing tests**

Create `src/store/usePortfolioStore.test.ts`:

```ts
import { usePortfolioStore, type Holding } from './usePortfolioStore'

const initialState = usePortfolioStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePortfolioStore.setState(initialState, true)
})

const holdings: Holding[] = [
  { id: 'h1', ticker: 'VFV', quantity: 100, avgCost: 120, currency: 'CAD' },
  { id: 'h2', ticker: 'AAPL', quantity: 10, avgCost: 180, currency: 'USD' },
]

describe('usePortfolioStore', () => {
  it('replaces holdings on import and stamps importedAt', () => {
    usePortfolioStore.getState().setHoldings(holdings)
    const s = usePortfolioStore.getState()
    expect(s.holdings).toHaveLength(2)
    expect(s.importedAt).not.toBeNull()
    usePortfolioStore.getState().setHoldings([holdings[0]])
    expect(usePortfolioStore.getState().holdings).toHaveLength(1)
  })

  it('clears holdings', () => {
    usePortfolioStore.getState().setHoldings(holdings)
    usePortfolioStore.getState().clearHoldings()
    expect(usePortfolioStore.getState().holdings).toHaveLength(0)
    expect(usePortfolioStore.getState().importedAt).toBeNull()
  })

  it('persists under the ledger-portfolio key', () => {
    usePortfolioStore.getState().setHoldings(holdings)
    expect(localStorage.getItem('ledger-portfolio')).toContain('"VFV"')
  })
})
```

Add to `src/utils/backup.test.ts`:

```ts
  it('registers the portfolio store key', () => {
    expect(BACKUP_KEYS).toContain('ledger-portfolio')
  })
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/usePortfolioStore.test.ts src/utils/backup.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/store/usePortfolioStore.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Currency } from '../services/marketData'

export interface Holding {
  id: string
  ticker: string
  name?: string
  exchange?: string
  quantity: number
  /** Per-share cost basis in the holding's own currency. */
  avgCost: number
  currency: Currency
}

interface PortfolioState {
  holdings: Holding[]
  importedAt: string | null
  setHoldings: (holdings: Holding[]) => void
  clearHoldings: () => void
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      holdings: [],
      importedAt: null,
      setHoldings: (holdings) => set({ holdings, importedAt: new Date().toISOString() }),
      clearHoldings: () => set({ holdings: [], importedAt: null }),
    }),
    { name: 'ledger-portfolio' },
  ),
)
```

Append `'ledger-portfolio'` to `BACKUP_KEYS` in `src/utils/backup.ts`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/usePortfolioStore.test.ts src/utils/backup.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/store/usePortfolioStore.ts src/store/usePortfolioStore.test.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: portfolio holdings store (ledger-portfolio), registered in backup"
```

---

### Task 2: Portfolio CSV parsing (`src/utils/portfolioCsv.ts`)

**Files:**
- Create: `src/utils/portfolioCsv.ts`
- Create: `src/utils/portfolioCsv.test.ts`

**Interfaces:**
- Consumes: PapaParse; `Holding` (Task 1); `Currency`.
- Produces (used by Task 4):
  - `interface UnrecognizedPortfolioCSV { unrecognized: true; headers: string[]; rows: Record<string, string>[] }`
  - `interface PortfolioParserConfig { name: string; detect: (headers: string[]) => boolean; parse: (row: Record<string, string>) => Omit<Holding, 'id'> | null }`
  - `PORTFOLIO_PARSERS: PortfolioParserConfig[]` (IBKR, Wealthsimple)
  - `parsePortfolioText(text: string): Omit<Holding, 'id'>[] | UnrecognizedPortfolioCSV` (pure — testable)
  - `parsePortfolioCSV(file: File): Promise<Omit<Holding, 'id'>[] | UnrecognizedPortfolioCSV>` (thin `file.text()` wrapper)
  - `interface ColumnMapping { ticker: string; quantity: string; totalCost: string; currency?: string }`
  - `mapPortfolioRows(rows: Record<string, string>[], mapping: ColumnMapping): Omit<Holding, 'id'>[]` (generic mapper; `avgCost = totalCost / quantity`; currency defaults to CAD; skips rows that don't parse)

Broker formats drift, so the two named parsers target the documented common exports (headers below) and the generic mapper is the guaranteed path — state this in the file comment.

- **IBKR** (portfolio/positions export): headers `Symbol, Quantity, Cost Basis, Currency` (optionally `Description`). `avgCost = Cost Basis / Quantity`.
- **Wealthsimple** (holdings export): headers `Symbol, Name, Quantity, Book Value, Currency`. `avgCost = Book Value / Quantity`.

- [x] **Step 1: Write the failing tests**

Create `src/utils/portfolioCsv.test.ts`:

```ts
import { mapPortfolioRows, parsePortfolioText } from './portfolioCsv'

const ibkrCsv = `Symbol,Description,Quantity,Cost Basis,Currency
AAPL,APPLE INC,10,1800,USD
VFV,VANGUARD SP500,100,12000,CAD`

const wsCsv = `Symbol,Name,Quantity,Book Value,Currency
XEQT,iShares All-Equity,50,1500,CAD`

const unknownCsv = `Ticker,Units,Total Paid
SHOP,5,600`

describe('parsePortfolioText', () => {
  it('parses the IBKR format', () => {
    const r = parsePortfolioText(ibkrCsv)
    expect(Array.isArray(r)).toBe(true)
    const holdings = r as Exclude<typeof r, { unrecognized: true }>
    expect(holdings).toHaveLength(2)
    expect(holdings[0]).toMatchObject({ ticker: 'AAPL', quantity: 10, avgCost: 180, currency: 'USD' })
    expect(holdings[1]).toMatchObject({ ticker: 'VFV', avgCost: 120, currency: 'CAD' })
  })

  it('parses the Wealthsimple format', () => {
    const r = parsePortfolioText(wsCsv)
    const holdings = r as Exclude<typeof r, { unrecognized: true }>
    expect(holdings[0]).toMatchObject({ ticker: 'XEQT', name: 'iShares All-Equity', quantity: 50, avgCost: 30, currency: 'CAD' })
  })

  it('returns unrecognized with headers + rows for unknown formats', () => {
    const r = parsePortfolioText(unknownCsv)
    expect(r).toMatchObject({ unrecognized: true, headers: ['Ticker', 'Units', 'Total Paid'] })
  })
})

describe('mapPortfolioRows', () => {
  it('maps arbitrary columns and derives avgCost', () => {
    const r = parsePortfolioText(unknownCsv)
    if (!('unrecognized' in r)) throw new Error('expected unrecognized')
    const mapped = mapPortfolioRows(r.rows, { ticker: 'Ticker', quantity: 'Units', totalCost: 'Total Paid' })
    expect(mapped).toHaveLength(1)
    expect(mapped[0]).toMatchObject({ ticker: 'SHOP', quantity: 5, avgCost: 120, currency: 'CAD' })
  })

  it('skips unparseable rows', () => {
    const mapped = mapPortfolioRows(
      [{ Ticker: 'X', Units: 'abc', 'Total Paid': '10' }],
      { ticker: 'Ticker', quantity: 'Units', totalCost: 'Total Paid' },
    )
    expect(mapped).toHaveLength(0)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/portfolioCsv.test.ts`
Expected: FAIL — cannot resolve `./portfolioCsv`.

- [x] **Step 3: Implement**

Create `src/utils/portfolioCsv.ts`:

```ts
// Broker CSV → holdings, following the src/utils/csvParser.ts pattern:
// named parser configs with detect(headers) + parse(row), plus an
// "unrecognized" result that the UI resolves with a generic column mapper.
// Broker export formats drift — the named parsers cover the common IBKR
// and Wealthsimple holdings exports; the mapper is the guaranteed path.

import Papa from 'papaparse'
import type { Currency } from '../services/marketData'
import type { Holding } from '../store/usePortfolioStore'

export interface UnrecognizedPortfolioCSV {
  unrecognized: true
  headers: string[]
  rows: Record<string, string>[]
}

export interface PortfolioParserConfig {
  name: string
  detect: (headers: string[]) => boolean
  parse: (row: Record<string, string>) => Omit<Holding, 'id'> | null
}

function toCurrency(raw: string | undefined): Currency {
  return raw?.trim().toUpperCase() === 'USD' ? 'USD' : 'CAD'
}

function positive(raw: string | undefined): number | null {
  const n = parseFloat(String(raw ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export const PORTFOLIO_PARSERS: PortfolioParserConfig[] = [
  {
    name: 'Interactive Brokers',
    detect: (headers) => headers.includes('Symbol') && headers.includes('Cost Basis'),
    parse: (row) => {
      const quantity = positive(row['Quantity'])
      const costBasis = positive(row['Cost Basis'])
      const ticker = row['Symbol']?.trim()
      if (!ticker || quantity === null || costBasis === null) return null
      return {
        ticker: ticker.toUpperCase(),
        name: row['Description']?.trim() || undefined,
        quantity,
        avgCost: costBasis / quantity,
        currency: toCurrency(row['Currency']),
      }
    },
  },
  {
    name: 'Wealthsimple',
    detect: (headers) => headers.includes('Symbol') && headers.includes('Book Value'),
    parse: (row) => {
      const quantity = positive(row['Quantity'])
      const bookValue = positive(row['Book Value'])
      const ticker = row['Symbol']?.trim()
      if (!ticker || quantity === null || bookValue === null) return null
      return {
        ticker: ticker.toUpperCase(),
        name: row['Name']?.trim() || undefined,
        quantity,
        avgCost: bookValue / quantity,
        currency: toCurrency(row['Currency']),
      }
    },
  },
]

export function parsePortfolioText(
  text: string,
): Omit<Holding, 'id'>[] | UnrecognizedPortfolioCSV {
  const results = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  const headers = results.meta.fields ?? []
  const parser = PORTFOLIO_PARSERS.find((p) => p.detect(headers))
  if (!parser) return { unrecognized: true, headers, rows: results.data }
  const holdings: Omit<Holding, 'id'>[] = []
  for (const row of results.data) {
    const parsed = parser.parse(row)
    if (parsed) holdings.push(parsed)
  }
  return holdings
}

export async function parsePortfolioCSV(
  file: File,
): Promise<Omit<Holding, 'id'>[] | UnrecognizedPortfolioCSV> {
  return parsePortfolioText(await file.text())
}

export interface ColumnMapping {
  ticker: string
  quantity: string
  totalCost: string
  currency?: string
}

export function mapPortfolioRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): Omit<Holding, 'id'>[] {
  const holdings: Omit<Holding, 'id'>[] = []
  for (const row of rows) {
    const ticker = row[mapping.ticker]?.trim()
    const quantity = positive(row[mapping.quantity])
    const totalCost = positive(row[mapping.totalCost])
    if (!ticker || quantity === null || totalCost === null) continue
    holdings.push({
      ticker: ticker.toUpperCase(),
      quantity,
      avgCost: totalCost / quantity,
      currency: toCurrency(mapping.currency ? row[mapping.currency] : undefined),
    })
  }
  return holdings
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/portfolioCsv.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/portfolioCsv.ts src/utils/portfolioCsv.test.ts
git commit -m "feat: portfolio CSV parsing — IBKR + Wealthsimple + generic column mapper"
```

---

### Task 3: Portfolio metrics (`src/utils/investments/portfolioMetrics.ts`)

**Files:**
- Create: `src/utils/investments/portfolioMetrics.ts`
- Create: `src/utils/investments/portfolioMetrics.test.ts`

**Interfaces:**
- Consumes: `Holding` (Task 1).
- Produces (used by Task 5):
  - `bookValue(h: Holding): number` (quantity × avgCost, own currency)
  - `marketValue(h: Holding, price: number): number` (own currency)
  - `holdingPlDollars(h: Holding, price: number): number` and `holdingPlPct(h: Holding, price: number): number | null`
  - `toCad(value: number, currency: 'USD' | 'CAD', fxUsdCad: number): number`
  - `interface PortfolioTotals { investedCad: number; valueCad: number; plCad: number; plPct: number | null }`
  - `portfolioTotals(rows: { holding: Holding; price: number }[], fxUsdCad: number): PortfolioTotals`

- [x] **Step 1: Write the failing tests**

Create `src/utils/investments/portfolioMetrics.test.ts`:

```ts
import type { Holding } from '../../store/usePortfolioStore'
import {
  bookValue, holdingPlDollars, holdingPlPct, marketValue, portfolioTotals, toCad,
} from './portfolioMetrics'

const cadHolding: Holding = { id: 'h1', ticker: 'VFV', quantity: 100, avgCost: 120, currency: 'CAD' }
const usdHolding: Holding = { id: 'h2', ticker: 'AAPL', quantity: 10, avgCost: 180, currency: 'USD' }

describe('per-holding math', () => {
  it('book and market value', () => {
    expect(bookValue(cadHolding)).toBe(12_000)
    expect(marketValue(cadHolding, 150)).toBe(15_000)
  })

  it('P/L in dollars and percent', () => {
    expect(holdingPlDollars(cadHolding, 150)).toBe(3_000)
    expect(holdingPlPct(cadHolding, 150)).toBeCloseTo(25, 10)
    expect(holdingPlPct({ ...cadHolding, quantity: 0 }, 150)).toBeNull()
  })

  it('converts USD to CAD only', () => {
    expect(toCad(100, 'USD', 1.35)).toBeCloseTo(135, 10)
    expect(toCad(100, 'CAD', 1.35)).toBe(100)
  })
})

describe('portfolioTotals', () => {
  it('normalizes everything to CAD', () => {
    const t = portfolioTotals(
      [
        { holding: cadHolding, price: 150 }, // invested 12,000 → 15,000
        { holding: usdHolding, price: 200 }, // invested 1,800 USD → 2,430 CAD; value 2,000 USD → 2,700 CAD
      ],
      1.35,
    )
    expect(t.investedCad).toBeCloseTo(12_000 + 2_430, 6)
    expect(t.valueCad).toBeCloseTo(15_000 + 2_700, 6)
    expect(t.plCad).toBeCloseTo(3_270, 6)
    expect(t.plPct).toBeCloseTo((3_270 / 14_430) * 100, 6)
  })

  it('handles the empty portfolio', () => {
    const t = portfolioTotals([], 1.35)
    expect(t).toEqual({ investedCad: 0, valueCad: 0, plCad: 0, plPct: null })
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/investments/portfolioMetrics.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/utils/investments/portfolioMetrics.ts`:

```ts
// Pure portfolio valuation. Per-holding numbers stay in the holding's own
// currency; totals are normalized to CAD via one USD→CAD rate.

import type { Holding } from '../../store/usePortfolioStore'

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

export function toCad(value: number, currency: 'USD' | 'CAD', fxUsdCad: number): number {
  return currency === 'USD' ? value * fxUsdCad : value
}

export interface PortfolioTotals {
  investedCad: number
  valueCad: number
  plCad: number
  plPct: number | null
}

export function portfolioTotals(
  rows: { holding: Holding; price: number }[],
  fxUsdCad: number,
): PortfolioTotals {
  let investedCad = 0
  let valueCad = 0
  for (const { holding, price } of rows) {
    investedCad += toCad(bookValue(holding), holding.currency, fxUsdCad)
    valueCad += toCad(marketValue(holding, price), holding.currency, fxUsdCad)
  }
  const plCad = valueCad - investedCad
  return { investedCad, valueCad, plCad, plPct: investedCad > 0 ? (plCad / investedCad) * 100 : null }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/investments/portfolioMetrics.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/investments/portfolioMetrics.ts src/utils/investments/portfolioMetrics.test.ts
git commit -m "feat: portfolio valuation metrics with CAD normalization"
```

---

### Task 4: Import UI with column mapper

**Files:**
- Create: `src/components/investments/PortfolioImport.tsx`

**Interfaces:**
- Consumes: `parsePortfolioCSV`, `mapPortfolioRows`, `UnrecognizedPortfolioCSV`, `ColumnMapping` (Task 2); `usePortfolioStore.setHoldings` (Task 1).
- Produces: `PortfolioImport: React.FC` — used by Task 5. Style follows `src/components/budget/CSVUploader.tsx` (hidden file input behind a button).

Flow: pick file → recognized ⇒ `setHoldings` (ids stamped `h-${index}-${Date.now()}`) with a success note naming the parser count; unrecognized ⇒ inline mapper panel with four selects (ticker/quantity/total cost/currency-optional) over the detected headers + Import button.

- [x] **Step 1: Implement**

Create `src/components/investments/PortfolioImport.tsx`:

```tsx
import React, { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import {
  mapPortfolioRows, parsePortfolioCSV, type ColumnMapping, type UnrecognizedPortfolioCSV,
} from '../../utils/portfolioCsv'
import { usePortfolioStore, type Holding } from '../../store/usePortfolioStore'

const selectCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[14px] outline-none focus:border-accent'

export const PortfolioImport: React.FC = () => {
  const setHoldings = usePortfolioStore((s) => s.setHoldings)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<UnrecognizedPortfolioCSV | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({ ticker: '', quantity: '', totalCost: '', currency: '' })
  const [message, setMessage] = useState('')

  const stamp = (rows: Omit<Holding, 'id'>[]): Holding[] =>
    rows.map((r, i) => ({ ...r, id: `h-${i}-${Date.now()}` }))

  const onFile = async (file: File) => {
    setMessage('')
    const result = await parsePortfolioCSV(file)
    if ('unrecognized' in result) {
      setPending(result)
      setMapping({ ticker: result.headers[0] ?? '', quantity: '', totalCost: '', currency: '' })
      return
    }
    setHoldings(stamp(result))
    setPending(null)
    setMessage(`Imported ${result.length} holdings.`)
  }

  const applyMapping = () => {
    if (!pending) return
    const rows = mapPortfolioRows(pending.rows, {
      ...mapping,
      currency: mapping.currency || undefined,
    })
    setHoldings(stamp(rows))
    setMessage(`Imported ${rows.length} holdings via column mapping.`)
    setPending(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
        >
          <Upload className="w-4 h-4" /> Import broker CSV
        </button>
        {message && <span className="text-[13px] text-text-secondary">{message}</span>}
      </div>
      <p className="text-[12px] text-text-secondary">
        Interactive Brokers and Wealthsimple exports are detected automatically; anything else opens the column mapper.
        Importing replaces the current portfolio.
      </p>

      {pending && (
        <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
          <p className="text-[13px] text-text-primary font-medium">
            Unrecognized format — map your columns ({pending.rows.length} rows):
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ['ticker', 'Ticker column'],
              ['quantity', 'Quantity column'],
              ['totalCost', 'Total cost column'],
              ['currency', 'Currency column (optional)'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[13px] text-text-secondary">{label}</span>
                <select
                  className={selectCls}
                  value={mapping[key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {pending.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={applyMapping}
              disabled={!mapping.ticker || !mapping.quantity || !mapping.totalCost}
              className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 disabled:opacity-40"
            >
              Import with mapping
            </button>
            <button onClick={() => setPending(null)} className="px-4 py-2 border border-border rounded-md text-[14px] text-text-secondary hover:text-text-primary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [x] **Step 3: Commit**

```bash
git add src/components/investments/PortfolioImport.tsx
git commit -m "feat: portfolio CSV import UI with generic column mapper"
```

---

### Task 5: Holdings view + Investments page tabs

**Files:**
- Create: `src/components/investments/HoldingRow.tsx`
- Create: `src/components/investments/PortfolioView.tsx`
- Modify: `src/pages/Investments.tsx` (add `Journal | Portfolio` tabs; journal content unchanged from 5a)

**Interfaces:**
- Consumes: store (Task 1), metrics (Task 3), `PortfolioImport` (Task 4), `useCurrentPrice`, `useFxRate`, `allocationPct` from `src/utils/investments/analysisMetrics.ts` (5a), `formatMoney` (4a).
- Produces: `PortfolioView: React.FC`; `HoldingRow: React.FC<{ holding: Holding; fxUsdCad: number; totalValueCad: number; onPrice(id: string, price: number): void }>`.

Price plumbing (hooks can't run in loops): each `HoldingRow` calls `useCurrentPrice(holding.ticker, holding.exchange)` itself, renders its own cells, and reports its resolved price up via `onPrice(id, price)` **from the row's render-safe callback** — implemented as: `PortfolioView` keeps `const [prices, setPrices] = useState<Record<string, number>>({})`; `HoldingRow` invokes `onPrice` inside a `useEffect` watching the resolved price (allowed — it's a state *report*, not synchronous set-state-in-effect: guard with an equality check before calling so the lint rule and re-render loops are satisfied). Fallback price when nothing resolved yet: `holding.avgCost`.

- [x] **Step 1: Implement the row**

Create `src/components/investments/HoldingRow.tsx`:

```tsx
import React, { useEffect } from 'react'
import { useCurrentPrice } from '../../services/marketData'
import type { Holding } from '../../store/usePortfolioStore'
import {
  bookValue, holdingPlDollars, holdingPlPct, marketValue, toCad,
} from '../../utils/investments/portfolioMetrics'
import { allocationPct } from '../../utils/investments/analysisMetrics'
import { formatMoney } from '../planner/format'

interface HoldingRowProps {
  holding: Holding
  fxUsdCad: number
  totalValueCad: number
  onPrice: (id: string, price: number) => void
}

const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)

export const HoldingRow: React.FC<HoldingRowProps> = ({ holding, fxUsdCad, totalValueCad, onPrice }) => {
  const live = useCurrentPrice(holding.ticker, holding.exchange)
  const price = live.data?.value.price ?? holding.avgCost

  useEffect(() => {
    onPrice(holding.id, price) // parent keeps last-reported price; guarded upstream
  }, [holding.id, price, onPrice])

  const valueCad = toCad(marketValue(holding, price), holding.currency, fxUsdCad)

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="py-2 pr-3">
        <span className="text-text-primary font-medium">{holding.ticker}</span>
        <span className="block text-[11px] text-text-secondary">
          {holding.currency}{live.data ? ` · ${live.data.source}${live.data.stale ? ' (stale)' : ''}` : ' · no quote'}
        </span>
      </td>
      <td className="py-2 pr-3 text-right text-text-secondary">{holding.quantity}</td>
      <td className="py-2 pr-3 text-right text-text-secondary">{holding.avgCost.toFixed(2)}</td>
      <td className="py-2 pr-3 text-right text-text-primary">{price.toFixed(2)}</td>
      <td className="py-2 pr-3 text-right text-text-primary">{formatMoney(bookValue(holding))}</td>
      <td className="py-2 pr-3 text-right text-text-primary">{formatMoney(marketValue(holding, price))}</td>
      <td className={`py-2 pr-3 text-right ${holdingPlDollars(holding, price) >= 0 ? 'text-accent' : 'text-error'}`}>
        {formatMoney(holdingPlDollars(holding, price))} ({pct(holdingPlPct(holding, price))})
      </td>
      <td className="py-2 text-right text-text-secondary">{pct(allocationPct(valueCad, totalValueCad))}</td>
    </tr>
  )
}
```

- [x] **Step 2: Implement the view**

Create `src/components/investments/PortfolioView.tsx`:

```tsx
import React, { useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useFxRate } from '../../services/marketData'
import { usePortfolioStore } from '../../store/usePortfolioStore'
import { portfolioTotals } from '../../utils/investments/portfolioMetrics'
import { formatMoney } from '../planner/format'
import { HoldingRow } from './HoldingRow'
import { PortfolioImport } from './PortfolioImport'

export const PortfolioView: React.FC = () => {
  const holdings = usePortfolioStore((s) => s.holdings)
  const importedAt = usePortfolioStore((s) => s.importedAt)
  const clearHoldings = usePortfolioStore((s) => s.clearHoldings)
  const fx = useFxRate('USD', 'CAD')
  const fxUsdCad = fx.data?.value.rate ?? 1

  const [prices, setPrices] = useState<Record<string, number>>({})
  const onPrice = useCallback((id: string, price: number) => {
    setPrices((prev) => (prev[id] === price ? prev : { ...prev, [id]: price }))
  }, [])

  const rows = holdings.map((h) => ({ holding: h, price: prices[h.id] ?? h.avgCost }))
  const totals = portfolioTotals(rows, fxUsdCad)

  return (
    <div className="flex flex-col gap-6">
      <PortfolioImport />

      {holdings.length === 0 ? (
        <div className="themed-card rounded-lg p-10 flex flex-col items-center gap-2">
          <p className="text-text-primary text-[16px] font-medium">No holdings yet</p>
          <p className="text-text-secondary text-[14px]">Import a broker CSV to see your portfolio with live values.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="themed-card rounded-lg p-4"><p className="text-[12px] uppercase text-text-secondary">Total invested (CAD)</p><p className="text-[22px] font-semibold text-text-primary">{formatMoney(totals.investedCad)}</p></div>
            <div className="themed-card rounded-lg p-4"><p className="text-[12px] uppercase text-text-secondary">Value now (CAD)</p><p className="text-[22px] font-semibold text-accent">{formatMoney(totals.valueCad)}</p></div>
            <div className="themed-card rounded-lg p-4"><p className="text-[12px] uppercase text-text-secondary">Total P/L</p><p className={`text-[22px] font-semibold ${totals.plCad >= 0 ? 'text-accent' : 'text-error'}`}>{formatMoney(totals.plCad)}{totals.plPct !== null ? ` (${totals.plPct >= 0 ? '+' : ''}${totals.plPct.toFixed(1)}%)` : ''}</p></div>
          </div>

          <div className="themed-card rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-[13px] min-w-[720px]">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border">
                  <th className="py-2 pr-3 font-medium">Holding</th>
                  <th className="py-2 pr-3 font-medium text-right">Qty</th>
                  <th className="py-2 pr-3 font-medium text-right">Avg cost</th>
                  <th className="py-2 pr-3 font-medium text-right">Price</th>
                  <th className="py-2 pr-3 font-medium text-right">Book</th>
                  <th className="py-2 pr-3 font-medium text-right">Value</th>
                  <th className="py-2 pr-3 font-medium text-right">P/L</th>
                  <th className="py-2 font-medium text-right">Alloc</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <HoldingRow key={h.id} holding={h} fxUsdCad={fxUsdCad} totalValueCad={totals.valueCad} onPrice={onPrice} />
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-3">
              <p className="text-[12px] text-text-secondary">
                Imported {importedAt ? new Date(importedAt).toLocaleString() : 'never'} · USD→CAD {fxUsdCad.toFixed(4)}
                {fx.data ? ` (${fx.data.source}${fx.data.stale ? ', stale' : ''})` : ''}
              </p>
              <button onClick={clearHoldings} className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-error transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Clear portfolio
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [x] **Step 3: Add tabs to the Investments page**

In `src/pages/Investments.tsx` (as rebuilt in 5a): add `const [tab, setTab] = useState<'journal' | 'portfolio'>('journal')`, a tab strip under the header, and render the existing journal content when `tab === 'journal'`, `<PortfolioView />` when `'portfolio'` (move the journal-specific totals + list + modal into the journal branch; the "New analysis" header button too):

```tsx
import { PortfolioView } from '../components/investments/PortfolioView'
```

```tsx
      <div className="flex gap-2">
        {(['journal', 'portfolio'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
              tab === t ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'journal' ? 'Plan vs Actual' : 'Portfolio'}
          </button>
        ))}
      </div>

      {tab === 'journal' ? (
        <>{/* existing 5a journal content unchanged */}</>
      ) : (
        <PortfolioView />
      )}
```

- [x] **Step 4: Verify**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add src/components/investments/HoldingRow.tsx src/components/investments/PortfolioView.tsx src/pages/Investments.tsx
git commit -m "feat: portfolio viewer — holdings table, CAD totals, Investments tabs"
```

---

### Task 6: Sub-phase 5b gate — verification, mobile + 5 themes, PROGRESS.md

**Files:**
- Modify: `docs/superpowers/plans/PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-07-02-phase-5b-portfolio-viewer.md` (check off boxes)

- [x] **Step 1: Full automated gate**

```bash
npx vitest run
npm run lint
npm run build
```

- [x] **Step 2: Manual acceptance — the spec's 5b "Done when"**

*"User imports an IBKR or Wealthsimple CSV and sees a correct, multi-currency portfolio with live values and allocation."*

1. Import a Wealthsimple-format CSV (create a small sample file) → holdings appear, count message shown.
2. Import an unknown-format CSV → column mapper opens; map + import works.
3. Mixed USD/CAD holdings: totals in CAD use the shown FX rate; per-row P/L correct against hand math.
4. Live prices populate rows (source labels); offline → rows fall back to avg cost without breaking.
5. Re-import replaces (not appends); Clear portfolio works; reload persists; backup round-trip includes the portfolio.
6. Journal tab is untouched (5a still works).
7. All 5 themes + 375px viewport (table scrolls horizontally inside its card — the page itself must not scroll horizontally).

- [x] **Step 3: Update PROGRESS.md and commit**

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-5b-portfolio-viewer.md
git commit -m "chore: complete Phase 5b — portfolio viewer verified"
```
