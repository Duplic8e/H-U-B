# Wave 3 — Portfolio Multi-Account & Multi-Position Analyses

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the portfolio hold multiple broker accounts with Replace/Update/Add import modes, and let one investment analysis hold multiple ticker positions — both with versioned zustand migrations so existing users' persisted data survives.

**Architecture:** Two independent workstreams. (1) `usePortfolioStore` gains `account` on `Holding` and an `importHoldings(account, mode, rows)` action; the import UI gains an account name + mode selector; the portfolio table groups by account. (2) `useAnalysisStore` restructures `InvestmentAnalysis` into a container of `Position`s; `AnalysisCard` splits into an analysis shell + per-position card; `AnalysisModal` doubles as "new analysis" and "add position to existing analysis". Both stores get `version: 1` + `migrate`.

**Tech Stack:** React 18 + TypeScript, Zustand v4 persist (`version`/`migrate`), Vitest.

## Global Constraints

- Testing policy: **no TDD.** Implement, then run the named tests; the two store test files are rewritten/extended as specified here. Migration tests are mandatory — they are the only safety net for real users' localStorage.
- Persist keys stay `ledger-portfolio` and `ledger-analyses`. Never rename them.
- Task 1–2 (portfolio) and Task 3–4 (analyses) are independent; they may be done in either order, but finish and commit one workstream before starting the other.
- Test command: `npx vitest run <path>`. Type-check: `npx tsc --noEmit`.
- Zustand v4 `migrate` receives the raw persisted `state` object (not wrapped); return the new-shape state. Old data has version 0 (no version field ⇒ zustand treats it as 0).

---

### Task 1: Portfolio store — accounts + import modes + migration

**Files:**
- Modify: `src/store/usePortfolioStore.ts` (full rewrite below)
- Modify: `src/store/usePortfolioStore.test.ts` (full rewrite below)

**Interfaces:**
- Consumes: nothing.
- Produces (Task 2 depends on these exact names):
  - `Holding` gains `account: string`
  - `type ImportMode = 'replace' | 'update' | 'add'`
  - `importHoldings(account: string, mode: ImportMode, rows: Omit<Holding, 'id' | 'account'>[]): void`
  - `accountNames(holdings: Holding[]): string[]` (exported helper, insertion-ordered unique account names)
  - `setHoldings` is **removed** (Task 2 removes its one caller); `clearHoldings`, `importedAt` unchanged.

- [ ] **Step 1: Rewrite the store**

Replace the entire content of `src/store/usePortfolioStore.ts` with:

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
  /** Broker account this row belongs to (user-supplied at import). */
  account: string
}

export type ImportMode = 'replace' | 'update' | 'add'

export const DEFAULT_ACCOUNT = 'Default'

/** Unique account names in first-seen order. */
export function accountNames(holdings: Holding[]): string[] {
  const seen: string[] = []
  for (const h of holdings) {
    if (!seen.includes(h.account)) seen.push(h.account)
  }
  return seen
}

interface PortfolioState {
  holdings: Holding[]
  importedAt: string | null
  importHoldings: (account: string, mode: ImportMode, rows: Omit<Holding, 'id' | 'account'>[]) => void
  clearHoldings: () => void
}

let importSeq = 0
function stamp(account: string, rows: Omit<Holding, 'id' | 'account'>[]): Holding[] {
  importSeq += 1
  return rows.map((r, i) => ({ ...r, account, id: `h-${importSeq}-${i}-${Date.now()}` }))
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      holdings: [],
      importedAt: null,
      importHoldings: (account, mode, rows) =>
        set((state) => {
          const incoming = stamp(account, rows)
          let holdings: Holding[]
          if (mode === 'replace') {
            // Replace only this account's rows; other accounts untouched.
            holdings = [...state.holdings.filter((h) => h.account !== account), ...incoming]
          } else if (mode === 'update') {
            // Upsert by ticker within the account.
            const kept = state.holdings.filter(
              (h) => h.account !== account || !incoming.some((n) => n.ticker === h.ticker),
            )
            holdings = [...kept, ...incoming]
          } else {
            // 'add': append as-is (new account, or extra rows in an existing one).
            holdings = [...state.holdings, ...incoming]
          }
          return { holdings, importedAt: new Date().toISOString() }
        }),
      clearHoldings: () => set({ holdings: [], importedAt: null }),
    }),
    {
      name: 'ledger-portfolio',
      version: 1,
      // v0 holdings predate accounts — adopt them into the Default account.
      migrate: (persisted, version) => {
        const state = persisted as { holdings?: Array<Record<string, unknown>>; importedAt?: string | null }
        if (version < 1 && Array.isArray(state.holdings)) {
          return {
            ...state,
            holdings: state.holdings.map((h) => ({ account: DEFAULT_ACCOUNT, ...h })),
          } as unknown
        }
        return persisted
      },
    },
  ),
)
```

- [ ] **Step 2: Rewrite the store tests (including the migration test)**

Replace the entire content of `src/store/usePortfolioStore.test.ts` with:

```ts
import { accountNames, usePortfolioStore, type Holding } from './usePortfolioStore'

const initialState = usePortfolioStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePortfolioStore.setState(initialState, true)
})

const rows: Omit<Holding, 'id' | 'account'>[] = [
  { ticker: 'VFV', quantity: 100, avgCost: 120, currency: 'CAD' },
  { ticker: 'AAPL', quantity: 10, avgCost: 180, currency: 'USD' },
]

describe('usePortfolioStore', () => {
  it('replace mode only clobbers the named account', () => {
    const s = usePortfolioStore.getState()
    s.importHoldings('IBKR', 'replace', rows)
    s.importHoldings('Wealthsimple', 'replace', [rows[0]])
    expect(usePortfolioStore.getState().holdings).toHaveLength(3)
    s.importHoldings('IBKR', 'replace', [rows[1]])
    const after = usePortfolioStore.getState().holdings
    expect(after).toHaveLength(2)
    expect(after.filter((h) => h.account === 'Wealthsimple')).toHaveLength(1)
    expect(after.filter((h) => h.account === 'IBKR').map((h) => h.ticker)).toEqual(['AAPL'])
  })

  it('update mode upserts by ticker within the account', () => {
    const s = usePortfolioStore.getState()
    s.importHoldings('IBKR', 'replace', rows)
    s.importHoldings('IBKR', 'update', [{ ticker: 'VFV', quantity: 150, avgCost: 125, currency: 'CAD' }])
    const ibkr = usePortfolioStore.getState().holdings.filter((h) => h.account === 'IBKR')
    expect(ibkr).toHaveLength(2)
    expect(ibkr.find((h) => h.ticker === 'VFV')?.quantity).toBe(150)
    expect(ibkr.find((h) => h.ticker === 'AAPL')?.quantity).toBe(10)
  })

  it('add mode appends without touching existing rows', () => {
    const s = usePortfolioStore.getState()
    s.importHoldings('IBKR', 'replace', rows)
    s.importHoldings('RRSP', 'add', [rows[0]])
    expect(usePortfolioStore.getState().holdings).toHaveLength(3)
    expect(accountNames(usePortfolioStore.getState().holdings)).toEqual(['IBKR', 'RRSP'])
  })

  it('stamps importedAt and clears everything', () => {
    const s = usePortfolioStore.getState()
    s.importHoldings('IBKR', 'replace', rows)
    expect(usePortfolioStore.getState().importedAt).not.toBeNull()
    usePortfolioStore.getState().clearHoldings()
    expect(usePortfolioStore.getState().holdings).toHaveLength(0)
    expect(usePortfolioStore.getState().importedAt).toBeNull()
  })

  it('migrates v0 persisted holdings into the Default account', async () => {
    localStorage.setItem(
      'ledger-portfolio',
      JSON.stringify({
        state: {
          holdings: [{ id: 'h1', ticker: 'VFV', quantity: 100, avgCost: 120, currency: 'CAD' }],
          importedAt: '2026-01-01T00:00:00.000Z',
        },
        version: 0,
      }),
    )
    await usePortfolioStore.persist.rehydrate()
    const s = usePortfolioStore.getState()
    expect(s.holdings).toHaveLength(1)
    expect(s.holdings[0].account).toBe('Default')
    expect(s.holdings[0].ticker).toBe('VFV')
  })
})
```

- [ ] **Step 3: Run store tests**

Run: `npx vitest run src/store/usePortfolioStore.test.ts`
Expected: all pass. `npx tsc --noEmit` will fail right now because `PortfolioImport.tsx` still calls the removed `setHoldings` — that is expected and fixed in Task 2. Do **not** run the full type-check yet.

- [ ] **Step 4: Commit (store only)**

```bash
git add src/store/usePortfolioStore.ts src/store/usePortfolioStore.test.ts
git commit -m "feat: portfolio store accounts, import modes, v1 migration"
```

---

### Task 2: Portfolio UI — account-aware import and grouped view

**Files:**
- Modify: `src/components/investments/PortfolioImport.tsx` (full rewrite below)
- Modify: `src/components/investments/PortfolioView.tsx`
- Modify: `src/components/dashboard/widgets/PortfolioRollupWidget.tsx` (one line)

**Interfaces:**
- Consumes: `importHoldings`, `ImportMode`, `DEFAULT_ACCOUNT`, `accountNames`, `Holding` from Task 1.
- Produces: nothing further.

- [ ] **Step 1: Rewrite PortfolioImport with account + mode controls**

Replace the entire content of `src/components/investments/PortfolioImport.tsx` with:

```tsx
import React, { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import {
  mapPortfolioRows, parsePortfolioCSV, type ColumnMapping, type UnrecognizedPortfolioCSV,
} from '../../utils/portfolioCsv'
import {
  DEFAULT_ACCOUNT, usePortfolioStore, type Holding, type ImportMode,
} from '../../store/usePortfolioStore'

const selectCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[14px] outline-none focus:border-accent'

const MODE_LABELS: Record<ImportMode, string> = {
  replace: 'Replace this account',
  update: 'Update (merge by ticker)',
  add: 'Add as new rows',
}

export const PortfolioImport: React.FC = () => {
  const importHoldings = usePortfolioStore((s) => s.importHoldings)
  const fileRef = useRef<HTMLInputElement>(null)
  const [account, setAccount] = useState(DEFAULT_ACCOUNT)
  const [mode, setMode] = useState<ImportMode>('replace')
  const [pending, setPending] = useState<UnrecognizedPortfolioCSV | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({ ticker: '', quantity: '', totalCost: '', currency: '' })
  const [message, setMessage] = useState('')

  const doImport = (rows: Omit<Holding, 'id' | 'account'>[], via: string) => {
    const acct = account.trim() || DEFAULT_ACCOUNT
    importHoldings(acct, mode, rows)
    setMessage(`Imported ${rows.length} holdings into "${acct}" (${MODE_LABELS[mode].toLowerCase()})${via}.`)
    setPending(null)
  }

  const onFile = async (file: File) => {
    setMessage('')
    const result = await parsePortfolioCSV(file)
    if ('unrecognized' in result) {
      setPending(result)
      setMapping({ ticker: result.headers[0] ?? '', quantity: '', totalCost: '', currency: '' })
      return
    }
    doImport(result, '')
  }

  const applyMapping = () => {
    if (!pending) return
    const rows = mapPortfolioRows(pending.rows, {
      ...mapping,
      currency: mapping.currency || undefined,
    })
    doImport(rows, ' via column mapping')
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
      <div className="flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Account</span>
          <input
            className={selectCls}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="e.g. IBKR margin"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Import mode</span>
          <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
            {(Object.keys(MODE_LABELS) as ImportMode[]).map((m) => (
              <option key={m} value={m}>{MODE_LABELS[m]}</option>
            ))}
          </select>
        </label>
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
        "Replace" clears only the selected account; other accounts are untouched.
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

- [ ] **Step 2: Group PortfolioView by account**

In `src/components/investments/PortfolioView.tsx`:

1. Add `accountNames` to the store import:
   ```tsx
   import { accountNames, usePortfolioStore } from '../../store/usePortfolioStore'
   ```
2. Replace the single holdings table — the whole `<div className="themed-card rounded-lg p-4 overflow-x-auto">…</div>` block (table + "Imported …/Clear portfolio" footer) — with one table per account plus a shared footer:

```tsx
          {accountNames(holdings).map((account) => {
            const rows = holdings.filter((h) => h.account === account)
            return (
              <div key={account} className="themed-card rounded-lg p-4 overflow-x-auto">
                <h3 className="text-[14px] font-semibold text-text-primary mb-2">
                  {account} <span className="text-text-secondary font-normal">({rows.length})</span>
                </h3>
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
                    {rows.map((h) => (
                      <HoldingRow key={h.id} holding={h} fxUsdCad={fxUsdCad} totalValueCad={totals.valueCad} onPrice={onPrice} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-text-secondary">
              Imported {importedAt ? new Date(importedAt).toLocaleString() : 'never'} · USD→CAD {fxUsdCad.toFixed(4)}
              {fx.data ? ` (${fx.data.source}${fx.data.stale ? ', stale' : ''})` : ''}
            </p>
            <button onClick={clearHoldings} className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-error transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear portfolio
            </button>
          </div>
```

The summary cards (`Total invested / Value now / Total P/L`) above stay exactly as they are — they roll up all accounts. Allocation stays portfolio-wide (`totals.valueCad`), which is intentional.

- [ ] **Step 3: Mention accounts in the rollup widget**

In `src/components/dashboard/widgets/PortfolioRollupWidget.tsx`, add the import:

```tsx
import { accountNames, usePortfolioStore } from '../../../store/usePortfolioStore'
```

(replacing the existing `usePortfolioStore` import) and change:

```tsx
        <span className="text-[12px] text-text-secondary">{holdings.length} holdings · CAD</span>
```

to:

```tsx
        <span className="text-[12px] text-text-secondary">{holdings.length} holdings · {accountNames(holdings).length} account{accountNames(holdings).length === 1 ? '' : 's'} · CAD</span>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (must be clean now — the `setHoldings` caller is gone)
Run: `npx vitest run src/store/usePortfolioStore.test.ts src/utils/portfolioCsv.test.ts src/utils/investments/portfolioMetrics.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/investments/PortfolioImport.tsx src/components/investments/PortfolioView.tsx src/components/dashboard/widgets/PortfolioRollupWidget.tsx
git commit -m "feat: account-aware portfolio import and grouped portfolio view"
```

---

### Task 3: Analysis store — positions + migration

**Files:**
- Modify: `src/store/useAnalysisStore.ts` (full rewrite below)
- Modify: `src/store/useAnalysisStore.test.ts` (full rewrite below)

**Interfaces:**
- Consumes: nothing.
- Produces (Task 4 depends on these exact names):
  - `export interface Position { id: string; ticker: string; exchange?: string; plannedAmount: number; startPrice: number; startPriceSource: 'auto' | 'manual'; acted: boolean; lots: BuyLot[] }`
  - `export interface InvestmentAnalysis { id: string; name: string; thesis?: string; analysisDate: string; positions: Position[] }`
  - Actions: `addAnalysis(a)`, `updateAnalysis(id, updates)`, `removeAnalysis(id)`, `addPosition(analysisId, position)`, `removePosition(analysisId, positionId)`, `updatePosition(analysisId, positionId, updates)`, `addLot(analysisId, positionId, lot)`, `removeLot(analysisId, positionId, lotId)`
  - `BuyLot` unchanged.

- [ ] **Step 1: Rewrite the store**

Replace the entire content of `src/store/useAnalysisStore.ts` with:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BuyLot {
  id: string
  date: string // YYYY-MM-DD
  amountInvested: number
  price: number
}

export interface Position {
  id: string
  ticker: string
  exchange?: string
  plannedAmount: number
  startPrice: number
  startPriceSource: 'auto' | 'manual'
  acted: boolean
  lots: BuyLot[]
}

export interface InvestmentAnalysis {
  id: string
  name: string
  thesis?: string
  analysisDate: string // YYYY-MM-DD
  positions: Position[]
}

interface AnalysisState {
  analyses: InvestmentAnalysis[]
  addAnalysis: (a: InvestmentAnalysis) => void
  updateAnalysis: (id: string, updates: Partial<InvestmentAnalysis>) => void
  removeAnalysis: (id: string) => void
  addPosition: (analysisId: string, position: Position) => void
  removePosition: (analysisId: string, positionId: string) => void
  updatePosition: (analysisId: string, positionId: string, updates: Partial<Position>) => void
  addLot: (analysisId: string, positionId: string, lot: BuyLot) => void
  removeLot: (analysisId: string, positionId: string, lotId: string) => void
}

function mapAnalysis(
  analyses: InvestmentAnalysis[],
  analysisId: string,
  fn: (a: InvestmentAnalysis) => InvestmentAnalysis,
): InvestmentAnalysis[] {
  return analyses.map((a) => (a.id === analysisId ? fn(a) : a))
}

function mapPosition(
  analyses: InvestmentAnalysis[],
  analysisId: string,
  positionId: string,
  fn: (p: Position) => Position,
): InvestmentAnalysis[] {
  return mapAnalysis(analyses, analysisId, (a) => ({
    ...a,
    positions: a.positions.map((p) => (p.id === positionId ? fn(p) : p)),
  }))
}

/** Shape persisted before positions existed (store version 0). */
interface LegacyAnalysis {
  id: string
  ticker: string
  exchange?: string
  thesis?: string
  plannedAmount: number
  analysisDate: string
  startPrice: number
  startPriceSource: 'auto' | 'manual'
  acted: boolean
  lots: BuyLot[]
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      analyses: [],
      addAnalysis: (a) => set((state) => ({ analyses: [...state.analyses, a] })),
      updateAnalysis: (id, updates) =>
        set((state) => ({ analyses: mapAnalysis(state.analyses, id, (a) => ({ ...a, ...updates })) })),
      removeAnalysis: (id) =>
        set((state) => ({ analyses: state.analyses.filter((a) => a.id !== id) })),
      addPosition: (analysisId, position) =>
        set((state) => ({
          analyses: mapAnalysis(state.analyses, analysisId, (a) => ({
            ...a,
            positions: [...a.positions, position],
          })),
        })),
      removePosition: (analysisId, positionId) =>
        set((state) => ({
          analyses: mapAnalysis(state.analyses, analysisId, (a) => ({
            ...a,
            positions: a.positions.filter((p) => p.id !== positionId),
          })),
        })),
      updatePosition: (analysisId, positionId, updates) =>
        set((state) => ({
          analyses: mapPosition(state.analyses, analysisId, positionId, (p) => ({ ...p, ...updates })),
        })),
      addLot: (analysisId, positionId, lot) =>
        set((state) => ({
          analyses: mapPosition(state.analyses, analysisId, positionId, (p) => ({
            ...p,
            acted: true,
            lots: [...p.lots, lot],
          })),
        })),
      removeLot: (analysisId, positionId, lotId) =>
        set((state) => ({
          analyses: mapPosition(state.analyses, analysisId, positionId, (p) => ({
            ...p,
            lots: p.lots.filter((l) => l.id !== lotId),
          })),
        })),
    }),
    {
      name: 'ledger-analyses',
      version: 1,
      // v0: one flat ticker per analysis → wrap it as the single position.
      migrate: (persisted, version) => {
        if (version >= 1) return persisted
        const state = persisted as { analyses?: LegacyAnalysis[] }
        if (!Array.isArray(state.analyses)) return persisted
        const analyses: InvestmentAnalysis[] = state.analyses.map((old) => ({
          id: old.id,
          name: old.ticker,
          thesis: old.thesis,
          analysisDate: old.analysisDate,
          positions: [
            {
              id: `${old.id}-p1`,
              ticker: old.ticker,
              exchange: old.exchange,
              plannedAmount: old.plannedAmount,
              startPrice: old.startPrice,
              startPriceSource: old.startPriceSource,
              acted: old.acted,
              lots: old.lots ?? [],
            },
          ],
        }))
        return { ...state, analyses } as unknown
      },
    },
  ),
)
```

- [ ] **Step 2: Rewrite the store tests**

Replace the entire content of `src/store/useAnalysisStore.test.ts` with:

```ts
import { useAnalysisStore, type InvestmentAnalysis, type Position } from './useAnalysisStore'

const initialState = useAnalysisStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAnalysisStore.setState(initialState, true)
})

const position: Position = {
  id: 'p1', ticker: 'AAPL', plannedAmount: 10_000,
  startPrice: 200, startPriceSource: 'auto', acted: false, lots: [],
}

const analysis: InvestmentAnalysis = {
  id: 'a1', name: 'Big Tech 2026', analysisDate: '2026-01-15', positions: [position],
}

describe('useAnalysisStore', () => {
  it('adds, updates and removes analyses', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    expect(useAnalysisStore.getState().analyses).toHaveLength(1)
    s.updateAnalysis('a1', { name: 'Renamed' })
    expect(useAnalysisStore.getState().analyses[0].name).toBe('Renamed')
    s.removeAnalysis('a1')
    expect(useAnalysisStore.getState().analyses).toHaveLength(0)
  })

  it('adds, updates and removes positions within an analysis', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    s.addPosition('a1', { ...position, id: 'p2', ticker: 'MSFT' })
    expect(useAnalysisStore.getState().analyses[0].positions.map((p) => p.ticker)).toEqual(['AAPL', 'MSFT'])
    s.updatePosition('a1', 'p2', { acted: true })
    expect(useAnalysisStore.getState().analyses[0].positions[1].acted).toBe(true)
    s.removePosition('a1', 'p1')
    expect(useAnalysisStore.getState().analyses[0].positions.map((p) => p.id)).toEqual(['p2'])
  })

  it('manages lots per position and marks acted', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    s.addLot('a1', 'p1', { id: 'l1', date: '2026-01-20', amountInvested: 5_000, price: 205 })
    s.addLot('a1', 'p1', { id: 'l2', date: '2026-02-20', amountInvested: 3_500, price: 190 })
    const p = useAnalysisStore.getState().analyses[0].positions[0]
    expect(p.lots).toHaveLength(2)
    expect(p.acted).toBe(true) // adding a lot implies acted
    s.removeLot('a1', 'p1', 'l1')
    expect(useAnalysisStore.getState().analyses[0].positions[0].lots.map((l) => l.id)).toEqual(['l2'])
  })

  it('persists under the ledger-analyses key', () => {
    useAnalysisStore.getState().addAnalysis(analysis)
    expect(localStorage.getItem('ledger-analyses')).toContain('"AAPL"')
  })

  it('migrates v0 single-ticker analyses into positions', async () => {
    localStorage.setItem(
      'ledger-analyses',
      JSON.stringify({
        state: {
          analyses: [{
            id: 'old1', ticker: 'SHOP', exchange: 'TSX', thesis: 'e-comm rebound',
            plannedAmount: 5_000, analysisDate: '2025-11-01', startPrice: 95,
            startPriceSource: 'manual', acted: true,
            lots: [{ id: 'l1', date: '2025-11-05', amountInvested: 2_000, price: 97 }],
          }],
        },
        version: 0,
      }),
    )
    await useAnalysisStore.persist.rehydrate()
    const a = useAnalysisStore.getState().analyses[0]
    expect(a.name).toBe('SHOP')
    expect(a.thesis).toBe('e-comm rebound')
    expect(a.positions).toHaveLength(1)
    expect(a.positions[0]).toMatchObject({
      ticker: 'SHOP', exchange: 'TSX', plannedAmount: 5_000,
      startPrice: 95, startPriceSource: 'manual', acted: true,
    })
    expect(a.positions[0].lots).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run the store tests**

Run: `npx vitest run src/store/useAnalysisStore.test.ts`
Expected: all pass. `npx tsc --noEmit` will fail (UI still uses the old shape) — expected until Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/store/useAnalysisStore.ts src/store/useAnalysisStore.test.ts
git commit -m "feat: analyses hold multiple positions, v1 migration wraps legacy shape"
```

---

### Task 4: Analysis UI — position cards, add-position modal, page totals

**Files:**
- Create: `src/components/investments/PositionCard.tsx`
- Modify: `src/components/investments/AnalysisCard.tsx` (full rewrite below)
- Modify: `src/components/investments/AnalysisModal.tsx` (full rewrite below)
- Modify: `src/pages/Investments.tsx` (totals + card usage)

**Interfaces:**
- Consumes: everything Task 3 produces; `useHistoricalPrice`, `useCurrentPrice` from `../../services/marketData`; metric helpers from `analysisMetrics.ts` (unchanged — they already operate on `BuyLot[]`).
- Produces: `AnalysisModal` props become `{ isOpen: boolean; onClose: () => void; analysisId?: string }` — with `analysisId` it adds a position to that analysis instead of creating a new analysis.

- [ ] **Step 1: Create PositionCard (the old per-ticker card body)**

Create `src/components/investments/PositionCard.tsx`:

```tsx
import React, { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCurrentPrice } from '../../services/marketData'
import { useAnalysisStore, type Position } from '../../store/useAnalysisStore'
import {
  allocationPct, avgCostBasis, counterfactualValue, currentValue,
  plDollars, plPct, thesisChangePct, totalInvested, variance,
} from '../../utils/investments/analysisMetrics'
import { formatMoney } from '../planner/format'

interface PositionCardProps {
  analysisId: string
  analysisDate: string
  position: Position
  totals: { plannedAll: number; currentAll: number }
}

const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)

export const PositionCard: React.FC<PositionCardProps> = ({ analysisId, analysisDate, position, totals }) => {
  const { updatePosition, removePosition, addLot, removeLot } = useAnalysisStore.getState()
  const price = useCurrentPrice(position.ticker, position.exchange)
  const currentPrice = price.data?.value.price ?? position.startPrice
  const [lotAmount, setLotAmount] = useState(1000)
  const [lotPrice, setLotPrice] = useState(currentPrice)
  const [lotDate, setLotDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [manualPriceDraft, setManualPriceDraft] = useState('')
  const isOverridden = price.data?.source === 'override'

  const handleManualPriceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = Number(manualPriceDraft)
    if (Number.isFinite(parsed) && parsed > 0) {
      price.setManual(parsed)
      setManualPriceDraft('')
    }
  }

  const invested = totalInvested(position.lots)
  const value = currentValue(position.lots, currentPrice)
  const counterfactual = counterfactualValue(position.plannedAmount, position.startPrice, currentPrice)

  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-[15px] font-semibold text-text-primary">
            {position.ticker}
            {position.exchange ? <span className="text-text-secondary text-[13px]"> · {position.exchange}</span> : null}
          </h4>
          <p className="text-[12px] text-text-secondary">
            Analyzed {analysisDate} at {position.startPrice.toFixed(2)} ({position.startPriceSource}) ·
            now {currentPrice.toFixed(2)}
            {price.data ? ` (${price.data.source}${price.data.stale ? ', stale' : ''})` : ''}
            <span className="text-accent"> {pct(thesisChangePct(position.startPrice, currentPrice))}</span>
          </p>
          {price.status === 'error' && (
            <p className="text-[12px] text-error">live price unavailable — using start price</p>
          )}
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <form onSubmit={handleManualPriceSubmit} className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                value={manualPriceDraft}
                onChange={(e) => setManualPriceDraft(e.target.value)}
                placeholder="Manual price"
                className="w-24 bg-bg-primary/50 border border-border rounded px-2 py-1 text-[12px] text-text-primary focus:border-accent focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-bg-primary/50 border border-border rounded text-[12px] text-text-primary hover:text-accent transition-colors"
              >
                Set
              </button>
            </form>
            {isOverridden && (
              <button
                type="button"
                onClick={() => price.clearManual()}
                className="text-[12px] text-text-secondary hover:text-accent underline decoration-dotted"
              >
                Clear override
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => price.refresh(true)} aria-label="Refresh price" className="p-1.5 text-text-secondary hover:text-accent">
            <RefreshCw className={`w-4 h-4 ${price.status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => removePosition(analysisId, position.id)} aria-label="Delete position" className="p-1.5 text-text-secondary hover:text-error">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
        <div><p className="text-text-secondary">Planned</p><p className="text-text-primary font-medium">{formatMoney(position.plannedAmount)}</p></div>
        <div><p className="text-text-secondary">Invested</p><p className="text-text-primary font-medium">{formatMoney(invested)} <span className="text-text-secondary">({formatMoney(variance(position.plannedAmount, position.lots))} vs plan)</span></p></div>
        <div><p className="text-text-secondary">Value now / P&L</p><p className="text-text-primary font-medium">{formatMoney(value)} · {pct(plPct(position.lots, currentPrice))} ({formatMoney(plDollars(position.lots, currentPrice))})</p></div>
        <div><p className="text-text-secondary">If fully executed</p><p className="text-text-primary font-medium">{formatMoney(counterfactual)}</p></div>
        <div><p className="text-text-secondary">Avg cost</p><p className="text-text-primary font-medium">{avgCostBasis(position.lots)?.toFixed(2) ?? '—'}</p></div>
        <div><p className="text-text-secondary">Allocation at start</p><p className="text-text-primary font-medium">{pct(allocationPct(position.plannedAmount, totals.plannedAll))}</p></div>
        <div><p className="text-text-secondary">Allocation now</p><p className="text-text-primary font-medium">{pct(allocationPct(value, totals.currentAll))}</p></div>
        <div><p className="text-text-secondary">Acted</p><p className="text-text-primary font-medium">
          <button onClick={() => updatePosition(analysisId, position.id, { acted: !position.acted })} className="underline decoration-dotted hover:text-accent">
            {position.acted ? 'Yes' : 'No — still watching'}
          </button>
        </p></div>
      </div>

      <details className="text-[13px]">
        <summary className="cursor-pointer text-text-secondary hover:text-accent">
          Buy lots ({position.lots.length})
        </summary>
        <div className="flex flex-col gap-2 mt-2">
          {position.lots.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-border pb-1">
              <span className="text-text-secondary">{l.date} — {formatMoney(l.amountInvested)} @ {l.price.toFixed(2)}</span>
              <button onClick={() => removeLot(analysisId, position.id, l.id)} aria-label="Remove lot" className="text-text-secondary hover:text-error">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <input type="date" className="bg-bg-primary/50 border border-border rounded px-2 py-1 text-text-primary" value={lotDate} onChange={(e) => setLotDate(e.target.value)} />
            <input type="number" className="bg-bg-primary/50 border border-border rounded px-2 py-1 text-text-primary w-28" value={lotAmount} onChange={(e) => setLotAmount(Number(e.target.value))} placeholder="Amount $" />
            <input type="number" step={0.01} className="bg-bg-primary/50 border border-border rounded px-2 py-1 text-text-primary w-24" value={lotPrice} onChange={(e) => setLotPrice(Number(e.target.value))} placeholder="Price" />
            <button
              onClick={() => lotAmount > 0 && lotPrice > 0 && addLot(analysisId, position.id, { id: `lot-${Date.now()}`, date: lotDate, amountInvested: lotAmount, price: lotPrice })}
              className="flex items-center gap-1 text-text-secondary hover:text-accent"
            >
              <Plus className="w-4 h-4" /> Add lot
            </button>
          </div>
        </div>
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite AnalysisCard as the analysis shell**

Replace the entire content of `src/components/investments/AnalysisCard.tsx` with:

```tsx
import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAnalysisStore, type InvestmentAnalysis } from '../../store/useAnalysisStore'
import { AnalysisModal } from './AnalysisModal'
import { PositionCard } from './PositionCard'

interface AnalysisCardProps {
  analysis: InvestmentAnalysis
  totals: { plannedAll: number; currentAll: number }
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, totals }) => {
  const removeAnalysis = useAnalysisStore((s) => s.removeAnalysis)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[17px] font-semibold text-text-primary">{analysis.name}</h3>
          <p className="text-[12px] text-text-secondary">
            Analyzed {analysis.analysisDate} · {analysis.positions.length} position{analysis.positions.length === 1 ? '' : 's'}
          </p>
          {analysis.thesis && <p className="text-[13px] text-text-secondary mt-1 italic">{analysis.thesis}</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setAddOpen(true)} aria-label="Add position" className="flex items-center gap-1 p-1.5 text-[13px] text-text-secondary hover:text-accent">
            <Plus className="w-4 h-4" /> Position
          </button>
          <button onClick={() => removeAnalysis(analysis.id)} aria-label="Delete analysis" className="p-1.5 text-text-secondary hover:text-error">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {analysis.positions.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No positions yet — add one to start tracking.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {analysis.positions.map((p) => (
            <PositionCard key={p.id} analysisId={analysis.id} analysisDate={analysis.analysisDate} position={p} totals={totals} />
          ))}
        </div>
      )}

      <AnalysisModal isOpen={addOpen} onClose={() => setAddOpen(false)} analysisId={analysis.id} />
    </div>
  )
}
```

- [ ] **Step 3: Rewrite AnalysisModal (create analysis OR add position)**

Replace the entire content of `src/components/investments/AnalysisModal.tsx` with:

```tsx
import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useHistoricalPrice } from '../../services/marketData'
import { useAnalysisStore, type Position } from '../../store/useAnalysisStore'

interface AnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  /** When set, adds a position to this analysis instead of creating a new analysis. */
  analysisId?: string
}

const inputCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent w-full'

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, analysisId }) => {
  const addAnalysis = useAnalysisStore((s) => s.addAnalysis)
  const addPosition = useAnalysisStore((s) => s.addPosition)
  const existing = useAnalysisStore((s) => (analysisId ? s.analyses.find((a) => a.id === analysisId) : undefined))
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [exchange, setExchange] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [plannedAmount, setPlannedAmount] = useState(10000)
  const [thesis, setThesis] = useState('')
  const [manualPrice, setManualPrice] = useState<number | null>(null)

  // Positions added to an existing analysis price against its analysis date.
  const effectiveDate = existing ? existing.analysisDate : date
  const hist = useHistoricalPrice(ticker, exchange || undefined, effectiveDate)
  const fetchedPrice = hist.data?.value.close
  const effectivePrice = manualPrice ?? fetchedPrice ?? 0

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const canSave = ticker.trim() !== '' && plannedAmount > 0 && effectiveDate !== '' && effectivePrice > 0

  const save = () => {
    const position: Position = {
      id: `pos-${Date.now()}`,
      ticker: ticker.trim().toUpperCase(),
      exchange: exchange.trim() || undefined,
      plannedAmount,
      startPrice: effectivePrice,
      startPriceSource: manualPrice !== null ? 'manual' : 'auto',
      acted: false,
      lots: [],
    }
    if (analysisId) {
      addPosition(analysisId, position)
    } else {
      addAnalysis({
        id: `an-${Date.now()}`,
        name: name.trim() || position.ticker,
        thesis: thesis.trim() || undefined,
        analysisDate: date,
        positions: [position],
      })
    }
    setName(''); setTicker(''); setExchange(''); setThesis(''); setManualPrice(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={analysisId ? 'Add position' : 'New analysis'}>
      <div className="themed-card rounded-lg p-6 w-full max-w-lg flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-text-primary">{analysisId ? `Add position — ${existing?.name ?? ''}` : 'New analysis'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!analysisId && (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">Analysis name (defaults to ticker)</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Big Tech 2026" />
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">Ticker</span>
            <input className={inputCls} value={ticker} onChange={(e) => { setTicker(e.target.value); setManualPrice(null) }} placeholder="AAPL" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">Exchange (optional)</span>
            <input className={inputCls} value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="TSX" />
          </label>
          {!analysisId && (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-text-secondary">Analysis date</span>
              <input type="date" className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setManualPrice(null) }} />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">Planned amount ($)</span>
            <input type="number" className={inputCls} value={plannedAmount} onChange={(e) => setPlannedAmount(Number(e.target.value))} />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">
            Start price {manualPrice !== null
              ? '(manual)'
              : fetchedPrice !== undefined
                ? `(auto — ${hist.data?.source}${hist.data?.stale ? ', stale' : ''})`
                : hist.status === 'loading'
                  ? '(fetching…)'
                  : '(enter manually or pick ticker + date)'}
          </span>
          <div className="flex gap-2">
            <input
              type="number"
              step={0.01}
              className={inputCls}
              value={effectivePrice || ''}
              onChange={(e) => setManualPrice(Number(e.target.value))}
            />
            {manualPrice !== null && fetchedPrice !== undefined && (
              <button onClick={() => setManualPrice(null)} className="text-[12px] text-text-secondary hover:text-accent whitespace-nowrap">
                Use fetched ({fetchedPrice.toFixed(2)})
              </button>
            )}
          </div>
        </label>

        {!analysisId && (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">Thesis (optional)</span>
            <textarea className={`${inputCls} min-h-[70px]`} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Why this investment?" />
          </label>
        )}

        <button
          onClick={save}
          disabled={!canSave}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {analysisId ? 'Add position' : 'Save analysis'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update Investments.tsx totals to iterate positions**

In `src/pages/Investments.tsx`, replace the three totals lines:

```tsx
  const plannedAll = analyses.reduce((s, a) => s + a.plannedAmount, 0)
  const investedAll = analyses.reduce((s, a) => s + totalInvested(a.lots), 0)
  const currentAll = analyses.reduce(
    (s, a) => s + currentValue(a.lots, priceFor(a.ticker, a.exchange, a.startPrice)),
    0,
  )
```

with:

```tsx
  const positionsAll = analyses.flatMap((a) => a.positions)
  const plannedAll = positionsAll.reduce((s, p) => s + p.plannedAmount, 0)
  const investedAll = positionsAll.reduce((s, p) => s + totalInvested(p.lots), 0)
  const currentAll = positionsAll.reduce(
    (s, p) => s + currentValue(p.lots, priceFor(p.ticker, p.exchange, p.startPrice)),
    0,
  )
```

Nothing else in the file changes (`AnalysisCard` props are unchanged; the page-level `AnalysisModal` without `analysisId` still creates new analyses).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: clean — this is the step that proves every old-shape usage was updated. If it names other files still reading `analysis.ticker` / `analysis.lots`, fix them the same way (positions loop) and report which ones they were.

Run: `npx vitest run src/store/useAnalysisStore.test.ts src/utils/investments/analysisMetrics.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/investments/PositionCard.tsx src/components/investments/AnalysisCard.tsx src/components/investments/AnalysisModal.tsx src/pages/Investments.tsx
git commit -m "feat: multi-position analyses — position cards and add-position modal"
```

---

### Task 5: Full-suite verification

- [ ] **Step 1: Run everything**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass / clean. Report (don't fix) unrelated failures.

- [ ] **Step 2: Manual smoke of both migrations (if a browser is available)**

With existing data in localStorage from before this wave: load the app, open Investments → Portfolio (holdings appear under "Default"), and Plan vs Actual (old analyses appear with one position each, lots intact). If no prior data exists, create an analysis and import a CSV, reload, and confirm both survive.
