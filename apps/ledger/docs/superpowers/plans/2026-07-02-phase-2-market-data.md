# Phase 2 — Market Data Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. After each task: commit, then update `docs/superpowers/plans/PROGRESS.md` (current/next task + one Log line). This is **Phase 2** of the milestone in `2026-07-02-ledger-v2-master-plan.md`.

**Goal:** Build one shared, offline-resilient market-data module that every pricing feature (Compensation, Investments 5a/5b, Planner FX) consumes for current prices, historical prices, and USD→CAD FX — designed up front so no later feature needs retrofitting.

**Architecture:** Three layers, bottom-up. (1) Pure **provider adapters** (`src/services/marketData/providers/`) that fetch CORS-friendly free public APIs directly from the browser (unofficial Yahoo Finance for quotes + historical closes; Frankfurter for FX) and normalize their responses — no keys, no proxy. (2) A **persisted Zustand cache store** (`useMarketDataStore`, LocalStorage key `ledger-market-data`, added to `BACKUP_KEYS`) holding last-known values with timestamps plus per-symbol manual overrides. (3) A **service facade** (`marketDataService`) that orchestrates cache-first reads, throttled live fetches, last-known fallback, and manual-override precedence, exposing `getCurrentPrice` / `getHistoricalPrice` / `getFxRate` plus loading/error state — surfaced to React via a `useMarketData` hook. The app stays fully usable offline: every value resolves from cache or a manual override when live fetch fails.

**Tech Stack:** TypeScript, browser `fetch`, Zustand `persist`, Vitest + jsdom (`vi.fn()` fetch mocking; `globals: true`, setup `src/setupTests.ts`). No new runtime dependencies.

## Global Constraints

(Full list in the master plan — these apply to every task.)

- **Zero backend / zero-infra.** Static SPA on GitHub Pages. No server, no auth, no database. All fetches go direct from the browser to free public CORS-friendly endpoints — no key, no proxy.
- **Local-first persistence.** `useMarketDataStore` uses Zustand `persist` → LocalStorage, following `src/store/useCompensationStore.ts`.
- **Backup coverage.** The new store's key `ledger-market-data` MUST be appended to `BACKUP_KEYS` in `src/utils/backup.ts`.
- **Live data always has a manual fallback.** Every accessor must return a usable value offline via cache and/or manual override; a failed/rate-limited/offline fetch never throws to the consumer — it degrades to last-known or manual.
- **Throttle/debounce** live fetches to respect free-tier limits (in-flight de-duplication + min-interval-per-key gate).
- **Dual themes are sacred; no hardcoded colors** — use theme CSS variables only. (Phase 2 ships no new full views; any status text uses existing tokens like `text-text-secondary`, `text-error`.)
- **Recharts only** for charts (not exercised in Phase 2).
- **TDD every task:** failing test → confirm fail → minimal implementation → confirm pass → commit. Vitest: `npm test -- --run <path>`.

**Verified codebase facts (2026-07-02, branch `ledger-v2`):**
- Test runner config lives in `vite.config.ts`: `environment: 'jsdom'`, `setupFiles: ['./src/setupTests.ts']`, `globals: true`. So `describe/it/expect/vi` are global — do NOT import them (matches existing `src/store/useDashboardStore.test.ts`).
- `BACKUP_KEYS` currently = `['accounts-storage','ledger-budget','ledger-compensation','financial-dashboard-theme','ledger-triage']` in `src/utils/backup.ts` (lines 5–11).
- Zustand persist pattern: `create<T>()(persist((set) => ({...}), { name: '<key>' }))`.
- No `src/services/` directory exists yet — this phase creates it.

---

### Task 1: Shared types + date helpers

**Files:**
- Create: `src/services/marketData/types.ts`
- Create: `src/services/marketData/dateKey.ts`
- Test: `src/services/marketData/dateKey.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `type Currency = 'USD' | 'CAD'`
  - `interface Quote { ticker: string; exchange?: string; price: number; currency: Currency; asOf: string /* ISO */ }`
  - `interface HistoricalPrice { ticker: string; exchange?: string; date: string /* YYYY-MM-DD */; close: number; currency: Currency; asOf: string }`
  - `interface FxRate { from: Currency; to: Currency; rate: number; date: string /* YYYY-MM-DD */; asOf: string }`
  - `type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'stale'`
  - `interface Cached<T> { value: T; fetchedAt: string /* ISO */ }`
  - `toDateKey(d: Date | string): string` — normalizes a Date or ISO/date string to `YYYY-MM-DD` (UTC).
  - `todayKey(): string` — `toDateKey(new Date())`.

- [x] **Step 1: Write the failing test**

```ts
// src/services/marketData/dateKey.test.ts
import { toDateKey, todayKey } from './dateKey'

describe('toDateKey', () => {
  it('formats a Date as YYYY-MM-DD (UTC)', () => {
    expect(toDateKey(new Date('2026-03-05T23:30:00Z'))).toBe('2026-03-05')
  })

  it('normalizes an ISO string', () => {
    expect(toDateKey('2026-01-09T12:00:00.000Z')).toBe('2026-01-09')
  })

  it('passes through an already-normalized date string', () => {
    expect(toDateKey('2026-12-31')).toBe('2026-12-31')
  })

  it('todayKey matches toDateKey(now)', () => {
    expect(todayKey()).toBe(toDateKey(new Date()))
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/services/marketData/dateKey.test.ts`
Expected: FAIL — cannot resolve `./dateKey`.

- [x] **Step 3: Write the types and implementation**

```ts
// src/services/marketData/types.ts
export type Currency = 'USD' | 'CAD'

export interface Quote {
  ticker: string
  exchange?: string
  price: number
  currency: Currency
  asOf: string // ISO timestamp of the quote's source time
}

export interface HistoricalPrice {
  ticker: string
  exchange?: string
  date: string // YYYY-MM-DD requested/nearest
  close: number
  currency: Currency
  asOf: string // ISO
}

export interface FxRate {
  from: Currency
  to: Currency
  rate: number
  date: string // YYYY-MM-DD
  asOf: string // ISO
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error' | 'stale'

export interface Cached<T> {
  value: T
  fetchedAt: string // ISO when we last wrote it
}
```

```ts
// src/services/marketData/dateKey.ts
export function toDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

export function todayKey(): string {
  return toDateKey(new Date())
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/services/marketData/dateKey.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/services/marketData/types.ts src/services/marketData/dateKey.ts src/services/marketData/dateKey.test.ts
git commit -m "feat: market-data shared types and date-key helpers"
```

---

### Task 2: Cache keys + throttle/de-dupe utility

**Files:**
- Create: `src/services/marketData/cacheKey.ts`
- Create: `src/services/marketData/throttle.ts`
- Test: `src/services/marketData/cacheKey.test.ts`
- Test: `src/services/marketData/throttle.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `quoteKey(ticker: string, exchange?: string): string` → e.g. `NASDAQ:AAPL` or `AAPL` when no exchange. Uppercased, trimmed.
  - `historicalKey(ticker: string, exchange: string | undefined, dateKey: string): string` → `<quoteKey>@<YYYY-MM-DD>`.
  - `fxKey(from: string, to: string, dateKey: string): string` → `<FROM>-<TO>@<YYYY-MM-DD>` (uppercased).
  - `class SingleFlight` with `run<T>(key: string, fn: () => Promise<T>): Promise<T>` — collapses concurrent calls for the same key into one in-flight promise.
  - `minInterval(key: string, ms: number, now?: number): boolean` — returns `true` if a call for `key` is allowed now (i.e. at least `ms` since the last allowed call), and records the timestamp; `false` otherwise. Module-level map keyed by `key`. `now` defaults to `Date.now()` (injectable for tests).

- [x] **Step 1: Write the failing tests**

```ts
// src/services/marketData/cacheKey.test.ts
import { quoteKey, historicalKey, fxKey } from './cacheKey'

describe('cache keys', () => {
  it('quoteKey uppercases and includes exchange when present', () => {
    expect(quoteKey('aapl', 'nasdaq')).toBe('NASDAQ:AAPL')
    expect(quoteKey(' msft ')).toBe('MSFT')
  })

  it('historicalKey appends the date', () => {
    expect(historicalKey('aapl', 'nasdaq', '2026-01-02')).toBe('NASDAQ:AAPL@2026-01-02')
  })

  it('fxKey builds a directional dated key', () => {
    expect(fxKey('usd', 'cad', '2026-01-02')).toBe('USD-CAD@2026-01-02')
  })
})
```

```ts
// src/services/marketData/throttle.test.ts
import { SingleFlight, minInterval } from './throttle'

describe('SingleFlight', () => {
  it('collapses concurrent calls for the same key into one execution', async () => {
    const sf = new SingleFlight()
    let calls = 0
    const fn = () => { calls++; return new Promise<number>((r) => setTimeout(() => r(42), 10)) }
    const [a, b] = await Promise.all([sf.run('k', fn), sf.run('k', fn)])
    expect(a).toBe(42)
    expect(b).toBe(42)
    expect(calls).toBe(1)
  })

  it('allows a new execution after the previous settles', async () => {
    const sf = new SingleFlight()
    let calls = 0
    const fn = async () => { calls++; return calls }
    expect(await sf.run('k', fn)).toBe(1)
    expect(await sf.run('k', fn)).toBe(2)
  })
})

describe('minInterval', () => {
  it('allows first call, blocks a call within the window, allows after it', () => {
    expect(minInterval('sym', 1000, 0)).toBe(true)
    expect(minInterval('sym', 1000, 500)).toBe(false)
    expect(minInterval('sym', 1000, 1000)).toBe(true)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/services/marketData/cacheKey.test.ts src/services/marketData/throttle.test.ts`
Expected: FAIL — modules not found.

- [x] **Step 3: Write the implementations**

```ts
// src/services/marketData/cacheKey.ts
export function quoteKey(ticker: string, exchange?: string): string {
  const t = ticker.trim().toUpperCase()
  const ex = exchange?.trim().toUpperCase()
  return ex ? `${ex}:${t}` : t
}

export function historicalKey(ticker: string, exchange: string | undefined, dateKey: string): string {
  return `${quoteKey(ticker, exchange)}@${dateKey}`
}

export function fxKey(from: string, to: string, dateKey: string): string {
  return `${from.trim().toUpperCase()}-${to.trim().toUpperCase()}@${dateKey}`
}
```

```ts
// src/services/marketData/throttle.ts
export class SingleFlight {
  private inflight = new Map<string, Promise<unknown>>()

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key)
    if (existing) return existing as Promise<T>
    const p = fn().finally(() => this.inflight.delete(key))
    this.inflight.set(key, p)
    return p
  }
}

const lastAllowed = new Map<string, number>()

export function minInterval(key: string, ms: number, now: number = Date.now()): boolean {
  const prev = lastAllowed.get(key)
  if (prev !== undefined && now - prev < ms) return false
  lastAllowed.set(key, now)
  return true
}

// Test-only escape hatch to reset the module-level gate.
export function __resetMinInterval(): void {
  lastAllowed.clear()
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/services/marketData/cacheKey.test.ts src/services/marketData/throttle.test.ts`
Expected: PASS (cacheKey 3, throttle 3).

- [x] **Step 5: Commit**

```bash
git add src/services/marketData/cacheKey.ts src/services/marketData/cacheKey.test.ts src/services/marketData/throttle.ts src/services/marketData/throttle.test.ts
git commit -m "feat: market-data cache-key builders and throttle/single-flight utils"
```

---

### Task 3: Yahoo Finance provider adapter (quote + historical)

**Files:**
- Create: `src/services/marketData/providers/yahoo.ts`
- Test: `src/services/marketData/providers/yahoo.test.ts`

**Interfaces:**
- Consumes: `Quote`, `HistoricalPrice`, `Currency` from `../types`; `toDateKey` from `../dateKey`; global `fetch`.
- Produces:
  - `fetchYahooQuote(ticker: string, exchange?: string): Promise<Quote>` — GETs the unofficial Yahoo chart endpoint (range=1d) and reads `chart.result[0].meta.regularMarketPrice` + `meta.currency`. Throws on network error or missing price (caller handles fallback).
  - `fetchYahooHistorical(ticker: string, exchange: string | undefined, date: string): Promise<HistoricalPrice>` — GETs the chart endpoint for a window around `date` and returns the close on/nearest-before the requested date.
  - `YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'` (exported for tests/reuse).

**Notes for the implementer:**
- Endpoint shape (no key, CORS-friendly): `${YAHOO_BASE}/${symbol}?interval=1d&range=1d` for a quote; for historical use `?interval=1d&period1=<unixSec>&period2=<unixSec>` spanning ~10 days ending on the requested date to survive weekends/holidays.
- `symbol` is just the ticker (e.g. `AAPL`); `exchange` is retained on the returned object for the cache key but is NOT appended to the Yahoo symbol (Yahoo uses suffixes like `.TO`, which are out of scope — ticker-only is acceptable for v2.0, exchange is metadata).
- Historical: from `chart.result[0]` read `timestamp[]` and `indicators.quote[0].close[]`; pick the last entry whose `toDateKey(timestamp*1000) <= date` and whose close is non-null.
- Currency: map `meta.currency` to our `Currency` union; default `'USD'` if absent/unknown.

- [x] **Step 1: Write the failing test**

```ts
// src/services/marketData/providers/yahoo.test.ts
import { fetchYahooQuote, fetchYahooHistorical } from './yahoo'

const originalFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = originalFetch })

function mockFetchOnce(json: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(json),
  }) as unknown as typeof fetch
}

describe('fetchYahooQuote', () => {
  it('reads regularMarketPrice and currency from the chart meta', async () => {
    mockFetchOnce({
      chart: { result: [{ meta: { regularMarketPrice: 123.45, currency: 'USD', regularMarketTime: 1767225600 } }] },
    })
    const q = await fetchYahooQuote('AAPL', 'NASDAQ')
    expect(q.price).toBe(123.45)
    expect(q.currency).toBe('USD')
    expect(q.ticker).toBe('AAPL')
    expect(q.exchange).toBe('NASDAQ')
  })

  it('throws when the price is missing', async () => {
    mockFetchOnce({ chart: { result: [{ meta: {} }] } })
    await expect(fetchYahooQuote('AAPL')).rejects.toThrow()
  })

  it('throws on a non-ok response', async () => {
    mockFetchOnce({}, false)
    await expect(fetchYahooQuote('AAPL')).rejects.toThrow()
  })
})

describe('fetchYahooHistorical', () => {
  it('returns the close on/nearest-before the requested date', async () => {
    // 2026-01-02 = 1767312000, 2026-01-05 = 1767571200 (UTC midnights)
    mockFetchOnce({
      chart: {
        result: [{
          meta: { currency: 'USD' },
          timestamp: [1767312000, 1767571200],
          indicators: { quote: [{ close: [10, 20] }] },
        }],
      },
    })
    const h = await fetchYahooHistorical('AAPL', undefined, '2026-01-03')
    expect(h.close).toBe(10) // 01-02 is the nearest on/before 01-03
    expect(h.date).toBe('2026-01-03')
    expect(h.currency).toBe('USD')
  })

  it('skips null closes when picking the nearest', async () => {
    mockFetchOnce({
      chart: {
        result: [{
          meta: { currency: 'USD' },
          timestamp: [1767312000, 1767571200],
          indicators: { quote: [{ close: [15, null] }] },
        }],
      },
    })
    const h = await fetchYahooHistorical('AAPL', undefined, '2026-01-06')
    expect(h.close).toBe(15)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/services/marketData/providers/yahoo.test.ts`
Expected: FAIL — `./yahoo` not found.

- [x] **Step 3: Write the implementation**

```ts
// src/services/marketData/providers/yahoo.ts
import type { Currency, HistoricalPrice, Quote } from '../types'
import { toDateKey } from '../dateKey'

export const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

function normalizeCurrency(c: unknown): Currency {
  return c === 'CAD' ? 'CAD' : 'USD'
}

interface YahooResult {
  meta?: { regularMarketPrice?: number; currency?: string; regularMarketTime?: number }
  timestamp?: number[]
  indicators?: { quote?: Array<{ close?: Array<number | null> }> }
}

async function getChart(url: string): Promise<YahooResult> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo request failed: ${res.status}`)
  const json = (await res.json()) as { chart?: { result?: YahooResult[] } }
  const result = json.chart?.result?.[0]
  if (!result) throw new Error('Yahoo response missing result')
  return result
}

export async function fetchYahooQuote(ticker: string, exchange?: string): Promise<Quote> {
  const symbol = encodeURIComponent(ticker.trim())
  const result = await getChart(`${YAHOO_BASE}/${symbol}?interval=1d&range=1d`)
  const price = result.meta?.regularMarketPrice
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new Error('Yahoo response missing price')
  }
  const asOf = result.meta?.regularMarketTime
    ? new Date(result.meta.regularMarketTime * 1000).toISOString()
    : new Date().toISOString()
  return { ticker: ticker.trim(), exchange, price, currency: normalizeCurrency(result.meta?.currency), asOf }
}

export async function fetchYahooHistorical(
  ticker: string,
  exchange: string | undefined,
  date: string,
): Promise<HistoricalPrice> {
  const target = new Date(`${toDateKey(date)}T00:00:00Z`)
  const period2 = Math.floor(target.getTime() / 1000) + 86400
  const period1 = period2 - 15 * 86400 // ~15-day window to survive weekends/holidays
  const symbol = encodeURIComponent(ticker.trim())
  const result = await getChart(
    `${YAHOO_BASE}/${symbol}?interval=1d&period1=${period1}&period2=${period2}`,
  )
  const stamps = result.timestamp ?? []
  const closes = result.indicators?.quote?.[0]?.close ?? []
  const targetKey = toDateKey(date)

  let chosen: number | undefined
  for (let i = 0; i < stamps.length; i++) {
    const key = toDateKey(new Date(stamps[i] * 1000))
    const close = closes[i]
    if (key <= targetKey && typeof close === 'number' && Number.isFinite(close)) {
      chosen = close // keep advancing to the nearest-on-or-before
    }
  }
  if (chosen === undefined) throw new Error('Yahoo historical: no close on/before date')

  return {
    ticker: ticker.trim(),
    exchange,
    date: targetKey,
    close: chosen,
    currency: normalizeCurrency(result.meta?.currency),
    asOf: new Date().toISOString(),
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/services/marketData/providers/yahoo.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/services/marketData/providers/yahoo.ts src/services/marketData/providers/yahoo.test.ts
git commit -m "feat: Yahoo Finance provider adapter (quote + historical close)"
```

---

### Task 4: Frankfurter FX provider adapter

**Files:**
- Create: `src/services/marketData/providers/frankfurter.ts`
- Test: `src/services/marketData/providers/frankfurter.test.ts`

**Interfaces:**
- Consumes: `Currency`, `FxRate` from `../types`; `toDateKey`, `todayKey` from `../dateKey`; global `fetch`.
- Produces:
  - `fetchFxRate(from: Currency, to: Currency, date?: string): Promise<FxRate>` — when `date` is omitted, GETs the latest endpoint; otherwise the dated endpoint. Reads `rates[to]`. Returns `rate: 1` immediately (no fetch) when `from === to`.
  - `FRANKFURTER_BASE = 'https://api.frankfurter.app'` (exported).

**Notes for the implementer:**
- Latest: `${FRANKFURTER_BASE}/latest?from=USD&to=CAD` → `{ amount, base, date, rates: { CAD: 1.3xx } }`.
- Historical: `${FRANKFURTER_BASE}/<YYYY-MM-DD>?from=USD&to=CAD` (Frankfurter returns the nearest prior business day; use the `date` field from the response as the effective date).
- `date` field on the returned `FxRate` = the response's `date` (effective date), falling back to the requested/`todayKey()`.

- [x] **Step 1: Write the failing test**

```ts
// src/services/marketData/providers/frankfurter.test.ts
import { fetchFxRate } from './frankfurter'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function mockFetchOnce(json: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(json),
  }) as unknown as typeof fetch
}

describe('fetchFxRate', () => {
  it('returns rate 1 without fetching when from === to', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
    const r = await fetchFxRate('CAD', 'CAD')
    expect(r.rate).toBe(1)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('reads the target rate from latest', async () => {
    mockFetchOnce({ amount: 1, base: 'USD', date: '2026-07-01', rates: { CAD: 1.36 } })
    const r = await fetchFxRate('USD', 'CAD')
    expect(r.rate).toBe(1.36)
    expect(r.from).toBe('USD')
    expect(r.to).toBe('CAD')
    expect(r.date).toBe('2026-07-01')
  })

  it('uses the dated endpoint and the effective date it returns', async () => {
    mockFetchOnce({ amount: 1, base: 'USD', date: '2026-01-02', rates: { CAD: 1.40 } })
    const r = await fetchFxRate('USD', 'CAD', '2026-01-03')
    expect(r.rate).toBe(1.40)
    expect(r.date).toBe('2026-01-02')
  })

  it('throws when the target currency is absent', async () => {
    mockFetchOnce({ amount: 1, base: 'USD', date: '2026-07-01', rates: {} })
    await expect(fetchFxRate('USD', 'CAD')).rejects.toThrow()
  })

  it('throws on a non-ok response', async () => {
    mockFetchOnce({}, false)
    await expect(fetchFxRate('USD', 'CAD')).rejects.toThrow()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/services/marketData/providers/frankfurter.test.ts`
Expected: FAIL — `./frankfurter` not found.

- [x] **Step 3: Write the implementation**

```ts
// src/services/marketData/providers/frankfurter.ts
import type { Currency, FxRate } from '../types'
import { toDateKey, todayKey } from '../dateKey'

export const FRANKFURTER_BASE = 'https://api.frankfurter.app'

interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

export async function fetchFxRate(from: Currency, to: Currency, date?: string): Promise<FxRate> {
  const now = new Date().toISOString()
  if (from === to) {
    return { from, to, rate: 1, date: date ? toDateKey(date) : todayKey(), asOf: now }
  }

  const path = date ? toDateKey(date) : 'latest'
  const res = await fetch(`${FRANKFURTER_BASE}/${path}?from=${from}&to=${to}`)
  if (!res.ok) throw new Error(`Frankfurter request failed: ${res.status}`)
  const json = (await res.json()) as FrankfurterResponse
  const rate = json.rates?.[to]
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new Error('Frankfurter response missing target rate')
  }
  return { from, to, rate, date: json.date ?? (date ? toDateKey(date) : todayKey()), asOf: now }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/services/marketData/providers/frankfurter.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/services/marketData/providers/frankfurter.ts src/services/marketData/providers/frankfurter.test.ts
git commit -m "feat: Frankfurter FX provider adapter (latest + historical USD->CAD)"
```

---

### Task 5: Persisted market-data cache store + backup registration

**Files:**
- Create: `src/store/useMarketDataStore.ts`
- Test: `src/store/useMarketDataStore.test.ts`
- Modify: `src/utils/backup.ts` (append `'ledger-market-data'` to `BACKUP_KEYS`)
- Modify: `src/utils/backup.test.ts` (assert the new key is registered)

**Interfaces:**
- Consumes: `Cached`, `Quote`, `HistoricalPrice`, `FxRate` from `../services/marketData/types`; `quoteKey`, `historicalKey`, `fxKey` from `../services/marketData/cacheKey`.
- Produces (`useMarketDataStore`, persist key `ledger-market-data`):
  - state: `quotes: Record<string, Cached<Quote>>`, `historical: Record<string, Cached<HistoricalPrice>>`, `fx: Record<string, Cached<FxRate>>`, `overrides: Record<string, number>` (manual price/rate overrides keyed by quote/fx cache key).
  - `setQuote(q: Quote): void`, `setHistorical(h: HistoricalPrice): void`, `setFx(r: FxRate): void` — write a `Cached<T>` with `fetchedAt = new Date().toISOString()`.
  - `getQuote(ticker, exchange?): Cached<Quote> | undefined`, `getHistorical(ticker, exchange, dateKey): Cached<HistoricalPrice> | undefined`, `getFx(from, to, dateKey): Cached<FxRate> | undefined`.
  - `setOverride(key: string, price: number): void`, `clearOverride(key: string): void`, `getOverride(key: string): number | undefined`.

- [x] **Step 1: Write the failing test**

```ts
// src/store/useMarketDataStore.test.ts
import { beforeEach } from 'vitest'
import { useMarketDataStore } from './useMarketDataStore'
import { quoteKey } from '../services/marketData/cacheKey'

beforeEach(() => {
  localStorage.clear()
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
})

describe('useMarketDataStore', () => {
  it('stores and retrieves a quote by ticker/exchange', () => {
    const s = useMarketDataStore.getState()
    s.setQuote({ ticker: 'AAPL', exchange: 'NASDAQ', price: 100, currency: 'USD', asOf: '2026-07-01T00:00:00Z' })
    const cached = useMarketDataStore.getState().getQuote('aapl', 'nasdaq')
    expect(cached?.value.price).toBe(100)
    expect(typeof cached?.fetchedAt).toBe('string')
  })

  it('stores and retrieves an fx rate by directional dated key', () => {
    const s = useMarketDataStore.getState()
    s.setFx({ from: 'USD', to: 'CAD', rate: 1.35, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' })
    const cached = useMarketDataStore.getState().getFx('USD', 'CAD', '2026-07-01')
    expect(cached?.value.rate).toBe(1.35)
  })

  it('stores and clears a manual override', () => {
    const key = quoteKey('AAPL', 'NASDAQ')
    useMarketDataStore.getState().setOverride(key, 250)
    expect(useMarketDataStore.getState().getOverride(key)).toBe(250)
    useMarketDataStore.getState().clearOverride(key)
    expect(useMarketDataStore.getState().getOverride(key)).toBeUndefined()
  })

  it('persists to the ledger-market-data LocalStorage key', () => {
    useMarketDataStore.getState().setQuote({ ticker: 'MSFT', price: 1, currency: 'USD', asOf: '2026-07-01T00:00:00Z' })
    expect(localStorage.getItem('ledger-market-data')).not.toBeNull()
  })
})
```

Add to `src/utils/backup.test.ts` (append a new `it` inside the first `describe('backup', ...)` block):

```ts
  it('registers the market-data store key', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BACKUP_KEYS } = require('./backup')
    expect(BACKUP_KEYS).toContain('ledger-market-data')
  })
```

If `require` is unavailable in the ESM test context, instead import `BACKUP_KEYS` at the top of `backup.test.ts` (add it to the existing import) and assert `expect(BACKUP_KEYS).toContain('ledger-market-data')`.

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/store/useMarketDataStore.test.ts src/utils/backup.test.ts`
Expected: FAIL — store module not found; backup test fails (`ledger-market-data` not yet in `BACKUP_KEYS`).

- [x] **Step 3: Write the store and register the backup key**

```ts
// src/store/useMarketDataStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Cached, FxRate, HistoricalPrice, Quote } from '../services/marketData/types'
import { fxKey, historicalKey, quoteKey } from '../services/marketData/cacheKey'

interface MarketDataState {
  quotes: Record<string, Cached<Quote>>
  historical: Record<string, Cached<HistoricalPrice>>
  fx: Record<string, Cached<FxRate>>
  overrides: Record<string, number>

  setQuote: (q: Quote) => void
  setHistorical: (h: HistoricalPrice) => void
  setFx: (r: FxRate) => void
  getQuote: (ticker: string, exchange?: string) => Cached<Quote> | undefined
  getHistorical: (ticker: string, exchange: string | undefined, dateKey: string) => Cached<HistoricalPrice> | undefined
  getFx: (from: string, to: string, dateKey: string) => Cached<FxRate> | undefined
  setOverride: (key: string, price: number) => void
  clearOverride: (key: string) => void
  getOverride: (key: string) => number | undefined
}

const now = () => new Date().toISOString()

export const useMarketDataStore = create<MarketDataState>()(
  persist(
    (set, get) => ({
      quotes: {},
      historical: {},
      fx: {},
      overrides: {},

      setQuote: (q) =>
        set((state) => ({
          quotes: { ...state.quotes, [quoteKey(q.ticker, q.exchange)]: { value: q, fetchedAt: now() } },
        })),
      setHistorical: (h) =>
        set((state) => ({
          historical: {
            ...state.historical,
            [historicalKey(h.ticker, h.exchange, h.date)]: { value: h, fetchedAt: now() },
          },
        })),
      setFx: (r) =>
        set((state) => ({
          fx: { ...state.fx, [fxKey(r.from, r.to, r.date)]: { value: r, fetchedAt: now() } },
        })),

      getQuote: (ticker, exchange) => get().quotes[quoteKey(ticker, exchange)],
      getHistorical: (ticker, exchange, dateKey) => get().historical[historicalKey(ticker, exchange, dateKey)],
      getFx: (from, to, dateKey) => get().fx[fxKey(from, to, dateKey)],

      setOverride: (key, price) => set((state) => ({ overrides: { ...state.overrides, [key]: price } })),
      clearOverride: (key) =>
        set((state) => {
          const next = { ...state.overrides }
          delete next[key]
          return { overrides: next }
        }),
      getOverride: (key) => get().overrides[key],
    }),
    { name: 'ledger-market-data' },
  ),
)
```

In `src/utils/backup.ts`, append the new key to the registry:

```ts
export const BACKUP_KEYS: string[] = [
  'accounts-storage',
  'ledger-budget',
  'ledger-compensation',
  'financial-dashboard-theme',
  'ledger-triage',
  'ledger-market-data',
]
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/store/useMarketDataStore.test.ts src/utils/backup.test.ts`
Expected: PASS (store 4, backup all incl. new registration test).

- [x] **Step 5: Commit**

```bash
git add src/store/useMarketDataStore.ts src/store/useMarketDataStore.test.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: persisted market-data cache store + backup registration"
```

---

### Task 6: Service facade — cache-first, override precedence, fallback, throttle

**Files:**
- Create: `src/services/marketData/marketDataService.ts`
- Test: `src/services/marketData/marketDataService.test.ts`

**Interfaces:**
- Consumes: providers (`fetchYahooQuote`, `fetchYahooHistorical`, `fetchFxRate`), `useMarketDataStore`, `SingleFlight`, `minInterval`, `__resetMinInterval`, cache-key builders, `todayKey`/`toDateKey`, types.
- Produces:
  - `interface Resolved<T> { value: T; source: 'override' | 'live' | 'cache'; status: FetchStatus; asOf: string; stale: boolean }`
  - `getCurrentPrice(ticker: string, exchange?: string, opts?: { force?: boolean }): Promise<Resolved<Quote>>`
  - `getHistoricalPrice(ticker: string, exchange: string | undefined, date: string): Promise<Resolved<HistoricalPrice>>`
  - `getFxRate(from: Currency, to: Currency, date?: string): Promise<Resolved<FxRate>>`
  - `MIN_FETCH_INTERVAL_MS = 60_000` (exported).
  - `STALE_AFTER_MS = 15 * 60_000` (exported) — a cache hit older than this is flagged `stale: true`.
  - For DI/testability, the module reads providers through an internal object; export `__setProviders(p)` and `__resetProviders()` to swap them in tests.

**Resolution rules (apply to all three accessors):**
1. **Override wins.** For current price and FX, if a manual override exists for the key, return `{ source: 'override', status: 'success', stale: false }` and do NOT fetch. (Historical has no override; skip this step.)
2. Otherwise attempt a **live fetch** when allowed by the throttle (`minInterval(key, MIN_FETCH_INTERVAL_MS)` true, or `opts.force`), de-duped via `SingleFlight`. On success, write to the store via `setQuote/setHistorical/setFx` and return `{ source: 'live', status: 'success', stale: false }`.
3. On fetch failure OR when throttled with a cache hit, fall back to the **cached** value: return `{ source: 'cache', status: throttledOrError, stale: age > STALE_AFTER_MS }`.
4. If there is neither override, nor a successful fetch, nor a cache entry → throw `Error('No market data available')` (consumers guard with manual entry — this is the only throw, and only when truly nothing exists).

- [x] **Step 1: Write the failing test**

```ts
// src/services/marketData/marketDataService.test.ts
import { beforeEach, afterEach } from 'vitest'
import {
  getCurrentPrice, getFxRate, getHistoricalPrice,
  __setProviders, __resetProviders,
} from './marketDataService'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __resetMinInterval } from './throttle'
import { quoteKey } from './cacheKey'

beforeEach(() => {
  localStorage.clear()
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
})
afterEach(() => __resetProviders())

const quote = { ticker: 'AAPL', exchange: 'NASDAQ', price: 100, currency: 'USD' as const, asOf: '2026-07-01T00:00:00Z' }

describe('getCurrentPrice', () => {
  it('fetches live, caches, and reports source=live', async () => {
    __setProviders({ fetchYahooQuote: async () => quote })
    const r = await getCurrentPrice('AAPL', 'NASDAQ')
    expect(r.value.price).toBe(100)
    expect(r.source).toBe('live')
    expect(useMarketDataStore.getState().getQuote('AAPL', 'NASDAQ')?.value.price).toBe(100)
  })

  it('prefers a manual override without fetching', async () => {
    let called = false
    __setProviders({ fetchYahooQuote: async () => { called = true; return quote } })
    useMarketDataStore.getState().setOverride(quoteKey('AAPL', 'NASDAQ'), 250)
    const r = await getCurrentPrice('AAPL', 'NASDAQ')
    expect(r.value.price).toBe(250)
    expect(r.source).toBe('override')
    expect(called).toBe(false)
  })

  it('falls back to cache when the live fetch fails', async () => {
    useMarketDataStore.getState().setQuote(quote)
    __setProviders({ fetchYahooQuote: async () => { throw new Error('network down') } })
    const r = await getCurrentPrice('AAPL', 'NASDAQ', { force: true })
    expect(r.value.price).toBe(100)
    expect(r.source).toBe('cache')
    expect(r.status).toBe('error')
  })

  it('throws only when there is no override, no live value, and no cache', async () => {
    __setProviders({ fetchYahooQuote: async () => { throw new Error('network down') } })
    await expect(getCurrentPrice('ZZZ', undefined, { force: true })).rejects.toThrow('No market data available')
  })
})

describe('getFxRate', () => {
  it('returns 1 for same-currency without touching providers', async () => {
    __setProviders({ fetchFxRate: async () => { throw new Error('should not be called') } })
    const r = await getFxRate('CAD', 'CAD')
    expect(r.value.rate).toBe(1)
  })

  it('fetches and caches a USD->CAD rate', async () => {
    __setProviders({ fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.36, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }) })
    const r = await getFxRate('USD', 'CAD')
    expect(r.value.rate).toBe(1.36)
    expect(r.source).toBe('live')
  })
})

describe('getHistoricalPrice', () => {
  it('returns cache when present without refetching in-window', async () => {
    __setProviders({
      fetchYahooHistorical: async () => ({ ticker: 'AAPL', exchange: undefined, date: '2026-01-02', close: 42, currency: 'USD' as const, asOf: '2026-01-02T00:00:00Z' }),
    })
    const first = await getHistoricalPrice('AAPL', undefined, '2026-01-02')
    expect(first.value.close).toBe(42)
    expect(first.source).toBe('live')
    // second call is throttled → served from cache
    const second = await getHistoricalPrice('AAPL', undefined, '2026-01-02')
    expect(second.source).toBe('cache')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/services/marketData/marketDataService.test.ts`
Expected: FAIL — `./marketDataService` not found.

- [x] **Step 3: Write the implementation**

```ts
// src/services/marketData/marketDataService.ts
import type { Currency, FetchStatus, FxRate, HistoricalPrice, Quote } from './types'
import { fetchYahooHistorical, fetchYahooQuote } from './providers/yahoo'
import { fetchFxRate } from './providers/frankfurter'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { SingleFlight, minInterval } from './throttle'
import { fxKey, historicalKey, quoteKey } from './cacheKey'
import { toDateKey, todayKey } from './dateKey'

export const MIN_FETCH_INTERVAL_MS = 60_000
export const STALE_AFTER_MS = 15 * 60_000

export interface Resolved<T> {
  value: T
  source: 'override' | 'live' | 'cache'
  status: FetchStatus
  asOf: string
  stale: boolean
}

// Provider indirection for testability.
interface Providers {
  fetchYahooQuote: typeof fetchYahooQuote
  fetchYahooHistorical: typeof fetchYahooHistorical
  fetchFxRate: typeof fetchFxRate
}
const defaultProviders: Providers = { fetchYahooQuote, fetchYahooHistorical, fetchFxRate }
let providers: Providers = { ...defaultProviders }
export function __setProviders(p: Partial<Providers>): void { providers = { ...defaultProviders, ...p } }
export function __resetProviders(): void { providers = { ...defaultProviders } }

const flight = new SingleFlight()

function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > STALE_AFTER_MS
}

export async function getCurrentPrice(
  ticker: string,
  exchange?: string,
  opts?: { force?: boolean },
): Promise<Resolved<Quote>> {
  const store = useMarketDataStore.getState()
  const key = quoteKey(ticker, exchange)

  const override = store.getOverride(key)
  if (override !== undefined) {
    const asOf = new Date().toISOString()
    return {
      value: { ticker: ticker.trim(), exchange, price: override, currency: 'USD', asOf },
      source: 'override', status: 'success', asOf, stale: false,
    }
  }

  const allowed = opts?.force || minInterval(key, MIN_FETCH_INTERVAL_MS)
  if (allowed) {
    try {
      const quote = await flight.run(key, () => providers.fetchYahooQuote(ticker, exchange))
      useMarketDataStore.getState().setQuote(quote)
      return { value: quote, source: 'live', status: 'success', asOf: quote.asOf, stale: false }
    } catch {
      return fromQuoteCache(key, 'error')
    }
  }
  return fromQuoteCache(key, 'stale')
}

function fromQuoteCache(key: string, status: FetchStatus): Resolved<Quote> {
  const cached = useMarketDataStore.getState().quotes[key]
  if (!cached) throw new Error('No market data available')
  return { value: cached.value, source: 'cache', status, asOf: cached.fetchedAt, stale: isStale(cached.fetchedAt) }
}

export async function getHistoricalPrice(
  ticker: string,
  exchange: string | undefined,
  date: string,
): Promise<Resolved<HistoricalPrice>> {
  const dateKey = toDateKey(date)
  const key = historicalKey(ticker, exchange, dateKey)

  const allowed = minInterval(key, MIN_FETCH_INTERVAL_MS)
  if (allowed) {
    try {
      const hist = await flight.run(key, () => providers.fetchYahooHistorical(ticker, exchange, dateKey))
      useMarketDataStore.getState().setHistorical(hist)
      return { value: hist, source: 'live', status: 'success', asOf: hist.asOf, stale: false }
    } catch {
      return fromHistoricalCache(key, 'error')
    }
  }
  return fromHistoricalCache(key, 'stale')
}

function fromHistoricalCache(key: string, status: FetchStatus): Resolved<HistoricalPrice> {
  const cached = useMarketDataStore.getState().historical[key]
  if (!cached) throw new Error('No market data available')
  return { value: cached.value, source: 'cache', status, asOf: cached.fetchedAt, stale: isStale(cached.fetchedAt) }
}

export async function getFxRate(
  from: Currency,
  to: Currency,
  date?: string,
): Promise<Resolved<FxRate>> {
  const dateKey = date ? toDateKey(date) : todayKey()
  const key = fxKey(from, to, dateKey)

  const override = useMarketDataStore.getState().getOverride(key)
  if (override !== undefined) {
    const asOf = new Date().toISOString()
    return { value: { from, to, rate: override, date: dateKey, asOf }, source: 'override', status: 'success', asOf, stale: false }
  }

  const allowed = minInterval(key, MIN_FETCH_INTERVAL_MS)
  if (from === to || allowed) {
    try {
      const rate = await flight.run(key, () => providers.fetchFxRate(from, to, date))
      if (from !== to) useMarketDataStore.getState().setFx(rate)
      return { value: rate, source: 'live', status: 'success', asOf: rate.asOf, stale: false }
    } catch {
      return fromFxCache(key, 'error')
    }
  }
  return fromFxCache(key, 'stale')
}

function fromFxCache(key: string, status: FetchStatus): Resolved<FxRate> {
  const cached = useMarketDataStore.getState().fx[key]
  if (!cached) throw new Error('No market data available')
  return { value: cached.value, source: 'cache', status, asOf: cached.fetchedAt, stale: isStale(cached.fetchedAt) }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/services/marketData/marketDataService.test.ts`
Expected: PASS (8 tests). Note: `getFxRate('CAD','CAD')` fetches via the provider (which returns rate 1) — the mock throws only to prove the *live* path isn't reached differently; the real `fetchFxRate` short-circuits same-currency to 1. In the test, `from === to` still routes through the provider mock, so the mock for that test must NOT throw — adjust: the `same-currency` test sets a provider that throws to assert the facade uses the real short-circuit. If your facade routes same-currency through the provider, change that test's provider to `async () => ({ from:'CAD', to:'CAD', rate:1, date: todayKey(), asOf:new Date().toISOString() })`. Pick ONE: keep same-currency short-circuit in the facade (preferred — do not call provider), and set the test provider to throw as written. Implement the short-circuit in `getFxRate` BEFORE the `from === to || allowed` fetch block:

```ts
  if (from === to) {
    const asOf = new Date().toISOString()
    return { value: { from, to, rate: 1, date: dateKey, asOf }, source: 'live', status: 'success', asOf, stale: false }
  }
```

Add that block right after the override check, and change the fetch guard to just `if (allowed)`. Re-run until PASS.

- [x] **Step 5: Commit**

```bash
git add src/services/marketData/marketDataService.ts src/services/marketData/marketDataService.test.ts
git commit -m "feat: market-data service facade (cache-first, override, fallback, throttle)"
```

---

### Task 7: React hook + barrel export for consumers

**Files:**
- Create: `src/services/marketData/useMarketData.ts`
- Create: `src/services/marketData/index.ts`
- Test: `src/services/marketData/useMarketData.test.tsx`

**Interfaces:**
- Consumes: `getCurrentPrice`, `getFxRate`, `getHistoricalPrice`, `Resolved` from `./marketDataService`; types; `useMarketDataStore` for overrides.
- Produces:
  - `useCurrentPrice(ticker: string, exchange?: string): { data?: Resolved<Quote>; status: FetchStatus; error?: string; refresh: (force?: boolean) => void; setManual: (price: number) => void; clearManual: () => void }`
  - `useFxRate(from: Currency, to: Currency, date?: string): { data?: Resolved<FxRate>; status: FetchStatus; error?: string; refresh: () => void }`
  - `useHistoricalPrice(ticker: string, exchange: string | undefined, date: string): { data?: Resolved<HistoricalPrice>; status: FetchStatus; error?: string }`
  - `index.ts` barrel re-exporting the service functions, hooks, types, and cache-key builders — the single import surface for every consumer (Compensation, Investments 5a/5b, Planner). Consumers import from `../services/marketData`.

**Notes for the implementer:**
- Hooks fetch on mount (and when their key inputs change) via `useEffect`, holding `data`/`status`/`error` in `useState`. Guard against setting state after unmount (an `active` flag). Empty ticker → do nothing (`status: 'idle'`).
- `setManual`/`clearManual` write the override through `useMarketDataStore` using `quoteKey(ticker, exchange)`, then trigger a refresh so `data.source` becomes `'override'`.
- The `useMarketDataStore` is subscribed to reactively so an external override change re-resolves (subscribe in the effect dependency or re-run `refresh` on override change).

- [x] **Step 1: Write the failing test**

```tsx
// src/services/marketData/useMarketData.test.tsx
import { beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCurrentPrice } from './useMarketData'
import { __setProviders, __resetProviders } from './marketDataService'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __resetMinInterval } from './throttle'

beforeEach(() => {
  localStorage.clear()
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
})
afterEach(() => __resetProviders())

describe('useCurrentPrice', () => {
  it('resolves a live price after mount', async () => {
    __setProviders({ fetchYahooQuote: async () => ({ ticker: 'AAPL', exchange: 'NASDAQ', price: 199, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }) })
    const { result } = renderHook(() => useCurrentPrice('AAPL', 'NASDAQ'))
    await waitFor(() => expect(result.current.data?.value.price).toBe(199))
    expect(result.current.status).toBe('success')
  })

  it('setManual switches the source to override', async () => {
    __setProviders({ fetchYahooQuote: async () => ({ ticker: 'AAPL', exchange: 'NASDAQ', price: 199, currency: 'USD', asOf: '2026-07-01T00:00:00Z' }) })
    const { result } = renderHook(() => useCurrentPrice('AAPL', 'NASDAQ'))
    await waitFor(() => expect(result.current.data).toBeDefined())
    act(() => result.current.setManual(250))
    await waitFor(() => expect(result.current.data?.source).toBe('override'))
    expect(result.current.data?.value.price).toBe(250)
  })

  it('stays idle for an empty ticker', () => {
    const { result } = renderHook(() => useCurrentPrice(''))
    expect(result.current.status).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/services/marketData/useMarketData.test.tsx`
Expected: FAIL — `./useMarketData` not found.

- [x] **Step 3: Write the hook and barrel**

```ts
// src/services/marketData/useMarketData.ts
import { useCallback, useEffect, useState } from 'react'
import type { Currency, FetchStatus, FxRate, HistoricalPrice, Quote } from './types'
import { getCurrentPrice, getFxRate, getHistoricalPrice, type Resolved } from './marketDataService'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { quoteKey } from './cacheKey'

export function useCurrentPrice(ticker: string, exchange?: string) {
  const [data, setData] = useState<Resolved<Quote>>()
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string>()

  const refresh = useCallback((force?: boolean) => {
    if (!ticker.trim()) { setStatus('idle'); return }
    setStatus('loading')
    getCurrentPrice(ticker, exchange, { force })
      .then((r) => { setData(r); setStatus(r.status); setError(undefined) })
      .catch((e) => { setStatus('error'); setError(e instanceof Error ? e.message : 'error') })
  }, [ticker, exchange])

  useEffect(() => { let active = true; if (active) refresh(); return () => { active = false } }, [refresh])

  const setManual = useCallback((price: number) => {
    useMarketDataStore.getState().setOverride(quoteKey(ticker, exchange), price)
    refresh(true)
  }, [ticker, exchange, refresh])

  const clearManual = useCallback(() => {
    useMarketDataStore.getState().clearOverride(quoteKey(ticker, exchange))
    refresh(true)
  }, [ticker, exchange, refresh])

  return { data, status, error, refresh, setManual, clearManual }
}

export function useFxRate(from: Currency, to: Currency, date?: string) {
  const [data, setData] = useState<Resolved<FxRate>>()
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string>()

  const refresh = useCallback(() => {
    setStatus('loading')
    getFxRate(from, to, date)
      .then((r) => { setData(r); setStatus(r.status); setError(undefined) })
      .catch((e) => { setStatus('error'); setError(e instanceof Error ? e.message : 'error') })
  }, [from, to, date])

  useEffect(() => { refresh() }, [refresh])
  return { data, status, error, refresh }
}

export function useHistoricalPrice(ticker: string, exchange: string | undefined, date: string) {
  const [data, setData] = useState<Resolved<HistoricalPrice>>()
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    if (!ticker.trim() || !date) { setStatus('idle'); return }
    setStatus('loading')
    getHistoricalPrice(ticker, exchange, date)
      .then((r) => { if (active) { setData(r); setStatus(r.status); setError(undefined) } })
      .catch((e) => { if (active) { setStatus('error'); setError(e instanceof Error ? e.message : 'error') } })
    return () => { active = false }
  }, [ticker, exchange, date])

  return { data, status, error }
}
```

```ts
// src/services/marketData/index.ts
export * from './types'
export { getCurrentPrice, getFxRate, getHistoricalPrice, type Resolved, MIN_FETCH_INTERVAL_MS, STALE_AFTER_MS } from './marketDataService'
export { useCurrentPrice, useFxRate, useHistoricalPrice } from './useMarketData'
export { quoteKey, historicalKey, fxKey } from './cacheKey'
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/services/marketData/useMarketData.test.tsx`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add src/services/marketData/useMarketData.ts src/services/marketData/useMarketData.test.tsx src/services/marketData/index.ts
git commit -m "feat: React hooks + barrel export for market-data consumers"
```

---

### Task 8: Phase gate — verify, then close Phase 2

- [x] **Step 1: Full verification (all Phase 2 tests + build + changed-file lint)**

Run each and confirm clean:
- `npm test -- --run` → all tests pass (Phase 1 suite unchanged + new Phase 2 suites).
- `npm run build` → succeeds (`tsc -b && vite build`; confirms the new modules typecheck).
- `npx eslint src/services/marketData src/store/useMarketDataStore.ts src/utils/backup.ts` → no errors on files this phase changed. (Per PROGRESS.md, the repo has 287 pre-existing v1.0 lint errors; the gate is lint-clean on **changed files only**.)

- [x] **Step 2: Confirm the backup covers the new store**

Confirm `ledger-market-data` is in `BACKUP_KEYS` (grep) and the `backup.test.ts` registration test passes. This is the phase's backup-coverage gate.

- [x] **Step 3: Confirm offline resilience is real**

Sanity-review the service test coverage: (a) override precedence, (b) live→cache fallback on fetch failure, (c) throttled reads serve cache, (d) same-currency FX = 1 with no fetch. These four are the spec's "Done when" (cached-or-live values, works offline via cache/manual). All are asserted in `marketDataService.test.ts` — confirm they pass.

- [x] **Step 4: Update PROGRESS.md**

Mark Phase 2 `- [x]` with today's date, set current phase to 3 (Compensation: live price + CAD toggle), next task to "plan Phase 3 JIT", and append Log lines P2.T1–P2.T7.

- [x] **Step 5: Commit**

```bash
git add docs/superpowers/plans/PROGRESS.md
git commit -m "chore: complete Phase 2 market data service"
```

**Phase 2 done when:** a consumer can call `getCurrentPrice` / `getHistoricalPrice` / `getFxRate` (or the matching hooks) and receive cached-or-live values with override precedence and graceful offline fallback; `ledger-market-data` is registered in `BACKUP_KEYS`; all tests pass, build succeeds, and changed files lint clean.

---

## Self-Review

**Spec coverage (Phase 2 section):**
- `getCurrentPrice(ticker, exchange)` → Task 6 (facade) + Task 3 (Yahoo quote) + Task 7 (hook). ✓
- `getHistoricalPrice(ticker, exchange, date)` → Task 6 + Task 3 (Yahoo historical, nearest-on/before) + Task 7. ✓
- `getFxRate('USD','CAD',date?)` → Task 6 + Task 4 (Frankfurter) + Task 7. ✓
- In-memory + LocalStorage cache with timestamps → Task 5 (`Cached<T>.fetchedAt`, persisted store) + `SingleFlight` in-memory de-dupe (Task 2). ✓
- Last-known fallback → Task 6 rule 3 (fetch failure/throttle → cache). ✓
- Manual override hook → Task 5 (`setOverride`) + Task 6 rule 1 + Task 7 (`setManual`/`clearManual`). ✓
- Loading/error states surfaced → `FetchStatus` + `Resolved.status`/`stale` (Tasks 1/6) + hook `status`/`error` (Task 7). ✓
- Throttle/debounce free-tier limits → Task 2 (`minInterval`, `SingleFlight`) used in Task 6. ✓
- Consumers (Comp, Inv 5a/5b, Planner) can request without retrofitting → Task 7 barrel `index.ts` is the single stable import surface exposing current/historical/FX for all four. ✓
- Works offline via cache/manual → Task 8 Step 3 gate; asserted in service tests. ✓

**Global-constraint coverage:** zero-infra direct fetch (Tasks 3/4) ✓; Zustand persist store (Task 5) ✓; `BACKUP_KEYS` updated + test (Task 5) ✓; manual fallback (Tasks 5–7) ✓; no new views so no theme/Recharts surface, status text uses tokens ✓; TDD every task ✓.

**Placeholder scan:** every code step contains complete, runnable code; no TBD/TODO/"handle edge cases". Task 6 Step 4 notes an explicit same-currency short-circuit refinement with the exact block to insert — resolved inline, not deferred.

**Type consistency:** `quoteKey/historicalKey/fxKey`, `Cached<T>`, `Resolved<T>`, `FetchStatus`, `setQuote/setHistorical/setFx/getQuote/getHistorical/getFx/setOverride/clearOverride/getOverride`, `__setProviders/__resetProviders`, `__resetMinInterval` are named identically wherever referenced across Tasks 1–7. Store shape `{ quotes, historical, fx, overrides }` is reset consistently in every test `beforeEach`.
