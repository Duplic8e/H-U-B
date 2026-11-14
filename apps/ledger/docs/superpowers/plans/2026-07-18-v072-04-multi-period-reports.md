# v0.7.2 Plan 4: Multi-Period Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Budgeting page gets a period picker (This month, Last month, Last 3/6/12 months, YTD); Overview and Insights widgets aggregate over the chosen range; Budget vs. Actual gains an Unbudgeted spending row.

**Architecture:** A new pure module `period.ts` defines `MonthRange` (inclusive `YYYY-MM` from/to) and helpers. `Budgeting.tsx` keeps a `Period` state (single-month mode with arrows, or a multi-month preset) and passes the derived `MonthRange` down. Widgets swap `t.date.startsWith(selectedMonth)` for `inRange(t.date, range)`. Targets scale by `monthsInRange`.

**Tech Stack:** React 19 + TypeScript, vitest.

**Prerequisites:** Execute AFTER Plan 1 (BudgetProgressWidget total row) and Plan 3 (`countsAsIncome` in widgets). Adapt those code sites here, not vice versa.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-v0.7.2-beta-design.md` section 6
- Presets only, no custom date range
- Pace/forecast logic applies only when the range is exactly the current month
- Theme vars, `formatMoney`, no em dashes in copy
- Run `npx tsc -b && npx vitest run` before each commit

---

### Task 1: Period module

**Files:**
- Create: `src/utils/budget/period.ts`
- Test: `src/utils/budget/period.test.ts`

**Interfaces:**
- Produces (consumed by every later task):
  ```ts
  export interface MonthRange { from: string; to: string }   // inclusive YYYY-MM
  export type PeriodPreset = 'last3' | 'last6' | 'last12' | 'ytd'
  export type Period = { kind: 'month'; month: string } | { kind: 'preset'; preset: PeriodPreset }
  export function monthKeyOf(d: Date): string
  export function shiftMonthKey(month: string, delta: number): string
  export function rangeOf(period: Period, now?: Date): MonthRange
  export function inRange(dateStr: string, range: MonthRange): boolean
  export function monthKeysInRange(range: MonthRange): string[]
  export function monthsInRange(range: MonthRange): number
  export function isSingleMonth(range: MonthRange): boolean
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/utils/budget/period.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  inRange, isSingleMonth, monthKeysInRange, monthKeyOf, monthsInRange, rangeOf, shiftMonthKey,
} from './period'

const now = new Date(2026, 6, 18) // 2026-07-18

describe('period helpers', () => {
  it('monthKeyOf and shiftMonthKey handle year boundaries', () => {
    expect(monthKeyOf(now)).toBe('2026-07')
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2025-12', 1)).toBe('2026-01')
  })

  it('rangeOf month mode is that single month', () => {
    expect(rangeOf({ kind: 'month', month: '2026-07' }, now)).toEqual({ from: '2026-07', to: '2026-07' })
  })

  it('rangeOf presets end at the current month', () => {
    expect(rangeOf({ kind: 'preset', preset: 'last3' }, now)).toEqual({ from: '2026-05', to: '2026-07' })
    expect(rangeOf({ kind: 'preset', preset: 'last12' }, now)).toEqual({ from: '2025-08', to: '2026-07' })
    expect(rangeOf({ kind: 'preset', preset: 'ytd' }, now)).toEqual({ from: '2026-01', to: '2026-07' })
  })

  it('inRange compares by month prefix', () => {
    const r = { from: '2026-05', to: '2026-07' }
    expect(inRange('2026-05-01', r)).toBe(true)
    expect(inRange('2026-07-31', r)).toBe(true)
    expect(inRange('2026-04-30', r)).toBe(false)
    expect(inRange('2026-08-01', r)).toBe(false)
  })

  it('monthKeysInRange and monthsInRange enumerate inclusively', () => {
    const r = { from: '2025-11', to: '2026-02' }
    expect(monthKeysInRange(r)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthsInRange(r)).toBe(4)
    expect(isSingleMonth(r)).toBe(false)
    expect(isSingleMonth({ from: '2026-07', to: '2026-07' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/utils/budget/period.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/utils/budget/period.ts`:

```ts
// Month-granular reporting periods. A range is a pair of inclusive
// YYYY-MM keys; date membership is a simple prefix comparison, which is
// correct because YYYY-MM strings sort lexicographically.

export interface MonthRange { from: string; to: string }
export type PeriodPreset = 'last3' | 'last6' | 'last12' | 'ytd'
export type Period =
  | { kind: 'month'; month: string }
  | { kind: 'preset'; preset: PeriodPreset }

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonthKey(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return monthKeyOf(new Date(y, m - 1 + delta, 1))
}

export function rangeOf(period: Period, now: Date = new Date()): MonthRange {
  if (period.kind === 'month') return { from: period.month, to: period.month }
  const current = monthKeyOf(now)
  switch (period.preset) {
    case 'last3': return { from: shiftMonthKey(current, -2), to: current }
    case 'last6': return { from: shiftMonthKey(current, -5), to: current }
    case 'last12': return { from: shiftMonthKey(current, -11), to: current }
    case 'ytd': return { from: `${now.getFullYear()}-01`, to: current }
  }
}

export function inRange(dateStr: string, range: MonthRange): boolean {
  const m = dateStr.slice(0, 7)
  return m >= range.from && m <= range.to
}

export function monthKeysInRange(range: MonthRange): string[] {
  const keys: string[] = []
  for (let k = range.from; k <= range.to; k = shiftMonthKey(k, 1)) keys.push(k)
  return keys
}

export function monthsInRange(range: MonthRange): number {
  return monthKeysInRange(range).length
}

export function isSingleMonth(range: MonthRange): boolean {
  return range.from === range.to
}
```

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run src/utils/budget/period.test.ts`
Expected: PASS.

```bash
git add src/utils/budget/period.ts src/utils/budget/period.test.ts
git commit -m "feat(budget): month-range period helpers"
```

---

### Task 2: Budgeting page period picker

**Files:**
- Modify: `src/pages/Budgeting.tsx`

**Interfaces:**
- Consumes: `Period`, `rangeOf`, `monthKeyOf`, `shiftMonthKey`, `isSingleMonth` from `../utils/budget/period`; `ThemedSelect` from `../components/ui/ThemedSelect`
- Produces: every child widget now receives `range: MonthRange` instead of `selectedMonth: string`. Widgets are updated in Tasks 3-5; this task and Task 3 land in ONE commit to keep the build green (see Step 4).

- [ ] **Step 1: Replace month state with period state**

In `Budgeting.tsx` replace the `selectedMonth` state block:

```tsx
import { isSingleMonth, monthKeyOf, rangeOf, shiftMonthKey, type Period, type PeriodPreset } from '../utils/budget/period';
import { ThemedSelect } from '../components/ui/ThemedSelect';

const currentMonth = monthKeyOf(new Date());
const [period, setPeriod] = useState<Period>({ kind: 'month', month: currentMonth });
const range = rangeOf(period);
const singleMonth = isSingleMonth(range);

const shiftMonth = (delta: number) => {
  if (period.kind !== 'month') return;
  setPeriod({ kind: 'month', month: shiftMonthKey(period.month, delta) });
};
```

Keep `monthKey` helper deleted (superseded by `monthKeyOf`). The header label:

```tsx
const formattedMonth = period.kind === 'month'
  ? new Date(`${period.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  : `${range.from} to ${range.to}`;
```

- [ ] **Step 2: Render the picker**

Replace the month navigator `<div className="flex items-center gap-1 ...">` content: keep the arrows and label but render arrows and the Today button only when `period.kind === 'month'`, and add a preset select to the left of the navigator (inside the same header flex row):

```tsx
<ThemedSelect
  value={period.kind === 'month' ? (period.month === currentMonth ? 'thisMonth' : 'pickedMonth') : period.preset}
  onChange={(v) => {
    if (v === 'thisMonth') setPeriod({ kind: 'month', month: currentMonth });
    else if (v === 'lastMonth') setPeriod({ kind: 'month', month: shiftMonthKey(currentMonth, -1) });
    else if (v !== 'pickedMonth') setPeriod({ kind: 'preset', preset: v as PeriodPreset });
  }}
  className="text-[13px]"
  options={[
    ...(period.kind === 'month' && period.month !== currentMonth
      ? [{ value: 'pickedMonth', label: formattedMonth }]
      : []),
    { value: 'thisMonth', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'last3', label: 'Last 3 months' },
    { value: 'last6', label: 'Last 6 months' },
    { value: 'last12', label: 'Last 12 months' },
    { value: 'ytd', label: 'Year to date' },
  ]}
/>
```

The existing `selectedMonth !== currentMonth` Today-button condition becomes `period.kind === 'month' && period.month !== currentMonth`.

- [ ] **Step 3: Pass range to children**

Change every widget prop from `selectedMonth={selectedMonth}` to `range={range}`: `IncomeWidget`, `ExpenseWidget`, `MonthlySummaryWidget`, `BudgetProgressWidget`, `SankeyWidget`, `AnomalyAlertsWidget`, `SpendingHeatmapWidget`, `CategoryTrendsWidget`, `TransactionListWidget`, `ParadigmBanner`, `ReallocationHistory`, `CategoryManagerWidget`.

For `ParadigmBanner`, `ReallocationHistory`, `CategoryManagerWidget` (whose internals stay month-based): pass `selectedMonth={range.to}` instead and leave their internals alone. Their props keep the name `selectedMonth`.

- [ ] **Step 4: Update the simple widgets in the same commit**

Update the four simple aggregators to the new prop, replacing the `startsWith` filters:

`IncomeWidget.tsx`:

```tsx
import { inRange, isSingleMonth, type MonthRange } from '../../utils/budget/period';

export const IncomeWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  ...
  const totalIncome = transactionsList
    .filter(t => countsAsIncome(t) && inRange(t.date, range))
    .reduce((sum, t) => sum + t.amount, 0);
  ...
  <span className="text-[12px] text-text-secondary">{isSingleMonth(range) ? 'This Month' : `${range.from} to ${range.to}`}</span>
```

`ExpenseWidget.tsx`: same pattern; `expensesThisMonth` filter becomes `t.type === 'expense' && inRange(t.date, range)`; the "This Month" caption uses the same conditional label.

`SankeyWidget.tsx`: prop `{ range: MonthRange }`; filter `if (!inRange(t.date, range)) continue`.

`TransactionListWidget.tsx`: prop `{ range: MonthRange }`; filter `.filter(tx => inRange(tx.date, range))`.

`MonthlySummaryWidget.tsx`: prop `{ range: MonthRange }`; month filter becomes `inRange(t.date, range)`; the forecast block (Projected Net row) renders only when `isSingleMonth(range) && range.to === monthKeyOf(new Date())`; pass `range.to` as the month argument to `forecastMonthEnd`.

- [ ] **Step 5: Build, fix remaining compile errors, verify, commit**

Run: `npx tsc -b`
Expected: remaining errors only in `BudgetProgressWidget`, `SpendingHeatmapWidget`, `CategoryTrendsWidget`, `AnomalyAlertsWidget` (Tasks 3-4). Update their prop types minimally in this commit (accept `range`, compute `const selectedMonth = range.to` internally as a temporary bridge) so the build is green; their real range behavior lands next.

Run: `npx tsc -b && npx vitest run` (update any widget tests that pass `selectedMonth` to pass `range={{ from: month, to: month }}`).
Expected: PASS.

```bash
git add src/pages/Budgeting.tsx src/components/budget
git commit -m "feat(budget): period picker with month ranges across overview widgets"
```

---

### Task 3: Budget vs. Actual over ranges + Unbudgeted row

**Files:**
- Modify: `src/components/budget/BudgetProgressWidget.tsx` (includes Plan 1's total row)

**Interfaces:**
- Consumes: `MonthRange`, `inRange`, `monthsInRange`, `isSingleMonth`, `monthKeyOf`; `totalMonthlyBudget` from Plan 1
- Produces: prop `{ range: MonthRange }`

- [ ] **Step 1: Scale targets and add the Unbudgeted row**

Rewrite the widget's computation section:

```tsx
export const BudgetProgressWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const categoryGroups = useBudgetStore((s) => s.categoryGroups)

  const months = monthsInRange(range)
  const currentMonthKey = monthKeyOf(new Date())
  const isCurrentSingleMonth = isSingleMonth(range) && range.to === currentMonthKey
  const [y, m] = range.to.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const monthFraction = isCurrentSingleMonth ? new Date().getDate() / daysInMonth : 1

  const txInRange = Object.values(transactions).filter(
    (t) => t.type === 'expense' && inRange(t.date, range),
  )
  const spentByCategory = new Map<string, number>()
  for (const t of txInRange) {
    const key = t.categoryId ?? ''
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + t.amount)
  }

  const rows = Object.values(categories)
    .filter((c) => c.targetAmount > 0)
    .map((c) => {
      const spent = spentByCategory.get(c.id) ?? 0
      const target = c.targetAmount * months
      const expected = target * monthFraction
      const pace = spent > expected * 1.1 ? 'over' : spent < expected * 0.9 ? 'under' : 'on'
      return { c, spent, target, pace }
    })

  const budgeted = totalMonthlyBudget(categories, categoryGroups) * months
  const totalSpent = txInRange.reduce((s, t) => s + t.amount, 0)
  const unbudgeted = txInRange
    .filter((t) => !t.categoryId || (categories[t.categoryId]?.targetAmount ?? 0) === 0)
    .reduce((s, t) => s + t.amount, 0)
```

Rendering changes:
- Category rows display `{formatMoney(spent)} / {formatMoney(target)}` (the scaled target) and show the pace suffix only when `isCurrentSingleMonth`.
- Progress bar width uses `spent / target`.
- The total header row (from Plan 1) uses the scaled `budgeted`.
- After the category rows, when `unbudgeted > 0` add:

```tsx
<div className="flex justify-between text-[13px] pt-2 border-t border-border">
  <span className="text-text-secondary">Unbudgeted spending</span>
  <span className="text-error font-medium">{formatMoney(unbudgeted)}</span>
</div>
```

Remove the now-unused `categoryMonthlyTotal` import if nothing else uses it here.

- [ ] **Step 2: Verify and commit**

Run: `npx tsc -b && npx vitest run` (adapt `BudgetProgressWidget` tests to the `range` prop).
Expected: PASS.

Browser: Last 3 months shows targets tripled; an uncategorized expense appears in the Unbudgeted row.

```bash
git add src/components/budget/BudgetProgressWidget.tsx
git commit -m "feat(budget): budget vs actual over ranges with unbudgeted spending row"
```

---

### Task 4: Heatmap month-grid mode

**Files:**
- Modify: `src/components/budget/SpendingHeatmapWidget.tsx`

**Interfaces:**
- Consumes: `MonthRange`, `isSingleMonth`, `monthKeysInRange`, `inRange`, `countsAsIncome`
- Produces: prop `{ range: MonthRange }`

- [ ] **Step 1: Add the multi-month branch**

Prop becomes `{ range: MonthRange }`. When `isSingleMonth(range)`, keep the existing day-grid exactly as-is with `const selectedMonth = range.from`. When multi-month, replace the body with a month-cell grid:

```tsx
if (!isSingleMonth(range)) {
  const monthKeys = monthKeysInRange(range)
  const byMonth = new Map<string, number>()
  for (const t of Object.values(transactions)) {
    if (t.type !== 'expense' || !inRange(t.date, range)) continue
    const k = t.date.slice(0, 7)
    byMonth.set(k, (byMonth.get(k) ?? 0) + t.amount)
  }
  const max = Math.max(0, ...byMonth.values())
  return (
    <WidgetWrapper title="Spending by Month">
      <div className="grid grid-cols-4 gap-1 mt-2 text-[11px]">
        {monthKeys.map((k) => {
          const spend = byMonth.get(k) ?? 0
          const opacity = max > 0 ? 0.15 + 0.85 * (spend / max) : 0
          return (
            <div
              key={k}
              title={`${k}: ${formatMoney(spend)} spent`}
              className="rounded flex flex-col items-center justify-center border border-border text-text-primary py-3 gap-1"
              style={{ backgroundColor: spend > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)` : 'transparent' }}
            >
              <span>{k}</span>
              <span className="text-[10px] text-text-secondary">{formatMoney(spend)}</span>
            </div>
          )
        })}
      </div>
    </WidgetWrapper>
  )
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc -b && npx vitest run` (heatmap tests pass `range` single-month; unchanged assertions should hold).

```bash
git add src/components/budget/SpendingHeatmapWidget.tsx
git commit -m "feat(budget): spending heatmap month-grid for multi-month periods"
```

---

### Task 5: Trends and Alerts over ranges

**Files:**
- Modify: `src/components/budget/CategoryTrendsWidget.tsx`
- Modify: `src/components/budget/AnomalyAlertsWidget.tsx`

**Interfaces:**
- Consumes: `MonthRange`, `isSingleMonth`, `monthKeysInRange`, `monthsInRange`; `categoryMonthlySeries`, `detectAnomalies` from `../../utils/budget/categoryStats` (signatures unchanged)
- Produces: both take `{ range: MonthRange }`

- [ ] **Step 1: CategoryTrendsWidget**

Series length follows the range (minimum 6 so the sparkline stays meaningful in month mode):

```tsx
export const CategoryTrendsWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const monthsBack = Math.max(6, monthsInRange(range))
  const refDate = new Date(`${range.to}-15T12:00:00`)

  const rows = Object.values(categories)
    .map((cat) => ({ cat, series: categoryMonthlySeries(transactions, cat.id, monthsBack, refDate) }))
    .filter(({ series }) => series.some((p) => p.total > 0))
    .sort((a, b) => b.series[b.series.length - 1].total - a.series[a.series.length - 1].total)
    .slice(0, 8)
```

Title: `` `Category Trends (${monthsBack} Months)` ``. The right-hand total shows `series[series.length - 1].total` in month mode; when `!isSingleMonth(range)` show the sum over the range months instead:

```tsx
const rangeTotal = (series: { month: string; total: number }[]) =>
  series.filter((p) => p.month >= range.from && p.month <= range.to).reduce((s, p) => s + p.total, 0)
```

and render `{formatMoney(isSingleMonth(range) ? series[series.length - 1].total : rangeTotal(series))}`.

- [ ] **Step 2: AnomalyAlertsWidget**

Month mode unchanged (use `range.to`). Multi-month: run detection per month and label the month:

```tsx
export const AnomalyAlertsWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)

  const monthKeys = isSingleMonth(range) ? [range.to] : monthKeysInRange(range)
  const anomalies = monthKeys.flatMap((month) =>
    detectAnomalies(transactions, categories, month, new Date(`${month}-15T12:00:00`)).map((a) => ({ ...a, month })),
  )
```

Render: key becomes `` `${a.month}-${a.categoryId}` ``; in multi-month mode prefix the copy with the month: `<span className="font-medium">{a.month}: </span>` before the category name. Empty-state copy: "Nothing unusual in this period."

- [ ] **Step 3: Verify and commit**

Run: `npx tsc -b && npx vitest run`
Expected: PASS.

Browser sweep at Last 6 months: all Overview and Insights widgets show aggregated data; switching back to This month restores the original views; arrows work in month mode only.

```bash
git add src/components/budget/CategoryTrendsWidget.tsx src/components/budget/AnomalyAlertsWidget.tsx
git commit -m "feat(budget): trends and alerts across multi-month periods"
```

---

## Self-Review Checklist

- Spec section 6 covered: presets (T2), range aggregation for summary/income/expense/budget/sankey/trends/alerts (T2/T3/T5), heatmap month grid (T4), unbudgeted row (T3), forecast and pace confined to the current single month (T2 Step 4, T3).
- `MonthRange`/helper names consistent across tasks and with Plan 1's `totalMonthlyBudget`.
- ParadigmBanner/ReallocationHistory/CategoryManager stay monthly by design (they get `range.to`).
