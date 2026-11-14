# Phase 7 — UI/UX 2026 Refresh + Dashboard Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish v2.0: Dashboard aggregates every module (rollups + net-worth trend + drag-to-reorder), the app goes mobile-first (bottom tab nav, single-column Bento, touch targets), motion/async polish (animated counters, page transitions, skeletons, empty states), a ⌘K command palette, and baseline accessibility — all inside the existing 5 themes (refine, don't replace).

**Architecture:** Rollup widgets read other modules' stores directly (read-only, no new coupling stores). Widget order persists in a new `ledger-dashboard-layout` store (registered in backup). Motion primitives (`AnimatedNumber`, `PageTransition`, `Skeleton`) live in `src/components/ui/` and honor `prefers-reduced-motion` via framer-motion's `useReducedMotion`. The command palette derives its actions from the nav list + planner tool registry — no new dependency (no `cmdk`).

**Tech Stack:** React 19, Zustand v5 `persist`, Recharts v3, Framer Motion (already a dependency), lucide-react, Tailwind v4, Vitest (globals: true).

**Spec authority:** `docs/superpowers/specs/2026-07-02-ledger-v2-design.md` → Phase 7. **Prerequisites:** all earlier phases (rollups read Planner/Portfolio/Comp/Budget state). If 5b or 4e data is absent at runtime the widgets must show empty states, not crash.

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **Local-first persistence.** New store `ledger-dashboard-layout`; **must be appended to `BACKUP_KEYS`** + registration test (Task 2).
- **Recharts only** for charts.
- **No hardcoded colors — theme CSS variables only.** ALL 5 themes: `geometric`, `tactical`, `luxury`, `aurora`, `glass`. Refine within themes — do not restyle them.
- **Mobile + all 5 themes are acceptance gates** — this phase IS the mobile pass, so the gate is stricter (every route at 375px).
- **Honor `prefers-reduced-motion`** in every new animation (counters, transitions, palette).
- **Testing is minimal by direction of the user (2026-07-02):** the layout store and the palette's action-filter function get small tests; visual/motion components get NO dedicated test files — the manual gate covers them.
- **Commit after every task.** Lint enforces `react-hooks/set-state-in-effect`.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

---

### Task 1: Dashboard rollup widgets + net-worth trend

**Files:**
- Create: `src/components/dashboard/widgets/NetWorthTrendWidget.tsx`
- Create: `src/components/dashboard/widgets/PortfolioRollupWidget.tsx`
- Create: `src/components/dashboard/widgets/CompSnapshotWidget.tsx`
- Create: `src/components/dashboard/widgets/BudgetHealthWidget.tsx`
- Create: `src/components/dashboard/widgets/PlannerGoalWidget.tsx`
- Modify: `src/pages/Dashboard.tsx` (add the five widgets)
- Delete: `src/store/useDashboardStore.ts` and its test + any dead widgets that only consumed it (verify with `rg -l "useDashboardStore" src` — expected: `AssetsWidget.tsx`, `DebtsWidget.tsx`, the store, its test; delete whatever matches and nothing else imports)

**Interfaces:**
- Consumes (all existing, read-only):
  - `useAccountsStore` — `history: NetWorthSnapshot[]`, `getNetWorth()`
  - `usePortfolioStore` (5b) — `holdings`; cached prices via `useMarketDataStore` (`quotes`, `overrides`, `quoteKey`) + `portfolioTotals`/`toCad` from `src/utils/investments/portfolioMetrics.ts`; `useFxRate('USD','CAD')`
  - `useCompensationDisplay()` (`src/hooks/useCompensationDisplay.ts`) — `{ pkg, priceStatus }`; `calcTotalComp`, `generateVestEvents` from `useCompensationStore`
  - `getMonthlyBudgetStats(state, year, monthIndex)` + `useBudgetStore`
  - Forecaster goals: `usePlannerStore.inputs['forecaster']?.goalsJson` (4e shape `{ id, label, amount }[]`) — parse defensively
  - `WidgetWrapper`, `formatMoney`
- Produces: five `React.FC` widgets, each with a data-empty state ("Import a portfolio CSV", "Set up compensation", etc. — the app starts data-empty).

- [x] **Step 1: Implement the five widgets**

Create `src/components/dashboard/widgets/NetWorthTrendWidget.tsx`:

```tsx
import React from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WidgetWrapper } from '../WidgetWrapper'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { formatMoney } from '../../planner/format'

export const NetWorthTrendWidget: React.FC = () => {
  const history = useAccountsStore((s) => s.history)
  if (history.length < 2) {
    return (
      <WidgetWrapper title="Net worth over time" className="md:col-span-2">
        <p className="text-[13px] text-text-secondary mt-2">
          Update your accounts a few times — each change records a snapshot and the trend appears here.
        </p>
      </WidgetWrapper>
    )
  }
  return (
    <WidgetWrapper title="Net worth over time" className="md:col-span-2">
      <div className="h-[220px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} minTickGap={40} />
            <YAxis width={70} tickFormatter={(v: number) => formatMoney(v)} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [formatMoney(value), 'Net worth']}
              contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <Area type="monotone" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetWrapper>
  )
}
```

Create `src/components/dashboard/widgets/PortfolioRollupWidget.tsx`:

```tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { usePortfolioStore } from '../../../store/usePortfolioStore'
import { useMarketDataStore } from '../../../store/useMarketDataStore'
import { quoteKey, useFxRate } from '../../../services/marketData'
import { portfolioTotals } from '../../../utils/investments/portfolioMetrics'
import { formatMoney } from '../../planner/format'

export const PortfolioRollupWidget: React.FC = () => {
  const holdings = usePortfolioStore((s) => s.holdings)
  const quotes = useMarketDataStore((s) => s.quotes)
  const overrides = useMarketDataStore((s) => s.overrides)
  const fx = useFxRate('USD', 'CAD')

  if (holdings.length === 0) {
    return (
      <WidgetWrapper title="Portfolio">
        <p className="text-[13px] text-text-secondary mt-2">
          <Link to="/investments" className="text-accent hover:underline">Import a broker CSV</Link> to see your portfolio value here.
        </p>
      </WidgetWrapper>
    )
  }

  // Rollup uses override > cached > avgCost prices (the Investments page fetches live).
  const rows = holdings.map((h) => ({
    holding: h,
    price: overrides[quoteKey(h.ticker, h.exchange)] ?? quotes[quoteKey(h.ticker, h.exchange)]?.value.price ?? h.avgCost,
  }))
  const t = portfolioTotals(rows, fx.data?.value.rate ?? 1)

  return (
    <WidgetWrapper title="Portfolio">
      <div className="flex flex-col gap-1 mt-2">
        <span className="text-[28px] font-bold text-accent">{formatMoney(t.valueCad)}</span>
        <span className={`text-[13px] ${t.plCad >= 0 ? 'text-accent' : 'text-error'}`}>
          {t.plCad >= 0 ? '+' : ''}{formatMoney(t.plCad)}{t.plPct !== null ? ` (${t.plPct.toFixed(1)}%)` : ''} all-time
        </span>
        <span className="text-[12px] text-text-secondary">{holdings.length} holdings · CAD</span>
      </div>
    </WidgetWrapper>
  )
}
```

Create `src/components/dashboard/widgets/CompSnapshotWidget.tsx`:

```tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { useCompensationDisplay } from '../../../hooks/useCompensationDisplay'
import { calcTotalComp, generateVestEvents } from '../../../store/useCompensationStore'
import { formatMoney } from '../../planner/format'

export const CompSnapshotWidget: React.FC = () => {
  const { pkg } = useCompensationDisplay()

  if (pkg.baseSalary === 0) {
    return (
      <WidgetWrapper title="Compensation">
        <p className="text-[13px] text-text-secondary mt-2">
          <Link to="/compensation" className="text-accent hover:underline">Set up your package</Link> to see total comp and upcoming vests.
        </p>
      </WidgetWrapper>
    )
  }

  const now = new Date()
  const upcoming = pkg.rsuGrants
    .flatMap((g) => generateVestEvents(g, pkg.companyCurrentPrice))
    .filter((e) => e.date && new Date(e.date) > now)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    .slice(0, 3)

  return (
    <WidgetWrapper title="Compensation">
      <div className="flex flex-col gap-1 mt-2">
        <span className="text-[28px] font-bold text-accent">{formatMoney(calcTotalComp(pkg))}</span>
        <span className="text-[12px] text-text-secondary">total comp (this year)</span>
        {upcoming.map((e) => (
          <span key={`${e.monthIndex}-${e.label}`} className="text-[12px] text-text-secondary">
            Vest {new Date(e.date!).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}: {formatMoney(e.vestValue)}
          </span>
        ))}
      </div>
    </WidgetWrapper>
  )
}
```

Create `src/components/dashboard/widgets/BudgetHealthWidget.tsx`:

```tsx
import React from 'react'
import { WidgetWrapper } from '../WidgetWrapper'
import { useBudgetStore, getMonthlyBudgetStats } from '../../../store/useBudgetStore'
import { formatMoney } from '../../planner/format'

export const BudgetHealthWidget: React.FC = () => {
  const budgetState = useBudgetStore()
  const now = new Date()
  const stats = getMonthlyBudgetStats(budgetState, now.getFullYear(), now.getMonth())

  return (
    <WidgetWrapper title="This month's budget">
      <div className="flex flex-col gap-1 mt-2">
        <span className={`text-[28px] font-bold ${stats.remaining >= 0 ? 'text-accent' : 'text-error'}`}>
          {formatMoney(stats.remaining)}
        </span>
        <span className="text-[12px] text-text-secondary">left of targets · {formatMoney(stats.spent)} spent</span>
        <span className="text-[12px] text-text-secondary">{formatMoney(stats.unallocated)} unallocated</span>
      </div>
    </WidgetWrapper>
  )
}
```

Create `src/components/dashboard/widgets/PlannerGoalWidget.tsx`:

```tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { usePlannerStore } from '../../../store/usePlannerStore'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { formatMoney } from '../../planner/format'

interface Goal { id: string; label: string; amount: number }

export const PlannerGoalWidget: React.FC = () => {
  const goalsJson = usePlannerStore((s) => s.inputs['forecaster']?.goalsJson)
  const netWorth = useAccountsStore((s) => s.getNetWorth())

  let goals: Goal[] = []
  try {
    const parsed = JSON.parse(String(goalsJson ?? '[]'))
    if (Array.isArray(parsed)) goals = parsed
  } catch { /* ignore malformed */ }

  const top = [...goals].sort((a, b) => b.amount - a.amount)[0]
  if (!top) {
    return (
      <WidgetWrapper title="Top goal">
        <p className="text-[13px] text-text-secondary mt-2">
          <Link to="/planner/forecaster" className="text-accent hover:underline">Add a goal in the Forecaster</Link> to track it here.
        </p>
      </WidgetWrapper>
    )
  }
  const progress = top.amount > 0 ? Math.min(1, netWorth / top.amount) : 0

  return (
    <WidgetWrapper title="Top goal">
      <div className="flex flex-col gap-2 mt-2">
        <span className="text-[15px] text-text-primary font-medium">{top.label}</span>
        <span className="text-[13px] text-text-secondary">{formatMoney(netWorth)} of {formatMoney(top.amount)} ({Math.round(progress * 100)}%)</span>
        <div className="h-2 rounded bg-bg-primary/50 overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </WidgetWrapper>
  )
}
```

- [x] **Step 2: Wire into the Dashboard and remove dead code**

In `src/pages/Dashboard.tsx`, import the five widgets and add them to the `BentoGrid` (trend widget first, spanning 2 columns; rollups after the existing widgets). Then:

```bash
rg -l "useDashboardStore" src
```

Delete the store, its test, and `AssetsWidget.tsx`/`DebtsWidget.tsx` **only if** nothing else imports them:

```bash
git rm src/store/useDashboardStore.ts src/store/useDashboardStore.test.ts src/components/dashboard/widgets/AssetsWidget.tsx src/components/dashboard/widgets/DebtsWidget.tsx
```

- [x] **Step 3: Verify + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run build` — all pass. Dev: with empty stores every rollup shows its call-to-action; with data they populate.

```bash
git add -A src/pages/Dashboard.tsx src/components/dashboard src/store
git commit -m "feat: dashboard module rollups + net-worth trend; drop mock dashboard store"
```

---

### Task 2: Drag-to-reorder Bento widgets (persisted layout)

**Files:**
- Create: `src/store/useDashboardLayoutStore.ts`
- Create: `src/store/useDashboardLayoutStore.test.ts`
- Modify: `src/pages/Dashboard.tsx` (registry-driven, draggable)
- Modify: `src/utils/backup.ts` + `src/utils/backup.test.ts` (register `ledger-dashboard-layout`)

**Interfaces:**
- Produces:
  - `useDashboardLayoutStore` — `{ order: string[]; setOrder(order: string[]): void; moveWidget(id: string, beforeId: string | null): void }` (persist key `ledger-dashboard-layout`; `order: []` means "default order")
  - Dashboard widget registry: `const DASHBOARD_WIDGETS: { id: string; element: React.ReactNode }[]` defined in `Dashboard.tsx`; render order = stored order (unknown ids appended in default order, missing ids skipped — resilient to future widget changes).

- [x] **Step 1: Write the failing tests**

Create `src/store/useDashboardLayoutStore.test.ts`:

```ts
import { useDashboardLayoutStore } from './useDashboardLayoutStore'

const initialState = useDashboardLayoutStore.getState()
beforeEach(() => {
  localStorage.clear()
  useDashboardLayoutStore.setState(initialState, true)
})

describe('useDashboardLayoutStore', () => {
  it('moveWidget places a widget before another', () => {
    useDashboardLayoutStore.getState().setOrder(['a', 'b', 'c'])
    useDashboardLayoutStore.getState().moveWidget('c', 'a')
    expect(useDashboardLayoutStore.getState().order).toEqual(['c', 'a', 'b'])
  })

  it('moveWidget with beforeId null moves to the end', () => {
    useDashboardLayoutStore.getState().setOrder(['a', 'b', 'c'])
    useDashboardLayoutStore.getState().moveWidget('a', null)
    expect(useDashboardLayoutStore.getState().order).toEqual(['b', 'c', 'a'])
  })

  it('persists under ledger-dashboard-layout', () => {
    useDashboardLayoutStore.getState().setOrder(['x'])
    expect(localStorage.getItem('ledger-dashboard-layout')).toContain('"x"')
  })
})
```

Add to `src/utils/backup.test.ts`:

```ts
  it('registers the dashboard layout key', () => {
    expect(BACKUP_KEYS).toContain('ledger-dashboard-layout')
  })
```

- [x] **Step 2: Run tests to verify they fail**, then implement

Create `src/store/useDashboardLayoutStore.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DashboardLayoutState {
  /** Widget ids in display order; empty = default order. */
  order: string[]
  setOrder: (order: string[]) => void
  moveWidget: (id: string, beforeId: string | null) => void
}

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      order: [],
      setOrder: (order) => set({ order }),
      moveWidget: (id, beforeId) =>
        set((state) => {
          const rest = state.order.filter((x) => x !== id)
          if (beforeId === null) return { order: [...rest, id] }
          const idx = rest.indexOf(beforeId)
          if (idx === -1) return { order: [...rest, id] }
          return { order: [...rest.slice(0, idx), id, ...rest.slice(idx)] }
        }),
    }),
    { name: 'ledger-dashboard-layout' },
  ),
)
```

Append `'ledger-dashboard-layout'` to `BACKUP_KEYS`.

- [x] **Step 3: Make the Dashboard draggable**

Rework `src/pages/Dashboard.tsx`: build `DASHBOARD_WIDGETS` (ids: `net-worth`, `trend`, `monthly-summary`, `portfolio`, `comp`, `budget-health`, `top-goal`, `bank`, `investment-accounts`, `income`, `expense`, `receivable`, `other`, `debt`) wrapping each existing element. Resolve order (stored order first, then unlisted defaults), and render each in a draggable shell using native HTML5 DnD:

```tsx
const [dragId, setDragId] = useState<string | null>(null)
const moveWidget = useDashboardLayoutStore((s) => s.moveWidget)
const storedOrder = useDashboardLayoutStore((s) => s.order)
const setOrder = useDashboardLayoutStore((s) => s.setOrder)

const defaultIds = DASHBOARD_WIDGETS.map((w) => w.id)
const orderedIds = [...storedOrder.filter((id) => defaultIds.includes(id)),
                    ...defaultIds.filter((id) => !storedOrder.includes(id))]

// inside <BentoGrid>:
{orderedIds.map((id) => {
  const w = DASHBOARD_WIDGETS.find((x) => x.id === id)!
  return (
    <div
      key={id}
      draggable
      onDragStart={() => setDragId(id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        if (dragId && dragId !== id) {
          if (storedOrder.length === 0) setOrder(orderedIds) // materialize default before first move
          moveWidget(dragId, id)
        }
        setDragId(null)
      }}
      className={`cursor-grab active:cursor-grabbing ${dragId === id ? 'opacity-50' : ''}`}
    >
      {w.element}
    </div>
  )
})}
```

Note: `moveWidget` runs against the just-materialized order because `setOrder` and `moveWidget` are sequential store writes in one handler — Zustand applies them synchronously in order.

- [x] **Step 4: Verify + commit**

Run: `npx vitest run && npm run build`. Dev: drag a widget onto another → it lands before it; reload → order persists; backup round-trip keeps it.

```bash
git add src/store/useDashboardLayoutStore.ts src/store/useDashboardLayoutStore.test.ts src/pages/Dashboard.tsx src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: drag-to-reorder dashboard widgets with persisted layout"
```

---

### Task 3: Mobile-first pass — bottom tab navigation

**Files:**
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: existing `navItems` (5 routes + icons already defined in Layout), `useLocation`.
- Produces: at `< md` the sidebar is hidden and a fixed bottom tab bar renders the same 5 items; main content gets bottom padding so nothing hides behind the bar. Touch targets ≥ 44px. Safe-area inset respected (`env(safe-area-inset-bottom)` — Phase 1 set `viewport-fit=cover`).

- [x] **Step 1: Implement**

In `src/components/Layout.tsx`:

1. Sidebar `<nav>`: add `hidden md:flex` to its className (keep the rest).
2. `<main>`: add `pb-20 md:pb-8` (below the existing padding classes) so content clears the tab bar.
3. Add the bottom bar just before `</div>` (root):

```tsx
      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-bg-secondary/90 backdrop-blur-[var(--card-blur)] flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] text-[10px] font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
```

4. Mobile access to Backup/Theme controls (they live in the hidden sidebar): add them into the `<main>` flow on mobile — a small row at the top of main, `md:hidden`, rendering `<BackupControls />` and `<ThemeSelector />` side by side.

- [x] **Step 2: Verify + commit**

Dev at 375px: bottom bar on every route, active tab highlighted, content not obscured, backup/theme reachable; at ≥768px the sidebar is back and the bar is gone.

```bash
git add src/components/Layout.tsx
git commit -m "feat: mobile bottom tab navigation with safe-area support"
```

---

### Task 4: Motion & async polish — counters, transitions, skeletons

**Files:**
- Create: `src/components/ui/AnimatedNumber.tsx`
- Create: `src/components/ui/PageTransition.tsx`
- Create: `src/components/ui/Skeleton.tsx`
- Modify: `src/components/Layout.tsx` (wrap `<Outlet />` in `PageTransition`)
- Modify: `src/components/dashboard/widgets/NetWorthWidget.tsx` (use `AnimatedNumber`)
- Modify: `src/components/compensation/CompHeroWidget.tsx` (skeleton while `priceStatus === 'loading'` — adapt to the widget's existing structure; if it already shows a loading state, leave it and note that here)

**Interfaces:**
- Produces:
  - `AnimatedNumber: React.FC<{ value: number; format?: (n: number) => string; durationMs?: number }>` — count-up on value change via framer-motion `animate`; renders the final value immediately when `useReducedMotion()` is true.
  - `PageTransition: React.FC<{ children: React.ReactNode }>` — fade/slide-in keyed by route path (`AnimatePresence mode="wait"`), disabled under reduced motion.
  - `Skeleton: React.FC<{ className?: string }>` — pulsing block using theme vars.

- [x] **Step 1: Implement the three primitives**

Create `src/components/ui/AnimatedNumber.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  format?: (n: number) => string
  durationMs?: number
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = (n) => n.toLocaleString('en-CA', { maximumFractionDigits: 0 }),
  durationMs = 600,
}) => {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (reduced || prev.current === value) {
      prev.current = value
      setDisplay(value)
      return
    }
    const controls = animate(prev.current, value, {
      duration: durationMs / 1000,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    prev.current = value
    return () => controls.stop()
  }, [value, reduced, durationMs])

  return <span>{format(display)}</span>
}
```

Create `src/components/ui/PageTransition.tsx`:

```tsx
import React from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

Create `src/components/ui/Skeleton.tsx`:

```tsx
import React from 'react'

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-bg-primary/60 border border-border ${className}`} aria-hidden="true" />
)
```

- [x] **Step 2: Wire them in**

- `Layout.tsx`: `<main>…<PageTransition><Outlet /></PageTransition></main>`.
- `NetWorthWidget.tsx`: replace the static number with `<AnimatedNumber value={netWorth} format={(n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />`.
- `CompHeroWidget.tsx`: where the live price renders, show `<Skeleton className="h-6 w-24" />` while the price status is `loading` and no value is available yet (read the widget first; adapt to its actual markup — if it already has adequate loading UI, skip and record that in the commit message).
- Charts: Recharts animates draw-in by default (`isAnimationActive`) — no change needed; sparklines in Phase 6 explicitly disabled it, leave them.

- [x] **Step 3: Verify + commit**

Run: `npx vitest run && npm run build` (Layout/NetWorth changes may affect existing tests — fix imports if any fail). Dev: route changes fade; net worth counts up when an account changes; with DevTools "emulate prefers-reduced-motion" everything is instant.

```bash
git add src/components/ui src/components/Layout.tsx src/components/dashboard/widgets/NetWorthWidget.tsx src/components/compensation/CompHeroWidget.tsx
git commit -m "feat: animated counters, page transitions, skeletons (reduced-motion aware)"
```

---

### Task 5: Command palette (⌘K)

**Files:**
- Create: `src/components/CommandPalette.tsx`
- Create: `src/components/commandActions.ts`
- Create: `src/components/commandActions.test.ts`
- Modify: `src/components/Layout.tsx` (mount + key listener)

**Interfaces:**
- Consumes: `PLANNER_TOOLS` from `src/components/planner/toolRegistry.tsx`; nav routes (duplicated as data in `commandActions.ts` to avoid circular imports); `useNavigate`.
- Produces:
  - `interface CommandAction { id: string; label: string; hint: string; path: string }`
  - `buildActions(): CommandAction[]` (5 nav routes + one per planner tool)
  - `filterActions(actions: CommandAction[], query: string): CommandAction[]` (case-insensitive substring on label + hint; empty query = all) — **tested**
  - `CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }>` — search input (auto-focused), arrow-key selection, Enter navigates, Escape closes, click-outside closes.

- [x] **Step 1: Write the failing tests**

Create `src/components/commandActions.test.ts`:

```ts
import { buildActions, filterActions } from './commandActions'

describe('buildActions', () => {
  it('includes the five module routes and every planner tool', () => {
    const actions = buildActions()
    const paths = actions.map((a) => a.path)
    for (const p of ['/', '/budget', '/investments', '/planner', '/compensation']) {
      expect(paths).toContain(p)
    }
    expect(paths.some((p) => p.startsWith('/planner/'))).toBe(true)
  })
})

describe('filterActions', () => {
  const actions = buildActions()

  it('matches case-insensitively on label and hint', () => {
    expect(filterActions(actions, 'BUDG').some((a) => a.path === '/budget')).toBe(true)
    expect(filterActions(actions, 'zzz-no-match')).toHaveLength(0)
  })

  it('returns everything for an empty query', () => {
    expect(filterActions(actions, '')).toHaveLength(actions.length)
  })
})
```

- [x] **Step 2: Run to verify failure, then implement**

Create `src/components/commandActions.ts`:

```ts
import { PLANNER_TOOLS } from './planner/toolRegistry'

export interface CommandAction {
  id: string
  label: string
  hint: string
  path: string
}

const MODULES: CommandAction[] = [
  { id: 'nav-dashboard', label: 'Dashboard', hint: 'Overview, net worth, rollups', path: '/' },
  { id: 'nav-budget', label: 'Budgeting', hint: 'Transactions, CSV import, insights', path: '/budget' },
  { id: 'nav-investments', label: 'Investments', hint: 'Plan vs actual, portfolio', path: '/investments' },
  { id: 'nav-planner', label: 'Planner', hint: 'Calculators and forecaster', path: '/planner' },
  { id: 'nav-compensation', label: 'Compensation', hint: 'Salary, RSU, ESPP', path: '/compensation' },
]

export function buildActions(): CommandAction[] {
  return [
    ...MODULES,
    ...PLANNER_TOOLS.map((t) => ({
      id: `tool-${t.id}`,
      label: t.name,
      hint: t.description,
      path: `/planner/${t.id}`,
    })),
  ]
}

export function filterActions(actions: CommandAction[], query: string): CommandAction[] {
  const q = query.trim().toLowerCase()
  if (!q) return actions
  return actions.filter((a) => a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q))
}
```

Create `src/components/CommandPalette.tsx`:

```tsx
import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { buildActions, filterActions } from './commandActions'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const actions = useMemo(() => buildActions(), [])
  const results = filterActions(actions, query)
  const clampedSelected = Math.min(selected, Math.max(0, results.length - 1))

  if (!isOpen) return null

  const run = (path: string) => {
    navigate(path)
    setQuery('')
    setSelected(0)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(Math.min(clampedSelected + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(Math.max(clampedSelected - 1, 0)) }
    else if (e.key === 'Enter' && results[clampedSelected]) { e.preventDefault(); run(results[clampedSelected].path) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] px-4" onClick={onClose} role="dialog" aria-label="Command palette">
      <div className="themed-card rounded-lg w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-text-secondary" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-text-primary text-[15px] outline-none placeholder:text-text-secondary"
            placeholder="Jump to a module or tool…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKeyDown}
            aria-label="Search commands"
          />
          <kbd className="text-[11px] text-text-secondary border border-border rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-[40vh] overflow-y-auto py-1" role="listbox">
          {results.length === 0 && <li className="px-4 py-3 text-[13px] text-text-secondary">No matches.</li>}
          {results.map((a, i) => (
            <li key={a.id} role="option" aria-selected={i === clampedSelected}>
              <button
                onClick={() => run(a.path)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full text-left px-4 py-2.5 flex flex-col ${
                  i === clampedSelected ? 'bg-accent/10 text-accent' : 'text-text-primary'
                }`}
              >
                <span className="text-[14px] font-medium">{a.label}</span>
                <span className="text-[12px] text-text-secondary">{a.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

In `src/components/Layout.tsx`: add palette state + a global key listener (window `keydown` in a `useEffect`: `(e.metaKey || e.ctrlKey) && e.key === 'k'` → `preventDefault()` + open; the listener only calls `setPaletteOpen` from the event — not synchronously in the effect body, satisfying the lint rule), render `<CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />`, and add a small "⌘K" hint button in the sidebar dock that opens it (mobile: reachable via the same button placed next to the mobile Backup/Theme row from Task 3).

- [x] **Step 3: Verify + commit**

Run: `npx vitest run src/components/commandActions.test.ts` — PASS. Dev: Ctrl/⌘K opens anywhere; type "mort" → Mortgage; Enter navigates; Escape/click-outside closes; arrows move selection.

```bash
git add src/components/CommandPalette.tsx src/components/commandActions.ts src/components/commandActions.test.ts src/components/Layout.tsx
git commit -m "feat: command palette (Ctrl/Cmd+K) over modules and planner tools"
```

---

### Task 6: Accessibility hygiene + v2.0 MILESTONE gate

**Files:**
- Modify: whatever the audit surfaces (contrast/focus fixes)
- Modify: `docs/superpowers/plans/PROGRESS.md` (mark Phase 7 + milestone complete)
- Modify: `docs/superpowers/plans/2026-07-02-phase-7-uiux-refresh.md` (check off boxes)

- [x] **Step 1: Accessibility audit (baseline, per spec)**

In dev, for each of the 5 themes:
1. **Contrast:** run Chrome DevTools CSS Overview (or axe) on Dashboard, Budgeting, Planner hub, Forecaster — fix any text below WCAG AA by adjusting usage (e.g. swap `text-text-secondary` → `text-text-primary` where flagged); do NOT change theme token values.
2. **Keyboard:** Tab reaches nav (sidebar + bottom bar), palette opens via keyboard and is fully operable, modals close on Escape, focus visible on interactive elements (add `focus-visible:ring-1 ring-accent` where missing).
3. **Reduced motion:** emulate `prefers-reduced-motion` → counters snap, transitions disabled, palette still instant.

Fix and commit findings as one commit:

```bash
git add -A src
git commit -m "fix: a11y pass — contrast, focus visibility, reduced motion"
```

- [x] **Step 2: Full automated gate**

```bash
npx vitest run
npm run lint
npm run build
```

- [x] **Step 3: Manual milestone acceptance — spec Phase 7 "Done when" + cross-cutting criteria (section 6)**

1. **Phone (375px), every route:** Dashboard (rollups + reorder), Budgeting (all Phase 6 visuals), Investments (both tabs), Planner (hub + forecaster + 2 calculators), Compensation — bottom tabs everywhere, no horizontal scroll, touch targets comfortable.
2. Dashboard aggregates all modules: portfolio value, comp snapshot + upcoming vests, budget health, top goal, net-worth trend — each with a working empty state from a fresh (wiped) profile.
3. ⌘K + motion polish present in all 5 themes.
4. Offline: app shell loads, cached/manual data renders, nothing crashes.
5. Backup export → wipe LocalStorage → import → identical state (now including layout order, portfolio, analyses, planner inputs).
6. PWA still installable (`npm run build && npx vite preview` → Lighthouse PWA pass).

- [x] **Step 4: Close out the milestone**

Update PROGRESS.md: Phase 7 checked, all phases complete, milestone v2.0 done; note any deferred follow-ups.

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-7-uiux-refresh.md
git commit -m "chore: complete Phase 7 + v2.0 milestone — mobile, rollups, palette, a11y verified"
```

Then use **superpowers:finishing-a-development-branch** to decide merge/PR for `ledger-v2`.
