# UI Polish + Forecaster Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native confirm popups with a themed dialog, annotate the gross-only monthly comp chart, fix budgeting paradigm text/banner layout, redesign the forecaster's Comp Events / Debt Drag controls behind a gear popover, fix the real-mode scenario band bug, add a chart legend, and backfill the 0.7.0-beta changelog.

**Architecture:** One new reusable `ConfirmDialog` built on the existing `Sheet` primitive; all other changes are local edits to existing components plus two new fields on `ForecastPoint`. No store shape changes, no new dependencies.

**Tech Stack:** React 18 + TypeScript, Zustand, Recharts, Tailwind (theme CSS vars), Vitest + Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-17-ui-polish-forecaster-fixes-design.md`
- No em dashes in any user-facing copy or docs (user rule).
- Run tests from repo root `C:\Users\misha\ledger` with `npx vitest run <file>`; final full suite via `npx vitest run` must pass (458+ tests). Ignore `.claude/worktrees` if present.
- Theme via existing Tailwind classes/CSS vars (`text-text-primary`, `border-border`, `bg-error`, `var(--color-accent)` etc.). No hardcoded colors.
- Other sessions may commit to this checkout: always `git add` explicit paths, never `git add -A`.

---

### Task 1: ConfirmDialog component

**Files:**
- Create: `src/components/ui/ConfirmDialog.tsx`
- Test: `src/components/ui/ConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: `Sheet` from `src/components/ui/Sheet.tsx` (props: `open`, `onClose`, `desktop`, `ariaLabel`, `panelClassName`).
- Produces: `ConfirmDialog` React component with props `{ open: boolean; title: string; message: React.ReactNode; confirmLabel: string; cancelLabel?: string; tone?: 'accent' | 'danger'; onConfirm: () => void; onCancel: () => void }`. Tasks 2 and 3 import it as `import { ConfirmDialog } from '../ui/ConfirmDialog'` (adjust relative depth).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/ConfirmDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  const setup = (tone: 'accent' | 'danger' = 'accent') => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Clear data?"
        message="This cannot be undone."
        confirmLabel="Clear"
        tone={tone}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    return { onConfirm, onCancel }
  }

  it('renders title, message and both buttons', () => {
    setup()
    expect(screen.getByText('Clear data?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('fires onConfirm and onCancel from their buttons', () => {
    const { onConfirm, onCancel } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('danger tone styles the confirm button with bg-error', () => {
    setup('danger')
    expect(screen.getByRole('button', { name: 'Clear' }).className).toContain('bg-error')
  })

  it('accent tone does not use bg-error', () => {
    setup('accent')
    expect(screen.getByRole('button', { name: 'Clear' }).className).not.toContain('bg-error')
  })

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog open={false} title="T" message="M" confirmLabel="Go" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByText('T')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/ConfirmDialog.test.tsx`
Expected: FAIL, cannot resolve `./ConfirmDialog`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/ConfirmDialog.tsx`:

```tsx
import React from 'react'
import { Sheet } from './Sheet'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'accent' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

/** Themed replacement for window.confirm. Escape / scrim click cancel via Sheet. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'accent',
  onConfirm,
  onCancel,
}) => (
  <Sheet
    open={open}
    onClose={onCancel}
    desktop="modal"
    ariaLabel={title}
    panelClassName="themed-menu rounded-lg w-full max-w-sm p-5 flex flex-col gap-3"
  >
    <h2 className="text-[16px] font-semibold text-text-primary">{title}</h2>
    <div className="text-[13px] text-text-secondary">{message}</div>
    <div className="flex justify-end gap-2 mt-1">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-text-primary transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-opacity hover:opacity-90 ${
          tone === 'danger'
            ? 'bg-error text-[var(--color-bg-primary)]'
            : 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  </Sheet>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/ConfirmDialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx src/components/ui/ConfirmDialog.test.tsx
git commit -m "feat(ui): themed ConfirmDialog built on Sheet"
```

---

### Task 2: CompHeroWidget uses ConfirmDialog for the Salary & Tax income prompt

**Files:**
- Modify: `src/components/compensation/CompHeroWidget.tsx` (function `openSalaryTax`, lines ~74-88, plus JSX)
- Test: `src/components/compensation/CompHeroWidget.test.tsx` (describe block `CompHeroWidget salary-tax deep link`, lines ~72-101)

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 1 (`import { ConfirmDialog } from '../ui/ConfirmDialog'`).
- Produces: no exports change. Behavior contract: confirm ("Replace") writes income then navigates; cancel ("Keep Saved") navigates without writing (matches old window.confirm behavior).

- [ ] **Step 1: Update the tests to expect the dialog**

In `src/components/compensation/CompHeroWidget.test.tsx`, replace the two `window.confirm` spy tests inside `describe('CompHeroWidget salary-tax deep link', ...)` with:

```tsx
    it('asks before overwriting a different saved income and respects Keep Saved', () => {
      usePlannerStore.setState({ inputs: { 'salary-tax': { income: 55_000, province: 'BC' } } })
      renderWidget()
      fireEvent.click(screen.getByRole('button', { name: 'After-Tax' }))
      fireEvent.click(screen.getByRole('button', { name: /full breakdown in salary & tax/i }))
      expect(screen.getByText('Replace saved income?')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Keep Saved' }))
      expect(usePlannerStore.getState().inputs['salary-tax']?.income).toBe(55_000) // untouched
      expect(usePlannerStore.getState().inputs['salary-tax']?.province).toBe('BC') // never touched
    })

    it('overwrites on Replace', () => {
      usePlannerStore.setState({ inputs: { 'salary-tax': { income: 55_000 } } })
      renderWidget()
      fireEvent.click(screen.getByRole('button', { name: 'After-Tax' }))
      fireEvent.click(screen.getByRole('button', { name: /full breakdown in salary & tax/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
      expect(usePlannerStore.getState().inputs['salary-tax']?.income).toBe(100_000)
    })
```

Remove the now-unused `vi.spyOn(window, 'confirm')` lines. Keep the first test (`writes income and navigates without confirm when no saved income`) unchanged.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: FAIL, `Replace saved income?` not found.

- [ ] **Step 3: Implement**

In `src/components/compensation/CompHeroWidget.tsx`:

Add import:

```tsx
import { ConfirmDialog } from '../ui/ConfirmDialog'
```

Add a currency helper and state near the top of the component (after `const [view, setView] = useState...`):

```tsx
  const [replacePrompt, setReplacePrompt] = useState<{ saved: number; total: number } | null>(null)
  const fmtCad = (n: number) =>
    n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
```

Replace the whole `openSalaryTax` function with:

```tsx
  const openSalaryTax = () => {
    const { inputs, setInput } = usePlannerStore.getState()
    const saved = inputs['salary-tax']?.income
    const total = Math.round(totalComp)
    if (typeof saved === 'number' && Math.round(saved) !== total) {
      setReplacePrompt({ saved, total })
      return
    }
    setInput('salary-tax', 'income', total)
    navigate('/planner/salary-tax')
  }

  const finishSalaryTax = (replace: boolean) => {
    if (replace && replacePrompt) {
      usePlannerStore.getState().setInput('salary-tax', 'income', replacePrompt.total)
    }
    setReplacePrompt(null)
    navigate('/planner/salary-tax')
  }
```

At the bottom of the main return JSX (just before the final closing `</div>`), add:

```tsx
      <ConfirmDialog
        open={replacePrompt !== null}
        title="Replace saved income?"
        message={
          replacePrompt
            ? `Salary & Tax currently uses ${fmtCad(replacePrompt.saved)}. Replace it with your total compensation of ${fmtCad(replacePrompt.total)}?`
            : ''
        }
        confirmLabel="Replace"
        cancelLabel="Keep Saved"
        onConfirm={() => finishSalaryTax(true)}
        onCancel={() => finishSalaryTax(false)}
      />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compensation/CompHeroWidget.tsx src/components/compensation/CompHeroWidget.test.tsx
git commit -m "feat(comp): themed confirm for Salary & Tax income replace"
```

---

### Task 3: Destructive confirms in Budgeting and Wheel use ConfirmDialog

**Files:**
- Modify: `src/components/budget/TransactionListWidget.tsx` (clear-all button, lines ~58-70)
- Modify: `src/components/investments/wheel/WheelView.tsx` (`handleClear`, lines ~52-57)

**Interfaces:**
- Consumes: `ConfirmDialog` from Task 1. Import paths: `'../ui/ConfirmDialog'` (budget), `'../../ui/ConfirmDialog'` (wheel).
- Produces: nothing consumed later. Both dialogs use `tone="danger"`.

No new test files: the dialog itself is covered by Task 1; these are wiring changes verified by the full suite (existing tests for these components must stay green) and manual QA.

- [ ] **Step 1: TransactionListWidget**

Add import and state:

```tsx
import { ConfirmDialog } from '../ui/ConfirmDialog';
```

Inside the component, next to the other `useState` calls:

```tsx
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
```

Replace the clear-all button's `onClick` (currently the `window.confirm` block):

```tsx
              onClick={() => setConfirmClearOpen(true)}
```

Just before the component's final closing tag of the outer `<div className={wrapperClass}>`, add:

```tsx
      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear all transactions?"
        message="Every transaction will be deleted. This cannot be undone."
        confirmLabel="Clear All"
        tone="danger"
        onConfirm={() => {
          clearAllTransactions();
          setConfirmClearOpen(false);
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
```

- [ ] **Step 2: WheelView**

Add import:

```tsx
import { ConfirmDialog } from '../../ui/ConfirmDialog'
```

Add state next to the other `useState` calls:

```tsx
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
```

Replace `handleClear` with:

```tsx
  const handleClear = () => setConfirmClearOpen(true)
```

Inside the main (non-empty-state) return JSX, before its final closing tag, add:

```tsx
      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear wheel data?"
        message="All wheel tracker data will be deleted. This cannot be undone."
        confirmLabel="Clear Data"
        tone="danger"
        onConfirm={() => {
          clearAll()
          setSelectedTicker(null)
          setConfirmClearOpen(false)
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
```

- [ ] **Step 3: Verify no regressions and no remaining native confirms**

Run: `npx vitest run src/components/budget src/components/investments`
Expected: PASS.

Run: `grep -rn "window.confirm\|[^.]confirm(" src/ --include=*.tsx --include=*.ts` (or `rg "confirm\(" src`)
Expected: only `ConfirmDialog` matches; no `window.confirm` or bare `confirm(` calls remain in components.

- [ ] **Step 4: Commit**

```bash
git add src/components/budget/TransactionListWidget.tsx src/components/investments/wheel/WheelView.tsx
git commit -m "feat(ui): destructive clear actions use themed ConfirmDialog"
```

---

### Task 4: Monthly Cash Flow gross-only note

**Files:**
- Modify: `src/components/compensation/CompHeroWidget.tsx` (chart container JSX, lines ~213-269)
- Test: `src/components/compensation/CompHeroWidget.test.tsx`

**Interfaces:** none new. Copy is fixed by spec (no em dashes):

> Monthly bars are shown gross. Withholding varies too much month to month to estimate honestly; after-tax figures below are annual estimates.

- [ ] **Step 1: Write the failing test**

Append to the `describe('CompHeroWidget after-tax toggle', ...)` block:

```tsx
  it('shows a gross-only note in monthly view when After-Tax is on', () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'After-Tax' }))
    fireEvent.click(screen.getByRole('button', { name: 'Monthly Cash Flow View' }))
    expect(screen.getByText(/monthly bars are shown gross/i)).toBeInTheDocument()
    // switching back to gross hides it
    fireEvent.click(screen.getByRole('button', { name: 'Gross' }))
    expect(screen.queryByText(/monthly bars are shown gross/i)).toBeNull()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: FAIL on the new test.

- [ ] **Step 3: Implement**

In `CompHeroWidget.tsx`, directly after the closing tag of `<div className="relative w-full h-[400px]">...</div>` (the chart container), add:

```tsx
      {view === 'monthly' && showAfterTax && (
        <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
          Monthly bars are shown gross. Withholding varies too much month to month to estimate
          honestly; after-tax figures below are annual estimates.
        </p>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/compensation/CompHeroWidget.tsx src/components/compensation/CompHeroWidget.test.tsx
git commit -m "feat(comp): note that monthly cash flow bars stay gross under After-Tax"
```

---

### Task 5: Budgeting paradigm description one line + ParadigmBanner full-width bar

**Files:**
- Modify: `src/components/budget/CategoryManagerWidget.tsx` (`PARADIGM_DESCRIPTIONS` line 13, description `<p>` lines ~123-125)
- Modify: `src/components/budget/ParadigmBanner.tsx` (Banner layout + 50/30/20 branch)
- Test: `src/components/budget/ParadigmBanner.test.tsx`, `src/components/budget/CategoryManagerWidget.test.tsx`

**Interfaces:**
- `PARADIGM_DESCRIPTIONS` is exported and used elsewhere; only the 50/30/20 string changes.
- `Banner` (internal) gains an optional `footer?: React.ReactNode` rendered full-width below the icon row.

- [ ] **Step 1: Write the failing tests**

In `ParadigmBanner.test.tsx`, add:

```tsx
  it('50/30/20: renders the ratio bar as a full-width sibling of the icon row', () => {
    seed('50/30/20', 1000)
    const { container } = render(<ParadigmBanner selectedMonth="2026-07" />)
    const bar = container.querySelector('[data-testid="ratio-bar"]') as HTMLElement
    expect(bar).not.toBeNull()
    // the bar must not be nested inside the icon+text flex row
    expect(bar.parentElement?.className).not.toContain('items-start')
  })

  it('50/30/20: bar track renders even when all buckets are 0%', () => {
    seed('50/30/20', 0) // no income: pcts all 0
    const { container } = render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(container.querySelector('[data-testid="ratio-bar"]')).not.toBeNull()
  })
```

In `CategoryManagerWidget.test.tsx`, add (inside the existing top-level describe; check the file's existing render/seed helpers and reuse them if present, otherwise a pure data test):

```tsx
  it('50/30/20 description is short enough for one line', () => {
    expect(PARADIGM_DESCRIPTIONS['50/30/20'].length).toBeLessThanOrEqual(70)
  })
```

Import `PARADIGM_DESCRIPTIONS` at the top of the test file if not already imported:

```tsx
import { PARADIGM_DESCRIPTIONS } from './CategoryManagerWidget'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/budget/ParadigmBanner.test.tsx src/components/budget/CategoryManagerWidget.test.tsx`
Expected: new tests FAIL (`ratio-bar` missing; 50/30/20 string is 89 chars).

- [ ] **Step 3: Implement ParadigmBanner restructure**

Replace the `Banner` component in `ParadigmBanner.tsx` with:

```tsx
const Banner: React.FC<{ tone: 'info' | 'warn'; children: React.ReactNode; footer?: React.ReactNode }> = ({
  tone,
  children,
  footer,
}) => (
  <div
    className={`rounded-lg border px-4 py-3 text-[13px] ${
      tone === 'warn'
        ? 'border-error/50 bg-error/10 text-text-primary'
        : 'border-border bg-bg-secondary text-text-primary'
    }`}
  >
    <div className="flex items-start gap-2">
      {tone === 'warn' ? (
        <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
      ) : (
        <Info size={16} className="text-text-secondary shrink-0 mt-0.5" />
      )}
      <div className="flex flex-col gap-2 min-w-0 flex-1">{children}</div>
    </div>
    {footer && <div className="mt-2">{footer}</div>}
  </div>
);
```

Then change the 50/30/20 return so the bar moves into `footer` (full banner width) and gets a testid:

```tsx
  return (
    <Banner
      tone="info"
      footer={
        <div data-testid="ratio-bar" className="flex w-full h-2 rounded overflow-hidden bg-bg-primary/50">
          {buckets.map((b) => (
            <div key={b.label} className={b.color} style={{ width: `${Math.min(b.pct, 100)}%` }} />
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {buckets.map((b) => (
          <span key={b.label} className={b.pct > b.target ? 'text-error' : ''}>
            {b.label} {Math.round(b.pct)}%
            <span className="text-text-secondary"> / {b.target}% target</span>
          </span>
        ))}
      </div>
      {f.hasUnclassified && (
        <span className="text-[12px] text-text-secondary">
          Some expense groups have no class yet. Set Need / Want / Savings chips in Budget Setup for
          accurate buckets (unclassified counts as Needs).
        </span>
      )}
    </Banner>
  );
```

- [ ] **Step 4: Implement the one-line description**

In `CategoryManagerWidget.tsx` line 13, change the 50/30/20 entry to:

```tsx
  '50/30/20': 'Spend ~50% of income on needs, 30% on wants, 20% toward savings.',
```

And widen the description paragraph (lines ~123-125):

```tsx
            <p className="text-[12px] text-text-secondary max-w-[520px] text-right">
              {PARADIGM_DESCRIPTIONS[paradigm]}
            </p>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/budget/ParadigmBanner.test.tsx src/components/budget/CategoryManagerWidget.test.tsx`
Expected: PASS (all, including pre-existing).

- [ ] **Step 6: Commit**

```bash
git add src/components/budget/ParadigmBanner.tsx src/components/budget/ParadigmBanner.test.tsx src/components/budget/CategoryManagerWidget.tsx src/components/budget/CategoryManagerWidget.test.tsx
git commit -m "fix(budget): one-line paradigm descriptions, full-width 50/30/20 ratio bar"
```

---

### Task 6: forecast.ts real-mode scenario bands

**Files:**
- Modify: `src/utils/finance/forecast.ts`
- Test: `src/utils/finance/forecast.test.ts`

**Interfaces:**
- Produces: `ForecastPoint` gains `conservativeReal: number` and `optimisticReal: number` (nominal value divided by the same inflation deflator used for `real`). Task 7 consumes these.

- [ ] **Step 1: Write the failing test**

Append to `forecast.test.ts`:

```ts
describe('real scenario bands', () => {
  it('deflates conservative and optimistic by the same deflator as real', () => {
    const points = buildForecast({
      startBalance: 100000,
      monthlySavings: 1000,
      annualReturnPct: 7,
      annualInflationPct: 2.5,
      contributionStepUpPct: 0,
      years: 2,
      scenarioSpreadPct: 2,
    })
    const p = points[24]
    const deflator = Math.pow(1.025, 24 / 12)
    expect(p.conservativeReal).toBeCloseTo(p.conservative / deflator, 6)
    expect(p.optimisticReal).toBeCloseTo(p.optimistic / deflator, 6)
    // the real projected value must sit inside its real band
    expect(p.real).toBeGreaterThan(p.conservativeReal)
    expect(p.real).toBeLessThan(p.optimisticReal)
  })

  it('month 0 real bands equal the start balance', () => {
    const points = buildForecast({
      startBalance: 50000,
      monthlySavings: 0,
      annualReturnPct: 5,
      annualInflationPct: 2,
      contributionStepUpPct: 0,
      years: 1,
    })
    expect(points[0].conservativeReal).toBe(50000)
    expect(points[0].optimisticReal).toBe(50000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/finance/forecast.test.ts`
Expected: FAIL, `conservativeReal` undefined.

- [ ] **Step 3: Implement**

In `forecast.ts`, add to the `ForecastPoint` interface:

```ts
  conservativeReal: number
  optimisticReal: number
```

Add to the month-0 seed object:

```ts
    conservativeReal: config.startBalance,
    optimisticReal: config.startBalance,
```

Add to the per-month `points.push({...})` (the `deflator` const already exists right above):

```ts
      conservativeReal: balCons / deflator,
      optimisticReal: balOpt / deflator,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/finance/forecast.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/finance/forecast.ts src/utils/finance/forecast.test.ts
git commit -m "fix(forecast): add inflation-deflated conservative/optimistic band values"
```

---

### Task 7: ForecastChart real bands + legend

**Files:**
- Modify: `src/components/planner/forecaster/ForecastChart.tsx`
- Test: Create `src/components/planner/forecaster/ForecastChart.test.tsx`

**Interfaces:**
- Consumes: `conservativeReal` / `optimisticReal` from Task 6.
- Produces: no API change; `ForecastChart` props unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/components/planner/forecaster/ForecastChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ForecastChart } from './ForecastChart'
import { buildForecast } from '../../../utils/finance/forecast'

const points = buildForecast({
  startBalance: 100000,
  monthlySavings: 1000,
  annualReturnPct: 7,
  annualInflationPct: 2.5,
  contributionStepUpPct: 0,
  years: 2,
  scenarioSpreadPct: 2,
})

describe('ForecastChart legend', () => {
  it('line view legend names projected, band and actual', () => {
    render(<ForecastChart points={points} history={[]} showReal={false} view="line" goalMarkers={[]} />)
    expect(screen.getByText('Projected')).toBeInTheDocument()
    expect(screen.getByText(/Conservative to Optimistic/i)).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
  })

  it('stacked view legend names contributed and growth', () => {
    render(<ForecastChart points={points} history={[]} showReal={false} view="stacked" goalMarkers={[]} />)
    expect(screen.getByText('Contributed')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
  })

  it('real mode legend labels the projected line as real', () => {
    render(<ForecastChart points={points} history={[]} showReal view="line" goalMarkers={[]} />)
    expect(screen.getByText('Projected (real)')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/forecaster/ForecastChart.test.tsx`
Expected: FAIL, legend texts not found (recharts series names do not render as DOM text in jsdom).

- [ ] **Step 3: Implement**

In `ForecastChart.tsx`:

1. Use real band values in the `future` mapping (replace the `conservative` / `optimistic` lines):

```tsx
        conservative: Math.round(showReal ? p.conservativeReal : p.conservative),
        optimistic: Math.round(showReal ? p.optimisticReal : p.optimistic),
```

2. Add a legend row and make the card a column so the chart keeps its height. Replace the outer return wrapper:

```tsx
  const projectedLabel = showReal ? 'Projected (real)' : 'Projected'

  return (
    <div className="themed-card rounded-lg p-4 h-[380px] flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-[11px] text-text-secondary">
        {view === 'line' ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: 'var(--accent)' }} />
              {projectedLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'var(--accent)', opacity: 0.25 }} />
              Conservative to Optimistic band
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'var(--text-secondary)', opacity: 0.4 }} />
              Contributed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'var(--accent)', opacity: 0.5 }} />
              Growth
            </span>
          </>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: 'var(--text-primary)' }} />
          Actual
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {/* existing ComposedChart unchanged */}
        </ResponsiveContainer>
      </div>
    </div>
  )
```

Keep the existing `<ComposedChart>...</ComposedChart>` exactly as is inside the new `flex-1` wrapper, except the projected `Line` name can now reuse `projectedLabel`:

```tsx
              <Line type="monotone" dataKey="projected" stroke="var(--accent)" strokeWidth={2} dot={false} name={projectedLabel} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/planner/forecaster/ForecastChart.test.tsx src/utils/finance/forecast.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/forecaster/ForecastChart.tsx src/components/planner/forecaster/ForecastChart.test.tsx
git commit -m "fix(forecaster): deflate scenario bands in real mode, add chart legend"
```

---

### Task 8: ForecasterTool Comp Events / Debt Drag gear popover (mockup Option B)

**Files:**
- Modify: `src/components/planner/forecaster/ForecasterTool.tsx` (lines ~103-151 and imports)
- Test: `src/components/planner/forecaster/ForecasterTool.test.tsx` (describe `ForecasterTool comp tax controls`)

**Interfaces:**
- Consumes: `Sheet` (`desktop="popover"`, `anchorRef`) from `'../../ui/Sheet'`; existing settings keys `compTaxEnabled`, `compTaxAuto`, `compTaxManualPct` (unchanged).
- Produces: gear button with `aria-label="Comp event tax settings"`; popover contains the three tax controls and the caption.

- [ ] **Step 1: Update the test to expect the popover**

Replace `describe('ForecasterTool comp tax controls', ...)` in `ForecasterTool.test.tsx` with:

```tsx
describe('ForecasterTool comp tax controls', () => {
  it('hides tax controls behind the gear popover', () => {
    render(<MemoryRouter><ForecasterTool /></MemoryRouter>)
    // tax controls not in the main row anymore
    expect(screen.queryByText('After-Tax Comp Events')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Comp event tax settings' }))
    expect(screen.getByText('After-Tax Comp Events')).toBeTruthy()
    expect(screen.getByText(/Comp events taxed at your marginal rate/i)).toBeTruthy()
  })

  it('keeps the two primary pills in the row', () => {
    render(<MemoryRouter><ForecasterTool /></MemoryRouter>)
    expect(screen.getByText(/Comp Events (On|Off)/)).toBeTruthy()
    expect(screen.getByText(/Debt Drag/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/forecaster/ForecasterTool.test.tsx`
Expected: FAIL (gear button missing; tax toggle currently always visible).

- [ ] **Step 3: Implement**

In `ForecasterTool.tsx`:

Imports: change line 1 and add Sheet + icon:

```tsx
import React, { useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Sheet } from '../../ui/Sheet'
```

Inside `ForecasterTool`, add:

```tsx
  const gearRef = useRef<HTMLButtonElement>(null)
  const [taxOpen, setTaxOpen] = useState(false)
```

Replace the entire "Comp Events / Debt Drag" cell (the `<div className="flex flex-col gap-1">` spanning current lines ~103-151) with:

```tsx
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Comp Events / Debt Drag</span>
          <div className="flex gap-2 items-stretch">
            <button
              onClick={() => setSetting('autoComp', !settings.autoComp)}
              className={`flex-1 text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.autoComp ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              {settings.autoComp ? `${autoFeed.compLumps.length} Comp Events On` : 'Comp Events Off'}
            </button>
            <button
              onClick={() => setSetting('includeDebtDrag', !settings.includeDebtDrag)}
              className={`flex-1 text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.includeDebtDrag ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              {autoFeed.debtDrag ? `Debt Drag ${formatMoney(autoFeed.debtDrag.amount)}/mo` : 'Debt Drag Off'}
            </button>
            <button
              ref={gearRef}
              aria-label="Comp event tax settings"
              onClick={() => setTaxOpen(true)}
              className={`px-2 rounded-lg border transition-colors ${
                settings.compTaxEnabled ? 'border-accent text-accent' : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <Settings2 size={14} />
            </button>
          </div>
          <Sheet
            open={taxOpen}
            onClose={() => setTaxOpen(false)}
            desktop="popover"
            anchorRef={gearRef}
            ariaLabel="Comp event tax settings"
            panelClassName="themed-menu rounded-lg p-4 w-[280px] flex flex-col gap-2"
          >
            <button
              onClick={() => setSetting('compTaxEnabled', !settings.compTaxEnabled)}
              className={`text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.compTaxEnabled ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              {settings.compTaxEnabled ? 'After-Tax Comp Events' : 'Gross Comp Events'}
            </button>
            {settings.compTaxEnabled ? (
              <button
                onClick={() => setSetting('compTaxAuto', !settings.compTaxAuto)}
                className={`text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                  settings.compTaxAuto ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
                }`}
              >
                {settings.compTaxAuto ? `Marginal ${compTax.ratePct.toFixed(0)}% (${compTax.province})` : 'Manual Rate'}
              </button>
            ) : null}
            {settings.compTaxEnabled && !settings.compTaxAuto ? (
              <CalculatorField label="Manual Rate" suffix="%" step={1} value={settings.compTaxManualPct as number} onChange={(v) => setSetting('compTaxManualPct', v)} />
            ) : null}
            <p className="text-[11px] text-text-secondary">
              Comp events taxed at your marginal rate; RSU/ESPP treated as employment income.
            </p>
          </Sheet>
        </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/planner/forecaster/ForecasterTool.test.tsx`
Expected: PASS (all, including the pre-existing source-label and goal-date tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/forecaster/ForecasterTool.tsx src/components/planner/forecaster/ForecasterTool.test.tsx
git commit -m "feat(forecaster): comp tax controls move behind a gear popover"
```

---

### Task 9: Changelog backfill + full suite

**Files:**
- Modify: `CHANGELOG.md` (the `## [0.7.0-beta] - 2026-07-17` section)

- [ ] **Step 1: Add the missing forecaster entries**

In the `### Added` list of the `[0.7.0-beta]` section, append:

```markdown
- Net-Worth / FIRE Forecaster: goals and life events show their projected calendar date inside the list cards
- Forecaster comp events can be taxed: an After-Tax toggle applies your marginal rate (auto-detected with province, or a manual rate); RSU/ESPP treated as employment income
```

And add to the existing `### Fixed` list of the same section (it currently holds only the PWA icon entry):

```markdown
- Forecaster: stacked Contributions vs Growth view now respects Real (Today's Dollars) mode; the "today" label stays anchored to the today line; y-axis uses compact labels ($1.5M instead of $1,500,000)
- Forecaster: Monte Carlo footnote sits inside its card instead of overflowing it
```

- [ ] **Step 2: Verify the What's New modal parses it**

Run: `npx vitest run src/components/ui/WhatsNewModal.test.tsx src/utils/whatsNew.test.ts`
Expected: PASS.

- [ ] **Step 3: Full suite**

Run: `npx vitest run`
Expected: all tests pass (458 baseline plus the new ones). If any unrelated test fails, investigate before proceeding; do not skip.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: backfill 0.7.0-beta forecaster changelog entries"
```

---

## Manual QA checklist (after all tasks)

1. Compensation: After-Tax on, click "Full breakdown in Salary & Tax" with a different saved income; themed dialog appears (no browser popup), Replace overwrites, Keep Saved preserves.
2. Compensation: Monthly Cash Flow View + After-Tax shows the gross note.
3. Budgeting: all four paradigm descriptions fit one line; 50/30/20 banner bar spans full width; 0% state shows the empty track.
4. Budgeting: Clear All transactions shows danger dialog. Investments > Options: Clear wheel data shows danger dialog.
5. Forecaster: gear opens tax popover anchored to it; Escape and outside click close it; toggles persist.
6. Forecaster: Real (Today's Dollars) + Show Scenario Bands: projected line sits between the bands; legend labels visible in both views.
7. What's New modal shows the new 0.7.0-beta forecaster entries.
