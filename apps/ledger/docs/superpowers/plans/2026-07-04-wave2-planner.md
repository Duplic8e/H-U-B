# Wave 2 — Salary & Tax Merge, Planner Hub Redesign, CSV Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Income Tax Estimator and Take-Home Pay calculators into one "Salary & Tax" tool, reorganize the Planner hub into grouped sections with a breadcrumb-dropdown tool switcher, and harden broker-CSV header detection.

**Architecture:** The tool registry gains a `group` field and loses two entries in favor of one merged `salary-tax` tool built from the two existing calculators. Navigation adds one new `ToolSwitcher` dropdown component used by `PlannerTool`. CSV hardening is confined to `portfolioCsv.ts` header normalization. Saved planner inputs migrate lazily (on first render of the merged tool) — no zustand version bump needed because the store shape is unchanged, only a new key inside `inputs`.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, Tailwind, Zustand (persist), PapaParse, Vitest + React Testing Library.

## Global Constraints

- **Depends on Wave 1 being merged** (`docs/superpowers/plans/2026-07-04-wave1-ui-fixes.md`): uses `SelectField` (`src/components/planner/SelectField.tsx`) and `marginalRateBreakdown` from `canadaTax.ts`. Verify both exist before starting; stop and report if they don't.
- Testing policy: **no TDD.** Implement, run the named test files, update only tests this plan names or that your change broke.
- Persisted key `ledger-planner` and store shape (`inputs: Record<string, ToolInputs>`) must not change. Old `income-tax` / `take-home-pay` entries are read for seeding but never deleted.
- Test command: `npx vitest run <path>`. Type-check: `npx tsc --noEmit`.

---

### Task 1: Merged "Salary & Tax" tool

**Files:**
- Create: `src/components/planner/SalaryTaxTool.tsx`
- Modify: `src/components/planner/toolRegistry.tsx`
- Modify: `src/App.tsx` (two redirect routes)
- Delete: `src/components/planner/IncomeTaxEstimator.tsx`, `src/components/planner/TakeHomePayCalculator.tsx`
- Test: `src/pages/Planner.test.tsx` (verify passes; registry-driven, no edits expected)

**Interfaces:**
- Consumes: `SelectField` (Wave 1), `marginalRateBreakdown`, `takeHomePay`, `totalIncomeTax`, `marginalRate`, `effectiveRate`, `FEDERAL_BRACKETS`, `PROVINCIAL_TAX`, `PROVINCES`, `Bracket`, `Province` from `canadaTax.ts`; `usePlannerStore`, `useToolInputs`; `CalculatorField`, `ResultCard`, `formatMoney`.
- Produces: registry tool id `'salary-tax'` named `"Salary & Tax"` with component `SalaryTaxTool`. Task 2 places this id in the `'Income & Tax'` group.

- [ ] **Step 1: Create SalaryTaxTool**

Create `src/components/planner/SalaryTaxTool.tsx` with exactly this content (the `BracketBar` subcomponent is moved verbatim from `IncomeTaxEstimator.tsx`; the deductions section from `TakeHomePayCalculator.tsx`):

```tsx
import React, { useEffect } from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import {
  effectiveRate,
  FEDERAL_BRACKETS,
  marginalRate,
  marginalRateBreakdown,
  PROVINCES,
  PROVINCIAL_TAX,
  takeHomePay,
  totalIncomeTax,
  type Bracket,
  type Province,
} from '../../utils/finance/canadaTax'
import { CalculatorField } from './CalculatorField'
import { SelectField } from './SelectField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'salary-tax'
const DEFAULTS = { income: 100000, province: 'ON' as string }

/** Horizontal stacked bar: one segment per bracket, filled up to `income`. */
const BracketBar: React.FC<{ title: string; brackets: Bracket[]; income: number }> = ({ title, brackets, income }) => {
  const cap = Math.max(income * 1.25, 1) // view window slightly past current income
  const segments = brackets
    .reduce<Array<{ start: number; end: number; rate: number; lower: number }>>((acc, b) => {
      const lower = acc.length > 0 ? acc[acc.length - 1].lower : 0
      const start = lower
      const end = Math.min(b.upTo, cap)
      if (end > start) {
        acc.push({ start, end, rate: b.rate, lower: b.upTo })
      }
      return acc
    }, [])
    .map(({ start, end, rate }) => ({ start, end, rate }))
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] uppercase tracking-wide text-text-secondary">{title}</span>
      <div className="flex h-6 w-full rounded overflow-hidden border border-border">
        {segments.map((s) => {
          const width = ((s.end - s.start) / cap) * 100
          const filledTo = Math.min(Math.max(income - s.start, 0), s.end - s.start)
          const filledPct = ((s.end - s.start) > 0 ? filledTo / (s.end - s.start) : 0) * 100
          return (
            <div key={s.start} className="relative bg-bg-primary/40 border-r border-border last:border-r-0" style={{ width: `${width}%` }} title={`${(s.rate * 100).toFixed(2)}% from ${formatMoney(s.start)}`}>
              <div className="absolute inset-y-0 left-0 bg-accent/60" style={{ width: `${filledPct}%` }} />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-text-primary">
                {(s.rate * 100).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const SalaryTaxTool: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const province = inputs.province as Province
  const income = inputs.income

  // One-time seed from the legacy income-tax / take-home-pay saved inputs so
  // nobody loses their numbers. Legacy entries are read, never deleted.
  useEffect(() => {
    const { inputs: all, setInput: set } = usePlannerStore.getState()
    if (all[TOOL_ID] !== undefined) return
    const oldTax = all['income-tax']
    const oldPay = all['take-home-pay']
    if (oldTax) {
      if (typeof oldTax.income === 'number') set(TOOL_ID, 'income', oldTax.income)
      if (typeof oldTax.province === 'string') set(TOOL_ID, 'province', oldTax.province)
    } else if (oldPay) {
      if (typeof oldPay.gross === 'number') set(TOOL_ID, 'income', oldPay.gross)
      if (typeof oldPay.province === 'string') set(TOOL_ID, 'province', oldPay.province)
    }
  }, [])

  const breakdown = marginalRateBreakdown(income, province)
  const t = takeHomePay(income, province)
  const deductions = [
    { label: 'Federal tax', value: t.federal },
    { label: 'Provincial tax', value: t.provincial },
    { label: 'CPP (incl. CPP2)', value: t.cpp },
    { label: 'EI', value: t.ei },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <CalculatorField label="Gross annual income" prefix="$" step={1000} value={income} onChange={(v) => setInput(TOOL_ID, 'income', v)} />
        <SelectField label="Province" value={province} onChange={(v) => setInput(TOOL_ID, 'province', v)}>
          {PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Total income tax" value={formatMoney(totalIncomeTax(income, province))} highlight />
        <ResultCard label="Marginal rate" value={`${marginalRate(income, province).toFixed(2)}%`} />
        <ResultCard label="Effective rate" value={`${effectiveRate(income, province).toFixed(2)}%`} />
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col gap-4">
        <BracketBar title="Federal Brackets" brackets={FEDERAL_BRACKETS} income={income} />
        <BracketBar title={`${PROVINCIAL_TAX[province].name} Brackets`} brackets={PROVINCIAL_TAX[province].brackets} income={income} />
        <div className="flex flex-col gap-1">
          <span className="text-[12px] uppercase tracking-wide text-text-secondary">Marginal rate breakdown</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-primary">
            <span>Federal {breakdown.federal.toFixed(2)}%</span>
            <span>+ Provincial {breakdown.provincialBase.toFixed(2)}%</span>
            {breakdown.surtax > 0 && <span>+ ON surtax {breakdown.surtax.toFixed(2)}%</span>}
            <span className="font-semibold">= {breakdown.total.toFixed(2)}%</span>
          </div>
        </div>
        <p className="text-[12px] text-text-secondary">
          Filled portion = income inside each bracket. The breakdown above shows why the marginal
          rate can exceed the bracket rates — Ontario's surtax adds to every extra dollar's tax.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Net annual" value={formatMoney(t.net)} highlight />
        <ResultCard label="Net monthly" value={formatMoney(t.net / 12)} />
        <ResultCard label="Net biweekly" value={formatMoney(t.net / 26)} />
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-wide text-text-secondary">Deductions</p>
        {deductions.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-[13px] text-text-secondary w-40 shrink-0">{d.label}</span>
            <div className="flex-1 h-2 rounded bg-bg-primary/50 overflow-hidden">
              <div className="h-full bg-accent/70" style={{ width: `${t.gross > 0 ? (d.value / t.gross) * 100 : 0}%` }} />
            </div>
            <span className="text-[13px] text-text-primary w-24 text-right">{formatMoney(d.value)}</span>
          </div>
        ))}
        <p className="text-[12px] text-text-secondary mt-2">
          2026 rates, employee side, basic personal amount only — an estimate, not payroll advice.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace the two registry entries with one**

In `src/components/planner/toolRegistry.tsx`:

1. Remove the imports of `TakeHomePayCalculator` and `IncomeTaxEstimator`; add:
   ```tsx
   import { SalaryTaxTool } from './SalaryTaxTool'
   ```
2. In the `PLANNER_TOOLS` array, delete both the `take-home-pay` entry and the `income-tax` entry, and in the position where `take-home-pay` was, insert:
   ```tsx
   {
     id: 'salary-tax',
     name: 'Salary & Tax',
     description: 'Gross to net for any province — 2026 tax breakdown, marginal/effective rates, CPP and EI.',
     icon: Landmark,
     component: SalaryTaxTool,
   },
   ```
3. The `Percent` icon import becomes unused — remove `Percent` from the lucide-react import list (keep `Landmark`).

- [ ] **Step 3: Delete the two old calculator files**

```bash
git rm src/components/planner/IncomeTaxEstimator.tsx src/components/planner/TakeHomePayCalculator.tsx
```

Then run `npx tsc --noEmit`. If any file still imports the deleted components, the compiler will name it — fix those imports (expected: none besides the registry).

- [ ] **Step 4: Redirect the old routes**

In `src/App.tsx`, inside the `<Route path="/" element={<Layout />}>` block, add these two lines **above** the `planner/:toolId` route:

```tsx
          <Route path="planner/income-tax" element={<Navigate to="/planner/salary-tax" replace />} />
          <Route path="planner/take-home-pay" element={<Navigate to="/planner/salary-tax" replace />} />
```

(`Navigate` is already imported in App.tsx.)

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/pages/Planner.test.tsx src/components/planner src/utils/finance/canadaTax.test.ts`
Expected: pass. `Planner.test.tsx` iterates `PLANNER_TOOLS`, so the merged entry is covered automatically.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/planner src/App.tsx
git commit -m "feat: merge income tax + take-home into one Salary & Tax tool with legacy-input seeding"
```

---

### Task 2: Grouped Planner hub

**Files:**
- Modify: `src/components/planner/toolRegistry.tsx` (add `group` to interface + every entry, export group order)
- Modify: `src/pages/Planner.tsx`
- Test: `src/pages/Planner.test.tsx` (verify; no edits expected)

**Interfaces:**
- Consumes: registry from Task 1 (tool id `salary-tax` exists).
- Produces: `export type PlannerToolGroup = 'Forecasting & Growth' | 'Savings' | 'Debt & Housing' | 'Income & Tax' | 'Utilities'`, `group: PlannerToolGroup` on `PlannerTool`, and `export const PLANNER_GROUPS: PlannerToolGroup[]`. Task 3's dropdown consumes all three.

- [ ] **Step 1: Add group metadata to the registry**

In `src/components/planner/toolRegistry.tsx`:

1. Above the `PlannerTool` interface add:
   ```tsx
   export type PlannerToolGroup =
     | 'Forecasting & Growth'
     | 'Savings'
     | 'Debt & Housing'
     | 'Income & Tax'
     | 'Utilities'

   /** Hub section + dropdown order. */
   export const PLANNER_GROUPS: PlannerToolGroup[] = [
     'Forecasting & Growth',
     'Savings',
     'Debt & Housing',
     'Income & Tax',
     'Utilities',
   ]
   ```
2. Add `group: PlannerToolGroup` to the `PlannerTool` interface (after `description`).
3. Add a `group` line to every entry, exactly this mapping:
   - `forecaster` → `'Forecasting & Growth'`
   - `compound-interest` → `'Forecasting & Growth'`
   - `savings-goal` → `'Savings'`
   - `emergency-fund` → `'Savings'`
   - `currency-converter` → `'Utilities'`
   - `raise-inflation` → `'Income & Tax'`
   - `debt-payoff` → `'Debt & Housing'`
   - `mortgage` → `'Debt & Housing'`
   - `rent-vs-buy` → `'Debt & Housing'`
   - `salary-tax` → `'Income & Tax'`
   - `rrsp-vs-tfsa` → `'Income & Tax'`

- [ ] **Step 2: Render hub sections**

Replace the entire body of `src/pages/Planner.tsx` with:

```tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { BentoGrid } from '../components/dashboard/BentoGrid'
import { PLANNER_GROUPS, PLANNER_TOOLS } from '../components/planner/toolRegistry'

export const Planner: React.FC = () => (
  <div className="flex flex-col gap-8 w-full h-full p-6 animate-fade-in">
    <header>
      <h1 className="text-[24px] font-semibold text-text-primary">Planner</h1>
      <p className="text-[14px] text-text-secondary mt-1">
        Financial tools and calculators — every input is saved automatically.
      </p>
    </header>
    {PLANNER_GROUPS.map((group) => {
      const tools = PLANNER_TOOLS.filter((t) => t.group === group)
      if (tools.length === 0) return null
      return (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{group}</h2>
          <BentoGrid>
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <Link
                  key={tool.id}
                  to={`/planner/${tool.id}`}
                  className="themed-card rounded-lg p-4 flex flex-col gap-2 hover:border-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-accent" />
                    <h3 className="text-[16px] font-semibold text-text-primary">{tool.name}</h3>
                  </div>
                  <p className="text-[13px] text-text-secondary">{tool.description}</p>
                </Link>
              )
            })}
          </BentoGrid>
        </section>
      )
    })}
  </div>
)
```

Note the card titles changed from `<h2>` to `<h3>` because group headers are now the `<h2>`s.

- [ ] **Step 3: Run hub tests**

Run: `npx vitest run src/pages/Planner.test.tsx`
Expected: pass — the tests query by text/role `link`, both unaffected by the new sections.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/toolRegistry.tsx src/pages/Planner.tsx
git commit -m "feat: group planner hub into sections"
```

---

### Task 3: Breadcrumb + dropdown tool switcher

**Files:**
- Create: `src/components/planner/ToolSwitcher.tsx`
- Modify: `src/pages/PlannerTool.tsx`
- Modify: `src/pages/Planner.test.tsx` (one changed assertion)

**Interfaces:**
- Consumes: `PLANNER_GROUPS`, `PLANNER_TOOLS`, `PlannerTool` type from Task 2; `useNavigate` from react-router-dom.
- Produces: `ToolSwitcher` component — `interface ToolSwitcherProps { current: PlannerTool }` (the registry tool object, not the page). Renders the page's `<h1>`.

- [ ] **Step 1: Create ToolSwitcher**

Create `src/components/planner/ToolSwitcher.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { PLANNER_GROUPS, PLANNER_TOOLS, type PlannerTool } from './toolRegistry'

interface ToolSwitcherProps {
  current: PlannerTool
}

/** Page title that doubles as a grouped tool-switch dropdown, so moving
 *  between planner tools never requires a round-trip through the hub. */
export const ToolSwitcher: React.FC<ToolSwitcherProps> = ({ current }) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
      >
        <h1 className="text-[24px] font-semibold text-text-primary">{current.name}</h1>
        <ChevronDown className={`w-5 h-5 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 z-30 w-72 max-h-[70vh] overflow-y-auto themed-card border border-border rounded-lg shadow-xl p-2 flex flex-col gap-1"
        >
          {PLANNER_GROUPS.map((group) => {
            const tools = PLANNER_TOOLS.filter((t) => t.group === group)
            if (tools.length === 0) return null
            return (
              <div key={group} className="flex flex-col">
                <span className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{group}</span>
                {tools.map((t) => {
                  const Icon = t.icon
                  const isCurrent = t.id === current.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false)
                        if (!isCurrent) navigate(`/planner/${t.id}`)
                      }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-[14px] transition-colors ${
                        isCurrent ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary hover:bg-bg-primary/50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {t.name}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Use it in PlannerTool**

Replace the entire content of `src/pages/PlannerTool.tsx` with:

```tsx
import React from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getTool } from '../components/planner/toolRegistry'
import { ToolSwitcher } from '../components/planner/ToolSwitcher'

export const PlannerTool: React.FC = () => {
  const { toolId } = useParams()
  const tool = getTool(toolId)
  if (!tool) return <Navigate to="/planner" replace />
  const Component = tool.component
  return (
    <div className="flex flex-col gap-6 w-full h-full p-6 animate-fade-in">
      <header className="flex items-center gap-2">
        <Link
          to="/planner"
          aria-label="Back to Planner"
          className="text-[24px] font-semibold text-text-secondary hover:text-accent transition-colors"
        >
          Planner
        </Link>
        <span className="text-[24px] text-text-secondary">/</span>
        <ToolSwitcher current={tool} />
      </header>
      <Component />
    </div>
  )
}
```

(The `ArrowLeft` icon import is gone; the "Planner" crumb keeps `aria-label="Back to Planner"` so the existing test keeps passing.)

- [ ] **Step 3: Extend Planner.test.tsx**

In `src/pages/Planner.test.tsx`, inside the `describe('PlannerTool route', …)` block, append this test (the two existing tests stay unchanged and must still pass):

```tsx
  it('switches tools through the breadcrumb dropdown', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    renderAt(`/planner/${PLANNER_TOOLS[0].id}`)
    await userEvent.click(screen.getByRole('button', { name: new RegExp(PLANNER_TOOLS[0].name) }))
    const target = PLANNER_TOOLS[1]
    await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(target.name) }))
    expect(screen.getByRole('heading', { name: target.name })).toBeInTheDocument()
  })
```

If `@testing-library/user-event` is not installed (check `package.json` devDependencies), use `fireEvent.click` from `@testing-library/react` instead — same two clicks, no `await`s.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/pages/Planner.test.tsx`
Expected: all pass, including the two pre-existing PlannerTool tests (`Back to Planner` link still resolves via aria-label; the tool heading is still an `<h1>` with the tool name).

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/ToolSwitcher.tsx src/pages/PlannerTool.tsx src/pages/Planner.test.tsx
git commit -m "feat: breadcrumb dropdown tool switcher on planner tool pages"
```

---

### Task 4: CSV header normalization

**Files:**
- Modify: `src/utils/portfolioCsv.ts`
- Modify: `src/utils/portfolioCsv.test.ts` (append tests)

**Interfaces:**
- Consumes: nothing from other tasks (independent — can run in parallel with Tasks 1–3).
- Produces: unchanged public API (`parsePortfolioText`, `parsePortfolioCSV`, `mapPortfolioRows`, `PORTFOLIO_PARSERS`); detection and row access become whitespace/BOM/case tolerant.

- [ ] **Step 1: Normalize headers and make lookups case-insensitive**

In `src/utils/portfolioCsv.ts`:

1. Below the `positive()` helper, add:

```ts
/** Case-insensitive row lookup; header keys are already BOM-stripped and
 *  trimmed by the transformHeader in parsePortfolioText. */
function cell(row: Record<string, string>, name: string): string | undefined {
  if (row[name] !== undefined) return row[name]
  const target = name.toLowerCase()
  const key = Object.keys(row).find((k) => k.toLowerCase() === target)
  return key !== undefined ? row[key] : undefined
}

function hasHeader(headers: string[], name: string): boolean {
  const target = name.toLowerCase()
  return headers.some((h) => h.toLowerCase() === target)
}
```

2. Update both parser configs to use the helpers. Replace the `detect`/`parse` of **Interactive Brokers** with:

```ts
    detect: (headers) => hasHeader(headers, 'Symbol') && hasHeader(headers, 'Cost Basis'),
    parse: (row) => {
      const quantity = positive(cell(row, 'Quantity'))
      const costBasis = positive(cell(row, 'Cost Basis'))
      const ticker = cell(row, 'Symbol')?.trim()
      if (!ticker || quantity === null || costBasis === null) return null
      return {
        ticker: ticker.toUpperCase(),
        name: cell(row, 'Description')?.trim() || undefined,
        quantity,
        avgCost: costBasis / quantity,
        currency: toCurrency(cell(row, 'Currency')),
      }
    },
```

and of **Wealthsimple** with:

```ts
    detect: (headers) => hasHeader(headers, 'Symbol') && hasHeader(headers, 'Book Value'),
    parse: (row) => {
      const quantity = positive(cell(row, 'Quantity'))
      const bookValue = positive(cell(row, 'Book Value'))
      const ticker = cell(row, 'Symbol')?.trim()
      if (!ticker || quantity === null || bookValue === null) return null
      return {
        ticker: ticker.toUpperCase(),
        name: cell(row, 'Name')?.trim() || undefined,
        quantity,
        avgCost: bookValue / quantity,
        currency: toCurrency(cell(row, 'Currency')),
      }
    },
```

3. In `parsePortfolioText`, add a `transformHeader` so every header key is BOM-stripped and trimmed before anything reads it:

```ts
  const results = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
  })
```

- [ ] **Step 2: Append regression tests**

In `src/utils/portfolioCsv.test.ts`, append:

```ts
describe('header normalization', () => {
  it('detects IBKR despite BOM, padding, and lowercase headers', () => {
    const csv = '\uFEFF symbol , Quantity , cost basis ,Currency\nAAPL,10,1500,USD\n'
    const result = parsePortfolioText(csv)
    expect(Array.isArray(result)).toBe(true)
    const holdings = result as Array<{ ticker: string; quantity: number; avgCost: number }>
    expect(holdings).toHaveLength(1)
    expect(holdings[0].ticker).toBe('AAPL')
    expect(holdings[0].quantity).toBe(10)
    expect(holdings[0].avgCost).toBeCloseTo(150)
  })

  it('detects Wealthsimple with trailing header whitespace', () => {
    const csv = 'Symbol ,Quantity,Book Value \nVFV,5,600\n'
    const result = parsePortfolioText(csv)
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(1)
  })

  it('still falls through to the mapper for genuinely unknown headers', () => {
    const csv = 'Ticker,Shares,Total\nAAPL,10,1500\n'
    const result = parsePortfolioText(csv)
    expect('unrecognized' in (result as object)).toBe(true)
  })
})
```

(`parsePortfolioText` is already imported in this test file; if not, add it to the existing import from `./portfolioCsv`.)

- [ ] **Step 3: Run the CSV tests**

Run: `npx vitest run src/utils/portfolioCsv.test.ts`
Expected: all pass, old and new.

- [ ] **Step 4: Commit**

```bash
git add src/utils/portfolioCsv.ts src/utils/portfolioCsv.test.ts
git commit -m "fix: tolerate BOM, whitespace, and case drift in broker CSV headers"
```

---

### Task 5: Full-suite verification

- [ ] **Step 1: Run everything**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass, no type errors. Report (don't fix) unrelated failures.
