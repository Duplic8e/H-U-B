# Ledger UI Polish & Planner Enhancements — Design

Date: 2026-07-05
Status: Approved pending user spec review

## Overview

Twelve workstreams covering spacing/alignment debugging, theme fixes, planner tool
enhancements, budgeting layout changes, themed input components, an investments
plan-vs-actual rebuild with swap simulation, and a UX consistency pass.

Executed as one phased implementation plan. Foundations (themed inputs, shared
layout primitives) land first because later workstreams touch the same components.

## W0 — Spacing & alignment debug pass

Root causes identified from the marked-up screenshots:

- **Planner hub voids** ([Planner.tsx](../../../src/pages/Planner.tsx)): tool cards
  render inside the 3-column `BentoGrid`, so groups with 1-2 tools leave large empty
  regions. Fix: the Planner page gets its own responsive grid where cards stretch to
  fill the row (2 tools = two half-width cards, 1 tool = full width). `BentoGrid`
  itself is unchanged (Dashboard still uses it).
- **FIRE forecaster "Scenario spread" suffix wrap**
  ([CalculatorField.tsx](../../../src/components/planner/CalculatorField.tsx)): the
  `± %` suffix wraps vertically. Fix: `whitespace-nowrap shrink-0` on prefix/suffix
  spans. Normalize the forecaster's header input rows to one consistent grid.
- **Input rows with dead space** (Savings Goal, Salary & Tax, Debt Payoff): rows use
  `grid-cols-2 md:grid-cols-4` with fewer fields than columns. Fix: a shared
  `ToolInputGrid` convention where inputs stretch to fill the available row width;
  result cards align to the same grid. Debt Payoff delete button aligns flush with
  the end of each debt row instead of floating mid-void.

Methodology: run the dev server, reproduce each circled issue with the preview
tools, fix in shared components first, then per-tool. Verify every planner tool at
desktop and narrow widths with screenshots before closing the workstream.

## W1 — Geometric Light theme selector icon

[ThemeSelector.tsx](../../../src/components/theme/ThemeSelector.tsx) uses hard-coded
`bg-white`, `text-gray-*`, and `dark:` utilities, so the active pill is invisible on
light backgrounds. Replace with theme CSS variables (`text-text-primary`,
`bg-bg-secondary`, accent ring on the active pill) so all five themes render a
visible active state. Verify on each theme in the preview.

## W2 — Remove Compensation from Dashboard

Remove the `comp` entry from `DASHBOARD_WIDGET_IDS` and the widgets array in
[Dashboard.tsx](../../../src/pages/Dashboard.tsx). Stored layouts already filter
unknown ids, so persisted widget orders survive. Delete `CompSnapshotWidget` if no
other consumer exists. The Compensation page itself is untouched.

## W3 — Planner tool info popovers

Extend `toolRegistry` entries with
`info: { howTo: string; params: Array<{ name: string; description: string }> }`
written for all planner tools (definitions for Scenario spread, Contribution
step-up, GDS ratio, withdrawal rate, etc.). New `ToolInfoButton`: an (i) icon next
to the ToolSwitcher title that opens a themed popover panel with the how-to text and
a parameter glossary. Dismiss on click-away or Escape. The popover uses the standard
overlay treatment from W5.

## W4 — Budgeting layout

- Swap `SankeyWidget` (Income Flow) and `BudgetProgressWidget` (Budget vs Actual)
  positions in [Budgeting.tsx](../../../src/pages/Budgeting.tsx): Budget vs Actual
  takes the first slot, Income Flow takes the last.
- Budget Setup (`CategoryManagerWidget`) becomes collapsible: chevron toggle in its
  header, collapsed by default, state persisted in the budget store.

## W5 — Unified popup overlay treatment (app-wide)

Every popup, dropdown menu, and popover gets the CompensationModal treatment: a
`fixed inset-0` backdrop with `bg-black/50 backdrop-blur-md`, content raised above
it in focus. Applies to: ToolSwitcher menu, ThemedSelect menus (W8), ThemedDatePicker
calendar (W8), ToolInfoButton popover (W3), and all existing modals. Implemented as
a shared `OverlayBackdrop` component so the treatment stays consistent. Clicking the
backdrop closes the popup.

Note: lightweight hover tooltips are exempt; the blur applies to click-opened
surfaces.

## W6 — Salary & Tax: RRSP/FHSA deductions; remove RRSP vs TFSA tool

- Delete the RRSP vs TFSA tool: registry entry, route, component, and the unused
  `rrspVsTfsa` finance utils and tests. Saved inputs for the removed tool remain
  harmlessly in the planner store.
- Add "RRSP contribution" and "FHSA contribution" fields to
  [SalaryTaxTool.tsx](../../../src/components/planner/SalaryTaxTool.tsx). Both
  reduce taxable income before the tax calculation. New result cards: tax savings
  from contributions, and adjusted net income. Caption notes contribution limits
  (RRSP 18% of income up to the annual max; FHSA $8,000/yr).
- **Bracket visual redesign**: the current `BracketBar` segments are hard to tell
  apart. Redesign so each bracket is clearly separable: distinct segments with
  visible gaps, per-segment rate and income-range labels, and an unambiguous
  filled-vs-unfilled treatment for the portion of income inside each bracket.
- Tax math changes are test-driven (extend `canadaTax` tests).

## W7 — Mortgage extra payments

In the Payment tab of
[MortgageCalculator.tsx](../../../src/components/planner/MortgageCalculator.tsx), a
list editor of extra-payment entries. Each entry is one of:

- **Recurring monthly extra** with a from-to year range (e.g. +$500/mo, years 1-5)
- **One-time lump sum** at a given year

Extend the amortization utility to apply the extra-payment schedule. Results:
interest saved, new payoff date, and a baseline-vs-extras balance chart. The
amortization math is test-driven.

## W8 — Themed Select & DatePicker (foundation)

Native `<select>` and `<input type="date">` popups are OS-rendered and cannot match
themes. Build:

- **ThemedSelect**: listbox styled like the ToolSwitcher menu (themed card, accent
  highlight on the active option, keyboard navigation, ARIA listbox semantics).
- **ThemedDatePicker**: custom month-grid calendar popover using theme variables,
  with month/year navigation.

Both use the W5 overlay treatment when open. Swap all native selects (SelectField
internals, Debt Payoff strategy, Savings Goal solve-for, Salary & Tax province,
Compensation modal fields) and date inputs (Compensation modal dates, transaction
modal). A full grep for `<select` and `type="date"` during implementation catches
stragglers.

## W9 — Investments: fund-level plan vs actual with swap simulation

Evolve the existing analysis model (keep the store and existing data; migrate) to
match the spreadsheet workflow:

- **Plan side**: total fund amount, per-ticker allocation % (plus per-ticker extra $
  outside the allocation), auto-derived initial investment, start price on the
  analysis date, shares bought, current price, current value, return $ and %.
  Fund-level summary: start date, initial fund, extra fund, total fund, current
  value, total return.
- **Actual side**: per-ticker initial investment, extra investment, start price,
  average price, shares bought, current price, current value, return $ and %. Same
  fund-level summary computed from actual lots.
- **Swap simulator (multiple swaps)**: per analysis, a list of hypothetical swaps on
  both Plan and Actual sides. Each swap: choose a held ticker to swap out, enter a
  swap-in ticker; the simulator recomputes as if that position's money had bought
  the swap-in ticker at its start-date price. Shows original return, new return, and
  difference per swap. Historical start prices auto-fetched via the market data
  service with manual fallback.
- **Presentation**: themed table views (Plan table and Actual table) with the fund
  summary header above each, matching the app aesthetic rather than the spreadsheet
  look. Live prices via the existing market data store, overrides respected.
- Return/derivation math is test-driven.

## W10 — Budgeting widget consistency

- **Income/Expense "This month" label**: IncomeWidget stacks the label under the
  amount; ExpenseWidget puts it beside the amount on the baseline. Standardize both
  on the Expense style (amount with label beside it).
- **Month-End Forecast merge**: remove `CashFlowForecastWidget`. Add a single
  **Projected Net** line to `MonthlySummaryWidget`, styled to match its existing
  rows (Money In, Money Out, Net Change), with pending recurring items available on
  hover/expand. The `forecastMonthEnd` and `detectRecurring` utils are kept.

## W11 — UX consistency pass

1. **Numbers and typography**: shared `Stat` component for big-number displays;
   `formatMoney` everywhere (replacing raw `$x.toFixed(2)`); theme error color
   instead of `text-red-500`; consistent page header sizing.
2. **Budgeting page tabs**: reorganize the 12-widget scroll into tabs — Overview
   (summary cards, budget vs actual, income flow), Insights (heatmap, trends,
   subscriptions, anomalies), Transactions (list, triage inbox), Setup (budget
   setup, categorization rules, category manager). W4's swap and collapse rules
   apply within the new Overview/Setup tabs.
3. **Empty states and loading**: one `EmptyState` component (icon, message,
   call-to-action) used consistently; skeleton shimmer while market data loads.
4. **Copy pass**: remove em dashes from all user-facing descriptions and captions,
   rewording where needed.

## Phasing

1. **Foundations**: W8 themed inputs, W5 overlay backdrop, CalculatorField/grid
   primitives, `Stat`/`EmptyState` components (W11 groundwork).
2. **Spacing debug pass (W0)** across the planner hub and all tools.
3. **Small fixes**: W1 theme icon, W2 dashboard, W4 budgeting layout, W10 widget
   consistency, W11 copy pass.
4. **Features**: W3 info popovers, W6 RRSP/FHSA + bracket redesign, W7 mortgage
   extras.
5. **Investments (W9)** and W11 budgeting tabs (largest structural changes last).

Every phase is verified in the browser preview across themes and viewport widths.
Financial math (W6, W7, W9) is test-driven.

## Error handling & testing

- Market data fetches for swap-in start prices can fail: manual price fallback,
  matching the existing PositionCard pattern.
- Store migrations (analysis model v2, budget store collapse flag) follow the
  existing versioned-migration pattern in the zustand stores.
- Unit tests: canadaTax deductions, amortization extra payments, swap simulation
  derivations, analysis migration.
- Existing tests (Planner.test.tsx, SalaryTax-related, RRSP vs TFSA removal) updated
  alongside their workstreams.
