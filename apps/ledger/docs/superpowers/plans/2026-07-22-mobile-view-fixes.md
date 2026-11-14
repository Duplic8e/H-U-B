# Mobile View Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed mobile-view defects from `MOBILE_AUDIT.md` (v0.7.4-beta): reclaim wasted horizontal space, de-duplicate the Budget month controls, make the bottom nav and tax brackets robust on narrow phones, and enlarge sub-44px touch targets.

**Architecture:** Pure front-end changes in an existing React 19 + Vite + Tailwind v4 SPA. No new dependencies, no store/schema changes. Each fix is a small, isolated edit to one component, guarded by a React Testing Library (RTL) class/structure assertion where non-flaky, plus an explicit manual browser-verification step. Responsive behavior is driven by Tailwind breakpoint prefixes (`md:` = ≥768px) and, where JS is needed, the existing `useIsDesktop()` hook.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (with `@container` queries), Vitest 4 + @testing-library/react + jsdom, lucide-react icons, zustand stores.

## Global Constraints

- No em dashes in any user-facing copy or code comments (user global rule).
- Version floor stays `0.7.4-beta`; do not bump `package.json` version in this plan.
- Do not add dependencies. Use existing utilities: `useIsDesktop()` from `src/hooks/useMediaQuery.ts`, the `Sheet` primitive, `ThemedSelect` (supports an `ariaLabel` prop).
- Tests run with `npx vitest run <path>` (jsdom, `installMatchMedia()` is global via `src/setupTests.ts`; default is desktop, call `setMatchMedia(false)` for mobile and `resetMatchMedia()` in cleanup).
- Full suite is ~627 tests. Two existing tests will be intentionally updated by this plan: `src/components/dashboard/AccountCategoryWidget.test.tsx` (Task 3) and — verify — `src/components/planner/SalaryTaxTool.test.tsx` (Task 5). Do not delete unrelated assertions.
- Keep the shared `navItems` array (used by BOTH the desktop sidebar and the mobile tab bar in `Layout.tsx`) as the single source of nav labels; do not fork labels per breakpoint.
- Preserve desktop appearance. Every change must be gated so the ≥`md` layout is visually unchanged unless the task explicitly says otherwise.

---

## File Structure

Files touched, each with one responsibility:

| File | Change | Task |
|------|--------|------|
| `src/pages/Dashboard.tsx` | Drop root `p-6`; gate widget drag to desktop | 1, 6 |
| `src/pages/Budgeting.tsx` | Drop root `p-6`; de-duplicate month controls; arrow tap targets; select `ariaLabel` | 1, 7 |
| `src/pages/Investments.tsx` | Drop root `p-6` | 1 |
| `src/pages/Compensation.tsx` | Drop root `p-6` | 1 |
| `src/pages/Planner.tsx` | Drop root `p-6` | 1 |
| `src/pages/PlannerTool.tsx` | Drop root `p-6` | 1 |
| `src/components/Layout.tsx` | Equalize + truncate bottom-nav cells | 2 |
| `src/components/dashboard/AccountCategoryWidget.tsx` | 44px edit/remove targets; truncate account name | 3 |
| `src/components/planner/SalaryTaxTool.tsx` | Min-width + no-truncate bracket segments; scroll fallback | 5 |
| `src/components/budget/CSVUploader.tsx` | Icon-only import button below `sm` | 7 |
| `src/components/budget/TransactionModal.tsx` | Remove `overflow-hidden` that can trap sheet scroll | 8 |
| Test files (new/updated) | Guards for each of the above | all |

---

## Task 1: Remove page-root padding duplication (Audit H1)

**Problem:** `main` (`Layout.tsx:134`) already applies `p-4 sm:p-8`. Every page root ALSO adds `p-6`, so mobile content sits inside 40px of padding per side (80px total, 21% of a 375px screen). Removing the redundant `p-6` lets `main` own the gutter and reclaims ~40px of width on mobile.

**Files:**
- Modify: `src/pages/Dashboard.tsx:88`
- Modify: `src/pages/Budgeting.tsx:53`
- Modify: `src/pages/Investments.tsx:35`
- Modify: `src/pages/Compensation.tsx:52`
- Modify: `src/pages/Planner.tsx:6`
- Modify: `src/pages/PlannerTool.tsx:13`
- Test: `src/pages/Planner.test.tsx` (append), `src/pages/Compensation.test.tsx` (append)

**Interfaces:**
- Produces: no exported API change. `main` remains the sole padding owner (`p-4 sm:p-8` in `Layout.tsx:134`) — later tasks assume page roots carry no `p-*` gutter.

- [ ] **Step 1: Write the failing guard test (Planner)**

Append to `src/pages/Planner.test.tsx`:

```tsx
describe('Planner page gutter (no double padding)', () => {
  it('root does not add its own p-6 padding (main owns the gutter)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/planner']}>
        <Routes>
          <Route path="/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>
    )
    const root = container.firstChild as HTMLElement
    expect(root.className.split(/\s+/)).not.toContain('p-6')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/Planner.test.tsx -t "no double padding"`
Expected: FAIL. The assertion finds `p-6` in the root class list.

- [ ] **Step 3: Remove `p-6` from all six page roots**

`src/pages/Planner.tsx:6`
```tsx
  <div className="flex flex-col gap-8 w-full min-h-full animate-fade-in">
```
`src/pages/Dashboard.tsx:88`
```tsx
    <div className="min-h-full w-full">
```
`src/pages/Budgeting.tsx:53`
```tsx
    <div className="flex flex-col gap-6 w-full min-h-full animate-fade-in">
```
`src/pages/Investments.tsx:35`
```tsx
    <div className="flex flex-col gap-6 w-full min-h-full animate-fade-in">
```
`src/pages/Compensation.tsx:52`
```tsx
    <div className="flex flex-col gap-6 w-full min-h-full animate-fade-in">
```
`src/pages/PlannerTool.tsx:13`
```tsx
    <div className="flex flex-col gap-6 w-full min-h-full animate-fade-in">
```

- [ ] **Step 4: Add the same guard for Compensation**

Append to `src/pages/Compensation.test.tsx` (match the file's existing import/render style; if it renders `<Compensation />` inside a `MemoryRouter`, mirror that):

```tsx
it('page root does not add its own p-6 padding', () => {
  const { container } = render(<MemoryRouter><Compensation /></MemoryRouter>)
  const root = container.firstChild as HTMLElement
  expect(root.className.split(/\s+/)).not.toContain('p-6')
})
```

> If `Compensation.test.tsx` does not already import `MemoryRouter`/`render`/`Compensation`, add those imports at the top: `import { render } from '@testing-library/react'`, `import { MemoryRouter } from 'react-router-dom'`, `import { Compensation } from './Compensation'`.

- [ ] **Step 5: Run both guard tests to verify they pass**

Run: `npx vitest run src/pages/Planner.test.tsx src/pages/Compensation.test.tsx`
Expected: PASS (all tests in both files green).

- [ ] **Step 6: Manual browser verification**

Start the dev server (`.claude/launch.json` → `ledger-dev`, port 5174), set viewport to 375px, and load `#/`, `#/budget`, `#/investments`, `#/planner`, `#/compensation`, `#/planner/salary-tax`. Confirm content now uses ~16px side gutters (not ~40px) and nothing is clipped at the right edge. Confirm desktop (≥768px) still looks correctly inset.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Budgeting.tsx src/pages/Investments.tsx src/pages/Compensation.tsx src/pages/Planner.tsx src/pages/PlannerTool.tsx src/pages/Planner.test.tsx src/pages/Compensation.test.tsx
git commit -m "fix(mobile): remove duplicated page-root padding so main owns the gutter"
```

---

## Task 2: Equalize and truncate the mobile bottom nav (Audit M1)

**Problem:** The bottom tab bar (`Layout.tsx:142-174`) has 6 flex items. Because each `<Link>`/`<button>` defaults to `min-width: auto` (min-content), the single unbreakable word "Compensation" forces a 64px cell while the others shrink to 51px at 320px, so icons are unevenly spaced. Adding `min-w-0` lets every cell become a true equal `flex-1`, and `truncate` on the label prevents any future wrap/overflow.

**Files:**
- Modify: `src/components/Layout.tsx:148-173` (the mobile `nav[aria-label="Primary"]` items)
- Test: `src/components/Layout.test.tsx` (append)

**Interfaces:**
- Consumes: `navItems` array (already defined at `Layout.tsx:59-65`), unchanged.
- Produces: no API change.

- [ ] **Step 1: Write the failing test**

Append to `src/components/Layout.test.tsx`:

```tsx
describe('Layout mobile bottom nav sizing', () => {
  it('gives every tab an equal, shrinkable, truncation-safe cell', () => {
    render(<MemoryRouter><Layout /></MemoryRouter>)
    const bar = screen.getByRole('navigation', { name: 'Primary' })
    const cells = Array.from(bar.children) as HTMLElement[]
    expect(cells.length).toBe(6) // 5 links + Settings button
    for (const cell of cells) {
      const classes = cell.className.split(/\s+/)
      expect(classes).toContain('flex-1')
      expect(classes).toContain('min-w-0') // lets the cell shrink below its label's min-content width
    }
    // each label is truncation-safe
    const labels = bar.querySelectorAll('.truncate')
    expect(labels.length).toBe(6)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Layout.test.tsx -t "equal, shrinkable"`
Expected: FAIL. Cells lack `min-w-0`; there are no `.truncate` labels.

- [ ] **Step 3: Implement equal + truncation-safe cells**

In `src/components/Layout.tsx`, update the mobile nav `<Link>` (lines 152-162) and Settings `<button>` (lines 165-173). Add `min-w-0` to each cell's class list and wrap each label text in a truncating span.

Link (replace lines 152-163):
```tsx
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[52px] text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${
                isActive ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="max-w-full truncate px-0.5">{item.name}</span>
            </Link>
```

Settings button (replace lines 165-173):
```tsx
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[52px] text-[10px] font-medium text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <Settings className="w-5 h-5" />
          <span className="max-w-full truncate px-0.5">Settings</span>
        </button>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/Layout.test.tsx`
Expected: PASS (existing Layout tests stay green; new one passes).

- [ ] **Step 5: Manual browser verification at 320px**

Set viewport to 320×700. Confirm all 6 tab cells are equal width and icons are evenly spaced; "Compensation"/"Investments" truncate with an ellipsis rather than forcing a wide cell, and no label wraps to a second line.

- [ ] **Step 6: Commit**

```bash
git add src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "fix(mobile): equalize bottom-nav cells with min-w-0 and truncation"
```

---

## Task 3: Dashboard account rows — 44px tap targets and name truncation (Audit M4 + L1)

**Problem:** Edit/Remove icon buttons render ~30×30px and the account name span has no truncation (`AccountCategoryWidget.tsx:63-81`). Bump the icon buttons to a ≥44px hit area and make the name truncate so long names cannot break the row.

**Files:**
- Modify: `src/components/dashboard/AccountCategoryWidget.tsx:62-82`
- Test: `src/components/dashboard/AccountCategoryWidget.test.tsx` (update existing assertions)

**Interfaces:**
- Consumes: `useAccountsStore` (unchanged).
- Produces: no API change.

- [ ] **Step 1: Update the existing test to require 44px targets and truncation**

Replace the body of the `it('renders touch-visible, padded edit/remove buttons', ...)` test in `src/components/dashboard/AccountCategoryWidget.test.tsx` with:

```tsx
  it('renders touch-visible edit/remove buttons with >=44px hit areas', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Chequing', value: 1200, type: 'bank' }],
    })
    render(<AccountCategoryWidget title="Bank" type="bank" />)
    const edit = screen.getByLabelText('Edit account')
    const remove = screen.getByLabelText('Remove account')
    for (const btn of [edit, remove]) {
      const classes = btn.className.split(/\s+/)
      expect(classes).toContain('min-h-[44px]')
      expect(classes).toContain('min-w-[44px]')
      expect(classes).not.toContain('opacity-0') // bare opacity-0 would hide it on touch
      expect(classes).toContain('sm:opacity-0')
      expect(classes).toContain('sm:group-hover:opacity-100')
    }
  })

  it('truncates long account names so the row cannot break', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Joint Savings for the Big 2026 Vacation Fund', value: 1200, type: 'bank' }],
    })
    render(<AccountCategoryWidget title="Bank" type="bank" />)
    const name = screen.getByText(/Joint Savings/)
    expect(name.className.split(/\s+/)).toContain('truncate')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/dashboard/AccountCategoryWidget.test.tsx`
Expected: FAIL. Buttons lack `min-h-[44px]`/`min-w-[44px]`; name span lacks `truncate`.

- [ ] **Step 3: Implement 44px targets and name truncation**

In `src/components/dashboard/AccountCategoryWidget.tsx`, replace the account-row markup (lines 62-83) with:

```tsx
                <div key={acc.id} className="flex justify-between items-center gap-2 group">
                  <span className="text-sm text-text-secondary truncate min-w-0">{acc.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-medium text-text-primary">
                      ${acc.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <button
                      onClick={() => handleEdit(acc)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary/50 hover:text-accent sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded-md"
                      aria-label="Edit account"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => removeAccount(acc.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary/50 hover:text-error sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded-md"
                      aria-label="Remove account"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
```

Notes: the negative margins (`-m-1`) are removed in favor of explicit `min-h/min-w-[44px]` + centered flex, which is the real hit area. `gap-1` (not `gap-2`) keeps the two 44px buttons from over-widening the row; the name `truncate min-w-0` + group `shrink-0` guarantees the amount and actions stay put.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/dashboard/AccountCategoryWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Manual browser verification**

At 375px on `#/` with seeded accounts, confirm: (a) tapping the edit/remove icons is comfortable (no mis-taps), (b) a long account name ellipsizes instead of wrapping, and (c) on desktop hover-reveal of the icons still works.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/AccountCategoryWidget.tsx src/components/dashboard/AccountCategoryWidget.test.tsx
git commit -m "fix(mobile): 44px account-row tap targets and truncated account names"
```

---

## Task 4: Salary & Tax bracket bars stay legible on mobile (Audit M2)

**Problem:** In `BracketBar` (`SalaryTaxTool.tsx:26-59`), each segment's width is proportional to bracket dollar size, so open-ended top brackets become slivers whose `truncate` caption ("$117,045+") is cut, losing the "+", and whose rate label is hidden below a 44px segment. Fix: give every segment a minimum width (so the caption always fits and the 44px container-query threshold is always met), drop `truncate` from the caption, and wrap the row in a horizontal-scroll container so a very narrow viewport scrolls instead of clipping.

**Files:**
- Modify: `src/components/planner/SalaryTaxTool.tsx:36-59`
- Test: `src/components/planner/SalaryTaxTool.test.tsx` (append; verify the existing container-query test still passes)

**Interfaces:**
- Consumes: `BracketBar` props `{ title: string; brackets: Bracket[]; income: number }` (unchanged, already exported).
- Produces: no API change. Rate label keeps its `hidden @min-[44px]:flex` + `@container` classes (the existing test at `SalaryTaxTool.test.tsx:19-22` must remain green); the minimum width simply guarantees the query resolves true.

- [ ] **Step 1: Write the failing test**

Append to `src/components/planner/SalaryTaxTool.test.tsx`:

```tsx
  it('keeps the open-ended bracket caption intact (no truncation of the "+")', () => {
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
    const caption = screen.getByText('$114,750+')
    const classes = caption.className.split(/\s+/)
    expect(classes).not.toContain('truncate') // truncation would drop the trailing "+"
    // every segment carries a minimum width so labels fit and the 44px rate-label query resolves
    const segment = caption.parentElement as HTMLElement
    expect(segment.style.minWidth).not.toBe('')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/planner/SalaryTaxTool.test.tsx -t "open-ended bracket caption"`
Expected: FAIL. The caption still has `truncate` and the segment has no inline `minWidth`.

- [ ] **Step 3: Implement min-width segments, no caption truncation, and scroll fallback**

In `src/components/planner/SalaryTaxTool.tsx`, replace the bar container + segment markup (lines 38-58) with:

```tsx
      <div className="w-full overflow-x-auto">
        <div className="flex w-full gap-1 min-w-full">
          {segments.map((s) => {
            const width = ((s.end - s.start) / cap) * 100
            const filledTo = Math.min(Math.max(income - s.start, 0), s.end - s.start)
            const filledPct = (s.end - s.start > 0 ? filledTo / (s.end - s.start) : 0) * 100
            const active = income > s.start
            return (
              <div key={s.start} className="flex flex-col gap-1 shrink-0" style={{ width: `${width}%`, minWidth: '3.5rem' }}>
                <div className={`@container relative h-7 rounded-md overflow-hidden border ${active ? 'border-accent/60' : 'border-border'} bg-bg-primary/40`}
                     title={`${(s.rate * 100).toFixed(2)}% on ${formatMoney(s.start)} to ${formatMoney(s.end)}`}>
                  <div className="absolute inset-y-0 left-0 bg-accent/60" style={{ width: `${filledPct}%` }} />
                  <span className="absolute inset-0 hidden @min-[44px]:flex items-center justify-center text-[11px] font-medium text-text-primary">
                    {(s.rate * 100).toFixed(1)}%
                  </span>
                </div>
                <span className="text-[10px] text-text-secondary text-center whitespace-nowrap">
                  {formatMoney(s.start)}{s.end < cap ? ` to ${formatMoney(s.end)}` : '+'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
```

Key changes vs. the original: outer `overflow-x-auto` wrapper; inner row keeps `min-w-full`; each segment gains `shrink-0` + `minWidth: '3.5rem'` (56px, wider than the ~49px caption); the caption swaps `truncate` for `whitespace-nowrap` so the "+" is never cut. The `@container` / `@min-[44px]:flex` rate label is unchanged, so `SalaryTaxTool.test.tsx:19-22` still holds.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/planner/SalaryTaxTool.test.tsx`
Expected: PASS (both the original container-query test and the new caption test).

- [ ] **Step 5: Manual browser verification**

At 375px and 320px on `#/planner/salary-tax`, confirm every bracket shows its full boundary label (including the trailing "+") and its rate %. If the segments exceed the width, the bar scrolls horizontally inside its own container without the page scrolling.

- [ ] **Step 6: Commit**

```bash
git add src/components/planner/SalaryTaxTool.tsx src/components/planner/SalaryTaxTool.test.tsx
git commit -m "fix(mobile): keep tax-bracket labels legible with min-width segments and scroll fallback"
```

---

## Task 5: Gate Dashboard widget drag-to-reorder to desktop (Audit M3)

**Problem:** `Dashboard.tsx:99-113` uses native HTML5 `draggable`/`onDragStart`, which does not fire on touch. On mobile the `cursor-grab` affordance is a lie and reordering is impossible. Gate the drag props and grab cursor behind `useIsDesktop()` so mobile simply renders static widgets (no dead affordance). A touch-based reorder is out of scope for this pass.

**Files:**
- Modify: `src/pages/Dashboard.tsx:1,45-50,96-118`
- Test: `src/pages/Dashboard.test.tsx` (create)

**Interfaces:**
- Consumes: `useIsDesktop()` from `src/hooks/useMediaQuery.ts` (returns boolean; `(min-width: 768px)`).
- Produces: no API change.

- [ ] **Step 1: Write the failing test**

Create `src/pages/Dashboard.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { setMatchMedia, resetMatchMedia } from '../test-utils/matchMedia'
import { Dashboard } from './Dashboard'

afterEach(() => resetMatchMedia())

describe('Dashboard widget drag gating', () => {
  it('does not mark widgets draggable on mobile', () => {
    setMatchMedia(false) // mobile: useIsDesktop() === false
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const draggables = container.querySelectorAll('[draggable="true"]')
    expect(draggables.length).toBe(0)
  })

  it('marks widgets draggable on desktop', () => {
    setMatchMedia(true) // desktop
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const draggables = container.querySelectorAll('[draggable="true"]')
    expect(draggables.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: FAIL on the mobile case — widgets are currently always `draggable`.

> If Dashboard fails to render in jsdom because a child widget throws (charts), narrow the test: render and assert on the specific wrapper divs that exist, or mock the offending widget module with `vi.mock`. Prefer fixing the render over deleting the assertion.

- [ ] **Step 3: Implement desktop-gated drag**

In `src/pages/Dashboard.tsx`:

Add the import near the other imports (after line 13):
```tsx
import { useIsDesktop } from '../hooks/useMediaQuery';
```

Inside the component, after line 50 (`const setOrder = ...`):
```tsx
  const isDesktop = useIsDesktop();
```

Replace the draggable wrapper `<div>` (lines 99-115) so drag props and grab cursor only apply on desktop:
```tsx
            <div
              key={id}
              draggable={isDesktop}
              onDragStart={isDesktop ? () => setDragId(id) : undefined}
              onDragOver={isDesktop ? (e) => e.preventDefault() : undefined}
              onDrop={isDesktop ? () => {
                if (dragId && dragId !== id) {
                  if (storedOrder.length === 0) setOrder(orderedIds); // materialize default before first move
                  moveWidget(dragId, id);
                }
                setDragId(null);
              } : undefined}
              onDragEnd={isDesktop ? () => setDragId(null) : undefined}
              className={`h-full ${WIDGET_SPAN[id] ?? ''} ${isDesktop ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === id ? 'opacity-50' : ''}`}
            >
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: PASS (both mobile and desktop cases).

- [ ] **Step 5: Manual browser verification**

At 375px on `#/`, confirm widgets do not show a grab cursor and long-press does not start a ghost drag. At ≥768px, confirm drag-to-reorder still works and persists.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx
git commit -m "fix(mobile): gate dashboard widget drag-reorder to desktop pointers"
```

---

## Task 6: De-duplicate the Budget month controls and compact the header (Audit H2)

**Problem:** On mobile the Budgeting `<header>` (`Budgeting.tsx:54-117`) balloons to ~246px and shows two month controls: a "This month" `ThemedSelect` (with a chevron) and a separate `‹ July 2026 ›` arrow stepper (two more chevrons). The clustered chevrons read as duplicate icons. This task keeps the arrow stepper as the mobile month navigator (it supports arbitrary-month browsing + Today), hides the range/preset dropdown below `md`, enlarges the arrow tap targets to 44px, gives the dropdown an accessible name (Audit L2), and makes the CSV button icon-only below `sm`.

> **Product note / accepted consequence:** hiding the dropdown below `md` removes the multi-month range presets (Last 3/6/12, YTD) on mobile in this iteration; the stepper covers single-month browsing, which is the primary mobile task. A follow-up can add a compact mobile range toggle if needed. Confirm this trade-off is acceptable before implementing; if instead you want the dropdown kept and the stepper hidden, swap the `hidden md:flex` / `hidden md:block` targets accordingly.

**Files:**
- Modify: `src/pages/Budgeting.tsx:61-116`
- Modify: `src/components/budget/CSVUploader.tsx:122-129`
- Test: `src/pages/Budgeting.test.tsx` (create), `src/components/budget/CSVUploader.test.tsx` (append if the file exists; otherwise fold the CSV assertion into the Budgeting test)

**Interfaces:**
- Consumes: `ThemedSelect` `ariaLabel` prop (`ThemedSelect.tsx:86`); `useIsDesktop()` is NOT needed here (use Tailwind `md:` prefixes for pure show/hide).
- Produces: no API change.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Budgeting.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Budgeting } from './Budgeting'

function renderBudget() {
  return render(<MemoryRouter><Budgeting /></MemoryRouter>)
}

describe('Budgeting header (mobile de-duplication)', () => {
  it('labels the period dropdown for screen readers', () => {
    renderBudget()
    // ThemedSelect trigger exposes aria-label as its accessible name
    expect(screen.getByRole('button', { name: 'Time period' })).toBeInTheDocument()
  })

  it('hides the range dropdown below md so only one month control shows on mobile', () => {
    const { container } = renderBudget()
    const trigger = screen.getByRole('button', { name: 'Time period' })
    // the dropdown wrapper is hidden on mobile, shown from md up
    const wrapper = trigger.closest('[data-period-dropdown]') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).toMatch(/hidden/)
    expect(wrapper.className).toMatch(/md:block/)
  })

  it('gives the month arrows >=44px hit areas', () => {
    renderBudget()
    for (const label of ['Previous Month', 'Next Month']) {
      const btn = screen.getByLabelText(label)
      const classes = btn.className.split(/\s+/)
      expect(classes).toContain('min-h-[44px]')
      expect(classes).toContain('min-w-[44px]')
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/Budgeting.test.tsx`
Expected: FAIL. No `Time period` accessible name; no `data-period-dropdown` wrapper; arrows lack min sizes.

- [ ] **Step 3: Implement the header changes**

In `src/pages/Budgeting.tsx`:

(a) Wrap the `ThemedSelect` (lines 62-81) in a `div` that is hidden below `md`, and give the select an `ariaLabel`. Replace lines 62-81 with:
```tsx
          <div data-period-dropdown className="hidden md:block">
            <ThemedSelect
              ariaLabel="Time period"
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
          </div>
```

(b) Enlarge the two arrow buttons (lines 84-90 and 92-98). Replace each button's `className` `p-1.5 rounded-md ...` with a 44px hit area:
```tsx
              <button
                onClick={() => shiftMonth(-1)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-bg-primary text-text-secondary hover:text-accent transition-all duration-200"
                aria-label="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
```
```tsx
              <button
                onClick={() => shiftMonth(1)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-bg-primary text-text-secondary hover:text-accent transition-all duration-200"
                aria-label="Next Month"
              >
                <ChevronRight size={16} />
              </button>
```

- [ ] **Step 4: Make the CSV import button icon-only below `sm`**

In `src/components/budget/CSVUploader.tsx`, replace the button text (line 128) so the label collapses to the icon on narrow screens:
```tsx
        <Upload size={16} />
        <span className="hidden sm:inline">{isParsing ? 'Parsing...' : 'Import CSV'}</span>
```

Add an accessible name to the button so it is not icon-only-with-no-label for screen readers. Update the `<button>` opening tag (line 122-126) to include `aria-label`:
```tsx
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isParsing}
        aria-label="Import CSV"
        className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[14px] font-medium hover:border-[var(--color-accent)] transition-colors disabled:opacity-50"
      >
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/Budgeting.test.tsx`
Expected: PASS. Also run any existing CSVUploader test to confirm no regression: `npx vitest run src/components/budget/CSVUploader.test.tsx` (skip if the file does not exist).

- [ ] **Step 6: Manual browser verification**

At 375px on `#/budget`: confirm only the arrow stepper (`‹ July 2026 ›`) shows for month control (no dropdown), the arrows are comfortably tappable, "Import CSV" shows as an icon-only button, and the header is materially shorter than before (target < ~130px). At ≥768px: confirm the dropdown reappears and the header matches the previous desktop layout.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Budgeting.tsx src/components/budget/CSVUploader.tsx src/pages/Budgeting.test.tsx
git commit -m "fix(mobile): de-duplicate budget month controls, compact header, label period select"
```

---

## Task 7: Remove the overflow-hidden that can trap TransactionModal scroll (Audit needs-verify #2)

> **Superseded by Task 10.** Task 10 removes/`md:`-prefixes `overflow-hidden` on both `TransactionModal` and `AddAccountModal` as part of the broader mobile-sheet panel-hygiene fix. Skip this task and do Task 10 instead; it is kept here only for traceability to the original audit item.

**Problem:** `TransactionModal` passes `overflow-hidden` in its `Sheet` `panelClassName` (`TransactionModal.tsx:152`). The mobile bottom-sheet variant sets `overflow-y-auto` on the same element (`Sheet.tsx:228`); depending on compiled CSS order, `overflow-hidden` may win and prevent a tall transaction form from scrolling on a short phone. Removing `overflow-hidden` from the modal's panel class is a safe fix (the sheet already provides the correct overflow and rounding).

**Files:**
- Modify: `src/components/budget/TransactionModal.tsx:152`
- Test: `src/components/budget/TransactionModal.test.tsx` (append if present) or manual verification

**Interfaces:**
- Consumes: `Sheet` (unchanged).
- Produces: no API change.

- [ ] **Step 1: Verify the current behavior in the browser first**

At 375px with a short viewport (set height to ~500px) on `#/budget`, open "Add Transaction" and confirm whether the form scrolls to reach the submit button. Note the result (scrolls / clipped) before changing anything.

- [ ] **Step 2: Write/append a guard test (if a TransactionModal test file exists)**

If `src/components/budget/TransactionModal.test.tsx` exists, append:

```tsx
  it('does not pass overflow-hidden to the Sheet panel (would trap mobile scroll)', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    const panel = document.querySelector('[data-testid="transaction-modal-panel"]') as HTMLElement | null
    // if no test id is wired, assert via the dialog role container instead:
    const el = panel ?? (document.querySelector('[role="dialog"]') as HTMLElement)
    expect(el.className.split(/\s+/)).not.toContain('overflow-hidden')
  })
```

> If the modal panel is not easily queryable (Sheet may not set `role="dialog"` on the panel), skip the automated assertion and rely on Step 1 + Step 4 manual verification. Do not invent a selector that does not exist.

- [ ] **Step 3: Remove `overflow-hidden` from the panel class**

In `src/components/budget/TransactionModal.tsx:152`, change:
```tsx
      panelClassName="w-full max-w-md bg-[var(--color-bg-primary)] rounded-xl shadow-lg border border-[var(--color-border)]"
```
(drop only the `overflow-hidden` token; keep everything else).

- [ ] **Step 4: Manual browser verification**

Repeat Step 1 at ~500px height. Confirm the transaction form now scrolls within the sheet and the submit button is reachable. Confirm desktop modal still looks correct (rounded corners intact).

- [ ] **Step 5: Run the relevant test file (if one was edited) and commit**

Run: `npx vitest run src/components/budget/TransactionModal.test.tsx` (skip if not edited)
Expected: PASS.

```bash
git add src/components/budget/TransactionModal.tsx src/components/budget/TransactionModal.test.tsx
git commit -m "fix(mobile): drop overflow-hidden so transaction sheet scrolls on short screens"
```

---

## Task 8: Populated-data overflow audit (Audit needs-verify #3) — verification only

**Problem:** All widgets were audited only in their empty state. Data-heavy widgets are the most likely remaining mobile-overflow offenders. This task is a manual verification sweep with data; it produces code changes ONLY if a real overflow is found (each such fix should then get its own TDD task appended to this plan).

**Files:**
- No code changes unless an issue is found.

- [ ] **Step 1: Seed real data**

In the running app at 375px, add a handful of transactions (via "Add Transaction") across several categories for the current month, and import a sample CSV from `csv-examples/` if available, so the following widgets render populated.

- [ ] **Step 2: Check each data-heavy surface for horizontal overflow at 375px and 320px**

For each, confirm `document.documentElement.scrollWidth === window.innerWidth` (no page-level horizontal scroll) and that wide content scrolls inside its own container:
- Budget → Overview: Cash Flow / Sankey (`CashFlowWidget`), Budget vs. Actual (`BudgetProgressWidget`), Savings Rate (`SavingsRateWidget`).
- Budget → Insights: Spending Heatmap, Category Trends, Subscriptions, Anomaly Alerts.
- Budget → Transactions: `TransactionListWidget` (a table — confirm it scrolls in its own `overflow-x-auto`, not the page).
- Planner → Net-Worth / FIRE Forecaster charts (Recharts).
- Investments → Portfolio / Options tables and stat rows.

- [ ] **Step 3: Record findings**

For any surface that overflows or clips, note the component and the offending element, then append a new TDD task to this plan (same structure as Tasks 1-7) to fix it. If none overflow, note "populated-data sweep clean at 375/320" in the commit message of the final task or in `MOBILE_AUDIT.md`.

- [ ] **Step 4 (optional): Update the audit doc**

If the sweep is clean, mark needs-verify item #3 resolved in `MOBILE_AUDIT.md`. Commit:
```bash
git add MOBILE_AUDIT.md
git commit -m "docs(mobile): mark populated-data overflow sweep complete"
```

---

---

# Addendum: fixes from user screenshot review (2026-07-22)

The user tested a narrow **desktop window** (roughly 640–767px wide) — wide enough that the app is in its mobile layout (bottom tab bar, no sidebar) but in a breakpoint band the original audit (done at 375px) did not exercise. Screenshots surfaced four issues, three of them new:

- **F1 — Bottom nav clips page content (screenshots 4, 5).** Confirmed by measurement: at 700px the mobile nav is 53px tall but `main`'s `padding-bottom` is only 32px, a 21px deficit, so the last element (often a button or a chart caption) hides behind the nav. Root cause: `main`'s `sm:p-8` sets `padding-bottom: 32px` at ≥640px, and that responsive utility overrides the base `pb-[calc(52px+…)]` nav-clearance (responsive variants come later in the cascade). Below 640px `sm:p-8` doesn't apply, so `pb` is the full 68px and content clears the nav — which is why the 375px audit missed it. → **Task 9**.
- **F2 — Duplicate close button + panel-style leak (screenshots 1, 2). This is the "double icon" the user meant.** The mobile `Sheet` renders its own drag-handle header with a Close "×" (`Sheet.tsx:239-251`), but every modal ALSO renders its own header "×" for the desktop variant (which shows no Sheet header). On mobile both appear, stacked and slightly misaligned. Compounding it, each modal's desktop-oriented `panelClassName` (`p-5`/`p-6`, `rounded-lg/xl`, `overflow-hidden`, and in one case a fixed `w-[400px]`) leaks onto the mobile sheet, double-padding it and fighting the sheet's own chrome. → **Task 10** (supersedes Task 7).
- **F3 — Forecaster Monte Carlo cards look misaligned/disorganized (screenshot 4).** `MonteCarloSection.tsx:49` lays out three items (one input + two stat cards) in `grid-cols-2 md:grid-cols-3 … items-end`. At 640–767px it is 2 columns, so the third card orphans onto a second row with an empty cell, and `items-end` drops the shorter input to the bottom of its cell, leaving a gap above it. → **Task 11**.
- **F4 — Budget header crowded/disorganized (screenshot 3).** Already addressed: Task 1 (remove doubled padding) + Task 6 (de-duplicate month controls, compact actions). No new task; verify it during Task 6's manual check at 700px as well as 375px.

---

## Task 9: Fix bottom-nav clipping of page content (F1)

**Problem:** `main`'s `sm:p-8` clobbers the base `pb-[calc(52px+env(safe-area-inset-bottom)+16px)]` nav-clearance at ≥640px, so between 640px and 767px only 32px of bottom padding is reserved against a ~53px nav and bottom content is cut off. Fix: stop the all-sides `p-*` shorthands from owning `padding-bottom`; let the calc (and `md:pb-8`) own it exclusively. This matters even more after Task 1, since page roots no longer add their own bottom padding.

**Files:**
- Modify: `src/components/Layout.tsx:134`
- Test: `src/components/Layout.test.tsx` (append)

**Interfaces:**
- Produces: `main` reserves nav-height + 16px of bottom padding at every width below `md`, regardless of the `sm` horizontal padding.

- [ ] **Step 1: Write the failing test**

Append to `src/components/Layout.test.tsx` (inside the existing `describe('Layout mobile chrome', …)` or a new one):

```tsx
it('keeps nav clearance from being overridden by sm padding', () => {
  const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
  const main = container.querySelector('main')!
  const classes = main.className.split(/\s+/)
  expect(main.className).toMatch(/pb-\[calc\(/)      // nav-clearance retained
  expect(classes).not.toContain('sm:p-8')            // all-sides sm padding would clobber pb
  expect(classes).not.toContain('p-4')               // all-sides base padding would clobber pb too
  expect(classes).toContain('sm:px-8')               // horizontal sm padding split out
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Layout.test.tsx -t "nav clearance"`
Expected: FAIL. `main` currently has `p-4 sm:p-8`.

- [ ] **Step 3: Split the padding so bottom is owned by the calc**

In `src/components/Layout.tsx:134`, change the `<main>` className from:
```tsx
      <main className="flex-1 min-w-0 overflow-auto overflow-x-hidden p-4 sm:p-8 relative z-10 pb-[calc(52px+env(safe-area-inset-bottom)+16px)] md:pb-8">
```
to:
```tsx
      <main className="flex-1 min-w-0 overflow-auto overflow-x-hidden px-4 pt-4 sm:px-8 sm:pt-8 relative z-10 pb-[calc(52px+env(safe-area-inset-bottom)+16px)] md:pb-8">
```
Now horizontal + top padding stay responsive (`px-4 pt-4 sm:px-8 sm:pt-8`) while bottom padding is owned solely by `pb-[calc(…)]` (below `md`) and `md:pb-8` (at/above `md`, where the nav is hidden).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/Layout.test.tsx`
Expected: PASS (existing Layout tests stay green).

- [ ] **Step 5: Manual browser verification at the failing width**

Set the viewport to **700×760** (the band that broke). Load `#/planner/salary-tax` and `#/compensation`, scroll to the very bottom, and confirm the last control/button/caption sits fully **above** the bottom nav with a small gap. Re-check at 375px and 320px (should still clear). At ≥768px confirm the sidebar layout is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "fix(mobile): reserve bottom-nav clearance across the sm breakpoint band"
```

---

## Task 10: Remove the duplicate close button and panel-style leak in mobile sheets (F2) — supersedes Task 7

**Problem:** On mobile, the `Sheet` renders its own drag-handle header with a Close "×", but each modal also renders its own header "×" (for the desktop variant, which has no Sheet header), so two "×" icons appear (the reported "double icon"). Additionally, each modal's desktop `panelClassName` leaks padding/rounding/`overflow-hidden`/fixed-width onto the mobile sheet, causing double padding and misalignment. Fix in two parts: (10a) give `Sheet` an optional `title` and let it own the mobile header; (10b) migrate each modal to pass `title`, hide its own header below `md`, and `md:`-prefix its desktop-only panel chrome.

**Files:**
- Modify: `src/components/ui/Sheet.tsx` (add `title` prop; render it in the mobile header)
- Modify: `src/components/settings/SettingsSheet.tsx`, `src/components/dashboard/AddAccountModal.tsx`, `src/components/budget/TransactionModal.tsx`, `src/components/ui/WhatsNewModal.tsx`, `src/components/budget/CSVUploader.tsx` (double-"×" + panel leak)
- Modify (padding leak only, no double-"×"): `src/components/ui/ConfirmDialog.tsx`, `src/components/ui/DisclaimerModal.tsx`
- Test: `src/components/ui/Sheet.test.tsx` (append); `src/components/dashboard/AddAccountModal.test.tsx` (append representative modal guard)

**Interfaces:**
- Produces: `Sheet` gains `title?: React.ReactNode`. On mobile the sheet header shows `title` (left), the drag handle (centered), and the single Close "×" (right). On desktop `title` is ignored (callers keep their own headers). Consumers must not render their own close control on mobile.

### Part 10a — Sheet owns the mobile header

- [ ] **Step 1: Write the failing Sheet test**

Append to `src/components/ui/Sheet.test.tsx`:

```tsx
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

describe('Sheet mobile header ownership', () => {
  afterEach(() => resetMatchMedia())

  it('renders exactly one close control and the title on mobile', () => {
    setMatchMedia(false) // mobile => bottom sheet
    render(
      <Sheet open onClose={() => {}} title="Add account">
        <div>body</div>
      </Sheet>,
    )
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Add account' })).toBeInTheDocument()
  })
})
```

> Match the existing `Sheet.test.tsx` import style for `render`/`screen`/`Sheet`. If a global `afterEach(resetMatchMedia)` already exists in the file, don't add a second.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ui/Sheet.test.tsx -t "one close control and the title"`
Expected: FAIL. `Sheet` has no `title` prop, so no heading renders.

- [ ] **Step 3: Add the `title` prop and render it in the mobile header**

In `src/components/ui/Sheet.tsx`:

(a) Add to `SheetProps` (place the prop and move the stale comment off `children`):
```tsx
  /** Optional title shown in the mobile sheet header row (desktop ignores it; callers keep their own headers). */
  title?: React.ReactNode
  /** Extra classes for the panel container (e.g. max-width on desktop modal). */
  panelClassName?: string
  children: React.ReactNode
```

(b) Destructure it (add `title` to the props list around line 41):
```tsx
  ariaLabel,
  labelledBy,
  title,
  panelClassName = '',
  children,
```

(c) Replace the mobile sticky header block (lines 239-251) with a version that shows the title, centers the grab handle, and keeps a single close button:
```tsx
            <div className="sticky top-0 z-10 relative flex items-center gap-2 px-4 pt-4 pb-2 bg-[var(--dropdown-bg)]">
              <span className="absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
              {title != null && (
                <h2 className="flex items-center gap-2 text-[16px] font-semibold text-text-primary">{title}</h2>
              )}
              {dismissible && (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="ml-auto p-1 text-text-secondary hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
```

- [ ] **Step 4: Run the Sheet test to verify it passes**

Run: `npx vitest run src/components/ui/Sheet.test.tsx`
Expected: PASS (existing Sheet tests stay green).

- [ ] **Step 5: Commit part 10a**

```bash
git add src/components/ui/Sheet.tsx src/components/ui/Sheet.test.tsx
git commit -m "feat(sheet): optional title so the mobile sheet owns its header"
```

### Part 10b — Migrate each modal

Apply the **same three edits** to each modal: (1) add `title=…` to its `Sheet`, (2) prefix its own header row with `hidden md:` so it renders only on desktop, (3) `md:`-prefix desktop-only panel chrome (`p-*`, `rounded-*`, `overflow-hidden`, fixed widths) in `panelClassName`. Exact per-file class strings below.

- [ ] **Step 6: Write the representative failing test (AddAccountModal)**

Append to `src/components/dashboard/AddAccountModal.test.tsx`:

```tsx
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

describe('AddAccountModal mobile header (no double close)', () => {
  afterEach(() => resetMatchMedia())

  it('shows one close control on mobile and hides its own header there', () => {
    setMatchMedia(false)
    const { container } = render(<AddAccountModal isOpen onClose={() => {}} defaultType="bank" editingAccount={null} />)
    // Sheet provides the only close button
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1)
    // the modal's own header row is desktop-only
    const ownHeader = container.querySelector('.border-b')
    expect(ownHeader?.className).toMatch(/\bhidden\b/)
    expect(ownHeader?.className).toMatch(/md:flex/)
  })
})
```

> Give the AddAccountModal close button `aria-label="Close"` in Step 8 so exactly one "Close" button exists on mobile (its own header, hidden on mobile, must also carry the label so the desktop count stays correct at 1 there too). Match the file's existing render/import setup.

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run src/components/dashboard/AddAccountModal.test.tsx -t "one close control on mobile"`
Expected: FAIL. Two "Close"-ish buttons (or the own header lacks `hidden md:flex`).

- [ ] **Step 8: Edit AddAccountModal**

`src/components/dashboard/AddAccountModal.tsx`:
- Add `title={editingAccount ? 'Edit Account' : 'Add Account'}` to the `<Sheet>` props (after `ariaLabel`, line 69).
- `panelClassName` (line 70): `md:`-prefix rounding + overflow:
```tsx
      panelClassName="bg-bg-primary border border-border md:rounded-xl shadow-xl w-full max-w-md md:overflow-hidden flex flex-col"
```
- Header row (line 72) and give the close button an `aria-label`:
```tsx
        <div className="hidden md:flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">{editingAccount ? 'Edit Account' : 'Add Account'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded">
            <X size={20} />
          </button>
        </div>
```

- [ ] **Step 9: Run the AddAccountModal test to verify it passes**

Run: `npx vitest run src/components/dashboard/AddAccountModal.test.tsx`
Expected: PASS.

- [ ] **Step 10: Edit the remaining modals (same recipe, exact strings)**

`src/components/settings/SettingsSheet.tsx`:
- Add to `<Sheet>` (after `ariaLabel`, line 40): `title={<><Settings className="w-5 h-5 text-accent" aria-hidden="true" /> Settings</>}`
- `panelClassName` (line 41): `panelClassName="themed-menu md:rounded-lg w-full max-w-md md:p-5 flex flex-col gap-3 md:max-h-[85dvh] md:overflow-y-auto"`
- Own header (line 43): `<div className="hidden md:flex items-center justify-between">` (the block lines 43-54).

`src/components/budget/TransactionModal.tsx`:
- Add to `<Sheet>` (after `ariaLabel`): `title={initialTransaction ? 'Edit Transaction' : 'Add Transaction'}`
- `panelClassName` (line 152): `panelClassName="w-full max-w-md bg-[var(--color-bg-primary)] md:rounded-xl shadow-lg border border-[var(--color-border)] md:overflow-hidden"`
- Own header (line 154): `<div className="hidden md:flex items-center justify-between p-4 border-b border-[var(--color-border)]">`

`src/components/ui/WhatsNewModal.tsx`:
- Add to `<Sheet>` (after `ariaLabel`): `title={<><Sparkles className="w-5 h-5 text-accent" aria-hidden="true" /> What's New · v{__APP_VERSION__}</>}`
- `panelClassName` (line 69): `panelClassName="themed-menu md:rounded-lg w-full max-w-2xl md:p-6 flex flex-col gap-1"`
- Own header (line 70): `<div className="hidden md:flex items-center justify-between mb-2">`

`src/components/budget/CSVUploader.tsx` (the mapping sheet):
- Add to `<Sheet>` (after `ariaLabel`, line 136): `title="Map CSV Columns"`
- `panelClassName` (line 137) — also fixes the fixed `w-[400px]` that overflows a 375px screen: `panelClassName="bg-[var(--color-bg-primary)] md:p-6 md:rounded-lg w-full md:w-[400px] border border-[var(--color-border)] shadow-xl flex flex-col gap-4"`
- Own header (line 141): `<div className="hidden md:flex justify-between items-center">`

`src/components/ui/ConfirmDialog.tsx` and `src/components/ui/DisclaimerModal.tsx` (padding leak only — these have no own close button, so no double-"×"):
- ConfirmDialog: pass `title={title}` to `<Sheet>` and remove the now-duplicated `<h2>` at the top of the body (the Sheet renders it on mobile; on desktop keep it — so instead gate it: `<h2 className="hidden md:block text-[16px] font-semibold text-text-primary">{title}</h2>`). `panelClassName`: `themed-menu md:rounded-lg w-full max-w-sm md:p-5 flex flex-col gap-3`.
- DisclaimerModal: `panelClassName` `md:`-prefix its `p-6 rounded-lg` → `md:p-6 md:rounded-lg` (keep `w-full max-w-md`). It is non-dismissible so the Sheet shows no close button; a `title` is optional (pass `title="Disclaimer"` only if the modal's own heading is gated `hidden md:block`, otherwise leave both as-is).

- [ ] **Step 11: Manual browser verification (the key visual check)**

At **375px** and **700px**, open each modal and confirm exactly one "×" (top-right of the sheet), the title shows once, padding looks even (no doubled inset), and the top corners are rounded. Modals to open: Settings (bottom-nav), Add Account (Dashboard → any section "Add"), Add Transaction (Budget), What's New (Settings → version), Map CSV (Budget → Import CSV with an unrecognized file). Confirm each still scrolls to its submit button on a short (≤600px tall) viewport. At ≥768px confirm every modal looks exactly as before (own header visible, single "×").

- [ ] **Step 12: Run the full modal test set and commit**

Run: `npx vitest run src/components/ui/Sheet.test.tsx src/components/dashboard/AddAccountModal.test.tsx src/components/budget/TransactionModal.test.tsx src/components/settings`
Expected: PASS (skip any path without a test file).

```bash
git add src/components/settings/SettingsSheet.tsx src/components/dashboard/AddAccountModal.tsx src/components/dashboard/AddAccountModal.test.tsx src/components/budget/TransactionModal.tsx src/components/ui/WhatsNewModal.tsx src/components/budget/CSVUploader.tsx src/components/ui/ConfirmDialog.tsx src/components/ui/DisclaimerModal.tsx
git commit -m "fix(mobile): remove duplicate sheet close button and desktop panel-style leak"
```

---

## Task 11: Fix the forecaster Monte Carlo card misalignment (F3)

**Problem:** `MonteCarloSection.tsx:49` uses `grid grid-cols-2 md:grid-cols-3 gap-4 items-end` for three items (a Volatility input + two stat cards). At 640–767px it is 2 columns, so the third card orphans onto a second row (empty cell beside it) and `items-end` drops the shorter input to the bottom of its cell with a gap above. Fix: stack to a single column below `md` (no orphan, no float), keeping the 3-across desktop layout.

**Files:**
- Modify: `src/components/planner/forecaster/MonteCarloSection.tsx:49`
- Test: `src/components/planner/forecaster/MonteCarloSection.test.tsx` (append)

**Interfaces:**
- Consumes: unchanged props.
- Produces: no API change.

- [ ] **Step 1: Write the failing test**

Append to `src/components/planner/forecaster/MonteCarloSection.test.tsx` (match its existing render setup and required props):

```tsx
it('stacks the volatility control and stat cards in one column below md', () => {
  const { container } = render(
    <MonteCarloSection
      startBalance={100000} monthlySavings={1000} years={25}
      meanReturnPct={6} stdDevPct={15} stepUpPct={0}
      lumpSums={[]} target={1200000} onStdDevChange={() => {}}
    />,
  )
  const grid = container.querySelector('.grid') as HTMLElement
  const classes = grid.className.split(/\s+/)
  expect(classes).toContain('grid-cols-1') // stacked below md, no orphaned cell
  expect(classes).toContain('md:grid-cols-3')
  expect(classes).not.toContain('grid-cols-2')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/planner/forecaster/MonteCarloSection.test.tsx -t "one column below md"`
Expected: FAIL. Grid is `grid-cols-2 md:grid-cols-3`.

- [ ] **Step 3: Stack to one column below md**

In `src/components/planner/forecaster/MonteCarloSection.tsx:49`, change:
```tsx
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
```
to:
```tsx
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-end">
```
`grid-cols-1` removes the orphan; scoping `items-end` to `md:` avoids the floating-input gap when stacked.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/planner/forecaster/MonteCarloSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Manual browser verification**

At 700px and 375px on `#/planner/net-worth-forecaster` (scroll to the Monte Carlo section), confirm the Volatility input, "Chance of reaching" card, and "Median outcome" card stack cleanly in one column with no empty half-row and no floating gap. At ≥768px confirm the 3-across bottom-aligned row is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/planner/forecaster/MonteCarloSection.tsx src/components/planner/forecaster/MonteCarloSection.test.tsx
git commit -m "fix(mobile): stack forecaster monte-carlo controls to avoid orphaned/floating cards"
```

---

## Final verification

- [ ] **Run the full suite**

Run: `npx vitest run`
Expected: All tests pass (~627 + the new guards). Investigate any failure before proceeding — do not mark complete on a red suite.

- [ ] **Lint**

Run: `npm run lint`
Expected: no new errors from the touched files.

- [ ] **Full mobile pass**

At 375px and 320px, walk `#/`, `#/budget` (all four tabs), `#/investments`, `#/planner`, `#/planner/salary-tax`, `#/compensation`. Confirm: no page-level horizontal scroll, reclaimed side gutters, single month control on Budget, legible tax brackets, 44px tap targets, and even bottom-nav spacing.

---

## Self-Review (completed during authoring)

**Spec coverage vs. `MOBILE_AUDIT.md`:**
- H1 (double padding) → Task 1 ✓
- H2 (Budget header / double icons) → Task 6 ✓
- M1 (bottom nav crowding) → Task 2 ✓
- M2 (bracket labels) → Task 4 ✓
- M3 (drag on touch) → Task 5 ✓
- M4 (tap targets: account rows + month arrows) → Task 3 (account rows) + Task 6 (arrows) ✓
- L1 (account name truncation) → Task 3 ✓
- L2 (select accessible name) → Task 6 ✓
- Needs-verify #2 (modal scroll) → Task 7, folded into Task 10 ✓
- Needs-verify #3 (populated-data overflow) → Task 8 ✓
- Needs-verify #1 (exact "double icons") → **RESOLVED by screenshots: it is the duplicate sheet close button → Task 10.** (Task 6 still fixes Budget-header crowding, but was not the double icon.)
- Needs-verify #4 (Recharts responsiveness) → folded into Task 8's sweep.

**Addendum coverage (screenshot review):**
- F1 (bottom-nav clips content) → Task 9 ✓
- F2 (duplicate sheet close + panel-style leak = the "double icon") → Task 10 ✓ (supersedes Task 7)
- F3 (forecaster Monte Carlo misalignment) → Task 11 ✓
- F4 (Budget header crowding) → Task 1 + Task 6 ✓

**Addendum type/selector consistency:** `Sheet` `title` prop is new (Task 10a) and consumed by all migrated modals; `setMatchMedia(false)` drives the mobile branch via `useIsDesktop()`; `MonteCarloSection` props in the Task 11 test match its exported interface. Task 7 is explicitly marked superseded to avoid a double-edit of the same `panelClassName`.

**Type/selector consistency:** `useIsDesktop()` signature matches `src/hooks/useMediaQuery.ts`; `setMatchMedia`/`resetMatchMedia` match `src/test-utils/matchMedia.ts`; `ThemedSelect` `ariaLabel` prop matches `ThemedSelect.tsx:86`; `BracketBar` props match its export. Two existing tests are updated in-place (AccountCategoryWidget Task 3; SalaryTaxTool stays green in Task 4).

**Known soft spots (flagged inline, not placeholders):** full-page renders in jsdom (Dashboard, Budgeting) can be brittle if a child widget throws — each affected step includes a fallback (narrow the assertion or `vi.mock` the offending child rather than delete the test).
