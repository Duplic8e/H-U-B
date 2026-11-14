# UI Polish & Planner Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix spacing/alignment across planner tools, unify popup/dropdown theming with blur backdrops and custom themed inputs, add RRSP/FHSA deductions and mortgage extra payments, rebuild the Investments plan-vs-actual view with swap simulation, and run a UX consistency pass.

**Architecture:** React 19 + Vite + Tailwind v4 SPA. State in zustand stores with `persist` + versioned migrations. Financial math lives in pure functions under `src/utils/finance` and `src/utils/investments`, tested with vitest. New shared UI primitives go in `src/components/ui/`. Spec: `docs/superpowers/specs/2026-07-05-ui-polish-and-planner-enhancements-design.md`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (theme via CSS variables `--color-accent`, classes like `text-text-primary`, `bg-bg-primary`, `border-border`, `themed-card`), zustand, recharts, lucide-react, vitest + @testing-library/react.

## Global Constraints

- Run tests with `npx vitest run <path>` (script `npm test` starts watch mode; never use it in automation).
- Theme colors ONLY via theme classes/variables (`text-text-primary`, `text-text-secondary`, `bg-bg-primary`, `bg-bg-secondary`, `border-border`, `text-accent`, `bg-accent`, `text-error`). Never hard-code `text-gray-*`, `bg-white`, `text-red-500` in new/modified code.
- No em dashes in any user-facing string (labels, descriptions, captions). Use periods, commas, or colons.
- Every click-opened popup/dropdown/popover uses the shared `OverlayBackdrop` (blur backdrop). Hover tooltips are exempt.
- All new user-facing money values go through `formatMoney` from `src/components/planner/format.ts`.
- Commit after every task. Do not commit `.claude/settings.local.json` or `.planning/`/`.superpowers/` files.
- After UI tasks, verify in browser preview (dev server via preview_start, config name `dev` on port 5173) across at least Luxury Dark and Geometric Light themes.

---

## Phase 1: Foundations

### Task 1: OverlayBackdrop component + ToolSwitcher blur (W5)

**Files:**
- Create: `src/components/ui/OverlayBackdrop.tsx`
- Modify: `src/components/planner/ToolSwitcher.tsx`
- Test: `src/components/ui/OverlayBackdrop.test.tsx`

**Interfaces:**
- Produces: `OverlayBackdrop: React.FC<{ onClose: () => void; className?: string }>` — a `fixed inset-0` blurred backdrop rendered as a sibling BEHIND anchored popups (z-20; popup content must use z-30+). Tasks 2, 4, 16 consume it.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/OverlayBackdrop.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { OverlayBackdrop } from './OverlayBackdrop'

describe('OverlayBackdrop', () => {
  it('renders a blurred backdrop and calls onClose when clicked', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<OverlayBackdrop onClose={onClose} />)
    const el = getByTestId('overlay-backdrop')
    expect(el.className).toContain('backdrop-blur-md')
    expect(el.className).toContain('bg-black/50')
    fireEvent.click(el)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/OverlayBackdrop.test.tsx`
Expected: FAIL (cannot resolve `./OverlayBackdrop`)

- [ ] **Step 3: Write the component**

```tsx
// src/components/ui/OverlayBackdrop.tsx
import React from 'react'

interface OverlayBackdropProps {
  onClose: () => void
  className?: string
}

/** Shared backdrop for click-opened popups and dropdowns. Matches the
 *  CompensationModal overlay treatment (bg-black/50 + backdrop-blur-md).
 *  Render as a sibling BEFORE the popup panel; panel needs z-30 or higher. */
export const OverlayBackdrop: React.FC<OverlayBackdropProps> = ({ onClose, className = '' }) => (
  <div
    data-testid="overlay-backdrop"
    className={`fixed inset-0 z-20 bg-black/50 backdrop-blur-md animate-fade-in ${className}`}
    onClick={onClose}
    aria-hidden="true"
  />
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/OverlayBackdrop.test.tsx`
Expected: PASS

- [ ] **Step 5: Adopt in ToolSwitcher**

In `src/components/planner/ToolSwitcher.tsx`, import it and wrap the open menu. Replace the `{open && ( <div role="menu" ...> ... </div> )}` block with:

```tsx
{open && (
  <>
    <OverlayBackdrop onClose={() => setOpen(false)} />
    <div
      role="menu"
      className="absolute left-0 top-full mt-2 z-30 w-72 max-h-[70vh] overflow-y-auto themed-card border border-border rounded-lg shadow-xl p-2 flex flex-col gap-1"
    >
      {/* existing group/tool mapping stays unchanged */}
    </div>
  </>
)}
```

Add `import { OverlayBackdrop } from '../ui/OverlayBackdrop'`. The existing window `pointerdown` listener stays (it also handles Escape); the backdrop click closes via `onClose`. Note the trigger button sits BELOW the backdrop; that is fine because clicking anywhere outside the menu should close it.

- [ ] **Step 6: Verify in preview**

Start dev server, navigate to `/planner/mortgage`, click the tool-title dropdown. Expected: background blurs (like the compensation edit-package modal), menu is sharp, clicking the blurred area closes.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/OverlayBackdrop.tsx src/components/ui/OverlayBackdrop.test.tsx src/components/planner/ToolSwitcher.tsx
git commit -m "feat: shared OverlayBackdrop with blur, adopted by planner ToolSwitcher"
```

### Task 2: ThemedSelect component (W8)

**Files:**
- Create: `src/components/ui/ThemedSelect.tsx`
- Test: `src/components/ui/ThemedSelect.test.tsx`

**Interfaces:**
- Consumes: `OverlayBackdrop` from Task 1.
- Produces:
  ```ts
  export interface ThemedSelectOption { value: string; label: string }
  export const ThemedSelect: React.FC<{
    id?: string
    value: string
    options: ThemedSelectOption[]
    onChange: (value: string) => void
    className?: string   // applied to the trigger button
  }>
  ```
  Tasks 3, 13, 22, 26 consume it.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/ThemedSelect.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemedSelect } from './ThemedSelect'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

describe('ThemedSelect', () => {
  it('shows the selected label and opens a listbox on click', () => {
    render(<ThemedSelect value="a" options={options} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('selects an option on click and closes', () => {
    const onChange = vi.fn()
    render(<ThemedSelect value="a" options={options} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('supports keyboard: ArrowDown moves highlight, Enter selects, Escape closes', () => {
    const onChange = vi.fn()
    render(<ThemedSelect value="a" options={options} onChange={onChange} />)
    const trigger = screen.getByRole('button', { name: /alpha/i })
    fireEvent.keyDown(trigger, { key: 'Enter' })       // open
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })   // highlight Beta
    fireEvent.keyDown(trigger, { key: 'Enter' })       // select
    expect(onChange).toHaveBeenCalledWith('b')
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/ThemedSelect.test.tsx`
Expected: FAIL (cannot resolve `./ThemedSelect`)

- [ ] **Step 3: Write the component**

```tsx
// src/components/ui/ThemedSelect.tsx
import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { OverlayBackdrop } from './OverlayBackdrop'

export interface ThemedSelectOption {
  value: string
  label: string
}

interface ThemedSelectProps {
  id?: string
  value: string
  options: ThemedSelectOption[]
  onChange: (value: string) => void
  className?: string
}

/** Theme-aware replacement for native <select>. Styled like the planner
 *  ToolSwitcher menu: themed card, accent highlight, blur backdrop. */
export const ThemedSelect: React.FC<ThemedSelectProps> = ({ id, value, options, onChange, className = '' }) => {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (open) setHighlight(Math.max(0, options.findIndex((o) => o.value === value)))
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const commit = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); setOpen(true); return
    }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); commit(options[highlight].value) }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={`w-full flex items-center justify-between gap-2 bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent transition-colors ${className}`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <OverlayBackdrop onClose={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto themed-card border border-border rounded-lg shadow-xl p-1 flex flex-col"
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => commit(o.value)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-[14px] transition-colors ${
                  i === highlight ? 'bg-accent/10 text-accent' : 'text-text-primary'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/ThemedSelect.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ThemedSelect.tsx src/components/ui/ThemedSelect.test.tsx
git commit -m "feat: ThemedSelect listbox component with blur backdrop and keyboard nav"
```

### Task 3: Replace all native selects with ThemedSelect (W8)

**Files:**
- Modify: `src/components/planner/SelectField.tsx` (rewrite internals; API changes from `children` to `options`)
- Modify: every `SelectField` call site and every raw `<select`. Find them:
  `grep -rn "<select" src/ --include=*.tsx` and `grep -rn "SelectField" src/ --include=*.tsx`
  Known call sites: `src/components/planner/SalaryTaxTool.tsx` (Province), `src/components/planner/DebtPayoffCalculator.tsx` (Strategy), `src/components/planner/SavingsGoalCalculator.tsx` (Solve for), `src/components/budget/CategoryManagerWidget.tsx` (Paradigm), plus any in `CompensationModal.tsx`, `TransactionModal.tsx`, `AnalysisModal.tsx`, `CSVUploader.tsx`.

**Interfaces:**
- Consumes: `ThemedSelect`, `ThemedSelectOption` from Task 2.
- Produces: `SelectField: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: ThemedSelectOption[] }>` — the labeled wrapper planner tools use.

- [ ] **Step 1: Rewrite SelectField on top of ThemedSelect**

```tsx
// src/components/planner/SelectField.tsx (full replacement)
import React from 'react'
import { ThemedSelect, type ThemedSelectOption } from '../ui/ThemedSelect'

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: ThemedSelectOption[]
}

/** Dropdown twin of CalculatorField: identical label markup and control height
 *  so inputs and selects bottom-align in shared grid rows. */
export const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, options }) => {
  const selectId = `select-field-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={selectId} className="text-[13px] font-medium text-text-secondary block mb-1">
        {label}
      </label>
      <ThemedSelect id={selectId} value={value} options={options} onChange={onChange} />
    </div>
  )
}
```

- [ ] **Step 2: Update SelectField call sites to the options API**

Example, `SalaryTaxTool.tsx` Province select becomes:

```tsx
<SelectField
  label="Province"
  value={province}
  onChange={(v) => setInput(TOOL_ID, 'province', v)}
  options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
/>
```

Apply the same `<option>`-children-to-`options`-array conversion at every SelectField call site found by the grep.

- [ ] **Step 3: Replace raw `<select>` elements**

For each raw `<select>` (e.g. CategoryManagerWidget paradigm picker, modals), replace with `ThemedSelect` directly, converting its `<option>` list to an `options` array and keeping the surrounding label markup. Example (CategoryManagerWidget):

```tsx
<ThemedSelect
  value={paradigm}
  onChange={(v) => setParadigm(v as typeof paradigm)}
  className="min-w-[180px]"
  options={[
    { value: 'Ledger Custom', label: 'Ledger Custom' },
    { value: 'Zero-Based', label: 'Zero-Based' },
    { value: 'Envelope', label: 'Envelope System' },
    { value: '50/30/20', label: '50/30/20 Rule' },
  ]}
/>
```

- [ ] **Step 4: Verify no native selects remain and tests pass**

Run: `grep -rn "<select" src/ --include=*.tsx` → Expected: no matches.
Run: `npx vitest run` → Expected: all tests pass (fix any test that queried a native select by role `combobox`: ThemedSelect's trigger is role `button`).
Run: `npm run build` → Expected: no TypeScript errors.

- [ ] **Step 5: Verify in preview**

Check Salary & Tax province, Debt Payoff strategy, Savings Goal solve-for, Budget Setup paradigm. Each opens a themed list with blur backdrop on all themes.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "feat: replace all native selects with ThemedSelect"
```

### Task 4: ThemedDatePicker component and adoption (W8)

**Files:**
- Create: `src/components/ui/ThemedDatePicker.tsx`
- Test: `src/components/ui/ThemedDatePicker.test.tsx`
- Modify: every `<input type="date">`. Find: `grep -rn 'type="date"' src/ --include=*.tsx` (expect hits in `CompensationModal.tsx`, `TransactionModal.tsx`, `AnalysisModal.tsx`, possibly `CurrencyConverter.tsx`).

**Interfaces:**
- Consumes: `OverlayBackdrop` from Task 1.
- Produces: `ThemedDatePicker: React.FC<{ id?: string; value: string; onChange: (v: string) => void; className?: string }>` — `value` is `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/ThemedDatePicker.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemedDatePicker } from './ThemedDatePicker'

describe('ThemedDatePicker', () => {
  it('shows the value and opens a calendar grid', () => {
    render(<ThemedDatePicker value="2026-07-05" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /2026-07-05/ }))
    expect(screen.getByRole('grid')).toBeTruthy()
    expect(screen.getByText('July 2026')).toBeTruthy()
  })

  it('selects a day and emits YYYY-MM-DD', () => {
    const onChange = vi.fn()
    render(<ThemedDatePicker value="2026-07-05" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /2026-07-05/ }))
    fireEvent.click(screen.getByRole('gridcell', { name: '14' }))
    expect(onChange).toHaveBeenCalledWith('2026-07-14')
  })

  it('navigates months', () => {
    render(<ThemedDatePicker value="2026-07-05" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /2026-07-05/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('June 2026')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/ThemedDatePicker.test.tsx`
Expected: FAIL (cannot resolve `./ThemedDatePicker`)

- [ ] **Step 3: Write the component**

```tsx
// src/components/ui/ThemedDatePicker.tsx
import React, { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { OverlayBackdrop } from './OverlayBackdrop'

interface ThemedDatePickerProps {
  id?: string
  value: string // YYYY-MM-DD ('' allowed)
  onChange: (value: string) => void
  className?: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const pad = (n: number) => String(n).padStart(2, '0')

/** Theme-aware replacement for <input type="date">: themed month-grid
 *  calendar popover with blur backdrop. */
export const ThemedDatePicker: React.FC<ThemedDatePickerProps> = ({ id, value, onChange, className = '' }) => {
  const [open, setOpen] = useState(false)
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10)
  const [viewYear, setViewYear] = useState(Number(initial.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(Number(initial.slice(5, 7)) - 1) // 0-based

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const pick = (day: number) => {
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent transition-colors ${className}`}
      >
        <span>{value || 'Select date'}</span>
        <Calendar className="w-4 h-4 shrink-0 text-text-secondary" />
      </button>
      {open && (
        <>
          <OverlayBackdrop onClose={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 w-64 themed-card border border-border rounded-lg shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-bg-primary/50 text-text-secondary hover:text-accent">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[14px] font-medium text-text-primary">{MONTHS[viewMonth]} {viewYear}</span>
              <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-bg-primary/50 text-text-secondary hover:text-accent">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div role="grid" className="grid grid-cols-7 gap-0.5 text-center">
              {DOW.map((d) => (
                <span key={d} className="text-[11px] text-text-secondary py-1">{d}</span>
              ))}
              {Array.from({ length: firstDow }, (_, i) => <span key={`pad-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                const isSelected = iso === value
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    onClick={() => pick(day)}
                    className={`text-[13px] rounded py-1 transition-colors ${
                      isSelected ? 'bg-accent/20 text-accent font-semibold' : 'text-text-primary hover:bg-bg-primary/50'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/ThemedDatePicker.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Swap all native date inputs**

For each `type="date"` hit from the grep, replace the `<input>` with `<ThemedDatePicker value={...} onChange={...} />`, keeping the surrounding label. Example (TransactionModal):

```tsx
// before
<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="..." />
// after
<ThemedDatePicker value={date} onChange={setDate} />
```

Run: `grep -rn 'type="date"' src/ --include=*.tsx` → Expected: no matches.
Run: `npx vitest run` and `npm run build` → Expected: pass. Fix any test that used `fireEvent.change` on a date input (drive `ThemedDatePicker` by clicking the trigger then a gridcell instead).

- [ ] **Step 6: Verify in preview**

Compensation "Edit package" modal dates and Add Transaction date open a themed calendar with blur, matching the current theme.

- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "feat: ThemedDatePicker replaces native date inputs"
```

### Task 5: CalculatorField suffix fix + Stat/EmptyState/Skeleton primitives (W0, W11 groundwork)

**Files:**
- Modify: `src/components/planner/CalculatorField.tsx:31,42`
- Create: `src/components/ui/Stat.tsx`, `src/components/ui/EmptyState.tsx`, `src/components/ui/Skeleton.tsx`
- Test: `src/components/planner/CalculatorField.test.tsx` (extend), `src/components/ui/Stat.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  Stat: React.FC<{ label: string; value: string; tone?: 'default' | 'accent' | 'error'; sub?: string }>
  EmptyState: React.FC<{ icon?: LucideIcon; message: string; hint?: string; action?: { label: string; onClick: () => void } }>
  Skeleton: React.FC<{ className?: string }>  // pulse block, pass sizing classes
  ```

- [ ] **Step 1: Extend CalculatorField test**

Add to `src/components/planner/CalculatorField.test.tsx`:

```tsx
it('renders suffix without wrapping', () => {
  render(<CalculatorField label="Scenario spread" suffix="± %" value={2} onChange={() => {}} />)
  const suffix = screen.getByText('± %')
  expect(suffix.className).toContain('whitespace-nowrap')
  expect(suffix.className).toContain('shrink-0')
})
```

Run: `npx vitest run src/components/planner/CalculatorField.test.tsx` → Expected: new test FAILS.

- [ ] **Step 2: Fix prefix/suffix spans**

In `CalculatorField.tsx` change both spans:

```tsx
{prefix && <span className="text-[13px] text-text-secondary whitespace-nowrap shrink-0">{prefix}</span>}
...
{suffix && <span className="text-[13px] text-text-secondary whitespace-nowrap shrink-0">{suffix}</span>}
```

Run: `npx vitest run src/components/planner/CalculatorField.test.tsx` → Expected: PASS.

- [ ] **Step 3: Create the three primitives with a Stat test**

```tsx
// src/components/ui/Stat.tsx
import React from 'react'

interface StatProps {
  label: string
  value: string
  tone?: 'default' | 'accent' | 'error'
  sub?: string
}

/** Standard big-number display: uppercase label, 22px value, optional subtext. */
export const Stat: React.FC<StatProps> = ({ label, value, tone = 'default', sub }) => {
  const toneClass = tone === 'accent' ? 'text-accent' : tone === 'error' ? 'text-error' : 'text-text-primary'
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[12px] uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`text-[22px] font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="text-[12px] text-text-secondary">{sub}</p>}
    </div>
  )
}
```

```tsx
// src/components/ui/EmptyState.tsx
import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  message: string
  hint?: string
  action?: { label: string; onClick: () => void }
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, message, hint, action }) => (
  <div className="flex flex-col items-center gap-2 py-8 text-center">
    {Icon && <Icon className="w-6 h-6 text-text-secondary" />}
    <p className="text-[15px] font-medium text-text-primary">{message}</p>
    {hint && <p className="text-[13px] text-text-secondary">{hint}</p>}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-1 px-3 py-1.5 rounded-md text-[13px] font-medium border border-accent text-accent bg-accent/10 hover:opacity-90 transition-opacity"
      >
        {action.label}
      </button>
    )}
  </div>
)
```

```tsx
// src/components/ui/Skeleton.tsx
import React from 'react'

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded bg-bg-primary/60 ${className}`} />
)
```

```tsx
// src/components/ui/Stat.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stat } from './Stat'

describe('Stat', () => {
  it('renders label, value and tone class', () => {
    render(<Stat label="Total fund" value="$27,000" tone="accent" />)
    expect(screen.getByText('Total fund')).toBeTruthy()
    expect(screen.getByText('$27,000').className).toContain('text-accent')
  })
})
```

- [ ] **Step 4: Run and commit**

Run: `npx vitest run src/components/ui src/components/planner/CalculatorField.test.tsx` → Expected: PASS.

```bash
git add src/components/ui src/components/planner/CalculatorField.tsx src/components/planner/CalculatorField.test.tsx
git commit -m "feat: Stat/EmptyState/Skeleton primitives; fix CalculatorField suffix wrap"
```

---

## Phase 2: Spacing & Alignment Debug Pass (W0)

### Task 6: Planner hub stretch grid

**Files:**
- Modify: `src/pages/Planner.tsx:20-37`

- [ ] **Step 1: Replace BentoGrid with a stretch grid per group**

In `Planner.tsx`, replace the `<BentoGrid>` wrapper (and its import) with a grid that fills the row regardless of tool count:

```tsx
<div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
  {tools.map((tool) => { /* existing Link card unchanged */ })}
</div>
```

Then, to eliminate the circled voids for 1-2 tool groups, add spans on the Link based on the group size:

```tsx
const span =
  tools.length === 1 ? 'md:col-span-2 xl:col-span-3'
  : tools.length === 2 ? 'xl:col-span-1 md:col-span-1' : ''
```

and for 2-tool groups change the group's grid to `md:grid-cols-2 xl:grid-cols-2` so two cards split the full width. Concretely: compute the grid class per group:

```tsx
const gridCols =
  tools.length === 1 ? 'grid-cols-1'
  : tools.length === 2 ? 'grid-cols-1 md:grid-cols-2'
  : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
return (
  <section key={group} className="flex flex-col gap-3">
    <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{group}</h2>
    <div className={`grid gap-6 ${gridCols}`}>
      {tools.map((tool) => ( /* existing Link card, no span classes */ ))}
    </div>
  </section>
)
```

Remove the now-unused `BentoGrid` import. Update `src/pages/Planner.test.tsx` if it asserts on BentoGrid markup.

- [ ] **Step 2: Verify in preview**

`/planner`: no group leaves a void; Forecasting & Growth (2 tools) shows two half-width cards; Utilities (1 tool) full width. Screenshot for the record.

- [ ] **Step 3: Run tests and commit**

Run: `npx vitest run src/pages/Planner.test.tsx` → Expected: PASS.

```bash
git add src/pages/Planner.tsx src/pages/Planner.test.tsx
git commit -m "fix: planner hub cards stretch to fill each group row"
```

### Task 7: Tool input-grid normalization (Forecaster, Savings Goal, Salary & Tax, Debt Payoff)

**Files:**
- Modify: `src/components/planner/forecaster/ForecasterTool.tsx` (read first; normalize header input rows)
- Modify: `src/components/planner/SavingsGoalCalculator.tsx`
- Modify: `src/components/planner/SalaryTaxTool.tsx:92`
- Modify: `src/components/planner/DebtPayoffCalculator.tsx`

The shared convention (apply to each file): an inputs row is
`<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-N gap-4 items-end">` where **N equals the number of fields in that row**, so fields always fill the full width with no dead columns.

- [ ] **Step 1: Salary & Tax inputs row**

`SalaryTaxTool.tsx` line 92: the row has 2 fields but 4 columns. Change:

```tsx
// before
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
// after
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
```

(After Task 17 adds RRSP/FHSA fields this row becomes 4 fields; it is updated there.)

- [ ] **Step 2: Savings Goal**

Read `SavingsGoalCalculator.tsx`. Restructure so the "Solve for" select and the value fields share one grid row sized to the actual field count (per screenshot 3 the select sits alone at ~1/4 width while inputs live in a detached 4-col row). Target: one row, N columns for N visible fields, `items-end` so the select bottom-aligns with inputs. The result card row keeps `grid-cols-1 md:grid-cols-3` but the projected-balance card must span the full grid if it is the only card: `className="md:col-span-3"` on the lone ResultCard wrapper (or render it full-width).

- [ ] **Step 3: Debt Payoff rows**

Read `DebtPayoffCalculator.tsx`. Each debt row (Name/Balance/APR/Min payment/delete) must be one grid: `grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end`, with the delete button in the `auto` column aligned to the control height (`self-end pb-2`). This removes the circled void between "Min payment" and the trash icon. The "Extra monthly payment" + "Strategy" row becomes `grid grid-cols-1 sm:grid-cols-2 gap-4 items-end`.

- [ ] **Step 4: Forecaster header rows**

Read `forecaster/ForecasterTool.tsx` (and `useForecasterSettings.ts` for field list). Normalize the two header rows:
- Row 1 (Starting balance / Monthly savings / Comp events toggle) and Row 2 (Years / Return / Inflation / Contribution step-up / Scenario spread) each get a grid with N columns matching the field count (`md:grid-cols-3` and `md:grid-cols-5` respectively, `gap-4 items-end`).
- The Scenario spread field must be a standard `CalculatorField` with `suffix="± %"` (wrap fix from Task 5 prevents the vertical stack).

- [ ] **Step 5: Verify each tool in preview**

Visit `/planner/forecaster`, `/planner/savings-goal`, `/planner/salary-tax`, `/planner/debt-payoff` at 1440px and ~900px widths. Expected: no circled-style dead zones; suffixes on one line; delete buttons flush with rows. Screenshot each.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run src/components/planner` → Expected: PASS.

```bash
git add src/components/planner
git commit -m "fix: normalize planner tool input grids, remove dead space"
```

---

## Phase 3: Small Fixes

### Task 8: ThemeSelector visibility on all themes (W1)

**Files:**
- Modify: `src/components/theme/ThemeSelector.tsx:19-52`

- [ ] **Step 1: Replace hard-coded colors with theme variables**

The active pill uses `bg-white dark:bg-white/10` and icon `text-gray-900 dark:text-white`; on Geometric Light the white icon/pill vanishes. Replace the button and icon classes:

```tsx
<button
  key={t}
  onClick={() => setTheme(t)}
  className={`relative group flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
    isActive ? 'bg-accent/15 ring-1 ring-accent shadow-sm' : 'hover:bg-bg-primary/60'
  }`}
  aria-label={config.name}
  title={config.name}
>
  <div className={`transition-colors duration-300 ${
    isActive ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'
  }`}>
    {config.icon}
  </div>
  ...
```

Also change the container `bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/10` to `bg-bg-secondary/70 border-border`, and the tooltip `bg-gray-900 dark:bg-black text-white ... border-white/10` to `bg-bg-secondary text-text-primary border border-border shadow-xl`.

- [ ] **Step 2: Verify on all five themes**

In preview, cycle Geometric Light, Tactical Dark, Luxury Dark, Aurora, Glassmorphism. The active pill (accent ring + accent icon) is clearly visible on every theme, especially Geometric Light. Screenshot Geometric Light.

- [ ] **Step 3: Commit**

```bash
git add src/components/theme/ThemeSelector.tsx
git commit -m "fix: theme selector active state visible on light themes"
```

### Task 9: Remove Compensation widget from Dashboard (W2)

**Files:**
- Modify: `src/pages/Dashboard.tsx:33,66`
- Delete: `src/components/dashboard/widgets/CompSnapshotWidget.tsx` (only if the grep below shows no other consumer)

- [ ] **Step 1: Remove the widget**

In `Dashboard.tsx`: delete the `'comp',` line from `DASHBOARD_WIDGET_IDS`, delete the `{ id: 'comp', element: <CompSnapshotWidget /> },` entry, and remove the `CompSnapshotWidget` import. Stored layout orders filter unknown ids (`storedOrder.filter((id) => defaultIds.includes(id))`), so persisted layouts survive.

- [ ] **Step 2: Delete the orphan**

Run: `grep -rn "CompSnapshotWidget" src/` → if only its own file (and its test, if one exists) matches, delete those files.

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run` and `npm run build` → PASS. Preview `/`: no compensation card; drag-reorder still works.

```bash
git add -A src/
git commit -m "feat: remove compensation snapshot from dashboard"
```

### Task 10: Budgeting layout swap + collapsible Budget Setup (W4)

**Files:**
- Modify: `src/pages/Budgeting.tsx:91-96`
- Modify: `src/components/budget/CategoryManagerWidget.tsx:64-86`
- Modify: `src/store/useBudgetStore.ts` (add `budgetSetupCollapsed` flag; read the store first to follow its persist/migration pattern)

- [ ] **Step 1: Swap Sankey and BudgetProgress**

In `Budgeting.tsx`, reorder the 2-col grid children so Budget vs Actual takes Income Flow's slot and vice versa:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <BudgetProgressWidget selectedMonth={selectedMonth} />
  <SpendingHeatmapWidget selectedMonth={selectedMonth} />
  <CategoryTrendsWidget selectedMonth={selectedMonth} />
  <SankeyWidget selectedMonth={selectedMonth} />
</div>
```

- [ ] **Step 2: Add persisted collapse state**

In `useBudgetStore.ts` add to the state interface and store: `budgetSetupCollapsed: boolean` (default `true`) and `toggleBudgetSetup: () => void` implemented as `set((s) => ({ budgetSetupCollapsed: !s.budgetSetupCollapsed }))`. Follow the store's existing persist config; if it has a `version`, bump it and let the migration default the new flag (spread-with-default also works since `undefined` is falsy only if default false; we want default TRUE, so migration must set it explicitly for old snapshots: `budgetSetupCollapsed: persisted.budgetSetupCollapsed ?? true`).

- [ ] **Step 3: Make the widget collapsible**

In `CategoryManagerWidget.tsx`, wrap the header in a toggle and hide the body when collapsed:

```tsx
const budgetSetupCollapsed = useBudgetStore((s) => s.budgetSetupCollapsed)
const toggleBudgetSetup = useBudgetStore((s) => s.toggleBudgetSetup)
...
<div className="flex justify-between items-center border-b border-border pb-4 mb-0">
  <button type="button" onClick={toggleBudgetSetup} aria-expanded={!budgetSetupCollapsed} className="flex items-center gap-2 text-left">
    {budgetSetupCollapsed ? <ChevronRight size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
    <div>
      <h2 className="text-[18px] font-semibold text-text-primary">Budget Setup</h2>
      <p className="text-[14px] text-text-secondary mt-1">Configure your budgeting style and monthly targets.</p>
    </div>
  </button>
  {!budgetSetupCollapsed && ( /* existing paradigm ThemedSelect */ )}
</div>
{!budgetSetupCollapsed && (
  <div className="columns-1 md:columns-2 gap-6 mt-6">
    {/* existing groups body unchanged */}
  </div>
)}
```

(`ChevronDown`/`ChevronRight` are already imported in this file.)

- [ ] **Step 4: Verify + commit**

Preview `/budgeting`: Budget vs Actual sits where Income Flow was; Budget Setup renders collapsed with just its header; toggling persists across reload.

```bash
git add src/pages/Budgeting.tsx src/components/budget/CategoryManagerWidget.tsx src/store/useBudgetStore.ts
git commit -m "feat: swap budget-vs-actual with income flow; collapsible persistent Budget Setup"
```

### Task 11: Budget widget consistency: labels + Projected Net merge (W10)

**Files:**
- Modify: `src/components/budget/IncomeWidget.tsx:20-23`
- Modify: `src/components/budget/MonthlySummaryWidget.tsx`
- Modify: `src/pages/Budgeting.tsx` (remove CashFlowForecastWidget usage; move `SubscriptionsWidget`/`AnomalyAlertsWidget` row to `md:grid-cols-2`)
- Delete: `src/components/budget/CashFlowForecastWidget.tsx` (keep `src/utils/budget/cashFlowForecast.ts` and `src/utils/budget/recurring.ts`)
- Test: extend `MonthlySummaryWidget` test if present; otherwise create `src/components/budget/MonthlySummaryWidget.test.tsx`

- [ ] **Step 1: Match the "This month" style in IncomeWidget**

Replace the stacked layout with the Expense baseline style:

```tsx
<div className="flex items-baseline gap-2 mt-4">
  <span className="text-[28px] font-bold text-accent">${totalIncome.toFixed(2)}</span>
  <span className="text-[12px] text-text-secondary">This month</span>
</div>
```

- [ ] **Step 2: Write failing test for Projected Net**

```tsx
// src/components/budget/MonthlySummaryWidget.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonthlySummaryWidget } from './MonthlySummaryWidget'

describe('MonthlySummaryWidget', () => {
  it('shows a Projected Net row matching the summary row style', () => {
    render(<MonthlySummaryWidget selectedMonth={new Date().toISOString().slice(0, 7)} />)
    expect(screen.getByText('Projected Net')).toBeTruthy()
  })
})
```

Run: `npx vitest run src/components/budget/MonthlySummaryWidget.test.tsx` → FAIL.

- [ ] **Step 3: Add the Projected Net row**

In `MonthlySummaryWidget.tsx`, import and compute the forecast, then render a row styled like Money In / Money Out (same `flex justify-between items-center text-sm` shape) between the top block and Net Change:

```tsx
import { detectRecurring } from '../../utils/budget/recurring'
import { forecastMonthEnd } from '../../utils/budget/cashFlowForecast'
...
const today = new Date().toISOString().slice(0, 10)
const forecast = forecastMonthEnd(transactionsList, detectRecurring(transactionsList), selectedMonth, today)
const pendingSummary = forecast.pending
  .slice(0, 5)
  .map((p) => `${p.expectedDate}: ${p.type === 'income' ? '+' : '-'}$${p.amount.toFixed(2)} ${p.description}`)
  .join('\n')
...
<div className="flex justify-between items-center text-sm mb-3" title={pendingSummary || 'No pending recurring items detected'}>
  <div className="flex items-center gap-2">
    <div className="w-2 h-2 rounded-full bg-accent/50"></div>
    <span className="text-text-secondary">Projected Net</span>
  </div>
  <span className={`font-medium ${forecast.projectedNet >= 0 ? 'text-text-primary' : 'text-error'}`}>
    {forecast.projectedNet >= 0 ? '+' : '-'}${Math.abs(forecast.projectedNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </span>
</div>
```

Check `forecastMonthEnd`'s first parameter type in `src/utils/budget/cashFlowForecast.ts` before wiring (the old widget passed the transactions record straight through; mirror whatever it does).

- [ ] **Step 4: Remove the standalone widget**

Delete `CashFlowForecastWidget.tsx`, remove its import/usage from `Budgeting.tsx`, and change that row to `grid-cols-1 md:grid-cols-2` so Subscriptions + Anomaly Alerts fill it. Run `grep -rn "CashFlowForecastWidget" src/` → no matches.

- [ ] **Step 5: Run, verify, commit**

Run: `npx vitest run` → PASS. Preview: Income/Expense labels match; Monthly Summary shows Money In, Money Out, Projected Net, Net Change.

```bash
git add -A src/
git commit -m "feat: merge month-end forecast into Monthly Summary as Projected Net; align widget labels"
```

### Task 12: Em-dash copy pass (W11.4)

**Files:**
- Modify: all `.tsx`/`.ts` files with em dashes in user-facing strings.

- [ ] **Step 1: Find and reword**

Run: `grep -rn "—" src/ --include=*.tsx --include=*.ts | grep -v ".test."`
For each hit in a user-facing string (descriptions in `toolRegistry.tsx`, page subtitles, captions, empty states), reword without the em dash. Examples:
- `'Your history projected forward — scenarios, FIRE date, goals, Monte Carlo.'` → `'Your history projected forward: scenarios, FIRE date, goals, Monte Carlo.'`
- `'Snowball vs avalanche — payoff date, total interest, extra-payment impact.'` → `'Snowball vs avalanche: payoff date, total interest, extra-payment impact.'`
- `'Gross to net for any province — 2026 tax breakdown...'` → `'Gross to net for any province. 2026 tax breakdown, marginal and effective rates, CPP and EI.'`
Code comments may keep em dashes; only user-visible strings change. Update any tests asserting the old strings.

- [ ] **Step 2: Verify + commit**

Run: `grep -rn "—" src/ --include=*.tsx | grep -v ".test." | grep -v "^\s*//"` → remaining hits are comments only. `npx vitest run` → PASS.

```bash
git add -A src/
git commit -m "style: remove em dashes from user-facing copy"
```

---

## Phase 4: Planner Features

### Task 13: Tool info content + ToolInfoButton popover (W3)

**Files:**
- Modify: `src/components/planner/toolRegistry.tsx` (add `info` to `PlannerTool` and every entry)
- Create: `src/components/planner/ToolInfoButton.tsx`
- Modify: `src/pages/PlannerTool.tsx:22` (render the button next to ToolSwitcher)
- Test: `src/components/planner/ToolInfoButton.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface ToolInfo { howTo: string; params: Array<{ name: string; description: string }> }
  // PlannerTool gains: info: ToolInfo
  ToolInfoButton: React.FC<{ tool: PlannerTool }>
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/planner/ToolInfoButton.test.tsx
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ToolInfoButton } from './ToolInfoButton'
import { getTool } from './toolRegistry'

describe('ToolInfoButton', () => {
  it('opens a popover with how-to and parameter glossary', () => {
    render(<ToolInfoButton tool={getTool('mortgage')!} />)
    fireEvent.click(screen.getByRole('button', { name: 'About this tool' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('GDS ratio')).toBeTruthy()
  })
})
```

Run: `npx vitest run src/components/planner/ToolInfoButton.test.tsx` → FAIL.

- [ ] **Step 2: Add `info` to the registry**

In `toolRegistry.tsx` add to the interface:

```ts
export interface ToolInfo {
  howTo: string
  params: Array<{ name: string; description: string }>
}
// PlannerTool gains: info: ToolInfo
```

Write real content for ALL tools (no placeholders; plain language; no em dashes). Content to use:

- **forecaster**: howTo: `'Project your net worth forward. Start from your dashboard net worth or a manual balance, set monthly savings and assumptions, then read the FI number, projected FI date, and Monte Carlo odds below the chart.'` params: `Starting balance` (`'Where the projection begins. Auto mode pulls your dashboard net worth; manual lets you type any figure.'`), `Monthly savings` (`'How much you add every month across all accounts.'`), `Years` (`'How far into the future the chart projects.'`), `Return` (`'Expected average annual investment return, in percent, before inflation.'`), `Inflation` (`'Expected annual inflation. Real (today\'s dollars) mode subtracts this from returns.'`), `Contribution step-up` (`'Annual percent increase to your monthly savings, modeling raises.'`), `Scenario spread` (`'Plus or minus percent applied to the return to draw optimistic and pessimistic bands.'`), `Comp events / debt drag` (`'Include vesting events from Compensation and ongoing debt payments in the projection.'`), `Annual spending in retirement` (`'What you expect to spend per year once retired. Sets the FI target.'`), `Withdrawal rate` (`'The percent of your portfolio you plan to withdraw each year in retirement. FI number = spending divided by this rate.'`), `Volatility (std dev)` (`'How much returns swing year to year in the Monte Carlo simulation. 15 is a typical stock-heavy portfolio.'`)
- **compound-interest**: howTo: `'See how a starting balance plus monthly contributions grows. Adjust the rate and years and watch the balance curve.'` params: `Starting balance`, `Monthly contribution`, `Annual return`, `Years` (one plain sentence each, e.g. `'The lump sum you begin with.'`).
- **savings-goal**: howTo: `'Pick which variable to solve for, fill in the other three, and the tool computes the missing one.'` params: `Solve for` (`'Choose the unknown: final balance, monthly contribution, years, or required return.'`), `Starting amount`, `Monthly contribution`, `Annual return`, `Years`.
- **emergency-fund**: howTo: `'Enter monthly expenses, current fund, and a target in months to see coverage and the gap.'` params: `Monthly expenses`, `Current fund`, `Target months`.
- **currency-converter**: howTo: `'Convert USD and CAD using live rates. Pick a historical date for past rates, or type a manual rate if offline.'` params: `Amount`, `Direction`, `Date`, `Manual rate`.
- **raise-inflation**: howTo: `'Compare your raise to inflation to see the real change in buying power.'` params: `Current salary`, `New salary or raise %`, `Inflation`.
- **debt-payoff**: howTo: `'List your debts with balance, APR, and minimum payment. Choose avalanche (highest APR first) or snowball (smallest balance first), add any extra monthly amount, and compare payoff time and interest.'` params: `Balance`, `APR` (`'Annual percentage rate for that debt.'`), `Min payment`, `Extra monthly payment` (`'Amount above the minimums applied to the target debt each month.'`), `Strategy`.
- **mortgage**: howTo: `'Payment mode computes the monthly payment and amortization curve from price, down payment, rate, and years. Affordability mode estimates the largest home price your income supports.'` params: `Home price`, `Down payment` (`'Percent of price paid upfront. The rest is the mortgage principal.'`), `Rate` (`'Annual interest rate. Interest compounds monthly here, a small simplification of Canadian semi-annual compounding.'`), `Amortization (years)`, `Gross annual income`, `GDS ratio` (`'Gross Debt Service: the percent of gross income lenders allow for housing costs, typically up to 39.'`), `Property tax / month`, `Extra payments` (`'Optional prepayments: recurring monthly extras over a year range, or one-time lump sums. Both shorten the loan and cut interest.'`)
- **rent-vs-buy**: howTo: `'Compare cumulative cost of renting vs buying over time and find the crossover year, if any.'` params: read the component's fields and describe each in one sentence.
- **salary-tax**: howTo: `'Enter gross income and province for a full 2026 tax breakdown: federal and provincial brackets, CPP and EI, net pay per period. Add RRSP and FHSA contributions to see the tax you save.'` params: `Gross annual income`, `Province`, `RRSP contribution` (`'Deducted from taxable income. Limit is 18% of last year\'s earned income up to the annual maximum.'`), `FHSA contribution` (`'First Home Savings Account deposits, deductible like RRSP. Annual limit $8,000.'`), `Marginal rate` (`'Tax on your next dollar earned.'`), `Effective rate` (`'Total tax divided by total income.'`)
- **rrsp-vs-tfsa**: this tool is removed in Task 16; if Task 16 already ran, skip; otherwise give it a one-line info to keep types satisfied (it will be deleted).

For any component whose exact field labels are unknown, open the component file and match `params[].name` to the rendered labels verbatim.

- [ ] **Step 3: Write ToolInfoButton**

```tsx
// src/components/planner/ToolInfoButton.tsx
import React, { useState } from 'react'
import { Info, X } from 'lucide-react'
import type { PlannerTool } from './toolRegistry'
import { OverlayBackdrop } from '../ui/OverlayBackdrop'

export const ToolInfoButton: React.FC<{ tool: PlannerTool }> = ({ tool }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="About this tool"
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-full text-text-secondary hover:text-accent transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <>
          <OverlayBackdrop onClose={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={`${tool.name} help`}
            className="absolute left-0 top-full mt-2 z-30 w-[26rem] max-w-[90vw] max-h-[70vh] overflow-y-auto themed-card border border-border rounded-lg shadow-xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-text-primary">{tool.name}</h3>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] text-text-secondary">{tool.info.howTo}</p>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Parameters</span>
              {tool.info.params.map((p) => (
                <div key={p.name} className="text-[13px]">
                  <span className="font-medium text-text-primary">{p.name}</span>
                  <span className="text-text-secondary"> : {p.description}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Mount next to the title**

In `PlannerTool.tsx` header, after `<ToolSwitcher current={tool} />` add `<ToolInfoButton tool={tool} />` (import it).

- [ ] **Step 5: Run, verify, commit**

Run: `npx vitest run src/components/planner` → PASS. Preview: (i) next to each tool title opens the glossary with blur.

```bash
git add src/components/planner src/pages/PlannerTool.tsx
git commit -m "feat: per-tool info popover with parameter glossary"
```

### Task 14: canadaTax RRSP/FHSA deduction math (W6, TDD)

**Files:**
- Modify: `src/utils/finance/canadaTax.ts`
- Test: `src/utils/finance/canadaTax.test.ts` (extend)

**Interfaces:**
- Consumes: existing `takeHomePay(gross, province): TakeHome`, `totalIncomeTax(income, province)`.
- Produces:
  ```ts
  export interface TakeHomeWithDeductions extends TakeHome {
    taxableIncome: number
    taxSavings: number   // tax at gross minus tax at taxable income
  }
  export function takeHomeWithDeductions(
    gross: number, province: Province, rrsp: number, fhsa: number,
  ): TakeHomeWithDeductions
  ```
  Semantics: taxable income = `max(0, gross - rrsp - fhsa)`. Income tax (federal + provincial) is computed on taxable income; CPP and EI stay computed on GROSS (payroll contributions are not reduced by RRSP deductions). Net = gross - tax(taxable) - cpp(gross) - ei(gross) - rrsp - fhsa is NOT the definition here: net excludes the contributions themselves (they are savings, not losses). Net = gross - tax(taxable) - cpp - ei.

- [ ] **Step 1: Write failing tests**

Append to `canadaTax.test.ts`:

```ts
describe('takeHomeWithDeductions', () => {
  it('zero contributions matches takeHomePay', () => {
    const base = takeHomePay(100000, 'ON')
    const d = takeHomeWithDeductions(100000, 'ON', 0, 0)
    expect(d.net).toBeCloseTo(base.net, 6)
    expect(d.taxSavings).toBe(0)
    expect(d.taxableIncome).toBe(100000)
  })

  it('contributions reduce taxable income and produce positive savings', () => {
    const d = takeHomeWithDeductions(100000, 'ON', 10000, 8000)
    expect(d.taxableIncome).toBe(82000)
    expect(d.taxSavings).toBeGreaterThan(0)
    expect(d.taxSavings).toBeCloseTo(
      totalIncomeTax(100000, 'ON') - totalIncomeTax(82000, 'ON'), 6)
  })

  it('CPP and EI are unaffected by deductions', () => {
    const base = takeHomePay(100000, 'ON')
    const d = takeHomeWithDeductions(100000, 'ON', 20000, 0)
    expect(d.cpp).toBeCloseTo(base.cpp, 6)
    expect(d.ei).toBeCloseTo(base.ei, 6)
  })

  it('contributions above gross clamp taxable income at zero', () => {
    const d = takeHomeWithDeductions(30000, 'ON', 40000, 8000)
    expect(d.taxableIncome).toBe(0)
  })
})
```

(Import `takeHomeWithDeductions` alongside existing imports.)
Run: `npx vitest run src/utils/finance/canadaTax.test.ts` → new tests FAIL.

- [ ] **Step 2: Implement**

Append to `canadaTax.ts` (after `takeHomePay`; reuse its internals — read `TakeHome`'s exact fields first and mirror them):

```ts
export interface TakeHomeWithDeductions extends TakeHome {
  taxableIncome: number
  taxSavings: number
}

/** Take-home with RRSP/FHSA deductions: income tax on (gross - contributions),
 *  CPP/EI still on gross. taxSavings = tax(gross) - tax(taxable). */
export function takeHomeWithDeductions(
  gross: number,
  province: Province,
  rrsp: number,
  fhsa: number,
): TakeHomeWithDeductions {
  const taxableIncome = Math.max(0, gross - Math.max(0, rrsp) - Math.max(0, fhsa))
  const federal = federalTax(taxableIncome, province)
  const provincial = provincialTax(taxableIncome, province)
  const cpp = cppContribution(gross)
  const ei = eiPremium(gross, province)
  const taxSavings = totalIncomeTax(gross, province) - totalIncomeTax(taxableIncome, province)
  const net = gross - federal - provincial - cpp - ei
  return { gross, federal, provincial, cpp, ei, net, taxableIncome, taxSavings }
}
```

If `TakeHome` has different/extra fields than `{gross, federal, provincial, cpp, ei, net}`, mirror `takeHomePay`'s return construction exactly and add the two new fields.

- [ ] **Step 3: Run, commit**

Run: `npx vitest run src/utils/finance/canadaTax.test.ts` → PASS.

```bash
git add src/utils/finance/canadaTax.ts src/utils/finance/canadaTax.test.ts
git commit -m "feat: takeHomeWithDeductions for RRSP/FHSA in canadaTax"
```

### Task 15: Salary & Tax UI: RRSP/FHSA fields + clearer bracket visual (W6)

**Files:**
- Modify: `src/components/planner/SalaryTaxTool.tsx`

- [ ] **Step 1: Add contribution inputs**

Extend `DEFAULTS` with `rrsp: 0, fhsa: 0`. The header row becomes 4 fields (fixing Task 7's temporary 2-col grid):

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
  <CalculatorField label="Gross annual income" prefix="$" step={1000} value={income} onChange={(v) => setInput(TOOL_ID, 'income', v)} />
  <SelectField label="Province" value={province} onChange={(v) => setInput(TOOL_ID, 'province', v)} options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))} />
  <CalculatorField label="RRSP contribution" prefix="$" step={500} value={inputs.rrsp} onChange={(v) => setInput(TOOL_ID, 'rrsp', v)} />
  <CalculatorField label="FHSA contribution" prefix="$" step={500} value={inputs.fhsa} onChange={(v) => setInput(TOOL_ID, 'fhsa', v)} />
</div>
```

- [ ] **Step 2: Wire the math and new result cards**

Replace `const t = takeHomePay(income, province)` with `const t = takeHomeWithDeductions(income, province, inputs.rrsp, inputs.fhsa)` (update import). Tax results use `totalIncomeTax(t.taxableIncome, province)`. When `inputs.rrsp + inputs.fhsa > 0` show an extra results row:

```tsx
{inputs.rrsp + inputs.fhsa > 0 && (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <ResultCard label="Taxable income" value={formatMoney(t.taxableIncome)} />
    <ResultCard label="Tax savings from contributions" value={formatMoney(t.taxSavings)} highlight />
    <ResultCard label="Net after contributions" value={formatMoney(t.net - inputs.rrsp - inputs.fhsa)} />
  </div>
)}
```

Add a caption under it: `RRSP limit is 18% of last year's earned income up to the annual maximum. FHSA limit is $8,000 per year. Contributions here are assumed fully deductible this year.` Marginal/effective rate cards and BracketBars switch to `t.taxableIncome` so the visuals reflect deductions.

- [ ] **Step 3: Redesign BracketBar for clarity**

Replace the `BracketBar` internals so each bracket is visibly separate and labeled:

```tsx
const BracketBar: React.FC<{ title: string; brackets: Bracket[]; income: number }> = ({ title, brackets, income }) => {
  const cap = Math.max(income * 1.25, 1)
  const segments = brackets
    .reduce<Array<{ start: number; end: number; rate: number }>>((acc, b) => {
      const start = acc.length > 0 ? acc[acc.length - 1].end : 0
      const end = Math.min(b.upTo, cap)
      if (end > start) acc.push({ start, end, rate: b.rate })
      return acc
    }, [])
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] uppercase tracking-wide text-text-secondary">{title}</span>
      <div className="flex w-full gap-1">
        {segments.map((s) => {
          const width = ((s.end - s.start) / cap) * 100
          const filledTo = Math.min(Math.max(income - s.start, 0), s.end - s.start)
          const filledPct = (s.end - s.start > 0 ? filledTo / (s.end - s.start) : 0) * 100
          const active = income > s.start
          return (
            <div key={s.start} className="flex flex-col gap-1" style={{ width: `${width}%` }}>
              <div className={`relative h-7 rounded-md overflow-hidden border ${active ? 'border-accent/60' : 'border-border'} bg-bg-primary/40`}
                   title={`${(s.rate * 100).toFixed(2)}% on ${formatMoney(s.start)} to ${formatMoney(s.end)}`}>
                <div className="absolute inset-y-0 left-0 bg-accent/60" style={{ width: `${filledPct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-text-primary">
                  {(s.rate * 100).toFixed(1)}%
                </span>
              </div>
              <span className="text-[10px] text-text-secondary text-center truncate">
                {formatMoney(s.start)}{s.end < cap ? ` to ${formatMoney(s.end)}` : '+'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

Key changes vs old: `gap-1` between segments (no shared borders), rounded segments, income-range caption under each, accent border on brackets your income reaches.

- [ ] **Step 4: Run, verify, commit**

Run: `npx vitest run src/components/planner src/pages` → PASS (update any SalaryTax tests for the new grid/fields). Preview: contributions change taxable income, savings card appears, brackets clearly separated.

```bash
git add src/components/planner/SalaryTaxTool.tsx
git commit -m "feat: RRSP/FHSA deductions and clearer bracket visual in Salary & Tax"
```

### Task 16: Remove the RRSP vs TFSA tool (W6)

**Files:**
- Modify: `src/components/planner/toolRegistry.tsx` (remove entry + import + `Scale` icon import if unused)
- Delete: `src/components/planner/RrspVsTfsaCalculator.tsx`, `src/utils/finance/rrspVsTfsa.ts`, `src/utils/finance/rrspVsTfsa.test.ts`

- [ ] **Step 1: Remove and delete**

Delete the `rrsp-vs-tfsa` entry from `PLANNER_TOOLS`, the `RrspVsTfsaCalculator` import, and its `info` block. Delete the three files. Run `grep -rn "rrspVsTfsa\|RrspVsTfsa\|rrsp-vs-tfsa" src/` → only possibly the planner store's persisted-inputs key remains referenced nowhere in code; expect zero code matches.

- [ ] **Step 2: Verify + commit**

Run: `npx vitest run` and `npm run build` → PASS. Preview `/planner`: Income & Tax group shows Raise vs Inflation + Salary & Tax only; `/planner/rrsp-vs-tfsa` redirects to `/planner`.

```bash
git add -A src/
git commit -m "feat: remove RRSP vs TFSA tool, superseded by Salary & Tax deductions"
```

### Task 17: Amortization extra-payment math (W7, TDD)

**Files:**
- Modify: `src/utils/finance/amortization.ts`
- Test: `src/utils/finance/amortization.test.ts` (extend)

**Interfaces:**
- Produces:
  ```ts
  export interface ExtraPayment {
    id: string
    kind: 'recurring' | 'oneTime'
    amount: number      // dollars per month (recurring) or total (oneTime)
    fromYear: number    // 1-based year the extra starts (oneTime: the year it lands, applied in that year's first month)
    toYear: number      // recurring only: last year inclusive; ignored for oneTime
  }
  export function amortizationScheduleWithExtras(
    principal: number, annualRatePct: number, years: number, extras: ExtraPayment[],
  ): AmortizationPoint[]
  ```
  Existing `amortizationSchedule` and callers stay untouched.

- [ ] **Step 1: Write failing tests**

```ts
describe('amortizationScheduleWithExtras', () => {
  const P = 400000, R = 5, Y = 25

  it('no extras equals the base schedule', () => {
    const a = amortizationSchedule(P, R, Y)
    const b = amortizationScheduleWithExtras(P, R, Y, [])
    expect(b.length).toBe(a.length)
    expect(b[b.length - 1].balance).toBeCloseTo(a[a.length - 1].balance, 6)
  })

  it('recurring extra shortens the loan and cuts interest', () => {
    const base = amortizationSchedule(P, R, Y)
    const extra = amortizationScheduleWithExtras(P, R, Y, [
      { id: 'x', kind: 'recurring', amount: 500, fromYear: 1, toYear: 25 },
    ])
    expect(extra.length).toBeLessThan(base.length)
    expect(scheduleTotalInterest(extra)).toBeLessThan(scheduleTotalInterest(base))
  })

  it('recurring extra only applies within its year range', () => {
    const early = amortizationScheduleWithExtras(P, R, Y, [
      { id: 'x', kind: 'recurring', amount: 500, fromYear: 1, toYear: 5 },
    ])
    const late = amortizationScheduleWithExtras(P, R, Y, [
      { id: 'x', kind: 'recurring', amount: 500, fromYear: 21, toYear: 25 },
    ])
    // same total extra budget, but early prepayment saves more interest
    expect(scheduleTotalInterest(early)).toBeLessThan(scheduleTotalInterest(late))
  })

  it('one-time lump sum drops the balance in its month', () => {
    const s = amortizationScheduleWithExtras(P, R, Y, [
      { id: 'x', kind: 'oneTime', amount: 20000, fromYear: 2, toYear: 2 },
    ])
    const base = amortizationSchedule(P, R, Y)
    const month13 = s.find((p) => p.month === 13)!
    const base13 = base.find((p) => p.month === 13)!
    expect(base13.balance - month13.balance).toBeGreaterThan(19000)
  })

  it('never overpays: final balance is exactly zero', () => {
    const s = amortizationScheduleWithExtras(50000, R, 5, [
      { id: 'x', kind: 'oneTime', amount: 999999, fromYear: 1, toYear: 1 },
    ])
    expect(s[s.length - 1].balance).toBe(0)
  })
})
```

Run: `npx vitest run src/utils/finance/amortization.test.ts` → new tests FAIL.

- [ ] **Step 2: Implement**

Append to `amortization.ts`:

```ts
export interface ExtraPayment {
  id: string
  kind: 'recurring' | 'oneTime'
  amount: number
  fromYear: number
  toYear: number
}

/** Base schedule plus extra payments: recurring monthly extras active during
 *  [fromYear, toYear], and one-time lump sums applied in the first month of
 *  fromYear. Payments never exceed the remaining balance. */
export function amortizationScheduleWithExtras(
  principal: number,
  annualRatePct: number,
  years: number,
  extras: ExtraPayment[],
): AmortizationPoint[] {
  const r = annualRatePct / 100 / 12
  const basePayment = monthlyPayment(principal, annualRatePct, years)
  const points: AmortizationPoint[] = []
  let balance = principal
  const maxMonths = Math.round(years * 12) + 1
  for (let m = 1; m <= maxMonths && balance > 1e-6; m++) {
    const year = Math.ceil(m / 12)
    const recurring = extras
      .filter((e) => e.kind === 'recurring' && year >= e.fromYear && year <= e.toYear)
      .reduce((s, e) => s + Math.max(0, e.amount), 0)
    const lump = extras
      .filter((e) => e.kind === 'oneTime' && m === (e.fromYear - 1) * 12 + 1)
      .reduce((s, e) => s + Math.max(0, e.amount), 0)
    const interest = balance * r
    const principalPortion = Math.min(basePayment + recurring + lump - interest, balance)
    balance = Math.max(0, balance - principalPortion)
    points.push({ month: m, interestPaid: interest, principalPaid: principalPortion, balance })
  }
  return points
}
```

- [ ] **Step 3: Run, commit**

Run: `npx vitest run src/utils/finance/amortization.test.ts` → PASS.

```bash
git add src/utils/finance/amortization.ts src/utils/finance/amortization.test.ts
git commit -m "feat: amortization schedule with recurring and one-time extra payments"
```

### Task 18: Mortgage extra-payments UI (W7)

**Files:**
- Modify: `src/components/planner/MortgageCalculator.tsx`

**Interfaces:**
- Consumes: `ExtraPayment`, `amortizationScheduleWithExtras`, `scheduleTotalInterest` from Task 17; `ThemedSelect` from Task 2; `usePlannerStore.setInput` persistence (extras stored as JSON under the tool's inputs: `setInput(TOOL_ID, 'extras', JSON.stringify(extras))`; check `usePlannerStore`'s value type first — if it only stores numbers/strings, a string is fine).

- [ ] **Step 1: Add the extras editor to Payment mode**

Below the inputs grid in Payment mode, add an "Extra payments" themed-card section:

```tsx
const extras: ExtraPayment[] = React.useMemo(() => {
  try { return JSON.parse((inputs.extras as unknown as string) || '[]') } catch { return [] }
}, [inputs.extras])
const setExtras = (next: ExtraPayment[]) => setInput(TOOL_ID, 'extras', JSON.stringify(next) as unknown as number)
```

```tsx
<div className="themed-card rounded-lg p-4 flex flex-col gap-3">
  <div className="flex items-center justify-between">
    <p className="text-[12px] uppercase tracking-wide text-text-secondary">Extra payments</p>
    <button type="button" onClick={() => setExtras([...extras, { id: crypto.randomUUID(), kind: 'recurring', amount: 200, fromYear: 1, toYear: inputs.years }])}
      className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-accent">
      <Plus className="w-4 h-4" /> Add
    </button>
  </div>
  {extras.length === 0 && <p className="text-[13px] text-text-secondary">None yet. Add recurring monthly extras for a range of years, or one-time lump sums.</p>}
  {extras.map((e) => (
    <div key={e.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-3 items-end">
      <div>
        <label className="text-[13px] font-medium text-text-secondary block mb-1">Type</label>
        <ThemedSelect value={e.kind} options={[{ value: 'recurring', label: 'Monthly extra' }, { value: 'oneTime', label: 'One-time lump sum' }]}
          onChange={(v) => setExtras(extras.map((x) => x.id === e.id ? { ...x, kind: v as ExtraPayment['kind'] } : x))} />
      </div>
      <CalculatorField label={e.kind === 'recurring' ? 'Amount / month' : 'Amount'} prefix="$" step={100} value={e.amount}
        onChange={(v) => setExtras(extras.map((x) => x.id === e.id ? { ...x, amount: v } : x))} />
      <CalculatorField label={e.kind === 'recurring' ? 'From year' : 'In year'} min={1} max={inputs.years} value={e.fromYear}
        onChange={(v) => setExtras(extras.map((x) => x.id === e.id ? { ...x, fromYear: v } : x))} />
      {e.kind === 'recurring' ? (
        <CalculatorField label="To year" min={e.fromYear} max={inputs.years} value={e.toYear}
          onChange={(v) => setExtras(extras.map((x) => x.id === e.id ? { ...x, toYear: v } : x))} />
      ) : <div />}
      <button type="button" aria-label="Remove extra payment" onClick={() => setExtras(extras.filter((x) => x.id !== e.id))}
        className="p-2 text-text-secondary hover:text-error self-end"><Trash2 className="w-4 h-4" /></button>
    </div>
  ))}
</div>
```

(Import `Plus`, `Trash2` from lucide-react, `ThemedSelect`, `ExtraPayment`, `amortizationScheduleWithExtras`.)

- [ ] **Step 2: Wire results and comparison chart**

```tsx
const scheduleWithExtras = amortizationScheduleWithExtras(principal, inputs.ratePct, inputs.years, extras)
const interestSaved = scheduleTotalInterest(schedule) - scheduleTotalInterest(scheduleWithExtras)
const monthsSaved = schedule.length - scheduleWithExtras.length
```

When `extras.length > 0`, add a results row:

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <ResultCard label="Interest saved" value={formatMoney(interestSaved)} highlight />
  <ResultCard label="Paid off sooner by" value={`${Math.floor(monthsSaved / 12)}y ${monthsSaved % 12}m`} />
  <ResultCard label="New payoff time" value={`${Math.floor(scheduleWithExtras.length / 12)}y ${scheduleWithExtras.length % 12}m`} />
</div>
```

Chart: build merged yearly data and render two Areas (baseline dimmed, with-extras accent):

```tsx
const chartData = schedule.filter((p) => p.month % 12 === 0).map((p) => ({
  year: p.month / 12,
  baseline: Math.round(p.balance),
  withExtras: Math.round(scheduleWithExtras.find((q) => q.month === p.month)?.balance ?? 0),
}))
...
<Area type="monotone" dataKey="baseline" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.12} />
{extras.length > 0 && <Area type="monotone" dataKey="withExtras" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />}
```

(When `extras.length === 0` keep the single original series by rendering `baseline` with the accent styling instead.)

- [ ] **Step 3: Run, verify, commit**

Run: `npx vitest run src/components/planner` and `npm run build` → PASS. Preview `/planner/mortgage`: add +$500/mo years 1-5 and a $20k lump in year 3; interest-saved card and diverging curves appear; entries survive reload.

```bash
git add src/components/planner/MortgageCalculator.tsx
git commit -m "feat: mortgage extra payments with interest-saved comparison"
```

---

## Phase 5: Investments Rebuild & Structure

### Task 19: Analysis store v2: fund fields + swaps (W9, TDD)

**Files:**
- Modify: `src/store/useAnalysisStore.ts`
- Test: `src/store/useAnalysisStore.test.ts` (create if absent)

**Interfaces:**
- Produces (additions; nothing existing is renamed):
  ```ts
  export interface SwapScenario {
    id: string
    side: 'plan' | 'actual'
    outPositionId: string
    inTicker: string
    inExchange?: string
    inStartPrice: number
    inStartPriceSource: 'auto' | 'manual'
  }
  // Position gains: allocationPct?: number; extraPlanned?: number
  // InvestmentAnalysis gains: initialFund?: number; extraFund?: number; swaps: SwapScenario[]
  // Store gains: addSwap(analysisId, swap), removeSwap(analysisId, swapId),
  //              updateSwap(analysisId, swapId, updates: Partial<SwapScenario>)
  ```
  Persist version bumps 1 → 2; migration adds `swaps: []` to each analysis (v1 data) and still chains the v0→v1 wrap.

- [ ] **Step 1: Write failing migration + action tests**

```ts
// src/store/useAnalysisStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useAnalysisStore } from './useAnalysisStore'

const analysis = {
  id: 'a1', name: 'Power Semis', analysisDate: '2026-05-18',
  initialFund: 25000, extraFund: 2000, swaps: [],
  positions: [{ id: 'p1', ticker: 'IFX', plannedAmount: 8750, allocationPct: 35, extraPlanned: 0, startPrice: 66.1, startPriceSource: 'manual' as const, acted: false, lots: [] }],
}

describe('useAnalysisStore swaps', () => {
  beforeEach(() => useAnalysisStore.setState({ analyses: [] }))

  it('adds and removes swap scenarios', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    s.addSwap('a1', { id: 'sw1', side: 'plan', outPositionId: 'p1', inTicker: 'GFS', inStartPrice: 40, inStartPriceSource: 'manual' })
    expect(useAnalysisStore.getState().analyses[0].swaps).toHaveLength(1)
    useAnalysisStore.getState().removeSwap('a1', 'sw1')
    expect(useAnalysisStore.getState().analyses[0].swaps).toHaveLength(0)
  })
})
```

Run: `npx vitest run src/store/useAnalysisStore.test.ts` → FAIL (addSwap not a function).

- [ ] **Step 2: Implement store changes**

Add the `SwapScenario` interface, the optional fields on `Position` (`allocationPct?: number; extraPlanned?: number`) and `InvestmentAnalysis` (`initialFund?: number; extraFund?: number; swaps: SwapScenario[]`), and the three actions using the existing `mapAnalysis` helper:

```ts
addSwap: (analysisId, swap) =>
  set((state) => ({
    analyses: mapAnalysis(state.analyses, analysisId, (a) => ({ ...a, swaps: [...(a.swaps ?? []), swap] })),
  })),
removeSwap: (analysisId, swapId) =>
  set((state) => ({
    analyses: mapAnalysis(state.analyses, analysisId, (a) => ({ ...a, swaps: (a.swaps ?? []).filter((s) => s.id !== swapId) })),
  })),
updateSwap: (analysisId, swapId, updates) =>
  set((state) => ({
    analyses: mapAnalysis(state.analyses, analysisId, (a) => ({
      ...a,
      swaps: (a.swaps ?? []).map((s) => (s.id === swapId ? { ...s, ...updates } : s)),
    })),
  })),
```

Bump `version: 2` and extend `migrate`: after the existing v0 handling, for `version < 2` map every analysis to `{ ...a, swaps: a.swaps ?? [] }`. Also update `AnalysisModal.tsx`/`AddPositionModal` creation sites to include `swaps: []` on new analyses (grep `addAnalysis(`).

- [ ] **Step 3: Run, commit**

Run: `npx vitest run src/store/useAnalysisStore.test.ts` and full `npx vitest run` → PASS.

```bash
git add src/store/useAnalysisStore.ts src/store/useAnalysisStore.test.ts src/components/investments
git commit -m "feat: analysis store v2 with fund fields and swap scenarios"
```

### Task 20: Plan metrics + swap simulation utils (W9, TDD)

**Files:**
- Create: `src/utils/investments/planMetrics.ts`, `src/utils/investments/swapSim.ts`
- Test: `src/utils/investments/planMetrics.test.ts`, `src/utils/investments/swapSim.test.ts`

**Interfaces:**
- Consumes: `Position`, `SwapScenario`, `BuyLot` types; lot helpers from `analysisMetrics.ts`.
- Produces:
  ```ts
  // planMetrics.ts
  export interface PlanRow {
    positionId: string; ticker: string
    allocationPct: number; extra: number; initialInvestment: number  // alloc% of initialFund
    startPrice: number; shares: number; currentPrice: number
    currentValue: number; returnDollars: number; returnPct: number | null
  }
  export function planRow(position: Position, initialFund: number, currentPrice: number): PlanRow
  export interface FundSummary { initialFund: number; extraFund: number; totalFund: number; currentValue: number; totalReturnPct: number | null }
  export function planFundSummary(rows: PlanRow[], initialFund: number, extraFund: number): FundSummary
  export function actualFundSummary(positions: Position[], priceFor: (p: Position) => number): FundSummary
  // swapSim.ts
  export interface SwapResult { invested: number; originalReturn: number; newReturn: number; difference: number }
  export function simulateSwap(invested: number, outStartPrice: number, outCurrentPrice: number, inStartPrice: number, inCurrentPrice: number): SwapResult
  ```
  Semantics (mirrors the spreadsheet): plan `initialInvestment = initialFund * allocationPct/100`; total in = initialInvestment + extra; `shares = totalIn / startPrice`; `returnDollars = shares * currentPrice - totalIn`. Swap: the same invested dollars buy the in-ticker at ITS start price instead; `originalReturn = invested * (outCurrent/outStart - 1)`, `newReturn = invested * (inCurrent/inStart - 1)`, `difference = newReturn - originalReturn`.

- [ ] **Step 1: Write failing tests using the spreadsheet's own numbers**

```ts
// src/utils/investments/swapSim.test.ts
import { describe, expect, it } from 'vitest'
import { simulateSwap } from './swapSim'

describe('simulateSwap', () => {
  it('reproduces the sheet: NVTS -> GFS on $2500', () => {
    // NVTS bought at 19.67 now 14.46 -> -662.18; GFS 19.67->? sheet shows +73.70 new return
    const r = simulateSwap(2500, 19.67, 14.46, 55, 56.62)
    expect(r.originalReturn).toBeCloseTo(2500 * (14.46 / 19.67 - 1), 1) // ~ -662.18
    expect(r.newReturn).toBeCloseTo(2500 * (56.62 / 55 - 1), 1)
    expect(r.difference).toBeCloseTo(r.newReturn - r.originalReturn, 6)
  })
  it('zero start prices return zeros instead of Infinity', () => {
    const r = simulateSwap(1000, 0, 10, 0, 10)
    expect(r.originalReturn).toBe(0)
    expect(r.newReturn).toBe(0)
  })
})
```

```ts
// src/utils/investments/planMetrics.test.ts
import { describe, expect, it } from 'vitest'
import { planRow, planFundSummary } from './planMetrics'
import type { Position } from '../../store/useAnalysisStore'

const pos = (over: Partial<Position>): Position => ({
  id: 'p', ticker: 'IFX', plannedAmount: 0, startPrice: 66.1, startPriceSource: 'manual',
  acted: false, lots: [], allocationPct: 35, extraPlanned: 0, ...over,
})

describe('planRow', () => {
  it('reproduces the sheet IFX row: 35% of 25k at 66.10 -> 77.58', () => {
    const r = planRow(pos({}), 25000, 77.58)
    expect(r.initialInvestment).toBeCloseTo(8750, 2)
    expect(r.shares).toBeCloseTo(132.38, 1)
    expect(r.currentValue).toBeCloseTo(10269.67, 0)
    expect(r.returnDollars).toBeCloseTo(1519.67, 0)
    expect(r.returnPct).toBeCloseTo(17.37, 1)
  })
  it('extra-only rows (0% allocation) still invest the extra', () => {
    const r = planRow(pos({ ticker: 'SEDG', allocationPct: 0, extraPlanned: 1000, startPrice: 55.23 }), 25000, 52.38)
    expect(r.initialInvestment).toBe(0)
    expect(r.currentValue).toBeCloseTo((1000 / 55.23) * 52.38, 2)
  })
})

describe('planFundSummary', () => {
  it('totals fund and computes return pct', () => {
    const rows = [planRow(pos({}), 25000, 77.58)]
    const s = planFundSummary(rows, 25000, 2000)
    expect(s.totalFund).toBe(27000)
    expect(s.currentValue).toBeCloseTo(rows[0].currentValue, 6)
  })
})
```

Run: `npx vitest run src/utils/investments` → new files FAIL to resolve.

- [ ] **Step 2: Implement**

```ts
// src/utils/investments/swapSim.ts
export interface SwapResult {
  invested: number
  originalReturn: number
  newReturn: number
  difference: number
}

/** What-if: the dollars invested in the out-ticker had bought the in-ticker
 *  at its start-date price instead. Returns are dollar P/L on `invested`. */
export function simulateSwap(
  invested: number,
  outStartPrice: number,
  outCurrentPrice: number,
  inStartPrice: number,
  inCurrentPrice: number,
): SwapResult {
  const originalReturn = outStartPrice > 0 ? invested * (outCurrentPrice / outStartPrice - 1) : 0
  const newReturn = inStartPrice > 0 ? invested * (inCurrentPrice / inStartPrice - 1) : 0
  return { invested, originalReturn, newReturn, difference: newReturn - originalReturn }
}
```

```ts
// src/utils/investments/planMetrics.ts
import type { Position } from '../../store/useAnalysisStore'
import { currentValue, totalInvested } from './analysisMetrics'

export interface PlanRow {
  positionId: string
  ticker: string
  allocationPct: number
  extra: number
  initialInvestment: number
  startPrice: number
  shares: number
  currentPrice: number
  currentValue: number
  returnDollars: number
  returnPct: number | null
}

export function planRow(position: Position, initialFund: number, currentPrice: number): PlanRow {
  const allocationPct = position.allocationPct ?? 0
  const extra = position.extraPlanned ?? 0
  const initialInvestment = (initialFund * allocationPct) / 100
  const totalIn = initialInvestment + extra
  const shares = position.startPrice > 0 ? totalIn / position.startPrice : 0
  const value = shares * currentPrice
  const returnDollars = value - totalIn
  return {
    positionId: position.id,
    ticker: position.ticker,
    allocationPct,
    extra,
    initialInvestment,
    startPrice: position.startPrice,
    shares,
    currentPrice,
    currentValue: value,
    returnDollars,
    returnPct: totalIn > 0 ? (returnDollars / totalIn) * 100 : null,
  }
}

export interface FundSummary {
  initialFund: number
  extraFund: number
  totalFund: number
  currentValue: number
  totalReturnPct: number | null
}

export function planFundSummary(rows: PlanRow[], initialFund: number, extraFund: number): FundSummary {
  const totalFund = initialFund + extraFund
  const value = rows.reduce((s, r) => s + r.currentValue, 0)
  return {
    initialFund,
    extraFund,
    totalFund,
    currentValue: value,
    totalReturnPct: totalFund > 0 ? ((value - totalFund) / totalFund) * 100 : null,
  }
}

export function actualFundSummary(positions: Position[], priceFor: (p: Position) => number): FundSummary {
  const invested = positions.reduce((s, p) => s + totalInvested(p.lots), 0)
  const value = positions.reduce((s, p) => s + currentValue(p.lots, priceFor(p)), 0)
  // Actual side has no plan split; initialFund carries total invested, extraFund 0.
  return {
    initialFund: invested,
    extraFund: 0,
    totalFund: invested,
    currentValue: value,
    totalReturnPct: invested > 0 ? ((value - invested) / invested) * 100 : null,
  }
}
```

- [ ] **Step 3: Run, commit**

Run: `npx vitest run src/utils/investments` → PASS.

```bash
git add src/utils/investments
git commit -m "feat: plan metrics and swap simulation math for investments"
```

### Task 21: Plan/Actual tables + fund summary UI (W9)

**Files:**
- Create: `src/components/investments/FundSummaryBar.tsx`, `src/components/investments/PlanTable.tsx`, `src/components/investments/ActualTable.tsx`
- Modify: `src/components/investments/AnalysisCard.tsx` (add Plan/Actual sub-tabs rendering the tables above the existing PositionCard list; add fund inputs)
- Read first: `src/components/investments/PositionCard.tsx`, `src/components/investments/AnalysisModal.tsx`, `src/services/marketData/useMarketData.ts` (how live prices are fetched per ticker)

**Interfaces:**
- Consumes: `planRow`, `planFundSummary`, `actualFundSummary` (Task 20); `Stat` (Task 5); lot helpers from `analysisMetrics.ts`; live prices via the same hook/pattern `PositionCard` uses (override > cached > startPrice, as in `Investments.tsx:20-21`).
- Produces:
  ```ts
  FundSummaryBar: React.FC<{ summary: FundSummary; startDate: string }>
  PlanTable: React.FC<{ analysis: InvestmentAnalysis; priceFor: (p: Position) => number }>
  ActualTable: React.FC<{ analysis: InvestmentAnalysis; priceFor: (p: Position) => number }>
  ```

- [ ] **Step 1: FundSummaryBar**

```tsx
// src/components/investments/FundSummaryBar.tsx
import React from 'react'
import { Stat } from '../ui/Stat'
import { formatMoney } from '../planner/format'
import type { FundSummary } from '../../utils/investments/planMetrics'

export const FundSummaryBar: React.FC<{ summary: FundSummary; startDate: string }> = ({ summary, startDate }) => (
  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 themed-card rounded-lg p-4">
    <Stat label="Start date" value={startDate} />
    <Stat label="Initial fund" value={formatMoney(summary.initialFund)} />
    <Stat label="Extra fund" value={formatMoney(summary.extraFund)} />
    <Stat label="Total fund" value={formatMoney(summary.totalFund)} />
    <Stat label="Current value" value={formatMoney(summary.currentValue)} tone="accent" />
    <Stat
      label="Total return"
      value={summary.totalReturnPct === null ? 'n/a' : `${summary.totalReturnPct.toFixed(2)}%`}
      tone={summary.totalReturnPct !== null && summary.totalReturnPct < 0 ? 'error' : 'accent'}
    />
  </div>
)
```

- [ ] **Step 2: PlanTable**

```tsx
// src/components/investments/PlanTable.tsx
import React from 'react'
import type { InvestmentAnalysis, Position } from '../../store/useAnalysisStore'
import { planRow } from '../../utils/investments/planMetrics'
import { formatMoney } from '../planner/format'

const th = 'px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-text-secondary'
const td = 'px-3 py-2 text-right text-[13px] text-text-primary tabular-nums'

export const PlanTable: React.FC<{ analysis: InvestmentAnalysis; priceFor: (p: Position) => number }> = ({ analysis, priceFor }) => {
  const rows = analysis.positions.map((p) => planRow(p, analysis.initialFund ?? 0, priceFor(p)))
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse">
        <thead className="bg-bg-primary/50">
          <tr>
            <th className={`${th} text-left`}>Ticker</th>
            <th className={th}>Allocation %</th>
            <th className={th}>Extra $</th>
            <th className={th}>Initial investment</th>
            <th className={th}>Start price</th>
            <th className={th}>Shares</th>
            <th className={th}>Current price</th>
            <th className={th}>Current value</th>
            <th className={th}>Return $</th>
            <th className={th}>Return %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.positionId} className="border-t border-border/60">
              <td className={`${td} text-left font-medium`}>{r.ticker}</td>
              <td className={td}>{r.allocationPct.toFixed(2)}%</td>
              <td className={td}>{formatMoney(r.extra)}</td>
              <td className={td}>{formatMoney(r.initialInvestment)}</td>
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
    </div>
  )
}
```

- [ ] **Step 3: ActualTable**

Same table skeleton with columns: Ticker, Initial investment (`totalInvested` of lots before/at analysis date? NO: first lot), Extra investment, Start price, Average price, Shares, Current price, Current value, Return $, Return %. Definitions from lot data: `initial = lots[0]?.amountInvested ?? 0`, `extra = totalInvested(lots) - initial`, `avgPrice = avgCostBasis(lots)`, `shares = sharesFromLots(lots)`, returns via `plDollars`/`plPct`. Import all from `analysisMetrics.ts`; render exactly like PlanTable (same `th`/`td` constants copied locally).

- [ ] **Step 4: Wire into AnalysisCard**

In `AnalysisCard.tsx` add a `plan | actual` sub-tab (same pill-button pattern as `Investments.tsx:50-62`), an inputs row when on plan tab (`CalculatorField`-style inputs for `initialFund`, `extraFund` wired to `updateAnalysis`, and per-position `allocationPct`/`extraPlanned` handled in `PositionCard` or a compact editor above the table), then:

```tsx
{subTab === 'plan' ? (
  <>
    <FundSummaryBar summary={planFundSummary(rows, analysis.initialFund ?? 0, analysis.extraFund ?? 0)} startDate={analysis.analysisDate} />
    <PlanTable analysis={analysis} priceFor={priceFor} />
  </>
) : (
  <>
    <FundSummaryBar summary={actualFundSummary(analysis.positions, priceFor)} startDate={analysis.analysisDate} />
    <ActualTable analysis={analysis} priceFor={priceFor} />
  </>
)}
```

`priceFor` reuses the override > cached > startPrice resolution from `Investments.tsx` (lift it into a small shared helper `src/utils/investments/priceFor.ts` if duplicating twice). Keep the existing `PositionCard` list below the table on the actual tab (it is the lot editor).

- [ ] **Step 5: Run, verify, commit**

Run: `npx vitest run` and `npm run build` → PASS. Preview `/investments`: an analysis shows fund summary + plan table; actual tab shows actual table + lot editors; live prices populate.

```bash
git add src/components/investments src/utils/investments
git commit -m "feat: fund-level plan and actual tables with summary bar"
```

### Task 22: Swap simulator UI (W9)

**Files:**
- Create: `src/components/investments/SwapSimulator.tsx`
- Modify: `src/components/investments/AnalysisCard.tsx` (render one SwapSimulator per sub-tab, between summary and table)

**Interfaces:**
- Consumes: `SwapScenario` + store actions (Task 19), `simulateSwap` (Task 20), `ThemedSelect` (Task 2), market data service for the in-ticker's start-date and current price (same pattern `PositionCard` uses for historical start price: read `src/services/marketData/useMarketData.ts` and mirror; manual price fallback field when fetch fails).
- Produces: `SwapSimulator: React.FC<{ analysis: InvestmentAnalysis; side: 'plan' | 'actual'; priceFor: (p: Position) => number; investedFor: (p: Position) => number }>` where `investedFor` returns plan `initialInvestment + extra` (plan side) or `totalInvested(lots)` (actual side).

- [ ] **Step 1: Build the component**

Layout per swap row (a themed-card strip): ThemedSelect "Swap out" (options = analysis positions on this side), text input "Swap in" ticker, auto-fetched `inStartPrice` with manual override `CalculatorField`, then computed cells: Initial Inv, Original Return, New Return, Difference (accent when positive, error when negative), and a remove button. An "Add swap" button appends `addSwap(analysis.id, { id: crypto.randomUUID(), side, outPositionId: firstPosition.id, inTicker: '', inStartPrice: 0, inStartPriceSource: 'manual' })`. Filter `analysis.swaps` by `side`. Computation per swap:

```tsx
const out = analysis.positions.find((p) => p.id === swap.outPositionId)
const invested = out ? investedFor(out) : 0
const result = out
  ? simulateSwap(invested, out.startPrice, priceFor(out), swap.inStartPrice, inCurrentPrice)
  : null
```

`inCurrentPrice` comes from the market data hook keyed by `swap.inTicker`/`swap.inExchange` with manual override fallback; while loading show `Skeleton` (Task 5).

- [ ] **Step 2: Wire into AnalysisCard, verify, commit**

Render `<SwapSimulator analysis={analysis} side={subTab} priceFor={priceFor} investedFor={...} />` above the table on both sub-tabs. Run `npx vitest run` + `npm run build` → PASS. Preview: recreate the sheet scenario (swap NVTS out for GFS) and confirm original/new/difference render and persist.

```bash
git add src/components/investments
git commit -m "feat: swap what-if simulator on plan and actual views"
```

### Task 23: Budgeting page tabs (W11.2)

**Files:**
- Modify: `src/pages/Budgeting.tsx`

- [ ] **Step 1: Restructure into tabs**

Add `const [tab, setTab] = useState<'overview' | 'insights' | 'transactions' | 'setup'>('overview')` and the pill-button tab row (same pattern as `Investments.tsx:50-62`). Distribute existing widgets (header with month picker + CSVUploader + Add Transaction stays global above the tabs):

- **Overview**: Income, Expense, MonthlySummary row; BudgetProgress + Sankey row (W4 order preserved: BudgetProgress first).
- **Insights**: Subscriptions, AnomalyAlerts row; SpendingHeatmap, CategoryTrends row.
- **Transactions**: TriageInboxWidget, TransactionListWidget.
- **Setup**: CategoryManagerWidget (Budget Setup, still collapsible), CategorizationRulesWidget.

- [ ] **Step 2: Verify + commit**

Run: `npx vitest run` → PASS. Preview: four tabs render their widgets; month navigation still affects all tabs; Add Transaction works from any tab.

```bash
git add src/pages/Budgeting.tsx
git commit -m "feat: budgeting page reorganized into overview/insights/transactions/setup tabs"
```

### Task 24: Number/typography + empty-state adoption pass (W11.1, W11.3)

**Files:**
- Modify: files found by the greps below (expect: `Investments.tsx` summary cards → `Stat`; `IncomeWidget`/`ExpenseWidget`/`MonthlySummaryWidget` `$...toFixed(2)` → `formatMoney`; `text-red-500` → `text-error`; Dashboard `text-3xl font-bold` header → `text-[24px] font-semibold text-text-primary` to match other pages; empty-state markup → `EmptyState`).

- [ ] **Step 1: Money formatting and error color**

Run: `grep -rn "toFixed(2)" src/components src/pages --include=*.tsx` and replace user-facing `$${x.toFixed(2)}` renders with `formatMoney(x)` (keep `toLocaleString` calls that already show cents if changing them would alter display precision meaningfully; goal is one canonical style via formatMoney).
Run: `grep -rn "text-red-500\|bg-red-500" src/ --include=*.tsx` and replace with `text-error` / `bg-error` (verify the theme defines `--color-error`; check `src/index.css`; if only some themes define it, add it to each theme block).

- [ ] **Step 2: Stat + header + EmptyState adoption**

Replace the three inline summary cards in `Investments.tsx:67-69` with `Stat` inside `themed-card` wrappers. Normalize the Dashboard header to the standard page header (`text-[24px] font-semibold text-text-primary` + `text-[14px] text-text-secondary mt-1` subtitle). Convert bespoke empty states (Investments "No analyses yet", budget widgets' "No transactions this month." style paragraphs) to `EmptyState` where an icon/CTA fits naturally; leave one-line table placeholders alone.

- [ ] **Step 3: Skeletons for market data**

In `PositionCard`/tables where a live price is loading (the market data hook exposes a loading state; read `useMarketData.ts`), render `<Skeleton className="h-4 w-16 inline-block" />` instead of a dash/0.

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run` and `npm run build` → PASS. Preview: dashboard, budgeting, investments, planner all show consistent money formatting and header styles on two themes.

```bash
git add -A src/
git commit -m "style: unified Stat/formatMoney/EmptyState/Skeleton usage across pages"
```

### Task 25: Final verification sweep

- [ ] **Step 1: Full test suite and build**

Run: `npx vitest run` → all pass. Run: `npm run build` → clean. Run: `npm run lint` → clean (fix new-code lint only).

- [ ] **Step 2: Preview walkthrough against the spec**

On Luxury Dark AND Geometric Light: planner hub (no voids), forecaster (suffix intact), savings goal / salary & tax / debt payoff (grids full), theme selector (active visible), dashboard (no comp widget), budgeting tabs (swap + collapse + Projected Net + matching labels), tool info popovers, mortgage extras, salary & tax RRSP/FHSA + brackets, investments plan/actual tables + swaps, every dropdown/date picker themed with blur. Screenshot each area.

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A src/
git commit -m "chore: final verification fixes for UI polish plan"
```
