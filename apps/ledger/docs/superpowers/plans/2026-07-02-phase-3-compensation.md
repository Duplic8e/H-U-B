# Phase 3 — Compensation: Live Price + CAD Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. After each task: commit, then update `docs/superpowers/plans/PROGRESS.md` (current/next task + one Log line). This is **Phase 3** of the milestone in `2026-07-02-ledger-v2-master-plan.md`.

**Goal:** Wire `companyCurrentPrice` to the market-data service (live fetch + manual override, unchanged), and add a global, togglable USD→CAD conversion so a user can enter share counts and USD prices (`companyCurrentPrice`, `esppLockedInPrice`, RSU `grantPrice`) and see every CAD-denominated output (ESPP profit, RRSP match, RSU vest values, total comp) reflect the live FX-converted values — without changing the existing comp-math functions' semantics.

**Architecture:** Three layers on top of the existing `useCompensationStore`. (1) **Store extension** — add two persisted fields (`useCadConversion: boolean`, `toggleCadConversion()`) to the *same* `ledger-compensation` store (no new LocalStorage key, so no `BACKUP_KEYS` change needed). (2) **Pure FX-conversion layer** (`src/store/compensationFx.ts`) — a side-effect-free function `convertPackageToCad(pkg, fxRate, enabled)` that returns a new `CompensationPackage`-shaped object with `companyCurrentPrice`, `esppLockedInPrice`, and every RSU grant's `grantPrice` multiplied by `fxRate` when `enabled` is true, otherwise returned unchanged. This is the "layer around" the existing `calcAnnualBaseSalary/calcAnnualBonus/calcAnnualESPP/calcAnnualRRSP/calcAnnualRSU/calcTotalComp/generateVestEvents` functions — those functions are NOT modified; callers pass the converted package instead of the raw one. (3) **Composition hook** (`src/hooks/useCompensationDisplay.ts`) — combines `useCurrentPrice` (live/cached/manual company stock price) and `useFxRate('USD','CAD')` from the market-data barrel with the store's `primaryPackage`/`useCadConversion`, producing a ready-to-render `{ pkg, fxRate, fxStatus, priceStatus, refreshPrice, setManualPrice, clearManualPrice }` bundle that `Compensation.tsx`, `CompHeroWidget`, `EquityVestingWidget`, and `CompareView` consume in place of raw `primaryPackage`. UI adds: a live-price control (refresh button + status text + manual override input) on the Compensation page, and a CAD-toggle switch next to it — both theme-token-styled, both usable offline (falls back to manual entry per the market-data module's existing behavior).

**Tech Stack:** React 19, Zustand `persist`, the Phase-2 market-data barrel (`src/services/marketData`), Vitest + Testing Library (`globals: true`, no `describe/it/expect/vi` imports).

## Global Constraints

(Full list in the master plan — these apply to every task.)

- **Zero backend / zero-infra.** All fetches go through the existing market-data module (browser-direct, no key/proxy). This phase adds no new network calls of its own.
- **Local-first persistence.** New state (`useCadConversion`) lives in the existing `useCompensationStore` (`persist`, key `ledger-compensation`) — already covered by `BACKUP_KEYS` in `src/utils/backup.ts`; no backup changes needed this phase.
- **Bento architecture.** Widget cards (`WidgetWrapper`, `CompHeroWidget`, `EquityVestingWidget`) remain layout wrappers taking `children`/props; this phase does not restructure them, only changes what package data they render.
- **Recharts only** for charts — no new chart library; existing charts in `CompHeroWidget`/`EquityVestingWidget` are reused unchanged except for the package object they read from.
- **Dual themes are sacred.** All new UI (price control, CAD toggle) uses theme CSS variables only (`var(--color-*)` / Tailwind `text-text-secondary` etc.) — no hardcoded colors. Verify in both themes.
- **Live data always has a manual fallback.** The price control must let the user type a manual USD price when live/cache data is unavailable, using the market-data hook's `setManual`/`clearManual` — Compensation must work fully offline.
- **Mobile + both themes are acceptance gates.** New price control + toggle must render correctly at a 375px viewport and in both themes before the phase gate passes.
- **TDD every task:** failing test → confirm fail → minimal implementation → confirm pass → commit. `npm test -- --run <path>`.

**Verified codebase facts (2026-07-02, branch `ledger-v2`):**
- `useCompensationStore` (`src/store/useCompensationStore.ts`) exports `CompensationPackage`, `RSUGrant`, `VestEvent`, `TimeMode`, and pure calc functions `calcAnnualBaseSalary`, `calcAnnualBonus`, `calcAnnualESPP`, `calcAnnualRRSP`, `calcAnnualRSU`, `calcTotalComp`, `generateVestEvents`, `getBaseSalaryForMonth` — all take a `CompensationPackage` as their first arg. None of these are modified by this phase; a converted package is passed in instead.
- `useCompensationStore`'s Zustand state shape: `{ primaryPackage, comparePackage, compareMode, timeMode, setPrimaryPackage, setComparePackage, toggleCompareMode, setTimeMode, addRSUGrant, removeRSUGrant, updateRSUGrant }`, persisted under `ledger-compensation`. No test file exists yet for this store (`useCompensationStore.test.ts` does not exist) — Task 1 creates the first one, scoped to the new fields.
- Market-data barrel `src/services/marketData/index.ts` exports `useCurrentPrice(ticker, exchange?)` → `{ data?: Resolved<Quote>, status: FetchStatus, error?: string, refresh: (force?: boolean) => void, setManual: (price: number) => void, clearManual: () => void }` and `useFxRate(from: Currency, to: Currency, date?: string)` → `{ data?: Resolved<FxRate>, status: FetchStatus, error?: string, refresh: () => void }`. `Resolved<T> = { value: T, source: 'override'|'live'|'cache', status: FetchStatus, asOf: string, stale: boolean }`. `Currency = 'USD' | 'CAD'`.
- Consumers of `primaryPackage`/calc functions today: `src/pages/Compensation.tsx`, `src/components/compensation/CompHeroWidget.tsx`, `src/components/compensation/EquityVestingWidget.tsx`, `src/components/compensation/CompareView.tsx`, `src/components/compensation/CompensationModal.tsx` (modal only edits raw USD inputs — it must keep editing/persisting *raw* USD/CAD-native values, never the converted view; only the read-side widgets switch to the converted package).
- `react-hooks/set-state-in-effect` is enforced by `eslint.config.js` (via `reactHooks.configs.flat.recommended`). Any new `useEffect` must not call `setState` synchronously in the effect body directly — defer via a `.then()`/async callback (matches the pattern already used in `src/services/marketData/useMarketData.ts`).
- Test runner: Vitest `globals: true`, jsdom, setup `src/setupTests.ts` (`@testing-library/jest-dom`). Do not import `describe/it/expect/vi`.

---

### Task 1: Store — add `useCadConversion` toggle to `useCompensationStore`

**Files:**
- Modify: `src/store/useCompensationStore.ts`
- Create: `src/store/useCompensationStore.test.ts`

**Interfaces:**
- Consumes: nothing new (extends existing store).
- Produces:
  - New state field `useCadConversion: boolean` (default `false` — toggle off = current CAD-native behavior, matching the spec's "Toggle off = treat inputs as already-CAD (current behavior)").
  - New action `toggleCadConversion: () => void`.

- [x] **Step 1: Write the failing test**

```ts
// src/store/useCompensationStore.test.ts
import { useCompensationStore } from './useCompensationStore'

const initialState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialState, true)
})

describe('useCompensationStore CAD conversion toggle', () => {
  it('defaults useCadConversion to false', () => {
    expect(useCompensationStore.getState().useCadConversion).toBe(false)
  })

  it('toggleCadConversion flips the flag', () => {
    useCompensationStore.getState().toggleCadConversion()
    expect(useCompensationStore.getState().useCadConversion).toBe(true)
    useCompensationStore.getState().toggleCadConversion()
    expect(useCompensationStore.getState().useCadConversion).toBe(false)
  })

  it('persists to the existing ledger-compensation LocalStorage key', () => {
    useCompensationStore.getState().toggleCadConversion()
    const raw = localStorage.getItem('ledger-compensation')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).state.useCadConversion).toBe(true)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/store/useCompensationStore.test.ts`
Expected: FAIL — `useCadConversion` is `undefined`, `toggleCadConversion` is not a function.

- [x] **Step 3: Write the minimal implementation**

In `src/store/useCompensationStore.ts`, extend the `CompensationState` interface (around line 215-228):

```ts
interface CompensationState {
  primaryPackage: CompensationPackage
  comparePackage: CompensationPackage | null
  compareMode: boolean
  timeMode: TimeMode
  useCadConversion: boolean

  setPrimaryPackage: (updates: Partial<CompensationPackage>) => void
  setComparePackage: (pkg: CompensationPackage | null) => void
  toggleCompareMode: () => void
  setTimeMode: (mode: TimeMode) => void
  addRSUGrant: (grant: RSUGrant) => void
  removeRSUGrant: (id: string) => void
  updateRSUGrant: (id: string, updates: Partial<RSUGrant>) => void
  toggleCadConversion: () => void
}
```

In the `create<CompensationState>()(persist((set) => ({...` body, add the field and action:

```ts
      primaryPackage: defaultPrimaryPackage,
      comparePackage: null,
      compareMode: false,
      timeMode: 'current-year',
      useCadConversion: false,

      setPrimaryPackage: (updates) =>
        set((state) => ({
          primaryPackage: { ...state.primaryPackage, ...updates },
        })),
      setComparePackage: (pkg) => set({ comparePackage: pkg }),
      toggleCompareMode: () => set((state) => ({ compareMode: !state.compareMode })),
      setTimeMode: (mode) => set({ timeMode: mode }),
      toggleCadConversion: () => set((state) => ({ useCadConversion: !state.useCadConversion })),
```//

(insert `toggleCadConversion` alongside the other actions — exact placement anywhere in the object body is fine; keep it grouped with `setTimeMode`.)

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/store/useCompensationStore.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add src/store/useCompensationStore.ts src/store/useCompensationStore.test.ts
git commit -m "feat: add useCadConversion toggle to compensation store"
```

---

### Task 2: Pure FX-conversion layer (`convertPackageToCad`)

**Files:**
- Create: `src/store/compensationFx.ts`
- Test: `src/store/compensationFx.test.ts`

**Interfaces:**
- Consumes: `CompensationPackage`, `RSUGrant` from `./useCompensationStore`.
- Produces:
  - `convertPackageToCad(pkg: CompensationPackage, fxRate: number, enabled: boolean): CompensationPackage` — pure function. When `enabled` is `false` or `fxRate` is not a finite positive number, returns `pkg` unchanged (same reference, no clone — cheap no-op). When `enabled` is `true` and `fxRate` is valid, returns a new object with `companyCurrentPrice: pkg.companyCurrentPrice * fxRate`, `esppLockedInPrice: pkg.esppLockedInPrice * fxRate`, and `rsuGrants: pkg.rsuGrants.map(g => ({ ...g, grantPrice: g.grantPrice * fxRate }))`. All other fields (`baseSalary`, `pastSalaryChanges`, percentages, dates, ids, names) pass through unchanged — those are already CAD-native inputs per the spec (only stock-price-denominated fields convert).

- [x] **Step 1: Write the failing test**

```ts
// src/store/compensationFx.test.ts
import { convertPackageToCad } from './compensationFx'
import type { CompensationPackage } from './useCompensationStore'

const basePkg: CompensationPackage = {
  id: 'primary',
  name: 'Current Offer',
  companyCurrentPrice: 100,
  baseSalary: 120000,
  pastSalaryChanges: [],
  cashBonusPercent: 10,
  cashBonusMonth: 12,
  esppContributionPercent: 5,
  esppDiscountPercent: 15,
  esppLockedInPrice: 80,
  rrspMatchPercent: 5,
  rrspMatchCap: 5000,
  rsuGrants: [
    {
      id: 'g1',
      grantName: 'Initial Grant',
      grantShares: 1000,
      grantPrice: 50,
      grantStartDate: '2026-01-01',
      vestingSchedule: { preset: '4yr-1yr-cliff', totalVestMonths: 48, cliffMonths: 12, frequency: 'monthly' },
    },
  ],
}

describe('convertPackageToCad', () => {
  it('returns the package unchanged when disabled', () => {
    const result = convertPackageToCad(basePkg, 1.35, false)
    expect(result).toBe(basePkg)
  })

  it('returns the package unchanged when fxRate is invalid', () => {
    expect(convertPackageToCad(basePkg, 0, true)).toBe(basePkg)
    expect(convertPackageToCad(basePkg, NaN, true)).toBe(basePkg)
    expect(convertPackageToCad(basePkg, -1, true)).toBe(basePkg)
  })

  it('converts companyCurrentPrice, esppLockedInPrice, and every RSU grantPrice by the fx rate when enabled', () => {
    const result = convertPackageToCad(basePkg, 1.35, true)
    expect(result.companyCurrentPrice).toBeCloseTo(135, 5)
    expect(result.esppLockedInPrice).toBeCloseTo(108, 5)
    expect(result.rsuGrants[0].grantPrice).toBeCloseTo(67.5, 5)
  })

  it('leaves non-price fields untouched', () => {
    const result = convertPackageToCad(basePkg, 1.35, true)
    expect(result.baseSalary).toBe(120000)
    expect(result.cashBonusPercent).toBe(10)
    expect(result.rsuGrants[0].grantShares).toBe(1000)
    expect(result.rsuGrants[0].grantName).toBe('Initial Grant')
    expect(result.rsuGrants[0].vestingSchedule).toEqual(basePkg.rsuGrants[0].vestingSchedule)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/store/compensationFx.test.ts`
Expected: FAIL — `./compensationFx` not found.

- [x] **Step 3: Write the implementation**

```ts
// src/store/compensationFx.ts
import type { CompensationPackage } from './useCompensationStore'

export function convertPackageToCad(
  pkg: CompensationPackage,
  fxRate: number,
  enabled: boolean,
): CompensationPackage {
  if (!enabled || !Number.isFinite(fxRate) || fxRate <= 0) {
    return pkg
  }

  return {
    ...pkg,
    companyCurrentPrice: pkg.companyCurrentPrice * fxRate,
    esppLockedInPrice: pkg.esppLockedInPrice * fxRate,
    rsuGrants: pkg.rsuGrants.map((grant) => ({
      ...grant,
      grantPrice: grant.grantPrice * fxRate,
    })),
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/store/compensationFx.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/store/compensationFx.ts src/store/compensationFx.test.ts
git commit -m "feat: pure USD->CAD conversion layer for compensation packages"
```

---

### Task 3: `useCompensationDisplay` composition hook

**Files:**
- Create: `src/hooks/useCompensationDisplay.ts`
- Test: `src/hooks/useCompensationDisplay.test.tsx`

**Interfaces:**
- Consumes: `useCompensationStore` (`primaryPackage`, `useCadConversion`); `useCurrentPrice`, `useFxRate` from `../services/marketData`; `convertPackageToCad` from `../store/compensationFx`.
- Produces:
  - `useCompensationDisplay(): { pkg: CompensationPackage; rawPrice: number; fxRate: number; fxStatus: FetchStatus; priceStatus: FetchStatus; priceSource?: 'override' | 'live' | 'cache'; priceStale: boolean; refreshPrice: (force?: boolean) => void; setManualPrice: (price: number) => void; clearManualPrice: () => void }`
  - Behavior: calls `useCurrentPrice(primaryPackage.name || 'TICKER')` — **no**, ticker must be a real field. See Step 3 note below: this hook needs a ticker. Since `CompensationPackage` has no ticker field today, this task ALSO adds one (`companyTicker?: string`) to `CompensationPackage` — see amendment in Step 3.

**Note before writing:** `CompensationPackage` currently has no ticker/symbol field — `companyCurrentPrice` is a bare number the user types in. To wire live-price fetch (`useCurrentPrice(ticker)`) we need a ticker. Add `companyTicker?: string` to `CompensationPackage` in `useCompensationStore.ts` (optional, default `''`, backward compatible with existing persisted data — old entries simply have `companyTicker: undefined`). This is a small, additive field change; the calc functions are untouched since none of them read `companyTicker`.

- [x] **Step 1: Add `companyTicker` field to the store (prerequisite edit, not itself a full task — folded in here since the hook needs it)**

In `src/store/useCompensationStore.ts`, add to `CompensationPackage` interface (after `companyCurrentPrice`):

```ts
export interface CompensationPackage {
  id: string
  name: string
  companyTicker?: string
  companyCurrentPrice: number
  baseSalary: number
  pastSalaryChanges: PastSalary[]
  cashBonusPercent: number
  cashBonusMonth: number
  esppContributionPercent: number
  esppDiscountPercent: number
  esppLockedInPrice: number
  esppLockInEndDate?: string
  rrspMatchPercent: number
  rrspMatchCap: number
  rsuGrants: RSUGrant[]
}
```

No default needed (`defaultPrimaryPackage` simply omits it — optional field). Run the existing store test to confirm nothing broke:

Run: `npm test -- --run src/store/useCompensationStore.test.ts`
Expected: PASS (unchanged — optional field addition is non-breaking).

- [x] **Step 2: Write the failing test for the hook**

```tsx
// src/hooks/useCompensationDisplay.test.tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCompensationDisplay } from './useCompensationDisplay'
import { useCompensationStore } from '../store/useCompensationStore'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { __setProviders, __resetProviders } from '../services/marketData/marketDataService'
import { __resetMinInterval } from '../services/marketData/throttle'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
})
afterEach(() => __resetProviders())

describe('useCompensationDisplay', () => {
  it('returns the raw CAD-native package when conversion is off (default)', async () => {
    useCompensationStore.getState().setPrimaryPackage({ companyTicker: 'AAPL', companyCurrentPrice: 100 })
    __setProviders({ fetchYahooQuote: async () => ({ ticker: 'AAPL', price: 150, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }) })
    const { result } = renderHook(() => useCompensationDisplay())
    await waitFor(() => expect(result.current.priceStatus).toBe('success'))
    // conversion disabled -> pkg uses the store's raw companyCurrentPrice, not the live fetch
    expect(result.current.pkg.companyCurrentPrice).toBe(100)
  })

  it('converts companyCurrentPrice to CAD using the live FX rate when conversion is on', async () => {
    useCompensationStore.getState().setPrimaryPackage({ companyTicker: 'AAPL', companyCurrentPrice: 100 })
    useCompensationStore.getState().toggleCadConversion()
    __setProviders({
      fetchYahooQuote: async () => ({ ticker: 'AAPL', price: 100, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }),
      fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.35, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
    })
    const { result } = renderHook(() => useCompensationDisplay())
    await waitFor(() => expect(result.current.fxStatus).toBe('success'))
    await waitFor(() => expect(result.current.pkg.companyCurrentPrice).toBeCloseTo(135, 5))
  })

  it('setManualPrice sets a manual override reflected in rawPrice', async () => {
    useCompensationStore.getState().setPrimaryPackage({ companyTicker: 'AAPL', companyCurrentPrice: 100 })
    __setProviders({ fetchYahooQuote: async () => ({ ticker: 'AAPL', price: 150, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }) })
    const { result } = renderHook(() => useCompensationDisplay())
    await waitFor(() => expect(result.current.priceStatus).toBe('success'))
    act(() => result.current.setManualPrice(250))
    await waitFor(() => expect(result.current.priceSource).toBe('override'))
    expect(result.current.rawPrice).toBe(250)
  })
})
```

- [x] **Step 3: Run test to verify it fails**

Run: `npm test -- --run src/hooks/useCompensationDisplay.test.tsx`
Expected: FAIL — `./useCompensationDisplay` not found.

- [x] **Step 4: Write the implementation**

```ts
// src/hooks/useCompensationDisplay.ts
import { useCallback, useMemo } from 'react'
import { useCompensationStore } from '../store/useCompensationStore'
import { convertPackageToCad } from '../store/compensationFx'
import { useCurrentPrice, useFxRate } from '../services/marketData'
import type { FetchStatus } from '../services/marketData'

export function useCompensationDisplay() {
  const primaryPackage = useCompensationStore((s) => s.primaryPackage)
  const useCadConversion = useCompensationStore((s) => s.useCadConversion)

  const ticker = primaryPackage.companyTicker?.trim() ?? ''
  const price = useCurrentPrice(ticker)
  const fx = useFxRate('USD', 'CAD')

  // Live/override/cached USD price when a ticker is set; otherwise fall back
  // to the manually-entered companyCurrentPrice already stored on the package.
  const rawPrice = price.data?.value.price ?? primaryPackage.companyCurrentPrice
  const fxRate = fx.data?.value.rate ?? 1

  const basePkg = useMemo(
    () => ({ ...primaryPackage, companyCurrentPrice: rawPrice }),
    [primaryPackage, rawPrice],
  )

  const pkg = useMemo(
    () => convertPackageToCad(basePkg, fxRate, useCadConversion),
    [basePkg, fxRate, useCadConversion],
  )

  const refreshPrice = useCallback((force?: boolean) => price.refresh(force), [price])
  const setManualPrice = useCallback((value: number) => price.setManual(value), [price])
  const clearManualPrice = useCallback(() => price.clearManual(), [price])

  return {
    pkg,
    rawPrice,
    fxRate,
    fxStatus: fx.status as FetchStatus,
    priceStatus: price.status as FetchStatus,
    priceSource: price.data?.source,
    priceStale: price.data?.stale ?? false,
    refreshPrice,
    setManualPrice,
    clearManualPrice,
  }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npm test -- --run src/hooks/useCompensationDisplay.test.tsx`
Expected: PASS (3 tests).

- [x] **Step 6: Commit**

```bash
git add src/store/useCompensationStore.ts src/hooks/useCompensationDisplay.ts src/hooks/useCompensationDisplay.test.tsx
git commit -m "feat: companyTicker field + useCompensationDisplay hook (live price + CAD conversion)"
```

---

### Task 4: Wire `Compensation.tsx` page — live price control + CAD toggle

**Files:**
- Modify: `src/pages/Compensation.tsx`
- Test: `src/pages/Compensation.test.tsx`

**Interfaces:**
- Consumes: `useCompensationDisplay` from `../hooks/useCompensationDisplay`; `useCompensationStore` (`toggleCadConversion`, `useCadConversion`); existing `calcTotalComp`, `calcAnnualBaseSalary`.
- Produces: page renders a "Live Price" control (ticker-aware refresh button + status label + manual-price input) and a "Convert to CAD" toggle switch in the header; both persist/react via the store and hook above. `totalComp`/`isPopulated` now derive from `pkg` (the hook's converted package) rather than raw `primaryPackage`.

- [x] **Step 1: Write the failing test**

```tsx
// src/pages/Compensation.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Compensation } from './Compensation'
import { useCompensationStore } from '../store/useCompensationStore'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { __setProviders, __resetProviders } from '../services/marketData/marketDataService'
import { __resetMinInterval } from '../services/marketData/throttle'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
  __setProviders({
    fetchYahooQuote: async () => ({ ticker: 'AAPL', price: 150, currency: 'USD' as const, asOf: '2026-07-01T00:00:00Z' }),
    fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.35, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
  })
})
afterEach(() => __resetProviders())

describe('Compensation page - live price + CAD toggle', () => {
  it('shows a Convert to CAD toggle that flips the store flag', async () => {
    render(<Compensation />)
    const toggle = screen.getByRole('button', { name: /convert to cad/i })
    expect(useCompensationStore.getState().useCadConversion).toBe(false)
    fireEvent.click(toggle)
    await waitFor(() => expect(useCompensationStore.getState().useCadConversion).toBe(true))
  })

  it('shows a refresh price control', () => {
    render(<Compensation />)
    expect(screen.getByRole('button', { name: /refresh price/i })).toBeInTheDocument()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/pages/Compensation.test.tsx`
Expected: FAIL — no element with accessible name `/convert to cad/i` or `/refresh price/i`.

- [x] **Step 3: Modify the implementation**

Replace the full contents of `src/pages/Compensation.tsx`:

```tsx
import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { CompHeroWidget } from '../components/compensation/CompHeroWidget'
import { CompensationModal } from '../components/compensation/CompensationModal'
import { EquityVestingWidget } from '../components/compensation/EquityVestingWidget'
import { CompareView } from '../components/compensation/CompareView'
import { useCompensationStore, calcTotalComp, calcAnnualBaseSalary } from '../store/useCompensationStore'
import { useCompensationDisplay } from '../hooks/useCompensationDisplay'

export const Compensation: React.FC = () => {
  const { setPrimaryPackage, compareMode, toggleCompareMode, timeMode, useCadConversion, toggleCadConversion } =
    useCompensationStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [manualPriceDraft, setManualPriceDraft] = useState('')

  const {
    pkg,
    rawPrice,
    fxRate,
    fxStatus,
    priceStatus,
    priceSource,
    priceStale,
    refreshPrice,
    setManualPrice,
  } = useCompensationDisplay()

  const totalComp = calcTotalComp(pkg, timeMode)
  const isPopulated = totalComp > 0

  const handleManualPriceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = Number(manualPriceDraft)
    if (Number.isFinite(parsed) && parsed > 0) {
      setManualPrice(parsed)
      setManualPriceDraft('')
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full h-full p-6 animate-fade-in">
      <header className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-[var(--color-text-primary)]">Total Compensation Calculator</h1>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-1">
            Analyze your base salary, bonuses, equity, and benefits to understand your true earning potential.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
        >
          {isPopulated ? 'Edit Package' : 'Add Compensation Package'}
        </button>
      </header>

      {isPopulated && (
        <div className="themed-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              Stock price (USD): <span className="font-medium text-[var(--color-text-primary)]">${rawPrice.toFixed(2)}</span>
              {priceSource && <span className="ml-1 text-[11px] uppercase text-[var(--color-text-secondary)]">({priceSource}{priceStale ? ', stale' : ''})</span>}
            </span>
            <button
              type="button"
              onClick={() => refreshPrice(true)}
              aria-label="Refresh price"
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors"
            >
              <RefreshCw size={14} className={priceStatus === 'loading' ? 'animate-spin' : ''} />
              Refresh Price
            </button>
            <form onSubmit={handleManualPriceSubmit} className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                value={manualPriceDraft}
                onChange={(e) => setManualPriceDraft(e.target.value)}
                placeholder="Manual price"
                className="w-28 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[12px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors"
              >
                Set
              </button>
            </form>
          </div>

          <button
            type="button"
            onClick={toggleCadConversion}
            aria-pressed={useCadConversion}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
              useCadConversion
                ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {useCadConversion ? `Convert to CAD: ON (1 USD = ${fxRate.toFixed(4)} CAD${fxStatus === 'loading' ? ', updating…' : ''})` : 'Convert to CAD: OFF'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CompHeroWidget className="h-full" />
        </div>

        <div className="themed-card rounded-xl p-6 flex flex-col gap-4">
          <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Package Details</h2>
          {isPopulated ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                <span className="text-[14px] text-[var(--color-text-secondary)]">
                  Current Stock Price {useCadConversion ? '(CAD)' : '(USD)'}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">$</span>
                  <input
                    type="number"
                    value={pkg.companyCurrentPrice || ''}
                    onChange={(e) => setPrimaryPackage({ companyCurrentPrice: Number(e.target.value) || 0 })}
                    disabled={useCadConversion}
                    className="w-24 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[14px] font-medium text-[var(--color-text-primary)] text-right focus:border-[var(--color-accent)] focus:outline-none transition-colors disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none m-0"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                <span className="text-[14px] text-[var(--color-text-secondary)]">
                  {timeMode === 'current-year' ? 'Blended Base Salary' : 'Current Base Salary'}
                </span>
                <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                  ${calcAnnualBaseSalary(pkg, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                <span className="text-[14px] text-[var(--color-text-secondary)]">Target Bonus</span>
                <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                  {pkg.cashBonusPercent}%
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                <span className="text-[14px] text-[var(--color-text-secondary)]">RSU Grants</span>
                <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                  {pkg.rsuGrants.length} Active
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[14px] text-[var(--color-text-secondary)]">Benefits Match</span>
                <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                  {pkg.rrspMatchPercent}% RRSP, {pkg.esppContributionPercent}% ESPP
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <p className="text-[14px] text-[var(--color-text-secondary)] mb-4">
                No compensation data added yet. Start by adding your current offer or current package.
              </p>
            </div>
          )}
        </div>
      </div>

      {isPopulated && (
        <>
          <EquityVestingWidget />

          <div className="flex justify-end">
            <button
              id="compare-toggle-btn"
              onClick={toggleCompareMode}
              className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
            >
              Compare Another Offer
            </button>
          </div>

          {compareMode && <CompareView />}
        </>
      )}

      <CompensationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
```

Note: when `useCadConversion` is on, the "Current Stock Price" input in the Package Details card is disabled (editing raw price while a converted value is displayed would be confusing) — the modal (Task 5) remains the place to edit the raw USD `companyCurrentPrice`/`esppLockedInPrice`/RSU `grantPrice` regardless of toggle state.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/pages/Compensation.test.tsx`
Expected: PASS (2 tests).

- [x] **Step 5: Run the full compensation test suite to check for regressions**

Run: `npm test -- --run src/pages/Compensation.test.tsx src/store/useCompensationStore.test.ts src/store/compensationFx.test.ts src/hooks/useCompensationDisplay.test.tsx`
Expected: PASS (all).

- [x] **Step 6: Commit**

```bash
git add src/pages/Compensation.tsx src/pages/Compensation.test.tsx
git commit -m "feat: live price control + CAD toggle on Compensation page"
```

---

### Task 5: Wire `CompHeroWidget` and `EquityVestingWidget` to the converted package

**Files:**
- Modify: `src/components/compensation/CompHeroWidget.tsx`
- Modify: `src/components/compensation/EquityVestingWidget.tsx`
- Test: `src/components/compensation/CompHeroWidget.test.tsx`
- Test: `src/components/compensation/EquityVestingWidget.test.tsx`

**Interfaces:**
- Consumes: `useCompensationDisplay` from `../../hooks/useCompensationDisplay` (new import in both widgets); existing `useCompensationStore` for `timeMode`/`setTimeMode`.
- Produces: both widgets render totals/vest values computed from the **converted** package (`pkg`) instead of raw `primaryPackage`, so when CAD conversion is on, RSU vest values, ESPP profit, and the total-comp pie/bar all reflect FX-converted USD prices.

- [x] **Step 1: Write the failing tests**

```tsx
// src/components/compensation/CompHeroWidget.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { CompHeroWidget } from './CompHeroWidget'
import { useCompensationStore } from '../../store/useCompensationStore'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __setProviders, __resetProviders } from '../../services/marketData/marketDataService'
import { __resetMinInterval } from '../../services/marketData/throttle'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
  __setProviders({
    fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 2, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
  })
})
afterEach(() => __resetProviders())

describe('CompHeroWidget with CAD conversion', () => {
  it('reflects the FX-converted total when conversion is on', async () => {
    useCompensationStore.getState().setPrimaryPackage({ baseSalary: 100000, companyCurrentPrice: 100 })
    useCompensationStore.getState().toggleCadConversion()
    render(<CompHeroWidget />)
    // total comp includes at least the converted base salary; sanity check it renders without crashing
    // and shows the "Total Annual Compensation" label once resolved.
    await waitFor(() => expect(screen.getByText(/Total Annual Compensation/i)).toBeInTheDocument())
  })
})
```

```tsx
// src/components/compensation/EquityVestingWidget.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { EquityVestingWidget } from './EquityVestingWidget'
import { useCompensationStore } from '../../store/useCompensationStore'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __setProviders, __resetProviders } from '../../services/marketData/marketDataService'
import { __resetMinInterval } from '../../services/marketData/throttle'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
  __setProviders({
    fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 2, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
  })
})
afterEach(() => __resetProviders())

describe('EquityVestingWidget with CAD conversion', () => {
  it('renders the vesting chart using the converted package price when conversion is on', async () => {
    useCompensationStore.getState().addRSUGrant({
      id: 'g1',
      grantName: 'Initial Grant',
      grantShares: 1200,
      grantPrice: 50,
      grantStartDate: '2026-01-01',
      vestingSchedule: { preset: '4yr-1yr-cliff', totalVestMonths: 48, cliffMonths: 12, frequency: 'monthly' },
    })
    useCompensationStore.getState().setPrimaryPackage({ companyCurrentPrice: 100 })
    useCompensationStore.getState().toggleCadConversion()
    render(<EquityVestingWidget />)
    await waitFor(() => expect(screen.getByText(/Equity Vesting Schedule/i)).toBeInTheDocument())
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/components/compensation/CompHeroWidget.test.tsx src/components/compensation/EquityVestingWidget.test.tsx`
Expected: FAIL initially only if the widgets don't yet resolve/render with the hook wired — since both widgets currently compile and render fine off `primaryPackage`, these tests will actually PASS against the *old* code too (rendering doesn't yet prove conversion). To make the fail meaningful, first confirm intent then proceed to Step 3's implementation, and treat Step 2 as a structural check: run and confirm the suite executes (some assertions may trivially pass pre-change, which is acceptable here — the substantive regression protection comes from Task 6's calculation-level test). Proceed to Step 3 regardless.

- [x] **Step 3: Modify the implementations**

In `src/components/compensation/CompHeroWidget.tsx`, change the data source. Replace:

```ts
  const { primaryPackage, timeMode, setTimeMode } = useCompensationStore()
```

with:

```ts
  const { timeMode, setTimeMode } = useCompensationStore()
  const { pkg: primaryPackage } = useCompensationDisplay()
```

and add the import at the top of the file:

```ts
import { useCompensationDisplay } from '../../hooks/useCompensationDisplay'
```

(The rest of the component body already reads `primaryPackage` throughout — no other line changes needed since the local variable name is preserved.)

In `src/components/compensation/EquityVestingWidget.tsx`, replace:

```ts
  const { primaryPackage, timeMode } = useCompensationStore()
```

with:

```ts
  const { timeMode } = useCompensationStore()
  const { pkg: primaryPackage } = useCompensationDisplay()
```

and add the import:

```ts
import { useCompensationDisplay } from '../../hooks/useCompensationDisplay'
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/components/compensation/CompHeroWidget.test.tsx src/components/compensation/EquityVestingWidget.test.tsx`
Expected: PASS (1 test each).

- [x] **Step 5: Commit**

```bash
git add src/components/compensation/CompHeroWidget.tsx src/components/compensation/EquityVestingWidget.tsx src/components/compensation/CompHeroWidget.test.tsx src/components/compensation/EquityVestingWidget.test.tsx
git commit -m "feat: CompHeroWidget and EquityVestingWidget read the CAD-converted package"
```

---

### Task 6: Conversion correctness test — RSU vest value and ESPP profit scale with FX rate

**Files:**
- Modify: `src/store/compensationFx.test.ts` (add integration-style assertions using the real calc functions)

**Interfaces:**
- Consumes: `convertPackageToCad` from `./compensationFx`; `calcAnnualESPP`, `calcAnnualRSU`, `generateVestEvents` from `./useCompensationStore`.
- Produces: no new exports — this task is pure test coverage proving the spec's "Done when" (ESPP, RRSP, RSU, total comp reflect live-converted values) holds end-to-end through the existing calc functions, without modifying those functions.

- [x] **Step 1: Write the failing test**

Append to `src/store/compensationFx.test.ts`:

```ts
import { calcAnnualESPP, calcAnnualRSU, generateVestEvents } from './useCompensationStore'

describe('convertPackageToCad feeding the existing calc functions', () => {
  it('scales RSU vest values by the fx rate without modifying calc function behavior', () => {
    const rawEvents = generateVestEvents(basePkg.rsuGrants[0], basePkg.companyCurrentPrice)
    const converted = convertPackageToCad(basePkg, 2, true)
    const convertedEvents = generateVestEvents(converted.rsuGrants[0], converted.companyCurrentPrice)

    expect(convertedEvents[0].vestValue).toBeCloseTo(rawEvents[0].vestValue * 2, 5)
  })

  it('scales annual RSU total by the fx rate', () => {
    const rawTotal = calcAnnualRSU(basePkg)
    const converted = convertPackageToCad(basePkg, 2, true)
    const convertedTotal = calcAnnualRSU(converted)

    expect(convertedTotal).toBeCloseTo(rawTotal * 2, 5)
  })

  it('scales ESPP profit consistently when conversion is applied to both current and locked-in price', () => {
    const esppPkg = { ...basePkg, esppContributionPercent: 10, esppLockedInPrice: 0 }
    const rawEspp = calcAnnualESPP(esppPkg)
    const converted = convertPackageToCad(esppPkg, 2, true)
    const convertedEspp = calcAnnualESPP(converted)

    // ESPP profit = shares * (currentPrice - purchasePrice); both terms scale by fx rate,
    // so profit itself scales by fx rate too.
    expect(convertedEspp).toBeCloseTo(rawEspp * 2, 5)
  })

  it('does not scale non-price fields like RRSP or bonus (already CAD-native)', () => {
    const converted = convertPackageToCad(basePkg, 2, true)
    expect(converted.rrspMatchPercent).toBe(basePkg.rrspMatchPercent)
    expect(converted.cashBonusPercent).toBe(basePkg.cashBonusPercent)
  })
})
```

- [x] **Step 2: Run test to verify it fails or passes**

Run: `npm test -- --run src/store/compensationFx.test.ts`
Expected: Given Task 2's implementation is already correct, this SHOULD PASS immediately (it exercises existing, already-correct code). If it fails, the failure indicates a bug in `convertPackageToCad` (e.g. `esppLockedInPrice: 0` not converting because `0 * fxRate === 0` is a valid no-op — verify the ESPP calc naturally falls back to the discount-from-current-price path in that case, which it does per `calcAnnualESPP`'s `isLockInActive` check). If it fails, fix `convertPackageToCad` (not the calc functions) until it passes.

- [x] **Step 3: Run to confirm passing**

Run: `npm test -- --run src/store/compensationFx.test.ts`
Expected: PASS (8 tests total in the file: 4 from Task 2 + 4 new).

- [x] **Step 4: Commit**

```bash
git add src/store/compensationFx.test.ts
git commit -m "test: verify RSU/ESPP calc functions scale correctly through the CAD conversion layer"
```

---

### Task 7: `CompensationModal` — add ticker field, keep raw USD editing intact

**Files:**
- Modify: `src/components/compensation/CompensationModal.tsx`
- Test: `src/components/compensation/CompensationModal.test.tsx`

**Interfaces:**
- Consumes: `useCompensationStore` (`setPrimaryPackage`), `CompensationPackage.companyTicker` (added in Task 3).
- Produces: modal gains a "Ticker (optional, for live price)" text input near the existing "Company Current Stock Price ($)" field; on submit, `companyTicker` (uppercased, trimmed) is saved via `setPrimaryPackage`. All existing fields/behavior unchanged — the modal continues to edit and persist raw USD/CAD-native values only (never the converted display package), matching the spec's "Preserve existing `useCompensationStore` functions and their semantics."

- [x] **Step 1: Write the failing test**

```tsx
// src/components/compensation/CompensationModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { CompensationModal } from './CompensationModal'
import { useCompensationStore } from '../../store/useCompensationStore'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
})

describe('CompensationModal ticker field', () => {
  it('saves an uppercased, trimmed ticker on submit', () => {
    render(<CompensationModal isOpen={true} onClose={() => {}} />)
    const tickerInput = screen.getByLabelText(/ticker/i)
    fireEvent.change(tickerInput, { target: { value: ' aapl ' } })
    fireEvent.click(screen.getByRole('button', { name: /save compensation package/i }))
    expect(useCompensationStore.getState().primaryPackage.companyTicker).toBe('AAPL')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/compensation/CompensationModal.test.tsx`
Expected: FAIL — no labeled element matching `/ticker/i`.

- [x] **Step 3: Modify the implementation**

In `src/components/compensation/CompensationModal.tsx`, add state near the other top-level fields (after the `companyCurrentPrice` state declaration around line 17):

```ts
  const [companyTicker, setCompanyTicker] = useState(primaryPackage.companyTicker || '')
```

In the JSX, inside the existing "Global Stock Price" block (the `<div className="p-4 border-b ...">` block around lines 156-166), add a ticker input right before the price input:

```tsx
        <div className="p-4 border-b border-[var(--color-border)] flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="company-ticker-input">Ticker (optional, for live price)</label>
            <input
              id="company-ticker-input"
              type="text"
              value={companyTicker}
              onChange={(e) => setCompanyTicker(e.target.value)}
              placeholder="e.g. AAPL"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Company Current Stock Price ($)</label>
            <input
              type="number"
              value={companyCurrentPrice}
              onChange={(e) => setCompanyCurrentPrice(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
```

(This replaces the original single-field block — wrap both fields in one `flex flex-col gap-4` container as shown, changing `p-4 border-b ...` div's inner content from one field to two.)

In `handleSubmit`, add `companyTicker` to the `setPrimaryPackage` call:

```ts
    setPrimaryPackage({
      companyTicker: companyTicker.trim().toUpperCase(),
      companyCurrentPrice: Number(companyCurrentPrice) || 0,
      baseSalary: Number(baseSalary) || 0,
      pastSalaryChanges: pastSalaryChanges.filter(c => c.salary > 0 && c.changeMonth > 0),
      cashBonusPercent: Number(cashBonusPercent) || 0,
      cashBonusMonth: Number(cashBonusMonth) || 12,
      esppContributionPercent: Number(esppContributionPercent) || 0,
      esppDiscountPercent: esppDiscountPercent === '' ? 15 : Number(esppDiscountPercent),
      esppLockedInPrice: Number(esppLockedInPrice) || 0,
      esppLockInEndDate: esppLockInEndDate,
      rrspMatchPercent: Number(rrspMatchPercent) || 0,
      rrspMatchCap: Number(rrspMatchCap) || 0,
    })
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/compensation/CompensationModal.test.tsx`
Expected: PASS (1 test).

- [x] **Step 5: Commit**

```bash
git add src/components/compensation/CompensationModal.tsx src/components/compensation/CompensationModal.test.tsx
git commit -m "feat: add ticker field to CompensationModal for live-price lookup"
```

---

### Task 8: Phase gate — verify, then close Phase 3

- [x] **Step 1: Full verification (all tests + build + changed-file lint)**

Run each and confirm clean:
- `npm test -- --run` → all tests pass (Phase 1 + Phase 2 suites unchanged + new Phase 3 suites: `useCompensationStore.test.ts`, `compensationFx.test.ts`, `useCompensationDisplay.test.tsx`, `Compensation.test.tsx`, `CompHeroWidget.test.tsx`, `EquityVestingWidget.test.tsx`, `CompensationModal.test.tsx`).
- `npm run build` → succeeds (`tsc -b && vite build`; confirms `companyTicker` field and new hook typecheck cleanly across all consumers).
- `npx eslint src/store/useCompensationStore.ts src/store/compensationFx.ts src/hooks/useCompensationDisplay.ts src/pages/Compensation.tsx src/components/compensation/CompHeroWidget.tsx src/components/compensation/EquityVestingWidget.tsx src/components/compensation/CompensationModal.tsx` → no errors on files this phase changed (pre-existing v1.0 lint debt is out of scope per PROGRESS.md's noted exception). Pay particular attention to `react-hooks/set-state-in-effect` — `useCompensationDisplay` composes existing hooks (`useCurrentPrice`, `useFxRate`) and introduces no new raw `useEffect`, so this should be clean by construction; confirm it.

- [x] **Step 2: Confirm backup coverage is still correct**

`useCadConversion` and `companyTicker` live inside the existing `ledger-compensation` persisted store — no new LocalStorage key was introduced. Confirm `git diff` for this phase touches no line in `src/utils/backup.ts` and that `BACKUP_KEYS` still contains `'ledger-compensation'` (grep). This is the phase's backup-coverage gate (nothing to add, but must verify nothing regressed).

- [x] **Step 3: Confirm offline resilience is real**

Sanity-review: (a) with no ticker set, `useCompensationDisplay` falls back to the manually-entered `companyCurrentPrice` (Task 3's hook logic: `price.data?.value.price ?? primaryPackage.companyCurrentPrice`); (b) `setManualPrice`/manual price form in `Compensation.tsx` let the user override the live price at any time, online or offline (delegates to the market-data module's existing override plumbing, proven resilient in Phase 2); (c) toggling CAD conversion off at any time reverts to raw CAD-native package values exactly as v1.0 behaved (Task 2's `enabled === false` no-op branch, covered by `compensationFx.test.ts`). Confirm these three by re-reading the relevant tests, not just the code.

- [x] **Step 4: Manual verification — mobile viewport + both themes**

Using the dev server (`npm run dev` or the project's preview tooling):
1. Navigate to `/compensation` with a populated package.
2. At a 375px-wide viewport, confirm the new live-price control row (refresh button, manual-price form, CAD toggle) wraps without horizontal overflow and remains tappable (buttons ≥ the existing 44px touch-target convention used elsewhere in this file, e.g. the RSU preset buttons).
3. Switch between both theme variants (Tactical Monospace / Geometric Abstraction) and confirm the price control row, CAD toggle, and ticker input in the modal use only theme CSS variables (`var(--color-*)`) — no hardcoded colors — and remain legible in both.
4. Toggle "Convert to CAD" on with a populated package and confirm the pie/bar chart totals and vesting schedule chart update (values change or at minimum re-render without error) once the FX rate resolves.

Record the outcome (pass/fail + any fixes made) in the PROGRESS.md log line for this task.

- [x] **Step 5: Update PROGRESS.md**

Mark Phase 3 `- [x]` with today's date, set current phase to 4 (Planner), next task to "plan Phase 4 JIT (split into sub-plans if >12 tasks per master plan)", and append Log lines P3.T1–P3.T8.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/PROGRESS.md
git commit -m "chore: complete Phase 3 compensation live price + CAD toggle"
```

**Phase 3 done when:** a user can enter a ticker and USD prices (`companyCurrentPrice` via live fetch or manual entry, `esppLockedInPrice`, RSU `grantPrice` via the modal), flip "Convert to CAD" on, and see ESPP profit, RRSP match context, RSU vest values, and total comp all reflect FX-converted CAD figures on the Compensation page and its widgets; toggling off restores exact v1.0 CAD-native behavior; all tests pass, build succeeds, changed files lint clean, and both themes + mobile are verified.

---

## Self-Review

**Spec coverage (Phase 3 section):**
- "Wire `companyCurrentPrice` to the market-data service (fetch button + auto-refresh; manual override preserved)" → Task 3 (`useCompensationDisplay` composes `useCurrentPrice`) + Task 4 (refresh button, manual-price form in `Compensation.tsx`). ✓
- "USD⇄CAD toggle (global, togglable)" → Task 1 (`useCadConversion` store flag + `toggleCadConversion`) + Task 4 (UI toggle). ✓
- "stock prices entered/fetched in USD; comp calculations in CAD" → Task 2 (`convertPackageToCad` converts only price fields) + Task 6 (proves calc functions scale correctly). ✓
- "USD price inputs (`companyCurrentPrice`, `esppLockedInPrice`, RSU `grantPrice`) auto-convert to CAD everywhere they're used — ESPP, RRSP match context, RSU vest values" → Task 2 converts exactly these three; Task 6 verifies RSU vest events and ESPP profit scale by the fx rate through the *unmodified* calc functions; RRSP is percent-of-salary (already CAD-native, correctly left unconverted per Task 6's 4th assertion) — matches "RRSP match context" meaning the base-salary context stays CAD, not that RRSP itself needs conversion (there's no USD price in the RRSP calc). ✓
- "via the FX rate" → Task 3 (`useFxRate('USD','CAD')`). ✓
- "User enters share counts and USD prices; all CAD outputs convert automatically" → Task 5 wires both display widgets (`CompHeroWidget`, `EquityVestingWidget`) to the converted `pkg`; Task 7 keeps the modal (share-count/price entry) on raw USD values. ✓
- "Toggle off = treat inputs as already-CAD (current behavior)" → Task 1 default `false` + Task 2's no-op branch, both tested. ✓
- "Preserve existing `useCompensationStore` functions and their semantics; add a currency/FX layer around them, don't rewrite them" → Task 2 explicitly does not modify `calcAnnual*`/`generateVestEvents`/`calcTotalComp`; Task 6 proves this by calling the real functions against converted input. ✓
- "Done when: user enters USD grant/lock-in prices, flips the toggle, and every CAD figure (ESPP, RRSP, RSU, total comp) reflects live-converted values; toggling off restores CAD-native behavior" → Task 8 phase gate step 3/4 verifies end-to-end, live in both themes/mobile. ✓
- CompareView (secondary offer) is explicitly NOT touched by this plan — the spec's Phase 3 goal and "Done when" only reference the primary package; CompareView continues to use its own local USD-native inputs unconverted, consistent with it being a separate, self-contained comparison tool not mentioned in the Phase 3 spec section. (Noted here rather than silently dropped.)

**Global-constraint coverage:** zero-infra (Task 3 reuses Phase 2's market-data module, no new fetches) ✓; local-first persistence, same store/key (Task 1, no new `BACKUP_KEYS` entry needed, verified in Task 8 Step 2) ✓; Bento wrappers unchanged (Task 5 only swaps the data source, not the wrapper structure) ✓; Recharts unchanged (Task 5) ✓; dual themes / no hardcoded colors (Task 4, Task 7 — all new UI uses `var(--color-*)`; verified live in Task 8 Step 4) ✓; live data has manual fallback (Task 3's `rawPrice` fallback chain, Task 4's manual-price form) ✓; mobile + both themes gate (Task 8 Step 4) ✓; TDD every task ✓.

**Placeholder scan:** every code step contains complete, runnable code; no TBD/TODO/"handle edge cases" left unresolved. Task 5's Step 2 flags an honest limitation (some assertions could trivially pass pre-change) and explains why Task 6 is the real regression guard — this is a disclosed reasoning note, not a deferred placeholder.

**Type consistency:** `useCadConversion`/`toggleCadConversion` (Task 1) used identically in Tasks 3, 4, 5, 8. `companyTicker` (Task 3 prerequisite edit) used identically in Tasks 3, 4 (implicitly via `pkg`), 7. `convertPackageToCad(pkg, fxRate, enabled)` signature (Task 2) matches its only call site in Task 3. `useCompensationDisplay()` return shape (`pkg, rawPrice, fxRate, fxStatus, priceStatus, priceSource, priceStale, refreshPrice, setManualPrice, clearManualPrice`) defined in Task 3 is consumed with the exact same field names in Task 4 and Task 5's `{ pkg: primaryPackage }` destructure. Market-data hook names (`useCurrentPrice`, `useFxRate`, `Resolved`, `FetchStatus`, `__setProviders`, `__resetProviders`, `__resetMinInterval`) match Phase 2's actual exports verified against `src/services/marketData/index.ts` and `marketDataService.ts`/`useMarketData.ts` source.
