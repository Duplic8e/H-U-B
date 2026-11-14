# Phase 5a — Investments: Plan vs Actual (Decision Journal)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock Investments stub with a decision journal: record an investment analysis (ticker + planned amount + date, start price auto-filled from historical data), track whether/how you actually acted (multiple buy lots), and see plan-vs-actual variance, live P/L, and the counterfactual "how the thesis would have done."

**Architecture:** One new persisted store (`ledger-analyses`) holds analyses + lots. All derived numbers live in a pure `analysisMetrics.ts` module. UI: an entry modal (historical-price autofill with manual override), an analysis card with live price + lots editor, and a totals header on the rebuilt Investments page. The v1.0 mocks (`useInvestmentStore`, `InvestmentTrackerWidget`, `SetTargetModal`) are deleted. **Not** connected to 5b's portfolio.

**Tech Stack:** React 19, Zustand v5 `persist`, `src/services/marketData` (`useCurrentPrice`, `useHistoricalPrice`, `Resolved<T>`), lucide-react, Tailwind v4, Vitest (globals: true).

**Spec authority:** `docs/superpowers/specs/2026-07-02-ledger-v2-design.md` → Phase 5a. **Prerequisites:** Phases 1–3 (market data + backup). Phase 4 not required.

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **Local-first persistence.** New store `ledger-analyses` via Zustand `persist`, following `src/store/useCompensationStore.ts`.
- **Backup coverage.** `'ledger-analyses'` appended to `BACKUP_KEYS` in `src/utils/backup.ts` + registration test (Task 1).
- **Live data always has a manual fallback.** Start price autofill is overridable; live current price falls back to cache; a manual current-price override is available via the existing `setManual` on `useCurrentPrice`.
- **No hardcoded colors — theme CSS variables only.** ALL 5 themes: `geometric`, `tactical`, `luxury`, `aurora`, `glass`.
- **Mobile + all 5 themes are acceptance gates** (final task).
- **Testing is minimal by direction of the user (2026-07-02):** store + metrics modules get tests; modal/card/page components get NO dedicated test files — manual gate covers them.
- **Commit after every task.** Lint enforces `react-hooks/set-state-in-effect`.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

---

### Task 1: Analysis store + backup registration

**Files:**
- Create: `src/store/useAnalysisStore.ts`
- Create: `src/store/useAnalysisStore.test.ts`
- Modify: `src/utils/backup.ts` (append `'ledger-analyses'` to `BACKUP_KEYS`)
- Modify: `src/utils/backup.test.ts` (registration test)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Tasks 2–5):
  - `interface BuyLot { id: string; date: string; amountInvested: number; price: number }`
  - `interface InvestmentAnalysis { id: string; ticker: string; exchange?: string; thesis?: string; plannedAmount: number; analysisDate: string; startPrice: number; startPriceSource: 'auto' | 'manual'; acted: boolean; lots: BuyLot[] }`
  - `useAnalysisStore` — `{ analyses: InvestmentAnalysis[]; addAnalysis(a: InvestmentAnalysis): void; updateAnalysis(id: string, updates: Partial<InvestmentAnalysis>): void; removeAnalysis(id: string): void; addLot(analysisId: string, lot: BuyLot): void; removeLot(analysisId: string, lotId: string): void }`

- [x] **Step 1: Write the failing tests**

Create `src/store/useAnalysisStore.test.ts`:

```ts
import { useAnalysisStore, type InvestmentAnalysis } from './useAnalysisStore'

const initialState = useAnalysisStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAnalysisStore.setState(initialState, true)
})

const analysis: InvestmentAnalysis = {
  id: 'a1', ticker: 'AAPL', plannedAmount: 10_000, analysisDate: '2026-01-15',
  startPrice: 200, startPriceSource: 'auto', acted: false, lots: [],
}

describe('useAnalysisStore', () => {
  it('adds, updates and removes analyses', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    expect(useAnalysisStore.getState().analyses).toHaveLength(1)
    s.updateAnalysis('a1', { acted: true, startPrice: 210, startPriceSource: 'manual' })
    expect(useAnalysisStore.getState().analyses[0]).toMatchObject({ acted: true, startPrice: 210 })
    s.removeAnalysis('a1')
    expect(useAnalysisStore.getState().analyses).toHaveLength(0)
  })

  it('manages lots per analysis and marks acted', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    s.addLot('a1', { id: 'l1', date: '2026-01-20', amountInvested: 5_000, price: 205 })
    s.addLot('a1', { id: 'l2', date: '2026-02-20', amountInvested: 3_500, price: 190 })
    const a = useAnalysisStore.getState().analyses[0]
    expect(a.lots).toHaveLength(2)
    expect(a.acted).toBe(true) // adding a lot implies acted
    s.removeLot('a1', 'l1')
    expect(useAnalysisStore.getState().analyses[0].lots.map((l) => l.id)).toEqual(['l2'])
  })

  it('persists under the ledger-analyses key', () => {
    useAnalysisStore.getState().addAnalysis(analysis)
    expect(localStorage.getItem('ledger-analyses')).toContain('"AAPL"')
  })
})
```

Add to `src/utils/backup.test.ts` next to the other registration tests:

```ts
  it('registers the analyses store key', () => {
    expect(BACKUP_KEYS).toContain('ledger-analyses')
  })
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/useAnalysisStore.test.ts src/utils/backup.test.ts`
Expected: FAIL (unresolved module; key missing).

- [x] **Step 3: Implement**

Create `src/store/useAnalysisStore.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BuyLot {
  id: string
  date: string // YYYY-MM-DD
  amountInvested: number
  price: number
}

export interface InvestmentAnalysis {
  id: string
  ticker: string
  exchange?: string
  thesis?: string
  plannedAmount: number
  analysisDate: string // YYYY-MM-DD
  startPrice: number
  startPriceSource: 'auto' | 'manual'
  acted: boolean
  lots: BuyLot[]
}

interface AnalysisState {
  analyses: InvestmentAnalysis[]
  addAnalysis: (a: InvestmentAnalysis) => void
  updateAnalysis: (id: string, updates: Partial<InvestmentAnalysis>) => void
  removeAnalysis: (id: string) => void
  addLot: (analysisId: string, lot: BuyLot) => void
  removeLot: (analysisId: string, lotId: string) => void
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      analyses: [],
      addAnalysis: (a) => set((state) => ({ analyses: [...state.analyses, a] })),
      updateAnalysis: (id, updates) =>
        set((state) => ({
          analyses: state.analyses.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      removeAnalysis: (id) =>
        set((state) => ({ analyses: state.analyses.filter((a) => a.id !== id) })),
      addLot: (analysisId, lot) =>
        set((state) => ({
          analyses: state.analyses.map((a) =>
            a.id === analysisId ? { ...a, acted: true, lots: [...a.lots, lot] } : a,
          ),
        })),
      removeLot: (analysisId, lotId) =>
        set((state) => ({
          analyses: state.analyses.map((a) =>
            a.id === analysisId ? { ...a, lots: a.lots.filter((l) => l.id !== lotId) } : a,
          ),
        })),
    }),
    { name: 'ledger-analyses' },
  ),
)
```

In `src/utils/backup.ts`, append `'ledger-analyses'` to `BACKUP_KEYS` (after `'ledger-planner'`).

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/useAnalysisStore.test.ts src/utils/backup.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/store/useAnalysisStore.ts src/store/useAnalysisStore.test.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: investment analysis store (ledger-analyses) with lots, registered in backup"
```

---

### Task 2: Analysis metrics (`src/utils/investments/analysisMetrics.ts`)

**Files:**
- Create: `src/utils/investments/analysisMetrics.ts`
- Create: `src/utils/investments/analysisMetrics.test.ts`

**Interfaces:**
- Consumes: `BuyLot`, `InvestmentAnalysis` types (Task 1).
- Produces (used by Tasks 4–5):
  - `sharesFromLots(lots: BuyLot[]): number` (Σ amount/price)
  - `totalInvested(lots: BuyLot[]): number`
  - `avgCostBasis(lots: BuyLot[]): number | null` (null when no shares)
  - `currentValue(lots: BuyLot[], currentPrice: number): number`
  - `plDollars(lots: BuyLot[], currentPrice: number): number` and `plPct(lots: BuyLot[], currentPrice: number): number | null`
  - `thesisChangePct(startPrice: number, currentPrice: number): number | null` (% since analysis)
  - `counterfactualValue(plannedAmount: number, startPrice: number, currentPrice: number): number` (what the full planned amount at start price would be worth)
  - `variance(plannedAmount: number, lots: BuyLot[]): number` (invested − planned; negative = under-invested)
  - `allocationPct(part: number, total: number): number | null`

- [x] **Step 1: Write the failing tests**

Create `src/utils/investments/analysisMetrics.test.ts`:

```ts
import type { BuyLot } from '../../store/useAnalysisStore'
import {
  allocationPct, avgCostBasis, counterfactualValue, currentValue,
  plDollars, plPct, sharesFromLots, thesisChangePct, totalInvested, variance,
} from './analysisMetrics'

const lots: BuyLot[] = [
  { id: 'l1', date: '2026-01-20', amountInvested: 5_000, price: 100 }, // 50 shares
  { id: 'l2', date: '2026-02-20', amountInvested: 3_000, price: 150 }, // 20 shares
]

describe('lot math', () => {
  it('computes shares, invested, and average cost', () => {
    expect(sharesFromLots(lots)).toBeCloseTo(70, 10)
    expect(totalInvested(lots)).toBe(8_000)
    expect(avgCostBasis(lots)).toBeCloseTo(8_000 / 70, 10)
    expect(avgCostBasis([])).toBeNull()
  })

  it('values the position and P/L at a live price', () => {
    expect(currentValue(lots, 200)).toBeCloseTo(14_000, 10)
    expect(plDollars(lots, 200)).toBeCloseTo(6_000, 10)
    expect(plPct(lots, 200)).toBeCloseTo(75, 10)
    expect(plPct([], 200)).toBeNull()
  })
})

describe('plan-vs-actual', () => {
  it('thesis change since analysis', () => {
    expect(thesisChangePct(100, 130)).toBeCloseTo(30, 10)
    expect(thesisChangePct(0, 130)).toBeNull()
  })

  it('counterfactual full-plan value', () => {
    expect(counterfactualValue(10_000, 100, 130)).toBeCloseTo(13_000, 10)
  })

  it('variance is invested minus planned', () => {
    expect(variance(10_000, lots)).toBe(-2_000)
  })

  it('allocation percentage guards zero totals', () => {
    expect(allocationPct(2_500, 10_000)).toBe(25)
    expect(allocationPct(2_500, 0)).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/investments/analysisMetrics.test.ts`
Expected: FAIL — cannot resolve `./analysisMetrics`.

- [x] **Step 3: Implement**

Create `src/utils/investments/analysisMetrics.ts`:

```ts
// Pure derivations for the investment decision journal. All lot amounts are
// in the position's own currency; FX is out of scope for 5a (5b handles it).

import type { BuyLot } from '../../store/useAnalysisStore'

export function sharesFromLots(lots: BuyLot[]): number {
  return lots.reduce((s, l) => s + (l.price > 0 ? l.amountInvested / l.price : 0), 0)
}

export function totalInvested(lots: BuyLot[]): number {
  return lots.reduce((s, l) => s + l.amountInvested, 0)
}

export function avgCostBasis(lots: BuyLot[]): number | null {
  const shares = sharesFromLots(lots)
  return shares > 0 ? totalInvested(lots) / shares : null
}

export function currentValue(lots: BuyLot[], currentPrice: number): number {
  return sharesFromLots(lots) * currentPrice
}

export function plDollars(lots: BuyLot[], currentPrice: number): number {
  return currentValue(lots, currentPrice) - totalInvested(lots)
}

export function plPct(lots: BuyLot[], currentPrice: number): number | null {
  const invested = totalInvested(lots)
  return invested > 0 ? (plDollars(lots, currentPrice) / invested) * 100 : null
}

export function thesisChangePct(startPrice: number, currentPrice: number): number | null {
  return startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : null
}

export function counterfactualValue(
  plannedAmount: number,
  startPrice: number,
  currentPrice: number,
): number {
  return startPrice > 0 ? (plannedAmount / startPrice) * currentPrice : plannedAmount
}

export function variance(plannedAmount: number, lots: BuyLot[]): number {
  return totalInvested(lots) - plannedAmount
}

export function allocationPct(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/investments/analysisMetrics.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/investments/analysisMetrics.ts src/utils/investments/analysisMetrics.test.ts
git commit -m "feat: pure analysis metrics (lots, P/L, counterfactual, variance)"
```

---

### Task 3: Analysis entry modal (historical-price autofill)

**Files:**
- Create: `src/components/investments/AnalysisModal.tsx`

**Interfaces:**
- Consumes: `useHistoricalPrice(ticker, exchange, date)` from `src/services/marketData` (returns `{ data?: Resolved<HistoricalPrice>, status }` — idles until both ticker and date are non-empty); `useAnalysisStore.addAnalysis` (Task 1).
- Produces: `AnalysisModal: React.FC<{ isOpen: boolean; onClose: () => void }>` — used by Task 5. Follow the existing modal look in `src/components/budget/TransactionModal.tsx` (overlay + themed card).

Behaviour: user types ticker/exchange/date/planned amount/thesis. The start-price field shows the fetched close for that date (`data.value.close`) with its source; typing any value into it switches to `startPriceSource: 'manual'`. Save requires ticker, positive planned amount, date, and a positive start price (fetched or manual). The fetched price is copied into local component state only on the explicit "Use fetched" action or at save time if the user never overrode — never via an effect (lint rule).

- [x] **Step 1: Implement**

Create `src/components/investments/AnalysisModal.tsx`:

```tsx
import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useHistoricalPrice } from '../../services/marketData'
import { useAnalysisStore } from '../../store/useAnalysisStore'

interface AnalysisModalProps {
  isOpen: boolean
  onClose: () => void
}

const inputCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent w-full'

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose }) => {
  const addAnalysis = useAnalysisStore((s) => s.addAnalysis)
  const [ticker, setTicker] = useState('')
  const [exchange, setExchange] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [plannedAmount, setPlannedAmount] = useState(10000)
  const [thesis, setThesis] = useState('')
  const [manualPrice, setManualPrice] = useState<number | null>(null)

  const hist = useHistoricalPrice(ticker, exchange || undefined, date)
  const fetchedPrice = hist.data?.value.close
  const effectivePrice = manualPrice ?? fetchedPrice ?? 0

  if (!isOpen) return null

  const canSave = ticker.trim() !== '' && plannedAmount > 0 && date !== '' && effectivePrice > 0

  const save = () => {
    addAnalysis({
      id: `an-${Date.now()}`,
      ticker: ticker.trim().toUpperCase(),
      exchange: exchange.trim() || undefined,
      thesis: thesis.trim() || undefined,
      plannedAmount,
      analysisDate: date,
      startPrice: effectivePrice,
      startPriceSource: manualPrice !== null ? 'manual' : 'auto',
      acted: false,
      lots: [],
    })
    setTicker(''); setExchange(''); setThesis(''); setManualPrice(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="themed-card rounded-lg p-6 w-full max-w-lg flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-text-primary">New analysis</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-accent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">Ticker</span>
            <input className={inputCls} value={ticker} onChange={(e) => { setTicker(e.target.value); setManualPrice(null) }} placeholder="AAPL" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">Exchange (optional)</span>
            <input className={inputCls} value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="TSX" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-secondary">Analysis date</span>
            <input type="date" className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setManualPrice(null) }} />
          </label>
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

        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Thesis (optional)</span>
          <textarea className={`${inputCls} min-h-[70px]`} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Why this investment?" />
        </label>

        <button
          onClick={save}
          disabled={!canSave}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Save analysis
        </button>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [x] **Step 3: Commit**

```bash
git add src/components/investments/AnalysisModal.tsx
git commit -m "feat: analysis entry modal with historical start-price autofill + manual override"
```

---

### Task 4: Analysis card with live P/L and lots editor

**Files:**
- Create: `src/components/investments/AnalysisCard.tsx`

**Interfaces:**
- Consumes: `useCurrentPrice(ticker, exchange)` (live/override/cache `Resolved<Quote>`), store actions (Task 1), all metrics (Task 2), `formatMoney` from `src/components/planner/format.ts` (4a).
- Produces: `AnalysisCard: React.FC<{ analysis: InvestmentAnalysis; totals: { plannedAll: number; currentAll: number } }>` — used by Task 5. `totals` powers allocation-at-start vs allocation-now.

- [x] **Step 1: Implement**

Create `src/components/investments/AnalysisCard.tsx`:

```tsx
import React, { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCurrentPrice } from '../../services/marketData'
import { useAnalysisStore, type InvestmentAnalysis } from '../../store/useAnalysisStore'
import {
  allocationPct, avgCostBasis, counterfactualValue, currentValue,
  plDollars, plPct, thesisChangePct, totalInvested, variance,
} from '../../utils/investments/analysisMetrics'
import { formatMoney } from '../planner/format'

interface AnalysisCardProps {
  analysis: InvestmentAnalysis
  totals: { plannedAll: number; currentAll: number }
}

const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, totals }) => {
  const { updateAnalysis, removeAnalysis, addLot, removeLot } = useAnalysisStore.getState()
  const price = useCurrentPrice(analysis.ticker, analysis.exchange)
  const currentPrice = price.data?.value.price ?? analysis.startPrice
  const [lotAmount, setLotAmount] = useState(1000)
  const [lotPrice, setLotPrice] = useState(currentPrice)
  const [lotDate, setLotDate] = useState(() => new Date().toISOString().slice(0, 10))

  const invested = totalInvested(analysis.lots)
  const value = currentValue(analysis.lots, currentPrice)
  const counterfactual = counterfactualValue(analysis.plannedAmount, analysis.startPrice, currentPrice)

  return (
    <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[17px] font-semibold text-text-primary">
            {analysis.ticker}
            {analysis.exchange ? <span className="text-text-secondary text-[13px]"> · {analysis.exchange}</span> : null}
          </h3>
          <p className="text-[12px] text-text-secondary">
            Analyzed {analysis.analysisDate} at {analysis.startPrice.toFixed(2)} ({analysis.startPriceSource}) ·
            now {currentPrice.toFixed(2)}
            {price.data ? ` (${price.data.source}${price.data.stale ? ', stale' : ''})` : ''}
            <span className="text-accent"> {pct(thesisChangePct(analysis.startPrice, currentPrice))}</span>
          </p>
          {analysis.thesis && <p className="text-[13px] text-text-secondary mt-1 italic">{analysis.thesis}</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => price.refresh(true)} aria-label="Refresh price" className="p-1.5 text-text-secondary hover:text-accent">
            <RefreshCw className={`w-4 h-4 ${price.status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => removeAnalysis(analysis.id)} aria-label="Delete analysis" className="p-1.5 text-text-secondary hover:text-error">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
        <div><p className="text-text-secondary">Planned</p><p className="text-text-primary font-medium">{formatMoney(analysis.plannedAmount)}</p></div>
        <div><p className="text-text-secondary">Invested</p><p className="text-text-primary font-medium">{formatMoney(invested)} <span className="text-text-secondary">({formatMoney(variance(analysis.plannedAmount, analysis.lots))} vs plan)</span></p></div>
        <div><p className="text-text-secondary">Value now / P&L</p><p className="text-text-primary font-medium">{formatMoney(value)} · {pct(plPct(analysis.lots, currentPrice))} ({formatMoney(plDollars(analysis.lots, currentPrice))})</p></div>
        <div><p className="text-text-secondary">If fully executed</p><p className="text-text-primary font-medium">{formatMoney(counterfactual)}</p></div>
        <div><p className="text-text-secondary">Avg cost</p><p className="text-text-primary font-medium">{avgCostBasis(analysis.lots)?.toFixed(2) ?? '—'}</p></div>
        <div><p className="text-text-secondary">Allocation at start</p><p className="text-text-primary font-medium">{pct(allocationPct(analysis.plannedAmount, totals.plannedAll))}</p></div>
        <div><p className="text-text-secondary">Allocation now</p><p className="text-text-primary font-medium">{pct(allocationPct(value, totals.currentAll))}</p></div>
        <div><p className="text-text-secondary">Acted</p><p className="text-text-primary font-medium">
          <button onClick={() => updateAnalysis(analysis.id, { acted: !analysis.acted })} className="underline decoration-dotted hover:text-accent">
            {analysis.acted ? 'Yes' : 'No — still watching'}
          </button>
        </p></div>
      </div>

      <details className="text-[13px]">
        <summary className="cursor-pointer text-text-secondary hover:text-accent">
          Buy lots ({analysis.lots.length})
        </summary>
        <div className="flex flex-col gap-2 mt-2">
          {analysis.lots.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-border pb-1">
              <span className="text-text-secondary">{l.date} — {formatMoney(l.amountInvested)} @ {l.price.toFixed(2)}</span>
              <button onClick={() => removeLot(analysis.id, l.id)} aria-label="Remove lot" className="text-text-secondary hover:text-error">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <input type="date" className="bg-bg-primary/50 border border-border rounded px-2 py-1 text-text-primary" value={lotDate} onChange={(e) => setLotDate(e.target.value)} />
            <input type="number" className="bg-bg-primary/50 border border-border rounded px-2 py-1 text-text-primary w-28" value={lotAmount} onChange={(e) => setLotAmount(Number(e.target.value))} placeholder="Amount $" />
            <input type="number" step={0.01} className="bg-bg-primary/50 border border-border rounded px-2 py-1 text-text-primary w-24" value={lotPrice} onChange={(e) => setLotPrice(Number(e.target.value))} placeholder="Price" />
            <button
              onClick={() => lotAmount > 0 && lotPrice > 0 && addLot(analysis.id, { id: `lot-${Date.now()}`, date: lotDate, amountInvested: lotAmount, price: lotPrice })}
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

- [x] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [x] **Step 3: Commit**

```bash
git add src/components/investments/AnalysisCard.tsx
git commit -m "feat: analysis card — live P/L, variance, counterfactual, lots editor"
```

---

### Task 5: Rebuild the Investments page; delete the v1.0 mocks

**Files:**
- Modify: `src/pages/Investments.tsx` (full rewrite below)
- Delete: `src/components/investments/InvestmentTrackerWidget.tsx`
- Delete: `src/components/investments/SetTargetModal.tsx`
- Delete: `src/store/useInvestmentStore.ts`

**Interfaces:**
- Consumes: `AnalysisModal` (Task 3), `AnalysisCard` (Task 4), `useAnalysisStore`, metrics (Task 2), `useCurrentPrice` per card (inside `AnalysisCard`).
- Produces: the new Investments page. Totals header: planned total, invested total, current value total (sum of card values needs prices — computed with last-known prices from `useMarketDataStore` cache; simplification documented in a comment: header totals use cached/start prices, cards show live).

- [x] **Step 1: Rewrite the page**

Replace `src/pages/Investments.tsx` with:

```tsx
import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { AnalysisCard } from '../components/investments/AnalysisCard'
import { AnalysisModal } from '../components/investments/AnalysisModal'
import { useAnalysisStore } from '../store/useAnalysisStore'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { quoteKey } from '../services/marketData'
import { currentValue, totalInvested } from '../utils/investments/analysisMetrics'
import { formatMoney } from '../components/planner/format'

export const Investments: React.FC = () => {
  const analyses = useAnalysisStore((s) => s.analyses)
  const quotes = useMarketDataStore((s) => s.quotes)
  const overrides = useMarketDataStore((s) => s.overrides)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Header totals use override > cached > start price (cards fetch live).
  const priceFor = (ticker: string, exchange: string | undefined, fallback: number) =>
    overrides[quoteKey(ticker, exchange)] ?? quotes[quoteKey(ticker, exchange)]?.value.price ?? fallback

  const plannedAll = analyses.reduce((s, a) => s + a.plannedAmount, 0)
  const investedAll = analyses.reduce((s, a) => s + totalInvested(a.lots), 0)
  const currentAll = analyses.reduce(
    (s, a) => s + currentValue(a.lots, priceFor(a.ticker, a.exchange, a.startPrice)),
    0,
  )

  return (
    <div className="flex flex-col gap-6 w-full min-h-full p-6 animate-fade-in">
      <header className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-text-primary">Investments — Plan vs Actual</h1>
          <p className="text-[14px] text-text-secondary mt-1">
            Your decision journal: what you analyzed, what you actually did, and how both performed.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New analysis
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="themed-card rounded-lg p-4"><p className="text-[12px] uppercase text-text-secondary">Total planned</p><p className="text-[22px] font-semibold text-text-primary">{formatMoney(plannedAll)}</p></div>
        <div className="themed-card rounded-lg p-4"><p className="text-[12px] uppercase text-text-secondary">Actually invested</p><p className="text-[22px] font-semibold text-text-primary">{formatMoney(investedAll)} <span className="text-[13px] text-text-secondary">({formatMoney(investedAll - plannedAll)} vs plan)</span></p></div>
        <div className="themed-card rounded-lg p-4"><p className="text-[12px] uppercase text-text-secondary">Current value</p><p className="text-[22px] font-semibold text-accent">{formatMoney(currentAll)}</p></div>
      </div>

      {analyses.length === 0 ? (
        <div className="themed-card rounded-lg p-10 flex flex-col items-center gap-2">
          <p className="text-text-primary text-[16px] font-medium">No analyses yet</p>
          <p className="text-text-secondary text-[14px]">Record your first investment thesis — the start price auto-fills from the analysis date.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {analyses.map((a) => (
            <AnalysisCard key={a.id} analysis={a} totals={{ plannedAll, currentAll }} />
          ))}
        </div>
      )}

      <AnalysisModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
```

- [x] **Step 2: Delete the mocks**

```bash
git rm src/components/investments/InvestmentTrackerWidget.tsx src/components/investments/SetTargetModal.tsx src/store/useInvestmentStore.ts
```

(Check first: `rg -l "useInvestmentStore|InvestmentTrackerWidget|SetTargetModal" src` — expected importers are only these three files plus `Investments.tsx`, which Step 1 already rewrote. If anything else matches, update it before deleting.)

- [x] **Step 3: Verify**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass, no dangling imports.

- [x] **Step 4: Commit**

```bash
git add -A src/pages/Investments.tsx src/components/investments src/store
git commit -m "feat: Investments page = plan-vs-actual journal; delete v1.0 mock tracker"
```

---

### Task 6: Sub-phase 5a gate — verification, mobile + 5 themes, PROGRESS.md

**Files:**
- Modify: `docs/superpowers/plans/PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-07-02-phase-5a-plan-vs-actual.md` (check off boxes)

- [x] **Step 1: Full automated gate**

```bash
npx vitest run
npm run lint
npm run build
```

- [x] **Step 2: Manual acceptance — the spec's 5a "Done when"**

*"User logs an analysis, records (or doesn't record) the actual investment(s), and sees thesis-vs-actual performance and variance with live prices."*

1. New analysis with a real ticker + past date → start price auto-fills (source shown); manual override works; save.
2. Card shows live price (refresh button), thesis % change, counterfactual value.
3. Add two lots → avg cost, invested, P/L $/%, variance ("planned $10k, invested $8.5k" style) all correct; acted flips to Yes automatically.
4. Second analysis → allocation-at-start and allocation-now percentages appear on both cards; totals header sums correctly.
5. Reload → everything persists; export backup → wipe → import → analyses restored.
6. Offline → cards fall back to cached/start prices without breaking.
7. All 5 themes + 375px viewport (cards stack, metric grid wraps 2-col, no horizontal scroll).

- [x] **Step 3: Update PROGRESS.md and commit**

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-5a-plan-vs-actual.md
git commit -m "chore: complete Phase 5a — plan-vs-actual journal verified"
```
