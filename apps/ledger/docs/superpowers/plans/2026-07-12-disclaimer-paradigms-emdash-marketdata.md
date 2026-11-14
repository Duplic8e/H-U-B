# v0.5 Fixes: Disclaimer Placement, Paradigm Research, Em Dash Removal, Static Market Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the disclaimer link into the What's New modal, document what budget paradigms could do (research only), remove every em dash case-by-case, and make market data actually work from a fully static PWA (fixed Frankfurter URL + Alpha Vantage replacing Yahoo, user-supplied API key, once-daily quote caching, refresh on reconnect).

**Architecture:** Four independent workstreams in one release. Market data keeps the existing layered design (providers → marketDataService → useMarketData hooks → components) — only the providers and freshness policy change. The disclaimer move is a small prop-drill from Layout into WhatsNewModal. Em dash removal is mechanical text edits. Paradigms produce a markdown document, no code.

**Tech Stack:** React 18 + TypeScript + Vite + Zustand (persist) + Vitest. Fully static hosting — no server-side code allowed.

## Global Constraints

- The app must remain deployable as a purely static site. No serverless functions, no proxy.
- The Alpha Vantage API key is user-supplied, stored client-side (Zustand persist / localStorage), never baked into the bundle.
- Alpha Vantage free tier: **25 requests/day, 5/min** — quote freshness is per-calendar-day, never per-15-minutes.
- Manual price/FX overrides must keep working exactly as today.
- Em dash (`—`, U+2014) must not appear anywhere in `src/**` or `CHANGELOG.md` after Task 6. Scope deliberately excludes `.claude/`, `.planning/`, `docs/` (tooling/history files — see Review Note R5).
- All existing tests must stay green: run `npx vitest run` before each commit.
- Mobile layout/behavior unchanged except where explicitly stated (mobile keeps its disclaimer button).

## ⚠️ Review & Confirmation Notes (read first)

Every item below needs Mishat's eyes at final review. Tasks reference these as **R1**, **R2**, etc.

| # | What | Decision made in plan | Needs confirmation because |
|---|------|----------------------|---------------------------|
| **R1** | Disclaimer label punctuation | `Estimates Only · Not Financial Advice` (middle dot, matching the existing `v0.4.0 · What's New` style) | Em dash removal forces a new separator; middle dot is a taste call |
| **R2** | Empty-value placeholder `'—'` in HoldingRow, PositionCard, SwapSimulator (7 occurrences) | Replace with `'–'`→ no, with plain `'-'` | A bare hyphen looks thinner than the em dash placeholder; user may prefer `N/A` or keeping a dash-like glyph |
| **R3** | `DISCLAIMER_TEXT` rewording | Em dash becomes a sentence break: `…before making decisions. You are solely responsible…` | Legal-ish copy; user should read final wording |
| **R4** | CHANGELOG.md em dashes (8) | Rewritten case-by-case (shown in Task 6) | Changelog is user-visible history; rewording old entries is a judgment call |
| **R5** | Em dash scope excludes `.claude/`, `.planning/`, `docs/` | Excluded (third-party skill files + historical planning docs) | Confirm exclusion is intended |
| **R6** | API-key settings placement | New "Market Data" button in the desktop sidebar dock (next to Backup/Theme) and in the mobile settings row, opening a modal | Placement is a UX taste call |
| **R7** | TSX symbol mapping | `exchange` field values `TSX`/`TSE`/`TORONTO` → `.TRT` suffix; `TSXV`/`TSX-V`/`VENTURE` → `.TRV`; tickers already containing `.` pass through unchanged | User should verify against the actual exchange strings saved in their portfolio (free-text field, placeholder "TSX") |
| **R8** | Currency inference | `.TRT`/`.TRV` symbols → CAD, everything else → USD (Alpha Vantage does not return currency) | Breaks for e.g. LSE tickers; fine for a USD/CAD app but worth confirming |
| **R9** | Quote freshness policy | A quote fetched today (local time) is "fresh"; only `force` (the manual refresh button) re-fetches same-day | Prices shown are up to ~1 day old by design to fit 25 req/day; confirm acceptable |
| **R10** | Historical lookups older than ~100 trading days | Use `outputsize=full` (large response, 1 request) | Slightly slow on first fetch; alternative is refusing old dates |
| **R11** | Alpha Vantage rate-limit responses | HTTP 200 with `"Note"`/`"Information"` body treated as fetch error → app falls back to cache | When quota is exhausted the UI shows stale/cached data with the existing "(stale)" badge — confirm this is the desired UX |
| **R12** | Yahoo provider files | Deleted (dead code once Alpha Vantage lands) | Confirm no desire to keep them for a future proxy option |
| **R13** | What's New backdrop blur strength | `backdrop-blur-sm` (4px) | Taste call; `backdrop-blur-md` if too subtle |
| **R14** | Paradigms doc | Research writeup only, no code change; recommendation included | User decides later which option to implement |

---

## Task 1: Fix Frankfurter base URL (FX works again)

The old domain `api.frankfurter.app` now 301-redirects to `api.frankfurter.dev/v1` **without CORS headers on the redirect response**, so every browser FX fetch dies. Point directly at the new host. (Verified live 2026-07-12: the `.dev` endpoint returns `Access-Control-Allow-Origin: *`.)

**Files:**
- Modify: `src/services/marketData/providers/frankfurter.ts:4`
- Test: `src/services/marketData/providers/frankfurter.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: unchanged — `fetchFxRate(from: Currency, to: Currency, date?: string): Promise<FxRate>`.

- [ ] **Step 1: Add a failing URL-assertion test**

Append to `frankfurter.test.ts` inside `describe('fetchFxRate')`:

```ts
  it('calls the .dev v1 endpoint (the .app domain 301s without CORS headers)', async () => {
    mockFetchOnce({ amount: 1, base: 'USD', date: '2026-07-01', rates: { CAD: 1.36 } })
    await fetchFxRate('USD', 'CAD')
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.frankfurter.dev/v1/latest?from=USD&to=CAD')
  })
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/services/marketData/providers/frankfurter.test.ts`
Expected: new test FAILS (called with `https://api.frankfurter.app/latest?...`).

- [ ] **Step 3: Change the base URL**

In `frankfurter.ts` line 4:

```ts
export const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1'
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/services/marketData/providers/frankfurter.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/marketData/providers/frankfurter.ts src/services/marketData/providers/frankfurter.test.ts
git commit -m "fix: point Frankfurter at api.frankfurter.dev/v1 (old domain 301s without CORS)"
```

---

## Task 2: API key storage in useMarketDataStore

**Files:**
- Modify: `src/store/useMarketDataStore.ts`
- Test: create `src/store/useMarketDataStore.test.ts`

**Interfaces:**
- Produces: `useMarketDataStore.getState().apiKey: string | undefined`, `setApiKey(key: string): void`, `clearApiKey(): void`. Task 3 (provider) and Task 4 (settings UI) consume these.

- [ ] **Step 1: Write failing test**

Create `src/store/useMarketDataStore.test.ts`:

```ts
import { useMarketDataStore } from './useMarketDataStore'

describe('useMarketDataStore api key', () => {
  afterEach(() => {
    useMarketDataStore.getState().clearApiKey()
  })

  it('starts with no key', () => {
    expect(useMarketDataStore.getState().apiKey).toBeUndefined()
  })

  it('stores and clears a trimmed key', () => {
    useMarketDataStore.getState().setApiKey('  ABC123  ')
    expect(useMarketDataStore.getState().apiKey).toBe('ABC123')
    useMarketDataStore.getState().clearApiKey()
    expect(useMarketDataStore.getState().apiKey).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/store/useMarketDataStore.test.ts` → FAIL (`setApiKey` not a function).

- [ ] **Step 3: Implement**

In `useMarketDataStore.ts`, extend the interface and store:

```ts
interface MarketDataState {
  quotes: Record<string, Cached<Quote>>
  historical: Record<string, Cached<HistoricalPrice>>
  fx: Record<string, Cached<FxRate>>
  overrides: Record<string, number>
  apiKey?: string

  // ...existing methods...
  setApiKey: (key: string) => void
  clearApiKey: () => void
}
```

Inside `create(...)` add:

```ts
      apiKey: undefined,
      setApiKey: (key) => set({ apiKey: key.trim() || undefined }),
      clearApiKey: () => set({ apiKey: undefined }),
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/store/useMarketDataStore.test.ts` → PASS. Also `npx vitest run` (full suite) → green.

- [ ] **Step 5: Commit**

```bash
git add src/store/useMarketDataStore.ts src/store/useMarketDataStore.test.ts
git commit -m "feat: persist user-supplied Alpha Vantage API key in market data store"
```

---

## Task 3: Alpha Vantage provider (replaces Yahoo)

Yahoo (`query1.finance.yahoo.com`) sends no CORS headers — unusable from a static page, ever. Alpha Vantage verified live (2026-07-12) to send `Access-Control-Allow-Origin: *`, covers TSX via `.TRT` suffix, free key at https://www.alphavantage.co/support/#api-key (25 req/day).

**Files:**
- Create: `src/services/marketData/providers/alphaVantage.ts`
- Test: create `src/services/marketData/providers/alphaVantage.test.ts`
- Delete (in Task 5 wiring step, after nothing imports them): `src/services/marketData/providers/yahoo.ts`, `yahoo.test.ts` (⚠️ **R12**)

**Interfaces:**
- Consumes: `useMarketDataStore.getState().apiKey` (Task 2), `toDateKey` from `../dateKey`, types from `../types`.
- Produces (Task 5 wires these into the service):
  - `fetchAlphaVantageQuote(ticker: string, exchange?: string): Promise<Quote>`
  - `fetchAlphaVantageHistorical(ticker: string, exchange: string | undefined, date: string): Promise<HistoricalPrice>`
  - `toAlphaVantageSymbol(ticker: string, exchange?: string): string` (exported for tests)
  - `MissingApiKeyError` class (settings UI and hooks can detect it by name)

- [ ] **Step 1: Write failing tests**

Create `src/services/marketData/providers/alphaVantage.test.ts`:

```ts
import { fetchAlphaVantageQuote, fetchAlphaVantageHistorical, toAlphaVantageSymbol, MissingApiKeyError } from './alphaVantage'
import { useMarketDataStore } from '../../../store/useMarketDataStore'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
  useMarketDataStore.getState().clearApiKey()
})

function mockFetchOnce(json: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(json),
  }) as unknown as typeof fetch
}

describe('toAlphaVantageSymbol', () => {
  it('appends .TRT for TSX exchange values', () => {
    expect(toAlphaVantageSymbol('SHOP', 'TSX')).toBe('SHOP.TRT')
    expect(toAlphaVantageSymbol('shop', 'tse')).toBe('SHOP.TRT')
  })
  it('appends .TRV for venture exchange values', () => {
    expect(toAlphaVantageSymbol('GPV', 'TSXV')).toBe('GPV.TRV')
  })
  it('passes through tickers that already have a suffix', () => {
    expect(toAlphaVantageSymbol('SHOP.TRT', 'TSX')).toBe('SHOP.TRT')
  })
  it('leaves US tickers bare', () => {
    expect(toAlphaVantageSymbol('AAPL')).toBe('AAPL')
    expect(toAlphaVantageSymbol('AAPL', 'NASDAQ')).toBe('AAPL')
  })
})

describe('fetchAlphaVantageQuote', () => {
  it('throws MissingApiKeyError when no key is set', async () => {
    await expect(fetchAlphaVantageQuote('AAPL')).rejects.toBeInstanceOf(MissingApiKeyError)
  })

  it('parses price and trading day; CAD for .TRT symbols', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({ 'Global Quote': { '01. symbol': 'SHOP.TRT', '05. price': '123.4500', '07. latest trading day': '2026-07-10' } })
    const q = await fetchAlphaVantageQuote('SHOP', 'TSX')
    expect(q.price).toBe(123.45)
    expect(q.currency).toBe('CAD')
    expect(q.asOf).toBe(new Date('2026-07-10T00:00:00Z').toISOString())
  })

  it('treats a rate-limit Note/Information body as an error', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({ Information: 'rate limit reached' })
    await expect(fetchAlphaVantageQuote('AAPL')).rejects.toThrow(/rate limit|missing/i)
  })

  it('throws on empty Global Quote (unknown symbol)', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({ 'Global Quote': {} })
    await expect(fetchAlphaVantageQuote('ZZZZ')).rejects.toThrow()
  })
})

describe('fetchAlphaVantageHistorical', () => {
  it('finds the close on/before the requested date', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({
      'Time Series (Daily)': {
        '2026-07-10': { '4. close': '101.00' },
        '2026-07-08': { '4. close': '99.50' },
      },
    })
    const h = await fetchAlphaVantageHistorical('AAPL', undefined, '2026-07-09')
    expect(h.close).toBe(99.5)
    expect(h.date).toBe('2026-07-09')
  })

  it('throws when no close exists on/before date', async () => {
    useMarketDataStore.getState().setApiKey('KEY')
    mockFetchOnce({ 'Time Series (Daily)': { '2026-07-10': { '4. close': '101.00' } } })
    await expect(fetchAlphaVantageHistorical('AAPL', undefined, '2020-01-01')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/services/marketData/providers/alphaVantage.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement provider**

Create `src/services/marketData/providers/alphaVantage.ts`:

```ts
import type { Currency, HistoricalPrice, Quote } from '../types'
import { toDateKey } from '../dateKey'
import { useMarketDataStore } from '../../../store/useMarketDataStore'

export const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query'

/** Thrown before any network call when the user hasn't saved a key yet. */
export class MissingApiKeyError extends Error {
  constructor() {
    super('Alpha Vantage API key missing. Add one in Market Data settings.')
    this.name = 'MissingApiKeyError'
  }
}

const TSX_MAIN = new Set(['TSX', 'TSE', 'TORONTO'])
const TSX_VENTURE = new Set(['TSXV', 'TSX-V', 'VENTURE'])

/** Alpha Vantage uses .TRT (Toronto) / .TRV (Venture) suffixes. See R7. */
export function toAlphaVantageSymbol(ticker: string, exchange?: string): string {
  const t = ticker.trim().toUpperCase()
  if (t.includes('.')) return t
  const ex = exchange?.trim().toUpperCase() ?? ''
  if (TSX_MAIN.has(ex)) return `${t}.TRT`
  if (TSX_VENTURE.has(ex)) return `${t}.TRV`
  return t
}

/** Alpha Vantage returns no currency field; infer from the suffix. See R8. */
function currencyFor(symbol: string): Currency {
  return symbol.endsWith('.TRT') || symbol.endsWith('.TRV') ? 'CAD' : 'USD'
}

function requireKey(): string {
  const key = useMarketDataStore.getState().apiKey
  if (!key) throw new MissingApiKeyError()
  return key
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Alpha Vantage request failed: ${res.status}`)
  const json = (await res.json()) as Record<string, unknown>
  // Rate-limit and error replies come back as HTTP 200 with these keys. See R11.
  const notice = json['Note'] ?? json['Information'] ?? json['Error Message']
  if (typeof notice === 'string') throw new Error(`Alpha Vantage: ${notice}`)
  return json
}

export async function fetchAlphaVantageQuote(ticker: string, exchange?: string): Promise<Quote> {
  const key = requireKey()
  const symbol = toAlphaVantageSymbol(ticker, exchange)
  const json = await getJson(
    `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`,
  )
  const quote = json['Global Quote'] as Record<string, string> | undefined
  const price = Number(quote?.['05. price'])
  if (!quote || !Number.isFinite(price)) throw new Error('Alpha Vantage response missing price')
  const tradingDay = quote['07. latest trading day']
  const asOf = tradingDay ? new Date(`${tradingDay}T00:00:00Z`).toISOString() : new Date().toISOString()
  return { ticker: ticker.trim(), exchange, price, currency: currencyFor(symbol), asOf }
}

export async function fetchAlphaVantageHistorical(
  ticker: string,
  exchange: string | undefined,
  date: string,
): Promise<HistoricalPrice> {
  const key = requireKey()
  const symbol = toAlphaVantageSymbol(ticker, exchange)
  const targetKey = toDateKey(date)
  // compact = last 100 trading days; older dates need the full series. See R10.
  const ageDays = (Date.now() - new Date(`${targetKey}T00:00:00Z`).getTime()) / 86_400_000
  const outputsize = ageDays > 120 ? 'full' : 'compact'
  const json = await getJson(
    `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}&apikey=${key}`,
  )
  const series = json['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined
  if (!series) throw new Error('Alpha Vantage response missing time series')

  // Nearest close on/before the target, within a 15-day window (weekends/holidays).
  let chosen: number | undefined
  let chosenDay = ''
  const floor = new Date(`${targetKey}T00:00:00Z`).getTime() - 15 * 86_400_000
  for (const [day, values] of Object.entries(series)) {
    if (day > targetKey) continue
    if (new Date(`${day}T00:00:00Z`).getTime() < floor) continue
    const close = Number(values['4. close'])
    if (Number.isFinite(close) && (chosen === undefined || day > chosenDay)) {
      chosen = close
      chosenDay = day
    }
  }
  if (chosen === undefined) throw new Error('Alpha Vantage historical: no close on/before date')

  return { ticker: ticker.trim(), exchange, date: targetKey, close: chosen, currency: currencyFor(symbol), asOf: new Date().toISOString() }
}
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/services/marketData/providers/alphaVantage.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/marketData/providers/alphaVantage.ts src/services/marketData/providers/alphaVantage.test.ts
git commit -m "feat: Alpha Vantage provider (CORS-friendly, TSX via .TRT) to replace Yahoo"
```

---

## Task 4: Market Data settings UI (key entry with instructions)

⚠️ **R6** — placement: desktop sidebar dock + mobile settings row.

**Files:**
- Create: `src/components/settings/MarketDataSettings.tsx`
- Modify: `src/components/Layout.tsx` (render it in the desktop dock ~line 101-110 and the mobile row ~line 116-129)
- Test: create `src/components/settings/MarketDataSettings.test.tsx`

**Interfaces:**
- Consumes: `useMarketDataStore` `apiKey`/`setApiKey`/`clearApiKey` (Task 2).
- Produces: `<MarketDataSettings />` — self-contained button + modal, no props.

- [ ] **Step 1: Write failing test**

Create `src/components/settings/MarketDataSettings.test.tsx` (mirror the render/interaction style of `BackupControls.test.tsx` — read it first and reuse its setup helpers):

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MarketDataSettings } from './MarketDataSettings'
import { useMarketDataStore } from '../../store/useMarketDataStore'

afterEach(() => useMarketDataStore.getState().clearApiKey())

describe('MarketDataSettings', () => {
  it('opens the modal and saves a key', () => {
    render(<MarketDataSettings />)
    fireEvent.click(screen.getByRole('button', { name: /market data/i }))
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'MYKEY1' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(useMarketDataStore.getState().apiKey).toBe('MYKEY1')
  })

  it('shows setup instructions with a link to claim a free key', () => {
    render(<MarketDataSettings />)
    fireEvent.click(screen.getByRole('button', { name: /market data/i }))
    const link = screen.getByRole('link', { name: /free api key/i })
    expect(link).toHaveAttribute('href', 'https://www.alphavantage.co/support/#api-key')
  })
})
```

- [ ] **Step 2: Run, verify fail** — module not found.

- [ ] **Step 3: Implement component**

Create `src/components/settings/MarketDataSettings.tsx`. Follow the app's modal pattern (copy the overlay/`themed-menu` structure from `WhatsNewModal.tsx`). Content requirements:

- Trigger: small dock button labeled `Market Data` (with a `Database` or `TrendingUp` lucide icon), same classes as the What's New button in `Layout.tsx:104`.
- Modal body:
  - Status line: `Key saved (ends in …XYZ)` when a key exists, else `No key set - live stock prices are off.`
  - Labeled input: `<label>Alpha Vantage API Key</label>` + text input.
  - Save button (calls `setApiKey`), Remove button (calls `clearApiKey`, only shown when a key exists).
  - Instructions block (exact copy, so the user "can do it easily" - keep this wording):
    1. `Open the free key page:` link text `Get a free API key` → `https://www.alphavantage.co/support/#api-key` (target `_blank`, `rel="noreferrer"`).
    2. `Enter your name and email, click "GET FREE API KEY" - the key appears instantly on the page.`
    3. `Paste it above and hit Save. The free plan allows 25 lookups per day, so prices refresh at most once a day.`
  - Note line: `Your key is stored only on this device.`

- [ ] **Step 4: Wire into Layout**

In `Layout.tsx`: import and render `<MarketDataSettings />` inside the desktop dock (after `<BackupControls />`) and inside the mobile settings row div (`Layout.tsx:117-120`).

- [ ] **Step 5: Run tests + typecheck** — `npx vitest run src/components/settings/MarketDataSettings.test.tsx && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/MarketDataSettings.tsx src/components/settings/MarketDataSettings.test.tsx src/components/Layout.tsx
git commit -m "feat: Market Data settings modal for user-supplied Alpha Vantage key"
```

---

## Task 5: Wire Alpha Vantage into the service; daily freshness; refresh on reconnect

⚠️ **R9** (daily freshness), **R11** (quota exhausted → cache fallback), **R12** (delete Yahoo).

**Files:**
- Modify: `src/services/marketData/marketDataService.ts`
- Modify: `src/services/marketData/useMarketData.ts`
- Delete: `src/services/marketData/providers/yahoo.ts`, `src/services/marketData/providers/yahoo.test.ts`
- Test: `src/services/marketData/marketDataService.test.ts` (update provider injection names), `src/services/marketData/useMarketData.test.tsx`

**Interfaces:**
- Consumes: `fetchAlphaVantageQuote`, `fetchAlphaVantageHistorical` (Task 3), `fetchFxRate` (Task 1).
- Produces: `getCurrentPrice`/`getHistoricalPrice`/`getFxRate` signatures unchanged; `__setProviders` keys renamed to `fetchQuote`, `fetchHistorical`, `fetchFxRate`.

- [ ] **Step 1: Update service tests first**

In `marketDataService.test.ts`, rename injected provider keys (`fetchYahooQuote` → `fetchQuote`, `fetchYahooHistorical` → `fetchHistorical`) and add the two behavior tests:

```ts
it('returns the cached quote without fetching when it was fetched today', async () => {
  const fetchQuote = vi.fn()
  __setProviders({ fetchQuote })
  useMarketDataStore.setState({
    quotes: {
      AAPL: {
        value: { ticker: 'AAPL', price: 100, currency: 'USD', asOf: new Date().toISOString() },
        fetchedAt: new Date().toISOString(),
      },
    },
  })
  const r = await getCurrentPrice('AAPL')
  expect(fetchQuote).not.toHaveBeenCalled()
  expect(r.source).toBe('cache')
  expect(r.status).toBe('success')
  expect(r.stale).toBe(false)
})

it('re-fetches a quote cached yesterday', async () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString()
  const fetchQuote = vi.fn().mockResolvedValue({ ticker: 'AAPL', price: 101, currency: 'USD', asOf: new Date().toISOString() })
  __setProviders({ fetchQuote })
  useMarketDataStore.setState({
    quotes: {
      AAPL: { value: { ticker: 'AAPL', price: 100, currency: 'USD', asOf: yesterday }, fetchedAt: yesterday },
    },
  })
  const r = await getCurrentPrice('AAPL', undefined, { force: true })
  expect(fetchQuote).toHaveBeenCalled()
  expect(r.value.price).toBe(101)
})
```

Adapt the setup/teardown (store reset, `__resetProviders`, `minInterval` reset) to the conventions already used in `marketDataService.test.ts` — read the file's existing `beforeEach` before adding these.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Rewire the service**

In `marketDataService.ts`:

```ts
import { fetchAlphaVantageHistorical, fetchAlphaVantageQuote } from './providers/alphaVantage'
import { fetchFxRate } from './providers/frankfurter'

interface Providers {
  fetchQuote: typeof fetchAlphaVantageQuote
  fetchHistorical: typeof fetchAlphaVantageHistorical
  fetchFxRate: typeof fetchFxRate
}
const defaultProviders: Providers = {
  fetchQuote: fetchAlphaVantageQuote,
  fetchHistorical: fetchAlphaVantageHistorical,
  fetchFxRate,
}
```

Daily freshness in `getCurrentPrice` (replaces the 15-minute policy for quotes only — FX logic untouched):

```ts
export function isQuoteFreshToday(fetchedAt: string): boolean {
  return toDateKey(new Date(fetchedAt)) === todayKey()
}
```

In `getCurrentPrice`, after the override check and before the fetch:

```ts
  const cached = store.quotes[key]
  if (!opts?.force && cached && isQuoteFreshToday(cached.fetchedAt)) {
    return { value: cached.value, source: 'cache', status: 'success', asOf: cached.fetchedAt, stale: false }
  }
```

Quote staleness for cache fallbacks becomes date-based: in `fromQuoteCache`, replace `stale: isStale(cached.fetchedAt)` with `stale: !isQuoteFreshToday(cached.fetchedAt)`. Keep `minInterval` as a same-day retry guard (prevents hammering when fetches keep failing). Keep `STALE_AFTER_MS`/`isStale` for FX and historical as-is.

- [ ] **Step 4: Refresh on reconnect + launch**

In `useMarketData.ts`, inside `useCurrentPrice` and `useFxRate`, add after the existing resolve-on-mount effect (launch refresh already happens on mount):

```ts
  useEffect(() => {
    const onOnline = () => resolve(() => mountedRef.current, true)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [resolve])
```

(`useFxRate`'s resolve takes no force flag — call `resolve(() => mountedRef.current)` there.)

- [ ] **Step 5: Delete Yahoo files** — `git rm src/services/marketData/providers/yahoo.ts src/services/marketData/providers/yahoo.test.ts`. Fix any leftover imports flagged by `npx tsc --noEmit` (check `src/services/marketData/index.ts` exports).

- [ ] **Step 6: Full suite + typecheck** — `npx vitest run && npx tsc --noEmit` → green.

- [ ] **Step 7: Commit**

```bash
git add -A src/services/marketData src/store/useMarketDataStore.ts
git commit -m "feat: switch quotes to Alpha Vantage with once-daily freshness and online-reconnect refresh"
```

- [ ] **Step 8: Manual verification (⚠️ needs Mishat's key)**

Run the dev server, save a real key in Market Data settings, confirm: a US ticker and a TSX ticker resolve, the Currency Converter shows a live Frankfurter rate, and DevTools Network shows no CORS errors. **This is a final-review gate — automated tests can't cover the real APIs.**

---

## Task 6: Move disclaimer into What's New modal + backdrop blur

⚠️ **R1** (new label punctuation), **R13** (blur strength).

**Files:**
- Modify: `src/components/ui/WhatsNewModal.tsx`
- Modify: `src/components/Layout.tsx:107-109` (remove desktop button; mobile stays)
- Test: create `src/components/ui/WhatsNewModal.test.tsx`

**Interfaces:**
- Produces: `WhatsNewModalProps` gains `onOpenDisclaimer: () => void`.

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WhatsNewModal } from './WhatsNewModal'

describe('WhatsNewModal disclaimer link', () => {
  it('renders the disclaimer button under Made by Mishat and fires the callback', () => {
    const onOpenDisclaimer = vi.fn()
    render(<WhatsNewModal isOpen onClose={() => {}} onOpenDisclaimer={onOpenDisclaimer} />)
    fireEvent.click(screen.getByRole('button', { name: /estimates only/i }))
    expect(onOpenDisclaimer).toHaveBeenCalled()
  })

  it('blurs the backdrop', () => {
    render(<WhatsNewModal isOpen onClose={() => {}} onOpenDisclaimer={() => {}} />)
    expect(screen.getByRole('dialog').className).toContain('backdrop-blur')
  })
})
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement**

In `WhatsNewModal.tsx`:
- Add `onOpenDisclaimer: () => void` to `WhatsNewModalProps`.
- Overlay div (line 64): `bg-black/50` → `bg-black/50 backdrop-blur-sm` (**R13**).
- Under the Made-by paragraph (after line 117) add:

```tsx
        <button
          onClick={() => { onClose(); onOpenDisclaimer() }}
          className="mt-1 text-[10px] text-text-secondary/80 hover:text-accent transition-colors self-center"
        >
          Estimates Only · Not Financial Advice
        </button>
```

(Closing first, then opening the disclaimer, mirrors the existing modal-sequencing pattern in Layout. **R1** for the `·` separator.)

In `Layout.tsx`:
- Delete the desktop disclaimer button (lines 107-109). **Leave the mobile one (lines 125-127) untouched.**
- Pass the callback where the modal is rendered: `<WhatsNewModal ... onOpenDisclaimer={() => setDisclaimerOpen(true)} />`.

- [ ] **Step 4: Run tests + typecheck** — targeted test PASS, `npx tsc --noEmit` green.

- [ ] **Step 5: Manual check** — dev server: desktop sidebar no longer shows the disclaimer link; What's New opens with blurred background; clicking the new link closes What's New and opens the disclaimer; mobile row unchanged. **Final-review gate: Mishat eyeballs the modal layout and blur strength.**

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/WhatsNewModal.tsx src/components/ui/WhatsNewModal.test.tsx src/components/Layout.tsx
git commit -m "feat: move disclaimer link into What's New modal, blur modal backdrop"
```

---

## Task 7: Remove all em dashes, case by case

⚠️ **R2, R3, R4, R5.** Scope: `src/**` (41 occurrences) + `CHANGELOG.md` (8). Excludes `.claude/`, `.planning/`, `docs/` (**R5**).

**Files:** the 22 src files listed below + `CHANGELOG.md`. No new tests (text-only), but the full suite must stay green (several tests assert copy strings — update them together with the source).

**Replacement table** (rule of thumb: comments get `-`; UI prose gets a period, comma, or `·`; placeholders get `-` per **R2**):

| File:line | Current context | Replacement |
|---|---|---|
| `src/index.css:217` | comment `pickers) — always opaque` | ` - ` |
| `src/store/budgetSelectors.test.ts:20` | comment | ` - ` |
| `src/utils/portfolioCsv.ts:4` | comment | ` - ` |
| `src/pages/Dashboard.tsx:18` | comment | ` - ` |
| `src/store/usePortfolioStore.ts:73` | comment | ` - ` |
| `src/utils/disclaimer.ts:7` | `decisions — you are` | `decisions. You are` (**R3**) |
| `src/utils/finance/canadaTax.ts:1,10` | comments | ` - ` |
| `src/utils/finance/compFeed.test.ts:46` | comment | ` - ` |
| `src/utils/finance/compFeed.ts:3,53,58,68` | comments | ` - ` |
| `src/utils/finance/debtPayoff.test.ts:22,60` | comments | ` - ` |
| `src/utils/finance/debtPayoff.ts:4,22,85` | comments | ` - ` |
| `src/components/Layout.tsx:126` | mobile label `Estimates Only — Not…` | `Estimates Only · Not Financial Advice` (**R1**; desktop copy of this line is deleted in Task 6) |
| `src/utils/finance/amortization.ts:3,21,99` | comments | ` - ` |
| `src/components/ui/WhatsNewModal.tsx:60` | `Couldn't check — are you offline?` | `Couldn't check. Are you offline?` |
| `src/components/ui/WhatsNewModal.tsx:68` | `What's New — v{…}` | `What's New · v{…}` |
| `src/utils/budget/cashFlowForecast.test.ts:20` | comment | ` - ` |
| `src/components/investments/AnalysisModal.tsx:115` | comment | ` - ` |
| `src/utils/finance/raise.ts:1` | comment | ` - ` |
| `src/components/investments/HoldingRow.tsx:18` | placeholder `'—'` | `'-'` (**R2**) |
| `src/components/ui/NumberInput.test.tsx:51` | comment | ` - ` |
| `src/components/investments/PositionCard.tsx:20,122` | placeholders `'—'` | `'-'` (**R2**) |
| `src/components/investments/SwapSimulator.tsx:110,150,154,159` | placeholders `'—'` | `'-'` (**R2**) |
| `src/components/planner/toolRegistry.tsx:60` | `annual spending — the point where` | `annual spending, the point where` |
| `src/components/planner/toolRegistry.tsx:236` | `next dollar earned — higher than` | `next dollar earned. It is higher than` |
| `src/components/planner/toolRegistry.tsx:237` | `percent of total income — the blended rate` | `percent of total income, the blended rate` |
| `src/components/planner/toolRegistry.tsx:244` | `cost later — or what` | `cost later, or what` |
| `src/components/planner/toolRegistry.tsx:249` | `years of inflation — useful for` | `years of inflation. Useful for` |
| `CHANGELOG.md:12` | `pick a debt type — Credit Card` | `pick a debt type: Credit Card` (**R4**) |
| `CHANGELOG.md:13` | `payment toggle — see the` | `payment toggle: see the` |
| `CHANGELOG.md:14` | `launches — installed-app updates` | `launches, so installed-app updates` |
| `CHANGELOG.md:15` | `"Estimates Only — Not Financial Advice" link` | `"Estimates Only · Not Financial Advice" link` |
| `CHANGELOG.md:20` | `follows the tab — "+ Position"` | `follows the tab: "+ Position"` |
| `CHANGELOG.md:31` | `toast — the app now tells` | `toast: the app now tells` |
| `CHANGELOG.md:37` | `cost later — e.g., what` | `cost later, e.g. what` |
| `CHANGELOG.md:41` | `while you type — no more leading-zero (0100) glitch — and` | `while you type, with no leading-zero (0100) glitch, and` |

- [ ] **Step 1: Apply every replacement above** (do Task 6 first — it deletes one of the two Layout occurrences).

- [ ] **Step 2: Verify zero remain in scope**

Run: `grep -rn $'—' src CHANGELOG.md` (Git Bash) — expected: no output.

- [ ] **Step 3: Full suite + typecheck** — `npx vitest run && npx tsc --noEmit`. If a test asserted old copy (e.g. NumberInput or disclaimer text), update the assertion to the new copy in the same commit.

- [ ] **Step 4: Commit**

```bash
git add -A src CHANGELOG.md
git commit -m "style: remove em dashes app-wide, case-by-case rewording"
```

- [ ] **Step 5: Final-review gate** — Mishat skims the diff of this commit; it is 100% copy changes and every line is a judgment call (**R1-R5**).

---

## Task 8: Budget paradigms research writeup (no code)

⚠️ **R14.** The paradigm selector currently stores a value that affects nothing: `useBudgetStore.ts:247-252` is an empty `if` with comments. Prior art exists in `.planning/phases/07-budgeting-paradigms/07-RESEARCH.md` — read it first and incorporate.

**Files:**
- Create: `docs/superpowers/research/2026-07-12-budget-paradigms.md`

**Interfaces:** none — pure document.

- [ ] **Step 1: Read the prior research** — `.planning/phases/07-budgeting-paradigms/07-RESEARCH.md`, `07-CONTEXT.md`, `07-PLAN.md`, plus current `useBudgetStore.ts` and `CategoryManagerWidget.tsx`.

- [ ] **Step 2: Write the document** covering:
  1. **Current state** — selector exists, persisted, zero behavioral effect; exact code pointers.
  2. **What each paradigm could mean** (concrete, per-paradigm rule set):
     - *Zero-Based*: unallocated must equal 0; UI warns when income ≠ sum of targets; overspend requires explicit reallocation (the comment at `useBudgetStore.ts:249-251` already sketches this).
     - *Target-Based*: targets are ceilings, surplus is fine; unallocated shown as "buffer"; overspend rolls against the buffer automatically.
     - *Ledger Custom*: current freeform behavior, formally documented as "no enforcement".
  3. **Options going forward**: (a) implement the rules, (b) remove the selector, (c) keep as label-only with a tooltip explaining the philosophy. Include effort estimates and a recommendation.
  4. **Decision log placeholder** for Mishat's choice.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/research/2026-07-12-budget-paradigms.md
git commit -m "docs: research writeup on making budget paradigms functional (or removing them)"
```

- [ ] **Step 4: Final-review gate** — Mishat reads the doc and picks a direction; that becomes a future task, out of scope here.

---

## Task 9: Changelog + release notes

**Files:**
- Modify: `CHANGELOG.md` (new `## v0.5.0` section at top, using no em dashes)

- [ ] **Step 1: Add entries** under `### Added` / `### Fixed` / `### Changed`: live stock prices via user-supplied Alpha Vantage key with Market Data settings; fixed currency rates (Frankfurter URL); disclaimer link moved into What's New; backdrop blur; em dash cleanup.

- [ ] **Step 2: Full verification** — `npx vitest run && npx tsc --noEmit && npx vite build` → all green.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: v0.5.0 changelog"
```

---

## Execution order

1 → 2 → 3 → 4 → 5 (market data chain, each depends on the previous)
6 → 7 (disclaimer move before em dash sweep — Task 6 deletes one occurrence)
8 anytime; 9 last.

## Final review checklist (everything needing Mishat)

- [ ] R1 disclaimer separator `·`  — Task 6/7
- [ ] R2 placeholder glyph `-` — Task 7
- [ ] R3 disclaimer legal copy — Task 7
- [ ] R4 changelog rewording — Task 7
- [ ] R5 em dash scope exclusions — Task 7
- [ ] R6 settings placement — Task 4
- [ ] R7 exchange-string mapping vs. actual portfolio data — Task 3
- [ ] R8 currency inference — Task 3
- [ ] R9 once-daily price freshness — Task 5
- [ ] R10 old-date historical lookups use `outputsize=full` — Task 3
- [ ] R11 quota-exhausted UX (stale badge) — Task 5
- [ ] R12 Yahoo files deleted — Task 5
- [ ] R13 blur strength — Task 6
- [ ] R14 paradigm direction decision — Task 8
- [ ] Manual live-API test with a real key (Task 5 Step 8)
