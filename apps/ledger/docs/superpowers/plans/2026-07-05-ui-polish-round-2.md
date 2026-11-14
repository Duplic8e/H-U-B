# UI Polish Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 14 approved UI/UX fixes from `docs/superpowers/specs/2026-07-05-ui-polish-round-2-design.md`: dropdown backdrop removal, theme-aware chart palette, empty states, dropdown clipping, planner reorder, Upcoming Vests widget, forecaster labels, Title Case audit, investments Plan-vs-Actual rework, spending calendar legend, and net-worth Y-axis.

**Architecture:** React 19 + TypeScript + Vite + Tailwind v4 (CSS-first config in `src/index.css` `@theme` block) + Zustand persisted stores + Recharts. Tests are Vitest + Testing Library, colocated `*.test.tsx`. Theme system: CSS custom properties per `[data-theme='…']` block in `src/index.css`.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Zustand (persist middleware), Recharts, Vitest, @testing-library/react.

## Global Constraints

- Test command: `npx vitest run <path>` (plain `npm test` starts watch mode — never use it in automation).
- Type check + build: `npm run build` (runs `tsc -b && vite build`).
- Themes: 5 named themes (`geometric`, `tactical`, `luxury`, `aurora`, `glass`) plus the `:root` fallback in `src/index.css`. Every new CSS variable must be defined in all 6 blocks.
- Title Case convention (spec item 11): UI labels, stat names, dropdown options, toggle labels, and table headers use Title Case. Minor words (vs, of, in, per, a, the, and, to) stay lowercase unless first word. Sentence-style body copy (hints, empty-state text, `howTo` strings, param descriptions) stays sentence case.
- Modal backdrops (`bg-black/50` + blur) are untouched. Only dropdowns change.
- `ToolInfoButton` (planner info popover) KEEPS its `OverlayBackdrop` — it is a popup, not a dropdown.
- Commit after every task with a conventional-commit message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Remove dropdown backdrops + open animation

**Files:**
- Modify: `src/index.css` (add dropdown-in keyframe/utility, after the `.themed-card` rule ~line 173)
- Modify: `src/components/ui/ThemedSelect.tsx`
- Modify: `src/components/ui/ThemedDatePicker.tsx`
- Modify: `src/components/planner/ToolSwitcher.tsx`
- Modify: `src/components/ui/OverlayBackdrop.tsx` (doc comment only)
- Test: `src/components/ui/ThemedSelect.test.tsx`, `src/components/ui/ThemedDatePicker.test.tsx`

**Interfaces:**
- Produces: CSS utility class `animate-dropdown-in` usable on any dropdown panel.
- `OverlayBackdrop` still exists, consumed only by `ToolInfoButton` (and available for future popups).

- [ ] **Step 1: Write failing tests — no backdrop rendered by dropdowns**

Append to `src/components/ui/ThemedSelect.test.tsx` inside the existing `describe`:

```tsx
  it('renders no overlay backdrop when open', () => {
    render(<ThemedSelect value="a" options={options} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.queryByTestId('overlay-backdrop')).toBeNull()
  })
```

Add the equivalent test to `src/components/ui/ThemedDatePicker.test.tsx` (open the picker via its trigger button, assert `screen.queryByTestId('overlay-backdrop')` is null while the calendar grid is visible — follow that file's existing open pattern).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/ThemedSelect.test.tsx src/components/ui/ThemedDatePicker.test.tsx`
Expected: the two new tests FAIL (backdrop is found); others pass.

- [ ] **Step 3: Add the dropdown animation utility to `src/index.css`**

After the `.themed-card` block (~line 173), add:

```css
@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.animate-dropdown-in {
  animation: dropdown-in 120ms ease-out;
  transform-origin: top;
}
```

- [ ] **Step 4: Remove `OverlayBackdrop` from the three dropdown components**

In `src/components/ui/ThemedSelect.tsx`:
- Delete the import `import { OverlayBackdrop } from './OverlayBackdrop'`.
- In the `open &&` JSX, remove the `<OverlayBackdrop …/>` line and the now-unneeded fragment (`<>…</>`), keeping only the listbox `div`.
- On the listbox `div` className, replace `z-30` with `z-40` (no backdrop below it anymore; must clear surrounding cards) and append `animate-dropdown-in`.
- Update the component doc comment (line 18-19): drop the words "blur backdrop".

In `src/components/ui/ThemedDatePicker.tsx`: same three changes (remove import + `<OverlayBackdrop/>` + fragment; add `animate-dropdown-in` and `z-40` to the popover `div`, currently line 54; fix the doc comment "with blur backdrop").

In `src/components/planner/ToolSwitcher.tsx`: same (remove import + backdrop + fragment; menu `div` at line 50-52 gets `z-40` and `animate-dropdown-in`).

Outside-click close already works in all three via their window `pointerdown` listeners — do not touch that logic. Note: ThemedDatePicker has NO pointerdown listener today (it relied on the backdrop's onClick). Add one, mirroring ThemedSelect lines 31-38:

```tsx
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])
```

(add `useEffect, useRef` to the React import and `ref={rootRef}` on the root `div`).

In `src/components/ui/OverlayBackdrop.tsx`, update the doc comment to say it is for click-opened POPUPS (e.g. ToolInfoButton) and that dropdowns must not use it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/ui src/components/planner`
Expected: PASS (including `OverlayBackdrop.test.tsx`, which still tests the component itself, and `ToolInfoButton.test.tsx`, unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/components/ui/ThemedSelect.tsx src/components/ui/ThemedSelect.test.tsx src/components/ui/ThemedDatePicker.tsx src/components/ui/ThemedDatePicker.test.tsx src/components/planner/ToolSwitcher.tsx src/components/ui/OverlayBackdrop.tsx
git commit -m "fix: dropdowns no longer blur the background, add open animation"
```

---

### Task 2: ThemedSelect viewport-aware max-height and flip-up

**Files:**
- Modify: `src/components/ui/ThemedSelect.tsx`
- Test: `src/components/ui/ThemedSelect.test.tsx`

**Interfaces:**
- Produces: exported pure helper `menuPlacement(rect: { top: number; bottom: number }, viewportHeight: number): { openUp: boolean; maxHeight: number }` from `ThemedSelect.tsx` (used by tests; ThemedDatePicker does not need it — its popover is fixed-height 264px and rarely clips, spec scopes it conditionally).

- [ ] **Step 1: Write failing tests for the placement helper**

Append to `src/components/ui/ThemedSelect.test.tsx`:

```tsx
import { menuPlacement } from './ThemedSelect'

describe('menuPlacement', () => {
  it('opens down with full height when there is room below', () => {
    expect(menuPlacement({ top: 100, bottom: 130 }, 800)).toEqual({ openUp: false, maxHeight: 256 })
  })

  it('clamps height to remaining space below', () => {
    // 800 - 600 bottom - 16 margin = 184 available
    expect(menuPlacement({ top: 570, bottom: 600 }, 800)).toEqual({ openUp: false, maxHeight: 184 })
  })

  it('flips up when below is cramped and above has more room', () => {
    // below: 800 - 720 - 16 = 64 (< 160); above: 690 - 16 = 674 → up, clamped to 256
    expect(menuPlacement({ top: 690, bottom: 720 }, 800)).toEqual({ openUp: true, maxHeight: 256 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/ThemedSelect.test.tsx`
Expected: FAIL — `menuPlacement` is not exported.

- [ ] **Step 3: Implement the helper and wire it in**

In `src/components/ui/ThemedSelect.tsx` add above the component:

```tsx
const MENU_MAX = 256 // px, matches previous max-h-64
const MENU_MARGIN = 16
const MIN_BELOW = 160

/** Decide dropdown direction and scroll height from the trigger's rect. */
export function menuPlacement(
  rect: { top: number; bottom: number },
  viewportHeight: number,
): { openUp: boolean; maxHeight: number } {
  const below = viewportHeight - rect.bottom - MENU_MARGIN
  const above = rect.top - MENU_MARGIN
  if (below < MIN_BELOW && above > below) {
    return { openUp: true, maxHeight: Math.min(MENU_MAX, above) }
  }
  return { openUp: false, maxHeight: Math.min(MENU_MAX, Math.max(below, MIN_BELOW)) }
}
```

In the component, add state and measure on open:

```tsx
  const [placement, setPlacement] = useState({ openUp: false, maxHeight: 256 })

  const openListbox = () => {
    if (rootRef.current) {
      setPlacement(menuPlacement(rootRef.current.getBoundingClientRect(), window.innerHeight))
    }
    setHighlight(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
```

On the listbox `div`, replace `max-h-64` with an inline style and direction-aware classes:

```tsx
          <div
            role="listbox"
            style={{ maxHeight: placement.maxHeight }}
            className={`absolute left-0 right-0 z-40 overflow-y-auto themed-card border border-border rounded-lg shadow-xl p-1 flex flex-col animate-dropdown-in ${
              placement.openUp ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
```

(Note: the trigger's plain `onClick={() => (open ? setOpen(false) : openListbox())}` already routes through `openListbox`, so measurement happens on every open.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/ThemedSelect.test.tsx`
Expected: PASS (jsdom rects are all zeros → `below = -16 < 160`, `above = -16`, not `> below` → opens down with `maxHeight: 160`; existing behavioral tests are placement-agnostic and still pass).

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open Budgeting → All Transactions, open the categories filter near the bottom of the frame. The list must either flip upward or clamp so the whole scrollable menu is visible.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ThemedSelect.tsx src/components/ui/ThemedSelect.test.tsx
git commit -m "fix: category dropdown clamps to viewport and flips up when cramped"
```

---

### Task 3: ToolSwitcher hover uses accent highlight

**Files:**
- Modify: `src/components/planner/ToolSwitcher.tsx:72-74`

**Interfaces:** none (pure styling).

- [ ] **Step 1: Change the menu item classes**

In `ToolSwitcher.tsx`, the menu item button className (currently):

```tsx
className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-[14px] transition-colors ${
  isCurrent ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary hover:bg-bg-primary/50'
}`}
```

becomes:

```tsx
className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-[14px] transition-colors ${
  isCurrent ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary hover:bg-accent/10 hover:text-accent'
}`}
```

- [ ] **Step 2: Verify**

Run: `npx vitest run src/pages/Planner.test.tsx`
Expected: PASS. Then manually: open the planner tool dropdown; hovering any tool shows accent tint (matching the Debt Payoff strategy dropdown), not a dark block.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/ToolSwitcher.tsx
git commit -m "fix: planner tool dropdown hover uses accent highlight"
```

---

### Task 4: Theme-aware chart palette (fix color collisions)

**Files:**
- Modify: `src/index.css` (`:root` + all 5 `[data-theme]` blocks)
- Modify: `src/components/compensation/CompHeroWidget.tsx:21-27`
- Modify: `src/components/compensation/EquityVestingWidget.tsx:20`
- Test: `src/components/compensation/CompHeroWidget.test.tsx` (existing tests must stay green)

**Interfaces:**
- Produces: CSS variables `--chart-1` … `--chart-6` available in every theme. `--chart-1` is always the theme accent; `--chart-2..6` never collide with the accent's hue family within their theme.

- [ ] **Step 1: Add palette variables to `src/index.css`**

Add these lines inside EACH theme block (after each block's `--error:` line). Values per block:

`:root` and `[data-theme='geometric']` (accent blue #3b82f6):
```css
  --chart-1: #3b82f6;
  --chart-2: #8b5cf6;
  --chart-3: #f59e0b;
  --chart-4: #ec4899;
  --chart-5: #06b6d4;
  --chart-6: #ef4444;
```

`[data-theme='tactical']` (accent emerald #10b981 — no second green/teal):
```css
  --chart-1: #10b981;
  --chart-2: #8b5cf6;
  --chart-3: #f59e0b;
  --chart-4: #ec4899;
  --chart-5: #3b82f6;
  --chart-6: #ef4444;
```

`[data-theme='luxury']` (accent gold #d4a853 — no amber; ESPP/grant-3 slot becomes sky):
```css
  --chart-1: #d4a853;
  --chart-2: #8b5cf6;
  --chart-3: #38bdf8;
  --chart-4: #ec4899;
  --chart-5: #34d399;
  --chart-6: #ef4444;
```

`[data-theme='aurora']` (accent emerald #34d399 — no second green; brighter stops for dark bg):
```css
  --chart-1: #34d399;
  --chart-2: #a78bfa;
  --chart-3: #fbbf24;
  --chart-4: #f472b6;
  --chart-5: #38bdf8;
  --chart-6: #f87171;
```

`[data-theme='glass']` (accent cyan #22d3ee — no second cyan; RSU slot becomes emerald):
```css
  --chart-1: #22d3ee;
  --chart-2: #a78bfa;
  --chart-3: #fbbf24;
  --chart-4: #f472b6;
  --chart-5: #34d399;
  --chart-6: #f87171;
```

- [ ] **Step 2: Adopt the variables in the two compensation widgets**

`src/components/compensation/CompHeroWidget.tsx` lines 21-27 become:

```tsx
const COMP_COLORS = {
  baseSalary: 'var(--chart-1)',
  cashBonus: 'var(--chart-2)',
  espp: 'var(--chart-3)',
  rrsp: 'var(--chart-4)',
  rsu: 'var(--chart-5)',
}
```

`src/components/compensation/EquityVestingWidget.tsx` line 20 becomes:

```tsx
  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']
```

- [ ] **Step 3: Run compensation tests**

Run: `npx vitest run src/components/compensation`
Expected: PASS.

- [ ] **Step 4: Manual visual pass**

`npm run dev` → Compensation page → cycle all 5 themes via the theme selector. Check: monthly cash flow stack (Base vs RSU distinguishable in glass; Base vs ESPP distinguishable in luxury) and equity vesting chart (grant 1 vs grant 3 distinguishable in luxury).

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/compensation/CompHeroWidget.tsx src/components/compensation/EquityVestingWidget.tsx
git commit -m "fix: per-theme chart palette eliminates accent/series color collisions"
```

---

### Task 5: Expenses widget $0 state

**Files:**
- Modify: `src/components/budget/ExpenseWidget.tsx`
- Test: create `src/components/budget/ExpenseWidget.test.tsx`

**Interfaces:** none.

- [ ] **Step 1: Write the failing test**

Create `src/components/budget/ExpenseWidget.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExpenseWidget } from './ExpenseWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

describe('ExpenseWidget', () => {
  it('renders $0.00 without an empty-state message when there are no expenses', () => {
    useBudgetStore.setState({ transactions: {}, categories: {} })
    render(<ExpenseWidget selectedMonth="2026-07" />)
    expect(screen.getByText('Expenses')).toBeTruthy()
    expect(screen.getByText(/\$0/)).toBeTruthy()
    expect(screen.queryByText(/No expenses this month/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/budget/ExpenseWidget.test.tsx`
Expected: FAIL on the `queryByText(/No expenses/)` assertion.

- [ ] **Step 3: Implement**

In `src/components/budget/ExpenseWidget.tsx`: delete the `EmptyState` import (line 5) and replace the ternary (lines 41-52) with the list only:

```tsx
        {sortedCategories.length > 0 && (
          <div className="flex flex-col gap-2 mt-2 overflow-y-auto max-h-[200px] pr-2">
            {sortedCategories.map(([category, amount]) => (
              <div key={category} className="flex justify-between items-center p-2 bg-bg-secondary rounded border border-border">
                <span className="text-[14px] text-text-primary">{category}</span>
                <span className="text-[14px] font-medium">{formatMoney(amount)}</span>
              </div>
            ))}
          </div>
        )}
```

The `$0.00` total (line 37) already renders unconditionally. Title stays "Expenses".

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/budget/ExpenseWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/ExpenseWidget.tsx src/components/budget/ExpenseWidget.test.tsx
git commit -m "fix: expenses widget shows plain $0 layout instead of empty-state text"
```

---

### Task 6: Planner group reorder

**Files:**
- Modify: `src/components/planner/toolRegistry.tsx:23-29`

- [ ] **Step 1: Reorder**

```tsx
export const PLANNER_GROUPS: PlannerToolGroup[] = [
  'Forecasting & Growth',
  'Savings',
  'Income & Tax',
  'Debt & Housing',
  'Utilities',
]
```

- [ ] **Step 2: Verify**

Run: `npx vitest run src/pages/Planner.test.tsx`
Expected: PASS (if a test asserts the old order, update it to the new order — that is the intended behavior change).

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/toolRegistry.tsx
git commit -m "feat: move Income & Tax above Debt & Housing in planner"
```

---

### Task 7: Forecaster source labels

**Files:**
- Modify: `src/components/planner/forecaster/ForecasterTool.tsx`
- Test: create `src/components/planner/forecaster/ForecasterTool.test.tsx`

**Interfaces:** none. `AutoField`'s `autoHint` prop now carries the full display label for auto mode.

- [ ] **Step 1: Write the failing test**

Create `src/components/planner/forecaster/ForecasterTool.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForecasterTool } from './ForecasterTool'

describe('ForecasterTool source labels', () => {
  it('shows friendly auto/manual labels instead of auto:<hint>', () => {
    render(<MemoryRouter><ForecasterTool /></MemoryRouter>)
    expect(screen.getByText('Dashboard Net Worth')).toBeTruthy()
    expect(screen.getByText('Budget Average (3 Months)')).toBeTruthy()
    expect(screen.queryByText(/auto:/i)).toBeNull()
  })
})
```

(If the default persisted settings start in manual mode, set auto mode first via the store used by `useForecasterSettings` — check that hook's defaults; `autoStart`/`autoSavings` default to auto in the current implementation.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/forecaster/ForecasterTool.test.tsx`
Expected: FAIL — `auto: Dashboard net worth` renders instead.

- [ ] **Step 3: Implement**

In `ForecasterTool.tsx`:
- `AutoField` line 40: `{auto ? \`auto: ${autoHint}\` : 'manual'}` → `{auto ? autoHint : 'Manual'}`
- Line 89: `autoHint="Dashboard net worth"` → `autoHint="Dashboard Net Worth"`
- Line 98: `autoHint="Budget avg (3mo)"` → `autoHint="Budget Average (3 Months)"`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/planner/forecaster/ForecasterTool.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/forecaster/ForecasterTool.tsx src/components/planner/forecaster/ForecasterTool.test.tsx
git commit -m "fix: forecaster shows Dashboard Net Worth / Budget Average (3 Months) / Manual"
```

---

### Task 8: Title Case audit + info popup descriptions

**Files:**
- Modify: `src/components/planner/DebtPayoffCalculator.tsx`
- Modify: `src/components/planner/forecaster/ForecasterTool.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (all `info` blocks + param `name`s)
- Modify: any other file surfaced by the sweep in Step 3

**Interfaces:** none (string-only changes).

- [ ] **Step 1: Fix the known offenders (exact edits)**

`src/components/planner/DebtPayoffCalculator.tsx`:
- Line 75: `label="Min payment"` → `label="Min Payment"`
- Line 94: `label: 'Avalanche (highest APR first)'` → `label: 'Avalanche (Highest APR First)'`
- Line 95: `label: 'Snowball (smallest balance first)'` → `label: 'Snowball (Smallest Balance First)'`
- Line 104: `label="vs other strategy"` → `label="vs Other Strategy"`

`src/components/planner/forecaster/ForecasterTool.tsx`:
- Line 86: `label="Starting balance"` → `label="Starting Balance"`
- Line 95: `label="Monthly savings"` → `label="Monthly Savings"`
- Line 104: `Comp events / debt drag` → `Comp Events / Debt Drag`
- Line 112: `` `${autoFeed.compLumps.length} comp events on` `` → `` `${autoFeed.compLumps.length} Comp Events On` `` and `'comp events off'` → `'Comp Events Off'`
- Line 120: `` `debt drag ${…}/mo` `` → `` `Debt Drag ${…}/mo` `` and `'debt drag off'` → `'Debt Drag Off'`
- Line 128-132: `label="Years"` (ok), `label="Return"` (ok), `label="Inflation"` (ok), `label="Contribution step-up"` → `"Contribution Step-Up"`, `label="Scenario spread"` → `"Scenario Spread"`
- Line 163: `label="Annual spending in retirement"` → `"Annual Spending in Retirement"`
- Line 164: `label="Withdrawal rate"` → `"Withdrawal Rate"`
- Line 165: `label="FI number"` → `"FI Number"`
- Line 166: `label="Projected FI date"` → `"Projected FI Date"`
- Line 169: `` label={`Coast-FI (needed today to coast for ${settings.years}y)`} `` → `` label={`Coast-FI (Needed Today to Coast for ${settings.years}y)`} ``

- [ ] **Step 2: Rewrite the forecaster `info` block with definitions (exact content)**

In `src/components/planner/toolRegistry.tsx`, replace the forecaster tool's `info` (lines 57-72) with:

```tsx
    info: {
      howTo: 'Project your net worth forward. Start from your dashboard net worth or a manual balance, set monthly savings and assumptions, then read the FI Number, projected FI date, and Monte Carlo odds below the chart. FI Number is the portfolio size at which annual withdrawals at your chosen rate cover your annual spending — the point where work becomes optional.',
      params: [
        { name: 'Starting Balance', description: 'Where the projection begins. Auto mode pulls your dashboard net worth; manual lets you type any figure.' },
        { name: 'Monthly Savings', description: 'How much you add every month across all accounts. Auto mode uses your average budget surplus over the last 3 months.' },
        { name: 'Years', description: 'How far into the future the chart projects.' },
        { name: 'Return', description: 'Expected average annual investment return, in percent, before inflation.' },
        { name: 'Inflation', description: "Expected annual inflation. Real (today's dollars) mode subtracts this from returns." },
        { name: 'Contribution Step-Up', description: 'Annual percent increase to your monthly savings, modeling raises.' },
        { name: 'Scenario Spread', description: 'Plus or minus percent applied to the return to draw optimistic and pessimistic bands.' },
        { name: 'Comp Events / Debt Drag', description: 'Comp Events adds your upcoming RSU vesting payouts from Compensation as one-time boosts. Debt Drag subtracts your ongoing monthly debt payments from savings until each debt is paid off.' },
        { name: 'Annual Spending in Retirement', description: 'What you expect to spend per year once retired. Sets the FI target.' },
        { name: 'Withdrawal Rate', description: 'The percent of your portfolio you plan to withdraw each year in retirement. FI Number = annual spending divided by this rate (4% is the classic "safe withdrawal rate").' },
        { name: 'Volatility (Std Dev)', description: 'How much returns swing year to year in the Monte Carlo simulation. 15 is typical for a stock-heavy portfolio.' },
      ],
    },
```

- [ ] **Step 3: Systematic sweep of the rest of the app**

Find remaining lowercase label candidates:

```bash
grep -rnoE "(label|name|title)(=\"|: ')[a-zA-Z0-9$(){}. /%-]*[a-z] [a-z][a-zA-Z ()/%-]*" src/components src/pages --include="*.tsx" | grep -v test | grep -v description
```

For every hit that is a UI label / stat name / option label / table header / param `name` (NOT body copy, hints, or descriptions): apply Title Case per the Global Constraints convention. This includes all `info.params[].name` entries in `toolRegistry.tsx` (e.g. 'Starting amount' → 'Starting Amount', 'Monthly contribution' → 'Monthly Contribution', 'Annual return' → 'Annual Return', 'Solve for' → 'Solve For') and table headers in `PlanTable.tsx`/`ActualTable.tsx` ('Initial investment' → 'Initial Investment', 'Start price' → 'Start Price', 'Current price' → 'Current Price', 'Current value' → 'Current Value', 'Average price' → 'Average Price', 'Extra investment' → 'Extra Investment'), `FundSummaryBar.tsx` ('Start date' → 'Start Date', 'Initial fund' → 'Initial Fund', 'Extra fund' → 'Extra Fund', 'Total fund' → 'Total Fund', 'Current value' → 'Current Value', 'Total return' → 'Total Return'), and `Investments.tsx` Stats ('Total planned' → 'Total Planned', 'Actually invested' → 'Actually Invested', 'Current value' → 'Current Value').

While in `toolRegistry.tsx`, audit every tool's `howTo` and `params` for undefined jargon: any term of art (Coast-FI, APR, amortization, marginal rate, safe withdrawal rate…) must be defined in plain language on first use in that tool's info. A description must never merely restate the name.

- [ ] **Step 4: Run the full test suite and fix label-dependent tests**

Run: `npx vitest run`
Expected: failures only in tests asserting old strings (e.g. `getByText('Min payment')`) — update those assertions to the new Title Case strings.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "fix: Title Case labels app-wide and more descriptive planner info popups"
```

---

### Task 9: Spending calendar visual legend

**Files:**
- Modify: `src/components/budget/SpendingHeatmapWidget.tsx:50`
- Test: create `src/components/budget/SpendingHeatmapWidget.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/budget/SpendingHeatmapWidget.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpendingHeatmapWidget } from './SpendingHeatmapWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

describe('SpendingHeatmapWidget legend', () => {
  it('shows a color-swatch legend instead of the darker-equals-more text', () => {
    useBudgetStore.setState({
      transactions: {
        t1: { id: 't1', date: '2026-07-03', amount: 50, type: 'expense', description: '', categoryId: undefined },
      } as never,
    })
    render(<SpendingHeatmapWidget selectedMonth="2026-07" />)
    expect(screen.queryByText(/Darker = more/i)).toBeNull()
    expect(screen.getByTestId('heatmap-legend')).toBeTruthy()
    expect(screen.getByText('$0')).toBeTruthy()
  })
})
```

(Adjust the transaction object shape to match `useBudgetStore`'s `Transaction` type if it differs — check the type in `src/store/useBudgetStore.ts` first.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/budget/SpendingHeatmapWidget.test.tsx`
Expected: FAIL — legend testid missing, "Darker = more" text found.

- [ ] **Step 3: Implement**

Replace line 50 (`<p …>Darker = more spent…</p>`) with:

```tsx
      <div data-testid="heatmap-legend" className="flex items-center gap-1.5 mt-2 text-[11px] text-text-secondary">
        <span>$0</span>
        {[0.15, 0.36, 0.57, 0.78, 1].map((op) => (
          <span
            key={op}
            className="w-4 h-3 rounded-sm border border-border"
            style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(op * 100)}%, transparent)` }}
          />
        ))}
        <span>{max > 0 ? formatMoney(max) : 'max'}</span>
      </div>
```

(The five opacity stops sample the exact cell formula `0.15 + 0.85 * ratio` at ratios 0, 0.25, 0.5, 0.75, 1.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/budget/SpendingHeatmapWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/SpendingHeatmapWidget.tsx src/components/budget/SpendingHeatmapWidget.test.tsx
git commit -m "feat: spending calendar gets a visual color legend"
```

---

### Task 10: Upcoming Vests dashboard widget

**Files:**
- Create: `src/components/dashboard/widgets/UpcomingVestsWidget.tsx`
- Create: `src/components/dashboard/widgets/UpcomingVestsWidget.test.tsx`
- Modify: `src/pages/Dashboard.tsx` (register id + element)

**Interfaces:**
- Consumes: `useCompensationStore` (`primaryPackage`), `generateVestEvents(grant: RSUGrant, currentPrice: number): VestEvent[]` where `VestEvent = { monthIndex, date?: string ISO, label, vestValue, cumulativeVested }`.
- Produces: `UpcomingVestsWidget: React.FC` registered under dashboard id `'upcoming-vests'`.

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/widgets/UpcomingVestsWidget.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UpcomingVestsWidget } from './UpcomingVestsWidget'
import { useCompensationStore } from '../../../store/useCompensationStore'

describe('UpcomingVestsWidget', () => {
  it('shows an invitation when there are no grants', () => {
    useCompensationStore.setState((s) => ({
      primaryPackage: { ...s.primaryPackage, rsuGrants: [] },
    }))
    render(<UpcomingVestsWidget />)
    expect(screen.getByText('Upcoming Vests')).toBeTruthy()
    expect(screen.getByText(/Add RSU/i)).toBeTruthy()
  })

  it('lists future vest events sorted by date with values', () => {
    const nextYear = new Date().getFullYear() + 1
    useCompensationStore.setState((s) => ({
      primaryPackage: {
        ...s.primaryPackage,
        companyCurrentPrice: 100,
        rsuGrants: [{
          id: 'g1',
          grantName: 'New Hire',
          grantShares: 480,
          grantPrice: 50,
          grantStartDate: `${nextYear - 1}-01-01`,
          vestingSchedule: { preset: '4yr-1yr-cliff', totalVestMonths: 48, cliffMonths: 12, frequency: 'quarterly' },
        }],
      },
    }))
    render(<UpcomingVestsWidget />)
    expect(screen.getAllByText(/New Hire/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/widgets/UpcomingVestsWidget.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the widget**

Create `src/components/dashboard/widgets/UpcomingVestsWidget.tsx`:

```tsx
import React from 'react'
import { CalendarClock } from 'lucide-react'
import { WidgetWrapper } from '../WidgetWrapper'
import { useCompensationStore, generateVestEvents } from '../../../store/useCompensationStore'
import { formatMoney } from '../../planner/format'
import { EmptyState } from '../../ui/EmptyState'

const MAX_SHOWN = 4

export const UpcomingVestsWidget: React.FC = () => {
  const pkg = useCompensationStore((s) => s.primaryPackage)
  const now = new Date()

  const upcoming = pkg.rsuGrants
    .flatMap((grant) =>
      generateVestEvents(grant, pkg.companyCurrentPrice).map((e) => ({ ...e, grantName: grant.grantName })),
    )
    .filter((e) => e.date !== undefined && new Date(e.date) > now)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .slice(0, MAX_SHOWN)

  return (
    <WidgetWrapper title="Upcoming Vests">
      {upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          message="No upcoming vests"
          hint="Add RSU grants in Compensation to see your next vesting payouts here."
        />
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {upcoming.map((e) => (
            <div key={`${e.grantName}-${e.monthIndex}`} className="flex items-center justify-between p-2 bg-bg-secondary rounded border border-border">
              <div>
                <p className="text-[13px] text-text-primary font-medium">{e.grantName}</p>
                <p className="text-[12px] text-text-secondary">
                  {new Date(e.date!).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span className="text-[14px] font-medium text-accent">{formatMoney(e.vestValue)}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  )
}
```

(Check `EmptyState`'s props in `src/components/ui/EmptyState.tsx` — it accepts `icon`, `message`, `hint` as used by `Investments.tsx`; adjust if the signature differs.)

- [ ] **Step 4: Register in `src/pages/Dashboard.tsx`**

- Add import: `import { UpcomingVestsWidget } from '../components/dashboard/widgets/UpcomingVestsWidget';`
- Append `'upcoming-vests'` to `DASHBOARD_WIDGET_IDS` (after `'top-goal'`).
- Append `{ id: 'upcoming-vests', element: <UpcomingVestsWidget /> }` to `DASHBOARD_WIDGETS`.

14 widgets + the 2-col `net-worth` span = 15 cells → clean 3-column rows.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/components/dashboard`
Expected: PASS (including `BentoGrid.test.tsx`, `WidgetWrapper.test.tsx`).

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/widgets/UpcomingVestsWidget.tsx src/components/dashboard/widgets/UpcomingVestsWidget.test.tsx src/pages/Dashboard.tsx
git commit -m "feat: Upcoming Vests dashboard widget fills the empty grid slot"
```

---

### Task 11: Net worth trend Y-axis domain

**Files:**
- Modify: `src/components/dashboard/widgets/NetWorthTrendWidget.tsx`
- Test: create `src/components/dashboard/widgets/NetWorthTrendWidget.test.tsx`

**Interfaces:**
- Produces: exported pure helper `trendDomain(values: number[]): [number, number]` from `NetWorthTrendWidget.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/widgets/NetWorthTrendWidget.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { trendDomain } from './NetWorthTrendWidget'

describe('trendDomain', () => {
  it('pads min and max by 8% of the range and never forces zero', () => {
    const [lo, hi] = trendDomain([100000, 110000])
    expect(lo).toBeCloseTo(99200) // 100000 - 800
    expect(hi).toBeCloseTo(110800)
    expect(lo).toBeGreaterThan(0)
  })

  it('handles a flat series with a value-relative pad', () => {
    const [lo, hi] = trendDomain([50000, 50000])
    expect(lo).toBeLessThan(50000)
    expect(hi).toBeGreaterThan(50000)
  })

  it('handles an all-zero series without collapsing', () => {
    const [lo, hi] = trendDomain([0, 0])
    expect(hi).toBeGreaterThan(lo)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/widgets/NetWorthTrendWidget.test.tsx`
Expected: FAIL — `trendDomain` not exported.

- [ ] **Step 3: Implement**

In `NetWorthTrendWidget.tsx`, add above the component:

```tsx
/** Brokerage-style axis: track the data range with headroom, never force zero. */
export function trendDomain(values: number[]): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const pad = range > 0 ? range * 0.08 : Math.max(Math.abs(max) * 0.05, 1)
  return [min - pad, max + pad]
}
```

In the component, compute the domain and pass it to `YAxis`:

```tsx
  const domain = trendDomain(history.map((h) => h.value))
```

and on line 24 add `domain={domain}` plus `allowDataOverflow={false}` to the `<YAxis …>` props. (Place the `domain` computation after the `history.length < 2` early return so `Math.min` never sees an empty array.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/widgets/NetWorthTrendWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/widgets/NetWorthTrendWidget.tsx src/components/dashboard/widgets/NetWorthTrendWidget.test.tsx
git commit -m "fix: net worth trend Y-axis starts at the data range, not zero"
```

---

### Task 12: Analysis store — plannedBudget field + migration v3

**Files:**
- Modify: `src/store/useAnalysisStore.ts`
- Modify: `src/utils/investments/planMetrics.ts`
- Test: create `src/store/useAnalysisStore.test.ts`, create `src/utils/investments/planMetrics.test.ts` (or extend if it exists — check first)

**Interfaces:**
- Produces (later tasks depend on these exact shapes):
  - `InvestmentAnalysis` gains `plannedBudget?: number`.
  - `planRow(position: Position, plannedBudget: number, currentPrice: number): PlanRow` — `PlanRow` loses its `extra` field; `initialInvestment` renamed to `plannedDollars`.
  - `planFundSummary(rows: PlanRow[], plannedBudget: number): FundSummary` (extraFund fixed at 0, initialFund carries plannedBudget).
  - Store persist `version: 3`; migration defaults `plannedBudget = (initialFund ?? 0) + (extraFund ?? 0)`.

- [ ] **Step 1: Write failing tests**

Create `src/store/useAnalysisStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { useAnalysisStore, type InvestmentAnalysis } from './useAnalysisStore'

describe('analysis store plannedBudget', () => {
  it('accepts plannedBudget on an analysis', () => {
    const a: InvestmentAnalysis = {
      id: 'a1', name: 'Test', analysisDate: '2026-01-01',
      plannedBudget: 12000, initialFund: 10000, extraFund: 2000,
      positions: [], swaps: [],
    }
    useAnalysisStore.setState({ analyses: [] })
    useAnalysisStore.getState().addAnalysis(a)
    expect(useAnalysisStore.getState().analyses[0].plannedBudget).toBe(12000)
  })
})
```

Create `src/utils/investments/planMetrics.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { planRow, planFundSummary } from './planMetrics'
import type { Position } from '../../store/useAnalysisStore'

const pos = (over: Partial<Position>): Position => ({
  id: 'p1', ticker: 'AAPL', plannedAmount: 0, startPrice: 100,
  startPriceSource: 'manual', acted: false, lots: [], ...over,
})

describe('planRow with plannedBudget', () => {
  it('computes planned dollars from budget x allocation', () => {
    const r = planRow(pos({ allocationPct: 25 }), 10000, 120)
    expect(r.plannedDollars).toBe(2500)
    expect(r.shares).toBeCloseTo(25) // 2500 / 100
    expect(r.currentValue).toBeCloseTo(3000)
    expect(r.returnDollars).toBeCloseTo(500)
  })
})

describe('planFundSummary', () => {
  it('uses plannedBudget as the fund basis', () => {
    const rows = [planRow(pos({ allocationPct: 100 }), 10000, 110)]
    const s = planFundSummary(rows, 10000)
    expect(s.totalFund).toBe(10000)
    expect(s.currentValue).toBeCloseTo(11000)
    expect(s.totalReturnPct).toBeCloseTo(10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/useAnalysisStore.test.ts src/utils/investments/planMetrics.test.ts`
Expected: FAIL — `plannedBudget` / `plannedDollars` don't exist (TS errors count as failures).

- [ ] **Step 3: Implement store changes**

In `src/store/useAnalysisStore.ts`:
- Add to `InvestmentAnalysis` (after `extraFund?: number`): `plannedBudget?: number`.
- Bump persist `version: 2` → `version: 3` and extend `migrate` with:

```ts
        if (version < 3) {
          if (!Array.isArray(state.analyses)) return state as unknown
          const analyses = (state.analyses as InvestmentAnalysis[]).map((a) => ({
            ...a,
            plannedBudget: a.plannedBudget ?? (a.initialFund ?? 0) + (a.extraFund ?? 0),
          }))
          state = { ...state, analyses }
        }
```

(also update the version-history comment above `migrate`: `// v2: plannedBudget defaults to initialFund + extraFund; funds become actual-side.`)

- [ ] **Step 4: Implement planMetrics changes**

Replace `PlanRow` and `planRow` in `src/utils/investments/planMetrics.ts`:

```ts
export interface PlanRow {
  positionId: string
  ticker: string
  allocationPct: number
  plannedDollars: number
  startPrice: number
  shares: number
  currentPrice: number
  currentValue: number
  returnDollars: number
  returnPct: number | null
}

export function planRow(position: Position, plannedBudget: number, currentPrice: number): PlanRow {
  const allocationPct = position.allocationPct ?? 0
  const plannedDollars = (plannedBudget * allocationPct) / 100
  const shares = position.startPrice > 0 ? plannedDollars / position.startPrice : 0
  const value = shares * currentPrice
  const returnDollars = value - plannedDollars
  return {
    positionId: position.id,
    ticker: position.ticker,
    allocationPct,
    plannedDollars,
    startPrice: position.startPrice,
    shares,
    currentPrice,
    currentValue: value,
    returnDollars,
    returnPct: plannedDollars > 0 ? (returnDollars / plannedDollars) * 100 : null,
  }
}
```

Replace `planFundSummary`:

```ts
export function planFundSummary(rows: PlanRow[], plannedBudget: number): FundSummary {
  const value = rows.reduce((s, r) => s + r.currentValue, 0)
  return {
    initialFund: plannedBudget,
    extraFund: 0,
    totalFund: plannedBudget,
    currentValue: value,
    totalReturnPct: plannedBudget > 0 ? ((value - plannedBudget) / plannedBudget) * 100 : null,
  }
}
```

`actualFundSummary` is unchanged. NOTE: `AnalysisCard.tsx` call sites now have TS errors — that is expected; they are fixed in Tasks 13-14. To keep this task's tests runnable, do NOT run `npm run build` yet; run only the two test files.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/store/useAnalysisStore.test.ts src/utils/investments/planMetrics.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/useAnalysisStore.ts src/store/useAnalysisStore.test.ts src/utils/investments/planMetrics.ts src/utils/investments/planMetrics.test.ts
git commit -m "feat: analysis plannedBudget field with v3 migration; plan math uses budget x allocation"
```

---

### Task 13: Plan tab — Planned Budget input + editable allocation in table

**Files:**
- Modify: `src/components/investments/AnalysisCard.tsx` (plan branch, lines 69-134)
- Modify: `src/components/investments/PlanTable.tsx`
- Modify: `src/components/investments/FundSummaryBar.tsx`
- Modify: `src/pages/Investments.tsx` (header stat basis)

**Interfaces:**
- Consumes: Task 12's `planRow(position, plannedBudget, currentPrice)`, `planFundSummary(rows, plannedBudget)`.
- Produces: `PlanTable` props become `{ analysis, priceFor, onAllocationChange(positionId: string, pct: number): void }`. `FundSummaryBar` props become `{ summary: FundSummary; startDate: string; side: 'plan' | 'actual' }`.

- [ ] **Step 1: Update `FundSummaryBar` for plan/actual sides**

Replace `src/components/investments/FundSummaryBar.tsx` content:

```tsx
import React from 'react'
import { Stat } from '../ui/Stat'
import { formatMoney } from '../planner/format'
import type { FundSummary } from '../../utils/investments/planMetrics'

export const FundSummaryBar: React.FC<{ summary: FundSummary; startDate: string; side: 'plan' | 'actual' }> = ({ summary, startDate, side }) => (
  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 themed-card rounded-lg p-4">
    <Stat label="Start Date" value={startDate} />
    {side === 'plan' ? (
      <Stat label="Planned Budget" value={formatMoney(summary.totalFund)} />
    ) : (
      <>
        <Stat label="Initial Fund" value={formatMoney(summary.initialFund)} />
        <Stat label="Extra Fund" value={formatMoney(summary.extraFund)} />
        <Stat label="Total Invested" value={formatMoney(summary.totalFund)} />
      </>
    )}
    <Stat label="Current Value" value={formatMoney(summary.currentValue)} tone="accent" />
    <Stat
      label="Total Return"
      value={summary.totalReturnPct === null ? 'n/a' : `${summary.totalReturnPct.toFixed(2)}%`}
      tone={summary.totalReturnPct !== null && summary.totalReturnPct < 0 ? 'error' : 'accent'}
    />
  </div>
)
```

- [ ] **Step 2: Make allocation editable in `PlanTable` and drop the Extra column**

Replace `src/components/investments/PlanTable.tsx` content:

```tsx
import React from 'react'
import type { InvestmentAnalysis, Position } from '../../store/useAnalysisStore'
import { planRow } from '../../utils/investments/planMetrics'
import { formatMoney } from '../planner/format'

const th = 'px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-text-secondary'
const td = 'px-3 py-2 text-right text-[13px] text-text-primary tabular-nums'

interface PlanTableProps {
  analysis: InvestmentAnalysis
  priceFor: (p: Position) => number
  onAllocationChange: (positionId: string, pct: number) => void
}

export const PlanTable: React.FC<PlanTableProps> = ({ analysis, priceFor, onAllocationChange }) => {
  const budget = analysis.plannedBudget ?? 0
  const rows = analysis.positions.map((p) => planRow(p, budget, priceFor(p)))
  const totalAllocation = rows.reduce((s, r) => s + r.allocationPct, 0)
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse">
        <thead className="bg-bg-primary/50">
          <tr>
            <th className={`${th} text-left`}>Ticker</th>
            <th className={th}>Allocation %</th>
            <th className={th}>Planned $</th>
            <th className={th}>Start Price</th>
            <th className={th}>Shares</th>
            <th className={th}>Current Price</th>
            <th className={th}>Current Value</th>
            <th className={th}>Return $</th>
            <th className={th}>Return %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.positionId} className="border-t border-border/60">
              <td className={`${td} text-left font-medium`}>{r.ticker}</td>
              <td className={td}>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={100}
                  aria-label={`Allocation % for ${r.ticker}`}
                  className="w-20 bg-bg-primary/50 border border-border rounded px-2 py-1 text-right text-[13px] text-text-primary outline-none focus:border-accent"
                  value={r.allocationPct}
                  onChange={(e) => onAllocationChange(r.positionId, Number(e.target.value))}
                />
              </td>
              <td className={td}>{formatMoney(r.plannedDollars)}</td>
              <td className={td}>{formatMoney(r.startPrice)}</td>
              <td className={td}>{r.shares.toFixed(2)}</td>
              <td className={td}>{formatMoney(r.currentPrice)}</td>
              <td className={td}>{formatMoney(r.currentValue)}</td>
              <td className={`${td} ${r.returnDollars < 0 ? 'text-error' : 'text-accent'}`}>{formatMoney(r.returnDollars)}</td>
              <td className={`${td} ${(r.returnPct ?? 0) < 0 ? 'text-error' : 'text-accent'}`}>{r.returnPct === null ? 'n/a' : `${r.returnPct.toFixed(2)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {Math.round(totalAllocation * 100) !== 10000 && analysis.positions.length > 0 && (
        <p className="px-3 py-2 text-[12px] text-error">Allocations sum to {totalAllocation.toFixed(1)}% (should be 100%).</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Rework the plan branch of `AnalysisCard`**

In `src/components/investments/AnalysisCard.tsx`, replace the `subTab === 'plan'` branch (lines 69-134) with:

```tsx
          {subTab === 'plan' ? (
            <>
              <label className="flex flex-col gap-1 max-w-xs">
                <span className="text-[13px] text-text-secondary">Planned Budget ($)</span>
                <input
                  type="number"
                  className={fundInputCls}
                  value={analysis.plannedBudget ?? 0}
                  onChange={(e) => updateAnalysis(analysis.id, { plannedBudget: Number(e.target.value) })}
                />
              </label>
              <FundSummaryBar
                side="plan"
                summary={planFundSummary(
                  analysis.positions.map((p) => planRow(p, analysis.plannedBudget ?? 0, priceFor(p))),
                  analysis.plannedBudget ?? 0,
                )}
                startDate={analysis.analysisDate}
              />
              <SwapSimulator
                analysis={analysis}
                side="plan"
                priceFor={priceFor}
                investedFor={(p: Position) => planRow(p, analysis.plannedBudget ?? 0, priceFor(p)).plannedDollars}
              />
              <PlanTable
                analysis={analysis}
                priceFor={priceFor}
                onAllocationChange={(positionId, pct) =>
                  updatePosition(analysis.id, positionId, {
                    allocationPct: pct,
                    plannedAmount: ((analysis.plannedBudget ?? 0) * pct) / 100,
                  })
                }
              />
            </>
          ) : (
```

This removes the Initial/Extra fund inputs and the per-position Allocation/Extra input rows from Plan. Note the `plannedAmount` sync: `PositionCard` and `Investments.tsx` still read `position.plannedAmount`, so keep it in step with `plannedBudget × allocationPct`. Also update the Planned Budget input's `onChange` to resync every position:

```tsx
                  onChange={(e) => {
                    const budget = Number(e.target.value)
                    updateAnalysis(analysis.id, { plannedBudget: budget })
                    analysis.positions.forEach((p) =>
                      updatePosition(analysis.id, p.id, { plannedAmount: (budget * (p.allocationPct ?? 0)) / 100 }),
                    )
                  }}
```

- [ ] **Step 4: Update `Investments.tsx` header stat**

In `src/pages/Investments.tsx` line 26, planned total becomes budget-based:

```tsx
  const plannedAll = analyses.reduce((s, a) => s + (a.plannedBudget ?? 0), 0)
```

(keep `positionsAll` for the invested/current sums; label change to 'Total Planned' happens in Task 8 if not already done).

- [ ] **Step 5: Verify compile + tests**

Run: `npx vitest run src/components/investments src/pages` — expected PASS.
Note: `AnalysisCard`'s actual branch still passes the old `FundSummaryBar` props — add `side="actual"` to that call now (one-line change, lines 137):

```tsx
              <FundSummaryBar side="actual" summary={actualFundSummary(analysis.positions, priceFor)} startDate={analysis.analysisDate} />
```

Then: `npm run build` — expected: no TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/investments src/pages/Investments.tsx
git commit -m "feat: plan tab uses single Planned Budget with allocation editable in table"
```

---

### Task 14: Actual tab — fund inputs, Add Trade, traded-positions-only

**Files:**
- Modify: `src/components/investments/AnalysisCard.tsx` (actual branch)
- Modify: `src/components/investments/ActualTable.tsx`
- Create: `src/components/investments/AddTradeForm.tsx`
- Test: create `src/components/investments/AddTradeForm.test.tsx`

**Interfaces:**
- Consumes: `useAnalysisStore.addLot(analysisId, positionId, lot: BuyLot)` where `BuyLot = { id, date, amountInvested, price }`.
- Produces: `AddTradeForm: React.FC<{ analysis: InvestmentAnalysis }>` — self-contained button + inline form. `ActualTable` renders only positions with `lots.length > 0`.

- [ ] **Step 1: Write the failing test**

Create `src/components/investments/AddTradeForm.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AddTradeForm } from './AddTradeForm'
import { useAnalysisStore, type InvestmentAnalysis } from '../../store/useAnalysisStore'

const analysis: InvestmentAnalysis = {
  id: 'a1', name: 'Test', analysisDate: '2026-01-01', plannedBudget: 10000,
  positions: [
    { id: 'p1', ticker: 'AAPL', plannedAmount: 5000, allocationPct: 50, startPrice: 100, startPriceSource: 'manual', acted: false, lots: [] },
    { id: 'p2', ticker: 'MSFT', plannedAmount: 5000, allocationPct: 50, startPrice: 200, startPriceSource: 'manual', acted: false, lots: [] },
  ],
  swaps: [],
}

describe('AddTradeForm', () => {
  it('adds a lot (shares x price) to the chosen position', () => {
    useAnalysisStore.setState({ analyses: [analysis] })
    render(<AddTradeForm analysis={analysis} />)
    fireEvent.click(screen.getByRole('button', { name: /add trade/i }))
    fireEvent.change(screen.getByLabelText('Shares'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '110' } })
    fireEvent.click(screen.getByRole('button', { name: /^save trade$/i }))
    const saved = useAnalysisStore.getState().analyses[0].positions[0]
    expect(saved.lots).toHaveLength(1)
    expect(saved.lots[0].amountInvested).toBe(1100)
    expect(saved.lots[0].price).toBe(110)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/investments/AddTradeForm.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `AddTradeForm`**

Create `src/components/investments/AddTradeForm.tsx`:

```tsx
import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAnalysisStore, type InvestmentAnalysis } from '../../store/useAnalysisStore'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'

const inputCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[14px] outline-none focus:border-accent w-28'

/** "Add Trade" entry point for the Actual tab: pick a planned ticker,
 *  enter date / shares / price; saved as a buy lot on that position. */
export const AddTradeForm: React.FC<{ analysis: InvestmentAnalysis }> = ({ analysis }) => {
  const addLot = useAnalysisStore((s) => s.addLot)
  const [open, setOpen] = useState(false)
  const [positionId, setPositionId] = useState(analysis.positions[0]?.id ?? '')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shares, setShares] = useState(0)
  const [price, setPrice] = useState(0)

  if (analysis.positions.length === 0) return null

  const save = () => {
    if (!positionId || shares <= 0 || price <= 0) return
    addLot(analysis.id, positionId, {
      id: `lot-${Date.now()}`,
      date,
      amountInvested: shares * price,
      price,
    })
    setShares(0)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium border border-accent text-accent bg-accent/10 hover:opacity-90 transition-opacity"
      >
        <Plus className="w-4 h-4" /> Add Trade
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border border-border rounded-lg p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Ticker</span>
        <ThemedSelect
          value={positionId}
          onChange={setPositionId}
          options={analysis.positions.map((p) => ({ value: p.id, label: p.ticker }))}
          className="w-32"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Date</span>
        <ThemedDatePicker value={date} onChange={setDate} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Shares</span>
        <input aria-label="Shares" type="number" step={0.01} className={inputCls} value={shares || ''} onChange={(e) => setShares(Number(e.target.value))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Price</span>
        <input aria-label="Price" type="number" step={0.01} className={inputCls} value={price || ''} onChange={(e) => setPrice(Number(e.target.value))} />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={shares <= 0 || price <= 0}
        className="px-3 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[13px] font-medium disabled:opacity-40"
      >
        Save Trade
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-2 text-[13px] text-text-secondary hover:text-text-primary">
        Cancel
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Filter `ActualTable` to traded positions**

In `src/components/investments/ActualTable.tsx` line 44:

```tsx
  const rows = analysis.positions.filter((p) => p.lots.length > 0).map((p) => actualRow(p, priceFor(p)))
```

- [ ] **Step 5: Rework the actual branch of `AnalysisCard`**

Replace the actual branch (the `) : ( … )` block) with:

```tsx
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] text-text-secondary">Initial Fund ($)</span>
                  <input
                    type="number"
                    className={fundInputCls}
                    value={analysis.initialFund ?? 0}
                    onChange={(e) => updateAnalysis(analysis.id, { initialFund: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] text-text-secondary">Extra Fund ($)</span>
                  <input
                    type="number"
                    className={fundInputCls}
                    value={analysis.extraFund ?? 0}
                    onChange={(e) => updateAnalysis(analysis.id, { extraFund: Number(e.target.value) })}
                  />
                </label>
              </div>
              <AddTradeForm analysis={analysis} />
              {analysis.positions.some((p) => p.lots.length > 0) ? (
                <>
                  <FundSummaryBar side="actual" summary={actualFundSummary(analysis.positions, priceFor)} startDate={analysis.analysisDate} />
                  <SwapSimulator
                    analysis={analysis}
                    side="actual"
                    priceFor={priceFor}
                    investedFor={(p: Position) => totalInvested(p.lots)}
                  />
                  <ActualTable analysis={analysis} priceFor={priceFor} />
                </>
              ) : (
                <p className="text-[13px] text-text-secondary">No trades recorded yet. Add your first trade to see actual performance.</p>
              )}
            </>
          )}
```

Add the import: `import { AddTradeForm } from './AddTradeForm'`.

- [ ] **Step 6: Run tests + build**

Run: `npx vitest run src/components/investments` then `npm run build`
Expected: PASS / no TS errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/investments
git commit -m "feat: actual tab owns funds and trades; shows only traded positions"
```

---

### Task 15: PositionCard collapsed by default

**Files:**
- Modify: `src/components/investments/PositionCard.tsx`
- Test: create `src/components/investments/PositionCard.test.tsx`

**Interfaces:** props unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/components/investments/PositionCard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PositionCard } from './PositionCard'
import type { Position } from '../../store/useAnalysisStore'

const position: Position = {
  id: 'p1', ticker: 'AAPL', plannedAmount: 5000, allocationPct: 50,
  startPrice: 100, startPriceSource: 'manual', acted: false,
  lots: [{ id: 'l1', date: '2026-01-02', amountInvested: 1000, price: 100 }],
}

describe('PositionCard', () => {
  it('starts collapsed showing header numbers, expands on toggle', () => {
    render(<PositionCard analysisId="a1" analysisDate="2026-01-01" position={position} totals={{ plannedAll: 10000, currentAll: 1000 }} />)
    // collapsed: header visible, detail grid hidden
    expect(screen.getByText('AAPL')).toBeTruthy()
    expect(screen.queryByText('If fully executed')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /expand aapl/i }))
    expect(screen.getByText('If fully executed')).toBeTruthy()
  })
})
```

(Note: `PositionCard` calls `useCurrentPrice` which hits the market-data service — check how `EquityVestingWidget.test.tsx` / other tests mock services; if `useCurrentPrice` performs fetches, mock `../../services/marketData` with `vi.mock` returning `{ useCurrentPrice: () => ({ data: undefined, status: 'idle', refresh: () => {}, setManual: () => {}, clearManual: () => {} }) }`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/investments/PositionCard.test.tsx`
Expected: FAIL — detail grid is always rendered.

- [ ] **Step 3: Implement collapse**

In `PositionCard.tsx`:
- Add state: `const [expanded, setExpanded] = useState(false)`
- Add `ChevronDown` to the lucide import.
- Restructure the JSX: the outer `div` keeps the header block (ticker line, price line) but the manual-price form, the stats grid (`grid grid-cols-2 md:grid-cols-4`), and the `<details>` lots section render only when `expanded`. Add compact numbers to the collapsed header and a chevron toggle next to the refresh/delete buttons:

```tsx
      <div className="flex items-start justify-between gap-2">
        <div>
          {/* existing ticker h4 + price <p> stay here */}
          {!expanded && (
            <p className="text-[12px] text-text-secondary mt-1">
              Invested {formatMoney(invested)} · Value {formatMoney(value)} · P&L {pct(plPct(position.lots, currentPrice))}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? `Collapse ${position.ticker}` : `Expand ${position.ticker}`}
            className="p-1.5 text-text-secondary hover:text-accent"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {/* existing refresh + delete buttons stay */}
        </div>
      </div>
      {expanded && (
        <>
          {/* manual price form block (moved inside) */}
          {/* stats grid block */}
          {/* lots <details> block */}
        </>
      )}
```

Keep the error message (`live price unavailable…`) visible in both states.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/components/investments/PositionCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/investments/PositionCard.tsx src/components/investments/PositionCard.test.tsx
git commit -m "feat: position cards collapsed by default with expand toggle"
```

---

### Task 16: New Analysis modal mirrors the Plan table

**Files:**
- Modify: `src/components/investments/AnalysisModal.tsx` (full rework of the create flow; keep add-position flow)
- Create: `src/components/investments/TickerRowEditor.tsx`
- Test: create `src/components/investments/AnalysisModal.test.tsx`

**Interfaces:**
- Consumes: `useAnalysisStore.addAnalysis`, `useHistoricalPrice(ticker, exchange, date)` (existing hook returning `{ data?: { value: { close: number }, source, stale }, status }`).
- Produces: `TickerRowEditor: React.FC<{ row: DraftRow; date: string; onChange(row: DraftRow): void; onRemove(): void }>` with `DraftRow = { key: string; ticker: string; exchange: string; allocationPct: number; manualPrice: number | null }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/investments/AnalysisModal.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AnalysisModal } from './AnalysisModal'
import { useAnalysisStore } from '../../store/useAnalysisStore'

vi.mock('../../services/marketData', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHistoricalPrice: () => ({ data: { value: { close: 150 }, source: 'test', stale: false }, status: 'success' }),
}))

describe('AnalysisModal (new analysis)', () => {
  it('creates an analysis with plannedBudget and per-ticker allocations', () => {
    useAnalysisStore.setState({ analyses: [] })
    render(<AnalysisModal isOpen onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Planned Budget ($)'), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText('Ticker 1'), { target: { value: 'aapl' } })
    fireEvent.change(screen.getByLabelText('Allocation % 1'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /save analysis/i }))
    const a = useAnalysisStore.getState().analyses[0]
    expect(a.plannedBudget).toBe(10000)
    expect(a.positions).toHaveLength(1)
    expect(a.positions[0].ticker).toBe('AAPL')
    expect(a.positions[0].allocationPct).toBe(100)
    expect(a.positions[0].plannedAmount).toBe(10000)
    expect(a.positions[0].startPrice).toBe(150)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/investments/AnalysisModal.test.tsx`
Expected: FAIL — no `Planned Budget ($)` field exists.

- [ ] **Step 3: Implement `TickerRowEditor`**

Create `src/components/investments/TickerRowEditor.tsx` (child component so the price hook runs per row):

```tsx
import React from 'react'
import { Trash2 } from 'lucide-react'
import { useHistoricalPrice } from '../../services/marketData'

export interface DraftRow {
  key: string
  ticker: string
  exchange: string
  allocationPct: number
  manualPrice: number | null
}

const inputCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[14px] outline-none focus:border-accent w-full'

/** One planned-position row in the New Analysis modal. Fetches the start
 *  price for its own ticker/date; parent reads it back via resolvedPrice. */
export const TickerRowEditor: React.FC<{
  index: number
  row: DraftRow
  date: string
  onChange: (row: DraftRow) => void
  onRemove: () => void
  onPrice: (key: string, price: number) => void
}> = ({ index, row, date, onChange, onRemove, onPrice }) => {
  const hist = useHistoricalPrice(row.ticker, row.exchange || undefined, date)
  const fetched = hist.data?.value.close
  const effective = row.manualPrice ?? fetched ?? 0

  React.useEffect(() => {
    onPrice(row.key, effective)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.key, effective])

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Ticker {index + 1}</span>
        <input aria-label={`Ticker ${index + 1}`} className={inputCls} value={row.ticker}
          onChange={(e) => onChange({ ...row, ticker: e.target.value, manualPrice: null })} placeholder="AAPL" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Exchange</span>
        <input className={inputCls} value={row.exchange}
          onChange={(e) => onChange({ ...row, exchange: e.target.value })} placeholder="TSX" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Allocation % {index + 1}</span>
        <input aria-label={`Allocation % ${index + 1}`} type="number" min={0} max={100} className={inputCls} value={row.allocationPct || ''}
          onChange={(e) => onChange({ ...row, allocationPct: Number(e.target.value) })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">
          Start Price {row.manualPrice !== null ? '(manual)' : fetched !== undefined ? '(auto)' : hist.status === 'loading' ? '(fetching…)' : ''}
        </span>
        <input type="number" step={0.01} className={inputCls} value={effective || ''}
          onChange={(e) => onChange({ ...row, manualPrice: Number(e.target.value) })} />
      </label>
      <button type="button" onClick={onRemove} aria-label={`Remove ticker ${index + 1}`} className="p-2 text-text-secondary hover:text-error">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Rework `AnalysisModal`'s create flow**

In `AnalysisModal.tsx`, keep the existing single-position flow for `analysisId` mode (add-position) untouched. For the create mode (`!analysisId`), replace the form body with: name, `ThemedDatePicker` date, thesis, `Planned Budget ($)` number input (labelled exactly that, `aria-label` included via `<label>` wrapping), a list of `TickerRowEditor` rows (state `rows: DraftRow[]`, starting with one empty row, "+ Add Ticker" button appends `{ key: crypto.randomUUID(), ticker: '', exchange: '', allocationPct: 0, manualPrice: null }`), and a prices map (`useRef<Record<string, number>>({})` filled by `onPrice`).

Save handler for create mode:

```tsx
  const saveNew = () => {
    const valid = rows.filter((r) => r.ticker.trim() !== '' && r.allocationPct > 0)
    addAnalysis({
      id: `an-${Date.now()}`,
      name: name.trim() || valid[0]?.ticker.trim().toUpperCase() || 'Analysis',
      thesis: thesis.trim() || undefined,
      analysisDate: date,
      plannedBudget,
      positions: valid.map((r, i) => ({
        id: `pos-${Date.now()}-${i}`,
        ticker: r.ticker.trim().toUpperCase(),
        exchange: r.exchange.trim() || undefined,
        allocationPct: r.allocationPct,
        plannedAmount: (plannedBudget * r.allocationPct) / 100,
        startPrice: pricesRef.current[r.key] ?? 0,
        startPriceSource: r.manualPrice !== null ? 'manual' : 'auto',
        acted: false,
        lots: [],
      })),
      swaps: [],
    })
    onClose()
  }
```

`canSave` for create mode: `plannedBudget > 0 && rows.some((r) => r.ticker.trim() !== '' && r.allocationPct > 0)`. Show a non-blocking warning line when valid rows' allocations don't sum to 100: `Allocations sum to {sum}%`.

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run src/components/investments` then `npm run build`
Expected: PASS / no TS errors.

- [ ] **Step 6: Manual verification of the whole investments flow**

`npm run dev` → Investments: create a new analysis with 2 tickers and a $10,000 budget; verify the Plan table mirrors the inputs; edit allocation in the table; switch to Actual — empty until "Add Trade"; add a trade; verify the traded ticker appears with correct invested amount; position cards start collapsed.

- [ ] **Step 7: Commit**

```bash
git add src/components/investments
git commit -m "feat: new analysis modal mirrors plan table with budget and per-ticker allocations"
```

---

### Task 17: Full-suite verification

**Files:** none new.

- [ ] **Step 1: Run everything**

Run: `npx vitest run`
Expected: all tests PASS.

Run: `npm run build`
Expected: clean TypeScript build.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 2: Manual smoke pass across themes**

`npm run dev`; in each of the 5 themes spot-check: dropdowns (no blur, animation, in-frame), compensation chart colors, dashboard grid (full last row, Upcoming Vests), net worth Y-axis, forecaster labels, debt payoff labels, spending calendar legend, investments plan/actual flow.

- [ ] **Step 3: Fix anything found, then final commit if needed**

```bash
git add -A src
git commit -m "chore: final verification fixes for UI polish round 2"
```
