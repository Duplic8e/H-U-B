# v0.6 Fixes Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 9 approved items: live stock price in the compensation modal, a label fix, beta version labels, a 9-currency converter with a BDT fallback provider, mortgage toggle layout, a consolidated Settings hub (desktop dock + mobile tab bar), adaptive debt-payoff rows, the global mobile scroll-cutoff fix, and a native port of the standalone wheel tracker as an "Options" tab in Investments (Tasks 11–14).

**Architecture:** All work is inside the existing React 19 + Vite + Zustand + Tailwind v4 SPA. The FX change widens the `Currency` union and adds a provider router (Frankfurter primary, open.er-api.com fallback for BDT). The Settings hub replaces three separate dock controls with one `SettingsSheet` modal composed of refactored existing sections.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS v4, vitest + @testing-library/react, lucide-react icons, `Sheet` UI primitive (modal on desktop / bottom sheet on mobile).

**Spec:** `docs/superpowers/specs/2026-07-15-v06-fixes-batch-design.md` (approved).

## Global Constraints

- Testing is MINIMAL by explicit user decision: new tests only for the er-api parser and FX provider routing; otherwise only update existing tests that refactors break. Layout/label changes are verified visually.
- Full suite must stay green: `npx vitest run` (baseline 338 tests). Never add `.claude/worktrees` to the test glob (already excluded in `vitest.config.ts`).
- Windows checkout; concurrent Claude sessions commit to this repo — before each commit, `git add` ONLY the files you touched, never `git add -A`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Compensation USD→CAD behavior must not change (it keeps the fixed pair).
- App copy style: Title Case for field labels (matches existing "Rate Date (Optional)" etc.).
- Run `npx eslint src --max-warnings 0` (or the repo's `npm run lint` if defined in package.json) before the final commit of each task that touches `.ts/.tsx`.

---

### Task 1: Label fix + beta version labels

**Files:**
- Modify: `src/components/ui/ThemedDatePicker.tsx:98`
- Modify: `CHANGELOG.md:9,25`
- Modify: `package.json:3` (the `"version"` field)

**Interfaces:**
- Produces: app-wide `__APP_VERSION__` becomes `0.5.0-beta` (Vite injects it from package.json version). No code consumes the changelog headings programmatically except `WhatsNewModal`'s `## `-prefix parser, which is heading-text agnostic.

- [ ] **Step 1: Fix the date picker placeholder**

In `src/components/ui/ThemedDatePicker.tsx` line 98, change:

```tsx
        <span>{value || 'Select date'}</span>
```

to:

```tsx
        <span>{value || 'Select Date'}</span>
```

- [ ] **Step 2: Rename changelog headings**

In `CHANGELOG.md`, change line 9 `## [0.5.0] - 2026-07-13` to `## [0.5.0-beta] - 2026-07-13` and line 25 `## [0.4.0] - 2026-07-11` to `## [0.4.0-beta] - 2026-07-11`. Do not touch dates or body content. (If the file has link-reference definitions like `[0.5.0]: https://...` at the bottom, rename those keys to match; check with `grep -n "^\[0\." CHANGELOG.md`.)

- [ ] **Step 3: Bump package.json version**

In `package.json`, change `"version": "0.4.0"` to `"version": "0.5.0-beta"`.

- [ ] **Step 4: Verify tests still pass**

Run: `npx vitest run src/components/ui/ThemedDatePicker.test.tsx src/components/ui/WhatsNewModal.test.tsx src/utils/whatsNew.test.ts`
Expected: PASS. If `ThemedDatePicker.test.tsx` asserts the literal string `Select date`, update that assertion to `Select Date`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ThemedDatePicker.tsx src/components/ui/ThemedDatePicker.test.tsx CHANGELOG.md package.json
git commit -m "fix: capitalize Select Date placeholder; label 0.4/0.5 releases as beta"
```

(Note: bumping the version will show the What's New modal once for existing users — accepted in spec.)

---

### Task 2: Live stock price pre-fill in Edit Compensation modal

**Files:**
- Modify: `src/components/compensation/CompensationModal.tsx`
- Test (update if broken): `src/components/compensation/CompensationModal.test.tsx`

**Interfaces:**
- Consumes: `useCompensationDisplay()` from `src/hooks/useCompensationDisplay.ts` — returns `{ rawPrice: number, priceSource?: 'override' | 'live' | 'cache', ... }`. `rawPrice` is the live/override/cached USD price when a ticker resolves, else the stored manual `companyCurrentPrice`.
- Produces: no new exports. Save behavior unchanged: submit stores the shown value as `companyCurrentPrice`.

**Background:** The modal currently seeds `useState(primaryPackage.companyCurrentPrice || 100)` — the stored manual price — so with a ticker set the field shows a stale value and saving clobbers reality. The component stays mounted while closed (`Sheet` handles visibility), so seeding must happen on open, not on mount.

- [ ] **Step 1: Wire the live price into the modal**

In `src/components/compensation/CompensationModal.tsx`:

Add imports (top of file):

```tsx
import React, { useEffect, useState } from 'react'
import { useCompensationDisplay } from '../../hooks/useCompensationDisplay'
```

Inside the component, after the existing `useCompensationStore` destructure, add:

```tsx
  const { rawPrice, priceSource } = useCompensationDisplay()
```

Replace the price state seed (line ~36):

```tsx
  const [companyCurrentPrice, setCompanyCurrentPrice] = useState(primaryPackage.companyCurrentPrice || 100)
```

with:

```tsx
  const [companyCurrentPrice, setCompanyCurrentPrice] = useState(rawPrice || 100)

  // Re-seed from the live/override price each time the modal opens, so a
  // reopened modal reflects the price the top bar shows. Deliberately NOT
  // keyed on rawPrice: a live refresh must not clobber mid-edit typing.
  useEffect(() => {
    if (isOpen) setCompanyCurrentPrice(rawPrice || 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])
```

- [ ] **Step 2: Add the live-source caption**

Directly under the price `NumberInput` (after line ~198, inside the same `flex flex-col gap-2` div), add:

```tsx
            {(priceSource === 'live' || priceSource === 'cache') && (
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Pre-filled from the live {companyTicker.trim().toUpperCase() || 'ticker'} price — edit to override.
              </p>
            )}
```

- [ ] **Step 3: Run the existing modal tests**

Run: `npx vitest run src/components/compensation/CompensationModal.test.tsx src/hooks/useCompensationDisplay.test.tsx`
Expected: PASS — the default test package has no ticker, so `rawPrice` falls back to the stored manual price and existing assertions hold. If a test seeds a package differently and the price field assertion changes, update the expected value to match `rawPrice` semantics (it is the correct new behavior), not the other way around.

- [ ] **Step 4: Visual verification**

Start the dev server (preview tools / `.claude/launch.json`), open Compensation, set a ticker with a live price (or a quote override), open Edit Package: the price field must show the same number as the top bar, with the caption visible. Type a new number, save, confirm it persists.

- [ ] **Step 5: Commit**

```bash
git add src/components/compensation/CompensationModal.tsx src/components/compensation/CompensationModal.test.tsx
git commit -m "fix(compensation): pre-fill edit modal stock price from live price"
```

---

### Task 3: Widen Currency type + er-api fallback provider + routing

**Files:**
- Modify: `src/services/marketData/types.ts:1`
- Create: `src/services/marketData/providers/erApi.ts`
- Create: `src/services/marketData/providers/erApi.test.ts`
- Create: `src/services/marketData/providers/fxRouter.ts`
- Create: `src/services/marketData/providers/fxRouter.test.ts`
- Modify: `src/services/marketData/marketDataService.ts:3,25,30` (swap `fetchFxRate` for the router)

**Interfaces:**
- Produces:
  - `Currency` union widened to `'USD' | 'CAD' | 'EUR' | 'GBP' | 'AUD' | 'JPY' | 'KRW' | 'INR' | 'BDT'`, plus `export const CURRENCIES: readonly Currency[]` for dropdowns (Task 4 consumes this via `services/marketData`).
  - `fetchErApiFxRate(from: Currency, to: Currency): Promise<FxRate>` (no date support).
  - `fetchFxRateRouted(from: Currency, to: Currency, date?: string): Promise<FxRate>` and `FRANKFURTER_CURRENCIES: ReadonlySet<string>` from `fxRouter.ts`.
- Consumes: existing `FxRate` type, `todayKey()` from `../dateKey`, `fetchFxRate` from `./frankfurter`.

- [ ] **Step 1: Widen the Currency type**

In `src/services/marketData/types.ts`, replace line 1:

```ts
export type Currency = 'USD' | 'CAD'
```

with:

```ts
export const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'KRW', 'INR', 'BDT'] as const
export type Currency = (typeof CURRENCIES)[number]
```

Then re-export it: in `src/services/marketData/index.ts` the first line is `export * from './types'`, so `CURRENCIES` is exported automatically — verify with `grep -n "export \* from './types'" src/services/marketData/index.ts`.

- [ ] **Step 2: Typecheck the widening**

Run: `npx tsc --noEmit`
Expected: PASS. `Quote.currency: Currency` is only ever set to `'USD'` today; a wider union cannot break assignments. If any comparison like `from === 'USD' ? 'CAD' : 'USD'` errors, it's in `CurrencyConverter.tsx` and gets rewritten in Task 4 — for now it still typechecks because both literals remain members.

- [ ] **Step 3: Write the failing er-api provider test**

Create `src/services/marketData/providers/erApi.test.ts` (mirror the fetch-stubbing style of `frankfurter.test.ts` — read it first and copy its stub helper if one exists):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchErApiFxRate, ER_API_BASE } from './erApi'

const mockFetch = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) }))

afterEach(() => vi.unstubAllGlobals())

describe('fetchErApiFxRate', () => {
  it('fetches latest rates for the base currency and picks the target', async () => {
    mockFetch({ result: 'success', base_code: 'USD', rates: { BDT: 117.5 } })
    const fx = await fetchErApiFxRate('USD', 'BDT')
    expect(fetch).toHaveBeenCalledWith(`${ER_API_BASE}/latest/USD`)
    expect(fx.rate).toBe(117.5)
    expect(fx.from).toBe('USD')
    expect(fx.to).toBe('BDT')
  })

  it('throws when the response is not success or the rate is missing', async () => {
    mockFetch({ result: 'error' })
    await expect(fetchErApiFxRate('USD', 'BDT')).rejects.toThrow()
    mockFetch({ result: 'success', rates: {} })
    await expect(fetchErApiFxRate('USD', 'BDT')).rejects.toThrow('missing target rate')
  })

  it('short-circuits identical currencies with rate 1 and no fetch', async () => {
    const spy = mockFetch({})
    const fx = await fetchErApiFxRate('BDT', 'BDT')
    expect(fx.rate).toBe(1)
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/services/marketData/providers/erApi.test.ts`
Expected: FAIL — `Cannot find module './erApi'`.

- [ ] **Step 5: Implement the er-api provider**

Create `src/services/marketData/providers/erApi.ts`:

```ts
import type { Currency, FxRate } from '../types'
import { todayKey } from '../dateKey'

export const ER_API_BASE = 'https://open.er-api.com/v6'

interface ErApiResponse {
  result: string
  base_code: string
  rates: Record<string, number>
}

/** Free fallback FX source (no key). Latest rates only — no historical dates. */
export async function fetchErApiFxRate(from: Currency, to: Currency): Promise<FxRate> {
  const now = new Date().toISOString()
  if (from === to) {
    return { from, to, rate: 1, date: todayKey(), asOf: now }
  }

  const res = await fetch(`${ER_API_BASE}/latest/${from}`)
  if (!res.ok) throw new Error(`er-api request failed: ${res.status}`)
  const json = (await res.json()) as ErApiResponse
  if (json.result !== 'success') throw new Error('er-api returned an error')
  const rate = json.rates?.[to]
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new Error('er-api response missing target rate')
  }
  return { from, to, rate, date: todayKey(), asOf: now }
}
```

- [ ] **Step 6: Run the provider test to verify it passes**

Run: `npx vitest run src/services/marketData/providers/erApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Write the failing router test**

Create `src/services/marketData/providers/fxRouter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('./frankfurter', () => ({ fetchFxRate: vi.fn().mockResolvedValue({ from: 'USD', to: 'EUR', rate: 0.9, date: '2026-07-15', asOf: 'x' }) }))
vi.mock('./erApi', () => ({ fetchErApiFxRate: vi.fn().mockResolvedValue({ from: 'USD', to: 'BDT', rate: 117.5, date: '2026-07-15', asOf: 'x' }) }))

import { fetchFxRateRouted, FRANKFURTER_CURRENCIES } from './fxRouter'
import { fetchFxRate } from './frankfurter'
import { fetchErApiFxRate } from './erApi'

describe('fetchFxRateRouted', () => {
  it('routes pairs Frankfurter supports to Frankfurter (with the date)', async () => {
    await fetchFxRateRouted('USD', 'EUR', '2026-01-02')
    expect(fetchFxRate).toHaveBeenCalledWith('USD', 'EUR', '2026-01-02')
    expect(fetchErApiFxRate).not.toHaveBeenCalled()
  })

  it('routes any pair involving an unsupported currency to er-api (date dropped)', async () => {
    await fetchFxRateRouted('USD', 'BDT', '2026-01-02')
    expect(fetchErApiFxRate).toHaveBeenCalledWith('USD', 'BDT')
  })

  it('knows BDT is not a Frankfurter currency', () => {
    expect(FRANKFURTER_CURRENCIES.has('BDT')).toBe(false)
    expect(FRANKFURTER_CURRENCIES.has('KRW')).toBe(true)
  })
})
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npx vitest run src/services/marketData/providers/fxRouter.test.ts`
Expected: FAIL — `Cannot find module './fxRouter'`.

- [ ] **Step 9: Implement the router and wire it into the service**

Create `src/services/marketData/providers/fxRouter.ts`:

```ts
import type { Currency, FxRate } from '../types'
import { fetchFxRate } from './frankfurter'
import { fetchErApiFxRate } from './erApi'

/** Currencies served by Frankfurter (ECB reference rates). BDT is not one. */
export const FRANKFURTER_CURRENCIES: ReadonlySet<string> = new Set([
  'USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'KRW', 'INR',
])

/** Frankfurter for pairs it supports (incl. historical dates); er-api
 *  otherwise (latest only — the date is intentionally dropped). */
export function fetchFxRateRouted(from: Currency, to: Currency, date?: string): Promise<FxRate> {
  if (FRANKFURTER_CURRENCIES.has(from) && FRANKFURTER_CURRENCIES.has(to)) {
    return fetchFxRate(from, to, date)
  }
  return fetchErApiFxRate(from, to)
}
```

In `src/services/marketData/marketDataService.ts`, change line 3 from:

```ts
import { fetchFxRate } from './providers/frankfurter'
```

to:

```ts
import { fetchFxRateRouted } from './providers/fxRouter'
```

and in the `Providers` interface + `defaultProviders` (lines 22–31), replace both `fetchFxRate`-typed entries:

```ts
interface Providers {
  fetchQuote: typeof fetchAlphaVantageQuote
  fetchHistorical: typeof fetchAlphaVantageHistorical
  fetchFxRate: typeof fetchFxRateRouted
}
const defaultProviders: Providers = {
  fetchQuote: fetchAlphaVantageQuote,
  fetchHistorical: fetchAlphaVantageHistorical,
  fetchFxRate: fetchFxRateRouted,
}
```

(The call site `providers.fetchFxRate(from, to, date)` at line 137 is signature-compatible — no change.)

- [ ] **Step 10: Run the FX test suite**

Run: `npx vitest run src/services/marketData`
Expected: PASS — new tests plus all existing frankfurter/alphaVantage/marketDataService/useMarketData tests. `marketDataService.test.ts` injects fake providers via `__setProviders`, so the router swap is invisible to it.

- [ ] **Step 11: Commit**

```bash
git add src/services/marketData/types.ts src/services/marketData/providers/erApi.ts src/services/marketData/providers/erApi.test.ts src/services/marketData/providers/fxRouter.ts src/services/marketData/providers/fxRouter.test.ts src/services/marketData/marketDataService.ts
git commit -m "feat(fx): widen Currency to 9 codes; add er-api fallback provider with routing"
```

---

### Task 4: Currency converter From/To dropdowns

**Files:**
- Modify: `src/components/planner/CurrencyConverter.tsx` (full rework of the input row + formatting)

**Interfaces:**
- Consumes: `CURRENCIES`, `Currency` from `../../services/marketData` (Task 3); `SelectField` from `./SelectField` (`{ label, value, onChange, options }`); everything else already imported in the file.
- Produces: persisted planner inputs for tool `currency-converter` gain a `to` field. Old persisted state (`{ amount, from, date }`) must keep working: `useToolInputs` merges stored values over `DEFAULTS`, so a missing `to` falls back to the default `'CAD'`. One edge: a user with stored `from: 'CAD'` gets `CAD → CAD`; the `from === to` case renders rate 1 (service short-circuits) which is harmless and self-corrects on first selection.

- [ ] **Step 1: Rework the converter**

Replace the contents of `src/components/planner/CurrencyConverter.tsx` with:

```tsx
import React from 'react'
import { ArrowLeftRight, RefreshCw } from 'lucide-react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { CURRENCIES, fxKey, todayKey, useFxRate, type Currency } from '../../services/marketData'
import { FRANKFURTER_CURRENCIES } from '../../services/marketData/providers/fxRouter'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { CalculatorField } from './CalculatorField'
import { SelectField } from './SelectField'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { ResultCard } from './ResultCard'
import { NumberInput } from '../ui/NumberInput'

const TOOL_ID = 'currency-converter'
const DEFAULTS = { amount: 100, from: 'USD' as string, to: 'CAD' as string, date: '' as string }

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }))

function formatAmount(n: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency, currencyDisplay: 'code',
  }).format(n)
}

export const CurrencyConverter: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)

  const from = inputs.from as Currency
  const to = inputs.to as Currency
  // er-api (BDT pairs) has no historical rates: drop the date for those pairs.
  const historicalSupported = FRANKFURTER_CURRENCIES.has(from) && FRANKFURTER_CURRENCIES.has(to)
  const date = historicalSupported ? inputs.date || undefined : undefined
  const fx = useFxRate(from, to, date)

  const overrideKey = fxKey(from, to, date ?? todayKey())
  const override = useMarketDataStore((s) => s.overrides[overrideKey])
  const setOverride = useMarketDataStore((s) => s.setOverride)
  const clearOverride = useMarketDataStore((s) => s.clearOverride)

  const rate = override ?? fx.data?.value.rate
  const converted = rate !== undefined ? inputs.amount * rate : undefined

  const swap = () => {
    setInput(TOOL_ID, 'from', to)
    setInput(TOOL_ID, 'to', from)
  }

  const sourceLabel =
    override !== undefined
      ? 'manual override'
      : fx.data
        ? `${fx.data.source}${fx.data.stale ? ' (stale)' : ''}, as of ${new Date(fx.data.asOf).toLocaleString()}`
        : fx.status

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
        <CalculatorField label={`Amount (${from})`} step={10} value={inputs.amount} onChange={(v) => setInput(TOOL_ID, 'amount', v)} />
        <SelectField label="From" value={from} onChange={(v) => setInput(TOOL_ID, 'from', v)} options={CURRENCY_OPTIONS} />
        <button
          onClick={swap}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          aria-label="Swap currencies"
        >
          <ArrowLeftRight className="w-4 h-4" /> Swap
        </button>
        <SelectField label="To" value={to} onChange={(v) => setInput(TOOL_ID, 'to', v)} options={CURRENCY_OPTIONS} />
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Rate Date (Optional)</span>
          <ThemedDatePicker
            value={inputs.date as string}
            onChange={(v) => setInput(TOOL_ID, 'date', v)}
          />
        </label>
        <button
          onClick={() => fx.refresh()}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          aria-label="Refresh rate"
        >
          <RefreshCw className={`w-4 h-4 ${fx.status === 'loading' ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {!historicalSupported && (inputs.date as string) && (
        <p className="text-[12px] text-text-secondary">
          Historical rates are unavailable for BDT — showing the latest rate instead.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResultCard
          label={`Converted (${to})`}
          value={converted !== undefined ? formatAmount(converted, to) : fx.status === 'error' ? 'Unavailable, set a manual rate' : '…'}
          highlight
        />
        <ResultCard label={`Rate ${from}→${to}`} value={rate !== undefined ? rate.toFixed(4) : '…'} />
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <p className="text-[12px] uppercase tracking-wide text-text-secondary">Rate Source: {sourceLabel}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-text-secondary">Manual Rate Override</span>
            <NumberInput
              className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent w-40"
              value={override ?? 0}
              placeholder={fx.data?.value.rate.toFixed(4) ?? ''}
              onCommit={(v) => {
                if (v > 0) setOverride(overrideKey, v)
              }}
            />
          </label>
          {override !== undefined && (
            <button
              onClick={() => clearOverride(overrideKey)}
              className="px-3 py-2 rounded-lg border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors"
            >
              Clear Override, Use Live
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

Notes for the implementer:
- `Intl.NumberFormat` with `style: 'currency'` gives JPY/KRW 0 decimals and others 2 automatically, formatted like `USD 1,234.56` with `currencyDisplay: 'code'`. This replaces the old hand-rolled `formatAmount`.
- `useToolInputs` types inputs as numbers-or-strings per existing usage; `from`/`to` are stored as strings exactly as `from` was before.

- [ ] **Step 2: Typecheck and run planner tests**

Run: `npx tsc --noEmit && npx vitest run src/components/planner`
Expected: PASS. There is no `CurrencyConverter.test.tsx` today (minimal testing: we are not adding one; the routing logic is covered in Task 3).

- [ ] **Step 3: Visual verification**

Dev server → Planner → Currency Converter. Verify: From/To dropdowns list all 9 codes; swap flips them; USD→BDT shows a rate (er-api) and picking a date shows the "Historical rates are unavailable for BDT" note; USD→EUR with a past date shows a dated Frankfurter rate; JPY result renders 0 decimals.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/CurrencyConverter.tsx
git commit -m "feat(planner): currency converter supports 9 currencies with From/To selects"
```

---

### Task 5: Mortgage toggles on one row

**Files:**
- Modify: `src/components/planner/MortgageCalculator.tsx:80-109`

**Interfaces:** none — pure layout.

- [ ] **Step 1: Merge the two toggle rows**

In `src/components/planner/MortgageCalculator.tsx`, replace the two sibling blocks (the `mode` button row at lines 81–93 and the `frequency` row at lines 95–109) with a single row:

```tsx
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(['payment', 'affordability'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setInput(TOOL_ID, 'mode', m)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
                mode === m ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {m === 'payment' ? 'Payment' : 'Affordability'}
            </button>
          ))}
        </div>
        {mode === 'payment' && (
          <div className="flex gap-2">
            {(['monthly', 'biweekly'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setInput(TOOL_ID, 'frequency', f)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
                  frequency === f ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {f === 'monthly' ? 'Monthly' : 'Biweekly (Accelerated)'}
              </button>
            ))}
          </div>
        )}
      </div>
```

`flex-wrap` + `justify-between` puts the frequency group at the right edge on wide screens and wraps it below, left-aligned, on narrow ones (per spec).

- [ ] **Step 2: Verify**

Run: `npx vitest run src/components/planner` — expected PASS (no mortgage test exists).
Visual: Planner → Mortgage, desktop width: both groups on one line, frequency right-aligned; shrink to ~375px: frequency wraps under. Switch to Affordability: frequency group disappears, Payment/Affordability stays left.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/MortgageCalculator.tsx
git commit -m "fix(planner): mortgage frequency toggle sits right of mode toggle on one row"
```

---

### Task 6: Debt payoff — adaptive second row (no empty columns)

**Files:**
- Modify: `src/components/planner/DebtPayoffCalculator.tsx:131`
- Test (update if broken): `src/components/planner/DebtPayoffCalculator.test.tsx`

**Interfaces:** none — pure layout; field render logic unchanged.

- [ ] **Step 1: Compute the grid columns from the rendered field count**

In `src/components/planner/DebtPayoffCalculator.tsx`, inside the `debts.map((d) => {` callback (after `const autoMin = ...`, line ~88), add:

```tsx
          // Second-row fields: 1 for card/LOC (min payment), 2 for loan+payment
          // (mode select + payment), 3 for loan+term (select + years + computed).
          const detailCols =
            d.type !== 'loan'
              ? 'md:grid-cols-[minmax(0,340px)]'
              : (d.loanMode ?? 'payment') === 'payment'
                ? 'md:grid-cols-[1.4fr_1fr]'
                : 'md:grid-cols-[1.4fr_1fr_1fr]'
```

Then change line 131 from:

```tsx
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-3 items-end">
```

to:

```tsx
              <div className={`grid grid-cols-1 ${detailCols} gap-3 items-end`}>
```

(The single-field case is capped at 340px so a lone "Min Payment (Auto)" box doesn't stretch across the whole card.)

- [ ] **Step 2: Run the debt payoff tests**

Run: `npx vitest run src/components/planner/DebtPayoffCalculator.test.tsx`
Expected: PASS — the test file queries fields by label, not by grid classes. If any test asserts the old class string, update it to the new adaptive expression.

- [ ] **Step 3: Visual verification**

Planner → Debt Payoff at desktop width: a Credit Card debt shows one compact Min Payment box (no dead space right of it); switch Type to Loan + "I Know My Payment": two fields fill the row; "I Know My Term": three fields as before. Mobile stays stacked.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/DebtPayoffCalculator.tsx
git commit -m "fix(planner): debt payoff second row sizes to its actual fields"
```

---

### Task 7: Mobile scroll cutoff — page roots stop clipping bottom padding

**Files:**
- Modify: `src/pages/Compensation.tsx:41`, `src/pages/Planner.tsx:6`, `src/pages/PlannerTool.tsx:13`, `src/pages/Dashboard.tsx:88`

**Interfaces:** none.

**Root cause:** `main` (Layout.tsx:113) carries `pb-[calc(52px+env(safe-area-inset-bottom)+16px)]` to clear the fixed mobile tab bar, but these four page roots use `h-full` — a box locked to the scroll container's height. Page content overflows that box, and `main`'s bottom padding sits after the *box*, not after the overflowed content, so the tail hides under the tab bar. Investments and Budgeting already use `min-h-full` and don't clip.

- [ ] **Step 1: Swap h-full for min-h-full on the four page roots**

- `src/pages/Compensation.tsx:41`: `className="flex flex-col gap-6 w-full h-full p-6 animate-fade-in"` → `className="flex flex-col gap-6 w-full min-h-full p-6 animate-fade-in"`
- `src/pages/Planner.tsx:6`: `"flex flex-col gap-8 w-full h-full p-6 animate-fade-in"` → `"flex flex-col gap-8 w-full min-h-full p-6 animate-fade-in"`
- `src/pages/PlannerTool.tsx:13`: `"flex flex-col gap-6 w-full h-full p-6 animate-fade-in"` → `"flex flex-col gap-6 w-full min-h-full p-6 animate-fade-in"`
- `src/pages/Dashboard.tsx:88`: `className="p-6 h-full w-full"` → `className="p-6 min-h-full w-full"`

Do NOT touch `Compensation.tsx:106` (`<CompHeroWidget className="h-full" />`) or `Dashboard.tsx:112` — those are intra-grid stretches, not scroll roots.

- [ ] **Step 2: Verify in the mobile viewport**

Run: `npx vitest run src/components/Layout.test.tsx src/pages` — expected PASS.
Visual: dev server, resize preview to mobile (375×812). On each of Dashboard, Budgeting, Investments, Planner (open Debt Payoff), Compensation: scroll to the bottom and confirm the last card fully clears the tab bar with a visible gap (~16px). Also sanity-check desktop: pages with short content still fill the viewport (that's what `min-h-full` preserves).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Compensation.tsx src/pages/Planner.tsx src/pages/PlannerTool.tsx src/pages/Dashboard.tsx
git commit -m "fix(mobile): page roots use min-h-full so bottom padding clears the tab bar"
```

---

### Task 8: ThemeSwatchGrid component

**Files:**
- Create: `src/components/theme/ThemeSwatchGrid.tsx`
- Create: `src/components/theme/ThemeSwatchGrid.test.tsx` (replaces ThemeSelector tests; the old files are deleted in Task 9)

**Interfaces:**
- Consumes: `useThemeStore` → `{ theme: AppTheme, setTheme(theme) }`; `AppTheme = 'geometric' | 'tactical' | 'luxury' | 'aurora' | 'glass'`.
- Produces: `export const ThemeSwatchGrid: React.FC` — no props; renders a responsive grid of 5 theme preview cards. Task 9's `SettingsSheet` imports it.

- [ ] **Step 1: Write the failing test**

Create `src/components/theme/ThemeSwatchGrid.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeSwatchGrid } from './ThemeSwatchGrid'
import { useThemeStore } from '../../store/useThemeStore'

describe('ThemeSwatchGrid', () => {
  beforeEach(() => useThemeStore.setState({ theme: 'luxury' }))

  it('renders all five themes with the active one marked', () => {
    render(<ThemeSwatchGrid />)
    const buttons = screen.getAllByRole('radio')
    expect(buttons).toHaveLength(5)
    expect(screen.getByRole('radio', { name: /Luxury Dark/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Geometric Light/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('applies a theme on click', () => {
    render(<ThemeSwatchGrid />)
    fireEvent.click(screen.getByRole('radio', { name: /Aurora Gradient/ }))
    expect(useThemeStore.getState().theme).toBe('aurora')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/theme/ThemeSwatchGrid.test.tsx`
Expected: FAIL — `Cannot find module './ThemeSwatchGrid'`.

- [ ] **Step 3: Implement the component**

Create `src/components/theme/ThemeSwatchGrid.tsx`:

```tsx
import React from 'react'
import { Check } from 'lucide-react'
import { useThemeStore, type AppTheme } from '../../store/useThemeStore'

// Swatch colors mirror each theme's --bg-primary / --accent in index.css.
const SWATCHES: Record<AppTheme, { name: string; bg: string; accent: string; light?: boolean }> = {
  geometric: { name: 'Geometric Light', bg: '#ffffff', accent: '#3b82f6', light: true },
  tactical: { name: 'Tactical Dark', bg: '#0a0a0a', accent: '#10b981' },
  luxury: { name: 'Luxury Dark', bg: '#000000', accent: '#d4a853' },
  aurora: { name: 'Aurora Gradient', bg: '#090d16', accent: '#34d399' },
  glass: { name: 'Glassmorphism', bg: '#0b0910', accent: '#22d3ee' },
}

const THEMES = Object.keys(SWATCHES) as AppTheme[]

/** Always-visible theme picker: one preview card per theme. */
export const ThemeSwatchGrid: React.FC = () => {
  const { theme, setTheme } = useThemeStore()
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {THEMES.map((t) => {
        const s = SWATCHES[t]
        const isActive = t === theme
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(t)}
            className={`rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              isActive ? 'border-accent' : 'border-border hover:border-accent/50'
            }`}
            style={{ backgroundColor: s.bg }}
          >
            <span className="block h-1.5 rounded-full mb-2" style={{ backgroundColor: s.accent }} aria-hidden="true" />
            <span
              className="flex items-center justify-between gap-1 text-[12px] font-medium"
              style={{ color: s.light ? '#1f2937' : '#e5e7eb' }}
            >
              {s.name}
              {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: s.accent }} aria-hidden="true" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/theme/ThemeSwatchGrid.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/ThemeSwatchGrid.tsx src/components/theme/ThemeSwatchGrid.test.tsx
git commit -m "feat(theme): ThemeSwatchGrid preview-card picker"
```

---

### Task 9: SettingsSheet + Layout integration (desktop dock + mobile tab bar)

**Files:**
- Create: `src/components/settings/SettingsSheet.tsx`
- Modify: `src/components/settings/MarketDataSettings.tsx` (extract inline section; drop the trigger/modal shell)
- Modify: `src/components/Layout.tsx` (dock → gear + version; mobile top row removed; 6th tab)
- Delete: `src/components/theme/ThemeSelector.tsx`, `src/components/theme/ThemeSelector.test.tsx`
- Test (update): `src/components/settings/MarketDataSettings.test.tsx`, `src/components/Layout.test.tsx` (only if it references removed elements)

**Interfaces:**
- Consumes: `ThemeSwatchGrid` (Task 8), `BackupControls` (already inline content — reused untouched), `Sheet` (`{ open, onClose, desktop: 'modal', ariaLabel, panelClassName }`), `__APP_VERSION__`.
- Produces:
  - `export const MarketDataSection: React.FC` from `MarketDataSettings.tsx` — the API-key form + instructions with no trigger button and no Sheet wrapper.
  - `export const SettingsSheet: React.FC<{ open: boolean; onClose: () => void; onOpenWhatsNew: () => void; onOpenDisclaimer: () => void }>`.

- [ ] **Step 1: Extract MarketDataSection**

Rewrite `src/components/settings/MarketDataSettings.tsx` so the file exports only `MarketDataSection` (the old `MarketDataSettings` trigger+modal component is removed; Layout was its only consumer — verify with `grep -rn "MarketDataSettings" src`):

```tsx
import React, { useState } from 'react'
import { useMarketDataStore } from '../../store/useMarketDataStore'

/** Alpha Vantage key management, rendered inside the Settings sheet. */
export const MarketDataSection: React.FC = () => {
  const { apiKey, setApiKey, clearApiKey } = useMarketDataStore()
  const [input, setInput] = useState('')

  const handleSave = () => {
    setApiKey(input)
    setInput('')
  }

  const handleRemove = () => {
    clearApiKey()
    setInput('')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-text-secondary">
        {apiKey ? `Key saved (ends in …${apiKey.slice(-3)})` : 'No key set - live stock prices are off.'}
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="market-data-api-key" className="text-[13px] font-medium text-text-primary">
          Alpha Vantage API Key
        </label>
        <input
          id="market-data-api-key"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="px-3 py-2 rounded-md border border-border bg-bg-primary/50 text-text-primary text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:opacity-90 transition-opacity"
        >
          Save
        </button>
        {apiKey && (
          <button
            onClick={handleRemove}
            className="px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <ol className="mt-2 pt-3 border-t border-border text-[13px] text-text-secondary list-decimal list-inside flex flex-col gap-1.5">
        <li>
          Open the free key page:{' '}
          <a
            href="https://www.alphavantage.co/support/#api-key"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Get a free API key
          </a>
        </li>
        <li>Enter your name and email, click &quot;GET FREE API KEY&quot; - the key appears instantly on the page.</li>
        <li>Paste it above and hit Save. The free plan allows 25 lookups per day, so prices refresh automatically at most once every 4 hours.</li>
      </ol>

      <p className="text-[12px] text-text-secondary/80">Your key is stored only on this device.</p>
    </div>
  )
}
```

(This is the existing markup verbatim minus the trigger button, `Sheet` wrapper, header row, and the `Database`/`X` icon imports — preserve any lines the current file has that aren't shown in this plan's earlier excerpt.)

- [ ] **Step 2: Create SettingsSheet**

Create `src/components/settings/SettingsSheet.tsx`:

```tsx
import React from 'react'
import { Settings, X } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { ThemeSwatchGrid } from '../theme/ThemeSwatchGrid'
import { MarketDataSection } from './MarketDataSettings'
import { BackupControls } from './BackupControls'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  onOpenWhatsNew: () => void
  onOpenDisclaimer: () => void
}

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[11px] uppercase tracking-wide text-text-secondary mt-4 mb-2 first:mt-0">{children}</h3>
)

/** Single settings hub: Appearance, Market Data, Backup, About. Modal on
 *  desktop, bottom sheet on mobile. */
export const SettingsSheet: React.FC<SettingsSheetProps> = ({ open, onClose, onOpenWhatsNew, onOpenDisclaimer }) => (
  <Sheet
    open={open}
    onClose={onClose}
    desktop="modal"
    ariaLabel="Settings"
    panelClassName="themed-menu rounded-lg w-full max-w-md p-6 flex flex-col max-h-[85dvh] overflow-y-auto"
  >
    <div className="flex items-center justify-between mb-2">
      <h2 className="flex items-center gap-2 text-[18px] font-semibold text-text-primary">
        <Settings className="w-5 h-5 text-accent" /> Settings
      </h2>
      <button
        onClick={onClose}
        aria-label="Close"
        className="text-text-secondary hover:text-accent rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    <SectionHeading>Appearance</SectionHeading>
    <ThemeSwatchGrid />

    <SectionHeading>Market Data</SectionHeading>
    <MarketDataSection />

    <SectionHeading>Backup</SectionHeading>
    <BackupControls />

    <SectionHeading>About</SectionHeading>
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={() => { onClose(); onOpenWhatsNew() }}
        className="text-[13px] text-text-secondary hover:text-accent transition-colors"
      >
        v{__APP_VERSION__} · What's New
      </button>
      <button
        onClick={() => { onClose(); onOpenDisclaimer() }}
        className="text-[12px] text-text-secondary/80 hover:text-accent transition-colors"
      >
        Estimates Only · Not Financial Advice
      </button>
    </div>
  </Sheet>
)
```

- [ ] **Step 3: Integrate into Layout**

In `src/components/Layout.tsx`:

1. Imports — remove `ThemeSelector` and `MarketDataSettings`; remove `BackupControls` (it now lives only inside the sheet); add:

```tsx
import { SettingsSheet } from './settings/SettingsSheet'
import { LayoutDashboard, Wallet, TrendingUp, PieChart, Calculator, Settings } from 'lucide-react'
```

2. State — alongside `paletteOpen`, add:

```tsx
  const [settingsOpen, setSettingsOpen] = useState(false)
```

3. Replace the desktop dock (the `{/* Backup + Theme Dock */}` div, lines 101–109) with:

```tsx
        {/* Settings Dock */}
        <div className="p-4 border-t border-border bg-bg-primary/20 flex flex-col items-center gap-3 pb-6">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 transition-colors"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button onClick={() => setWhatsNewOpen(true)} className="text-[11px] text-text-secondary hover:text-accent transition-colors">
            v{__APP_VERSION__} · What's New
          </button>
        </div>
```

4. Delete the entire mobile top row (the `{/* Mobile Backup + Theme rows */}` div, lines 114–129) — the sheet's About section now carries What's New and the disclaimer on mobile.

5. In the mobile bottom tab bar (after the `navItems.map` output, before `</nav>`), add a 6th slot — a button, not a Link:

```tsx
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] text-[10px] font-medium text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <Settings className="w-5 h-5" />
          Settings
        </button>
```

6. Render the sheet next to the other modals (before `</div>` at the end):

```tsx
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenWhatsNew={() => setWhatsNewOpen(true)}
        onOpenDisclaimer={() => setDisclaimerOpen(true)}
      />
```

- [ ] **Step 4: Delete the old ThemeSelector**

```bash
git rm src/components/theme/ThemeSelector.tsx src/components/theme/ThemeSelector.test.tsx
```

Then `grep -rn "ThemeSelector" src` — expect zero hits (fix any straggler imports, e.g. in `CommandPalette`/`commandActions` if they reference the component rather than the store; store-level `cycleTheme` usage is unaffected).

- [ ] **Step 5: Update MarketDataSettings tests**

Rewrite `src/components/settings/MarketDataSettings.test.tsx` to exercise `MarketDataSection` directly. Keep the existing store setup/mocking pattern from the current file (read it first); the tests become:

```tsx
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MarketDataSection } from './MarketDataSettings'
import { useMarketDataStore } from '../../store/useMarketDataStore'

describe('MarketDataSection', () => {
  beforeEach(() => useMarketDataStore.getState().clearApiKey())

  it('saves a key', () => {
    render(<MarketDataSection />)
    fireEvent.change(screen.getByLabelText('Alpha Vantage API Key'), { target: { value: 'demo-key-x3P' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(useMarketDataStore.getState().apiKey).toBe('demo-key-x3P')
    expect(screen.getByText(/ends in …x3P/)).toBeInTheDocument()
  })

  it('shows setup instructions with a link to claim a free key', () => {
    render(<MarketDataSection />)
    expect(screen.getByRole('link', { name: 'Get a free API key' })).toHaveAttribute('href', 'https://www.alphavantage.co/support/#api-key')
  })
})
```

(The old "opens the modal" / "closes when the scrim is clicked" cases die with the modal shell — scrim behavior is `Sheet`'s and is covered by `Sheet.test.tsx`. Adjust assertions to whatever the current test file's store-reset helpers look like.)

- [ ] **Step 6: Run the affected suites**

Run: `npx vitest run src/components/settings src/components/theme src/components/Layout.test.tsx src/components/CommandPalette.test.tsx`
Expected: PASS. If `Layout.test.tsx` fails on removed elements (top-row queries) or a changed tab count, update those queries to the new structure (6 tab-bar children: 5 links + 1 settings button).

- [ ] **Step 7: Visual verification (desktop + mobile)**

Dev server:
- Desktop: sidebar dock shows only "Settings" + version line. Gear opens the modal; all four sections render; theme swatch click restyles the app immediately; API-key save works; Export downloads a file; "What's New" chains from About.
- Mobile (375×812): top row is gone (content starts at the page header); tab bar has 6 slots with Settings last; tapping it opens the bottom sheet; theme switching works from it; Escape/scrim closes.

- [ ] **Step 8: Commit**

```bash
git add src/components/settings/SettingsSheet.tsx src/components/settings/MarketDataSettings.tsx src/components/settings/MarketDataSettings.test.tsx src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "feat(settings): consolidate theme, market data, backup and about into one Settings hub"
```

(Step 4's `git rm` already staged the ThemeSelector deletions; they ride along in this commit.)

---

### Task 10: Full-suite verification + changelog entry

**Files:**
- Modify: `CHANGELOG.md` (Unreleased section)

- [ ] **Step 1: Full test suite + lint + typecheck**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src --max-warnings 0`
Expected: all PASS. Baseline was 338 tests; expect a slightly different count (new: erApi 3, fxRouter 3, ThemeSwatchGrid 2; removed: ThemeSelector 3, MarketDataSettings −1 net). Fix any failure before proceeding — do not skip or exclude tests.

- [ ] **Step 2: Add changelog entries under [Unreleased]**

In `CHANGELOG.md` under `## [Unreleased]`, add (create `### Added` / `### Changed` / `### Fixed` subsections if absent):

```markdown
### Added
- Currency converter now supports USD, CAD, EUR, GBP, AUD, JPY, KRW, INR and BDT with From/To selectors (BDT via a fallback rate source, latest rates only)
- Settings hub: theme picker, market data key, backup and about consolidated into one sheet (gear in the sidebar dock / a new Settings tab on mobile)

### Changed
- Theme picker shows preview swatch cards for all themes
- Mortgage payment-frequency toggle moved beside the Payment/Affordability toggle
- 0.4.0 and 0.5.0 releases relabeled as betas

### Fixed
- Edit Compensation modal pre-fills the live stock price instead of a stale manual value
- Debt payoff rows no longer leave empty columns for credit cards, lines of credit and payment-mode loans
- Mobile: pages scroll fully clear of the bottom tab bar
- Planner date picker placeholder capitalization ("Select Date")
```

- [ ] **Step 3: Final visual sweep**

One pass in the dev server at desktop and 375px mobile across all five modules, focused on the items above. Screenshot the settings sheet and the mobile tab bar as proof.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entries for v0.6 fixes batch"
```

---

---

### Task 11: Wheel logic layer — types, calculations, IBKR activity parser

**Files:**
- Create: `src/utils/investments/wheel/types.ts`
- Create: `src/utils/investments/wheel/calculations.ts`
- Create: `src/utils/investments/wheel/calculations.test.ts`
- Create: `src/utils/investments/wheel/ibkrActivityParser.ts`
- Create: `src/utils/investments/wheel/ibkrActivityParser.test.ts`

**Interfaces:**
- Produces (Tasks 12–14 consume all of these):
  - `TradeRecord`, `TickerState`, `TickerMap` from `types.ts`
  - `calculateBreakeven(d: TickerState): number`, `calculateNetPL(d: TickerState, dynamicSpotPrice: number): number`, `formatCurr(val: number): string`
  - `RawRow = (string | number)[]`, `processIBKR(rows: RawRow[]): TickerMap`, `mergeActivityRows(existingRows: RawRow[], newRows: RawRow[]): RawRow[]`
- Source of truth: `C:\Users\misha\wheel_tracker\src\{types.ts,Calculations.ts,csvParser.ts}` and the dedupe logic in that repo's `src/App.tsx` (`processAggregatedData`). The code below is the port — trust it over re-deriving from the source, but the source is available for reference.

- [ ] **Step 1: Create the types**

Create `src/utils/investments/wheel/types.ts`:

```ts
export interface TradeRecord {
  date: string
  ticker: string
  type: 'Option' | 'Equity'
  action: string
  quantity: number
  price: number
  proceeds: number
  commFee: number
  description: string
  // Option specific
  strike?: number
  expiry?: string
  callPut?: 'C' | 'P'
}

export interface TickerState {
  ticker: string

  // Stock tracking
  opSharesHeld: number
  displayCost: number // Raw equity cost, or IBKR cost-basis fallback
  displayRealized: number // IBKR realized P/L for equity
  currentPrice: number // Spot price parsed from the statement
  marketValue: number // shares * currentPrice

  // Option tracking
  openPutContracts: number
  openPutStrikeSum: number
  premiumCollected: number

  // True when opSharesHeld > 0 OR open option contracts exist
  hasOpenPosition: boolean

  history: TradeRecord[]
}

export type TickerMap = Record<string, TickerState>
```

- [ ] **Step 2: Write the failing calculations test**

Create `src/utils/investments/wheel/calculations.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calculateBreakeven, calculateNetPL, formatCurr } from './calculations'
import type { TickerState } from './types'

const base: TickerState = {
  ticker: 'AAPL',
  opSharesHeld: 0,
  displayCost: 0,
  displayRealized: 0,
  currentPrice: 0,
  marketValue: 0,
  openPutContracts: 0,
  openPutStrikeSum: 0,
  premiumCollected: 0,
  hasOpenPosition: false,
  history: [],
}

describe('wheel calculations', () => {
  it('computes breakeven and net P/L for a stock wheel', () => {
    const d: TickerState = { ...base, opSharesHeld: 100, displayCost: 15001, premiumCollected: 248.95 }
    expect(calculateBreakeven(d)).toBeCloseTo(147.5205, 4)
    // spot 155: 15500 + 248.95 + 0 - 15001
    expect(calculateNetPL(d, 155)).toBeCloseTo(747.95, 2)
  })

  it('options-only: keeps full premium at/above breakeven, loses below it', () => {
    const d: TickerState = { ...base, openPutContracts: 2, openPutStrikeSum: 300, premiumCollected: 500, hasOpenPosition: true }
    // breakeven = (300*100 - 500 - 0) / 200 = 147.5
    expect(calculateBreakeven(d)).toBeCloseTo(147.5, 4)
    expect(calculateNetPL(d, 150)).toBe(500)
    // at 140: 500 - (147.5 - 140) * 200
    expect(calculateNetPL(d, 140)).toBeCloseTo(-1000, 2)
  })

  it('breakeven is NaN with no shares and no open puts', () => {
    expect(Number.isNaN(calculateBreakeven(base))).toBe(true)
  })

  it('formats currency with two decimals and N/A for NaN', () => {
    expect(formatCurr(1234.5)).toBe('$1,234.50')
    expect(formatCurr(NaN)).toBe('N/A')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/utils/investments/wheel/calculations.test.ts`
Expected: FAIL — `Cannot find module './calculations'`.

- [ ] **Step 4: Implement calculations (verbatim port)**

Create `src/utils/investments/wheel/calculations.ts`:

```ts
import type { TickerState } from './types'

export function calculateBreakeven(d: TickerState): number {
  if (d.opSharesHeld > 0) {
    return (d.displayCost - d.premiumCollected - d.displayRealized) / d.opSharesHeld
  } else if (d.openPutContracts > 0) {
    const putShares = d.openPutContracts * 100
    const totalStrikeObligation = d.openPutStrikeSum * 100
    return (totalStrikeObligation - d.premiumCollected - d.displayRealized) / putShares
  }
  return NaN
}

export function calculateNetPL(d: TickerState, dynamicSpotPrice: number): number {
  if (d.opSharesHeld > 0) {
    const dynamicMarketValue = dynamicSpotPrice * d.opSharesHeld
    return dynamicMarketValue + d.premiumCollected + d.displayRealized - d.displayCost
  } else if (d.openPutContracts > 0) {
    // Options-only math: above breakeven the puts expire worthless and the
    // full premium is kept; below it, losses scale with the gap.
    const breakeven = calculateBreakeven(d)
    if (dynamicSpotPrice >= breakeven) {
      return d.premiumCollected
    }
    const putShares = d.openPutContracts * 100
    return d.premiumCollected - (breakeven - dynamicSpotPrice) * putShares
  }

  return d.marketValue + d.premiumCollected + d.displayRealized - d.displayCost
}

export function formatCurr(val: number): string {
  if (isNaN(val)) return 'N/A'
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
```

- [ ] **Step 5: Run the calculations test to verify it passes**

Run: `npx vitest run src/utils/investments/wheel/calculations.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing parser test**

Create `src/utils/investments/wheel/ibkrActivityParser.test.ts`. IBKR activity-statement rows are positional arrays; the columns used are: `[0]` section, `[1]` 'Data', `[2]` 'Order'/'Summary', `[3]` asset class, `[5]` symbol, `[6]` date (trades) / quantity (open positions), `[7]` quantity (trades), `[8]` price, `[9]` cost basis (open positions), `[10]` proceeds (trades) / price (open positions), `[11]` comm/fee (trades) / market value (open positions).

```ts
import { describe, expect, it } from 'vitest'
import { mergeActivityRows, processIBKR, type RawRow } from './ibkrActivityParser'

const optionTrade: RawRow = ['Trades', 'Data', 'Order', 'Equity and Index Options', '', 'AAPL 19JAN26 150 P', '2026-01-02', -1, 2.5, '', 250, -1.05]
const stockBuy: RawRow = ['Trades', 'Data', 'Order', 'Stocks', '', 'AAPL', '2026-01-05', 100, 150, '', -15000, -1]
const openStock: RawRow = ['Open Positions', 'Data', 'Summary', 'Stocks', '', 'AAPL', 100, '', '', 15001, 155, 15500]
const openPut: RawRow = ['Open Positions', 'Data', 'Summary', 'Equity and Index Options', '', 'AAPL 19JAN26 150 P', -1, '', '', '', '', '']

describe('processIBKR', () => {
  it('builds ticker state from trades and open positions', () => {
    const map = processIBKR([optionTrade, stockBuy, openStock, openPut])
    const aapl = map['AAPL']
    expect(aapl).toBeDefined()
    expect(aapl.opSharesHeld).toBe(100)
    // Trade reconstruction matches held shares, so raw equity cost wins:
    expect(aapl.displayCost).toBeCloseTo(15001, 2)
    expect(aapl.premiumCollected).toBeCloseTo(248.95, 2)
    expect(aapl.currentPrice).toBe(155)
    expect(aapl.openPutContracts).toBe(1)
    expect(aapl.openPutStrikeSum).toBe(150)
    expect(aapl.hasOpenPosition).toBe(true)
    expect(aapl.history).toHaveLength(2)
  })
})

describe('mergeActivityRows', () => {
  it('dedupes identical trade rows across uploads', () => {
    const merged = mergeActivityRows([optionTrade, stockBuy], [optionTrade, stockBuy])
    expect(merged.filter((r) => r[0] === 'Trades')).toHaveLength(2)
  })

  it('keeps open positions from the NEW upload only', () => {
    const staleOpen: RawRow = ['Open Positions', 'Data', 'Summary', 'Stocks', '', 'AAPL', 999, '', '', 1, 1, 999]
    const merged = mergeActivityRows([optionTrade, staleOpen], [openStock])
    const openRows = merged.filter((r) => r[0] === 'Open Positions')
    expect(openRows).toHaveLength(1)
    expect(openRows[0][6]).toBe(100)
  })

  it('drops non-trade, non-open-position noise rows', () => {
    const noise: RawRow = ['Statement', 'Data', 'Title', 'Activity Statement', '', '', '', '', '', '', '', '']
    const merged = mergeActivityRows([], [noise, stockBuy])
    expect(merged).toHaveLength(1)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/utils/investments/wheel/ibkrActivityParser.test.ts`
Expected: FAIL — `Cannot find module './ibkrActivityParser'`.

- [ ] **Step 8: Implement the parser (port + extracted merge)**

Create `src/utils/investments/wheel/ibkrActivityParser.ts`. `processIBKR` is a faithful port of the tool's `csvParser.ts`; `mergeActivityRows` is the dedupe/aggregation logic extracted from the tool's `App.tsx` `processAggregatedData` (trades dedupe by deterministic hash; Open Positions rows come only from the newest upload so positions move Open→Closed correctly):

```ts
import type { TickerMap } from './types'

/** One positional row from an IBKR activity-statement CSV. */
export type RawRow = (string | number)[]

function normalizeNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const n = parseFloat(String(val).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function isTradeRow(row: RawRow): boolean {
  return row[0] === 'Trades' && row[1] === 'Data' && row[2] === 'Order' &&
    (row[3] === 'Equity and Index Options' || row[3] === 'Stocks')
}

function isOpenPositionRow(row: RawRow): boolean {
  return row[0] === 'Open Positions' && row[1] === 'Data' && row[2] === 'Summary' &&
    (row[3] === 'Equity and Index Options' || row[3] === 'Stocks')
}

/** Merge a new upload's rows into the stored rows: trades are deduped by a
 *  deterministic hash; Open Positions snapshots come ONLY from the new
 *  upload (the previous snapshot is discarded so closed wheels close). */
export function mergeActivityRows(existingRows: RawRow[], newRows: RawRow[]): RawRow[] {
  const uniqueTrades = new Map<string, RawRow>()
  for (const row of [...existingRows, ...newRows]) {
    if (!row || row.length < 12) continue
    if (isTradeRow(row)) {
      const hash = `${row[0]}_${row[3]}_${row[5]}_${row[6]}_${row[7]}_${row[8]}_${row[10]}`
      uniqueTrades.set(hash, row)
    }
  }
  const latestOpenPositions = newRows.filter((row) => row && row.length >= 12 && isOpenPositionRow(row))
  return [...uniqueTrades.values(), ...latestOpenPositions]
}

/** Rebuild per-ticker wheel state from raw activity rows. Faithful port of
 *  the standalone wheel tracker's csvParser. */
export function processIBKR(rows: RawRow[]): TickerMap {
  const stateTickers: TickerMap = {}

  function initTicker(ticker: string) {
    if (!stateTickers[ticker]) {
      stateTickers[ticker] = {
        ticker,
        premiumCollected: 0,
        opSharesHeld: 0,
        displayCost: 0,
        displayRealized: 0,
        currentPrice: 0,
        marketValue: 0,
        openPutContracts: 0,
        openPutStrikeSum: 0,
        hasOpenPosition: false,
        history: [],
      }
    }
  }

  // Temporary storage for chronologically reconstructing raw equity cost
  const stockTrades: Record<string, Array<{ date: string; q: number; cashFlow: number }>> = {}
  const opCostBasisMap: Record<string, number> = {}

  rows.forEach((row) => {
    if (!row || row.length < 12) return

    // 1A. Options premium history
    if (row[0] === 'Trades' && row[1] === 'Data' && row[2] === 'Order' && row[3] === 'Equity and Index Options') {
      const optionString = String(row[5] ?? '')
      if (!optionString) return

      const baseTicker = optionString.split(' ')[0]
      initTicker(baseTicker)

      const proceeds = normalizeNumber(row[10])
      const commFee = normalizeNumber(row[11])
      stateTickers[baseTicker].premiumCollected += proceeds + commFee

      stateTickers[baseTicker].history.push({
        date: String(row[6]),
        ticker: baseTicker,
        type: 'Option',
        action: 'Trade',
        quantity: normalizeNumber(row[7]),
        price: normalizeNumber(row[8]),
        proceeds,
        commFee,
        description: optionString,
      })
    }

    // 1B. Stock trade history (for raw equity cost reconstruction)
    if (row[0] === 'Trades' && row[1] === 'Data' && row[2] === 'Order' && row[3] === 'Stocks') {
      const baseTicker = String(row[5] ?? '')
      if (!baseTicker) return

      initTicker(baseTicker)
      if (!stockTrades[baseTicker]) stockTrades[baseTicker] = []

      const qty = normalizeNumber(row[7])
      const proceeds = normalizeNumber(row[10])
      const commFee = normalizeNumber(row[11])

      stockTrades[baseTicker].push({ date: String(row[6]), q: qty, cashFlow: proceeds + commFee })

      stateTickers[baseTicker].history.push({
        date: String(row[6]),
        ticker: baseTicker,
        type: 'Equity',
        action: 'Trade',
        quantity: qty,
        price: normalizeNumber(row[8]),
        proceeds,
        commFee,
        description: baseTicker + ' Equity',
      })
    }

    // 2A. Current stock holdings (open positions)
    if (row[0] === 'Open Positions' && row[1] === 'Data' && row[2] === 'Summary' && row[3] === 'Stocks') {
      const baseTicker = String(row[5] ?? '')
      if (!baseTicker) return

      initTicker(baseTicker)
      stateTickers[baseTicker].opSharesHeld = normalizeNumber(row[6])
      opCostBasisMap[baseTicker] = normalizeNumber(row[9])
      stateTickers[baseTicker].currentPrice = normalizeNumber(row[10])
      stateTickers[baseTicker].marketValue = normalizeNumber(row[11])
    }

    // 2B. Mark-to-market performance summary for holdings
    if (typeof row[0] === 'string' && row[0].startsWith('Mark-to-Mar') && row[1] === 'Data' && row[2] === 'Stocks') {
      const baseTicker = String(row[3] ?? '')
      if (!baseTicker) return

      initTicker(baseTicker)
      const currentQuantity = normalizeNumber(row[5])
      if (currentQuantity > 0) {
        stateTickers[baseTicker].opSharesHeld = currentQuantity
        stateTickers[baseTicker].currentPrice = normalizeNumber(row[7])
        stateTickers[baseTicker].marketValue = currentQuantity * stateTickers[baseTicker].currentPrice
      }
    }

    // 2C. Open option positions (put obligations)
    if (row[0] === 'Open Positions' && row[1] === 'Data' && row[2] === 'Summary' && row[3] === 'Equity and Index Options') {
      const optionString = String(row[5] ?? '')
      if (!optionString) return

      const baseTicker = optionString.split(' ')[0]
      initTicker(baseTicker)

      const qty = normalizeNumber(row[6])
      if (qty !== 0) stateTickers[baseTicker].hasOpenPosition = true

      const parts = optionString.split(' ')
      if (parts.length >= 4) {
        const strike = parseFloat(parts[2])
        const type = parts[3].toUpperCase()
        if (type === 'P' && qty < 0) {
          stateTickers[baseTicker].openPutContracts += Math.abs(qty)
          stateTickers[baseTicker].openPutStrikeSum += strike * Math.abs(qty)
        }
      }
    }
  })

  // Finalize raw cost reconstruction (average-cost method over sorted trades)
  Object.keys(stateTickers).forEach((ticker) => {
    const d = stateTickers[ticker]
    const trades = stockTrades[ticker] || []
    trades.sort((a, b) => a.date.localeCompare(b.date))

    let shares = 0
    let rawCost = 0
    let realizedPL = 0

    trades.forEach((trade) => {
      if (trade.q > 0) {
        shares += trade.q
        rawCost += -trade.cashFlow
      } else if (trade.q < 0) {
        const soldShares = Math.abs(trade.q)
        const avgCost = shares > 0 ? rawCost / shares : 0
        rawCost -= soldShares * avgCost
        shares += trade.q
        realizedPL += trade.cashFlow - soldShares * avgCost
      }
    })

    // If the snapshot rows had no share count but trade history says we
    // still hold shares, trust the reconstruction.
    if (d.opSharesHeld === 0 && shares > 0) {
      d.opSharesHeld = shares
    }

    if (Math.abs(shares - d.opSharesHeld) < 0.01) {
      d.displayCost = rawCost
      d.displayRealized = realizedPL
    } else {
      d.displayCost = opCostBasisMap[ticker] || 0
      d.displayRealized = realizedPL
    }

    if (d.opSharesHeld > 0 || d.openPutContracts > 0) {
      d.hasOpenPosition = true
    }
  })

  return stateTickers
}
```

- [ ] **Step 9: Run both test files to verify they pass**

Run: `npx vitest run src/utils/investments/wheel`
Expected: PASS (8 tests).

- [ ] **Step 10: Commit**

```bash
git add src/utils/investments/wheel
git commit -m "feat(investments): port wheel tracker logic layer (types, calculations, IBKR parser)"
```

---

### Task 12: useWheelStore + backup registration

**Files:**
- Create: `src/store/useWheelStore.ts`
- Modify: `src/utils/backup.ts:5-16` (append key)
- Test (update if broken): `src/utils/backup.test.ts`

**Interfaces:**
- Consumes: `mergeActivityRows`, `RawRow` from `src/utils/investments/wheel/ibkrActivityParser` (Task 11).
- Produces: `useWheelStore` with state `{ rawRows: RawRow[], fileCount: number }` and actions `addRows(newRows: RawRow[], numFiles: number): void`, `clearAll(): void`. Persisted under localStorage key `ledger-wheel`. Task 13/14 consume this. Ticker states are NEVER persisted — always derived from `rawRows`.

- [ ] **Step 1: Create the store**

Create `src/store/useWheelStore.ts`:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mergeActivityRows, type RawRow } from '../utils/investments/wheel/ibkrActivityParser'

interface WheelState {
  rawRows: RawRow[]
  fileCount: number
  addRows: (newRows: RawRow[], numFiles: number) => void
  clearAll: () => void
}

/** Raw deduped IBKR activity rows are the source of truth; ticker states
 *  are derived via processIBKR so parser fixes apply retroactively. */
export const useWheelStore = create<WheelState>()(
  persist(
    (set) => ({
      rawRows: [],
      fileCount: 0,
      addRows: (newRows, numFiles) =>
        set((s) => ({
          rawRows: mergeActivityRows(s.rawRows, newRows),
          fileCount: s.fileCount + numFiles,
        })),
      clearAll: () => set({ rawRows: [], fileCount: 0 }),
    }),
    { name: 'ledger-wheel' },
  ),
)
```

- [ ] **Step 2: Register the key in backups**

In `src/utils/backup.ts`, append `'ledger-wheel',` to the `BACKUP_KEYS` array (after `'ledger-dashboard-layout',`).

- [ ] **Step 3: Run the backup tests**

Run: `npx vitest run src/utils/backup.test.ts`
Expected: PASS. If a test asserts the exact key list or count, add `'ledger-wheel'` to its expectation.

- [ ] **Step 4: Commit**

```bash
git add src/store/useWheelStore.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat(investments): wheel store persisting raw activity rows; include in backups"
```

---

### Task 13: WheelTickerCard + WheelLedgerSheet

**Files:**
- Create: `src/components/investments/wheel/WheelTickerCard.tsx`
- Create: `src/components/investments/wheel/WheelLedgerSheet.tsx`

**Interfaces:**
- Consumes: `TickerState` (Task 11 types), `calculateBreakeven`/`calculateNetPL`/`formatCurr` (Task 11), `useCurrentPrice(ticker)` from `../../../services/marketData` (returns `{ data?: Resolved<Quote>, status, setManual(price), ... }`), `NumberInput` (`{ value, onCommit, className, placeholder? }`), `Sheet` (`{ open, onClose, desktop: 'modal', ariaLabel, panelClassName }`).
- Produces:
  - `WheelTickerCard: React.FC<{ data: TickerState; onViewDetails: (ticker: string) => void }>`
  - `WheelLedgerSheet: React.FC<{ data: TickerState | null; onClose: () => void }>` (renders nothing meaningful when `data` is null; `open={data !== null}`). Task 14 consumes both.

**Design notes (spec):** ledger idiom — `themed-card`, no framer-motion, no custom CSS. Spot price resolves override → live/cached quote → CSV-parsed fallback; typing writes the shared quote override via `setManual` (same mechanism Portfolio uses), so it persists app-wide. All USD. Copy summary keeps the emoji bullets but drops the "Generated by" footer.

- [ ] **Step 1: Create the ticker card**

Create `src/components/investments/wheel/WheelTickerCard.tsx`:

```tsx
import React, { useState } from 'react'
import { Check, Copy, Eye } from 'lucide-react'
import type { TickerState } from '../../../utils/investments/wheel/types'
import { calculateBreakeven, calculateNetPL, formatCurr } from '../../../utils/investments/wheel/calculations'
import { useCurrentPrice } from '../../../services/marketData'
import { NumberInput } from '../../ui/NumberInput'

interface WheelTickerCardProps {
  data: TickerState
  onViewDetails: (ticker: string) => void
}

const MetricRow: React.FC<{ label: string; value: React.ReactNode; tone?: 'positive' | 'negative' }> = ({ label, value, tone }) => (
  <div className="flex justify-between items-center py-1.5">
    <span className="text-[13px] text-text-secondary">{label}</span>
    <span className={`text-[14px] font-medium ${tone === 'positive' ? 'text-success' : tone === 'negative' ? 'text-error' : 'text-text-primary'}`}>
      {value}
    </span>
  </div>
)

export const WheelTickerCard: React.FC<WheelTickerCardProps> = ({ data, onViewDetails }) => {
  const price = useCurrentPrice(data.ticker)
  // override/live/cached quote wins; CSV-parsed statement price is the fallback
  const spot = price.data?.value.price ?? data.currentPrice
  const [copied, setCopied] = useState(false)

  const breakeven = calculateBreakeven(data)
  const netPL = calculateNetPL(data, spot)
  const isStockWheel = data.opSharesHeld > 0

  const handleCopy = () => {
    const text =
      `📈 ${data.ticker} Wheel Strategy Summary\n` +
      `• Shares Held: ${isStockWheel ? data.opSharesHeld : '0'}\n` +
      `• Cost of Shares: ${isStockWheel ? formatCurr(data.displayCost) : 'N/A'}\n` +
      `• Premium Collected: ${formatCurr(data.premiumCollected)}\n` +
      `• True Breakeven: ${Number.isNaN(breakeven) ? 'N/A' : formatCurr(breakeven)}\n` +
      `• Current Spot Price: ${formatCurr(spot)}\n` +
      `• Net P/L: ${formatCurr(netPL)}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="themed-card rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[16px] font-semibold text-text-primary">{data.ticker}</span>
        {price.data?.source && (
          <span className="text-[10px] uppercase text-text-secondary">{price.data.source}{price.data.stale ? ', stale' : ''}</span>
        )}
      </div>

      <MetricRow label="Shares" value={isStockWheel ? data.opSharesHeld.toLocaleString() : '0'} />
      <MetricRow label="Total Cost of Shares" value={isStockWheel ? formatCurr(data.displayCost) : 'N/A'} />
      <MetricRow
        label="Total Premium Collected"
        value={formatCurr(data.premiumCollected)}
        tone={data.premiumCollected >= 0 ? 'positive' : 'negative'}
      />

      <div className="flex justify-between items-center py-1.5">
        <span className="text-[13px] text-text-secondary">Current Stock Price</span>
        <NumberInput
          value={spot}
          onCommit={(v) => {
            if (v > 0) price.setManual(v)
          }}
          className="w-24 bg-bg-primary/50 border border-border rounded-md px-2 py-1 text-[14px] text-text-primary text-right focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      <div className="mt-2 pt-2 border-t border-border">
        <MetricRow label="True Breakeven Price" value={Number.isNaN(breakeven) ? 'N/A' : formatCurr(breakeven)} />
        <MetricRow label="Net Profit/Loss" value={formatCurr(netPL)} tone={netPL >= 0 ? 'positive' : 'negative'} />
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onViewDetails(data.ticker)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          <Eye className="w-4 h-4" /> View Details
        </button>
        <button
          onClick={handleCopy}
          aria-label="Copy summary"
          className="px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
```

(If `text-success` is not an existing utility in this codebase — check with `grep -rn "text-success" src | head -3` — use `text-[var(--success)]` instead, and same for `text-error` vs `text-[var(--error)]`; match whichever form the grep shows.)

- [ ] **Step 2: Create the ledger sheet**

Create `src/components/investments/wheel/WheelLedgerSheet.tsx`:

```tsx
import React from 'react'
import { X } from 'lucide-react'
import type { TickerState } from '../../../utils/investments/wheel/types'
import { formatCurr } from '../../../utils/investments/wheel/calculations'
import { Sheet } from '../../ui/Sheet'

interface WheelLedgerSheetProps {
  data: TickerState | null
  onClose: () => void
}

export const WheelLedgerSheet: React.FC<WheelLedgerSheetProps> = ({ data, onClose }) => {
  const sortedHistory = data ? [...data.history].sort((a, b) => a.date.localeCompare(b.date)) : []
  const totalCashFlow = sortedHistory.reduce((s, h) => s + h.proceeds + h.commFee, 0)

  return (
    <Sheet
      open={data !== null}
      onClose={onClose}
      desktop="modal"
      ariaLabel="Detailed ledger"
      panelClassName="themed-menu rounded-lg w-full max-w-3xl p-6 flex flex-col gap-3 max-h-[85dvh]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-text-primary">{data?.ticker} Detailed Ledger</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-text-secondary hover:text-accent rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Instrument</th>
              <th className="py-2 pr-3 font-medium text-right">Qty</th>
              <th className="py-2 pr-3 font-medium text-right">Price</th>
              <th className="py-2 font-medium text-right">Net Cash Flow</th>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.map((h, i) => {
              const cashflow = h.proceeds + h.commFee
              return (
                <tr key={i} className="border-b border-border/50 text-text-primary">
                  <td className="py-2 pr-3 whitespace-nowrap">{h.date}</td>
                  <td className="py-2 pr-3">{h.description}</td>
                  <td className={`py-2 pr-3 text-right ${h.quantity > 0 ? 'text-success' : h.quantity < 0 ? 'text-error' : ''}`}>{h.quantity}</td>
                  <td className="py-2 pr-3 text-right">{formatCurr(h.price)}</td>
                  <td className={`py-2 text-right ${cashflow > 0 ? 'text-success' : cashflow < 0 ? 'text-error' : ''}`}>{formatCurr(cashflow)}</td>
                </tr>
              )
            })}
            <tr>
              <td colSpan={4} className="py-2 pr-3 text-right font-semibold text-text-primary">Account Ledger Net Cash Flow:</td>
              <td className={`py-2 text-right font-semibold ${totalCashFlow > 0 ? 'text-success' : totalCashFlow < 0 ? 'text-error' : 'text-text-primary'}`}>
                {formatCurr(totalCashFlow)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Sheet>
  )
}
```

(Apply the same `text-success`/`text-error` utility check as Step 1.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/investments/wheel
git commit -m "feat(investments): wheel ticker card and detail ledger sheet"
```

---

### Task 14: WheelView + Options tab in Investments + changelog

**Files:**
- Create: `src/components/investments/wheel/WheelView.tsx`
- Modify: `src/pages/Investments.tsx:19,39,42,52-64,99-101`
- Modify: `CHANGELOG.md` (Unreleased → Added)

**Interfaces:**
- Consumes: `useWheelStore` (Task 12), `processIBKR` + `calculateNetPL` (Task 11), `WheelTickerCard` + `WheelLedgerSheet` (Task 13), `EmptyState` (`{ icon, message, hint, action?: { label, onClick } }`), `SelectField` from `../planner/SelectField`, papaparse (already a dependency).
- Produces: `WheelView: React.FC` (no props); the Investments tab union becomes `'journal' | 'portfolio' | 'wheel'` with the label "Options".

- [ ] **Step 1: Create WheelView**

Create `src/components/investments/wheel/WheelView.tsx`:

```tsx
import React, { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { CircleDollarSign, FileUp, Search, Trash2 } from 'lucide-react'
import { useWheelStore } from '../../../store/useWheelStore'
import { processIBKR, type RawRow } from '../../../utils/investments/wheel/ibkrActivityParser'
import { calculateNetPL } from '../../../utils/investments/wheel/calculations'
import type { TickerState } from '../../../utils/investments/wheel/types'
import { WheelTickerCard } from './WheelTickerCard'
import { WheelLedgerSheet } from './WheelLedgerSheet'
import { EmptyState } from '../../ui/EmptyState'
import { SelectField } from '../../planner/SelectField'

type SortMode = 'alpha' | 'plHighToLow' | 'plLowToHigh'

export const WheelView: React.FC = () => {
  const { rawRows, fileCount, addRows, clearAll } = useWheelStore()
  const [status, setStatus] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'active' | 'closed'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('alpha')

  const tickers = useMemo(
    () => Object.values(processIBKR(rawRows)).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [rawRows],
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setStatus('Parsing CSV(s)…')

    let newRows: RawRow[] = []
    let processed = 0
    Array.from(files).forEach((file) => {
      Papa.parse<RawRow>(file, {
        skipEmptyLines: true,
        complete: (results) => {
          newRows = [...newRows, ...results.data]
          processed++
          if (processed === files.length) {
            addRows(newRows, files.length)
            setStatus(null)
          }
        },
        error: () => setStatus('Error parsing one or more CSVs.'),
      })
    })
    e.target.value = ''
  }

  const handleClear = () => {
    if (confirm('Clear all wheel tracker data? This cannot be undone.')) {
      clearAll()
      setSelectedTicker(null)
    }
  }

  const filterAndSort = (arr: TickerState[]) => {
    let out = arr
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      out = out.filter((t) => t.ticker.toLowerCase().includes(q))
    }
    return [...out].sort((a, b) => {
      if (sortMode === 'alpha') return a.ticker.localeCompare(b.ticker)
      const plA = calculateNetPL(a, a.currentPrice)
      const plB = calculateNetPL(b, b.currentPrice)
      return sortMode === 'plHighToLow' ? plB - plA : plA - plB
    })
  }

  const activeStockWheels = filterAndSort(tickers.filter((t) => t.opSharesHeld > 0))
  const optionsOnlyWheels = filterAndSort(tickers.filter((t) => t.opSharesHeld === 0 && t.hasOpenPosition))
  const closedWheels = filterAndSort(tickers.filter((t) => t.opSharesHeld === 0 && !t.hasOpenPosition))

  if (tickers.length === 0) {
    return (
      <div className="themed-card rounded-lg p-10">
        <EmptyState
          icon={CircleDollarSign}
          message="No wheel data yet"
          hint="Upload one or more Interactive Brokers Activity Statement CSVs to track options premium, cost basis, and true breakeven per ticker."
        />
        <div className="flex justify-center mt-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity cursor-pointer">
            <FileUp className="w-4 h-4" /> Upload CSVs
            <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="sr-only" />
          </label>
        </div>
        {status && <p className="text-[13px] text-text-secondary text-center mt-3">{status}</p>}
      </div>
    )
  }

  const section = (title: string, items: TickerState[]) =>
    items.length > 0 && (
      <div className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold text-text-primary">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((t) => (
            <WheelTickerCard key={t.ticker} data={t} onViewDetails={setSelectedTicker} />
          ))}
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="themed-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-text-secondary">
          {fileCount} statement{fileCount === 1 ? '' : 's'} aggregated · {tickers.length} tickers
          {status && <span className="ml-2">{status}</span>}
        </span>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors cursor-pointer">
            <FileUp className="w-4 h-4" /> Add CSVs
            <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="sr-only" />
          </label>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-error hover:border-error transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-text-secondary">Search</span>
            <div className="flex items-center gap-2 bg-bg-primary/50 border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
              <Search className="w-4 h-4 text-text-secondary" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickers…"
                className="bg-transparent outline-none text-[14px] text-text-primary w-36"
              />
            </div>
          </label>
          <SelectField
            label="Sort"
            value={sortMode}
            onChange={(v) => setSortMode(v as SortMode)}
            options={[
              { value: 'alpha', label: 'Alphabetical (A-Z)' },
              { value: 'plHighToLow', label: 'Highest Net P/L' },
              { value: 'plLowToHigh', label: 'Lowest Net P/L' },
            ]}
          />
        </div>
        <div className="flex gap-2">
          {(['active', 'closed'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
                viewMode === m ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {m === 'active' ? 'Active Wheels' : 'History (Closed)'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'active' ? (
        <>
          {section('Active Stock Wheels', activeStockWheels)}
          {section('Cash-Secured Puts (Options Only)', optionsOnlyWheels)}
          {activeStockWheels.length === 0 && optionsOnlyWheels.length === 0 && (
            <p className="text-[13px] text-text-secondary text-center">No matching active positions found.</p>
          )}
        </>
      ) : (
        <>
          {section('Closed Wheels (History)', closedWheels)}
          {closedWheels.length === 0 && (
            <p className="text-[13px] text-text-secondary text-center">No matching closed positions found.</p>
          )}
        </>
      )}

      <WheelLedgerSheet
        data={selectedTicker ? tickers.find((t) => t.ticker === selectedTicker) ?? null : null}
        onClose={() => setSelectedTicker(null)}
      />
    </div>
  )
}
```

(Check `EmptyState`'s actual props first — `grep -n "interface EmptyStateProps" -A 8 src/components/ui/EmptyState.tsx`. If `action` is required or `icon` takes a different shape, adapt the empty-state call; the Investments journal empty state at `src/pages/Investments.tsx:82-87` is the reference usage.)

- [ ] **Step 2: Add the tab to Investments**

In `src/pages/Investments.tsx`:

1. Add the import:

```tsx
import { WheelView } from '../components/investments/wheel/WheelView'
```

2. Line 19 — widen the tab state:

```tsx
  const [tab, setTab] = useState<'journal' | 'portfolio' | 'wheel'>('journal')
```

3. Line 39 — the subtitle ternary becomes a lookup. Replace:

```tsx
            {tab === 'journal' ? 'Your decision journal: what you analyzed, what you actually did, and how both performed.' : 'Your portfolio with live prices and allocations.'}
```

with:

```tsx
            {tab === 'journal'
              ? 'Your decision journal: what you analyzed, what you actually did, and how both performed.'
              : tab === 'portfolio'
                ? 'Your portfolio with live prices and allocations.'
                : 'Wheel strategy: options premium, cost basis, and true breakeven per ticker.'}
```

4. Lines 52–64 — the tab buttons map over three tabs with a label lookup:

```tsx
      <div className="flex gap-2">
        {(['journal', 'portfolio', 'wheel'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
              tab === t ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'journal' ? 'Plan vs Actual' : t === 'portfolio' ? 'Portfolio' : 'Options'}
          </button>
        ))}
      </div>
```

5. Lines 99–101 — the content branch gains the wheel case. Replace:

```tsx
      ) : (
        <PortfolioView />
      )}
```

with:

```tsx
      ) : tab === 'portfolio' ? (
        <PortfolioView />
      ) : (
        <WheelView />
      )}
```

(The "New Analysis" header button is already gated on `tab === 'journal'` — no change.)

- [ ] **Step 3: Run the investments tests + typecheck**

Run: `npx vitest run src/components/investments src/pages && npx tsc --noEmit`
Expected: PASS. If a Portfolio/Investments test asserts exactly two tab buttons, update it to three.

- [ ] **Step 4: Changelog entry**

In `CHANGELOG.md` under `## [Unreleased]` → `### Added`, append:

```markdown
- Options tab in Investments: wheel strategy tracker ported from the standalone tool — upload IBKR activity statement CSVs to see per-ticker premium collected, true breakeven, and live-price Net P/L (PDF export not carried over)
```

- [ ] **Step 5: Visual verification**

Dev server → Investments → Options tab:
- Empty state shows the upload CTA; upload a real IBKR activity statement CSV (or two — verify dedupe keeps totals stable when re-uploading the same file).
- Cards show shares/cost/premium/breakeven/Net P/L; with the Alpha Vantage key set, spot price auto-fills live (source tag visible); typing a spot price persists across reload (it's a quote override).
- View Details opens the ledger sheet with the trade table and running total; works as a bottom sheet at 375px mobile.
- Active/Closed toggle, search, and all three sort modes behave; Clear (with confirm) empties the tab; Export backup from Settings includes `ledger-wheel` (inspect the downloaded JSON).

- [ ] **Step 6: Full suite + commit**

Run: `npx vitest run && npx eslint src --max-warnings 0`
Expected: PASS.

```bash
git add src/components/investments/wheel/WheelView.tsx src/pages/Investments.tsx CHANGELOG.md
git commit -m "feat(investments): Options tab with wheel strategy tracker"
```

---

## Task dependency notes

- Task 4 depends on Task 3 (CURRENCIES, fxRouter). Task 9 depends on Task 8 (ThemeSwatchGrid). Wheel tasks are strictly ordered: 11 → 12 → 13 → 14.
- The wheel chain (11–14) is independent of Tasks 1–10 and can execute before, after, or in parallel with them; it only shares `CHANGELOG.md` and `src/utils/backup.ts` (trivial merge surfaces).
- Everything else is independent; Tasks 1, 2, 5, 6, 7 can run in any order or in parallel worktrees.
- Task 7's mobile verification should be re-checked after Task 9 (the top row removal changes mobile page tops, not bottoms, but confirm no regression).
- Task 10 (full-suite verification) should run LAST, after whichever of the other chains lands finally — re-run it if the wheel tasks land after it.
