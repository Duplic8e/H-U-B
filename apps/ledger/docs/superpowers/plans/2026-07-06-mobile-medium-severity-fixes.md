# Mobile Medium-Severity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four medium-severity mobile issues from the 2026-07-06 mobile audit: clipped planner stat values, the Budgeting transactions filter row crossing its card boundary, salary-tax bracket labels overflowing narrow bar segments, and sub-guideline tap targets on Dashboard account widgets.

**Execution note:** This plan will be executed after unrelated work lands. Task 0 (drift check) is mandatory and must run first.

**Architecture:** All fixes are Tailwind class changes inside four existing React components — no new components, stores, or routes. Each fix gets a vitest + Testing Library test asserting the responsive classes/behavior, following the existing class-assertion test style in `src/components/planner/CalculatorField.test.tsx:21-26`.

**Tech Stack:** React 19, Tailwind CSS 4.3 (container queries built in), Zustand, Vitest + @testing-library/react (jsdom).

## Global Constraints

- Tailwind v4 syntax only (`@min-[44px]:flex` container-query variants are supported by the installed tailwindcss 4.3.1 — verified in `node_modules/tailwindcss/dist/lib.mjs`).
- Do not change any component's props/API except adding the named export in Task 3 and an `aria-label` in Task 2.
- Mobile breakpoints of record: 320px, 375px, 414px wide. `sm:` = 640px (Tailwind default) — mobile styles are the un-prefixed defaults.
- Run tests with `npx vitest run <file>` (non-watch). The full suite must stay green: `npx vitest run`.
- Dev server for visual verification: `npm run dev -- --port 5175 --strictPort`, app at `http://localhost:5175`.

---

### Task 0: Pre-execution drift check (run first — other work will land between planning and execution)

This plan was written against the codebase as of 2026-07-06 and will be executed later. Before starting Task 1, verify that intervening commits haven't invalidated the plan. This is **not** a re-audit — only check whether the specific files/lines this plan touches still match what the plan expects.

**Files:** none modified — read-only check.

- [ ] **Step 1: Find the commit this plan was written against**

```bash
git log --format="%H %ad" --date=short --diff-filter=A -1 -- docs/superpowers/plans/2026-07-06-mobile-medium-severity-fixes.md
```

This prints the commit that added this plan (call it `<PLAN_COMMIT>`).

- [ ] **Step 2: Diff only the plan's target files since then**

```bash
git diff <PLAN_COMMIT>..HEAD -- \
  src/components/planner/ResultCard.tsx \
  src/components/planner/CalculatorField.test.tsx \
  src/components/budget/TransactionListWidget.tsx \
  src/components/planner/SalaryTaxTool.tsx \
  src/components/dashboard/AccountCategoryWidget.tsx \
  src/store/useAccountsStore.ts \
  src/store/useBudgetStore.ts \
  src/types/budget.ts \
  package.json
```

- [ ] **Step 3: Decide per task**

- **Empty diff** → execute the plan as written. Done with Task 0.
- **A target component changed** → open the file and check whether the exact "replace X with Y" snippets in the affected task still match. If the old code moved but is otherwise identical, just note the new line numbers and proceed. If the old code was rewritten (or the issue was already fixed), mark that task's steps as needing revision and update the task before executing it — do not blind-apply stale snippets.
- **`package.json` changed Tailwind or vitest majors** → re-verify the two version-sensitive assumptions: `@min-[44px]:` container-query support (Task 3) and the test commands.
- **Store/type files changed** → re-check the test seeds in Tasks 2 and 4 against the new state shape (`transactions: Record<string, Transaction>`, `accounts: Account[]`) before running them.

Only the affected task needs updating; unaffected tasks execute as written.

---

### Task 1: ResultCard — stop stat values clipping on narrow cards

At 320–375px the planner result grids give each card ~75–102px of content width; values like `$1,200,000` render 112px wide at the fixed `text-[22px]` and get clipped. Fix: slightly smaller font below `sm`, and allow the value to wrap within the card instead of clipping.

**Files:**
- Modify: `src/components/planner/ResultCard.tsx:16`
- Test: `src/components/planner/CalculatorField.test.tsx` (extend existing `ResultCard` describe block)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: no API change — `ResultCard({ label, value, highlight? })` unchanged. Used by all planner calculators and the forecaster.

- [ ] **Step 1: Write the failing test**

Add to the `describe('ResultCard', ...)` block in `src/components/planner/CalculatorField.test.tsx`:

```tsx
  it('wraps long values and shrinks below the sm breakpoint instead of clipping', () => {
    render(<ResultCard label="Portfolio" value="$1,200,000" />)
    const value = screen.getByText('$1,200,000')
    expect(value.className).toContain('break-words')
    expect(value.className).toContain('text-[18px]')
    expect(value.className).toContain('sm:text-[22px]')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/CalculatorField.test.tsx`
Expected: FAIL — `expect(value.className).toContain('break-words')` (current class is `text-[22px] font-semibold mt-1 ...`).

- [ ] **Step 3: Implement**

In `src/components/planner/ResultCard.tsx`, replace line 16:

```tsx
    <p className={`text-[22px] font-semibold mt-1 ${highlight ? 'text-accent' : 'text-text-primary'}`}>
```

with:

```tsx
    <p className={`text-[18px] sm:text-[22px] font-semibold mt-1 break-words leading-snug ${highlight ? 'text-accent' : 'text-text-primary'}`}>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/planner/CalculatorField.test.tsx`
Expected: PASS (all tests in file).

- [ ] **Step 5: Visual check at 320px and 375px**

With the dev server running, open `http://localhost:5175/#/planner/forecaster` in a 320px- and 375px-wide viewport (browser devtools device mode or preview tools). The `$1,200,000` / `$673,390` stat values must be fully visible — wrapped to a second line if needed, never cut off at the card edge. Also spot-check `#/planner/compound-interest` (same component).

- [ ] **Step 6: Commit**

```bash
git add src/components/planner/ResultCard.tsx src/components/planner/CalculatorField.test.tsx
git commit -m "fix(planner): wrap and downscale ResultCard values on narrow screens"
```

---

### Task 2: TransactionListWidget — wrap the filter header, make row delete usable on touch

The header row (`All Transactions` + category filter + buttons) is `flex justify-between` with no wrap and `overflow: visible`, so on mobile the controls extend ~59px past the card edge. Additionally the per-row delete button is `opacity-0 group-hover:opacity-100` — invisible on touch devices (no hover) — and lacks an accessible name.

**Files:**
- Modify: `src/components/budget/TransactionListWidget.tsx:39,41,113`
- Test: Create `src/components/budget/TransactionListWidget.test.tsx`

**Interfaces:**
- Consumes: `useBudgetStore` (Zustand) — test seeds state via `useBudgetStore.setState({ transactions: {...} })`; `Transaction` type from `src/types/budget.ts` (`{ id, date, amount, categoryId?, description, type: 'expense' | 'income' }`).
- Produces: delete button gains `aria-label="Delete transaction"`. Component props unchanged (`{ selectedMonth: string }`).

- [ ] **Step 1: Write the failing test**

Create `src/components/budget/TransactionListWidget.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { TransactionListWidget } from './TransactionListWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

const initialState = useBudgetStore.getState()

beforeEach(() => {
  useBudgetStore.setState(initialState, true)
})

describe('TransactionListWidget mobile layout', () => {
  it('lets the header row wrap instead of overflowing the card', () => {
    render(<TransactionListWidget selectedMonth="2026-07" />)
    const headerRow = screen.getByText('All Transactions').parentElement as HTMLElement
    expect(headerRow.className).toContain('flex-wrap')
  })

  it('shows the delete button without hover on mobile, hover-revealed from sm up', () => {
    useBudgetStore.setState({
      transactions: {
        tx1: {
          id: 'tx1',
          date: '2026-07-03',
          amount: 42,
          description: 'Coffee',
          type: 'expense',
        },
      },
    })
    render(<TransactionListWidget selectedMonth="2026-07" />)
    const del = screen.getByLabelText('Delete transaction')
    const classes = del.className.split(/\s+/)
    expect(classes).not.toContain('opacity-0') // bare opacity-0 would hide it on touch
    expect(classes).toContain('sm:opacity-0')
    expect(classes).toContain('sm:group-hover:opacity-100')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/budget/TransactionListWidget.test.tsx`
Expected: FAIL — first test: className does not contain `flex-wrap`; second test: `getByLabelText('Delete transaction')` finds no element.

- [ ] **Step 3: Implement**

In `src/components/budget/TransactionListWidget.tsx`:

Replace line 39:

```tsx
      <div className="flex justify-between items-center mb-4 border-b border-border pb-4">
```

with:

```tsx
      <div className="flex flex-wrap justify-between items-center gap-y-2 mb-4 border-b border-border pb-4">
```

Replace line 41:

```tsx
        <div className="flex items-center gap-3">
```

with:

```tsx
        <div className="flex flex-wrap items-center gap-3 min-w-0">
```

Replace the delete button (lines 108–116):

```tsx
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTransaction(tx.id);
                      }}
                      className="p-1.5 text-text-secondary hover:text-error opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-bg-primary"
                    >
```

with:

```tsx
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTransaction(tx.id);
                      }}
                      aria-label="Delete transaction"
                      className="p-2 text-text-secondary hover:text-error sm:opacity-0 sm:group-hover:opacity-100 transition-opacity rounded-md hover:bg-bg-primary"
                    >
```

(`p-1.5` → `p-2` grows the tap target from 28px to 32px square; dropping the bare `opacity-0` makes it always visible below `sm`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/budget/TransactionListWidget.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Visual check at 320px and 375px**

Open `http://localhost:5175/#/budget`, go to the **Transactions** tab at 375px and 320px wide. The "All Categories" select and buttons must sit inside the card (wrapped onto a second line when needed) — nothing crossing the card border, no horizontal scroll contributed by this row.

- [ ] **Step 6: Commit**

```bash
git add src/components/budget/TransactionListWidget.tsx src/components/budget/TransactionListWidget.test.tsx
git commit -m "fix(budget): wrap transaction list header on mobile; touch-visible, labelled delete button"
```

---

### Task 3: SalaryTaxTool — hide bracket-rate labels that cannot fit their segment

Bracket segments are proportional-width; narrow ones (11–15px) clip the centered `26.0%` label to unreadable digit fragments (parent has `overflow-hidden`). Fix with a Tailwind v4 container query: each segment box becomes a `@container`, and the rate label only renders from 44px container width up (the widest label, `"26.0%"`, measures ~21px at `text-[11px]`; 44px gives comfortable padding). The full rate remains available via the segment's `title` tooltip and the income-range caption below.

**Files:**
- Modify: `src/components/planner/SalaryTaxTool.tsx:26,46,49`
- Test: Create `src/components/planner/SalaryTaxTool.test.tsx`

**Interfaces:**
- Consumes: `Bracket` type from `src/utils/finance/canadaTax.ts` (`{ upTo: number; rate: number }`).
- Produces: `BracketBar` becomes a **named export** of `SalaryTaxTool.tsx` — `BracketBar: React.FC<{ title: string; brackets: Bracket[]; income: number }>`. No behavior change for `SalaryTaxTool` itself.

- [ ] **Step 1: Write the failing test**

Create `src/components/planner/SalaryTaxTool.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { BracketBar } from './SalaryTaxTool'

describe('BracketBar', () => {
  it('only shows rate labels when the segment is wide enough (container query)', () => {
    render(
      <BracketBar
        title="Federal"
        income={100000}
        brackets={[
          { upTo: 57375, rate: 0.15 },
          { upTo: 114750, rate: 0.205 },
          { upTo: Infinity, rate: 0.26 },
        ]}
      />,
    )
    const label = screen.getByText('15.0%')
    // hidden by default, shown only from 44px container width up
    expect(label.className).toContain('hidden')
    expect(label.className).toContain('@min-[44px]:flex')
    // the segment box the label sits in must be a container for the query to work
    expect((label.parentElement as HTMLElement).className).toContain('@container')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/SalaryTaxTool.test.tsx`
Expected: FAIL — `BracketBar` is not exported (import resolves to `undefined`).

- [ ] **Step 3: Implement**

In `src/components/planner/SalaryTaxTool.tsx`:

Line 26 — export the component:

```tsx
export const BracketBar: React.FC<{ title: string; brackets: Bracket[]; income: number }> = ({ title, brackets, income }) => {
```

Line 46 — add `@container` to the segment box:

```tsx
              <div className={`@container relative h-7 rounded-md overflow-hidden border ${active ? 'border-accent/60' : 'border-border'} bg-bg-primary/40`}
```

Line 49 — gate the label on container width:

```tsx
                <span className="absolute inset-0 hidden @min-[44px]:flex items-center justify-center text-[11px] font-medium text-text-primary">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/planner/SalaryTaxTool.test.tsx`
Expected: PASS.

- [ ] **Step 5: Visual check — confirm the container query actually compiles and behaves**

jsdom does not evaluate container queries, so this step is mandatory, not optional. Open `http://localhost:5175/#/planner/salary-tax` at 375px and 320px wide:
- Narrow segments (the rightmost slivers of the bracket bars) show **no** label — no clipped digit fragments.
- Wide segments still show their rate label, centered.
- At a desktop width (≥1024px) all labels that fit are visible.

If labels are missing on ALL segments at desktop width, the container query did not compile — check that the class is exactly `@min-[44px]:flex` and that the parent has `@container`, then inspect the built CSS for a `@container (width >= 44px)` rule.

- [ ] **Step 6: Commit**

```bash
git add src/components/planner/SalaryTaxTool.tsx src/components/planner/SalaryTaxTool.test.tsx
git commit -m "fix(planner): hide salary-tax bracket labels in segments too narrow to fit them"
```

---

### Task 4: AccountCategoryWidget — touch-usable account actions

"Edit account" / "Remove account" buttons are 14×14px icons, invisible until hover (`opacity-0 group-hover:opacity-100`) — effectively unusable on touch. The "Add" header button is 42×16px. Fix: pad the icon buttons to a 32px hit area (compensated with negative margin so row height is unchanged), make them always visible below `sm`, and pad the Add button.

**Files:**
- Modify: `src/components/dashboard/AccountCategoryWidget.tsx:39-47,68-81`
- Test: Create `src/components/dashboard/AccountCategoryWidget.test.tsx`

**Interfaces:**
- Consumes: `useAccountsStore` from `src/store/useAccountsStore.ts` — state shape `{ accounts: Account[]; history: NetWorthSnapshot[] }` where `Account = { id: string; name: string; value: number; type: AccountType }` and `AccountType = 'bank' | 'investment' | 'debt' | 'receivable' | 'other'`. The widget reads `getAccountsByType(type)`.
- Produces: no API change — `AccountCategoryWidget({ title, type, className? })` unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/AccountCategoryWidget.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { AccountCategoryWidget } from './AccountCategoryWidget'
import { useAccountsStore } from '../../store/useAccountsStore'

describe('AccountCategoryWidget mobile tap targets', () => {
  it('renders touch-visible, padded edit/remove buttons', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Chequing', value: 1200, type: 'bank' }],
    })
    render(<AccountCategoryWidget title="Bank" type="bank" />)
    const edit = screen.getByLabelText('Edit account')
    const remove = screen.getByLabelText('Remove account')
    for (const btn of [edit, remove]) {
      const classes = btn.className.split(/\s+/)
      expect(classes).toContain('p-2')
      expect(classes).not.toContain('opacity-0') // bare opacity-0 would hide it on touch
      expect(classes).toContain('sm:opacity-0')
      expect(classes).toContain('sm:group-hover:opacity-100')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/AccountCategoryWidget.test.tsx`
Expected: FAIL on the `p-2` / `sm:opacity-0` assertions (current classes: `opacity-0 group-hover:opacity-100`, no padding).

- [ ] **Step 3: Implement**

In `src/components/dashboard/AccountCategoryWidget.tsx`:

Replace the `ActionButton` (lines 39–47):

```tsx
  const ActionButton = (
    <button
      onClick={handleAdd}
      className="flex items-center text-xs font-medium text-text-secondary hover:text-accent transition-colors"
    >
      <Plus size={16} className="mr-1" />
      Add
    </button>
  );
```

with:

```tsx
  const ActionButton = (
    <button
      onClick={handleAdd}
      className="flex items-center text-xs font-medium text-text-secondary hover:text-accent transition-colors px-2 py-1.5 -my-1.5 -mx-2 rounded-md"
    >
      <Plus size={16} className="mr-1" />
      Add
    </button>
  );
```

Replace the edit/remove buttons (lines 68–81):

```tsx
                    <button 
                      onClick={() => handleEdit(acc)}
                      className="text-text-secondary/50 hover:text-accent opacity-0 group-hover:opacity-100 transition-all ml-1"
                      aria-label="Edit account"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => removeAccount(acc.id)}
                      className="text-text-secondary/50 hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Remove account"
                    >
                      <Trash2 size={14} />
                    </button>
```

with:

```tsx
                    <button 
                      onClick={() => handleEdit(acc)}
                      className="p-2 -m-1 text-text-secondary/50 hover:text-accent sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded-md"
                      aria-label="Edit account"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => removeAccount(acc.id)}
                      className="p-2 -m-1 text-text-secondary/50 hover:text-error sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded-md"
                      aria-label="Remove account"
                    >
                      <Trash2 size={14} />
                    </button>
```

(`p-2 -m-1` = 30×30px hit area occupying 22×22px of layout; `ml-1` on the edit button is dropped since the negative margins now handle spacing — verify visually in Step 5.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/AccountCategoryWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Visual check at 375px**

Open `http://localhost:5175/#/` at 375px wide with at least one account present (add one via the widget's Add button if the store is empty). Edit/remove icons must be visible without hover, comfortably tappable, and rows must not have grown taller or misaligned. At desktop width (≥640px), icons should still appear only on row hover.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (this is the last task — guard against cross-file regressions).

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/AccountCategoryWidget.tsx src/components/dashboard/AccountCategoryWidget.test.tsx
git commit -m "fix(dashboard): touch-visible account actions with usable tap targets"
```
