# Budget Audit Cleanup: Savings-Rate Widget + Lint Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Savings-Rate / Income-vs-Expenses trend widget to the Budgeting Overview tab (answering "am I saving?"), and restore ESLint's signal by ignoring `.claude/` tooling plus clearing the mechanical lint errors in app code.

**Architecture:** The widget is a thin presentational component over two new pure selectors added to the existing store-free `budgetSelectors.ts` (mirroring `CategoryTrendsWidget`'s pattern: `monthsBack = max(6, monthsInRange(range))`, `refDate` anchored to `range.to`). All numeric correctness lives in the selectors and is unit-tested there; the widget test only asserts rendered copy, matching the house pattern (`ForecastChart.test.tsx`). The Income Flow (Sankey) widget is left untouched.

**Tech Stack:** React 19, TypeScript, Zustand, Recharts 3, Vitest + Testing Library, ESLint flat config.

## Global Constraints

- **Do not use em dashes** anywhere in code, comments, or copy (user rule).
- **Keep the Income Flow (Sankey) widget** exactly as-is. This plan only adds a widget; it removes nothing from Overview.
- **The full test suite must stay green** (baseline: 619 passing / 122 files). Add tests, never delete or weaken existing ones.
- **Match existing widget conventions**: wrap in `WidgetWrapper`, read the store via `useBudgetStore((s) => s.transactions)`, format currency with `formatMoney`, style with the `var(--accent)` / `var(--error)` / `var(--text-secondary)` / `var(--border-color)` CSS tokens, and set `isAnimationActive={false}` on Recharts marks.
- **Pre-1.0 versioning is `-beta`** (no version bump required for this work; release is a separate step).

---

### Task 1: Scope ESLint to app code

Ignore the `.claude/` tooling tree (GSD `.cjs` scripts and worktree copies) so `npm run lint` reports the ~34 real `src` issues instead of ~868 that are 96% tooling noise. This is independent of every other task and can ship on its own.

**Files:**
- Modify: `eslint.config.js:9` (the `globalIgnores([...])` call)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks (pure config change).

- [ ] **Step 1: Capture the current baseline count**

Run: `npx eslint . 2>&1 | tail -1`
Expected: a line like `✖ 868 problems (862 errors, 6 warnings)` (exact number may vary; note it).

- [ ] **Step 2: Add `.claude` to the global ignores**

In `eslint.config.js`, change:

```js
  globalIgnores(['dist']),
```

to:

```js
  globalIgnores(['dist', '.claude']),
```

- [ ] **Step 3: Verify the noise is gone and only src remains**

Run: `npx eslint . 2>&1 | tail -1`
Expected: `✖ 34 problems (32 errors, 2 warnings)` (same total as `npx eslint src`; the `.claude/` `no-require-imports` flood is gone).

Cross-check they now match:

Run: `npx eslint src 2>&1 | tail -1`
Expected: identical `34 problems` line.

- [ ] **Step 4: Confirm the app still typechecks and tests pass (config-only change, should be untouched)**

Run: `npx tsc -b --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js
git commit -m "chore(lint): ignore .claude tooling so eslint reports app-code issues only"
```

---

### Task 2: Income/expense monthly-series selectors

Add two pure selectors to `budgetSelectors.ts`. `incomeExpenseSeries` builds a per-month `{ month, income, expense }` array (reusing the existing `monthlyIncomeTotal` / `monthlyExpenseTotal`, which already exclude reimbursements via `countsAsIncome`). `savingsRate` reduces a series to `(income - expense) / income`, returning `null` when there is no income so the UI can show a neutral placeholder.

**Files:**
- Modify: `src/store/budgetSelectors.ts` (add import + two exports)
- Test: `src/store/budgetSelectors.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `monthlyIncomeTotal`, `monthlyExpenseTotal` (already in this file); `monthKeyOf` from `../utils/budget/period`.
- Produces:
  - `interface MonthlyFlow { month: string; income: number; expense: number }`
  - `incomeExpenseSeries(transactions: Record<string, Transaction>, monthsBack: number, refDate?: Date): MonthlyFlow[]` (oldest month first)
  - `savingsRate(series: MonthlyFlow[]): number | null`

- [ ] **Step 1: Write the failing tests**

Append to `src/store/budgetSelectors.test.ts`. The `tx(date, amount, type)` helper already exists at the top of this file.

```ts
import { incomeExpenseSeries, savingsRate, type MonthlyFlow } from './budgetSelectors'

describe('incomeExpenseSeries', () => {
  const txns: Record<string, Transaction> = Object.fromEntries(
    [
      tx('2026-05-15', 4000, 'income'),
      tx('2026-05-03', 1500, 'expense'),
      tx('2026-06-20', 4000, 'income'),
      tx('2026-06-01', 3000, 'expense'),
    ].map((t) => [t.id, t]),
  )
  const ref = new Date('2026-06-15T12:00:00')

  it('returns one entry per month, oldest first, with empty months as zero', () => {
    expect(incomeExpenseSeries(txns, 3, ref)).toEqual<MonthlyFlow[]>([
      { month: '2026-04', income: 0, expense: 0 },
      { month: '2026-05', income: 4000, expense: 1500 },
      { month: '2026-06', income: 4000, expense: 3000 },
    ])
  })

  it('excludes reimbursement income (mirrors monthlyIncomeTotal)', () => {
    const withReimb: Record<string, Transaction> = {
      ...txns,
      r: {
        id: 'r', date: '2026-06-05', amount: 50, description: 'payback',
        type: 'income', reimbursement: { from: 'Alex' },
      },
    }
    const june = incomeExpenseSeries(withReimb, 1, ref)[0]
    expect(june).toEqual({ month: '2026-06', income: 4000, expense: 3000 })
  })
})

describe('savingsRate', () => {
  it('computes (income - expense) / income over the whole series', () => {
    const series: MonthlyFlow[] = [
      { month: '2026-05', income: 4000, expense: 1500 },
      { month: '2026-06', income: 4000, expense: 3000 },
    ]
    // income 8000, expense 4500 -> 3500 / 8000
    expect(savingsRate(series)).toBeCloseTo(0.4375, 4)
  })

  it('returns null when there is no income', () => {
    expect(savingsRate([{ month: '2026-01', income: 0, expense: 100 }])).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/store/budgetSelectors.test.ts`
Expected: FAIL, `incomeExpenseSeries`/`savingsRate` are not exported (`... is not a function` / import errors).

- [ ] **Step 3: Implement the selectors**

In `src/store/budgetSelectors.ts`, add this import beside the existing imports at the top:

```ts
import { monthKeyOf } from '../utils/budget/period'
```

Then append at the end of the file:

```ts
export interface MonthlyFlow {
  month: string
  income: number
  expense: number
}

/** Income and expense totals for the N months ending at refDate (oldest
 *  first). Empty months are zero. Reimbursements are excluded from income
 *  because monthlyIncomeTotal filters them out via countsAsIncome. */
export function incomeExpenseSeries(
  transactions: Record<string, Transaction>,
  monthsBack: number,
  refDate: Date = new Date(),
): MonthlyFlow[] {
  const series: MonthlyFlow[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
    const month = monthKeyOf(d)
    series.push({
      month,
      income: monthlyIncomeTotal(transactions, month),
      expense: monthlyExpenseTotal(transactions, month),
    })
  }
  return series
}

/** Savings rate over a set of monthly flows: (income - expense) / income.
 *  Returns null when total income is zero, so callers can render a neutral
 *  placeholder rather than dividing by zero. */
export function savingsRate(series: MonthlyFlow[]): number | null {
  const income = series.reduce((sum, m) => sum + m.income, 0)
  const expense = series.reduce((sum, m) => sum + m.expense, 0)
  if (income <= 0) return null
  return (income - expense) / income
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/store/budgetSelectors.test.ts`
Expected: PASS (all cases in the two new describe blocks, plus the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/store/budgetSelectors.ts src/store/budgetSelectors.test.ts
git commit -m "feat(budget): incomeExpenseSeries and savingsRate selectors"
```

---

### Task 3: Savings-Rate widget on the Overview tab

Build `SavingsRateWidget` (headline savings-rate % plus a grouped income-vs-expense bar chart over the trailing window) and mount it on the Budgeting Overview tab, as a full-width row directly below the Budget-vs-Actual / Income-Flow grid. Nothing existing is removed.

**Files:**
- Create: `src/components/budget/SavingsRateWidget.tsx`
- Create: `src/components/budget/SavingsRateWidget.test.tsx`
- Modify: `src/pages/Budgeting.tsx` (add import near line 22; render in the `overview` block near line 145)

**Interfaces:**
- Consumes: `incomeExpenseSeries`, `savingsRate` (Task 2); `WidgetWrapper`, `useBudgetStore`, `formatMoney`, `chartTooltipStyles`, `monthsInRange`, `type MonthRange`.
- Produces: `export const SavingsRateWidget: React.FC<{ range: MonthRange }>`. The `monthLabel` helper stays module-private (not exported) to avoid a `react-refresh/only-export-components` warning.

- [ ] **Step 1: Write the failing widget test**

Create `src/components/budget/SavingsRateWidget.test.tsx`. Assert on rendered copy only (title, headline %, custom legend, empty state), matching `ForecastChart.test.tsx`. No fake timers are needed because the window is derived from `range.to`, not the wall clock. For a single-month range, `monthsBack = max(6, 1) = 6`, and the window is Jan..Jun 2026.

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SavingsRateWidget } from './SavingsRateWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

afterEach(() => {
  useBudgetStore.setState({ transactions: {} })
})

describe('SavingsRateWidget', () => {
  it('shows the savings rate and income/expense legend for the trailing window', () => {
    useBudgetStore.setState({
      transactions: {
        i: { id: 'i', date: '2026-06-10', amount: 5000, description: 'Salary', type: 'income' },
        e: { id: 'e', date: '2026-06-12', amount: 2500, description: 'Rent', type: 'expense' },
      },
    })
    render(<SavingsRateWidget range={{ from: '2026-06', to: '2026-06' }} />)
    expect(screen.getByText('Savings Rate (6 Months)')).toBeInTheDocument()
    // income 5000, expense 2500 over the window -> 50%
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
  })

  it('renders an empty state when the window has no income or expenses', () => {
    useBudgetStore.setState({ transactions: {} })
    render(<SavingsRateWidget range={{ from: '2026-06', to: '2026-06' }} />)
    expect(screen.getByText('No income or expenses in this window yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/budget/SavingsRateWidget.test.tsx`
Expected: FAIL, cannot resolve `./SavingsRateWidget`.

- [ ] **Step 3: Implement the widget**

Create `src/components/budget/SavingsRateWidget.tsx`:

```tsx
import React from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { incomeExpenseSeries, savingsRate } from '../../store/budgetSelectors'
import { formatMoney } from '../planner/format'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { monthsInRange, type MonthRange } from '../../utils/budget/period'

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' })

export const SavingsRateWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)

  const monthsBack = Math.max(6, monthsInRange(range))
  const refDate = new Date(`${range.to}-15T12:00:00`)
  const series = incomeExpenseSeries(transactions, monthsBack, refDate)
  const rate = savingsRate(series)

  const hasData = series.some((m) => m.income > 0 || m.expense > 0)
  const data = series.map((m) => ({ ...m, label: monthLabel(m.month) }))
  const positive = rate !== null && rate >= 0

  return (
    <WidgetWrapper title={`Savings Rate (${monthsBack} Months)`}>
      {!hasData ? (
        <p className="text-[13px] text-text-secondary mt-2">No income or expenses in this window yet.</p>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-baseline gap-2">
            <span className={`text-[28px] font-bold ${positive ? 'text-accent' : 'text-error'}`}>
              {rate === null ? '-' : `${Math.round(rate * 100)}%`}
            </span>
            <span className="text-[12px] text-text-secondary">
              saved of income over {monthsBack} months
            </span>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) => formatMoney(Number(v))}
                />
                <Tooltip
                  formatter={(value, name) => [formatMoney(Number(value)), name === 'income' ? 'Income' : 'Expenses']}
                  {...chartTooltipStyles}
                />
                <Bar dataKey="income" name="income" fill="var(--accent)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expense" name="expense" fill="var(--error)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-[12px] text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} /> Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--error)' }} /> Expenses
            </span>
          </div>
        </div>
      )}
    </WidgetWrapper>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/budget/SavingsRateWidget.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Mount the widget on the Overview tab**

In `src/pages/Budgeting.tsx`, add the import alongside the other budget-widget imports (near line 22, after the `OwedToMeWidget` import):

```tsx
import { SavingsRateWidget } from '../components/budget/SavingsRateWidget';
```

Then in the `tab === 'overview'` block, insert the widget as its own full-width row between the Budget/Sankey grid and `OwedToMeWidget`. The edited block reads:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BudgetProgressWidget range={range} />
            <SankeyWidget range={range} />
          </div>

          <SavingsRateWidget range={range} />

          <OwedToMeWidget />
```

- [ ] **Step 6: Typecheck, then run the budget test group to confirm nothing regressed**

Run: `npx tsc -b --noEmit`
Expected: no output (clean).

Run: `npx vitest run src/components/budget`
Expected: PASS (all budget widget tests, including the new one).

- [ ] **Step 7: Verify in the browser (Overview renders, no console errors)**

Start the dev server and open the Budgeting page's Overview tab. Confirm the "Savings Rate (6 Months)" card renders below Budget vs. Actual / Income Flow with a headline % and paired bars, and that the console is clean. Capture a screenshot for the review.

- [ ] **Step 8: Commit**

```bash
git add src/components/budget/SavingsRateWidget.tsx src/components/budget/SavingsRateWidget.test.tsx src/pages/Budgeting.tsx
git commit -m "feat(budget): savings-rate and income-vs-expenses widget on Overview"
```

---

### Task 4: Clear the mechanical app-code lint errors

Fix the five zero-risk, behavior-preserving lint errors so `eslint src` drops from 34 to 29. Scope is deliberately limited to the mechanical fixes: the BOM regexes (write the literal U+FEFF as an escape) and two dead `let` initializers in `csvParser`. The remaining 29 items are judgement calls tracked in "Deferred work" below and are out of scope here.

**Files:**
- Modify: `src/utils/investments/ibkrPortfolioAnalyst.ts:56` and `:62`
- Modify: `src/utils/portfolioCsv.ts:93`
- Modify: `src/utils/csvParser.ts:62-73`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (internal cleanups; no signatures change).

- [ ] **Step 1: Replace the literal BOM with a `\uFEFF` escape in the two investments files**

These regexes currently contain a raw U+FEFF byte-order-mark character (the reason ESLint flags `no-irregular-whitespace`). The escape sequence `\uFEFF` matches the exact same character, so behavior is unchanged; only the source representation changes. When editing, replace the invisible BOM character between `/^` and `/` with the six literal characters `\uFEFF`.

In `src/utils/investments/ibkrPortfolioAnalyst.ts`, line 56, the line becomes:

```ts
  return text.replace(/^\uFEFF/, '').startsWith('Introduction,')
```

And line 62 becomes:

```ts
  const rows = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: true }).data
```

In `src/utils/portfolioCsv.ts`, line 93, the header transform becomes:

```ts
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
```

- [ ] **Step 2: Remove the dead initializers in csvParser**

In `src/utils/csvParser.ts`, the `Account Activity (Headerless)` parser initializes `amount` and `type` and then unconditionally reassigns or returns before they are read (`no-useless-assignment`). Replace lines 62-73:

```ts
      let amount = 0;
      let type: 'income' | 'expense' = 'expense';

      if (!isNaN(expense)) {
        amount = expense;
        type = 'expense';
      } else if (!isNaN(income)) {
        amount = income;
        type = 'income';
      } else {
        return null;
      }
```

with:

```ts
      let amount: number;
      let type: 'income' | 'expense';

      if (!isNaN(expense)) {
        amount = expense;
        type = 'expense';
      } else if (!isNaN(income)) {
        amount = income;
        type = 'income';
      } else {
        return null;
      }
```

- [ ] **Step 3: Verify those five errors are gone**

Run: `npx eslint src/utils/csvParser.ts src/utils/portfolioCsv.ts src/utils/investments/ibkrPortfolioAnalyst.ts`
Expected: no `no-irregular-whitespace` and no `no-useless-assignment` errors remain in these files (the `no-explicit-any` errors in `csvParser.ts` are expected to remain; they are deferred).

Run: `npx eslint src 2>&1 | tail -1`
Expected: `✖ 29 problems` (down from 34).

- [ ] **Step 4: Confirm behavior is unchanged (typecheck + CSV/portfolio tests)**

Run: `npx tsc -b --noEmit`
Expected: no output (clean).

Run: `npx vitest run src/components/budget/CSVUploader.test.tsx src/store`
Expected: PASS (CSV parsing and store selectors unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/utils/csvParser.ts src/utils/portfolioCsv.ts src/utils/investments/ibkrPortfolioAnalyst.ts
git commit -m "style(lint): escape BOM regexes and drop dead csvParser initializers"
```

---

### Task 5: Release chores for v0.7.4-beta

Bump the version and record the user-facing change in the changelog. This is the last task; it runs after Tasks 1-4 are complete and green. The "What's New" modal renders `CHANGELOG.md` directly, so no separate `whatsNew.ts` edit is needed.

**Files:**
- Modify: `package.json` (the `"version"` field)
- Modify: `CHANGELOG.md` (add a new released section under `## [Unreleased]`)

**Interfaces:**
- Consumes: the shipped widget from Task 3 (for the changelog copy).
- Produces: nothing consumed by code.

- [ ] **Step 1: Bump the package version**

In `package.json`, change:

```json
  "version": "0.7.3-beta",
```

to:

```json
  "version": "0.7.4-beta",
```

- [ ] **Step 2: Add the changelog entry**

In `CHANGELOG.md`, directly below the `## [Unreleased]` line, insert a new released section. Keep the existing `## [Unreleased]` heading in place above it. The prose must contain no em dashes. Insert:

```markdown
## [0.7.4-beta] - 2026-07-22

### Added
- Budgeting: the Overview tab has a new Savings Rate widget showing what share of your income you kept over the trailing six months, with paired income and expense bars per month

### Changed
- Tooling: eslint now ignores the .claude tooling directory, so lint reports only real application issues
```

- [ ] **Step 3: Verify version and changelog render**

Run: `grep '"version"' package.json`
Expected: `"version": "0.7.4-beta",`

Run: `npx tsc -b --noEmit`
Expected: no output (clean).

Confirm no em dashes were introduced:

Run: `grep -n $'—' CHANGELOG.md package.json`
Expected: no output (exit 1).

- [ ] **Step 4: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release v0.7.4-beta"
```

---

## Final Verification

- [ ] **Full suite green**

Run: `npx vitest run`
Expected: at least 619 + 4 new tests passing (2 selector + 2 widget), 0 failures.

- [ ] **Typecheck clean**

Run: `npx tsc -b --noEmit`
Expected: no output.

- [ ] **Lint shows only the deferred backlog**

Run: `npx eslint . 2>&1 | tail -1`
Expected: `✖ 29 problems` (all in the deferred list below; none are `.claude/` noise).

---

## Deferred work (documented, not implemented here)

These came out of the audit but are intentionally excluded from this plan. Each is a real decision or a separate module's concern, and lumping them in would bloat the change and its review.

**Remaining 29 lint items (need per-domain typing judgement, not mechanical fixes):**
- `@typescript-eslint/no-explicit-any` in `csvParser.ts` (5 sites): tightening the CSV row type ripples through every `PARSERS` entry (header rows are `Record<string,string>`, headerless rows are `string[]`); worth a dedicated typed-CSV pass with its own tests.
- `@typescript-eslint/no-explicit-any` in `compensation/CompHeroWidget.tsx`, `compensation/EquityVestingWidget.tsx`, `compensation/CompensationModal.tsx`: out-of-module; belongs to a compensation cleanup.
- `react-refresh/only-export-components` (5, e.g. `NetWorthTrendWidget.tsx`, `ThemedSelect.tsx`): these export a tested pure helper alongside the component and are an accepted pattern in this repo. Leave unless the files are refactored anyway.
- `react-hooks/set-state-in-effect` in `TransactionModal.tsx:51` and `dashboard/AddAccountModal.tsx:33`, plus `react-hooks/exhaustive-deps` in `TransactionModal.tsx:73`: possibly benign, possibly real; each needs its own reproduction and a focused fix.

**R3 - Overview redundancy (product decision):** `IncomeWidget`'s single total equals Monthly Summary's "Money In"; `ExpenseWidget`'s total equals "Money Out". Folding the two single-number cards into Monthly Summary (or giving `IncomeWidget` an income-source breakdown) would de-duplicate the tab. Deferred because the user chose to keep the current widgets; revisit once the Savings-Rate widget has settled the tab's new shape.

**Income Flow (Sankey):** left untouched per the user's decision. If revisited later, the open items from the audit are: color flows per source, add a "Savings / Unspent" outflow node so the diagram balances and surplus is visible, rename the mislabeled "Budget" node, and add a test.
