# Phase 4c — Debt & Housing (Debt Payoff, Mortgage, Rent-vs-Buy)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three calculators on the Planner hub: Debt Payoff (snowball vs avalanche with extra-payment impact), Mortgage (payment/amortization + affordability), and Rent-vs-Buy (unrecoverable-cost crossover). Build the shared `amortization.ts` module that 4e's debt-payoff projection also reuses.

**Architecture:** Two pure math modules (`amortization.ts` shared payment/schedule math, `debtPayoff.ts` multi-debt strategy simulation, `rentVsBuy.ts` cost comparison) + three thin components on the 4a primitives. The debt list is stored as a JSON string in `usePlannerStore` inputs (values are `number | string | boolean`, so arrays serialize to a string field).

**Tech Stack:** React 19, Zustand v5 (existing `ledger-planner`), Recharts v3 (line/area charts), lucide-react, Tailwind v4, Vitest (globals: true).

**Umbrella plan:** `2026-07-02-phase-4-planner.md`. **Prerequisite:** Phase 4a complete. 4b is NOT a prerequisite.

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **Local-first persistence.** All inputs via `usePlannerStore` — **no new store keys**.
- **Recharts only** for charts; theme via CSS variables passed as stroke/fill (`var(--accent)` etc.).
- **No hardcoded colors — theme CSS variables only.** ALL 5 themes: `geometric`, `tactical`, `luxury`, `aurora`, `glass`.
- **Mobile + all 5 themes are acceptance gates** (final task).
- **Testing is minimal by direction of the user (2026-07-02):** the three math modules get tests against hand-computed values; components get NO dedicated test files — covered by `Planner.test.tsx` + the manual gate.
- **Commit after every task.** Lint enforces `react-hooks/set-state-in-effect` — store writes from event handlers only.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

---

### Task 1: Amortization math (`src/utils/finance/amortization.ts`)

**Files:**
- Create: `src/utils/finance/amortization.ts`
- Create: `src/utils/finance/amortization.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 3–4 here and by Phase 4e's debt projection):
  - `monthlyPayment(principal: number, annualRatePct: number, years: number): number`
  - `principalFromPayment(payment: number, annualRatePct: number, years: number): number` (inverse — affordability)
  - `interface AmortizationPoint { month: number; interestPaid: number; principalPaid: number; balance: number }`
  - `amortizationSchedule(principal: number, annualRatePct: number, years: number, extraMonthly?: number): AmortizationPoint[]`
  - `scheduleTotalInterest(schedule: AmortizationPoint[]): number`

Conventions (file-top comment): rates are PERCENT, monthly compounding (rate/12 — the US/consumer convention, not Canadian semi-annual mortgage compounding; note the simplification), payments at end of month, schedule stops when balance hits 0.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/amortization.test.ts`:

```ts
import {
  amortizationSchedule,
  monthlyPayment,
  principalFromPayment,
  scheduleTotalInterest,
} from './amortization'

describe('monthlyPayment', () => {
  it('matches the standard formula: $100k, 6%, 30y = $599.55', () => {
    expect(monthlyPayment(100_000, 6, 30)).toBeCloseTo(599.55, 2)
  })

  it('handles zero rate as simple division', () => {
    expect(monthlyPayment(120_000, 0, 10)).toBeCloseTo(1_000, 10)
  })
})

describe('principalFromPayment', () => {
  it('inverts monthlyPayment', () => {
    const p = principalFromPayment(599.55, 6, 30)
    expect(p).toBeCloseTo(100_000, 0)
  })

  it('handles zero rate', () => {
    expect(principalFromPayment(1_000, 0, 10)).toBeCloseTo(120_000, 6)
  })
})

describe('amortizationSchedule', () => {
  it('pays to zero exactly at the term with no extra payments', () => {
    const s = amortizationSchedule(100_000, 6, 30)
    expect(s).toHaveLength(360)
    expect(s[359].balance).toBeCloseTo(0, 6)
  })

  it('first month splits interest and principal correctly', () => {
    const s = amortizationSchedule(100_000, 6, 30)
    // interest = 100,000 × 0.005 = 500; principal = 599.55 − 500 = 99.55
    expect(s[0].interestPaid).toBeCloseTo(500, 2)
    expect(s[0].principalPaid).toBeCloseTo(99.55, 2)
  })

  it('extra payments shorten the schedule and cut interest', () => {
    const base = amortizationSchedule(100_000, 6, 30)
    const extra = amortizationSchedule(100_000, 6, 30, 200)
    expect(extra.length).toBeLessThan(base.length)
    expect(scheduleTotalInterest(extra)).toBeLessThan(scheduleTotalInterest(base))
  })

  it('final payment never overshoots below zero', () => {
    const s = amortizationSchedule(1_000, 12, 1, 500)
    expect(s[s.length - 1].balance).toBe(0)
    expect(s.every((p) => p.balance >= 0)).toBe(true)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/amortization.test.ts`
Expected: FAIL — cannot resolve `./amortization`.

- [x] **Step 3: Implement**

Create `src/utils/finance/amortization.ts`:

```ts
// Loan amortization math. Conventions: rates are PERCENT (6 = 6%), interest
// compounds monthly at annualRate/12 (consumer-loan convention; Canadian
// fixed mortgages legally use semi-annual compounding — difference is small
// and documented here as a simplification), payments at end of month.

export interface AmortizationPoint {
  month: number
  interestPaid: number
  principalPaid: number
  balance: number
}

export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12)
  if (n <= 0) return principal
  const r = annualRatePct / 100 / 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

/** Largest principal a given monthly payment can service — inverse of monthlyPayment. */
export function principalFromPayment(payment: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12)
  if (n <= 0) return 0
  const r = annualRatePct / 100 / 12
  if (r === 0) return payment * n
  return (payment * (1 - Math.pow(1 + r, -n))) / r
}

export function amortizationSchedule(
  principal: number,
  annualRatePct: number,
  years: number,
  extraMonthly = 0,
): AmortizationPoint[] {
  const r = annualRatePct / 100 / 12
  const basePayment = monthlyPayment(principal, annualRatePct, years)
  const points: AmortizationPoint[] = []
  let balance = principal
  const maxMonths = Math.round(years * 12) + 1 // extra guard month for rounding
  for (let m = 1; m <= maxMonths && balance > 1e-6; m++) {
    const interest = balance * r
    const principalPortion = Math.min(basePayment + extraMonthly - interest, balance)
    balance = Math.max(0, balance - principalPortion)
    points.push({ month: m, interestPaid: interest, principalPaid: principalPortion, balance })
  }
  return points
}

export function scheduleTotalInterest(schedule: AmortizationPoint[]): number {
  return schedule.reduce((sum, p) => sum + p.interestPaid, 0)
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/amortization.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/amortization.ts src/utils/finance/amortization.test.ts
git commit -m "feat: amortization math (payment, inverse, schedule with extra payments)"
```

---

### Task 2: Debt payoff simulation (`src/utils/finance/debtPayoff.ts`)

**Files:**
- Create: `src/utils/finance/debtPayoff.ts`
- Create: `src/utils/finance/debtPayoff.test.ts`

**Interfaces:**
- Consumes: nothing (independent of amortization.ts — revolving debts, not fixed-term loans).
- Produces (used by Task 3):
  - `interface Debt { id: string; name: string; balance: number; aprPct: number; minPayment: number }`
  - `type PayoffStrategy = 'snowball' | 'avalanche'`
  - `interface PayoffResult { months: number | null; totalInterest: number; series: { month: number; total: number }[]; payoffOrder: string[] }` (`months: null` = not paid off within the cap, e.g. minimums don't cover interest)
  - `simulatePayoff(debts: Debt[], extraMonthly: number, strategy: PayoffStrategy, maxMonths?: number): PayoffResult`

Simulation rules (document in comment): each month every debt accrues `balance × apr/12/100`, then receives its min payment; the extra budget (extraMonthly + freed-up minimums of already-cleared debts) goes to the focus debt — lowest balance first (snowball) or highest APR first (avalanche), re-evaluated as debts clear.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/debtPayoff.test.ts`:

```ts
import { simulatePayoff, type Debt } from './debtPayoff'

const d = (id: string, balance: number, aprPct: number, minPayment: number): Debt => ({
  id, name: id, balance, aprPct, minPayment,
})

describe('simulatePayoff', () => {
  it('pays a single 0% debt in balance/min months with zero interest', () => {
    const r = simulatePayoff([d('a', 1_000, 0, 100)], 0, 'snowball')
    expect(r.months).toBe(10)
    expect(r.totalInterest).toBeCloseTo(0, 10)
    expect(r.payoffOrder).toEqual(['a'])
  })

  it('avalanche clears the high-APR debt first, snowball the small one', () => {
    const debts = [d('small-lowapr', 500, 1, 50), d('big-highapr', 5_000, 25, 100)]
    expect(simulatePayoff(debts, 200, 'avalanche').payoffOrder[0]).toBe('big-highapr')
    expect(simulatePayoff(debts, 200, 'snowball').payoffOrder[0]).toBe('small-lowapr')
  })

  it('avalanche never pays more total interest than snowball', () => {
    const debts = [d('a', 2_000, 5, 50), d('b', 3_000, 22, 75), d('c', 800, 12, 25)]
    const av = simulatePayoff(debts, 150, 'avalanche')
    const sn = simulatePayoff(debts, 150, 'snowball')
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest)
  })

  it('series starts at the combined balance and ends at zero', () => {
    const r = simulatePayoff([d('a', 1_000, 0, 100)], 0, 'snowball')
    expect(r.series[0]).toEqual({ month: 0, total: 1_000 })
    expect(r.series[r.series.length - 1].total).toBe(0)
  })

  it('returns months: null when minimums cannot cover interest', () => {
    const r = simulatePayoff([d('a', 10_000, 60, 10)], 0, 'avalanche', 120)
    expect(r.months).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/debtPayoff.test.ts`
Expected: FAIL — cannot resolve `./debtPayoff`.

- [x] **Step 3: Implement**

Create `src/utils/finance/debtPayoff.ts`:

```ts
// Multi-debt payoff simulation. Each month: interest accrues (apr/12), every
// live debt gets its minimum payment, and the extra budget — extraMonthly
// plus the minimums freed by cleared debts — goes to the focus debt:
// snowball = lowest balance first, avalanche = highest APR first.

export interface Debt {
  id: string
  name: string
  balance: number
  aprPct: number
  minPayment: number
}

export type PayoffStrategy = 'snowball' | 'avalanche'

export interface PayoffResult {
  /** Months to debt-free, or null if not reached within maxMonths. */
  months: number | null
  totalInterest: number
  series: { month: number; total: number }[]
  /** Debt ids in the order they were fully paid. */
  payoffOrder: string[]
}

export function simulatePayoff(
  debts: Debt[],
  extraMonthly: number,
  strategy: PayoffStrategy,
  maxMonths = 600,
): PayoffResult {
  const live = debts.map((d) => ({ ...d }))
  const totalMin = debts.reduce((s, d) => s + d.minPayment, 0)
  const series = [{ month: 0, total: live.reduce((s, d) => s + d.balance, 0) }]
  const payoffOrder: string[] = []
  let totalInterest = 0

  for (let month = 1; month <= maxMonths; month++) {
    // 1. Accrue interest.
    for (const d of live) {
      if (d.balance <= 0) continue
      const interest = (d.balance * d.aprPct) / 100 / 12
      d.balance += interest
      totalInterest += interest
    }
    // 2. Minimum payments; freed minimums join the extra budget.
    let budget = extraMonthly + totalMin
    for (const d of live) {
      if (d.balance <= 0) continue
      const pay = Math.min(d.minPayment, d.balance, budget)
      d.balance -= pay
      budget -= pay
    }
    // 3. Extra budget to focus debts in strategy order.
    const order = [...live]
      .filter((d) => d.balance > 0)
      .sort((a, b) => (strategy === 'snowball' ? a.balance - b.balance : b.aprPct - a.aprPct))
    for (const d of order) {
      if (budget <= 0) break
      const pay = Math.min(budget, d.balance)
      d.balance -= pay
      budget -= pay
    }
    // 4. Record clears + series point.
    for (const d of live) {
      if (d.balance <= 1e-6 && !payoffOrder.includes(d.id)) {
        d.balance = 0
        payoffOrder.push(d.id)
      }
    }
    const total = live.reduce((s, d) => s + d.balance, 0)
    series.push({ month, total })
    if (total <= 0) return { months: month, totalInterest, series, payoffOrder }
  }
  return { months: null, totalInterest, series, payoffOrder }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/debtPayoff.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/debtPayoff.ts src/utils/finance/debtPayoff.test.ts
git commit -m "feat: snowball/avalanche debt payoff simulation"
```

---

### Task 3: Debt Payoff calculator component

**Files:**
- Create: `src/components/planner/DebtPayoffCalculator.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `simulatePayoff`/`Debt`/`PayoffStrategy` (Task 2); 4a primitives + store. Tool id: `'debt-payoff'`.
- Produces: `DebtPayoffCalculator: React.FC` registered as tool `debt-payoff`. Debt list persisted under field `debtsJson` (JSON string) in `usePlannerStore`.

- [x] **Step 1: Implement the component**

Create `src/components/planner/DebtPayoffCalculator.tsx`:

```tsx
import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { simulatePayoff, type Debt, type PayoffStrategy } from '../../utils/finance/debtPayoff'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'debt-payoff'
const DEFAULT_DEBTS: Debt[] = [
  { id: 'd1', name: 'Credit card', balance: 5000, aprPct: 21.99, minPayment: 150 },
  { id: 'd2', name: 'Car loan', balance: 12000, aprPct: 7.5, minPayment: 300 },
]
const DEFAULTS = { debtsJson: JSON.stringify(DEFAULT_DEBTS), extraMonthly: 200, strategy: 'avalanche' as string }

function parseDebts(json: string): Debt[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function formatMonths(m: number | null): string {
  if (m === null) return 'Never (payments too low)'
  return `${Math.floor(m / 12)}y ${m % 12}m`
}

export const DebtPayoffCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const debts = parseDebts(inputs.debtsJson as string)
  const strategy = inputs.strategy as PayoffStrategy
  const saveDebts = (next: Debt[]) => setInput(TOOL_ID, 'debtsJson', JSON.stringify(next))
  const updateDebt = (id: string, patch: Partial<Debt>) =>
    saveDebts(debts.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const chosen = simulatePayoff(debts, inputs.extraMonthly, strategy)
  const other = simulatePayoff(debts, inputs.extraMonthly, strategy === 'avalanche' ? 'snowball' : 'avalanche')
  const chartData = chosen.series.map((p, i) => ({
    month: p.month,
    [strategy]: Math.round(p.total),
    ...(other.series[i] ? { [strategy === 'avalanche' ? 'snowball' : 'avalanche']: Math.round(other.series[i].total) } : {}),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-wide text-text-secondary">Debts</p>
          <button
            onClick={() => saveDebts([...debts, { id: `d${Date.now()}`, name: 'New debt', balance: 1000, aprPct: 10, minPayment: 50 }])}
            className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-accent transition-colors"
          >
            <Plus className="w-4 h-4" /> Add debt
          </button>
        </div>
        {debts.map((d) => (
          <div key={d.id} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end border-b border-border pb-3 last:border-b-0">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-text-secondary">Name</span>
              <input
                className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
                value={d.name}
                onChange={(e) => updateDebt(d.id, { name: e.target.value })}
              />
            </label>
            <CalculatorField label="Balance" prefix="$" step={100} value={d.balance} onChange={(v) => updateDebt(d.id, { balance: v })} />
            <CalculatorField label="APR" suffix="%" step={0.1} value={d.aprPct} onChange={(v) => updateDebt(d.id, { aprPct: v })} />
            <CalculatorField label="Min payment" prefix="$" step={10} value={d.minPayment} onChange={(v) => updateDebt(d.id, { minPayment: v })} />
            <button
              onClick={() => saveDebts(debts.filter((x) => x.id !== d.id))}
              className="justify-self-start p-2 rounded-lg text-text-secondary hover:text-error transition-colors"
              aria-label={`Remove ${d.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <CalculatorField label="Extra monthly payment" prefix="$" step={25} value={inputs.extraMonthly} onChange={(v) => setInput(TOOL_ID, 'extraMonthly', v)} />
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Strategy</span>
          <select
            className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
            value={strategy}
            onChange={(e) => setInput(TOOL_ID, 'strategy', e.target.value)}
          >
            <option value="avalanche">Avalanche (highest APR first)</option>
            <option value="snowball">Snowball (smallest balance first)</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label={`Debt-free in (${strategy})`} value={formatMonths(chosen.months)} highlight />
        <ResultCard label="Total interest" value={formatMoney(chosen.totalInterest)} />
        <ResultCard
          label="vs other strategy"
          value={other.totalInterest >= chosen.totalInterest
            ? `saves ${formatMoney(other.totalInterest - chosen.totalInterest)}`
            : `costs ${formatMoney(chosen.totalInterest - other.totalInterest)} more`}
        />
      </div>

      <div className="themed-card rounded-lg p-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={72} />
            <Tooltip
              formatter={(value: number, name: string) => [formatMoney(value), name]}
              contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <Legend />
            <Line type="monotone" dataKey="avalanche" stroke="var(--accent)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="snowball" stroke="var(--text-secondary)" dot={false} strokeWidth={2} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

(Note: `text-error` relies on the `--error` token added to all themes in Phase 1 — see P1.T3 in PROGRESS.md.)

- [x] **Step 2: Register the tool**

In `toolRegistry.tsx`, add `CreditCard` to the lucide import and append:

```tsx
import { DebtPayoffCalculator } from './DebtPayoffCalculator'
```

```tsx
  {
    id: 'debt-payoff',
    name: 'Debt Payoff',
    description: 'Snowball vs avalanche — payoff date, total interest, extra-payment impact.',
    icon: CreditCard,
    component: DebtPayoffCalculator,
  },
```

- [x] **Step 3: Verify**

Run: `npx vitest run src/pages/Planner.test.tsx` — PASS.
Dev: add/remove/edit debts persists across reload (JSON round-trip); strategy toggle changes payoff order and the comparison card; both lines render.

- [x] **Step 4: Commit**

```bash
git add src/components/planner/DebtPayoffCalculator.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: debt payoff calculator — snowball vs avalanche with balance chart"
```

---

### Task 4: Mortgage calculator (payment + affordability)

**Files:**
- Create: `src/components/planner/MortgageCalculator.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `monthlyPayment`, `principalFromPayment`, `amortizationSchedule`, `scheduleTotalInterest` (Task 1); 4a primitives + store. Tool id: `'mortgage'`.
- Produces: `MortgageCalculator: React.FC` registered as tool `mortgage`. Two modes persisted under field `mode`: `'payment'` | `'affordability'`.

Affordability model (comment in component): max monthly housing budget = gross annual income × GDS% / 12 − monthly property tax − $150 heating (CMHC-style GDS, default 39%); mortgage principal = `principalFromPayment(budget, rate, years)`; max price = principal + down payment.

- [x] **Step 1: Implement the component**

Create `src/components/planner/MortgageCalculator.tsx`:

```tsx
import React from 'react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import {
  amortizationSchedule, monthlyPayment, principalFromPayment, scheduleTotalInterest,
} from '../../utils/finance/amortization'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'mortgage'
const DEFAULTS = {
  mode: 'payment' as string,
  price: 600000,
  downPct: 20,
  ratePct: 4.5,
  years: 25,
  // affordability mode
  income: 120000,
  gdsPct: 39,
  propertyTaxMonthly: 350,
}
const HEATING_MONTHLY = 150 // CMHC GDS convention

export const MortgageCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(TOOL_ID, field, v)
  const mode = inputs.mode as 'payment' | 'affordability'

  const downPayment = inputs.price * (inputs.downPct / 100)
  const principal = inputs.price - downPayment
  const payment = monthlyPayment(principal, inputs.ratePct, inputs.years)
  const schedule = amortizationSchedule(principal, inputs.ratePct, inputs.years)
  const chartData = schedule
    .filter((p) => p.month % 12 === 0)
    .map((p) => ({ year: p.month / 12, balance: Math.round(p.balance) }))

  const housingBudget = (inputs.income * (inputs.gdsPct / 100)) / 12 - inputs.propertyTaxMonthly - HEATING_MONTHLY
  const affordablePrincipal = Math.max(0, principalFromPayment(housingBudget, inputs.ratePct, inputs.years))
  const affordablePrice = affordablePrincipal + downPayment

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        {(['payment', 'affordability'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setInput(TOOL_ID, 'mode', m)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
              mode === m ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {m === 'payment' ? 'Payment' : 'Affordability'}
          </button>
        ))}
      </div>

      {mode === 'payment' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CalculatorField label="Home price" prefix="$" step={5000} value={inputs.price} onChange={set('price')} />
            <CalculatorField label="Down payment" suffix="%" min={0} max={100} step={1} value={inputs.downPct} onChange={set('downPct')} />
            <CalculatorField label="Rate" suffix="%" step={0.05} value={inputs.ratePct} onChange={set('ratePct')} />
            <CalculatorField label="Amortization (years)" min={1} max={35} value={inputs.years} onChange={set('years')} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResultCard label="Monthly payment" value={formatMoney(payment)} highlight />
            <ResultCard label="Total interest" value={formatMoney(scheduleTotalInterest(schedule))} />
            <ResultCard label="Down payment" value={formatMoney(downPayment)} />
          </div>
          <div className="themed-card rounded-lg p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={72} />
                <Tooltip
                  formatter={(value: number) => [formatMoney(value), 'Balance']}
                  contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CalculatorField label="Gross annual income" prefix="$" step={1000} value={inputs.income} onChange={set('income')} />
            <CalculatorField label="GDS ratio" suffix="%" min={20} max={50} step={1} value={inputs.gdsPct} onChange={set('gdsPct')} />
            <CalculatorField label="Property tax / month" prefix="$" step={25} value={inputs.propertyTaxMonthly} onChange={set('propertyTaxMonthly')} />
            <CalculatorField label="Rate" suffix="%" step={0.05} value={inputs.ratePct} onChange={set('ratePct')} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResultCard label="Max home price" value={formatMoney(affordablePrice)} highlight />
            <ResultCard label="Max mortgage" value={formatMoney(affordablePrincipal)} />
            <ResultCard label="Housing budget / month" value={formatMoney(Math.max(0, housingBudget))} />
          </div>
          <p className="text-[13px] text-text-secondary">
            GDS-style estimate: {inputs.gdsPct}% of gross income minus property tax and {formatMoney(HEATING_MONTHLY)} heating,
            with your current down payment of {formatMoney(downPayment)} added on top. Lenders also apply stress tests — treat as a ceiling.
          </p>
        </>
      )}
    </div>
  )
}
```

- [x] **Step 2: Register the tool**

In `toolRegistry.tsx`, add `Home` to the lucide import and append:

```tsx
import { MortgageCalculator } from './MortgageCalculator'
```

```tsx
  {
    id: 'mortgage',
    name: 'Mortgage',
    description: 'Payment, amortization curve, and how much house you can afford.',
    icon: Home,
    component: MortgageCalculator,
  },
```

- [x] **Step 3: Verify**

Run: `npx vitest run src/pages/Planner.test.tsx` — PASS.
Dev: payment mode $600k/20%/4.5%/25y → payment ≈ $2,668; affordability mode responds to income; mode toggle persists.

- [x] **Step 4: Commit**

```bash
git add src/components/planner/MortgageCalculator.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: mortgage calculator with amortization chart and affordability mode"
```

---

### Task 5: Rent-vs-Buy (math + component)

**Files:**
- Create: `src/utils/finance/rentVsBuy.ts`
- Create: `src/utils/finance/rentVsBuy.test.ts`
- Create: `src/components/planner/RentVsBuyCalculator.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `monthlyPayment`, `amortizationSchedule` (Task 1); 4a primitives + store. Tool id: `'rent-vs-buy'`.
- Produces:
  - `interface RentVsBuyInputs { monthlyRent: number; rentIncreasePct: number; price: number; downPct: number; ratePct: number; amortYears: number; propertyTaxPct: number; maintenancePct: number; opportunityPct: number; horizonYears: number }`
  - `interface RentVsBuyResult { series: { year: number; rentCost: number; buyCost: number }[]; breakEvenYear: number | null }`
  - `rentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult`

Model (document in comment): compares cumulative **unrecoverable costs**. Renting: rent (growing `rentIncreasePct`/yr). Buying: mortgage interest + property tax (`price × propertyTaxPct`/yr) + maintenance (`price × maintenancePct`/yr) + opportunity cost of the down payment (`down × opportunityPct`/yr). Principal payments are equity, not cost. Break-even = first year cumulative buy ≤ cumulative rent.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/rentVsBuy.test.ts`:

```ts
import { rentVsBuy } from './rentVsBuy'

const base = {
  monthlyRent: 2000, rentIncreasePct: 0,
  price: 400_000, downPct: 20, ratePct: 0, amortYears: 25,
  propertyTaxPct: 1, maintenancePct: 1, opportunityPct: 0,
  horizonYears: 5,
}

describe('rentVsBuy', () => {
  it('zero-rate case is hand-computable: buying is cheap, break-even year 1', () => {
    const r = rentVsBuy(base)
    // Rent: 24,000/yr. Buy: no interest, tax+maint = 400k × 2% = 8,000/yr.
    expect(r.series[0]).toEqual({ year: 1, rentCost: 24_000, buyCost: 8_000 })
    expect(r.breakEvenYear).toBe(1)
  })

  it('returns null break-even when renting stays cheaper', () => {
    const r = rentVsBuy({ ...base, monthlyRent: 500, ratePct: 6, opportunityPct: 7 })
    expect(r.breakEvenYear).toBeNull()
  })

  it('rent increases compound annually', () => {
    const r = rentVsBuy({ ...base, rentIncreasePct: 10, horizonYears: 2 })
    // year1 24,000; year2 24,000×1.1 = 26,400 → cumulative 50,400
    expect(r.series[1].rentCost).toBeCloseTo(50_400, 6)
  })

  it('series length matches the horizon', () => {
    expect(rentVsBuy(base).series).toHaveLength(5)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/rentVsBuy.test.ts`
Expected: FAIL — cannot resolve `./rentVsBuy`.

- [x] **Step 3: Implement module and component**

Create `src/utils/finance/rentVsBuy.ts`:

```ts
// Rent-vs-buy on cumulative UNRECOVERABLE costs. Rent side: rent growing
// annually. Buy side: mortgage interest + property tax + maintenance +
// opportunity cost of the down payment. Principal repayment builds equity,
// so it is not a cost. Break-even = first year cumulative buy ≤ rent.

import { amortizationSchedule } from './amortization'

export interface RentVsBuyInputs {
  monthlyRent: number
  rentIncreasePct: number
  price: number
  downPct: number
  ratePct: number
  amortYears: number
  propertyTaxPct: number
  maintenancePct: number
  opportunityPct: number
  horizonYears: number
}

export interface RentVsBuyResult {
  series: { year: number; rentCost: number; buyCost: number }[]
  breakEvenYear: number | null
}

export function rentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult {
  const down = inputs.price * (inputs.downPct / 100)
  const principal = inputs.price - down
  const schedule = amortizationSchedule(principal, inputs.ratePct, inputs.amortYears)
  const annualOwnFixed =
    inputs.price * (inputs.propertyTaxPct / 100) +
    inputs.price * (inputs.maintenancePct / 100) +
    down * (inputs.opportunityPct / 100)

  const series: RentVsBuyResult['series'] = []
  let rentCum = 0
  let buyCum = 0
  let breakEvenYear: number | null = null
  let annualRent = inputs.monthlyRent * 12

  for (let year = 1; year <= inputs.horizonYears; year++) {
    rentCum += annualRent
    annualRent *= 1 + inputs.rentIncreasePct / 100
    const yearInterest = schedule
      .slice((year - 1) * 12, year * 12)
      .reduce((s, p) => s + p.interestPaid, 0)
    buyCum += yearInterest + annualOwnFixed
    series.push({ year, rentCost: rentCum, buyCost: buyCum })
    if (breakEvenYear === null && buyCum <= rentCum) breakEvenYear = year
  }
  return { series, breakEvenYear }
}
```

Create `src/components/planner/RentVsBuyCalculator.tsx`:

```tsx
import React from 'react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { rentVsBuy } from '../../utils/finance/rentVsBuy'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'rent-vs-buy'
const DEFAULTS = {
  monthlyRent: 2200, rentIncreasePct: 3,
  price: 600000, downPct: 20, ratePct: 4.5, amortYears: 25,
  propertyTaxPct: 0.8, maintenancePct: 1, opportunityPct: 5,
  horizonYears: 15,
}

export const RentVsBuyCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(TOOL_ID, field, v)

  const r = rentVsBuy(inputs)
  const chartData = r.series.map((p) => ({
    year: p.year, Renting: Math.round(p.rentCost), Buying: Math.round(p.buyCost),
  }))
  const last = r.series[r.series.length - 1]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <CalculatorField label="Monthly rent" prefix="$" step={50} value={inputs.monthlyRent} onChange={set('monthlyRent')} />
        <CalculatorField label="Rent increase" suffix="%/yr" step={0.5} value={inputs.rentIncreasePct} onChange={set('rentIncreasePct')} />
        <CalculatorField label="Home price" prefix="$" step={5000} value={inputs.price} onChange={set('price')} />
        <CalculatorField label="Down payment" suffix="%" min={0} max={100} value={inputs.downPct} onChange={set('downPct')} />
        <CalculatorField label="Mortgage rate" suffix="%" step={0.05} value={inputs.ratePct} onChange={set('ratePct')} />
        <CalculatorField label="Property tax" suffix="%/yr" step={0.1} value={inputs.propertyTaxPct} onChange={set('propertyTaxPct')} />
        <CalculatorField label="Maintenance" suffix="%/yr" step={0.1} value={inputs.maintenancePct} onChange={set('maintenancePct')} />
        <CalculatorField label="Investment return (opportunity)" suffix="%" step={0.5} value={inputs.opportunityPct} onChange={set('opportunityPct')} />
        <CalculatorField label="Horizon (years)" min={1} max={40} value={inputs.horizonYears} onChange={set('horizonYears')} />
        <CalculatorField label="Amortization (years)" min={1} max={35} value={inputs.amortYears} onChange={set('amortYears')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard
          label="Break-even"
          value={r.breakEvenYear === null ? 'Renting wins in this horizon' : `Year ${r.breakEvenYear}`}
          highlight
        />
        <ResultCard label={`Renting cost by year ${last?.year ?? 0}`} value={formatMoney(last?.rentCost ?? 0)} />
        <ResultCard label={`Buying cost by year ${last?.year ?? 0}`} value={formatMoney(last?.buyCost ?? 0)} />
      </div>

      <div className="themed-card rounded-lg p-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={72} />
            <Tooltip
              formatter={(value: number, name: string) => [formatMoney(value), name]}
              contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <Legend />
            <Line type="monotone" dataKey="Renting" stroke="var(--text-secondary)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="Buying" stroke="var(--accent)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[12px] text-text-secondary mt-2">
          Cumulative unrecoverable costs only — rent vs interest, taxes, maintenance and the return your down payment could have earned.
        </p>
      </div>
    </div>
  )
}
```

In `toolRegistry.tsx`, add `Building2` to the lucide import and append:

```tsx
import { RentVsBuyCalculator } from './RentVsBuyCalculator'
```

```tsx
  {
    id: 'rent-vs-buy',
    name: 'Rent vs Buy',
    description: 'Cumulative-cost crossover: when (if ever) buying beats renting.',
    icon: Building2,
    component: RentVsBuyCalculator,
  },
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/rentVsBuy.test.ts src/pages/Planner.test.tsx`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/rentVsBuy.ts src/utils/finance/rentVsBuy.test.ts src/components/planner/RentVsBuyCalculator.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: rent-vs-buy calculator with break-even crossover chart"
```

---

### Task 6: Sub-phase 4c gate — verification, mobile + 5 themes, PROGRESS.md

**Files:**
- Modify: `docs/superpowers/plans/PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-07-02-phase-4c-debt-and-housing.md` (check off boxes)

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
2. Debt payoff: add/edit/remove debts persists; strategies differ in order + interest; chart shows both lines.
3. Mortgage: both modes; payment ≈ $2,668 for the defaults; mode persists.
4. Rent-vs-buy: break-even card + crossover chart respond to rate/opportunity changes.
5. All 5 themes on each tool; 375px viewport — debt rows wrap 2-col, charts stay in cards, no horizontal scroll.

- [x] **Step 3: Update PROGRESS.md and commit**

Mark 4c complete (log line + next pointer = 4d), check off boxes here.

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-4c-debt-and-housing.md
git commit -m "chore: complete Phase 4c — debt & housing calculators verified"
```
