# Phase 6 — Budgeting Enhancements (Smart + Visual)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Additive polish on Budgeting: recurring/subscription detection, spending anomaly alerts, month-end cash-flow forecast (smart); Sankey income flow, per-category trend sparklines, budget-vs-actual progress bars with pace, spending calendar heatmap (visual). No regressions to CSV import, triage, rules, or paradigms.

**Architecture:** Three pure analysis modules under `src/utils/budget/` (`recurring.ts`, `categoryStats.ts` + `anomaly.ts`, `cashFlowForecast.ts`) carry all the logic and all the tests. Seven small widgets compose them; the Budgeting page gains two new sections ("Insights", "Visuals") below the existing widgets. Everything derives from `useBudgetStore` state at render time — **no new stores, no new persisted keys**.

**Tech Stack:** React 19, Zustand v5 (existing `ledger-budget`), Recharts v3 (incl. `Sankey`), lucide-react, Tailwind v4, Vitest (globals: true).

**Spec authority:** `docs/superpowers/specs/2026-07-02-ledger-v2-design.md` → Phase 6. **Prerequisites:** Phase 1 only (v1.0 budgeting + `Transaction`/`Category` types in `src/types/budget.ts`). `src/store/budgetSelectors.ts` from 4b T1 is reused if present; Task 1 does not depend on it.

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **No new persisted state.** All insights derive from existing transactions/categories.
- **Recharts only** for charts (the heatmap and progress bars are CSS, not charts).
- **No hardcoded colors — theme CSS variables only.** ALL 5 themes: `geometric`, `tactical`, `luxury`, `aurora`, `glass`.
- **Mobile + all 5 themes are acceptance gates** (final task) — every new visual must be phone-legible.
- **Testing is minimal by direction of the user (2026-07-02):** the three analysis modules get thorough tests (detection logic is the risk); widgets get NO dedicated test files — manual gate covers them.
- **Commit after every task.** Lint enforces `react-hooks/set-state-in-effect`.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

**Shared types (from `src/types/budget.ts`):** `Transaction { id; date: 'YYYY-MM-DD'; amount; categoryId?; description; type: 'expense' | 'income' }`; `Category { id; groupId; name; targetAmount }`; `CategoryGroup { id; name }`. Transactions live as `Record<string, Transaction>`.

---

### Task 1: Recurring/subscription detection (`src/utils/budget/recurring.ts`)

**Files:**
- Create: `src/utils/budget/recurring.ts`
- Create: `src/utils/budget/recurring.test.ts`

**Interfaces:**
- Consumes: `Transaction` type.
- Produces (used by Tasks 3–4):
  - `normalizeDescription(desc: string): string` (uppercase, collapse whitespace, strip digits and `#*-` reference noise)
  - `interface RecurringItem { key: string; description: string; type: 'expense' | 'income'; avgAmount: number; intervalDays: number; occurrences: number; lastDate: string; nextExpected: string; monthlyEstimate: number }`
  - `detectRecurring(transactions: Record<string, Transaction>): RecurringItem[]` (sorted by `monthlyEstimate` desc)

Detection rules (document in the file comment): group by `normalizeDescription` + type; require **≥ 3 occurrences**; median interval between consecutive dates in **[5, 95] days** with every interval within **±40% of the median** (tolerates weekly/biweekly/monthly/quarterly, rejects one-offs); amounts within **±25% of the median amount**. `avgAmount` = median amount; `nextExpected` = lastDate + median interval; `monthlyEstimate` = `avgAmount × (30 / intervalDays)`.

- [x] **Step 1: Write the failing tests**

Create `src/utils/budget/recurring.test.ts`:

```ts
import type { Transaction } from '../../types/budget'
import { detectRecurring, normalizeDescription } from './recurring'

let id = 0
const tx = (date: string, amount: number, description: string, type: 'expense' | 'income' = 'expense'): Transaction =>
  ({ id: `t${id++}`, date, amount, description, type })

const asRecord = (list: Transaction[]) => Object.fromEntries(list.map((t) => [t.id, t]))

describe('normalizeDescription', () => {
  it('strips reference numbers and case', () => {
    expect(normalizeDescription('NETFLIX.COM #12345')).toBe(normalizeDescription('netflix.com #99999'))
    expect(normalizeDescription('  Spotify   P2B4C ')).toContain('SPOTIFY')
  })
})

describe('detectRecurring', () => {
  it('finds a monthly subscription with jittered dates and amounts', () => {
    const txs = asRecord([
      tx('2026-03-01', 16.99, 'NETFLIX.COM #111'),
      tx('2026-04-02', 16.99, 'NETFLIX.COM #222'),
      tx('2026-05-01', 17.99, 'NETFLIX.COM #333'),
      tx('2026-06-01', 17.99, 'NETFLIX.COM #444'),
    ])
    const items = detectRecurring(txs)
    expect(items).toHaveLength(1)
    expect(items[0].occurrences).toBe(4)
    expect(items[0].intervalDays).toBeGreaterThanOrEqual(28)
    expect(items[0].intervalDays).toBeLessThanOrEqual(32)
    expect(items[0].nextExpected > '2026-06-01').toBe(true)
    expect(items[0].monthlyEstimate).toBeCloseTo(items[0].avgAmount * (30 / items[0].intervalDays), 6)
  })

  it('detects biweekly income (paycheque)', () => {
    const txs = asRecord([
      tx('2026-05-01', 2500, 'ACME PAYROLL', 'income'),
      tx('2026-05-15', 2500, 'ACME PAYROLL', 'income'),
      tx('2026-05-29', 2500, 'ACME PAYROLL', 'income'),
      tx('2026-06-12', 2500, 'ACME PAYROLL', 'income'),
    ])
    const items = detectRecurring(txs)
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('income')
    expect(items[0].intervalDays).toBe(14)
  })

  it('rejects fewer than 3 occurrences, irregular gaps, and swinging amounts', () => {
    const txs = asRecord([
      tx('2026-05-01', 50, 'ONE OFF STORE'),
      tx('2026-05-02', 50, 'ONE OFF STORE'),
      // irregular
      tx('2026-01-01', 40, 'RANDOM SHOP'),
      tx('2026-01-05', 40, 'RANDOM SHOP'),
      tx('2026-06-01', 40, 'RANDOM SHOP'),
      // amount swings
      tx('2026-03-01', 10, 'GROCERY MART'),
      tx('2026-04-01', 300, 'GROCERY MART'),
      tx('2026-05-01', 80, 'GROCERY MART'),
    ])
    expect(detectRecurring(txs)).toHaveLength(0)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/budget/recurring.test.ts`
Expected: FAIL — cannot resolve `./recurring`.

- [x] **Step 3: Implement**

Create `src/utils/budget/recurring.ts`:

```ts
// Recurring-charge detection. Groups transactions by normalized description
// + type, then accepts a group as recurring when: >=3 occurrences, the
// median gap between consecutive dates is 5-95 days with every gap within
// ±40% of the median, and every amount is within ±25% of the median amount.

import type { Transaction } from '../../types/budget'

export function normalizeDescription(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/[#*]?\d[\w\d]*/g, '') // reference numbers / alphanumeric refs starting with a digit
    .replace(/[#*-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface RecurringItem {
  key: string
  description: string
  type: 'expense' | 'income'
  avgAmount: number
  intervalDays: number
  occurrences: number
  lastDate: string
  nextExpected: string
  monthlyEstimate: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function detectRecurring(transactions: Record<string, Transaction>): RecurringItem[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of Object.values(transactions)) {
    const norm = normalizeDescription(t.description)
    if (!norm) continue
    const key = `${t.type}:${norm}`
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }

  const items: RecurringItem[] = []
  for (const [key, list] of groups) {
    if (list.length < 3) continue
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(
        Math.round(
          (new Date(`${sorted[i].date}T00:00:00`).getTime() -
            new Date(`${sorted[i - 1].date}T00:00:00`).getTime()) / DAY_MS,
        ),
      )
    }
    const gapMed = median(gaps)
    if (gapMed < 5 || gapMed > 95) continue
    if (!gaps.every((g) => Math.abs(g - gapMed) <= gapMed * 0.4)) continue

    const amounts = sorted.map((t) => t.amount)
    const amtMed = median(amounts)
    if (amtMed <= 0 || !amounts.every((a) => Math.abs(a - amtMed) <= amtMed * 0.25)) continue

    const last = sorted[sorted.length - 1]
    const next = new Date(`${last.date}T00:00:00`)
    next.setDate(next.getDate() + Math.round(gapMed))
    items.push({
      key,
      description: last.description,
      type: last.type,
      avgAmount: amtMed,
      intervalDays: Math.round(gapMed),
      occurrences: sorted.length,
      lastDate: last.date,
      nextExpected: next.toISOString().slice(0, 10),
      monthlyEstimate: amtMed * (30 / Math.round(gapMed)),
    })
  }
  return items.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate)
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/budget/recurring.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/budget/recurring.ts src/utils/budget/recurring.test.ts
git commit -m "feat: recurring/subscription detection over budget transactions"
```

---

### Task 2: Category stats + anomaly detection

**Files:**
- Create: `src/utils/budget/categoryStats.ts`
- Create: `src/utils/budget/categoryStats.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `Category` types.
- Produces (used by Tasks 4, 6):
  - `categoryMonthlyTotal(transactions: Record<string, Transaction>, categoryId: string, month: string): number` (expenses only)
  - `categoryMonthlySeries(transactions: Record<string, Transaction>, categoryId: string, monthsBack: number, refDate?: Date): { month: string; total: number }[]` (oldest→newest, includes the current month last)
  - `interface Anomaly { categoryId: string; monthSpend: number; rollingAvg: number; ratio: number }`
  - `detectAnomalies(transactions: Record<string, Transaction>, categories: Record<string, Category>, month: string, refDate?: Date): Anomaly[]` — flags categories where the month's spend > **1.5×** the average of the previous 3 completed months AND exceeds it by > **$50** (both thresholds as exported consts).

- [x] **Step 1: Write the failing tests**

Create `src/utils/budget/categoryStats.test.ts`:

```ts
import type { Category, Transaction } from '../../types/budget'
import { categoryMonthlySeries, categoryMonthlyTotal, detectAnomalies } from './categoryStats'

let id = 0
const tx = (date: string, amount: number, categoryId: string): Transaction =>
  ({ id: `t${id++}`, date, amount, categoryId, description: 'x', type: 'expense' })
const asRecord = (list: Transaction[]) => Object.fromEntries(list.map((t) => [t.id, t]))

const categories: Record<string, Category> = {
  dining: { id: 'dining', groupId: 'g', name: 'Dining', targetAmount: 200 },
  rent: { id: 'rent', groupId: 'g', name: 'Rent', targetAmount: 1000 },
}

const txs = asRecord([
  tx('2026-04-10', 100, 'dining'), tx('2026-05-12', 120, 'dining'), tx('2026-06-15', 110, 'dining'),
  tx('2026-07-01', 400, 'dining'), // July blowout: avg(100,120,110)=110 → ratio 3.6
  tx('2026-04-01', 1000, 'rent'), tx('2026-05-01', 1000, 'rent'),
  tx('2026-06-01', 1000, 'rent'), tx('2026-07-01', 1000, 'rent'), // steady
])

describe('categoryMonthlyTotal / series', () => {
  it('sums a category month', () => {
    expect(categoryMonthlyTotal(txs, 'dining', '2026-05')).toBe(120)
    expect(categoryMonthlyTotal(txs, 'dining', '2026-01')).toBe(0)
  })

  it('builds an oldest-to-newest series ending at the reference month', () => {
    const s = categoryMonthlySeries(txs, 'dining', 4, new Date('2026-07-15T12:00:00'))
    expect(s.map((p) => p.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07'])
    expect(s.map((p) => p.total)).toEqual([100, 120, 110, 400])
  })
})

describe('detectAnomalies', () => {
  it('flags the blowout month and not the steady category', () => {
    const anomalies = detectAnomalies(txs, categories, '2026-07', new Date('2026-07-15T12:00:00'))
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({ categoryId: 'dining', monthSpend: 400, rollingAvg: 110 })
    expect(anomalies[0].ratio).toBeCloseTo(400 / 110, 6)
  })

  it('ignores small-dollar spikes (under the $50 floor)', () => {
    const small = asRecord([
      tx('2026-04-10', 10, 'dining'), tx('2026-05-12', 10, 'dining'),
      tx('2026-06-15', 10, 'dining'), tx('2026-07-01', 40, 'dining'),
    ])
    expect(detectAnomalies(small, categories, '2026-07', new Date('2026-07-15T12:00:00'))).toHaveLength(0)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/budget/categoryStats.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/utils/budget/categoryStats.ts`:

```ts
// Per-category expense stats and anomaly detection (vs a 3-month rolling
// average of completed months). Thresholds exported for UI copy.

import type { Category, Transaction } from '../../types/budget'

export const ANOMALY_RATIO = 1.5
export const ANOMALY_MIN_DELTA = 50

export function categoryMonthlyTotal(
  transactions: Record<string, Transaction>,
  categoryId: string,
  month: string,
): number {
  return Object.values(transactions)
    .filter((t) => t.type === 'expense' && t.categoryId === categoryId && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0)
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function categoryMonthlySeries(
  transactions: Record<string, Transaction>,
  categoryId: string,
  monthsBack: number,
  refDate: Date = new Date(),
): { month: string; total: number }[] {
  const series: { month: string; total: number }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
    const month = monthKey(d)
    series.push({ month, total: categoryMonthlyTotal(transactions, categoryId, month) })
  }
  return series
}

export interface Anomaly {
  categoryId: string
  monthSpend: number
  rollingAvg: number
  ratio: number
}

export function detectAnomalies(
  transactions: Record<string, Transaction>,
  categories: Record<string, Category>,
  month: string,
  refDate: Date = new Date(),
): Anomaly[] {
  const anomalies: Anomaly[] = []
  for (const cat of Object.values(categories)) {
    const monthSpend = categoryMonthlyTotal(transactions, cat.id, month)
    if (monthSpend <= 0) continue
    const prior: number[] = []
    for (let i = 1; i <= 3; i++) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
      prior.push(categoryMonthlyTotal(transactions, cat.id, monthKey(d)))
    }
    const rollingAvg = prior.reduce((a, b) => a + b, 0) / prior.length
    if (rollingAvg <= 0) continue
    if (monthSpend > rollingAvg * ANOMALY_RATIO && monthSpend - rollingAvg > ANOMALY_MIN_DELTA) {
      anomalies.push({ categoryId: cat.id, monthSpend, rollingAvg, ratio: monthSpend / rollingAvg })
    }
  }
  return anomalies.sort((a, b) => b.ratio - a.ratio)
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/budget/categoryStats.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/budget/categoryStats.ts src/utils/budget/categoryStats.test.ts
git commit -m "feat: category stats + spending anomaly detection vs rolling average"
```

---

### Task 3: Month-end cash-flow forecast (`src/utils/budget/cashFlowForecast.ts`)

**Files:**
- Create: `src/utils/budget/cashFlowForecast.ts`
- Create: `src/utils/budget/cashFlowForecast.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `RecurringItem` (Task 1).
- Produces (used by Task 4):
  - `interface CashFlowForecast { netSoFar: number; expectedIn: number; expectedOut: number; projectedNet: number; pending: { description: string; amount: number; type: 'expense' | 'income'; expectedDate: string }[] }`
  - `forecastMonthEnd(transactions: Record<string, Transaction>, recurring: RecurringItem[], month: string, today: string): CashFlowForecast`

Model (comment): `netSoFar` = income − expenses recorded in `month` up to and including `today`. For each recurring item, project occurrences from `nextExpected` forward every `intervalDays`; any projected date that lands in `month` and is after `today` contributes `avgAmount` to `expectedIn`/`expectedOut` (and a `pending` row). `projectedNet = netSoFar + expectedIn − expectedOut`.

- [x] **Step 1: Write the failing tests**

Create `src/utils/budget/cashFlowForecast.test.ts`:

```ts
import type { Transaction } from '../../types/budget'
import type { RecurringItem } from './recurring'
import { forecastMonthEnd } from './cashFlowForecast'

let id = 0
const tx = (date: string, amount: number, type: 'expense' | 'income'): Transaction =>
  ({ id: `t${id++}`, date, amount, description: 'x', type })
const asRecord = (list: Transaction[]) => Object.fromEntries(list.map((t) => [t.id, t]))

const recurringItem = (over: Partial<RecurringItem>): RecurringItem => ({
  key: 'k', description: 'ITEM', type: 'expense', avgAmount: 100, intervalDays: 30,
  occurrences: 3, lastDate: '2026-06-20', nextExpected: '2026-07-20', monthlyEstimate: 100,
  ...over,
})

describe('forecastMonthEnd', () => {
  const txs = asRecord([
    tx('2026-07-01', 4000, 'income'),
    tx('2026-07-05', 1500, 'expense'),
    tx('2026-06-30', 999, 'expense'), // other month — ignored
  ])

  it('nets recorded flows and adds pending recurring items in-month', () => {
    const f = forecastMonthEnd(
      txs,
      [
        recurringItem({ description: 'RENT', avgAmount: 1000, nextExpected: '2026-07-28' }),
        recurringItem({ description: 'PAYROLL', type: 'income', avgAmount: 2500, nextExpected: '2026-07-15' }),
        recurringItem({ description: 'ALREADY HAPPENED', nextExpected: '2026-07-03' }), // before today
        recurringItem({ description: 'NEXT MONTH', nextExpected: '2026-08-02' }),
      ],
      '2026-07',
      '2026-07-10',
    )
    expect(f.netSoFar).toBe(2500)
    expect(f.expectedIn).toBe(2500)
    expect(f.expectedOut).toBe(1000)
    expect(f.projectedNet).toBe(4000)
    expect(f.pending.map((p) => p.description).sort()).toEqual(['PAYROLL', 'RENT'])
  })

  it('projects multiple occurrences of short-interval items within the month', () => {
    const f = forecastMonthEnd(txs, [
      recurringItem({ description: 'WEEKLY', avgAmount: 50, intervalDays: 7, nextExpected: '2026-07-12' }),
    ], '2026-07', '2026-07-10')
    // 12, 19, 26 July → 3 × 50
    expect(f.expectedOut).toBe(150)
    expect(f.pending).toHaveLength(3)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/budget/cashFlowForecast.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/utils/budget/cashFlowForecast.ts`:

```ts
// Month-end cash-flow forecast: actual net so far this month, plus every
// projected occurrence of detected recurring items that lands later in the
// same month.

import type { Transaction } from '../../types/budget'
import type { RecurringItem } from './recurring'

export interface CashFlowForecast {
  netSoFar: number
  expectedIn: number
  expectedOut: number
  projectedNet: number
  pending: { description: string; amount: number; type: 'expense' | 'income'; expectedDate: string }[]
}

export function forecastMonthEnd(
  transactions: Record<string, Transaction>,
  recurring: RecurringItem[],
  month: string, // YYYY-MM
  today: string, // YYYY-MM-DD
): CashFlowForecast {
  let netSoFar = 0
  for (const t of Object.values(transactions)) {
    if (!t.date.startsWith(month) || t.date > today) continue
    netSoFar += t.type === 'income' ? t.amount : -t.amount
  }

  const pending: CashFlowForecast['pending'] = []
  for (const item of recurring) {
    const cursor = new Date(`${item.nextExpected}T00:00:00`)
    for (let guard = 0; guard < 32; guard++) {
      const dateStr = cursor.toISOString().slice(0, 10)
      if (dateStr.slice(0, 7) > month) break
      if (dateStr.slice(0, 7) === month && dateStr > today) {
        pending.push({ description: item.description, amount: item.avgAmount, type: item.type, expectedDate: dateStr })
      }
      cursor.setDate(cursor.getDate() + item.intervalDays)
    }
  }

  const expectedIn = pending.filter((p) => p.type === 'income').reduce((s, p) => s + p.amount, 0)
  const expectedOut = pending.filter((p) => p.type === 'expense').reduce((s, p) => s + p.amount, 0)
  return { netSoFar, expectedIn, expectedOut, projectedNet: netSoFar + expectedIn - expectedOut, pending }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/budget/cashFlowForecast.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/budget/cashFlowForecast.ts src/utils/budget/cashFlowForecast.test.ts
git commit -m "feat: month-end cash-flow forecast from recurring items"
```

---

### Task 4: Smart widgets — Subscriptions, Anomaly alerts, Cash-flow forecast

**Files:**
- Create: `src/components/budget/SubscriptionsWidget.tsx`
- Create: `src/components/budget/AnomalyAlertsWidget.tsx`
- Create: `src/components/budget/CashFlowForecastWidget.tsx`
- Modify: `src/pages/Budgeting.tsx` (new "Insights" row)

**Interfaces:**
- Consumes: `detectRecurring` (T1), `detectAnomalies`/`ANOMALY_RATIO` (T2), `forecastMonthEnd` (T3), `WidgetWrapper` (`src/components/dashboard/WidgetWrapper.tsx` — `{ title, children, className?, action? }`), `useBudgetStore`, `formatMoney` (`src/components/planner/format.ts`).
- Produces: three widgets, each `React.FC<{ selectedMonth: string }>` (`SubscriptionsWidget` ignores the month — subscriptions are global).

- [x] **Step 1: Implement the three widgets**

Create `src/components/budget/SubscriptionsWidget.tsx`:

```tsx
import React from 'react'
import { Repeat } from 'lucide-react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { detectRecurring } from '../../utils/budget/recurring'
import { formatMoney } from '../planner/format'

export const SubscriptionsWidget: React.FC = () => {
  const transactions = useBudgetStore((s) => s.transactions)
  const items = detectRecurring(transactions).filter((i) => i.type === 'expense')
  const monthlyTotal = items.reduce((s, i) => s + i.monthlyEstimate, 0)

  return (
    <WidgetWrapper title="Subscriptions & recurring">
      {items.length === 0 ? (
        <p className="text-[13px] text-text-secondary mt-2">No repeating charges detected yet — import more history.</p>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-[13px] text-text-secondary">
            ~<span className="text-accent font-semibold">{formatMoney(monthlyTotal)}</span>/month across {items.length} recurring charges
          </p>
          {items.slice(0, 8).map((i) => (
            <div key={i.key} className="flex items-center justify-between text-[13px] border-b border-border pb-1 last:border-b-0">
              <span className="flex items-center gap-2 text-text-primary truncate">
                <Repeat className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate">{i.description}</span>
              </span>
              <span className="text-text-secondary whitespace-nowrap ml-2">
                {formatMoney(i.avgAmount)} · every {i.intervalDays}d · next {i.nextExpected}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  )
}
```

Create `src/components/budget/AnomalyAlertsWidget.tsx`:

```tsx
import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { detectAnomalies } from '../../utils/budget/categoryStats'
import { formatMoney } from '../planner/format'

export const AnomalyAlertsWidget: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const refDate = new Date(`${selectedMonth}-15T12:00:00`)
  const anomalies = detectAnomalies(transactions, categories, selectedMonth, refDate)

  return (
    <WidgetWrapper title="Spending alerts">
      {anomalies.length === 0 ? (
        <p className="text-[13px] text-text-secondary mt-2">Nothing unusual this month.</p>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {anomalies.map((a) => (
            <div key={a.categoryId} className="flex items-start gap-2 text-[13px]">
              <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <p className="text-text-primary">
                <span className="font-medium">{categories[a.categoryId]?.name ?? a.categoryId}</span> is at{' '}
                {formatMoney(a.monthSpend)} — {a.ratio.toFixed(1)}× your {formatMoney(a.rollingAvg)} 3-month average.
              </p>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  )
}
```

Create `src/components/budget/CashFlowForecastWidget.tsx`:

```tsx
import React from 'react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { detectRecurring } from '../../utils/budget/recurring'
import { forecastMonthEnd } from '../../utils/budget/cashFlowForecast'
import { formatMoney } from '../planner/format'

export const CashFlowForecastWidget: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const today = new Date().toISOString().slice(0, 10)
  const f = forecastMonthEnd(transactions, detectRecurring(transactions), selectedMonth, today)

  return (
    <WidgetWrapper title="Month-end forecast">
      <div className="flex flex-col gap-2 mt-2 text-[13px]">
        <div className="flex justify-between"><span className="text-text-secondary">Net so far</span><span className="text-text-primary">{formatMoney(f.netSoFar)}</span></div>
        <div className="flex justify-between"><span className="text-text-secondary">Expected in</span><span className="text-text-primary">+{formatMoney(f.expectedIn)}</span></div>
        <div className="flex justify-between"><span className="text-text-secondary">Expected out</span><span className="text-text-primary">−{formatMoney(f.expectedOut)}</span></div>
        <div className="flex justify-between border-t border-border pt-2">
          <span className="text-text-secondary font-medium">Projected month-end</span>
          <span className={`font-semibold ${f.projectedNet >= 0 ? 'text-accent' : 'text-error'}`}>{formatMoney(f.projectedNet)}</span>
        </div>
        {f.pending.slice(0, 5).map((p) => (
          <p key={`${p.description}-${p.expectedDate}`} className="text-[12px] text-text-secondary">
            {p.expectedDate}: {p.type === 'income' ? '+' : '−'}{formatMoney(p.amount)} {p.description}
          </p>
        ))}
      </div>
    </WidgetWrapper>
  )
}
```

- [x] **Step 2: Add the Insights row to the page**

In `src/pages/Budgeting.tsx`, import the three widgets and insert after the existing Income/Expense/Summary row:

```tsx
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SubscriptionsWidget />
        <AnomalyAlertsWidget selectedMonth={selectedMonth} />
        <CashFlowForecastWidget selectedMonth={selectedMonth} />
      </div>
```

- [x] **Step 3: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. Dev: with imported history the three widgets populate; with an empty store they show their empty states.

- [x] **Step 4: Commit**

```bash
git add src/components/budget/SubscriptionsWidget.tsx src/components/budget/AnomalyAlertsWidget.tsx src/components/budget/CashFlowForecastWidget.tsx src/pages/Budgeting.tsx
git commit -m "feat: budgeting insights — subscriptions, anomaly alerts, cash-flow forecast"
```

---

### Task 5: Sankey income-flow widget

**Files:**
- Create: `src/components/budget/SankeyWidget.tsx`
- Modify: `src/pages/Budgeting.tsx` (add to a new "Visuals" section)

**Interfaces:**
- Consumes: `useBudgetStore` (transactions, categories, categoryGroups), Recharts `Sankey` + `Tooltip`, `WidgetWrapper`.
- Produces: `SankeyWidget: React.FC<{ selectedMonth: string }>`.

Graph: income-category nodes → central "Budget" node → expense category-group nodes. Node/link data built at render: for the month, sum income by category (via `categoryId`, falling back to "Other income") and expenses by the category's group (falling back to "Uncategorized"). Skip rendering the chart (show an empty state) when the month has no income AND no expenses — Recharts Sankey throws on empty node lists.

- [x] **Step 1: Implement**

Create `src/components/budget/SankeyWidget.tsx`:

```tsx
import React from 'react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { formatMoney } from '../planner/format'

export const SankeyWidget: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const categoryGroups = useBudgetStore((s) => s.categoryGroups)

  const incomeByCat = new Map<string, number>()
  const expenseByGroup = new Map<string, number>()
  for (const t of Object.values(transactions)) {
    if (!t.date.startsWith(selectedMonth)) continue
    if (t.type === 'income') {
      const name = (t.categoryId && categories[t.categoryId]?.name) || 'Other income'
      incomeByCat.set(name, (incomeByCat.get(name) ?? 0) + t.amount)
    } else {
      const groupId = t.categoryId ? categories[t.categoryId]?.groupId : undefined
      const name = (groupId && categoryGroups[groupId]?.name) || 'Uncategorized'
      expenseByGroup.set(name, (expenseByGroup.get(name) ?? 0) + t.amount)
    }
  }

  if (incomeByCat.size === 0 && expenseByGroup.size === 0) {
    return (
      <WidgetWrapper title="Income flow">
        <p className="text-[13px] text-text-secondary mt-2">No transactions this month.</p>
      </WidgetWrapper>
    )
  }

  const nodes = [
    ...[...incomeByCat.keys()].map((name) => ({ name })),
    { name: 'Budget' },
    ...[...expenseByGroup.keys()].map((name) => ({ name })),
  ]
  const budgetIdx = incomeByCat.size
  const links = [
    ...[...incomeByCat.entries()].map(([, value], i) => ({ source: i, target: budgetIdx, value })),
    ...[...expenseByGroup.entries()].map(([, value], i) => ({
      source: budgetIdx,
      target: budgetIdx + 1 + i,
      value,
    })),
  ].filter((l) => l.value > 0)

  return (
    <WidgetWrapper title="Income flow" className="md:col-span-2">
      <div className="h-[300px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={{ nodes, links }}
            nodePadding={24}
            margin={{ top: 10, right: 100, bottom: 10, left: 10 }}
            link={{ stroke: 'var(--accent)', strokeOpacity: 0.35 }}
            node={{ fill: 'var(--accent)', stroke: 'var(--border-color)' }}
          >
            <Tooltip
              formatter={(value: number) => formatMoney(value)}
              contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </WidgetWrapper>
  )
}
```

(If node labels are unreadable in some themes, pass a custom `node` renderer that draws `<text fill="var(--text-primary)">` — check during the gate.)

- [x] **Step 2: Add the Visuals section to the page**

In `src/pages/Budgeting.tsx`, after the Insights row:

```tsx
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SankeyWidget selectedMonth={selectedMonth} />
      </div>
```

(The Task 6–7 widgets join this grid.)

- [x] **Step 3: Verify + commit**

Run: `npx vitest run && npm run build`. Dev: month with data shows flows; empty month shows the empty state.

```bash
git add src/components/budget/SankeyWidget.tsx src/pages/Budgeting.tsx
git commit -m "feat: Sankey income-flow widget"
```

---

### Task 6: Category trend sparklines + budget-vs-actual pace bars

**Files:**
- Create: `src/components/budget/CategoryTrendsWidget.tsx`
- Create: `src/components/budget/BudgetProgressWidget.tsx`
- Modify: `src/pages/Budgeting.tsx` (add both to the Visuals grid)

**Interfaces:**
- Consumes: `categoryMonthlySeries`, `categoryMonthlyTotal` (T2), `useBudgetStore`, `WidgetWrapper`, Recharts `LineChart`, `formatMoney`.
- Produces: `CategoryTrendsWidget: React.FC<{ selectedMonth: string }>` (6-month sparkline per category with any spend); `BudgetProgressWidget: React.FC<{ selectedMonth: string }>` (per category with `targetAmount > 0`: spent/target bar + pace).

Pace logic (comment): expected-by-today = `target × (dayOfMonth / daysInMonth)` (for past months: full target). Over pace = spent > expected × 1.1; under = < × 0.9.

- [x] **Step 1: Implement both widgets**

Create `src/components/budget/CategoryTrendsWidget.tsx`:

```tsx
import React from 'react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { categoryMonthlySeries } from '../../utils/budget/categoryStats'
import { formatMoney } from '../planner/format'

export const CategoryTrendsWidget: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const refDate = new Date(`${selectedMonth}-15T12:00:00`)

  const rows = Object.values(categories)
    .map((cat) => ({ cat, series: categoryMonthlySeries(transactions, cat.id, 6, refDate) }))
    .filter(({ series }) => series.some((p) => p.total > 0))
    .sort((a, b) => b.series[5].total - a.series[5].total)
    .slice(0, 8)

  return (
    <WidgetWrapper title="Category trends (6 months)">
      {rows.length === 0 ? (
        <p className="text-[13px] text-text-secondary mt-2">No categorized spending yet.</p>
      ) : (
        <div className="flex flex-col gap-1 mt-2">
          {rows.map(({ cat, series }) => (
            <div key={cat.id} className="flex items-center gap-3 text-[13px]">
              <span className="w-28 truncate text-text-secondary">{cat.name}</span>
              <div className="flex-1 h-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <span className="w-20 text-right text-text-primary">{formatMoney(series[5].total)}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  )
}
```

Create `src/components/budget/BudgetProgressWidget.tsx`:

```tsx
import React from 'react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { categoryMonthlyTotal } from '../../utils/budget/categoryStats'
import { formatMoney } from '../planner/format'

// Pace: expected-by-today = target × (day / days-in-month); >110% = over.
export const BudgetProgressWidget: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)

  const now = new Date()
  const isCurrentMonth = now.toISOString().slice(0, 7) === selectedMonth
  const [y, m] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const monthFraction = isCurrentMonth ? now.getDate() / daysInMonth : 1

  const rows = Object.values(categories)
    .filter((c) => c.targetAmount > 0)
    .map((c) => {
      const spent = categoryMonthlyTotal(transactions, c.id, selectedMonth)
      const expected = c.targetAmount * monthFraction
      const pace = spent > expected * 1.1 ? 'over' : spent < expected * 0.9 ? 'under' : 'on'
      return { c, spent, pace }
    })

  return (
    <WidgetWrapper title="Budget vs actual">
      {rows.length === 0 ? (
        <p className="text-[13px] text-text-secondary mt-2">Set target amounts on categories to track progress.</p>
      ) : (
        <div className="flex flex-col gap-3 mt-2">
          {rows.map(({ c, spent, pace }) => (
            <div key={c.id} className="flex flex-col gap-1 text-[13px]">
              <div className="flex justify-between">
                <span className="text-text-primary">{c.name}</span>
                <span className={pace === 'over' ? 'text-error' : 'text-text-secondary'}>
                  {formatMoney(spent)} / {formatMoney(c.targetAmount)}
                  {isCurrentMonth ? ` · ${pace === 'over' ? 'over pace' : pace === 'under' ? 'under pace' : 'on pace'}` : ''}
                </span>
              </div>
              <div className="h-2 rounded bg-bg-primary/50 overflow-hidden">
                <div
                  className={`h-full ${pace === 'over' ? 'bg-error' : 'bg-accent'}`}
                  style={{ width: `${Math.min(100, (spent / c.targetAmount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  )
}
```

- [x] **Step 2: Add both to the Visuals grid** in `src/pages/Budgeting.tsx`.

- [x] **Step 3: Verify + commit**

Run: `npx vitest run && npm run build`.

```bash
git add src/components/budget/CategoryTrendsWidget.tsx src/components/budget/BudgetProgressWidget.tsx src/pages/Budgeting.tsx
git commit -m "feat: category sparklines + budget-vs-actual pace bars"
```

---

### Task 7: Spending calendar heatmap

**Files:**
- Create: `src/components/budget/SpendingHeatmapWidget.tsx`
- Modify: `src/pages/Budgeting.tsx` (add to the Visuals grid)

**Interfaces:**
- Consumes: `useBudgetStore`, `WidgetWrapper`, `formatMoney`.
- Produces: `SpendingHeatmapWidget: React.FC<{ selectedMonth: string }>` — a CSS-grid month calendar; each day cell's background is `var(--accent)` at opacity scaled by that day's expense total relative to the month's max day (0 spend = transparent). Title row Mo–Su; cell tooltip via `title` attribute.

- [x] **Step 1: Implement**

Create `src/components/budget/SpendingHeatmapWidget.tsx`:

```tsx
import React from 'react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { formatMoney } from '../planner/format'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export const SpendingHeatmapWidget: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const transactions = useBudgetStore((s) => s.transactions)

  const byDay = new Map<number, number>()
  for (const t of Object.values(transactions)) {
    if (t.type !== 'expense' || !t.date.startsWith(selectedMonth)) continue
    const day = Number(t.date.slice(8, 10))
    byDay.set(day, (byDay.get(day) ?? 0) + t.amount)
  }
  const max = Math.max(0, ...byDay.values())

  const [y, m] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Monday-first

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <WidgetWrapper title="Spending calendar">
      <div className="grid grid-cols-7 gap-1 mt-2 text-[11px]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-text-secondary">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />
          const spend = byDay.get(day) ?? 0
          const opacity = max > 0 ? 0.15 + 0.85 * (spend / max) : 0
          return (
            <div
              key={day}
              title={`${selectedMonth}-${String(day).padStart(2, '0')}: ${formatMoney(spend)}`}
              className="aspect-square rounded flex items-center justify-center border border-border text-text-primary"
              style={{ backgroundColor: spend > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)` : 'transparent' }}
            >
              {day}
            </div>
          )
        })}
      </div>
      <p className="text-[12px] text-text-secondary mt-2">Darker = more spent that day{max > 0 ? ` (max ${formatMoney(max)})` : ''}.</p>
    </WidgetWrapper>
  )
}
```

- [x] **Step 2: Add to the Visuals grid** in `src/pages/Budgeting.tsx`. Final Visuals section:

```tsx
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SankeyWidget selectedMonth={selectedMonth} />
        <SpendingHeatmapWidget selectedMonth={selectedMonth} />
        <CategoryTrendsWidget selectedMonth={selectedMonth} />
        <BudgetProgressWidget selectedMonth={selectedMonth} />
      </div>
```

- [x] **Step 3: Verify + commit**

Run: `npx vitest run && npm run build`.

```bash
git add src/components/budget/SpendingHeatmapWidget.tsx src/pages/Budgeting.tsx
git commit -m "feat: spending calendar heatmap"
```

---

### Task 8: Phase 6 gate — no regressions, mobile + 5 themes, PROGRESS.md

**Files:**
- Modify: `docs/superpowers/plans/PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-07-02-phase-6-budgeting-enhancements.md` (check off boxes)

- [x] **Step 1: Full automated gate**

```bash
npx vitest run
npm run lint
npm run build
```

- [x] **Step 2: Manual acceptance — the spec's Phase 6 "Done when"**

*"The above surface in the Budgeting module without regressing CSV import, triage, rules, or paradigms."*

1. **Regression pass first:** CSV import (recognized + unrecognized mapper), triage inbox categorize, categorization rules, paradigm switch, month navigation — all behave exactly as before.
2. Subscriptions: with ≥3 months of a repeating charge, it's listed with interval + next date; monthly total sensible.
3. Anomalies: inflate one category this month → alert appears with the 1.5× copy; steady categories silent.
4. Forecast: pending recurring rows in the current month; projected net = net + in − out.
5. Sankey: flows match income/expense totals; empty month → empty state (no crash).
6. Sparklines/progress/heatmap: track the month selector; past months show pace as full-month.
7. All 5 themes (especially Sankey labels + heatmap contrast) and 375px viewport: Sankey and heatmap remain legible, grids stack single-column, no horizontal scroll.

- [x] **Step 3: Update PROGRESS.md and commit**

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-6-budgeting-enhancements.md
git commit -m "chore: complete Phase 6 — budgeting insights and visuals verified"
```
