# Forecaster Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four forecaster issues: goal/event dates inside their cards, Monte Carlo chart card overflow and clipped y-axis, configurable after-tax haircut on comp event lump sums, and Contributions vs Growth stacked view correctness (Real toggle, "today" label, y-axis).

**Architecture:** Pure-math changes live in `src/utils/finance` (forecast real-series fields, comp tax helpers). UI changes are confined to `src/components/planner/forecaster`. A shared compact money formatter lands in `src/components/planner/format.ts` and is used by both forecaster charts.

**Tech Stack:** React 19 + TypeScript, Recharts, Zustand (usePlannerStore persisted tool inputs), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-17-forecaster-fixes-design.md`

## Global Constraints

- No em dashes in any copy or comments (user rule).
- Run tests with `npx vitest run <path>` from repo root; never run the suite inside `.claude/worktrees`.
- Stacked view keeps two bands: Contributed (includes starting balance) + Growth. Do NOT restructure bands.
- Manual life events are never taxed; only auto-fed comp lumps are.
- Caveat copy, exact: `Comp events taxed at your marginal rate; RSU/ESPP treated as employment income.`
- Commit after each task with the message given in the task.

---

### Task 1: Compact money formatter

**Files:**
- Modify: `src/components/planner/format.ts`
- Test: `src/components/planner/format.test.ts` (create)

**Interfaces:**
- Produces: `formatMoneyCompact(n: number): string` exported from `src/components/planner/format.ts`. `$0`, `$950`, `$12k`, `$500k`, `$1.2M`, `$12M`, negative-safe (`-$1.2M`). Tasks 2 and 5 use it as a Recharts `tickFormatter`.

- [ ] **Step 1: Write the failing test**

Create `src/components/planner/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyCompact } from './format'

describe('formatMoneyCompact', () => {
  it('formats sub-thousand values as plain dollars', () => {
    expect(formatMoneyCompact(0)).toBe('$0')
    expect(formatMoneyCompact(950)).toBe('$950')
  })
  it('formats thousands with k', () => {
    expect(formatMoneyCompact(12_000)).toBe('$12k')
    expect(formatMoneyCompact(500_000)).toBe('$500k')
    expect(formatMoneyCompact(1_499)).toBe('$1k')
  })
  it('formats millions with one decimal under 10M, whole above', () => {
    expect(formatMoneyCompact(1_200_000)).toBe('$1.2M')
    expect(formatMoneyCompact(3_000_000)).toBe('$3M')
    expect(formatMoneyCompact(12_000_000)).toBe('$12M')
  })
  it('is negative-safe', () => {
    expect(formatMoneyCompact(-1_200_000)).toBe('-$1.2M')
    expect(formatMoneyCompact(-500)).toBe('-$500')
  })
})

describe('formatMoney (existing, unchanged)', () => {
  it('still formats full dollars', () => {
    expect(formatMoney(1234567)).toBe('$1,234,567')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/format.test.ts`
Expected: FAIL with `formatMoneyCompact` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `src/components/planner/format.ts`:

```ts
/** Compact axis labels: $950, $12k, $500k, $1.2M, $12M. */
export function formatMoneyCompact(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const num = m >= 10 ? String(Math.round(m)) : String(Math.round(m * 10) / 10)
    return `${sign}$${num}M`
  }
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}
```

Note `Math.round(m * 10) / 10` yields `3` (not `3.0`) for exact values, so `$3M` works without special-casing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/planner/format.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/format.ts src/components/planner/format.test.ts
git commit -m "feat(planner): compact money formatter for chart axes"
```

---

### Task 2: Monte Carlo card layout + y-axis

**Files:**
- Modify: `src/components/planner/forecaster/MonteCarloSection.tsx:54-72`
- Test: `src/components/planner/forecaster/MonteCarloSection.test.tsx` (create)

**Interfaces:**
- Consumes: `formatMoneyCompact` from `../format` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/components/planner/forecaster/MonteCarloSection.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonteCarloSection } from './MonteCarloSection'

const baseProps = {
  startBalance: 100000,
  monthlySavings: 2000,
  years: 10,
  meanReturnPct: 7,
  stdDevPct: 15,
  stepUpPct: 2,
  lumpSums: [],
  target: 1000000,
  onStdDevChange: () => {},
}

describe('MonteCarloSection layout', () => {
  it('keeps the footnote inside the auto-height card (no fixed card height)', () => {
    render(<MonteCarloSection {...baseProps} />)
    const note = screen.getByText(/500 seeded simulations/i)
    const card = note.closest('.themed-card') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.className).not.toMatch(/h-\[300px\]/)
    const chartWrapper = card.querySelector('.h-\\[300px\\]')
    expect(chartWrapper).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/forecaster/MonteCarloSection.test.tsx`
Expected: FAIL on `card.className` containing `h-[300px]` (card currently has the fixed height and the chart has no wrapper).

- [ ] **Step 3: Implement the layout fix**

In `MonteCarloSection.tsx`, replace the card block (currently lines 54-72):

```tsx
      <div className="themed-card rounded-lg p-4">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
              <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis width={72} tickFormatter={(v: number) => formatMoneyCompact(v)} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [formatMoney(Number(value)), String(name) === 'w1090' ? 'P10–P90 width' : String(name).toUpperCase()]}
                {...chartTooltipStyles}
              />
              <Area type="monotone" dataKey="p10" stackId="fan" stroke="none" fill="transparent" name="p10" />
              <Area type="monotone" dataKey="w1090" stackId="fan" stroke="none" fill="var(--accent)" fillOpacity={0.18} name="w1090" />
              <Line type="monotone" dataKey="p50" stroke="var(--accent)" strokeWidth={2} dot={false} name="p50" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[12px] text-text-secondary mt-2">
          500 seeded simulations. Shaded band spans the 10th to 90th percentile.
        </p>
      </div>
```

Two changes only: the card div loses `h-[300px]` (moves to an inner wrapper around the ResponsiveContainer), and the YAxis `tickFormatter` switches from `formatMoney` to `formatMoneyCompact`. Update the import at the top:

```ts
import { formatMoney, formatMoneyCompact } from '../format'
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/planner/forecaster/MonteCarloSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/forecaster/MonteCarloSection.tsx src/components/planner/forecaster/MonteCarloSection.test.tsx
git commit -m "fix(forecaster): Monte Carlo footnote inside card, compact y-axis labels"
```

---

### Task 3: Real-mode contributed/growth series in buildForecast

**Files:**
- Modify: `src/utils/finance/forecast.ts`
- Test: `src/utils/finance/forecast.test.ts` (append)

**Interfaces:**
- Produces: `ForecastPoint` gains `contributedReal: number` and `growthReal: number` (nominal values divided by the same inflation deflator as `real`; `growthReal` may be negative, no clamping here). Task 5 plots these when the Real toggle is on.

- [ ] **Step 1: Write the failing test**

Append to `src/utils/finance/forecast.test.ts`:

```ts
describe('real contributed/growth series', () => {
  it('deflates contributed and growth by the same deflator as real', () => {
    const points = buildForecast({
      startBalance: 100000,
      monthlySavings: 1000,
      annualReturnPct: 7,
      annualInflationPct: 3,
      contributionStepUpPct: 0,
      years: 2,
    })
    const p = points[24]
    const deflator = Math.pow(1.03, 24 / 12)
    expect(p.contributedReal).toBeCloseTo(p.contributed / deflator, 6)
    expect(p.growthReal).toBeCloseTo(p.growth / deflator, 6)
    // stack identity holds in real terms too
    expect(p.contributedReal + p.growthReal).toBeCloseTo(p.real, 6)
  })

  it('month 0 has contributedReal = startBalance and growthReal = 0', () => {
    const points = buildForecast({
      startBalance: 50000,
      monthlySavings: 0,
      annualReturnPct: 5,
      annualInflationPct: 2,
      contributionStepUpPct: 0,
      years: 1,
    })
    expect(points[0].contributedReal).toBe(50000)
    expect(points[0].growthReal).toBe(0)
  })
})
```

Match the existing import style at the top of the test file (it already imports `buildForecast`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/finance/forecast.test.ts`
Expected: FAIL, `contributedReal` is `undefined`.

- [ ] **Step 3: Implement**

In `forecast.ts`, extend the interface:

```ts
export interface ForecastPoint {
  month: number
  base: number
  conservative: number
  optimistic: number
  real: number
  contributed: number
  growth: number
  contributedReal: number
  growthReal: number
}
```

Month-0 seed point gains `contributedReal: config.startBalance, growthReal: 0`. In the loop, the pushed point becomes:

```ts
    const deflator = Math.pow(1 + config.annualInflationPct / 100, m / 12)
    points.push({
      month: m,
      base: balBase,
      conservative: balCons,
      optimistic: balOpt,
      real: balBase / deflator,
      contributed,
      growth: balBase - contributed,
      contributedReal: contributed / deflator,
      growthReal: (balBase - contributed) / deflator,
    })
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/utils/finance/forecast.test.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/utils/finance/forecast.ts src/utils/finance/forecast.test.ts
git commit -m "feat(forecast): expose inflation-deflated contributed and growth series"
```

---

### Task 4: Comp tax helpers (applyLumpTax, resolveCompTaxRate)

**Files:**
- Create: `src/utils/finance/compTax.ts`
- Test: `src/utils/finance/compTax.test.ts` (create)

**Interfaces:**
- Consumes: `marginalRate(income, province)` and `type Province` from `./canadaTax`; `type LumpSum` from `./forecast`.
- Produces (Task 6 consumes both):
  - `applyLumpTax(lumps: LumpSum[], rate: number): LumpSum[]` where `rate` is a fraction 0..1; returns new lumps with `amount * (1 - rate)`, labels preserved; `rate <= 0` returns input unchanged.
  - `resolveCompTaxRate(cfg: { enabled: boolean; auto: boolean; manualPct: number; income: number; province: Province }): number` returning a fraction 0..1 (0 when disabled; `marginalRate(income, province) / 100` when auto; clamped `manualPct / 100` otherwise).

- [ ] **Step 1: Write the failing test**

Create `src/utils/finance/compTax.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyLumpTax, resolveCompTaxRate } from './compTax'
import { marginalRate } from './canadaTax'

describe('applyLumpTax', () => {
  const lumps = [
    { month: 3, amount: 10000, label: 'RSU X' },
    { month: 12, amount: 5000, label: 'Bonus' },
  ]
  it('applies the haircut and preserves labels/months', () => {
    const taxed = applyLumpTax(lumps, 0.5)
    expect(taxed).toEqual([
      { month: 3, amount: 5000, label: 'RSU X' },
      { month: 12, amount: 2500, label: 'Bonus' },
    ])
  })
  it('returns lumps unchanged for rate <= 0', () => {
    expect(applyLumpTax(lumps, 0)).toEqual(lumps)
    expect(applyLumpTax(lumps, -1)).toEqual(lumps)
  })
  it('clamps rate above 1', () => {
    expect(applyLumpTax(lumps, 1.5)[0].amount).toBe(0)
  })
})

describe('resolveCompTaxRate', () => {
  it('returns 0 when disabled', () => {
    expect(resolveCompTaxRate({ enabled: false, auto: true, manualPct: 50, income: 100000, province: 'ON' })).toBe(0)
  })
  it('uses marginal rate when auto', () => {
    const expected = marginalRate(100000, 'ON') / 100
    expect(resolveCompTaxRate({ enabled: true, auto: true, manualPct: 50, income: 100000, province: 'ON' })).toBeCloseTo(expected, 10)
  })
  it('uses clamped manual percent otherwise', () => {
    expect(resolveCompTaxRate({ enabled: true, auto: false, manualPct: 50, income: 0, province: 'ON' })).toBe(0.5)
    expect(resolveCompTaxRate({ enabled: true, auto: false, manualPct: 150, income: 0, province: 'ON' })).toBe(1)
    expect(resolveCompTaxRate({ enabled: true, auto: false, manualPct: -10, income: 0, province: 'ON' })).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/finance/compTax.test.ts`
Expected: FAIL, module `./compTax` not found.

- [ ] **Step 3: Implement**

Create `src/utils/finance/compTax.ts`:

```ts
// Tax haircut for auto-fed comp event lump sums (RSU, bonus, ESPP). Comp
// lumps stack on top of salary, so the marginal rate (not effective rate)
// is the right approximation. Manual life events are never taxed.

import { marginalRate, type Province } from './canadaTax'
import type { LumpSum } from './forecast'

export function applyLumpTax(lumps: LumpSum[], rate: number): LumpSum[] {
  if (rate <= 0) return lumps
  const r = Math.min(rate, 1)
  return lumps.map((l) => ({ ...l, amount: l.amount * (1 - r) }))
}

export interface CompTaxConfig {
  enabled: boolean
  auto: boolean
  manualPct: number
  income: number
  province: Province
}

/** Fraction (0..1) to withhold from comp lumps. */
export function resolveCompTaxRate(cfg: CompTaxConfig): number {
  if (!cfg.enabled) return 0
  if (cfg.auto) return marginalRate(cfg.income, cfg.province) / 100
  return Math.min(Math.max(cfg.manualPct, 0), 100) / 100
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/utils/finance/compTax.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/finance/compTax.ts src/utils/finance/compTax.test.ts
git commit -m "feat(finance): comp lump tax haircut helpers"
```

---

### Task 5: ForecastChart fixes (Real stacked view, today label, y-axis, tooltip)

**Files:**
- Modify: `src/components/planner/forecaster/ForecastChart.tsx`

**Interfaces:**
- Consumes: `contributedReal` / `growthReal` on `ForecastPoint` (Task 3); `formatMoneyCompact` (Task 1).
- Produces: nothing consumed by later tasks. Props are unchanged.

- [ ] **Step 1: Update the future-point mapping**

In `ForecastChart.tsx`, replace the `future` mapping (lines 35-44) so the stacked series respects `showReal` and keeps the unclamped growth for the tooltip:

```ts
  const future = points
    .filter((p) => p.month % 3 === 0)
    .map((p) => {
      const growthActual = Math.round(showReal ? p.growthReal : p.growth)
      return {
        month: p.month,
        projected: Math.round(showReal ? p.real : p.base),
        conservative: Math.round(p.conservative),
        optimistic: Math.round(p.optimistic),
        contributed: Math.round(showReal ? p.contributedReal : p.contributed),
        growthActual,
        growth: Math.max(0, growthActual),
      }
    })
```

- [ ] **Step 2: Compact y-axis, anchored today label, truthful tooltip**

Still in `ForecastChart.tsx`:

Import change:

```ts
import { formatMoney, formatMoneyCompact } from '../format'
```

YAxis (line 64) becomes:

```tsx
          <YAxis width={72} tickFormatter={(v: number) => formatMoneyCompact(v)} {...axisProps} />
```

Tooltip formatter (line 70) becomes (shows the unclamped growth value; `item.payload` is the row object):

```tsx
            formatter={(value, name, item) => {
              if (String(name) === 'Growth') {
                const actual = (item?.payload as { growthActual?: number } | undefined)?.growthActual
                return [formatMoney(actual ?? Number(value)), 'Growth']
              }
              return [formatMoney(Number(value)), String(name)]
            }}
```

ReferenceLine for today (line 73) gets an anchored label position:

```tsx
          <ReferenceLine x={0} stroke="var(--text-secondary)" strokeDasharray="4 4" label={{ value: 'today', fill: 'var(--text-secondary)', fontSize: 11, position: 'insideTopLeft' }} />
```

Also rename the stacked areas' display names if needed: the `Area` for growth already has `name="Growth"`, which the tooltip formatter matches on. Do not change the `name` props.

- [ ] **Step 3: Verify types and existing tests**

Run: `npx vitest run src/components/planner/forecaster/ src/utils/finance/forecast.test.ts`
Expected: PASS. Also run `npx tsc -b` and expect no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/forecaster/ForecastChart.tsx
git commit -m "fix(forecaster): real-mode stacked view, anchored today label, compact y-axis"
```

---

### Task 6: Wire comp tax into settings + ForecasterTool UI

**Files:**
- Modify: `src/components/planner/forecaster/useForecasterSettings.ts`
- Modify: `src/components/planner/forecaster/ForecasterTool.tsx:103-123`
- Test: `src/components/planner/forecaster/ForecasterTool.test.tsx` (append)

**Interfaces:**
- Consumes: `applyLumpTax`, `resolveCompTaxRate` from `../../../utils/finance/compTax` (Task 4); `PROVINCIAL_TAX`, `type Province` from `../../../utils/finance/canadaTax`.
- Produces: `useForecasterSettings()` return gains `compTax: { ratePct: number; province: Province }` (resolved rate as percent for display, and the province used). New persisted settings keys: `compTaxEnabled` (default `true`), `compTaxAuto` (default `true`), `compTaxManualPct` (default `50`).

- [ ] **Step 1: Write the failing test**

Append to `src/components/planner/forecaster/ForecasterTool.test.tsx`:

```tsx
describe('ForecasterTool comp tax controls', () => {
  it('shows the after-tax comp events toggle and caveat by default', () => {
    render(<MemoryRouter><ForecasterTool /></MemoryRouter>)
    expect(screen.getByText('After-Tax Comp Events')).toBeTruthy()
    expect(screen.getByText(/Comp events taxed at your marginal rate/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/forecaster/ForecasterTool.test.tsx`
Expected: FAIL, `After-Tax Comp Events` not found.

- [ ] **Step 3: Extend useForecasterSettings**

In `useForecasterSettings.ts`:

Add to `FORECASTER_DEFAULTS` (after `includeDebtDrag: false,`):

```ts
  compTaxEnabled: true,
  compTaxAuto: true,
  compTaxManualPct: 50,
```

Add imports:

```ts
import { applyLumpTax, resolveCompTaxRate } from '../../../utils/finance/compTax'
import { PROVINCIAL_TAX, type Province } from '../../../utils/finance/canadaTax'
```

Inside `useForecasterSettings()`, after `const primaryPackage = ...` add the rate resolution, and route `compLumps` through the haircut:

```ts
  const salaryTaxInputs = usePlannerStore((s) => s.inputs['salary-tax'])
  const provRaw = String(salaryTaxInputs?.province ?? 'ON')
  const taxProvince = (provRaw in PROVINCIAL_TAX ? provRaw : 'ON') as Province
  const taxIncome = Number(salaryTaxInputs?.income ?? 0) || primaryPackage.baseSalary || 0
```

Then, after `horizonMonths` is computed (rate needs `settings`):

```ts
  const compTaxRate = resolveCompTaxRate({
    enabled: settings.compTaxEnabled as boolean,
    auto: settings.compTaxAuto as boolean,
    manualPct: settings.compTaxManualPct as number,
    income: taxIncome,
    province: taxProvince,
  })
```

Change the `compLumps` line in `autoFeed`:

```ts
    compLumps: settings.autoComp
      ? applyLumpTax(compLumpSums(primaryPackage, primaryPackage.companyCurrentPrice, horizonMonths), compTaxRate)
      : ([] as LumpSum[]),
```

Add to the returned object:

```ts
    compTax: { ratePct: compTaxRate * 100, province: taxProvince },
```

- [ ] **Step 4: Add the UI in ForecasterTool**

In `ForecasterTool.tsx`, destructure the new field:

```ts
  const { settings, setSetting, events, saveEvents, goals, saveGoals, autoFeed, resolved, compTax } = useForecasterSettings()
```

In the "Comp Events / Debt Drag" column (the `div` at lines 103-123), after the existing `<div className="flex gap-2">...</div>` closes, add a second control row and the caveat:

```tsx
          <div className="flex gap-2">
            <button
              onClick={() => setSetting('compTaxEnabled', !settings.compTaxEnabled)}
              className={`flex-1 text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.compTaxEnabled ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              {settings.compTaxEnabled ? 'After-Tax Comp Events' : 'Gross Comp Events'}
            </button>
            {settings.compTaxEnabled ? (
              <button
                onClick={() => setSetting('compTaxAuto', !settings.compTaxAuto)}
                className={`flex-1 text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                  settings.compTaxAuto ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
                }`}
              >
                {settings.compTaxAuto ? `Marginal ${compTax.ratePct.toFixed(0)}% (${compTax.province})` : 'Manual Rate'}
              </button>
            ) : null}
          </div>
          {settings.compTaxEnabled && !settings.compTaxAuto ? (
            <CalculatorField label="" suffix="%" step={1} value={settings.compTaxManualPct as number} onChange={(v) => setSetting('compTaxManualPct', v)} />
          ) : null}
          {settings.compTaxEnabled ? (
            <p className="text-[11px] text-text-secondary">
              Comp events taxed at your marginal rate; RSU/ESPP treated as employment income.
            </p>
          ) : null}
```

The column's outer div already is `flex flex-col gap-1`; the new rows stack under the existing Comp Events / Debt Drag buttons.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/components/planner/forecaster/ && npx tsc -b`
Expected: PASS, no type errors. The pre-existing "source labels" test must still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/planner/forecaster/useForecasterSettings.ts src/components/planner/forecaster/ForecasterTool.tsx src/components/planner/forecaster/ForecasterTool.test.tsx
git commit -m "feat(forecaster): configurable after-tax haircut on comp event lumps"
```

---

### Task 7: Goal and event dates inside ListEditor cards

**Files:**
- Modify: `src/components/planner/forecaster/ListEditor.tsx`
- Modify: `src/components/planner/forecaster/ForecasterTool.tsx:173-203`
- Test: `src/components/planner/forecaster/ForecasterTool.test.tsx` (append)

**Interfaces:**
- Consumes: `monthsToReach(points, amount)` from `../../../utils/finance/fire` (already imported in ForecasterTool); local `formatMonthsOut`.
- Produces: `ListEditor` gains optional prop `renderExtra?: (item: T) => React.ReactNode`, rendered as one extra read-only cell per row.

- [ ] **Step 1: Write the failing test**

Append to `src/components/planner/forecaster/ForecasterTool.test.tsx`:

```tsx
describe('ForecasterTool goal dates in card', () => {
  it('shows a Projected cell inside the goals card after adding a goal', () => {
    render(<MemoryRouter><ForecasterTool /></MemoryRouter>)
    const goalsTitle = screen.getByText('Goals (Net-Worth Targets)')
    const card = goalsTitle.closest('.themed-card') as HTMLElement
    const addBtn = Array.from(card.querySelectorAll('button')).find((b) => b.textContent?.includes('Add'))!
    fireEvent.click(addBtn)
    expect(card.textContent).toContain('Projected')
  })
})
```

Add `fireEvent` to the existing `@testing-library/react` import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/planner/forecaster/ForecasterTool.test.tsx`
Expected: FAIL, card text does not contain `Projected`.

- [ ] **Step 3: Add renderExtra to ListEditor**

In `ListEditor.tsx`:

```tsx
interface ListEditorProps<T extends { id: string }> {
  title: string
  items: T[]
  columns: ListEditorColumn<T>[]
  makeNew: () => T
  onChange: (next: T[]) => void
  renderExtra?: (item: T) => React.ReactNode
}
```

Add `import React from 'react'` if not present (needed for the `React.ReactNode` type; a type-only import is fine: `import type React from 'react'`).

In the component, destructure `renderExtra` and size the row grid to the cell count (columns + extra cell + delete button). Tailwind cannot build dynamic class names, so use a lookup:

```tsx
export function ListEditor<T extends { id: string }>({ title, items, columns, makeNew, onChange, renderExtra }: ListEditorProps<T>) {
  const update = (id: string, key: string, value: string | number) =>
    onChange(items.map((it) => (it.id === id ? { ...it, [key]: value } : it)))
  const cellCount = columns.length + (renderExtra ? 1 : 0) + 1
  const mdCols = { 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5' }[cellCount] ?? 'md:grid-cols-4'
```

Row div class becomes:

```tsx
        <div key={it.id} className={`grid grid-cols-2 ${mdCols} gap-3 items-end border-b border-border pb-3 last:border-b-0`}>
```

After the `columns.map(...)` block and before the delete button, add:

```tsx
          {renderExtra ? <div className="flex flex-col gap-1">{renderExtra(it)}</div> : null}
```

- [ ] **Step 4: Use renderExtra in ForecasterTool and remove the loose text**

In `ForecasterTool.tsx`:

Delete the goals column wrapper and the loose `<p>` block. Lines 174-203 become:

```tsx
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListEditor<Goal>
          title="Goals (Net-Worth Targets)"
          items={goals}
          columns={[
            { key: 'label', label: 'Goal', type: 'text' },
            { key: 'amount', label: 'Amount ($)', type: 'number', step: 1000 },
          ]}
          makeNew={() => ({ id: `g${Date.now()}`, label: 'New goal', amount: 100000 })}
          onChange={saveGoals}
          renderExtra={(g) => (
            <>
              <span className="text-[13px] font-medium text-text-secondary">Projected</span>
              <span className="text-[15px] text-text-primary py-2">{formatMonthsOut(monthsToReach(points, g.amount))}</span>
            </>
          )}
        />
        <ListEditor<LifeEvent>
          title="Life Events (Negative = Cost, Positive = Windfall)"
          items={events}
          columns={[
            { key: 'label', label: 'Event', type: 'text' },
            { key: 'yearsFromNow', label: 'Years From Now', type: 'number', step: 0.5 },
            { key: 'amount', label: 'Amount ($)', type: 'number', step: 1000 },
          ]}
          makeNew={() => ({ id: `e${Date.now()}`, label: 'House down payment', yearsFromNow: 3, amount: -100000 })}
          onChange={saveEvents}
          renderExtra={(e) => (
            <>
              <span className="text-[13px] font-medium text-text-secondary">Lands</span>
              <span className="text-[15px] text-text-primary py-2">{formatMonthsOut(Math.max(1, Math.round(e.yearsFromNow * 12)))}</span>
            </>
          )}
        />
      </div>
```

The `goalMarkers` variable (line 79) is still used by `ForecastChart`; keep it. Only the `<p>` render block is removed.

Note the goals row now has 2 columns + extra + delete = 4 cells (`md:grid-cols-4`, unchanged look), and life events has 3 + extra + delete = 5 cells (`md:grid-cols-5`).

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/components/planner/forecaster/ && npx tsc -b`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/planner/forecaster/ListEditor.tsx src/components/planner/forecaster/ForecasterTool.tsx src/components/planner/forecaster/ForecasterTool.test.tsx
git commit -m "feat(forecaster): projected goal and event dates inside list cards"
```

---

### Task 8: Full-suite verification + visual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (baseline was 338 before this work; new total is higher). Do not count tests under `.claude/worktrees`.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc -b && npx eslint src/components/planner/forecaster src/utils/finance/compTax.ts src/components/planner/format.ts`
Expected: clean.

- [ ] **Step 3: Visual verification in the dev server preview**

Start the dev server (browser preview tools, not Bash) and open the Planner > Net Worth Forecaster:
- Goals card: add a goal, confirm "Projected: {date}" renders inside the card and no loose text sits below it.
- Life Events card: add an event, confirm "Lands: {date}" cell.
- Monte Carlo chart: footnote is inside the card border; y-axis shows `$12M` style labels, nothing clipped.
- Toggle Real + Contributions vs Growth: stack height matches the Real projected line from the bands view; "today" label sits at the top left of the reference line; y-axis not clipped.
- Comp tax: toggle After-Tax Comp Events off/on and Auto/Manual; manual field defaults to 50; FI date shifts accordingly.

- [ ] **Step 4: Commit any fixes found, then report**

No commit if clean.
