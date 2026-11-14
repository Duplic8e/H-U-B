# Phase 4a — Planner Hub Scaffold + Shared Infrastructure + Core Calculators

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Projections tab with a Planner hub (Bento grid of tools), build the shared calculator infrastructure (persisted inputs store, tool registry, finance-math utils, UI primitives), and ship the first two working calculators: Compound Interest and Savings Goal (solve-for-any-variable).

**Architecture:** One persisted Zustand store (`ledger-planner`) namespaces every calculator's inputs by tool id. A tool registry drives both the hub grid and a `/planner/:toolId` detail route. Calculator math lives in pure, unit-tested modules under `src/utils/finance/`; components are thin composers of shared `CalculatorField`/`ResultCard` primitives. Later sub-plans (4b–4e) only append registry entries + utils + components.

**Tech Stack:** React 19, react-router-dom v7 (HashRouter), Zustand v5 `persist`, Recharts v3, lucide-react, Tailwind v4, Vitest (globals: true) + Testing Library.

**Umbrella plan:** `2026-07-02-phase-4-planner.md` (sub-plan index, cross-module interfaces for 4e).

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **Local-first persistence.** New store uses Zustand `persist` → LocalStorage per `src/store/useCompensationStore.ts`.
- **Backup coverage.** The new `ledger-planner` key is appended to `BACKUP_KEYS` in `src/utils/backup.ts` + registration test (Task 1). It is the ONLY new key in all of Phase 4.
- **Recharts only** for charts; theme via CSS variables passed directly as stroke/fill (`var(--accent)` etc.).
- **No hardcoded colors — theme CSS variables only.** Must work in ALL 5 themes: `geometric`, `tactical`, `luxury`, `aurora`, `glass`.
- **Live data always has a manual fallback** (not exercised in 4a — no market data used here).
- **Mobile + all 5 themes are acceptance gates** (Task 8).
- **TDD every task; commit per task.** Vitest globals — do NOT import `describe/it/expect/beforeEach` in tests (`@testing-library/jest-dom` is wired via `src/setupTests.ts`). Lint enforces `react-hooks/set-state-in-effect` — components below write to the store directly from event handlers, never from effects.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

---

### Task 1: Planner inputs store + backup registration

**Files:**
- Create: `src/store/usePlannerStore.ts`
- Create: `src/store/usePlannerStore.test.ts`
- Modify: `src/utils/backup.ts` (append one key to `BACKUP_KEYS`)
- Modify: `src/utils/backup.test.ts` (one registration test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `usePlannerStore` — `{ inputs: Record<string, ToolInputs>; setInput(tool: string, field: string, value: PlannerInputValue): void; resetTool(tool: string): void }`; hook `useToolInputs<T extends ToolInputs>(tool: string, defaults: T): T`; types `PlannerInputValue = number | string | boolean`, `ToolInputs = Record<string, PlannerInputValue>`. All later calculator tasks (here and in 4b–4e) persist through these.

- [x] **Step 1: Write the failing tests**

Create `src/store/usePlannerStore.test.ts`:

```ts
import { usePlannerStore } from './usePlannerStore'

const initialState = usePlannerStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initialState, true)
})

describe('usePlannerStore', () => {
  it('setInput stores a value namespaced by tool id', () => {
    usePlannerStore.getState().setInput('compound-interest', 'principal', 5000)
    expect(usePlannerStore.getState().inputs['compound-interest'].principal).toBe(5000)
  })

  it('setInput preserves sibling fields and other tools', () => {
    const { setInput } = usePlannerStore.getState()
    setInput('compound-interest', 'principal', 5000)
    setInput('compound-interest', 'years', 10)
    setInput('savings-goal', 'target', 100000)
    const { inputs } = usePlannerStore.getState()
    expect(inputs['compound-interest']).toEqual({ principal: 5000, years: 10 })
    expect(inputs['savings-goal']).toEqual({ target: 100000 })
  })

  it('resetTool clears only that tool', () => {
    const { setInput, resetTool } = usePlannerStore.getState()
    setInput('compound-interest', 'principal', 5000)
    setInput('savings-goal', 'target', 100000)
    resetTool('compound-interest')
    const { inputs } = usePlannerStore.getState()
    expect(inputs['compound-interest']).toBeUndefined()
    expect(inputs['savings-goal']).toEqual({ target: 100000 })
  })

  it('persists under the ledger-planner key', () => {
    usePlannerStore.getState().setInput('compound-interest', 'principal', 5000)
    expect(localStorage.getItem('ledger-planner')).toContain('"principal":5000')
  })
})
```

Add to the first `describe('backup', ...)` block in `src/utils/backup.test.ts`, next to the existing `'registers the market-data store key'` test:

```ts
  it('registers the planner store key', () => {
    expect(BACKUP_KEYS).toContain('ledger-planner')
  })
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/usePlannerStore.test.ts src/utils/backup.test.ts`
Expected: usePlannerStore tests FAIL (cannot resolve `./usePlannerStore`); backup test FAILS (`ledger-planner` not in array).

- [x] **Step 3: Implement the store and register the backup key**

Create `src/store/usePlannerStore.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PlannerInputValue = number | string | boolean
export type ToolInputs = Record<string, PlannerInputValue>

interface PlannerState {
  inputs: Record<string, ToolInputs>
  setInput: (tool: string, field: string, value: PlannerInputValue) => void
  resetTool: (tool: string) => void
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      inputs: {},
      setInput: (tool, field, value) =>
        set((state) => ({
          inputs: {
            ...state.inputs,
            [tool]: { ...state.inputs[tool], [field]: value },
          },
        })),
      resetTool: (tool) =>
        set((state) => {
          const next = { ...state.inputs }
          delete next[tool]
          return { inputs: next }
        }),
    }),
    { name: 'ledger-planner' }
  )
)

/** Saved inputs for a tool, merged over defaults. Components write via setInput. */
export function useToolInputs<T extends ToolInputs>(tool: string, defaults: T): T {
  const saved = usePlannerStore((s) => s.inputs[tool])
  return { ...defaults, ...saved } as T
}
```

In `src/utils/backup.ts`, append `'ledger-planner'` to `BACKUP_KEYS`:

```ts
export const BACKUP_KEYS: string[] = [
  'accounts-storage',
  'ledger-budget',
  'ledger-compensation',
  'financial-dashboard-theme',
  'ledger-triage',
  'ledger-market-data',
  'ledger-planner',
]
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/usePlannerStore.test.ts src/utils/backup.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/store/usePlannerStore.ts src/store/usePlannerStore.test.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: planner inputs store persisted as ledger-planner, registered in backup"
```

---

### Task 2: Compound-interest math (`src/utils/finance/compound.ts`)

**Files:**
- Create: `src/utils/finance/compound.ts`
- Create: `src/utils/finance/compound.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `futureValue(principal: number, annualRatePct: number, months: number, monthlyContribution?: number): number`; `growthSeries(principal: number, annualRatePct: number, monthlyContribution: number, months: number): GrowthPoint[]`; `monthlyRate(annualRatePct: number): number`; `interface GrowthPoint { month: number; balance: number; contributed: number; growth: number }`. Used by Tasks 3, 6, 7 and by 4e's forecaster.

Convention (document in a file-top comment): rates are **percent** (7 = 7%), compounding is monthly, contributions land at the end of each month.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/compound.test.ts`:

```ts
import { futureValue, growthSeries, monthlyRate } from './compound'

describe('monthlyRate', () => {
  it('converts annual percent to monthly decimal', () => {
    expect(monthlyRate(12)).toBeCloseTo(0.01, 10)
    expect(monthlyRate(0)).toBe(0)
  })
})

describe('futureValue', () => {
  it('compounds a lump sum monthly: 1000 at 12% for 12 months', () => {
    // 1000 * 1.01^12
    expect(futureValue(1000, 12, 12)).toBeCloseTo(1126.83, 2)
  })

  it('grows an annuity: 100/month at 12% for 12 months', () => {
    // 100 * ((1.01^12 - 1) / 0.01)
    expect(futureValue(0, 12, 12, 100)).toBeCloseTo(1268.25, 2)
  })

  it('handles zero rate as simple accumulation', () => {
    expect(futureValue(1000, 0, 12, 100)).toBe(2200)
  })

  it('returns principal for zero months', () => {
    expect(futureValue(1000, 7, 0, 100)).toBe(1000)
  })
})

describe('growthSeries', () => {
  it('starts at month 0 with principal and zero growth', () => {
    const s = growthSeries(1000, 7, 100, 24)
    expect(s[0]).toEqual({ month: 0, balance: 1000, contributed: 1000, growth: 0 })
    expect(s).toHaveLength(25)
  })

  it('final balance agrees with futureValue', () => {
    const s = growthSeries(1000, 7, 100, 24)
    expect(s[24].balance).toBeCloseTo(futureValue(1000, 7, 24, 100), 6)
  })

  it('tracks contributed and growth consistently', () => {
    const s = growthSeries(1000, 7, 100, 24)
    const last = s[24]
    expect(last.contributed).toBe(1000 + 100 * 24)
    expect(last.growth).toBeCloseTo(last.balance - last.contributed, 10)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/compound.test.ts`
Expected: FAIL — cannot resolve `./compound`.

- [x] **Step 3: Implement**

Create `src/utils/finance/compound.ts`:

```ts
// Pure compound-interest math. Conventions: rates are PERCENT (7 = 7%),
// compounding is monthly, contributions are made at the END of each month.

export interface GrowthPoint {
  month: number
  balance: number
  /** Principal plus all contributions made so far. */
  contributed: number
  /** balance - contributed. */
  growth: number
}

export function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12
}

export function futureValue(
  principal: number,
  annualRatePct: number,
  months: number,
  monthlyContribution = 0,
): number {
  const r = monthlyRate(annualRatePct)
  if (r === 0) return principal + monthlyContribution * months
  const g = Math.pow(1 + r, months)
  return principal * g + monthlyContribution * ((g - 1) / r)
}

export function growthSeries(
  principal: number,
  annualRatePct: number,
  monthlyContribution: number,
  months: number,
): GrowthPoint[] {
  const r = monthlyRate(annualRatePct)
  const points: GrowthPoint[] = [
    { month: 0, balance: principal, contributed: principal, growth: 0 },
  ]
  let balance = principal
  let contributed = principal
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + r) + monthlyContribution
    contributed += monthlyContribution
    points.push({ month: m, balance, contributed, growth: balance - contributed })
  }
  return points
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/compound.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/compound.ts src/utils/finance/compound.test.ts
git commit -m "feat: pure compound-interest math (futureValue, growthSeries)"
```

---

### Task 3: Savings-goal solvers (`src/utils/finance/savingsGoal.ts`)

**Files:**
- Create: `src/utils/finance/savingsGoal.ts`
- Create: `src/utils/finance/savingsGoal.test.ts`

**Interfaces:**
- Consumes: `futureValue` from `src/utils/finance/compound.ts` (Task 2).
- Produces: `solveTarget(principal, annualRatePct, monthlyContribution, months): number`; `solveMonthlyContribution(target, principal, annualRatePct, months): number | null`; `solveMonths(target, principal, annualRatePct, monthlyContribution, maxMonths?): number | null`; `solveAnnualRate(target, principal, monthlyContribution, months): number | null` (all args `number`; `null` = unreachable). Used by Task 7.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/savingsGoal.test.ts`:

```ts
import { futureValue } from './compound'
import {
  solveAnnualRate,
  solveMonthlyContribution,
  solveMonths,
  solveTarget,
} from './savingsGoal'

describe('solveTarget', () => {
  it('is futureValue by another name', () => {
    expect(solveTarget(1000, 12, 100, 12)).toBeCloseTo(futureValue(1000, 12, 12, 100), 10)
  })
})

describe('solveMonthlyContribution', () => {
  it('round-trips through futureValue', () => {
    const c = solveMonthlyContribution(100000, 10000, 5, 120)
    expect(c).not.toBeNull()
    expect(futureValue(10000, 5, 120, c as number)).toBeCloseTo(100000, 4)
  })

  it('handles zero rate with simple division', () => {
    expect(solveMonthlyContribution(2200, 1000, 0, 12)).toBeCloseTo(100, 10)
  })

  it('returns 0 when the goal is already met by growth alone', () => {
    expect(solveMonthlyContribution(1000, 10000, 5, 12)).toBe(0)
  })

  it('returns null for a non-positive horizon', () => {
    expect(solveMonthlyContribution(100000, 0, 5, 0)).toBeNull()
  })
})

describe('solveMonths', () => {
  it('returns 0 when principal already covers the target', () => {
    expect(solveMonths(1000, 1000, 5, 0)).toBe(0)
  })

  it('finds the first month the balance reaches the target', () => {
    const m = solveMonths(2200, 1000, 0, 100)
    expect(m).toBe(12)
  })

  it('reached month is consistent with futureValue', () => {
    const m = solveMonths(50000, 10000, 7, 300) as number
    expect(futureValue(10000, 7, m, 300)).toBeGreaterThanOrEqual(50000)
    expect(futureValue(10000, 7, m - 1, 300)).toBeLessThan(50000)
  })

  it('returns null when unreachable within maxMonths', () => {
    expect(solveMonths(1e12, 0, 0, 1)).toBeNull()
  })
})

describe('solveAnnualRate', () => {
  it('round-trips through futureValue', () => {
    const r = solveAnnualRate(100000, 10000, 300, 120)
    expect(r).not.toBeNull()
    expect(futureValue(10000, r as number, 120, 300)).toBeCloseTo(100000, 1)
  })

  it('returns 0 when contributions alone reach the goal', () => {
    expect(solveAnnualRate(2200, 1000, 100, 12)).toBe(0)
  })

  it('returns null when even 100% annual return cannot reach the goal', () => {
    expect(solveAnnualRate(1e15, 100, 0, 12)).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/savingsGoal.test.ts`
Expected: FAIL — cannot resolve `./savingsGoal`.

- [x] **Step 3: Implement**

Create `src/utils/finance/savingsGoal.ts`:

```ts
// Savings-goal solvers: given three of {target, contribution, time, rate},
// solve for the fourth. Rates are PERCENT, time is in months, monthly
// compounding with end-of-month contributions (see ./compound.ts).
// A null return means the goal is unreachable with the given inputs.

import { futureValue, monthlyRate } from './compound'

export function solveTarget(
  principal: number,
  annualRatePct: number,
  monthlyContribution: number,
  months: number,
): number {
  return futureValue(principal, annualRatePct, months, monthlyContribution)
}

export function solveMonthlyContribution(
  target: number,
  principal: number,
  annualRatePct: number,
  months: number,
): number | null {
  if (months <= 0) return null
  const r = monthlyRate(annualRatePct)
  if (r === 0) return Math.max(0, (target - principal) / months)
  const g = Math.pow(1 + r, months)
  const needed = ((target - principal * g) * r) / (g - 1)
  return Math.max(0, needed)
}

export function solveMonths(
  target: number,
  principal: number,
  annualRatePct: number,
  monthlyContribution: number,
  maxMonths = 1200,
): number | null {
  if (principal >= target) return 0
  const r = monthlyRate(annualRatePct)
  let balance = principal
  for (let m = 1; m <= maxMonths; m++) {
    balance = balance * (1 + r) + monthlyContribution
    if (balance >= target) return m
  }
  return null
}

export function solveAnnualRate(
  target: number,
  principal: number,
  monthlyContribution: number,
  months: number,
): number | null {
  if (months <= 0) return null
  if (futureValue(principal, 0, months, monthlyContribution) >= target) return 0
  const MAX_RATE = 100
  if (futureValue(principal, MAX_RATE, months, monthlyContribution) < target) return null
  let lo = 0
  let hi = MAX_RATE
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (futureValue(principal, mid, months, monthlyContribution) < target) lo = mid
    else hi = mid
  }
  return hi
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/savingsGoal.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/savingsGoal.ts src/utils/finance/savingsGoal.test.ts
git commit -m "feat: savings-goal solvers for any variable (target/contribution/months/rate)"
```

---

### Task 4: Calculator UI primitives (`CalculatorField`, `ResultCard`, `formatMoney`)

**Files:**
- Create: `src/components/planner/CalculatorField.tsx`
- Create: `src/components/planner/ResultCard.tsx`
- Create: `src/components/planner/format.ts`
- Create: `src/components/planner/CalculatorField.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CalculatorField` props `{ label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; prefix?: string; suffix?: string }`; `ResultCard` props `{ label: string; value: string; highlight?: boolean }`; `formatMoney(n: number): string` (rounded, `$` + thousands separators). Used by Tasks 6–7 and all of 4b–4e.

- [x] **Step 1: Write the failing tests**

Create `src/components/planner/CalculatorField.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

describe('CalculatorField', () => {
  it('renders a labelled number input with the current value', () => {
    render(<CalculatorField label="Starting amount" value={5000} onChange={() => {}} />)
    expect(screen.getByLabelText('Starting amount')).toHaveValue(5000)
  })

  it('emits numeric values on change, and 0 for empty input', () => {
    const onChange = vi.fn()
    render(<CalculatorField label="Years" value={10} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Years'), { target: { value: '25' } })
    expect(onChange).toHaveBeenCalledWith(25)
    fireEvent.change(screen.getByLabelText('Years'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(0)
  })
})

describe('ResultCard', () => {
  it('renders label and value', () => {
    render(<ResultCard label="Future value" value="$1,234" />)
    expect(screen.getByText('Future value')).toBeInTheDocument()
    expect(screen.getByText('$1,234')).toBeInTheDocument()
  })
})

describe('formatMoney', () => {
  it('rounds and adds separators', () => {
    expect(formatMoney(1234567.89)).toBe('$1,234,568')
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(-500.4)).toBe('-$500')
  })
})
```

(`vi` is a Vitest global — available without import, same as `describe`/`it`.)

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/planner/CalculatorField.test.tsx`
Expected: FAIL — cannot resolve `./CalculatorField`.

- [x] **Step 3: Implement all three files**

Create `src/components/planner/format.ts`:

```ts
export function formatMoney(n: number): string {
  const rounded = Math.round(n)
  const abs = Math.abs(rounded).toLocaleString('en-CA')
  return `${rounded < 0 ? '-' : ''}$${abs}`
}
```

Create `src/components/planner/CalculatorField.tsx`:

```tsx
import React from 'react'

interface CalculatorFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
}

export const CalculatorField: React.FC<CalculatorFieldProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefix,
  suffix,
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-[13px] font-medium text-text-secondary">{label}</span>
    <div className="flex items-center gap-2 bg-bg-primary/50 border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
      {prefix && <span className="text-[13px] text-text-secondary">{prefix}</span>}
      <input
        type="number"
        className="w-full bg-transparent text-text-primary text-[15px] outline-none"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
      {suffix && <span className="text-[13px] text-text-secondary">{suffix}</span>}
    </div>
  </label>
)
```

Create `src/components/planner/ResultCard.tsx`:

```tsx
import React from 'react'

interface ResultCardProps {
  label: string
  value: string
  highlight?: boolean
}

export const ResultCard: React.FC<ResultCardProps> = ({ label, value, highlight = false }) => (
  <div
    className={`rounded-lg border p-4 ${
      highlight ? 'border-accent bg-accent/10' : 'border-border bg-bg-primary/40'
    }`}
  >
    <p className="text-[12px] uppercase tracking-wide text-text-secondary">{label}</p>
    <p className={`text-[22px] font-semibold mt-1 ${highlight ? 'text-accent' : 'text-text-primary'}`}>
      {value}
    </p>
  </div>
)
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/planner/CalculatorField.test.tsx`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/planner/CalculatorField.tsx src/components/planner/ResultCard.tsx src/components/planner/format.ts src/components/planner/CalculatorField.test.tsx
git commit -m "feat: shared calculator UI primitives (CalculatorField, ResultCard, formatMoney)"
```

---

### Task 5: Planner hub route, tool registry, and Projections rename

**Files:**
- Create: `src/components/planner/toolRegistry.tsx`
- Create: `src/pages/Planner.tsx`
- Create: `src/pages/PlannerTool.tsx`
- Create: `src/pages/Planner.test.tsx`
- Modify: `src/App.tsx` (routes)
- Modify: `src/components/Layout.tsx:17` (nav item)
- Delete: `src/pages/Projections.tsx`

**Interfaces:**
- Consumes: `BentoGrid` from `src/components/dashboard/BentoGrid.tsx`; `ProjectionWidget` from `src/components/investments/ProjectionWidget.tsx` (kept as the interim "forecaster" tool until 4e replaces it).
- Produces: `interface PlannerTool { id: string; name: string; description: string; icon: LucideIcon; component: React.ComponentType }`; `PLANNER_TOOLS: PlannerTool[]`; `getTool(id: string | undefined): PlannerTool | undefined`. Tasks 6–7 and all later sub-plans register calculators by appending to `PLANNER_TOOLS`. Routes: `/planner` (hub), `/planner/:toolId` (tool detail), `/projections` → redirect.

- [x] **Step 1: Write the failing tests**

Create `src/pages/Planner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PLANNER_TOOLS } from '../components/planner/toolRegistry'
import { Planner } from './Planner'
import { PlannerTool } from './PlannerTool'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/planner" element={<Planner />} />
        <Route path="/planner/:toolId" element={<PlannerTool />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Planner hub', () => {
  it('renders the heading and one tile per registered tool', () => {
    renderAt('/planner')
    expect(screen.getByRole('heading', { name: 'Planner' })).toBeInTheDocument()
    for (const tool of PLANNER_TOOLS) {
      expect(screen.getByText(tool.name)).toBeInTheDocument()
    }
  })

  it('tiles link to /planner/:toolId', () => {
    renderAt('/planner')
    const first = PLANNER_TOOLS[0]
    expect(screen.getByRole('link', { name: new RegExp(first.name) })).toHaveAttribute(
      'href',
      `/planner/${first.id}`
    )
  })
})

describe('PlannerTool route', () => {
  it('renders the tool page with a back link', () => {
    renderAt(`/planner/${PLANNER_TOOLS[0].id}`)
    expect(screen.getByRole('heading', { name: PLANNER_TOOLS[0].name })).toBeInTheDocument()
    expect(screen.getByLabelText('Back to Planner')).toHaveAttribute('href', '/planner')
  })

  it('redirects unknown tool ids back to the hub', () => {
    renderAt('/planner/not-a-tool')
    expect(screen.getByRole('heading', { name: 'Planner' })).toBeInTheDocument()
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/Planner.test.tsx`
Expected: FAIL — cannot resolve `../components/planner/toolRegistry` / `./Planner` / `./PlannerTool`.

- [x] **Step 3: Implement registry and pages**

Create `src/components/planner/toolRegistry.tsx`:

```tsx
import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp } from 'lucide-react'
import { ProjectionWidget } from '../investments/ProjectionWidget'

export interface PlannerTool {
  id: string
  name: string
  description: string
  icon: LucideIcon
  component: React.ComponentType
}

// Single source of truth for Planner tools. The hub grid and the
// /planner/:toolId route both read from this list. Later Phase-4 sub-plans
// add calculators by appending entries here.
export const PLANNER_TOOLS: PlannerTool[] = [
  {
    id: 'forecaster',
    name: 'Net-Worth Forecaster',
    description:
      'Project your future net worth from savings and market returns. (Full FIRE forecaster lands in Phase 4e.)',
    icon: TrendingUp,
    component: ProjectionWidget,
  },
]

export function getTool(id: string | undefined): PlannerTool | undefined {
  return PLANNER_TOOLS.find((t) => t.id === id)
}
```

Create `src/pages/Planner.tsx`:

```tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { BentoGrid } from '../components/dashboard/BentoGrid'
import { PLANNER_TOOLS } from '../components/planner/toolRegistry'

export const Planner: React.FC = () => (
  <div className="flex flex-col gap-6 w-full h-full p-6 animate-fade-in">
    <header>
      <h1 className="text-[24px] font-semibold text-text-primary">Planner</h1>
      <p className="text-[14px] text-text-secondary mt-1">
        Financial tools and calculators — every input is saved automatically.
      </p>
    </header>
    <BentoGrid>
      {PLANNER_TOOLS.map((tool) => {
        const Icon = tool.icon
        return (
          <Link
            key={tool.id}
            to={`/planner/${tool.id}`}
            className="themed-card rounded-lg p-4 flex flex-col gap-2 hover:border-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-accent" />
              <h2 className="text-[16px] font-semibold text-text-primary">{tool.name}</h2>
            </div>
            <p className="text-[13px] text-text-secondary">{tool.description}</p>
          </Link>
        )
      })}
    </BentoGrid>
  </div>
)
```

Create `src/pages/PlannerTool.tsx`:

```tsx
import React from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getTool } from '../components/planner/toolRegistry'

export const PlannerTool: React.FC = () => {
  const { toolId } = useParams()
  const tool = getTool(toolId)
  if (!tool) return <Navigate to="/planner" replace />
  const Component = tool.component
  return (
    <div className="flex flex-col gap-6 w-full h-full p-6 animate-fade-in">
      <header className="flex items-center gap-3">
        <Link to="/planner" aria-label="Back to Planner" className="text-text-secondary hover:text-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-[24px] font-semibold text-text-primary">{tool.name}</h1>
      </header>
      <Component />
    </div>
  )
}
```

In `src/App.tsx`: remove the `Projections` import, add imports for `Planner` and `PlannerTool`, add `Navigate` to the `react-router-dom` import, and replace the projections route:

```tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
// ...
import { Planner } from './pages/Planner'
import { PlannerTool } from './pages/PlannerTool'
// (delete: import { Projections } from './pages/Projections')
```

```tsx
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="budget" element={<Budgeting />} />
          <Route path="investments" element={<Investments />} />
          <Route path="planner" element={<Planner />} />
          <Route path="planner/:toolId" element={<PlannerTool />} />
          <Route path="projections" element={<Navigate to="/planner" replace />} />
          <Route path="compensation" element={<Compensation />} />
        </Route>
```

In `src/components/Layout.tsx` line 17, replace the nav entry (keep the already-imported `PieChart` icon — `Calculator` is taken by Compensation):

```tsx
    { name: 'Planner', path: '/planner', icon: PieChart },
```

Delete the old page:

```bash
git rm src/pages/Projections.tsx
```

- [x] **Step 4: Run tests to verify they pass (and nothing else broke)**

Run: `npx vitest run`
Expected: Planner tests PASS; full suite PASS (nothing imported `Projections.tsx` except `App.tsx`).

- [x] **Step 5: Commit**

```bash
git add src/components/planner/toolRegistry.tsx src/pages/Planner.tsx src/pages/PlannerTool.tsx src/pages/Planner.test.tsx src/App.tsx src/components/Layout.tsx
git commit -m "feat: Planner hub replaces Projections — tool registry, Bento tiles, /planner routes"
```

---

### Task 6: Compound Interest calculator

**Files:**
- Create: `src/components/planner/CompoundInterestCalculator.tsx`
- Create: `src/components/planner/CompoundInterestCalculator.test.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `useToolInputs`/`usePlannerStore` (Task 1), `growthSeries`/`futureValue` (Task 2), `CalculatorField`/`ResultCard`/`formatMoney` (Task 4), registry (Task 5). Tool id: `'compound-interest'`.
- Produces: `CompoundInterestCalculator: React.FC` registered as tool `compound-interest`.

- [x] **Step 1: Write the failing tests**

Create `src/components/planner/CompoundInterestCalculator.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { CompoundInterestCalculator } from './CompoundInterestCalculator'

const initialState = usePlannerStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initialState, true)
})

describe('CompoundInterestCalculator', () => {
  it('renders inputs with defaults and the three result cards', () => {
    render(<CompoundInterestCalculator />)
    expect(screen.getByLabelText('Starting amount')).toHaveValue(10000)
    expect(screen.getByLabelText('Monthly contribution')).toHaveValue(500)
    expect(screen.getByLabelText('Annual return')).toHaveValue(7)
    expect(screen.getByLabelText('Years')).toHaveValue(20)
    expect(screen.getByText('Future value')).toBeInTheDocument()
    expect(screen.getByText('Total contributed')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
  })

  it('shows the correct future value for zero-rate inputs', () => {
    render(<CompoundInterestCalculator />)
    fireEvent.change(screen.getByLabelText('Starting amount'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Monthly contribution'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Annual return'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Years'), { target: { value: '1' } })
    // 1000 + 100 * 12 = 2200, appears in both Future value and Total contributed
    expect(screen.getAllByText('$2,200').length).toBeGreaterThanOrEqual(2)
  })

  it('persists edited inputs to the planner store', () => {
    render(<CompoundInterestCalculator />)
    fireEvent.change(screen.getByLabelText('Starting amount'), { target: { value: '20000' } })
    expect(usePlannerStore.getState().inputs['compound-interest'].principal).toBe(20000)
  })

  it('restores saved inputs on remount', () => {
    usePlannerStore.getState().setInput('compound-interest', 'years', 33)
    render(<CompoundInterestCalculator />)
    expect(screen.getByLabelText('Years')).toHaveValue(33)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/planner/CompoundInterestCalculator.test.tsx`
Expected: FAIL — cannot resolve `./CompoundInterestCalculator`.

- [x] **Step 3: Implement the component and register it**

Create `src/components/planner/CompoundInterestCalculator.tsx`:

```tsx
import React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { futureValue, growthSeries } from '../../utils/finance/compound'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'compound-interest'
const DEFAULTS = { principal: 10000, monthlyContribution: 500, annualRatePct: 7, years: 20 }

export const CompoundInterestCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(TOOL_ID, field, v)

  const months = Math.max(1, Math.round(inputs.years * 12))
  const fv = futureValue(inputs.principal, inputs.annualRatePct, months, inputs.monthlyContribution)
  const contributed = inputs.principal + inputs.monthlyContribution * months
  const chartData = growthSeries(inputs.principal, inputs.annualRatePct, inputs.monthlyContribution, months)
    .filter((p) => p.month % 12 === 0)
    .map((p) => ({
      year: p.month / 12,
      contributed: Math.round(p.contributed),
      growth: Math.round(Math.max(0, p.growth)),
    }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CalculatorField label="Starting amount" prefix="$" step={100} value={inputs.principal} onChange={set('principal')} />
        <CalculatorField label="Monthly contribution" prefix="$" step={50} value={inputs.monthlyContribution} onChange={set('monthlyContribution')} />
        <CalculatorField label="Annual return" suffix="%" step={0.1} value={inputs.annualRatePct} onChange={set('annualRatePct')} />
        <CalculatorField label="Years" min={1} max={60} value={inputs.years} onChange={set('years')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Future value" value={formatMoney(fv)} highlight />
        <ResultCard label="Total contributed" value={formatMoney(contributed)} />
        <ResultCard label="Growth" value={formatMoney(fv - contributed)} />
      </div>

      <div className="themed-card rounded-lg p-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={72} />
            <Tooltip
              formatter={(value: number, name: string) => [formatMoney(value), name]}
              contentStyle={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <Area type="monotone" dataKey="contributed" name="Contributed" stackId="1" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.25} />
            <Area type="monotone" dataKey="growth" name="Growth" stackId="1" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

In `src/components/planner/toolRegistry.tsx`, extend the lucide import and append the entry:

```tsx
import { LineChart, TrendingUp } from 'lucide-react'
import { CompoundInterestCalculator } from './CompoundInterestCalculator'
```

```tsx
  {
    id: 'compound-interest',
    name: 'Compound Interest',
    description: 'See how a starting balance and monthly contributions grow over time.',
    icon: LineChart,
    component: CompoundInterestCalculator,
  },
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/planner/CompoundInterestCalculator.test.tsx src/pages/Planner.test.tsx`
Expected: ALL PASS (Planner hub test loops over the registry, so the new tile is covered automatically).

- [x] **Step 5: Commit**

```bash
git add src/components/planner/CompoundInterestCalculator.tsx src/components/planner/CompoundInterestCalculator.test.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: compound interest calculator with stacked contributions-vs-growth chart"
```

---

### Task 7: Savings Goal calculator (solve for any variable)

**Files:**
- Create: `src/components/planner/SavingsGoalCalculator.tsx`
- Create: `src/components/planner/SavingsGoalCalculator.test.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `useToolInputs`/`usePlannerStore` (Task 1), all four solvers from `src/utils/finance/savingsGoal.ts` (Task 3), `CalculatorField`/`ResultCard`/`formatMoney` (Task 4), registry (Task 5). Tool id: `'savings-goal'`.
- Produces: `SavingsGoalCalculator: React.FC` registered as tool `savings-goal`.

- [x] **Step 1: Write the failing tests**

Create `src/components/planner/SavingsGoalCalculator.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { SavingsGoalCalculator } from './SavingsGoalCalculator'

const initialState = usePlannerStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initialState, true)
})

describe('SavingsGoalCalculator', () => {
  it('defaults to solving for the monthly contribution and hides that input', () => {
    render(<SavingsGoalCalculator />)
    expect(screen.getByLabelText('Solve for')).toHaveValue('monthly')
    expect(screen.getByText('Monthly contribution needed')).toBeInTheDocument()
    expect(screen.queryByLabelText('Monthly contribution')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Goal amount')).toBeInTheDocument()
  })

  it('solves months and formats as years + months', () => {
    render(<SavingsGoalCalculator />)
    fireEvent.change(screen.getByLabelText('Solve for'), { target: { value: 'months' } })
    fireEvent.change(screen.getByLabelText('Goal amount'), { target: { value: '2200' } })
    fireEvent.change(screen.getByLabelText('Starting amount'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Annual return'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Monthly contribution'), { target: { value: '100' } })
    // solveMonths(2200, 1000, 0, 100) === 12
    expect(screen.getByText('1y 0m')).toBeInTheDocument()
  })

  it('shows "Not reachable" when the goal cannot be met', () => {
    render(<SavingsGoalCalculator />)
    fireEvent.change(screen.getByLabelText('Solve for'), { target: { value: 'months' } })
    fireEvent.change(screen.getByLabelText('Goal amount'), { target: { value: '999999999999' } })
    fireEvent.change(screen.getByLabelText('Starting amount'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Annual return'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Monthly contribution'), { target: { value: '1' } })
    expect(screen.getByText('Not reachable')).toBeInTheDocument()
  })

  it('persists the solve-for selection', () => {
    render(<SavingsGoalCalculator />)
    fireEvent.change(screen.getByLabelText('Solve for'), { target: { value: 'rate' } })
    expect(usePlannerStore.getState().inputs['savings-goal'].solveFor).toBe('rate')
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/planner/SavingsGoalCalculator.test.tsx`
Expected: FAIL — cannot resolve `./SavingsGoalCalculator`.

- [x] **Step 3: Implement the component and register it**

Create `src/components/planner/SavingsGoalCalculator.tsx`:

```tsx
import React from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import {
  solveAnnualRate,
  solveMonthlyContribution,
  solveMonths,
  solveTarget,
} from '../../utils/finance/savingsGoal'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'savings-goal'
type SolveFor = 'target' | 'monthly' | 'months' | 'rate'
const DEFAULTS = {
  solveFor: 'monthly' as string,
  target: 100000,
  principal: 10000,
  monthlyContribution: 500,
  annualRatePct: 5,
  years: 10,
}

function formatMonths(m: number): string {
  return `${Math.floor(m / 12)}y ${m % 12}m`
}

export const SavingsGoalCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(TOOL_ID, field, v)
  const solveFor = inputs.solveFor as SolveFor

  const months = Math.max(1, Math.round(inputs.years * 12))
  let result: { label: string; value: string }
  switch (solveFor) {
    case 'target': {
      const v = solveTarget(inputs.principal, inputs.annualRatePct, inputs.monthlyContribution, months)
      result = { label: 'Projected balance', value: formatMoney(v) }
      break
    }
    case 'months': {
      const m = solveMonths(inputs.target, inputs.principal, inputs.annualRatePct, inputs.monthlyContribution)
      result = { label: 'Time to goal', value: m === null ? 'Not reachable' : formatMonths(m) }
      break
    }
    case 'rate': {
      const r = solveAnnualRate(inputs.target, inputs.principal, inputs.monthlyContribution, months)
      result = { label: 'Annual return needed', value: r === null ? 'Not reachable' : `${r.toFixed(2)}%` }
      break
    }
    default: {
      const c = solveMonthlyContribution(inputs.target, inputs.principal, inputs.annualRatePct, months)
      result = { label: 'Monthly contribution needed', value: c === null ? 'Not reachable' : formatMoney(c) }
    }
  }

  return (
    <div className="flex flex-col gap-6">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {solveFor !== 'target' && (
          <CalculatorField label="Goal amount" prefix="$" step={1000} value={inputs.target} onChange={set('target')} />
        )}
        <CalculatorField label="Starting amount" prefix="$" step={100} value={inputs.principal} onChange={set('principal')} />
        {solveFor !== 'monthly' && (
          <CalculatorField label="Monthly contribution" prefix="$" step={50} value={inputs.monthlyContribution} onChange={set('monthlyContribution')} />
        )}
        {solveFor !== 'rate' && (
          <CalculatorField label="Annual return" suffix="%" step={0.1} value={inputs.annualRatePct} onChange={set('annualRatePct')} />
        )}
        {solveFor !== 'months' && (
          <CalculatorField label="Years" min={1} max={60} value={inputs.years} onChange={set('years')} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResultCard label={result.label} value={result.value} highlight />
      </div>
    </div>
  )
}
```

In `src/components/planner/toolRegistry.tsx`, extend the lucide import and append the entry:

```tsx
import { LineChart, Target, TrendingUp } from 'lucide-react'
import { SavingsGoalCalculator } from './SavingsGoalCalculator'
```

```tsx
  {
    id: 'savings-goal',
    name: 'Savings Goal',
    description: 'Solve for any variable: contribution, time, required return, or final balance.',
    icon: Target,
    component: SavingsGoalCalculator,
  },
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/planner/SavingsGoalCalculator.test.tsx src/pages/Planner.test.tsx`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/planner/SavingsGoalCalculator.tsx src/components/planner/SavingsGoalCalculator.test.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: savings goal calculator solving for any variable"
```

---

### Task 8: Sub-phase 4a gate — full verification, mobile + 5 themes, PROGRESS.md

**Files:**
- Modify: `docs/superpowers/plans/PROGRESS.md` (mark 4a tasks complete, set next = plan 4b JIT)
- Modify: `docs/superpowers/plans/2026-07-02-phase-4a-hub-and-core-calculators.md` (check off all boxes)

**Interfaces:**
- Consumes: everything above.
- Produces: a verified, committed sub-phase. Do NOT start 4b in this session.

- [x] **Step 1: Run the full automated gate**

```bash
npx vitest run
npm run lint
npm run build
```

Expected: all tests pass, zero lint errors, build succeeds. Fix anything that fails before proceeding (use superpowers:systematic-debugging if a failure is not obvious).

- [x] **Step 2: Manual acceptance — mobile + all 5 themes**

Run: `npm run dev`, open the app, then verify:

1. Nav shows **Planner** (not Projections); `#/projections` redirects to `#/planner`.
2. Hub shows 3 tiles (Net-Worth Forecaster, Compound Interest, Savings Goal); each opens at `#/planner/<id>` with a working back link; an invalid id like `#/planner/nope` bounces to the hub.
3. Compound Interest: edit each field → results and chart update; reload the page → inputs are restored (persistence).
4. Savings Goal: cycle all four "Solve for" modes → the solved field's input disappears, result updates; reload → selection restored.
5. **Themes:** using the sidebar ThemeSelector, cycle all 5 themes (`geometric`, `tactical`, `luxury`, `aurora`, `glass`) on the hub and both calculators — no unreadable text, no hardcoded-looking colors, chart uses theme accent.
6. **Mobile:** at a ~375px-wide viewport (devtools device toolbar), hub tiles stack single-column, calculator fields wrap to 2 columns, chart stays inside its card, no horizontal scroll.

Record any failures, fix, and re-run the relevant step.

- [x] **Step 3: Update PROGRESS.md**

In `docs/superpowers/plans/PROGRESS.md`: record Phase 4 in progress, sub-plan 4a complete (Tasks 1–8), last commit hash, and next action: "Plan Phase 4b JIT from the umbrella `2026-07-02-phase-4-planner.md` stub, then execute it."

- [x] **Step 4: Commit the gate**

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-4a-hub-and-core-calculators.md
git commit -m "chore: complete Phase 4a — Planner hub + core calculators verified (tests/lint/build/mobile/5 themes)"
```
