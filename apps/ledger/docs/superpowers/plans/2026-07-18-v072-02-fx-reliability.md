# v0.7.2 Plan 2: FX Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** USD to CAD conversion in Compensation (and everywhere else) never silently uses 1.0: fall back to the most recent known rate, show provenance, and allow an inline manual rate.

**Architecture:** The fx cache key is `USD-CAD@YYYY-MM-DD`, so each new day starts with a cache miss; on fetch failure `fromFxCache` throws and `useCompensationDisplay` defaults to rate 1. Fix at the service layer (fallback scan across prior-day cache entries and overrides), then surface status in the Compensation UI.

**Tech Stack:** TypeScript, zustand (`useMarketDataStore`), vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-v0.7.2-beta-design.md` section 7
- The fallback applies only when the caller did not request an explicit historical date
- Theme vars for all colors; `formatMoney` for currency; no em dashes in copy
- Run `npx tsc -b && npx vitest run` before each commit

---

### Task 1: Service-level fallback to the latest known rate

**Files:**
- Modify: `src/services/marketData/marketDataService.ts` (function `getFxRate` lines ~115-151)
- Test: `src/services/marketData/marketDataService.test.ts`

**Interfaces:**
- Consumes: `useMarketDataStore` state `fx: Record<string, Cached<FxRate>>` and `overrides: Record<string, number>`; `fxKey(from, to, dateKey)` produces `` `${FROM}-${TO}@${dateKey}` ``
- Produces: `getFxRate(from, to, date?)` unchanged signature; on failure with no same-day cache it now returns the newest prior entry with `stale: true` instead of throwing. Throws `'No market data available'` only when the pair has never been seen. Task 2 and the Compensation UI rely on `Resolved<FxRate>` fields `value.date`, `source`, `stale`.

- [ ] **Step 1: Write the failing tests**

Append to `src/services/marketData/marketDataService.test.ts` inside a new describe (the file already has `beforeEach` clearing the store and `__resetMinInterval`, and `afterEach(__resetProviders)`):

```ts
describe('getFxRate fallback', () => {
  const yesterdayRate = {
    from: 'USD' as const, to: 'CAD' as const, rate: 1.37,
    date: '2026-07-17', asOf: '2026-07-17T20:00:00Z',
  }

  it('falls back to the newest prior-day cached rate when the fetch fails', async () => {
    useMarketDataStore.getState().setFx(yesterdayRate)
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    const r = await getFxRate('USD', 'CAD')
    expect(r.value.rate).toBe(1.37)
    expect(r.value.date).toBe('2026-07-17')
    expect(r.stale).toBe(true)
    expect(r.status).toBe('error')
  })

  it('falls back to a prior-day manual override when no cache exists', async () => {
    useMarketDataStore.getState().setOverride('USD-CAD@2026-07-16', 1.4)
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    const r = await getFxRate('USD', 'CAD')
    expect(r.value.rate).toBe(1.4)
    expect(r.source).toBe('override')
    expect(r.stale).toBe(true)
  })

  it('prefers the newer entry when both cache and override exist', async () => {
    useMarketDataStore.getState().setOverride('USD-CAD@2026-07-10', 1.5)
    useMarketDataStore.getState().setFx(yesterdayRate)
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    const r = await getFxRate('USD', 'CAD')
    expect(r.value.rate).toBe(1.37)
  })

  it('does not fall back across dates for explicit historical requests', async () => {
    useMarketDataStore.getState().setFx(yesterdayRate)
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    await expect(getFxRate('USD', 'CAD', '2026-01-05')).rejects.toThrow('No market data available')
  })

  it('still throws when the pair has never been seen', async () => {
    __setProviders({ fetchFxRate: async () => { throw new Error('network down') } })
    await expect(getFxRate('USD', 'CAD')).rejects.toThrow('No market data available')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/services/marketData/marketDataService.test.ts`
Expected: the first three fail (`No market data available` thrown); the last two pass already.

- [ ] **Step 3: Implement the fallback**

In `marketDataService.ts`, replace `fromFxCache` and its call sites in `getFxRate`:

```ts
/** Newest cached rate or manual override for the pair across ALL dates.
 *  Used only for non-historical requests when today's data is missing. */
function latestFxForPair(
  from: Currency,
  to: Currency,
): { rate: number; date: string; fetchedAt: string; source: 'cache' | 'override' } | undefined {
  const state = useMarketDataStore.getState()
  const prefix = `${from.trim().toUpperCase()}-${to.trim().toUpperCase()}@`
  let best: { rate: number; date: string; fetchedAt: string; source: 'cache' | 'override' } | undefined
  for (const [key, cached] of Object.entries(state.fx)) {
    if (!key.startsWith(prefix)) continue
    const date = key.slice(prefix.length)
    if (!best || date > best.date) {
      best = { rate: cached.value.rate, date, fetchedAt: cached.fetchedAt, source: 'cache' }
    }
  }
  for (const [key, rate] of Object.entries(state.overrides)) {
    if (!key.startsWith(prefix)) continue
    const date = key.slice(prefix.length)
    if (!best || date > best.date) {
      best = { rate, date, fetchedAt: new Date().toISOString(), source: 'override' }
    }
  }
  return best
}

function fromFxCache(
  from: Currency,
  to: Currency,
  key: string,
  status: FetchStatus,
  allowCrossDateFallback: boolean,
): Resolved<FxRate> {
  const cached = useMarketDataStore.getState().fx[key]
  if (cached) {
    return { value: cached.value, source: 'cache', status, asOf: cached.fetchedAt, stale: isStale(cached.fetchedAt) }
  }
  if (allowCrossDateFallback) {
    const fb = latestFxForPair(from, to)
    if (fb) {
      return {
        value: { from, to, rate: fb.rate, date: fb.date, asOf: fb.fetchedAt },
        source: fb.source, status, asOf: fb.fetchedAt, stale: true,
      }
    }
  }
  throw new Error('No market data available')
}
```

Update the two call sites in `getFxRate` (`date === undefined` means "latest", which is the only case allowed to cross dates):

```ts
    } catch {
      return fromFxCache(from, to, key, 'error', date === undefined)
    }
  }
  return fromFxCache(from, to, key, 'stale', date === undefined)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/marketData/marketDataService.test.ts`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/marketData/marketDataService.ts src/services/marketData/marketDataService.test.ts
git commit -m "fix(fx): fall back to newest known rate instead of failing on a fresh day"
```

---

### Task 2: Compensation shows rate provenance, never fakes 1.0

**Files:**
- Modify: `src/hooks/useCompensationDisplay.ts`
- Modify: `src/pages/Compensation.tsx` (the Convert to CAD toggle block, lines ~88-101)

**Interfaces:**
- Consumes: `useFxRate('USD','CAD')` returning `{ data?: Resolved<FxRate>, status, refresh }`; `convertPackageToCad(pkg, fxRate, enabled)` which already no-ops for invalid rates; `fxKey`/`todayKey` from `../services/marketData`; `useMarketDataStore` `setOverride`/`clearOverride`/`overrides`
- Produces: `useCompensationDisplay()` return gains `fxAvailable: boolean`, `fxDate: string | undefined`, `fxSource: 'override' | 'live' | 'cache' | undefined`, `fxStale: boolean`. `fxRate` stays `number` (1 when unavailable) so existing consumers and tests keep working, but `fxAvailable` gates the UI.

- [ ] **Step 1: Extend the hook**

In `src/hooks/useCompensationDisplay.ts` replace line 18 and the return block:

```ts
  const fxAvailable = fx.data !== undefined
  const fxRate = fx.data?.value.rate ?? 1

  // CAD conversion only engages when a real rate exists; otherwise the
  // package stays in USD and the UI says the rate is unavailable.
  const pkg = useMemo(
    () => convertPackageToCad(basePkg, fxRate, useCadConversion && fxAvailable),
    [basePkg, fxRate, useCadConversion, fxAvailable],
  )
```

And add to the returned object:

```ts
    fxAvailable,
    fxDate: fx.data?.value.date,
    fxSource: fx.data?.source,
    fxStale: fx.data?.stale ?? false,
    refreshFx: fx.refresh,
```

- [ ] **Step 2: Update the toggle label and add the inline manual rate**

In `src/pages/Compensation.tsx`, destructure the new fields from `useCompensationDisplay()`:

```tsx
const { pkg, rawPrice, fxRate, fxStatus, fxAvailable, fxDate, fxSource, fxStale, priceStatus, priceSource, ... } = useCompensationDisplay()
```

Add imports and override state:

```tsx
import { fxKey, todayKey } from '../services/marketData'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { NumberInput } from '../components/ui/NumberInput'
```

```tsx
const fxOverrideKey = fxKey('USD', 'CAD', todayKey())
const fxOverride = useMarketDataStore((s) => s.overrides[fxOverrideKey])
const setOverride = useMarketDataStore((s) => s.setOverride)
const clearOverride = useMarketDataStore((s) => s.clearOverride)
```

Replace the toggle button's label expression (line ~99):

```tsx
{useCadConversion
  ? fxAvailable
    ? `Convert to CAD: ON (1 USD = ${fxRate.toFixed(4)} CAD${
        fxSource === 'override' ? ', manual' : fxStale && fxDate ? `, as of ${fxDate}` : ''
      }${fxStatus === 'loading' ? ', updating…' : ''})`
    : 'Convert to CAD: ON (rate unavailable, set a manual rate)'
  : 'Convert to CAD: OFF'}
```

Directly below the toggle button (same flex row or a following row), render the manual rate control only while conversion is on:

```tsx
{useCadConversion && (
  <div className="flex items-center gap-2">
    <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
      Manual rate
      <NumberInput
        value={fxOverride ?? 0}
        placeholder={fxAvailable ? fxRate.toFixed(4) : '1.3700'}
        onCommit={(v) => { if (v > 0) setOverride(fxOverrideKey, v) }}
        className="w-24 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[12px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
      />
    </label>
    {fxOverride !== undefined && (
      <button
        onClick={() => clearOverride(fxOverrideKey)}
        className="text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
      >
        Use live
      </button>
    )}
  </div>
)}
```

Note: `useFxRate` re-resolves when the override changes only via its own effect dependencies; the override is read by `getFxRate` on the next resolve. To make the override take effect immediately, mirror `useCurrentPrice`'s pattern: `useFxRate` already re-runs `resolve` when `from/to/date` change but not on override changes. Add the same override-dependency to `useFxRate` in `src/services/marketData/useMarketData.ts`:

```ts
  const overrideKey = fxKey(from, to, date ? toDateKey(date) : todayKey())
  const override = useMarketDataStore((s) => s.overrides[overrideKey])

  useEffect(() => {
    let active = true
    resolve(() => active)
    return () => { active = false }
  }, [resolve, override])
```

(imports: `fxKey` from `./cacheKey`, `toDateKey, todayKey` from `./dateKey`; `useMarketDataStore` is already imported.)

- [ ] **Step 3: Verify**

Run: `npx tsc -b && npx vitest run`
Expected: PASS. If `Compensation.test.tsx` or `useCompensationDisplay` tests assert the old return shape, extend the mocks with the new fields rather than weakening assertions.

Browser check: Compensation with Convert to CAD ON shows the rate with provenance; entering a manual rate updates numbers immediately; DevTools offline mode + reload still shows yesterday's rate marked "as of <date>" instead of 1.0000.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCompensationDisplay.ts src/pages/Compensation.tsx src/services/marketData/useMarketData.ts
git commit -m "feat(compensation): fx provenance, stale fallback display, inline manual rate"
```

---

## Self-Review Checklist

- Spec section 7 fully covered: fallback (Task 1), provenance + inline override + no silent 1.0 (Task 2), Portfolio/Dashboard benefit automatically via `getFxRate`.
- Types consistent: `Resolved<FxRate>` fields used in Task 2 match Task 1's implementation.
