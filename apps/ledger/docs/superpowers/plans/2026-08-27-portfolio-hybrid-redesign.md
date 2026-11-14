# Portfolio Tab Hybrid Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Investments Portfolio tab as register D from the mockups (editorial split hero, three stacked allocation bars, six-column holdings table with a per-row disclosure), after first correcting the manual-override currency bug that makes the page's totals wrong.

**Architecture:** Work proceeds in three groups. First the correctness fix, because every number the new presentation makes bigger is a number the bug corrupts. Then the table half, which stands alone and leaves the existing donut and stat cards in place throughout. Then the hero and allocation half, which retires `AllocationChart` and drops the Portfolio route out of the e2e chart guard. No task fetches new data; every figure is derived from holdings already in the store.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4, Zustand 5, Vitest 4, Testing Library, Playwright. No new runtime dependency. The allocation bars are plain divs, not charts, so recharts is not involved.

## Global Constraints

- No em dashes in any source, comment, test name, or user-facing copy. This is a standing project rule.
- Never edit a value in `STORAGE_KEYS` (`src/store/storageKeys.ts`). Those strings are the on-disk contract with existing installs.
- Do not add version series to test assertions. Tests must not hardcode `0.9.x`.
- Run the full suite with `npm test -- --run`. The true suite count excludes `.claude/worktrees`, which `vite.config.ts` already handles.
- Every task ends with a green suite and its own commit.
- Baseline at plan start: 1296 unit tests, 149 e2e, eslint clean, `tsc -b` clean, all three bundle guards passing.
- Every commit carries the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never `git add -A` or `git add .`. Stage explicit paths. Untracked and belonging to other work: `csv-examples/`, the malformed `C\357\200\272...` path artifact, `docs/superpowers/plans/2026-08-16-audit-remediation-non-security.md`.
- Existing test files are MODIFIED, never recreated. Check a file exists before acting on any "Create" instruction.
- **Known cold-run flake, four plans running.** One test in `src/App.test.tsx` ("shows a loading placeholder while a lazy route chunk resolves") times out on a cold full-suite run under CPU contention and passes on a rerun and in isolation. Rerun a lone unexplained failure there before treating it as a regression. It is unrelated to this plan.
- **No per-task gate in this project runs eslint or tsc.** A task can pass its review and still break `npm run verify`. The v0.9.6 and v0.9.7 branches were both bitten by this at the release gate. Task 8 is the first stage that runs them, so if a task adds an export to a component file, check `react-refresh/only-export-components` by hand before committing.
- No text may sit on top of a chart colour. Segment names and percentages go in a text row beside or beneath the bars, never inside them. Several `--chart-*` tokens are mid-tone and clear 4.5:1 against neither white nor black across the six themes.
- Every colour comes from an existing token. No new palette values.

## Two decisions this plan makes that the spec did not cover

Both were found by reading `PortfolioView.tsx` against the spec.

1. **The excluded-holdings warning.** Today it lives inside the Total P/L stat card (`PortfolioView.tsx`, the `totals.excludedCount > 0` block, including its "Retry exchange rates" button). The stat cards are being removed, so Task 6 rehomes it into `PortfolioSummary` beneath the delta line, keeping the retry button and its behaviour.
2. **The PortfolioAnalyst Account Value card.** Today a fourth stat card appears only when a report has been uploaded (`accountValue(report)`). Task 6 makes it a conditional row in the hero's derived-facts list instead, so uploading a report no longer changes the page's column count. The label keeps its exact existing text, `Account Value (<baseCurrency>)` with a capital V, and the cash sleeve comes with it, because `PortfolioView.test.tsx` already asserts on both and those assertions stay correct.

---

## File Structure

**New files**

- `src/utils/investments/portfolioHighlights.ts`. Pure derivation of the hero's facts. No DOM, no store.
- `src/utils/investments/portfolioHighlights.test.ts`.
- `src/components/investments/PortfolioSummary.tsx`. The hero band.
- `src/components/investments/PortfolioSummary.test.tsx`.
- `src/components/investments/AllocationBars.tsx`. Three stacked 100% bars plus a text row.
- `src/components/investments/AllocationBars.test.tsx`.

**Modified files**

- `src/utils/investments/portfolioMetrics.ts`. Gains `quoteCurrencyForHolding`.
- `src/utils/investments/portfolioMetrics.test.ts`. Tests for it.
- `src/components/investments/HoldingRow.tsx`. Override currency fix, then six cells plus a disclosure row.
- `src/components/investments/HoldingRow.test.tsx`.
- `src/components/investments/HoldingCard.tsx`. Same two changes for mobile.
- `src/components/investments/HoldingCard.test.tsx`.
- `src/components/investments/PortfolioView.tsx`. Header array drops two columns; stat cards and donut swapped for the new components.
- `src/components/investments/PortfolioView.test.tsx`.
- `src/services/marketData/marketDataService.ts`. Comment only, at the override branch.
- `e2e/desktop-guards.spec.ts`. Remove the Investments Portfolio entry from `CHART_ROUTES`.

**Deleted files**

- `src/components/investments/AllocationChart.tsx`
- `src/components/investments/AllocationChart.test.tsx`

---

# Phase 0: the override currency fix

### Task 1: `quoteCurrencyForHolding`

`getCurrentPrice` stamps `currency: 'USD'` on every manual price override (`src/services/marketData/marketDataService.ts:59`). The service has no holding context, so it cannot know better. A manual override is entered by the user while looking at one holding, so it is denominated in that holding's currency by construction. `PortfolioRollupWidget` already applies this rule and documents it; `HoldingRow` and `HoldingCard` do not, which is why the Portfolio tab reads $112,582 where the Dashboard reads $93,394 on the same data.

This task adds the rule as one pure function so the three surfaces cannot diverge again.

**Files:**
- Modify: `src/utils/investments/portfolioMetrics.ts`
- Test: `src/utils/investments/portfolioMetrics.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `quoteCurrencyForHolding(holding: Holding, quoteCurrency: Currency | null | undefined, source: 'override' | 'live' | 'cache' | undefined): Currency | null`. Tasks 2 and 3 call it.

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/investments/portfolioMetrics.test.ts`:

```ts
describe('quoteCurrencyForHolding', () => {
  const cadHolding = {
    id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100,
    currency: 'CAD' as const, account: 'TFSA',
  }

  it('ignores the currency reported for a manual override and uses the holding currency', () => {
    // The service stamps a placeholder currency on overrides because it has
    // no holding context. Believing it converts a CAD price as though it
    // were USD, which is the defect this function exists to prevent.
    expect(quoteCurrencyForHolding(cadHolding, 'USD', 'override')).toBe('CAD')
  })

  it('believes the currency on a live quote', () => {
    expect(quoteCurrencyForHolding(cadHolding, 'USD', 'live')).toBe('USD')
  })

  it('believes the currency on a cached quote', () => {
    expect(quoteCurrencyForHolding(cadHolding, 'USD', 'cache')).toBe('USD')
  })

  it('falls back to the holding currency when there is no quote at all', () => {
    expect(quoteCurrencyForHolding(cadHolding, undefined, undefined)).toBe('CAD')
  })

  it('returns the unset holding currency for an override on a holding with no currency', () => {
    const unset = { ...cadHolding, currency: null }
    expect(quoteCurrencyForHolding(unset, 'USD', 'override')).toBeNull()
  })
})
```

Add `quoteCurrencyForHolding` to the existing import from `./portfolioMetrics` at the top of that test file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest --run src/utils/investments/portfolioMetrics.test.ts`
Expected: FAIL, with `quoteCurrencyForHolding is not a function` or a TypeScript error that it is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/utils/investments/portfolioMetrics.ts`:

```ts
/** The currency a holding's resolved quote should be read in.
 *
 *  A manual price override is typed by the user while looking at one
 *  holding, so it is already denominated in that holding's own currency.
 *  getCurrentPrice has no holding context and stamps a placeholder currency
 *  on the override it returns, so that value must not be believed: doing so
 *  converts the price a second time and inflates value, P/L and allocation
 *  by the exchange rate. PortfolioRollupWidget has always applied this rule
 *  by short-circuiting overrides; this is the same rule in one shared place
 *  so the row, the card and the rollup cannot disagree again. */
export function quoteCurrencyForHolding(
  holding: Holding,
  quoteCurrency: Currency | null | undefined,
  source: 'override' | 'live' | 'cache' | undefined,
): Currency | null {
  if (source === 'override') return holding.currency
  return quoteCurrency ?? holding.currency
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest --run src/utils/investments/portfolioMetrics.test.ts`
Expected: PASS, all five new tests green.

- [ ] **Step 5: Add the explanatory comment at the source of the placeholder**

In `src/services/marketData/marketDataService.ts`, in the override branch of `getCurrentPrice`, change:

```ts
  const override = store.getOverride(key)
  if (override !== undefined) {
    const asOf = new Date().toISOString()
    return {
      value: { ticker: ticker.trim(), exchange, price: override, currency: 'USD', asOf },
      source: 'override', status: 'success', asOf, stale: false,
    }
  }
```

to:

```ts
  const override = store.getOverride(key)
  if (override !== undefined) {
    const asOf = new Date().toISOString()
    // The currency here is a placeholder and is NOT authoritative. An
    // override is entered by the user in whatever currency they were
    // looking at, and this function has no holding context to name it.
    // Holding-aware callers must resolve it with quoteCurrencyForHolding
    // in src/utils/investments/portfolioMetrics.ts rather than reading
    // this field. Quote.currency is not nullable, so a placeholder it is.
    return {
      value: { ticker: ticker.trim(), exchange, price: override, currency: 'USD', asOf },
      source: 'override', status: 'success', asOf, stale: false,
    }
  }
```

- [ ] **Step 6: Run the full suite**

Run: `npm test -- --run`
Expected: PASS. 1301 tests (1296 baseline plus 5 new).

- [ ] **Step 7: Commit**

```bash
git add src/utils/investments/portfolioMetrics.ts src/utils/investments/portfolioMetrics.test.ts src/services/marketData/marketDataService.ts
git commit -m "fix(investments): add the shared rule for reading an override's currency"
```

---

### Task 2: Apply the fix in the row, the card, and the parity test

**Files:**
- Modify: `src/components/investments/HoldingRow.tsx:24-26`
- Modify: `src/components/investments/HoldingCard.tsx:23-25`
- Test: `src/components/investments/HoldingRow.test.tsx`
- Test: `src/components/investments/HoldingCard.test.tsx`
- Test: `src/components/investments/portfolioTotalsParity.test.tsx`

**Interfaces:**
- Consumes: `quoteCurrencyForHolding` from Task 1.
- Produces: nothing new. After this task the Portfolio tab and the Dashboard rollup report identical totals when overrides are present.

- [ ] **Step 1: Write the failing row test**

Append to `src/components/investments/HoldingRow.test.tsx`, inside the existing `describe('quote currency')` block:

```ts
  it('does not convert a manual override, which is already in the holding currency', async () => {
    // A CAD holding with a manually entered CAD price. Reading the
    // override's placeholder currency as USD multiplies this price by the
    // USD rate: 148.90 becomes 206.51, and the tab disagrees with the
    // dashboard rollup on the same data.
    useMarketDataStore.setState({ overrides: { VFV: 148.9 } })
    const holding = {
      id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100,
      currency: 'CAD' as const, account: 'TFSA',
    }
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{ USD: 1.3869 }} totalValueCad={10000} onPrice={() => {}} />
      </tbody></table>,
    )
    expect(await screen.findByText('148.90')).toBeInTheDocument()
    expect(screen.queryByText('206.51')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Write the failing card test**

`HoldingCard.test.tsx` does NOT drive the real store. It mocks the hook at the top of the file with `vi.mock('../../services/marketData', ...)` and controls it through `useCurrentPriceMock`, so setting `overrides` on the store would do nothing here. Drive the mock instead, and note that `source: 'override'` is the field under test.

Append to `src/components/investments/HoldingCard.test.tsx`:

```tsx
  it('does not convert a manual override, which is already in the holding currency', () => {
    // source: 'override' is the point. The placeholder currency the service
    // stamps on overrides is USD; believing it turns this CAD price of
    // 148.90 into 206.51.
    useCurrentPriceMock.mockReturnValue({
      data: { value: { price: 148.9, currency: 'USD' }, source: 'override', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })
    const holding = buildHolding({
      id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA',
    })
    const { getByText, queryByText } = render(
      <HoldingCard holding={holding} rates={{ USD: 1.3869 }} totalValueCad={10000} onPrice={() => {}} />,
    )
    expect(getByText('148.90')).toBeInTheDocument()
    expect(queryByText('206.51')).not.toBeInTheDocument()
  })
```

`buildHolding` is the existing factory in that file. No new imports are needed.

- [ ] **Step 3: Write the failing parity test**

Append to `src/components/investments/portfolioTotalsParity.test.tsx`:

```ts
describe('portfolio totals parity: manual override', () => {
  // A CAD holding priced by hand. The rollup has always trusted an override
  // raw; the tab used to convert it as though the placeholder currency the
  // service stamps on overrides were real, so the same holding read $1,489
  // in one place and $2,065 in the other.
  const holdings = [
    { id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD' as const, account: 'TFSA' },
  ]

  beforeEach(() => {
    installMatchMedia()
    usePortfolioStore.setState({ holdings, importedAt: new Date().toISOString(), currencyReviewPending: false })
    useMarketDataStore.setState({ quotes: {}, overrides: { [quoteKey('VFV')]: 148.9 } })
    __resetMinInterval()
  })

  it('reports the same holdings value on both surfaces when the price is a manual override', async () => {
    const { unmount } = render(<MemoryRouter><PortfolioRollupWidget /></MemoryRouter>)
    expect(await screen.findByText('$1,489')).toBeInTheDocument()
    unmount()

    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    expect(await screen.findByText('Holdings Value (CAD)')).toBeInTheDocument()
    const viewValues = screen.getAllByText(/^\$[\d,]+/).map((el) => el.textContent!.trim())
    expect(viewValues).toContain('$1,489')
    expect(viewValues).not.toContain('$2,065')
  })
})
```

- [ ] **Step 4: Run the three test files to verify they fail**

Run: `npx vitest --run src/components/investments/HoldingRow.test.tsx src/components/investments/HoldingCard.test.tsx src/components/investments/portfolioTotalsParity.test.tsx`
Expected: FAIL, three new tests red. The row and card failures report finding `206.51` where `148.90` was expected; the parity failure reports `$2,065` present.

- [ ] **Step 5: Fix `HoldingRow`**

In `src/components/investments/HoldingRow.tsx`, add `quoteCurrencyForHolding` to the existing import from `../../utils/investments/portfolioMetrics`, then change:

```ts
  const live = useCurrentPrice(holding.ticker, holding.exchange)
  const quoteCurrency = live.data?.value.currency ?? holding.currency
  const nativePrice = live.data?.value.price ?? holding.avgCost
```

to:

```ts
  const live = useCurrentPrice(holding.ticker, holding.exchange)
  // Not live.data.value.currency directly: an override's currency is a
  // placeholder the service cannot fill in correctly. See
  // quoteCurrencyForHolding.
  const quoteCurrency = quoteCurrencyForHolding(holding, live.data?.value.currency, live.data?.source)
  const nativePrice = live.data?.value.price ?? holding.avgCost
```

- [ ] **Step 6: Fix `HoldingCard`**

Make the identical change in `src/components/investments/HoldingCard.tsx`, which has the same three lines and the same import.

- [ ] **Step 7: Run the three test files to verify they pass**

Run: `npx vitest --run src/components/investments/HoldingRow.test.tsx src/components/investments/HoldingCard.test.tsx src/components/investments/portfolioTotalsParity.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full suite**

Run: `npm test -- --run`
Expected: PASS. 1304 tests.

- [ ] **Step 9: Commit**

```bash
git add src/components/investments/HoldingRow.tsx src/components/investments/HoldingCard.tsx src/components/investments/HoldingRow.test.tsx src/components/investments/HoldingCard.test.tsx src/components/investments/portfolioTotalsParity.test.tsx
git commit -m "fix(investments): stop converting manual price overrides a second time"
```

---

# Phase 1: the table half

### Task 3: `HoldingRow` disclosure

Six visible cells. Avg Cost and Book move into a detail row that opens from a disclosure button on the ticker. Neither demoted column is sortable today (both are `key: null` in `PortfolioView`'s `headers` array), so `sortRows` and the four sort keys are untouched.

**Files:**
- Modify: `src/components/investments/HoldingRow.tsx`
- Modify: `src/components/investments/PortfolioView.tsx` (the `headers` array only)
- Test: `src/components/investments/HoldingRow.test.tsx`

**Interfaces:**
- Consumes: `quoteCurrencyForHolding` from Task 1, already wired in Task 2.
- Produces: `HoldingRow` renders a React fragment of one or two `<tr>` elements instead of a single `<tr>`. Its props are unchanged: `{ holding, rates, totalValueCad, onPrice }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/investments/HoldingRow.test.tsx`:

```ts
describe('row disclosure', () => {
  const holding = {
    id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100,
    currency: 'CAD' as const, account: 'TFSA',
  }

  const renderRow = () =>
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{}} totalValueCad={10000} onPrice={() => {}} />
      </tbody></table>,
    )

  it('starts collapsed, with avg cost and book hidden', () => {
    renderRow()
    expect(screen.getByRole('button', { name: 'Details for VFV' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Avg cost')).not.toBeInTheDocument()
    expect(screen.queryByText('Book')).not.toBeInTheDocument()
  })

  it('reveals avg cost and book when opened', () => {
    renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Details for VFV' }))
    expect(screen.getByRole('button', { name: 'Details for VFV' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Avg cost')).toBeInTheDocument()
    expect(screen.getByText('Book')).toBeInTheDocument()
    expect(screen.getByText('100.00')).toBeInTheDocument()
    expect(screen.getByText(formatMoney(1000))).toBeInTheDocument()
  })

  it('closes again on a second click', () => {
    renderRow()
    const toggle = screen.getByRole('button', { name: 'Details for VFV' })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Avg cost')).not.toBeInTheDocument()
  })

  it('points the disclosure at the detail row it controls', () => {
    renderRow()
    const toggle = screen.getByRole('button', { name: 'Details for VFV' })
    fireEvent.click(toggle)
    const controlled = toggle.getAttribute('aria-controls')
    expect(controlled).toBe('holding-detail-h1')
    expect(document.getElementById(controlled!)).not.toBeNull()
  })
})
```

Add `fireEvent` to the existing `@testing-library/react` import in that file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest --run src/components/investments/HoldingRow.test.tsx`
Expected: FAIL, four new tests red with `Unable to find role="button" with name "Details for VFV"`.

- [ ] **Step 3: Add the disclosure state and the two-row render**

In `src/components/investments/HoldingRow.tsx`, add `useState` to the React import and `ChevronRight` to the `lucide-react` import (add the import if the file has none), then add the state next to the other hooks:

```ts
  const [open, setOpen] = useState(false)
  const detailId = `holding-detail-${holding.id}`
```

Replace the opening `<tr className="border-b border-border last:border-b-0">` and its first `<td>` with a fragment whose first cell carries the disclosure:

```tsx
    <>
      <tr className={open ? '' : 'border-b border-border last:border-b-0'}>
        <td className="py-2 pr-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`Details for ${holding.ticker}`}
            className="inline-flex items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-text-secondary transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
            <span data-testid="holding-ticker" className="text-text-primary font-medium">{holding.ticker}</span>
          </button>
          <span className="block text-meta text-text-secondary pl-[18px]">
```

The rest of that cell's contents (the `ThemedSelect`, the unconverted marker, and the `DataFreshness` block) stay exactly as they are, as does its closing `</span></td>`.

- [ ] **Step 4: Delete the Avg Cost and Book cells**

Still in `HoldingRow.tsx`, delete these two cells:

```tsx
      <td className="py-2 pr-3 text-right text-text-secondary">{holding.avgCost.toFixed(2)}</td>
```

and

```tsx
      <td className="py-2 pr-3 text-right text-text-primary">{formatMoney(bookValue(holding))}</td>
```

Leave the Qty, Price, Value, P/L and Alloc cells untouched.

- [ ] **Step 5: Add the detail row**

Immediately after the closing `</tr>` of the main row, before the fragment closes:

```tsx
      {open && (
        <tr id={detailId} className="border-b border-border last:border-b-0">
          <td colSpan={6} className="pb-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-bg-primary/50 px-3 py-2 text-meta text-text-secondary">
              <span>Avg cost <span className="text-text-primary tabular-nums">{holding.avgCost.toFixed(2)}</span></span>
              <span>Book <span className="text-text-primary tabular-nums">{formatMoney(bookValue(holding))}</span></span>
              <span>Return <span className={`tabular-nums ${holdingPlDollars(holding, effectivePrice) >= 0 ? 'text-accent' : 'text-error'}`}>{pct(holdingPlPct(holding, effectivePrice))}</span></span>
            </div>
          </td>
        </tr>
      )}
    </>
```

`bookValue`, `holdingPlDollars`, `holdingPlPct` and `pct` are all already imported in this file.

- [ ] **Step 6: Drop the two headers**

In `src/components/investments/PortfolioView.tsx`, change the `headers` array from:

```ts
            const headers: { key: SortKey | null; label: string; align: string }[] = [
              { key: 'ticker', label: 'Holding', align: 'text-left' },
              { key: null, label: 'Qty', align: 'text-right' },
              { key: null, label: 'Avg Cost', align: 'text-right' },
              { key: null, label: 'Price', align: 'text-right' },
              { key: null, label: 'Book', align: 'text-right' },
              { key: 'value', label: 'Value', align: 'text-right' },
              { key: 'pl', label: 'P/L', align: 'text-right' },
              { key: 'alloc', label: 'Alloc', align: 'text-right' },
            ]
```

to:

```ts
            // Avg Cost and Book moved into the per-row disclosure in
            // HoldingRow. Neither was sortable, so no sort key is lost.
            const headers: { key: SortKey | null; label: string; align: string }[] = [
              { key: 'ticker', label: 'Holding', align: 'text-left' },
              { key: null, label: 'Qty', align: 'text-right' },
              { key: null, label: 'Price', align: 'text-right' },
              { key: 'value', label: 'Value', align: 'text-right' },
              { key: 'pl', label: 'P/L', align: 'text-right' },
              { key: 'alloc', label: 'Alloc', align: 'text-right' },
            ]
```

In the same file, change the table's `min-w-[720px]` to `min-w-[560px]`, since two columns are gone.

- [ ] **Step 7: Run the row tests to verify they pass**

Run: `npx vitest --run src/components/investments/HoldingRow.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full suite and fix fallout**

Run: `npm test -- --run`
Expected: PASS. If `PortfolioView.test.tsx` asserts on the `Avg Cost` or `Book` column headers, update those assertions to open the relevant row's disclosure first, or to assert the six-column header set. Do not delete a test to make it pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/investments/HoldingRow.tsx src/components/investments/HoldingRow.test.tsx src/components/investments/PortfolioView.tsx src/components/investments/PortfolioView.test.tsx
git commit -m "feat(investments): move avg cost and book into a per-row disclosure"
```

---

### Task 4: `HoldingCard` disclosure

The mobile view carries the same six figures in a two-column grid. Avg Cost and Book move behind the same disclosure so the two viewports agree on what is primary.

**Files:**
- Modify: `src/components/investments/HoldingCard.tsx`
- Test: `src/components/investments/HoldingCard.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `HoldingCard` props unchanged: `{ holding, rates, totalValueCad, onPrice }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/investments/HoldingCard.test.tsx`:

```ts
describe('card disclosure', () => {
  const holding = {
    id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100,
    currency: 'CAD' as const, account: 'TFSA',
  }

  it('starts collapsed, with avg cost and book hidden', () => {
    render(<HoldingCard holding={holding} rates={{}} totalValueCad={10000} onPrice={() => {}} />)
    expect(screen.getByRole('button', { name: 'Details for VFV' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Avg Cost')).not.toBeInTheDocument()
    expect(screen.queryByText('Book')).not.toBeInTheDocument()
  })

  it('reveals avg cost and book when opened', () => {
    render(<HoldingCard holding={holding} rates={{}} totalValueCad={10000} onPrice={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Details for VFV' }))
    expect(screen.getByText('Avg Cost')).toBeInTheDocument()
    expect(screen.getByText('Book')).toBeInTheDocument()
  })
})
```

Add `fireEvent` to the `@testing-library/react` import in that file if it is not already there.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest --run src/components/investments/HoldingCard.test.tsx`
Expected: FAIL, both new tests red with `Unable to find role="button" with name "Details for VFV"`.

- [ ] **Step 3: Add the state and the toggle**

In `src/components/investments/HoldingCard.tsx`, add `useState` to the React import and `ChevronRight` to a `lucide-react` import, then add above the return:

```ts
  const [open, setOpen] = useState(false)
  const detailId = `holding-card-detail-${holding.id}`
```

Wrap the ticker in the disclosure. Change:

```tsx
          <span className="text-[15px] font-semibold text-text-primary">{holding.ticker}</span>
```

to:

```tsx
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`Details for ${holding.ticker}`}
            className="inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-text-secondary transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
            <span className="text-[15px] font-semibold text-text-primary">{holding.ticker}</span>
          </button>
```

- [ ] **Step 4: Move the two pairs behind the disclosure**

Delete this pair from the grid:

```tsx
        <span className="text-text-secondary">Avg Cost</span><span className="text-right tabular-nums">{holding.avgCost.toFixed(2)}</span>
```

and this pair:

```tsx
        <span className="text-text-secondary">Book</span><span className="text-right tabular-nums">{formatMoney(bookValue(holding))}</span>
```

Then, immediately after the closing `</div>` of the grid, add:

```tsx
      {open && (
        <div id={detailId} className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] rounded-md bg-bg-primary/50 px-2 py-2">
          <span className="text-text-secondary">Avg Cost</span><span className="text-right tabular-nums">{holding.avgCost.toFixed(2)}</span>
          <span className="text-text-secondary">Book</span><span className="text-right tabular-nums">{formatMoney(bookValue(holding))}</span>
        </div>
      )}
```

- [ ] **Step 5: Run the card tests to verify they pass**

Run: `npx vitest --run src/components/investments/HoldingCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test -- --run`
Expected: PASS. 1310 tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/investments/HoldingCard.tsx src/components/investments/HoldingCard.test.tsx
git commit -m "feat(investments): match the row disclosure in the mobile holding card"
```

---

# Phase 2: the hero and allocation half

### Task 5: `portfolioHighlights`

Pure derivation of every fact the hero shows. `strongest` and `weakest` rank on percentage return, not dollar P/L, so a small position that doubled outranks a large one that crept up.

**Files:**
- Create: `src/utils/investments/portfolioHighlights.ts`
- Test: `src/utils/investments/portfolioHighlights.test.ts`

**Interfaces:**
- Consumes: `portfolioTotals`, `holdingPlPct`, `allocationBreakdown`, `FxRates` from `./portfolioMetrics`.
- Produces:

```ts
export interface Highlight { ticker: string; plPct: number }
export interface Weight { name: string; pct: number }
export interface PortfolioHighlights {
  totals: PortfolioTotals
  strongest: Highlight | null
  weakest: Highlight | null
  largestWeight: Weight | null
  currencySplit: Weight[]
  holdingCount: number
  accountCount: number
}
export function portfolioHighlights(
  rows: { holding: Holding; price: number }[],
  rates: FxRates,
): PortfolioHighlights
```

Task 6 consumes it.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/investments/portfolioHighlights.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { portfolioHighlights } from './portfolioHighlights'
import type { Holding } from '../../store/usePortfolioStore'

const h = (over: Partial<Holding>): Holding => ({
  id: 'h1', ticker: 'AAA', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA', ...over,
})

// VFV:  10 at 100 CAD cost, priced 150, so +50% and +500 CAD.
// CNQ:  10 at 100 CAD cost, priced 90,  so -10% and -100 CAD.
// AAPL: 100 at 100 USD cost, priced 120 USD at a rate of 2, so +20% but
//       +4000 CAD. The sizes are deliberate: AAPL wins on dollars while
//       VFV wins on percent, so a test that says "strongest is VFV" would
//       pass under a dollar ranking too if the numbers were not set up
//       this way.
const rows = [
  { holding: h({ id: '1', ticker: 'VFV' }), price: 150 },
  { holding: h({ id: '2', ticker: 'CNQ', account: 'RRSP' }), price: 90 },
  { holding: h({ id: '3', ticker: 'AAPL', quantity: 100, currency: 'USD' as const, account: 'RRSP' }), price: 120 },
]
const rates = { USD: 2 }

describe('portfolioHighlights', () => {
  it('ranks strongest and weakest on percentage return, not dollars', () => {
    const r = portfolioHighlights(rows, rates)
    // AAPL gained the most dollars (+4000 CAD against VFV's +500) but VFV
    // returned the most percent. Percent wins.
    expect(r.strongest).toEqual({ ticker: 'VFV', plPct: 50 })
    expect(r.weakest).toEqual({ ticker: 'CNQ', plPct: -10 })
  })

  it('names the largest weight', () => {
    const r = portfolioHighlights(rows, rates)
    // AAPL is 24000 CAD against VFV 1500 and CNQ 900.
    expect(r.largestWeight?.name).toBe('AAPL')
  })

  it('splits by currency, summing to 100', () => {
    const r = portfolioHighlights(rows, rates)
    const total = r.currencySplit.reduce((s, c) => s + c.pct, 0)
    expect(Math.round(total)).toBe(100)
    expect(r.currencySplit.map((c) => c.name).sort()).toEqual(['CAD', 'USD'])
  })

  it('counts holdings and distinct accounts', () => {
    const r = portfolioHighlights(rows, rates)
    expect(r.holdingCount).toBe(3)
    expect(r.accountCount).toBe(2)
  })

  it('returns nulls and zero counts for an empty portfolio', () => {
    const r = portfolioHighlights([], {})
    expect(r.strongest).toBeNull()
    expect(r.weakest).toBeNull()
    expect(r.largestWeight).toBeNull()
    expect(r.currencySplit).toEqual([])
    expect(r.holdingCount).toBe(0)
    expect(r.accountCount).toBe(0)
  })

  it('ignores holdings with no computable return when ranking', () => {
    // A zero cost basis makes holdingPlPct null, which must not become 0
    // and win the weakest slot.
    const zeroCost = [
      { holding: h({ id: '1', ticker: 'FREE', avgCost: 0 }), price: 10 },
      { holding: h({ id: '2', ticker: 'CNQ' }), price: 90 },
    ]
    const r = portfolioHighlights(zeroCost, {})
    expect(r.weakest).toEqual({ ticker: 'CNQ', plPct: -10 })
    expect(r.strongest).toEqual({ ticker: 'CNQ', plPct: -10 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest --run src/utils/investments/portfolioHighlights.test.ts`
Expected: FAIL, cannot resolve `./portfolioHighlights`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/investments/portfolioHighlights.ts`:

```ts
// Everything the portfolio summary band shows, derived from holdings that
// are already in the store. Pure: no DOM, no store access, no fetching.

import type { Holding } from '../../store/usePortfolioStore'
import {
  allocationBreakdown, holdingPlPct, portfolioTotals,
  type FxRates, type PortfolioTotals,
} from './portfolioMetrics'

export interface Highlight {
  ticker: string
  plPct: number
}

export interface Weight {
  name: string
  pct: number
}

export interface PortfolioHighlights {
  totals: PortfolioTotals
  /** Best and worst by percentage return. A large position that crept up
   *  should not outrank a small one that doubled, so these rank on percent
   *  rather than dollars. Null when nothing has a computable return. */
  strongest: Highlight | null
  weakest: Highlight | null
  largestWeight: Weight | null
  currencySplit: Weight[]
  holdingCount: number
  accountCount: number
}

export function portfolioHighlights(
  rows: { holding: Holding; price: number }[],
  rates: FxRates,
): PortfolioHighlights {
  const ranked: Highlight[] = []
  for (const { holding, price } of rows) {
    const plPct = holdingPlPct(holding, price)
    // null means there is no cost basis to measure against. Letting that
    // fall through as 0 would hand it the weakest slot on a technicality.
    if (plPct === null) continue
    ranked.push({ ticker: holding.ticker, plPct })
  }
  ranked.sort((a, b) => b.plPct - a.plPct)

  const byHolding = allocationBreakdown(rows, rates, 'holding')
  const byCurrency = allocationBreakdown(rows, rates, 'currency')

  return {
    totals: portfolioTotals(rows, rates),
    strongest: ranked.length > 0 ? ranked[0] : null,
    weakest: ranked.length > 0 ? ranked[ranked.length - 1] : null,
    largestWeight: byHolding.length > 0 ? { name: byHolding[0].name, pct: byHolding[0].pct } : null,
    currencySplit: byCurrency.map((s) => ({ name: s.name, pct: s.pct })),
    holdingCount: rows.length,
    accountCount: new Set(rows.map((r) => r.holding.account)).size,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest --run src/utils/investments/portfolioHighlights.test.ts`
Expected: PASS, all six tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/investments/portfolioHighlights.ts src/utils/investments/portfolioHighlights.test.ts
git commit -m "feat(investments): derive the portfolio summary facts"
```

---

### Task 6: `PortfolioSummary`

The hero band. Headline value on the left at display scale, derived facts on the right. This component also takes over the two things the stat cards used to carry: the excluded-holdings warning with its retry button, and the PortfolioAnalyst account value.

**Files:**
- Create: `src/components/investments/PortfolioSummary.tsx`
- Test: `src/components/investments/PortfolioSummary.test.tsx`

**Interfaces:**
- Consumes: `portfolioHighlights` from Task 5.
- Produces:

```tsx
interface PortfolioSummaryProps {
  rows: { holding: Holding; price: number }[]
  rates: FxRates
  /** Exactly the shape accountValue() in report/reportMetrics.ts returns. */
  nav: { nav: number; cash: number | null; baseCurrency: string } | null
  /** Retries the exchange rate fetch when holdings were excluded. */
  onRetryRates: () => void
}
export const PortfolioSummary: React.FC<PortfolioSummaryProps>
```

Task 8 mounts it.

**Two labels are load-bearing and must be copied exactly.** `PortfolioView.test.tsx` already asserts on `Account Value (CAD)` and `Account Value (USD)` with a capital V, and on the cash sleeve via `/Cash -\$25,000/`. Keeping both means the whole existing "account value from the PortfolioAnalyst report" describe block survives this redesign untouched, which is worth more than tidier casing.

- [ ] **Step 1: Write the failing tests**

Create `src/components/investments/PortfolioSummary.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PortfolioSummary } from './PortfolioSummary'
import type { Holding } from '../../store/usePortfolioStore'

const h = (over: Partial<Holding>): Holding => ({
  id: 'h1', ticker: 'AAA', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA', ...over,
})

const rows = [
  { holding: h({ id: '1', ticker: 'VFV' }), price: 150 },
  { holding: h({ id: '2', ticker: 'CNQ', account: 'RRSP' }), price: 90 },
]

describe('PortfolioSummary', () => {
  it('leads with the holdings value and its all time delta', () => {
    render(<PortfolioSummary rows={rows} rates={{}} nav={null} onRetryRates={() => {}} />)
    // 1500 + 900 against a 2000 cost basis.
    expect(screen.getByText('$2,400')).toBeInTheDocument()
    expect(screen.getByText(/\+\$400/)).toBeInTheDocument()
    expect(screen.getByText(/\+20\.0%/)).toBeInTheDocument()
  })

  it('names the strongest and weakest holdings', () => {
    render(<PortfolioSummary rows={rows} rates={{}} nav={null} onRetryRates={() => {}} />)
    expect(screen.getByText('Strongest')).toBeInTheDocument()
    expect(screen.getByText(/VFV \+50\.0%/)).toBeInTheDocument()
    expect(screen.getByText('Weakest')).toBeInTheDocument()
    expect(screen.getByText(/CNQ -10\.0%/)).toBeInTheDocument()
  })

  it('shows the account value and its cash sleeve only when a report has been uploaded', () => {
    const { rerender } = render(<PortfolioSummary rows={rows} rates={{}} nav={null} onRetryRates={() => {}} />)
    expect(screen.queryByText(/^Account Value/)).not.toBeInTheDocument()
    rerender(
      <PortfolioSummary
        rows={rows}
        rates={{}}
        nav={{ nav: 5000, cash: -250, baseCurrency: 'CAD' }}
        onRetryRates={() => {}}
      />,
    )
    expect(screen.getByText('Account Value (CAD)')).toBeInTheDocument()
    expect(screen.getByText('$5,000')).toBeInTheDocument()
    expect(screen.getByText(/Cash -\$250/)).toBeInTheDocument()
  })

  it('omits the cash line when the report has no cash sleeve', () => {
    render(
      <PortfolioSummary
        rows={rows}
        rates={{}}
        nav={{ nav: 5000, cash: null, baseCurrency: 'USD' }}
        onRetryRates={() => {}}
      />,
    )
    expect(screen.getByText('Account Value (USD)')).toBeInTheDocument()
    expect(screen.queryByText(/Cash/)).not.toBeInTheDocument()
  })

  it('warns about excluded holdings and offers a retry', () => {
    const onRetryRates = vi.fn()
    // EUR has no rate, so this holding cannot be valued in CAD at all.
    const excluded = [...rows, { holding: h({ id: '3', ticker: 'ASML', currency: 'EUR' as const }), price: 100 }]
    render(<PortfolioSummary rows={excluded} rates={{}} nav={null} onRetryRates={onRetryRates} />)
    expect(screen.getByText(/1 holding left out of these totals/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry exchange rates' }))
    expect(onRetryRates).toHaveBeenCalledTimes(1)
  })

  it('says nothing about exclusions when every holding converts', () => {
    render(<PortfolioSummary rows={rows} rates={{}} nav={null} onRetryRates={() => {}} />)
    expect(screen.queryByText(/left out of these totals/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest --run src/components/investments/PortfolioSummary.test.tsx`
Expected: FAIL, cannot resolve `./PortfolioSummary`.

- [ ] **Step 3: Write the component**

Create `src/components/investments/PortfolioSummary.tsx`:

```tsx
import React from 'react'
import type { Holding } from '../../store/usePortfolioStore'
import type { FxRates } from '../../utils/investments/portfolioMetrics'
import { portfolioHighlights } from '../../utils/investments/portfolioHighlights'
import { formatMoney } from '../planner/format'
import { pct } from './holdingMetrics'

interface PortfolioSummaryProps {
  rows: { holding: Holding; price: number }[]
  rates: FxRates
  /** PortfolioAnalyst ending NAV, when a report has been uploaded. It used
   *  to be a fourth stat card, which meant uploading a report changed the
   *  page's column count. It is a fact row here instead. The shape matches
   *  accountValue() in report/reportMetrics.ts exactly. */
  nav: { nav: number; cash: number | null; baseCurrency: string } | null
  onRetryRates: () => void
}

interface Fact {
  label: string
  value: string
  /** Second line under the value, for the account value's cash sleeve. */
  sub?: string
  tone?: string
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ rows, rates, nav, onRetryRates }) => {
  const h = portfolioHighlights(rows, rates)
  const { totals } = h
  const up = totals.plCad >= 0

  const facts: Fact[] = [
    { label: 'Total invested', value: formatMoney(totals.investedCad) },
  ]
  // "Account Value" keeps its capital V: PortfolioView's existing report
  // tests assert on that exact string, and they are still correct tests.
  if (nav) {
    facts.push({
      label: `Account Value (${nav.baseCurrency})`,
      value: formatMoney(nav.nav),
      sub: nav.cash !== null ? `Cash ${formatMoney(nav.cash)}` : undefined,
    })
  }
  if (h.strongest) facts.push({ label: 'Strongest', value: `${h.strongest.ticker} ${pct(h.strongest.plPct)}`, tone: 'text-accent' })
  if (h.weakest) facts.push({ label: 'Weakest', value: `${h.weakest.ticker} ${pct(h.weakest.plPct)}`, tone: h.weakest.plPct >= 0 ? 'text-accent' : 'text-error' })
  if (h.largestWeight) facts.push({ label: 'Largest weight', value: `${h.largestWeight.name} ${h.largestWeight.pct.toFixed(1)}%` })
  if (h.currencySplit.length > 0) {
    facts.push({
      label: 'Currency split',
      value: h.currencySplit.map((c) => `${c.name} ${c.pct.toFixed(0)}%`).join(' / '),
    })
  }
  facts.push({ label: 'Holdings', value: `${h.holdingCount} in ${h.accountCount} account${h.accountCount === 1 ? '' : 's'}` })

  return (
    <div className="themed-card rounded-lg p-5 desktop:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center">
        <div>
          <p className="text-[12px] uppercase text-text-secondary">Holdings Value (CAD)</p>
          <p className="text-[36px] desktop:text-[44px] font-semibold text-text-primary tabular-nums leading-none mt-2">
            {formatMoney(totals.valueCad)}
          </p>
          <p className={`text-[14px] font-medium tabular-nums mt-3 ${up ? 'text-accent' : 'text-error'}`}>
            {up ? '▲' : '▼'} {formatMoney(totals.plCad)}
            {totals.plPct !== null ? ` · ${pct(totals.plPct)} all time` : ''}
          </p>
          {totals.excludedCount > 0 && (
            <p className="text-[13px] text-error mt-2">
              {totals.excludedCount} holding{totals.excludedCount === 1 ? '' : 's'} left out of these totals: no exchange rate for {totals.excludedCount === 1 ? 'its' : 'their'} currency.{' '}
              <button
                type="button"
                onClick={onRetryRates}
                className="border control-border rounded px-1.5 py-0.5 text-[12px] hover:text-error/80 hover:border-error/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Retry exchange rates
              </button>
            </p>
          )}
        </div>
        <dl className="flex flex-col">
          {facts.map((f) => (
            <div key={f.label} className="flex justify-between items-baseline gap-4 py-2 border-b border-border last:border-b-0">
              <dt className="text-[11px] uppercase tracking-wide text-text-secondary">{f.label}</dt>
              <dd className="text-right">
                <span className={`block text-[13px] font-medium tabular-nums ${f.tone ?? 'text-text-primary'}`}>{f.value}</span>
                {f.sub && <span className="block text-meta text-text-secondary tabular-nums">{f.sub}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest --run src/components/investments/PortfolioSummary.test.tsx`
Expected: PASS, all five tests green.

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: PASS. 1321 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/investments/PortfolioSummary.tsx src/components/investments/PortfolioSummary.test.tsx
git commit -m "feat(investments): add the portfolio summary band"
```

---

### Task 7: `AllocationBars`

Three stacked 100% bars, holding, account and currency, all visible at once. No toggle, no chart library. Segment names and percentages live in a text row beneath each bar, never inside the coloured segments.

**Files:**
- Create: `src/components/investments/AllocationBars.tsx`
- Test: `src/components/investments/AllocationBars.test.tsx`

**Interfaces:**
- Consumes: `allocationBreakdown`, `FxRates` from `../../utils/investments/portfolioMetrics`; `sliceColor` from `../../utils/chartTheme`.
- Produces:

```tsx
interface AllocationBarsProps {
  rows: { holding: Holding; price: number }[]
  rates: FxRates
}
export const AllocationBars: React.FC<AllocationBarsProps>
```

Task 8 mounts it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/investments/AllocationBars.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AllocationBars } from './AllocationBars'
import type { Holding } from '../../store/usePortfolioStore'

const h = (over: Partial<Holding>): Holding => ({
  id: 'h1', ticker: 'AAA', quantity: 1, avgCost: 100, currency: 'CAD', account: 'RRSP', ...over,
})

const rows = [
  { holding: h({ id: '1', ticker: 'ENB', account: 'RRSP' }), price: 100 },
  { holding: h({ id: '2', ticker: 'AAPL', currency: 'USD' as const, account: 'TFSA' }), price: 100 },
]

describe('AllocationBars', () => {
  it('shows all three cuts at once, with no toggle', () => {
    render(<AllocationBars rows={rows} rates={{ USD: 1.37 }} />)
    expect(screen.getByText('Holding')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Currency')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^By / })).not.toBeInTheDocument()
  })

  it('names every segment in text, not only in colour', () => {
    render(<AllocationBars rows={rows} rates={{ USD: 1.37 }} />)
    for (const name of ['ENB', 'AAPL', 'RRSP', 'TFSA', 'CAD', 'USD']) {
      expect(screen.getByText(new RegExp(`${name} \\d`))).toBeInTheDocument()
    }
  })

  it('gives each bar an accessible name carrying its breakdown', () => {
    render(<AllocationBars rows={rows} rates={{ USD: 1.37 }} />)
    expect(screen.getByRole('img', { name: /Allocation by holding/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Allocation by account/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Allocation by currency/ })).toBeInTheDocument()
  })

  it('renders nothing with no rows', () => {
    const { container } = render(<AllocationBars rows={[]} rates={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest --run src/components/investments/AllocationBars.test.tsx`
Expected: FAIL, cannot resolve `./AllocationBars`.

- [ ] **Step 3: Write the component**

Create `src/components/investments/AllocationBars.tsx`:

```tsx
import React from 'react'
import type { Holding } from '../../store/usePortfolioStore'
import {
  allocationBreakdown, type AllocationBy, type AllocationSlice, type FxRates,
} from '../../utils/investments/portfolioMetrics'
import { formatMoney } from '../planner/format'
import { sliceColor } from '../../utils/chartTheme'

interface AllocationBarsProps {
  rows: { holding: Holding; price: number }[]
  rates: FxRates
}

const CUTS: { by: AllocationBy; label: string }[] = [
  { by: 'holding', label: 'Holding' },
  { by: 'account', label: 'Account' },
  { by: 'currency', label: 'Currency' },
]

/** One 100% stacked bar plus its own text row.
 *
 *  No label sits inside a segment. Several --chart-* tokens are mid-tone
 *  and clear 4.5:1 against neither white nor black across the six themes,
 *  so text on a segment would be a contrast problem to solve six times
 *  over. Naming the segments underneath sidesteps it, and doubles as the
 *  non-colour channel the bar itself cannot provide. */
const Bar: React.FC<{ label: string; by: AllocationBy; slices: AllocationSlice[] }> = ({ label, by, slices }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-text-secondary">{label}</span>
    </div>
    <div
      role="img"
      aria-label={`Allocation by ${by}: ${slices.map((s) => `${s.name} ${s.pct.toFixed(1)}%`).join(', ')}`}
      className="flex h-4 w-full gap-px overflow-hidden rounded"
    >
      {slices.map((s, i) => (
        <span key={s.name} className="h-full" style={{ width: `${s.pct}%`, backgroundColor: sliceColor(i) }} />
      ))}
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {slices.map((s, i) => (
        <span key={s.name} className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: sliceColor(i) }} aria-hidden="true" />
          <span className="tabular-nums">{s.name} {s.pct.toFixed(1)}% &middot; {formatMoney(s.valueCad)}</span>
        </span>
      ))}
    </div>
  </div>
)

export const AllocationBars: React.FC<AllocationBarsProps> = ({ rows, rates }) => {
  if (rows.length === 0) return null
  const cuts = CUTS.map((c) => ({ ...c, slices: allocationBreakdown(rows, rates, c.by) }))
  if (cuts.every((c) => c.slices.length === 0)) return null

  return (
    <div className="themed-card rounded-lg p-4 flex flex-col gap-4">
      <h3 className="text-[14px] font-semibold text-text-primary">Allocation</h3>
      {cuts.map((c) => (
        <Bar key={c.by} label={c.label} by={c.by} slices={c.slices} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest --run src/components/investments/AllocationBars.test.tsx`
Expected: PASS, all four tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/investments/AllocationBars.tsx src/components/investments/AllocationBars.test.tsx
git commit -m "feat(investments): add the three cut allocation bars"
```

---

### Task 8: Wire the hero and bars into the page, retire the donut

**Files:**
- Modify: `src/components/investments/PortfolioView.tsx`
- Delete: `src/components/investments/AllocationChart.tsx`
- Delete: `src/components/investments/AllocationChart.test.tsx`
- Modify: `e2e/desktop-guards.spec.ts`
- Test: `src/components/investments/PortfolioView.test.tsx`

**Interfaces:**
- Consumes: `PortfolioSummary` from Task 6, `AllocationBars` from Task 7.
- Produces: the finished page. Nothing downstream.

- [ ] **Step 1: Write the failing test**

Append to `src/components/investments/PortfolioView.test.tsx`:

```tsx
describe('portfolio page composition', () => {
  beforeEach(() => {
    installMatchMedia()
    usePortfolioStore.setState({
      holdings: [
        { id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA' },
      ],
      importedAt: new Date().toISOString(),
      currencyReviewPending: false,
    })
    useMarketDataStore.setState({ quotes: {}, overrides: {} })
  })

  it('leads with the summary band and shows all three allocation cuts', async () => {
    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    expect(await screen.findByText('Holdings Value (CAD)')).toBeInTheDocument()
    expect(screen.getByText('Total invested')).toBeInTheDocument()
    expect(screen.getByText('Holding')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Currency')).toBeInTheDocument()
  })

  it('no longer offers the allocation mode toggle', async () => {
    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    await screen.findByText('Holdings Value (CAD)')
    expect(screen.queryByRole('button', { name: 'By holding' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'By account' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'By currency' })).not.toBeInTheDocument()
  })

  it('no longer shows the separate Total Invested stat card', async () => {
    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    await screen.findByText('Holdings Value (CAD)')
    expect(screen.queryByText('Total Invested (CAD)')).not.toBeInTheDocument()
    expect(screen.queryByText('Total P/L')).not.toBeInTheDocument()
  })
})
```

Reuse whatever imports that file already has; add any of `installMatchMedia`, `useMarketDataStore`, `MemoryRouter` that are missing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest --run src/components/investments/PortfolioView.test.tsx`
Expected: FAIL, three new tests red. The composition test cannot find `Total invested`; the other two find the toggle and the old cards still present.

- [ ] **Step 3: Swap the components in**

In `src/components/investments/PortfolioView.tsx`, replace the `AllocationChart` import with the two new ones:

```ts
import { AllocationBars } from './AllocationBars'
import { PortfolioSummary } from './PortfolioSummary'
```

Then replace the whole stat card grid, meaning the `<div className={\`grid grid-cols-1 gap-4 ${nav ? ... }\`}>` block and everything inside it through its closing `</div>`, with:

```tsx
          <PortfolioSummary rows={rows} rates={rates} nav={nav} onRetryRates={() => fx.refresh()} />
```

and replace:

```tsx
          <AllocationChart rows={rows} rates={rates} />
```

with:

```tsx
          <AllocationBars rows={rows} rates={rates} />
```

The `nav` const, the `totals` const and everything below the allocation block stay as they are. `totals.valueCad` is still needed for each `HoldingRow`'s `totalValueCad` prop.

- [ ] **Step 4: Delete the donut**

```bash
git rm src/components/investments/AllocationChart.tsx src/components/investments/AllocationChart.test.tsx
```

- [ ] **Step 5: Drop the Portfolio route from the chart guard**

In `e2e/desktop-guards.spec.ts`, delete this entry from `CHART_ROUTES`:

```ts
  // AllocationChart (Pie), behind the Investments Portfolio tab.
  {
    path: '#/investments',
    afterNav: async (page) => {
      await page.getByRole('tab', { name: 'Portfolio' }).click()
    },
  },
```

That guard asserts every listed route renders at least one `.recharts-wrapper`, deliberately failing loud on a route that renders none. The Portfolio tab now renders no chart at all, so the entry has to go rather than be left to fail. The allocation bars are plain divs, so there is no `ChartFigure` and nothing focusable to guard.

- [ ] **Step 6: Run the view tests to verify they pass**

Run: `npx vitest --run src/components/investments/PortfolioView.test.tsx`
Expected: PASS.

- [ ] **Step 7: Update the one existing assertion that the stat cards owned**

`src/components/investments/PortfolioView.test.tsx:115`, inside `it('says nothing about exclusions when every currency resolves')`, waits on a label that no longer exists:

```tsx
    expect(await screen.findByText('Total Invested (CAD)')).toBeInTheDocument()
```

Change it to wait on the summary band's headline label instead, which serves the same purpose of letting the async render settle before the negative assertion:

```tsx
    expect(await screen.findByText('Holdings Value (CAD)')).toBeInTheDocument()
```

Nothing else in that file needs changing. The `account value from the PortfolioAnalyst report` describe block asserts on `Account Value (CAD)`, `Account Value (USD)`, `$118,000` and `/Cash -\$25,000/`, all of which `PortfolioSummary` reproduces deliberately.

- [ ] **Step 8: Run the full suite**

Run: `npm test -- --run`
Expected: PASS. The four `AllocationChart.test.tsx` tests are gone with the file, so the count is 1321 minus 4 plus 3 new, which is 1320. Any other test that still asserts on the donut or its legend must be updated to the new composition, not deleted.

- [ ] **Step 9: Run lint, types and the bundle guards**

Run: `npm run lint && npx tsc -b && npm run build && npm run check:bundle && npm run check:eager && npm run check:type-scale`
Expected: all clean. The entry chunk should not grow; recharts is now one import lighter on this route.

- [ ] **Step 10: Run the e2e suite**

Run: `npm run e2e`
Expected: PASS, 149 tests. If `every chart has an accessible name` fails reporting a route with zero charts, the `CHART_ROUTES` entry was not fully removed.

- [ ] **Step 11: Commit**

Stage explicit paths, including the two deletions. Never `git add -A`.

```bash
git add src/components/investments/PortfolioView.tsx src/components/investments/PortfolioView.test.tsx src/components/investments/AllocationChart.tsx src/components/investments/AllocationChart.test.tsx e2e/desktop-guards.spec.ts
git commit -m "feat(investments): replace the stat cards and donut with the summary band and allocation bars"
```

The two `AllocationChart` paths were already removed by `git rm` in Step 4; naming them here is harmless and keeps the staging explicit.

---

## Verification

After Task 8, confirm against the mockup at `docs/superpowers/mockups/2026-08-27-portfolio-registers.html`, register D:

- [ ] The page leads with one summary band, not three cards.
- [ ] All three allocation cuts are visible at once with no toggle.
- [ ] The holdings table shows six columns; Avg Cost and Book appear only when a row is opened.
- [ ] Every row starts collapsed after a reload.
- [ ] The excluded-holdings warning and its retry button still appear when a holding has no rate.
- [ ] Uploading a PortfolioAnalyst report adds an Account value row to the hero rather than a fourth card.
- [ ] Check the page in all six themes. No text sits on a coloured bar segment.
