# Wave 1 — UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five small UI defects: mobile bottom tab transparency, stray ⌘K button on mobile, dashboard grid empty space, calculator field misalignment, and the invisible Ontario-surtax component of the marginal tax rate.

**Architecture:** All changes are surgical edits to existing React components (Tailwind class changes, one deleted button, one new shared `SelectField` component) plus one new pure function in `canadaTax.ts` with unit tests. No new routes, stores, or dependencies.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, Zustand, Vitest + React Testing Library.

## Global Constraints

- Testing policy: **no TDD.** Implement, then run the named existing test files; update a test only if this plan says so or it fails because of your change. Do not add tests beyond the ones this plan specifies.
- The working tree already contains intentional uncommitted changes (desktop ⌘K button removed from `Layout.tsx`, `WIDGET_SPAN` in `Dashboard.tsx`, widget tweaks). **Do not revert them.** Task 3's Step 1 commits them as the baseline.
- Never modify persisted-store ids or keys (`DASHBOARD_WIDGET_IDS` values, planner tool ids) in this wave.
- Test command: `npx vitest run <path>` from the repo root. Full suite: `npx vitest run`.
- Windows environment; paths in commands use forward slashes (Git Bash) — adjust if using PowerShell.

---

### Task 1: Mobile bottom tab bar — solid background

**Files:**
- Modify: `src/components/Layout.tsx` (the mobile bottom nav, ~line 103)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks rely on.

- [ ] **Step 1: Make the bottom tab bar opaque**

In `src/components/Layout.tsx`, find the mobile bottom nav element (comment above it reads `{/* Mobile bottom tab bar */}`):

```tsx
className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-bg-secondary/90 backdrop-blur-[var(--card-blur)] flex"
```

Change `bg-bg-secondary/90` to `bg-bg-secondary` (remove only the `/90` opacity suffix; keep every other class, the `style` safe-area padding, and `aria-label="Primary"`):

```tsx
className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-bg-secondary backdrop-blur-[var(--card-blur)] flex"
```

- [ ] **Step 2: Verify nothing broke**

Run: `npx vitest run src/components`
Expected: all tests pass (no test asserts this class).

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "fix: solid background for mobile bottom tab bar"
```

---

### Task 2: Remove ⌘K button from the mobile top row

**Files:**
- Modify: `src/components/Layout.tsx` (mobile Backup/Theme row, ~lines 82–93)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. **Keep** the `useEffect` Ctrl/⌘+K key handler, the `paletteOpen` state, and the `<CommandPalette …/>` element — they still serve desktop.

- [ ] **Step 1: Delete the mobile ⌘K button**

In `src/components/Layout.tsx`, inside the `<div className="md:hidden flex items-center justify-center flex-wrap gap-3 mb-4">` block, delete exactly this button (the whole element):

```tsx
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-1.5 text-[12px] text-text-secondary border border-border rounded px-2.5 py-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            aria-label="Open command palette"
          >
            <kbd className="text-[10px] border border-border rounded px-1">⌘K</kbd>
          </button>
```

The row must end up containing only `<BackupControls />` and `<ThemeSelector />`.

- [ ] **Step 2: Verify TypeScript still compiles (setPaletteOpen is still used by the keydown handler)**

Run: `npx tsc --noEmit`
Expected: no errors. If TS reports `setPaletteOpen` unused, you deleted too much — the `useEffect` key handler at the top of the component must still call it.

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "fix: remove command palette button from mobile view"
```

---

### Task 3: Dashboard grid — equal-height rows

**Files:**
- Modify: `src/components/dashboard/BentoGrid.tsx`
- Modify: `src/components/dashboard/WidgetWrapper.tsx`
- Modify: `src/pages/Dashboard.tsx` (wrapper div className, ~line 112)
- Test (existing, verify only): `src/components/dashboard/BentoGrid.test.tsx`, `src/components/dashboard/WidgetWrapper.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `WidgetWrapper` root gains `h-full`; every page using `WidgetWrapper` inside a grid gets stretch-to-row behavior for free.

- [ ] **Step 1: Commit the existing in-flight baseline changes first**

The working tree already has intentional edits (desktop ⌘K removal, `WIDGET_SPAN`, `items-start` experiment, widget min-height tweaks). Commit them as-is so this task's diff is clean:

```bash
git add src/components/Layout.tsx src/pages/Dashboard.tsx src/components/dashboard/ src/components/budget/ src/components/planner/IncomeTaxEstimator.tsx src/components/planner/forecaster/ForecasterTool.tsx
git commit -m "chore: dashboard span map, widget sizing tweaks, desktop palette button removal (in-flight baseline)"
```

(If `git status` shows none of these files modified, the baseline was already committed — skip this step.)

- [ ] **Step 2: Remove `items-start` from BentoGrid**

In `src/components/dashboard/BentoGrid.tsx`, change:

```tsx
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-dense items-start gap-6 ${className}`}>
```

to (only `items-start` removed — **keep** `grid-flow-dense`):

```tsx
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-dense gap-6 ${className}`}>
```

Grid children now stretch to the tallest card in their row, which is what eliminates the holes below short cards.

- [ ] **Step 3: Make widget cards fill their grid cell**

In `src/components/dashboard/WidgetWrapper.tsx`, change the root div:

```tsx
    <div className={`themed-card rounded-lg p-4 flex flex-col ${className}`}>
```

to:

```tsx
    <div className={`themed-card rounded-lg p-4 flex flex-col h-full ${className}`}>
```

`h-full` is inert where the parent has auto height (Budgeting/Compensation pages), so this is safe globally.

In `src/pages/Dashboard.tsx`, the draggable wrapper div is the actual grid child, so it must also pass height down. Change:

```tsx
              className={`cursor-grab active:cursor-grabbing ${WIDGET_SPAN[id] ?? ''} ${dragId === id ? 'opacity-50' : ''}`}
```

to:

```tsx
              className={`h-full cursor-grab active:cursor-grabbing ${WIDGET_SPAN[id] ?? ''} ${dragId === id ? 'opacity-50' : ''}`}
```

- [ ] **Step 4: Run the dashboard component tests**

Run: `npx vitest run src/components/dashboard src/pages`
Expected: all pass. `BentoGrid.test.tsx` asserts `grid`, `grid-cols-1`, `gap-6` — all still present. If a test asserts `items-start`, delete that single assertion (it tested the failed experiment).

- [ ] **Step 5: Visual sanity check (only if a dev server / preview tool is available)**

Start the dev server (`npm run dev`) and confirm on the Dashboard: cards in the same row share the same height; no large blank areas below short cards. Skip if no browser is available — the class changes above are deterministic.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/BentoGrid.tsx src/components/dashboard/WidgetWrapper.tsx src/pages/Dashboard.tsx
git commit -m "fix: equal-height dashboard grid rows"
```

---

### Task 4: Shared SelectField + calculator input alignment

**Files:**
- Create: `src/components/planner/SelectField.tsx`
- Modify: `src/components/planner/IncomeTaxEstimator.tsx` (province select, ~lines 64–78)
- Modify: `src/components/planner/TakeHomePayCalculator.tsx` (province select, ~lines 26–40)
- Modify: `src/components/planner/DebtPayoffCalculator.tsx` (strategy select, ~lines 86–99)
- Modify: `src/components/planner/SavingsGoalCalculator.tsx` (solve-for select, ~lines 60–72)

**Interfaces:**
- Consumes: nothing.
- Produces: `SelectField` component — `interface SelectFieldProps { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }`. Wave 2's merged Salary & Tax tool reuses it, so the name and props must match exactly.

- [ ] **Step 1: Create SelectField mirroring CalculatorField's label markup**

Create `src/components/planner/SelectField.tsx` with exactly this content. The label line (`text-[13px] font-medium text-text-secondary block mb-1`) and control padding (`px-3 py-2`) intentionally copy `CalculatorField.tsx` so both field types align in the same grid row:

```tsx
import React from 'react'

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}

/** Dropdown twin of CalculatorField: identical label markup and control height
 *  so inputs and selects bottom-align in shared grid rows. */
export const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, children }) => {
  const selectId = `select-field-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={selectId} className="text-[13px] font-medium text-text-secondary block mb-1">
        {label}
      </label>
      <select
        id={selectId}
        className="w-full bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Use SelectField in IncomeTaxEstimator**

In `src/components/planner/IncomeTaxEstimator.tsx`:

Add the import next to the CalculatorField import:
```tsx
import { SelectField } from './SelectField'
```

Replace the input row — the whole block from `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">` through its closing `</div>` (currently containing the `CalculatorField` and the ad-hoc province `<label>`/`<select>`) — with:

```tsx
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <CalculatorField label="Taxable income" prefix="$" step={1000} value={income} onChange={(v) => setInput(TOOL_ID, 'income', v)} />
        <SelectField label="Province" value={province} onChange={(v) => setInput(TOOL_ID, 'province', v)}>
          {PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </SelectField>
      </div>
```

- [ ] **Step 3: Use SelectField in TakeHomePayCalculator**

In `src/components/planner/TakeHomePayCalculator.tsx`, same import, then replace its input-row block (`<div className="grid grid-cols-2 md:grid-cols-4 gap-4">` … `</div>`) with:

```tsx
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <CalculatorField label="Gross annual salary" prefix="$" step={1000} value={inputs.gross} onChange={(v) => setInput(TOOL_ID, 'gross', v)} />
        <SelectField label="Province" value={province} onChange={(v) => setInput(TOOL_ID, 'province', v)}>
          {PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </SelectField>
      </div>
```

(Yes, Wave 2 merges this file away; doing it here keeps Wave 1 shippable on its own and Wave 2 copies this exact markup.)

- [ ] **Step 4: Use SelectField in DebtPayoffCalculator**

In `src/components/planner/DebtPayoffCalculator.tsx`, add the import, then in the row `<div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">` replace the strategy `<label className="flex flex-col gap-1">…</label>` block with:

```tsx
        <SelectField label="Strategy" value={strategy} onChange={(v) => setInput(TOOL_ID, 'strategy', v)}>
          <option value="avalanche">Avalanche (highest APR first)</option>
          <option value="snowball">Snowball (smallest balance first)</option>
        </SelectField>
```

- [ ] **Step 5: Use SelectField in SavingsGoalCalculator**

In `src/components/planner/SavingsGoalCalculator.tsx`, add the import, then replace the solve-for block:

```tsx
      <label className="flex flex-col gap-1 max-w-xs">
        <span className="text-[13px] font-medium text-text-secondary">Solve for</span>
        <select
          className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
          value={solveFor}
          onChange={(e) => setInput(TOOL_ID, 'solveFor', e.target.value)}
        >
          <option value="monthly">Monthly contribution</option>
          <option value="months">Time to goal</option>
          <option value="rate">Required return</option>
          <option value="target">Final balance</option>
        </select>
      </label>
```

with:

```tsx
      <div className="max-w-xs">
        <SelectField label="Solve for" value={solveFor} onChange={(v) => setInput(TOOL_ID, 'solveFor', v)}>
          <option value="monthly">Monthly contribution</option>
          <option value="months">Time to goal</option>
          <option value="rate">Required return</option>
          <option value="target">Final balance</option>
        </SelectField>
      </div>
```

Also add `items-end` to its input row: change `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">` to `<div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">`.

- [ ] **Step 6: Run planner tests**

Run: `npx vitest run src/components/planner src/pages/Planner.test.tsx`
Expected: all pass. `SavingsGoalCalculator.test.tsx` may query the select by its label — `SelectField` keeps an explicit `<label htmlFor>`, so `getByLabelText('Solve for')` still works. If a test fails on markup structure (not behavior), update the query to `getByLabelText`.

- [ ] **Step 7: Commit**

```bash
git add src/components/planner/SelectField.tsx src/components/planner/IncomeTaxEstimator.tsx src/components/planner/TakeHomePayCalculator.tsx src/components/planner/DebtPayoffCalculator.tsx src/components/planner/SavingsGoalCalculator.tsx
git commit -m "fix: shared SelectField aligns selects with CalculatorField in calculator rows"
```

---

### Task 5: Marginal-rate breakdown (surtax made visible)

**Files:**
- Modify: `src/utils/finance/canadaTax.ts`
- Modify: `src/utils/finance/canadaTax.test.ts` (append tests)
- Modify: `src/components/planner/IncomeTaxEstimator.tsx`

**Interfaces:**
- Consumes: existing `federalTax`, `provincialTax`, `marginalRate` in `canadaTax.ts`.
- Produces: `export interface MarginalBreakdown { federal: number; provincialBase: number; surtax: number; total: number }` and `export function marginalRateBreakdown(income: number, province: Province): MarginalBreakdown` — Wave 2's merged tool renders this, so names must match exactly. All values are percentages (e.g. `29.29`), matching `marginalRate`'s unit.

- [ ] **Step 1: Split the Ontario surtax out of provincialTax**

In `src/utils/finance/canadaTax.ts`, replace the existing `provincialTax` function:

```ts
export function provincialTax(income: number, province: Province): number {
  const { brackets, bpa } = PROVINCIAL_TAX[province]
  const gross = bracketTax(income, brackets)
  const credit = bpa * brackets[0].rate
  let tax = Math.max(0, gross - credit)
  if (province === 'ON') {
    // Ontario surtax: 20% of ON tax over $5,818 plus 36% of ON tax over $7,446.
    tax += Math.max(0, tax - 5_818) * 0.2 + Math.max(0, tax - 7_446) * 0.36
  }
  return tax
}
```

with a parts helper plus a thin wrapper (behavior of `provincialTax` is unchanged):

```ts
/** Provincial tax split into the statutory bracket tax and the ON surtax.
 *  base + surtax === provincialTax(income, province). */
export function provincialTaxParts(
  income: number,
  province: Province,
): { base: number; surtax: number } {
  const { brackets, bpa } = PROVINCIAL_TAX[province]
  const gross = bracketTax(income, brackets)
  const credit = bpa * brackets[0].rate
  const base = Math.max(0, gross - credit)
  // Ontario surtax: 20% of ON tax over $5,818 plus 36% of ON tax over $7,446.
  const surtax =
    province === 'ON' ? Math.max(0, base - 5_818) * 0.2 + Math.max(0, base - 7_446) * 0.36 : 0
  return { base, surtax }
}

export function provincialTax(income: number, province: Province): number {
  const { base, surtax } = provincialTaxParts(income, province)
  return base + surtax
}
```

- [ ] **Step 2: Add marginalRateBreakdown**

In the same file, directly below the existing `marginalRate` function, add:

```ts
export interface MarginalBreakdown {
  federal: number // percentage points, e.g. 29.29
  provincialBase: number
  surtax: number
  total: number // === federal + provincialBase + surtax === marginalRate()
}

/** Decomposes the marginal rate into federal, provincial-bracket, and ON-surtax
 *  components via the same $100 finite difference marginalRate() uses, so the
 *  parts always sum to the headline number (including BPA phase-out effects). */
export function marginalRateBreakdown(income: number, province: Province): MarginalBreakdown {
  const delta = 100
  const fed = ((federalTax(income + delta, province) - federalTax(income, province)) / delta) * 100
  const p0 = provincialTaxParts(income, province)
  const p1 = provincialTaxParts(income + delta, province)
  const provincialBase = ((p1.base - p0.base) / delta) * 100
  const surtax = ((p1.surtax - p0.surtax) / delta) * 100
  return { federal: fed, provincialBase, surtax, total: fed + provincialBase + surtax }
}
```

- [ ] **Step 3: Append unit tests**

In `src/utils/finance/canadaTax.test.ts`, add these imports to the existing import from `./canadaTax` (`marginalRate`, `marginalRateBreakdown`, `provincialTax`, `provincialTaxParts` — keep whatever is already imported), then append this describe block at the end of the file:

```ts
describe('marginalRateBreakdown', () => {
  it('components sum to the headline marginal rate (ON, $200k)', () => {
    const b = marginalRateBreakdown(200_000, 'ON')
    expect(b.total).toBeCloseTo(marginalRate(200_000, 'ON'), 6)
    expect(b.federal + b.provincialBase + b.surtax).toBeCloseTo(b.total, 10)
  })

  it('shows a positive surtax component once ON tax exceeds both thresholds ($200k)', () => {
    const b = marginalRateBreakdown(200_000, 'ON')
    // marginal surtax = 56% of the 12.16% ON bracket rate ≈ 6.81
    expect(b.surtax).toBeGreaterThan(6)
    expect(b.surtax).toBeLessThan(7.5)
  })

  it('has no surtax component at low ON income ($60k)', () => {
    expect(marginalRateBreakdown(60_000, 'ON').surtax).toBe(0)
  })

  it('has no surtax component outside Ontario (BC, $200k)', () => {
    expect(marginalRateBreakdown(200_000, 'BC').surtax).toBe(0)
  })

  it('provincialTaxParts sums to provincialTax', () => {
    for (const income of [40_000, 90_000, 150_000, 250_000]) {
      const parts = provincialTaxParts(income, 'ON')
      expect(parts.base + parts.surtax).toBeCloseTo(provincialTax(income, 'ON'), 8)
    }
  })
})
```

- [ ] **Step 4: Run the tax tests**

Run: `npx vitest run src/utils/finance/canadaTax.test.ts`
Expected: all pass, including every pre-existing test (proves `provincialTax` behavior is unchanged).

- [ ] **Step 5: Render the breakdown in IncomeTaxEstimator**

In `src/components/planner/IncomeTaxEstimator.tsx`:

Add `marginalRateBreakdown` to the existing import from `'../../utils/finance/canadaTax'`.

Inside the component body, after `const income = inputs.income`, add:

```tsx
  const breakdown = marginalRateBreakdown(income, province)
```

Then, inside the `themed-card` block that holds the two `<BracketBar>`s, insert this between the second `<BracketBar …/>` and the existing `<p className="text-[12px] text-text-secondary">` caption:

```tsx
        <div className="flex flex-col gap-1">
          <span className="text-[12px] uppercase tracking-wide text-text-secondary">Marginal rate breakdown</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-primary">
            <span>Federal {breakdown.federal.toFixed(2)}%</span>
            <span>+ Provincial {breakdown.provincialBase.toFixed(2)}%</span>
            {breakdown.surtax > 0 && <span>+ ON surtax {breakdown.surtax.toFixed(2)}%</span>}
            <span className="font-semibold">= {breakdown.total.toFixed(2)}%</span>
          </div>
        </div>
```

Finally, replace the caption text so it matches what is now shown:

```tsx
        <p className="text-[12px] text-text-secondary">
          Filled portion = income inside each bracket. The breakdown above shows why the marginal
          rate can exceed the bracket rates — Ontario's surtax adds to every extra dollar's tax.
        </p>
```

- [ ] **Step 6: Run planner + finance tests**

Run: `npx vitest run src/utils/finance src/components/planner src/pages/Planner.test.tsx`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/finance/canadaTax.ts src/utils/finance/canadaTax.test.ts src/components/planner/IncomeTaxEstimator.tsx
git commit -m "feat: surface ON surtax in a marginal-rate breakdown"
```

---

### Task 6: Full-suite verification

**Files:** none new.

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: all pass. If anything unrelated fails, report it — do not fix unrelated failures in this wave.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.
