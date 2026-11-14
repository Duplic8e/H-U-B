# Forecaster Fixes: Goal Dates, Chart Boxes, After-Tax Comp Events, Stacked View

Date: 2026-07-17. Status: approved by Mishat (via brainstorming Q&A).
Scope: `src/components/planner/forecaster/*`, `src/utils/finance/*`.

## Goals

1. Show projected goal dates inside the Goals card (and event dates inside
   Life Events) instead of loose text below, removing the empty-looking space.
2. Fix the Monte Carlo chart card: y-axis labels clipped, footnote overflowing
   outside the card border.
3. Apply a tax haircut to auto-fed comp event lump sums (RSU, bonus, ESPP),
   configurable between auto marginal rate and a manual flat percent.
4. Fix the Contributions vs Growth stacked view: respect the Real toggle,
   anchor the "today" label, fix y-axis clipping. Band structure stays as-is
   (starting balance remains inside Contributed; decision locked).

## Decisions (locked during brainstorming)

- Tax model: marginal-rate haircut per lump, not precise incremental tax.
- Rate is configurable: Auto (marginal rate from canadaTax) or Manual flat
  percent, defaulting to 50 when switching to manual.
- Stacked view keeps two bands (option C from mockups): Contributed includes
  starting balance; Growth is the remainder. Only correctness/label fixes.
- Compact money formatter ($1.2M, $500k) is shared by both forecaster charts.

## 1. Goal and event dates inside ListEditor cards

`ListEditor` gains an optional `renderExtra?: (item: T) => React.ReactNode`
prop rendered as a read-only cell in each row grid (styled like a label +
static value, no input).

- `ForecasterTool` passes for Goals: "Projected: {formatMonthsOut(month)}"
  computed per row as `monthsToReach(points, item.amount)` (no lookup into
  `goalMarkers`, which can collide on duplicate labels).
- For Life Events: the resolved calendar date computed from `yearsFromNow`
  (same `formatMonthsOut` formatting).
- The loose `goalMarkers.map(<p>...)` block below the Goals card is removed.
- The Goals column wrapper `flex flex-col gap-3` is no longer needed; both
  grid cells render the ListEditor card directly.

## 2. Monte Carlo chart card layout

In `MonteCarloSection`:

- Card div drops `h-[300px]`; inside it, the chart sits in a wrapper div with
  `h-[300px]`, and the footnote `<p>` follows inside the card padding.
- Y-axis uses the shared compact formatter and keeps `width={72}` (compact
  labels fit comfortably; widen only if a test render shows clipping).

## 3. After-tax comp events

### Shared helper

New `src/utils/finance/compTax.ts` (or added to compFeed.ts if trivial):
`applyLumpTax(lumps: LumpSum[], rate: number): LumpSum[]` returning lumps
with `amount * (1 - rate)`. Applies only to auto-fed comp lumps, never to
manual life events.

### Rate resolution (auto mode)

- `income`: saved Salary & Tax input (`usePlannerStore` inputs for tool id
  `salary-tax`, key `income`); fallback: base salary from the active
  compensation package; fallback 0.
- `province`: saved Salary & Tax province input; fallback `'ON'`.
- Rate = `marginalRate(income, province)` from `utils/finance/canadaTax`.

### Settings and UI

New persisted forecaster settings (in `useForecasterSettings`):

- `compTaxEnabled: boolean` (default true)
- `compTaxAuto: boolean` (default true)
- `compTaxManualPct: number` (default 50)

UI sits with the existing Comp Events / Debt Drag controls: a toggle button
"After-Tax Comp Events" and, when enabled, an AutoField-style control that
shows the auto marginal rate (hint "Marginal ({province})") or a manual
percent input. Caveat line under the controls: "Comp events taxed at your
marginal rate; RSU/ESPP treated as employment income."

Monte Carlo inherits the taxed lumps automatically because it consumes the
same `lumps` array.

## 4. Contributions vs Growth stacked view

In `ForecastChart` / `forecast.ts`:

- `buildForecast` exposes the deflator per point (or equivalently emits
  `contributedReal` and `growthReal`); when `showReal` is on the stacked view
  plots deflated `contributed` and `growth` so the stack total matches the
  Real projected line.
- `today` ReferenceLine label gets `position: 'insideTopLeft'` so it no
  longer floats mid-chart.
- Y-axis uses the shared compact money formatter (fixes the clipped top tick).
- The `Math.max(0, growth)` clamp stays for the plotted band; the tooltip
  formatter uses the unclamped value.

## Shared utility

`formatMoneyCompact(v: number): string` in `src/components/planner/format.ts`:
`$1.2M`, `$500k`, `$0`, negative-safe. Used by both forecaster charts' y-axes.

## Testing

- Unit: `formatMoneyCompact` edge cases; `applyLumpTax`; real-mode
  contributed/growth deflation in `buildForecast` output.
- Component: ForecasterTool tests updated for the new tax controls and the
  goal-date rows inside the card.

## Out of scope

Precise incremental tax (totalIncomeTax deltas), taxing manual life events,
three-band stacked view, US tax support, chart redesigns.
