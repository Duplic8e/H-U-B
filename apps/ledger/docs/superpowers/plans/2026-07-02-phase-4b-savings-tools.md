# Phase 4b — Savings Tools (Emergency Fund, Currency Converter, Raise/Inflation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three small calculators to the Planner hub: Emergency Fund (target vs current savings, prefillable from Budgeting), Currency Converter (USD⇄CAD via the market-data FX service with manual-rate fallback), and Raise/Inflation ("is my raise a real raise?").

**Architecture:** Each tool = (optional pure util) + thin component + registry entry, exactly the 4a pattern. This sub-plan also introduces `src/store/budgetSelectors.ts` — pure selectors over budget transactions that the Emergency Fund prefill uses now and the 4e forecaster reuses later.

**Tech Stack:** React 19, Zustand v5 (existing stores), Tailwind v4, `src/services/marketData` (`useFxRate`, `Resolved<T>`), Vitest (globals: true). No charts.

**Umbrella plan:** `2026-07-02-phase-4-planner.md`. **Prerequisite:** Phase 4a complete.

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **Local-first persistence.** All inputs via `usePlannerStore` — **no new store keys** (already in `BACKUP_KEYS`).
- **No hardcoded colors — theme CSS variables only.** Must work in ALL 5 themes: `geometric`, `tactical`, `luxury`, `aurora`, `glass`.
- **Live data always has a manual fallback.** The currency converter must remain usable offline: it surfaces the `Resolved` source/staleness and offers a manual-rate override.
- **Mobile + all 5 themes are acceptance gates** (final task).
- **Testing is minimal by direction of the user (2026-07-02):** pure utils (`budgetSelectors`, `raise`) get small test files; the three components get NO dedicated test files — covered by the registry-driven `Planner.test.tsx` plus the manual gate.
- **Commit after every task.** Lint enforces `react-hooks/set-state-in-effect` — store writes from event handlers only.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

---

### Task 1: Budget selectors (`src/store/budgetSelectors.ts`)

**Files:**
- Create: `src/store/budgetSelectors.ts`
- Create: `src/store/budgetSelectors.test.ts`

**Interfaces:**
- Consumes: `Transaction` type from `src/types/budget.ts` (`{ id, date, amount, categoryId?, description, type: 'expense' | 'income' }`); transactions live in `useBudgetStore` as `Record<string, Transaction>`.
- Produces (used by Task 2 now, and by Phase 4e's auto-feed later — keep signatures stable):
  - `monthlyExpenseTotal(transactions: Record<string, Transaction>, month: string): number` (month = `'YYYY-MM'`)
  - `monthlyIncomeTotal(transactions: Record<string, Transaction>, month: string): number`
  - `averageMonthlyExpenses(transactions: Record<string, Transaction>, monthsBack: number, refDate?: Date): number` — mean over the `monthsBack` *completed* months before `refDate` (default now); months with zero transactions count as 0.
  - `averageMonthlyNetSavings(transactions: Record<string, Transaction>, monthsBack: number, refDate?: Date): number` — mean of (income − expenses) over the same window.

These replicate the filters used by `IncomeWidget`/`ExpenseWidget` (`t.type === 'income' | 'expense'`, `t.date.startsWith(month)`).

- [x] **Step 1: Write the failing tests**

Create `src/store/budgetSelectors.test.ts`:

```ts
import type { Transaction } from '../types/budget'
import {
  averageMonthlyExpenses,
  averageMonthlyNetSavings,
  monthlyExpenseTotal,
  monthlyIncomeTotal,
} from './budgetSelectors'

function tx(date: string, amount: number, type: 'expense' | 'income'): Transaction {
  return { id: `${date}-${amount}-${type}`, date, amount, description: 't', type }
}

const transactions: Record<string, Transaction> = Object.fromEntries(
  [
    tx('2026-05-03', 1000, 'expense'),
    tx('2026-05-10', 500, 'expense'),
    tx('2026-05-15', 4000, 'income'),
    tx('2026-06-01', 2000, 'expense'),
    tx('2026-06-20', 4000, 'income'),
    tx('2026-07-01', 999, 'expense'), // current month — excluded from averages
  ].map((t) => [t.id, t]),
)

describe('monthly totals', () => {
  it('sums expenses and income for one month', () => {
    expect(monthlyExpenseTotal(transactions, '2026-05')).toBe(1500)
    expect(monthlyIncomeTotal(transactions, '2026-05')).toBe(4000)
    expect(monthlyExpenseTotal(transactions, '2026-04')).toBe(0)
  })
})

describe('averages over completed months', () => {
  const ref = new Date('2026-07-02T12:00:00')

  it('averages expenses over the previous N completed months', () => {
    // May 1500 + June 2000 over 2 months = 1750; July excluded
    expect(averageMonthlyExpenses(transactions, 2, ref)).toBe(1750)
  })

  it('counts empty months as zero', () => {
    // Apr 0 + May 1500 + Jun 2000 over 3 = 1166.67
    expect(averageMonthlyExpenses(transactions, 3, ref)).toBeCloseTo(1166.67, 1)
  })

  it('averages net savings (income − expenses)', () => {
    // May 2500 + June 2000 over 2 = 2250
    expect(averageMonthlyNetSavings(transactions, 2, ref)).toBe(2250)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/budgetSelectors.test.ts`
Expected: FAIL — cannot resolve `./budgetSelectors`.

- [x] **Step 3: Implement**

Create `src/store/budgetSelectors.ts`:

```ts
// Pure selectors over budget transactions. Kept store-free so calculators
// (4b Emergency Fund, 4e forecaster auto-feed) can call them with
// useBudgetStore.getState().transactions or any snapshot.

import type { Transaction } from '../types/budget'

export function monthlyExpenseTotal(
  transactions: Record<string, Transaction>,
  month: string,
): number {
  return Object.values(transactions)
    .filter((t) => t.type === 'expense' && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0)
}

export function monthlyIncomeTotal(
  transactions: Record<string, Transaction>,
  month: string,
): number {
  return Object.values(transactions)
    .filter((t) => t.type === 'income' && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0)
}

/** 'YYYY-MM' keys for the N completed months before refDate (most recent first). */
function completedMonthKeys(monthsBack: number, refDate: Date): string[] {
  const keys: string[] = []
  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

export function averageMonthlyExpenses(
  transactions: Record<string, Transaction>,
  monthsBack: number,
  refDate: Date = new Date(),
): number {
  if (monthsBack <= 0) return 0
  const months = completedMonthKeys(monthsBack, refDate)
  const total = months.reduce((sum, m) => sum + monthlyExpenseTotal(transactions, m), 0)
  return total / monthsBack
}

export function averageMonthlyNetSavings(
  transactions: Record<string, Transaction>,
  monthsBack: number,
  refDate: Date = new Date(),
): number {
  if (monthsBack <= 0) return 0
  const months = completedMonthKeys(monthsBack, refDate)
  const total = months.reduce(
    (sum, m) => sum + monthlyIncomeTotal(transactions, m) - monthlyExpenseTotal(transactions, m),
    0,
  )
  return total / monthsBack
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/budgetSelectors.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/store/budgetSelectors.ts src/store/budgetSelectors.test.ts
git commit -m "feat: pure budget selectors (monthly totals, rolling averages) for planner tools"
```

---

### Task 2: Emergency Fund calculator

**Files:**
- Create: `src/components/planner/EmergencyFundCalculator.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `averageMonthlyExpenses` (Task 1), `useBudgetStore`, `useToolInputs`/`usePlannerStore`, `CalculatorField`/`ResultCard`/`formatMoney` (4a). Tool id: `'emergency-fund'`.
- Produces: `EmergencyFundCalculator: React.FC` registered as tool `emergency-fund`.

Math is trivial (target = expenses × months; gap = max(0, target − saved)); it stays inline in the component — no util module.

- [x] **Step 1: Implement the component**

Create `src/components/planner/EmergencyFundCalculator.tsx`:

```tsx
import React from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { useBudgetStore } from '../../store/useBudgetStore'
import { averageMonthlyExpenses } from '../../store/budgetSelectors'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'emergency-fund'
const DEFAULTS = { monthlyExpenses: 3000, targetMonths: 6, currentSavings: 5000 }
const PRESET_MONTHS = [3, 6, 12]

export const EmergencyFundCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(TOOL_ID, field, v)
  const transactions = useBudgetStore((s) => s.transactions)

  const budgetAvg = averageMonthlyExpenses(transactions, 3)
  const target = inputs.monthlyExpenses * inputs.targetMonths
  const gap = Math.max(0, target - inputs.currentSavings)
  const progress = target > 0 ? Math.min(1, inputs.currentSavings / target) : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <CalculatorField label="Monthly essential expenses" prefix="$" step={100} value={inputs.monthlyExpenses} onChange={set('monthlyExpenses')} />
        <CalculatorField label="Months of cover" min={1} max={24} value={inputs.targetMonths} onChange={set('targetMonths')} />
        <CalculatorField label="Current savings" prefix="$" step={100} value={inputs.currentSavings} onChange={set('currentSavings')} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESET_MONTHS.map((m) => (
          <button
            key={m}
            onClick={() => setInput(TOOL_ID, 'targetMonths', m)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
              inputs.targetMonths === m
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {m} months
          </button>
        ))}
        {budgetAvg > 0 && (
          <button
            onClick={() => setInput(TOOL_ID, 'monthlyExpenses', Math.round(budgetAvg))}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          >
            Use my budget avg ({formatMoney(budgetAvg)}/mo)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Target fund" value={formatMoney(target)} highlight />
        <ResultCard label="Gap to close" value={formatMoney(gap)} />
        <ResultCard label="Funded" value={`${Math.round(progress * 100)}%`} />
      </div>

      <div className="themed-card rounded-lg p-4">
        <div className="h-3 w-full rounded bg-bg-primary/50 overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-[12px] text-text-secondary mt-2">
          {gap === 0
            ? 'Fully funded — nice.'
            : `Save ${formatMoney(gap)} more to reach ${inputs.targetMonths} months of cover.`}
        </p>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Register the tool**

In `src/components/planner/toolRegistry.tsx`, add `ShieldCheck` to the lucide import and append:

```tsx
import { EmergencyFundCalculator } from './EmergencyFundCalculator'
```

```tsx
  {
    id: 'emergency-fund',
    name: 'Emergency Fund',
    description: 'How many months of expenses you have covered, and the gap to your target.',
    icon: ShieldCheck,
    component: EmergencyFundCalculator,
  },
```

- [x] **Step 3: Verify**

Run: `npx vitest run src/pages/Planner.test.tsx`
Expected: PASS (hub test iterates the registry). In dev: `#/planner/emergency-fund` — presets set months, prefill button appears once budget transactions exist, progress bar tracks.

- [x] **Step 4: Commit**

```bash
git add src/components/planner/EmergencyFundCalculator.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: emergency fund calculator with budget-average prefill"
```

---

### Task 3: Currency Converter (market-data FX + manual fallback)

**Files:**
- Create: `src/components/planner/CurrencyConverter.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)
- Modify: `src/services/marketData/index.ts` (export `todayKey`)

**Interfaces:**
- Consumes: `useFxRate(from, to, date?)` returning `{ data?: Resolved<FxRate>, status, error, refresh }`; `Currency = 'USD' | 'CAD'`; `fxKey(from, to, dateKey)` and (newly exported) `todayKey()` from `src/services/marketData`; `useMarketDataStore.setOverride/clearOverride` for the manual rate; 4a primitives + store. Tool id: `'currency-converter'`.
- Produces: `CurrencyConverter: React.FC` registered as tool `currency-converter`.

Manual-fallback mechanism (already built into the service): `getFxRate` checks `overrides[fxKey(from, to, dateKey)]` first, so setting an override for **today's** key makes the hook return `source: 'override'`. The converter's "Manual rate" input writes that override; clearing it re-enables live fetch.

- [x] **Step 1: Export `todayKey` from the barrel**

In `src/services/marketData/index.ts` change the dateKey-related exports:

```ts
export * from './types'
export { getCurrentPrice, getFxRate, getHistoricalPrice, type Resolved, MIN_FETCH_INTERVAL_MS, STALE_AFTER_MS } from './marketDataService'
export { useCurrentPrice, useFxRate, useHistoricalPrice } from './useMarketData'
export { quoteKey, historicalKey, fxKey } from './cacheKey'
export { todayKey, toDateKey } from './dateKey'
```

- [x] **Step 2: Implement the component**

Create `src/components/planner/CurrencyConverter.tsx`:

```tsx
import React from 'react'
import { ArrowLeftRight, RefreshCw } from 'lucide-react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { fxKey, todayKey, useFxRate, type Currency } from '../../services/marketData'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'

const TOOL_ID = 'currency-converter'
const DEFAULTS = { amount: 100, from: 'USD' as string, date: '' as string }

function formatAmount(n: number, currency: string): string {
  return `${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export const CurrencyConverter: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)

  const from = inputs.from as Currency
  const to: Currency = from === 'USD' ? 'CAD' : 'USD'
  const date = inputs.date || undefined // optional historical lookup
  const fx = useFxRate(from, to, date)

  const overrideKey = fxKey(from, to, date ?? todayKey())
  const override = useMarketDataStore((s) => s.overrides[overrideKey])
  const setOverride = useMarketDataStore((s) => s.setOverride)
  const clearOverride = useMarketDataStore((s) => s.clearOverride)

  const rate = override ?? fx.data?.value.rate
  const converted = rate !== undefined ? inputs.amount * rate : undefined

  const sourceLabel =
    override !== undefined
      ? 'manual override'
      : fx.data
        ? `${fx.data.source}${fx.data.stale ? ' (stale)' : ''} — as of ${new Date(fx.data.asOf).toLocaleString()}`
        : fx.status

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <CalculatorField label={`Amount (${from})`} step={10} value={inputs.amount} onChange={(v) => setInput(TOOL_ID, 'amount', v)} />
        <button
          onClick={() => setInput(TOOL_ID, 'from', to)}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          aria-label="Swap currencies"
        >
          <ArrowLeftRight className="w-4 h-4" /> {from} → {to}
        </button>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Rate date (optional)</span>
          <input
            type="date"
            className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
            value={inputs.date as string}
            onChange={(e) => setInput(TOOL_ID, 'date', e.target.value)}
          />
        </label>
        <button
          onClick={() => fx.refresh()}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          aria-label="Refresh rate"
        >
          <RefreshCw className={`w-4 h-4 ${fx.status === 'loading' ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResultCard
          label={`Converted (${to})`}
          value={converted !== undefined ? formatAmount(converted, to) : fx.status === 'error' ? 'Unavailable — set a manual rate' : '…'}
          highlight
        />
        <ResultCard label={`Rate ${from}→${to}`} value={rate !== undefined ? rate.toFixed(4) : '…'} />
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <p className="text-[12px] uppercase tracking-wide text-text-secondary">Rate source: {sourceLabel}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-text-secondary">Manual rate override</span>
            <input
              type="number"
              step={0.0001}
              className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent w-40"
              value={override ?? ''}
              placeholder={fx.data?.value.rate.toFixed(4) ?? ''}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (e.target.value !== '' && Number.isFinite(v) && v > 0) setOverride(overrideKey, v)
              }}
            />
          </label>
          {override !== undefined && (
            <button
              onClick={() => clearOverride(overrideKey)}
              className="px-3 py-2 rounded-lg border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors"
            >
              Clear override — use live
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [x] **Step 3: Register the tool**

In `toolRegistry.tsx`, add `ArrowLeftRight` to the lucide import (icon only — the component imports its own) and append:

```tsx
import { CurrencyConverter } from './CurrencyConverter'
```

```tsx
  {
    id: 'currency-converter',
    name: 'Currency Converter',
    description: 'USD ⇄ CAD with live rates, historical lookup, and manual fallback.',
    icon: ArrowLeftRight,
    component: CurrencyConverter,
  },
```

- [x] **Step 4: Verify**

Run: `npx vitest run` (full suite — the barrel change touches market-data imports)
Expected: ALL PASS. In dev: converter shows a live rate with source line; entering a manual rate flips source to "manual override" and survives reload; clearing restores live; DevTools offline → converted value still renders from cache/override.

- [x] **Step 5: Commit**

```bash
git add src/components/planner/CurrencyConverter.tsx src/components/planner/toolRegistry.tsx src/services/marketData/index.ts
git commit -m "feat: currency converter with live FX, historical date, manual override"
```

---

### Task 4: Raise/Inflation calculator

**Files:**
- Create: `src/utils/finance/raise.ts`
- Create: `src/utils/finance/raise.test.ts`
- Create: `src/components/planner/RaiseInflationCalculator.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: 4a primitives + store. Tool id: `'raise-inflation'`.
- Produces: `nominalRaisePct(oldSalary: number, newSalary: number): number`; `realRaisePct(nominalPct: number, inflationPct: number): number` (Fisher: `((1+nom)/(1+infl)−1)×100`, args in percent).

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/raise.test.ts`:

```ts
import { nominalRaisePct, realRaisePct } from './raise'

describe('nominalRaisePct', () => {
  it('computes the percent change', () => {
    expect(nominalRaisePct(100_000, 105_000)).toBeCloseTo(5, 10)
    expect(nominalRaisePct(0, 50_000)).toBe(0) // guard: no old salary, no meaningful raise
  })
})

describe('realRaisePct', () => {
  it('applies the Fisher equation, not naive subtraction', () => {
    // (1.05 / 1.03) − 1 = 1.9417%
    expect(realRaisePct(5, 3)).toBeCloseTo(1.9417, 3)
  })

  it('is negative when inflation outpaces the raise', () => {
    expect(realRaisePct(2, 4)).toBeLessThan(0)
  })

  it('is zero when raise equals inflation', () => {
    expect(realRaisePct(3, 3)).toBeCloseTo(0, 10)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/raise.test.ts`
Expected: FAIL — cannot resolve `./raise`.

- [x] **Step 3: Implement module and component**

Create `src/utils/finance/raise.ts`:

```ts
// "Is my raise a real raise?" — nominal vs inflation-adjusted (Fisher) raise.
// All rates are PERCENT in and out.

export function nominalRaisePct(oldSalary: number, newSalary: number): number {
  if (oldSalary <= 0) return 0
  return ((newSalary - oldSalary) / oldSalary) * 100
}

export function realRaisePct(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100
}
```

Create `src/components/planner/RaiseInflationCalculator.tsx`:

```tsx
import React from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { nominalRaisePct, realRaisePct } from '../../utils/finance/raise'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'raise-inflation'
const DEFAULTS = { oldSalary: 100000, newSalary: 105000, inflationPct: 3 }

export const RaiseInflationCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(TOOL_ID, field, v)

  const nominal = nominalRaisePct(inputs.oldSalary, inputs.newSalary)
  const real = realRaisePct(nominal, inputs.inflationPct)
  const realDollars = inputs.oldSalary * (real / 100)

  const verdict =
    real > 0.25
      ? `A real raise — your purchasing power grew ${real.toFixed(2)}%.`
      : real < -0.25
        ? `Not a real raise — inflation ate it. You're down ${Math.abs(real).toFixed(2)}% in purchasing power.`
        : 'A wash — your raise roughly matches inflation.'

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <CalculatorField label="Old salary" prefix="$" step={1000} value={inputs.oldSalary} onChange={set('oldSalary')} />
        <CalculatorField label="New salary" prefix="$" step={1000} value={inputs.newSalary} onChange={set('newSalary')} />
        <CalculatorField label="Inflation" suffix="%" step={0.1} value={inputs.inflationPct} onChange={set('inflationPct')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Nominal raise" value={`${nominal.toFixed(2)}%`} />
        <ResultCard label="Real raise" value={`${real.toFixed(2)}%`} highlight />
        <ResultCard label="Real change (old-salary dollars)" value={formatMoney(realDollars)} />
      </div>

      <p className="text-[14px] text-text-primary">{verdict}</p>
    </div>
  )
}
```

In `toolRegistry.tsx`, add `TrendingDown` to the lucide import and append:

```tsx
import { RaiseInflationCalculator } from './RaiseInflationCalculator'
```

```tsx
  {
    id: 'raise-inflation',
    name: 'Raise vs Inflation',
    description: 'Is my raise a real raise? Nominal vs inflation-adjusted.',
    icon: TrendingDown,
    component: RaiseInflationCalculator,
  },
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/raise.test.ts src/pages/Planner.test.tsx`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/raise.ts src/utils/finance/raise.test.ts src/components/planner/RaiseInflationCalculator.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: raise-vs-inflation calculator (Fisher real raise)"
```

---

### Task 5: Sub-phase 4b gate — verification, mobile + 5 themes, PROGRESS.md

**Files:**
- Modify: `docs/superpowers/plans/PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-07-02-phase-4b-savings-tools.md` (check off boxes)

- [x] **Step 1: Full automated gate**

```bash
npx vitest run
npm run lint
npm run build
```

Expected: all pass; changed files lint clean.

- [x] **Step 2: Manual acceptance — mobile + all 5 themes**

`npm run dev`, then:
1. Hub shows the three new tiles; each opens with a working back link.
2. Emergency fund: presets, prefill (after importing/adding budget transactions), progress bar; reload restores.
3. Currency converter: live rate + source line; swap; historical date; manual override survives reload; offline still usable.
4. Raise/inflation: 5% raise at 3% inflation → real 1.94%, verdict "real raise"; 2% at 4% → negative verdict.
5. All 5 themes on each tool; 375px viewport — no horizontal scroll.

- [x] **Step 3: Update PROGRESS.md and commit**

Mark 4b complete (log line + next pointer = plan/execute 4c), check off boxes here.

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-4b-savings-tools.md
git commit -m "chore: complete Phase 4b — savings tools verified"
```
