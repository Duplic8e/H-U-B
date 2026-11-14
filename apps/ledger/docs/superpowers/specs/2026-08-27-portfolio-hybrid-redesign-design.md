# Portfolio Tab Hybrid Redesign

**Date:** 2026-08-27
**Status:** Approved design, ready for planning
**Mockups:** `docs/superpowers/mockups/2026-08-27-portfolio-registers.html` (register D)

## Goal

Make the Investments Portfolio tab look richer without fetching any new data. Every figure the redesign introduces is derived from holdings already in `usePortfolioStore` plus rates already resolved by `useFxRates`.

The chosen register is **D, Hybrid**: the editorial split hero, the instrument three-bar allocation block, and the editorial six-column holdings table with a per-row disclosure.

## Scope

**In scope**

- Replace the three stat cards with one summary band (headline value plus derived facts).
- Replace the donut and its mode toggle with three stacked allocation bars shown together.
- Reduce the holdings table from eight columns to six, moving Avg Cost and Book into a per-row disclosure.
- Mirror the disclosure treatment in the mobile card view.

**Out of scope**

- Any new network call, any time series, any day change figure. There is no price history in the store to draw one from and adding one is a separate piece of work.
- Account grouping. Holdings stay grouped by broker account in the same order.
- `PortfolioReport`, the import sheet, the footer FX line, and the Clear portfolio control. All unchanged.
- Trades, Options, and Plan vs Actual tabs.

## Prerequisite: the override currency bug

`getCurrentPrice` in `src/services/marketData/marketDataService.ts:59` stamps every manual price override with `currency: 'USD'`. `HoldingRow` then converts that price into the holding's own currency, so a CAD holding with a manual price is multiplied by the USD/CAD rate.

Measured with eight seeded holdings: the Portfolio tab reports $112,582 where the correct total is $93,394. Only the all-USD account (RRSP) reads correctly.

`PortfolioRollupWidget` already applies the correct rule and documents it: an override is entered in the holding's own currency and is trusted with no conversion.

**This is fixed first, in its own commit, before any visual work.** Every number the new hero and allocation bars display is one of the numbers this bug corrupts, so shipping the redesign first would make a wrong total more prominent. `portfolioTotalsParity.test.tsx` is the home for the RED test. No existing test pins the `'USD'` value, so the change is unblocked.

## Architecture

### New pure module

`src/utils/investments/portfolioHighlights.ts`

```
highlights(rows, rates) -> {
  investedCad, valueCad, plCad, plPct,
  strongest: { ticker, plPct } | null,
  weakest:   { ticker, plPct } | null,
  largestWeight: { ticker, pct } | null,
  currencySplit: { currency, pct }[]
}
```

No DOM, no store access, fully unit testable. `strongest` and `weakest` rank on `holdingPlPct`, not dollar P/L, so a small position that doubled outranks a large one that crept up. Both are null when there are no holdings.

The currency split and largest weight come straight from `allocationBreakdown`, which already supports `'holding' | 'account' | 'currency'`. **No new allocation math is needed for any of the three bars.**

### New components

`src/components/investments/PortfolioSummary.tsx`
The hero band. Headline Holdings Value at display scale on the left, a definition list of derived facts on the right. Consumes `highlights()`.

`src/components/investments/AllocationBars.tsx`
Three stacked 100% bars labelled Holding, Account, Currency, each built from `allocationBreakdown` with `sliceColor` from `chartTheme`, plus a chip row naming the account and currency segments. Plain divs, no recharts.

### Modified

- `PortfolioView.tsx`: header block swapped for `PortfolioSummary`, `AllocationChart` swapped for `AllocationBars`.
- `HoldingRow.tsx`: becomes a two-state component. Six cells plus a disclosure button; Avg Cost, Book, return, and price source move into a detail `<tr>`.
- `HoldingCard.tsx`: same demotion in the mobile grid, disclosure below the visible pairs.

### Removed

- `AllocationChart.tsx` and `AllocationChart.test.tsx`. `PortfolioView` is its only consumer, confirmed by grep.

## Sorting

The four sortable keys today are `ticker`, `value`, `pl`, and `alloc`. Avg Cost and Book are both `key: null`, so demoting them removes no sort affordance and `sortRows` is untouched.

## Theming and contrast

Six themes must hold. Two constraints carried from building the mockups:

- **No text sits on a chart colour.** The stacked bar segments carry no labels; names and percentages sit in a chip row underneath. This was learned the hard way: the treemap explored for register C put labels on slices, and the mid-tone olive, amber, and mint tokens clear 4.5:1 against neither white nor black. Keeping text off the colour sidesteps the problem entirely rather than solving it six times.
- Every colour comes from an existing token. No new palette values.

## Disclosure behaviour

Every row starts collapsed. State is local to the row, held in component state, and is not persisted or lifted: reloading the page or switching tabs returns every row to collapsed. Rows open independently, so any number may be open at once. The mockup shows VFV open only to illustrate the detail row.

## Accessibility

- The disclosure is a real `<button>` carrying `aria-expanded` and `aria-controls` pointing at the detail row's id.
- The detail row is a `<tr>` with a `<td colspan>`, so table semantics stay intact for the existing header-semantics guard.
- The allocation block gets a group label and a text summary equivalent to what the donut's `ChartFigure` label provided, so the information stays available to a screen reader after the chart is gone.
- Bars are decorative relative to the chip row, which carries the same figures as text.

## Testing

- `portfolioHighlights.test.ts`: strongest and weakest ranking including the ties and empty cases, currency split summing to 100, null handling.
- `PortfolioSummary.test.tsx`: renders each derived fact; renders nothing rather than a zero row when there are no holdings.
- `AllocationBars.test.tsx`: three bars present, segment count per mode, chip row text matches the underlying percentages.
- `HoldingRow.test.tsx` and `HoldingCard.test.tsx`: extend for the two states; assert Avg Cost and Book are absent when collapsed and present when expanded, and that `aria-expanded` tracks state.
- `portfolioTotalsParity.test.tsx`: gains the override currency case from the prerequisite.
- **`e2e/desktop-guards.spec.ts`: remove the Investments Portfolio entry from `CHART_ROUTES`.** That guard asserts every listed route renders at least one `.recharts-wrapper`, and the entry exists solely for AllocationChart's Pie. With no chart on the route, the entry must go or the guard fails by design. No new chart plumbing is required, because the bars are not charts.

## Delivery order

The two halves are independent and carry independent risk, so they land separately rather than through one review.

1. **Phase 0.** Override currency fix, with its RED test. Own commit.
2. **Phase 1.** Table half: `HoldingRow` and `HoldingCard` two-state, column demotion. Stands alone; the page keeps its donut and stat cards throughout.
3. **Phase 2.** Hero and allocation half: `portfolioHighlights`, `PortfolioSummary`, `AllocationBars`, removal of `AllocationChart`, `CHART_ROUTES` edit.

## Constraints

- No em dashes in source, comments, test names, or user-facing copy.
- Never edit a value in `STORAGE_KEYS`.
- No version series in test assertions.
- Full suite via `npm test -- --run`. Every phase ends green with its own commit.
- Baseline at spec time: 1296 unit tests, 149 e2e, eslint clean, tsc clean, all three bundle guards passing.
