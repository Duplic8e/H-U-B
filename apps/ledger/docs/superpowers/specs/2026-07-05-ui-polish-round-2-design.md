# UI Polish Round 2 — Design

**Date:** 2026-07-05
**Status:** Approved by user (interactive Q&A session)

Fourteen approved UI/UX fixes across dropdowns, theming, dashboard, planner,
budgeting, and investments. Item numbering follows the user's original list;
item 5 (ticker/conversion price research) is explicitly deferred and out of
scope. Item 14 (net worth Y-axis) was added during review.

## 1 + 3. Dropdowns must not blur the background

**Problem:** All click-opened overlays share `OverlayBackdrop`
(`src/components/ui/OverlayBackdrop.tsx`), which applies
`bg-black/50 + backdrop-blur-md` — appropriate for modals, jarring for
dropdowns (planner ToolSwitcher, ThemedSelect, ThemedDatePicker, month
pickers inside CompensationModal).

**Decision (user-approved via visual comparison):** dropdowns get **no
backdrop at all**. Modals keep the current dark blur.

**Design:**
- Modals (CompensationModal, AnalysisModal, TransactionModal, AddAccountModal,
  etc.) keep the existing `bg-black/50 backdrop-blur-md` overlay.
- Dropdown menus (ThemedSelect listbox, ToolSwitcher menu, ThemedDatePicker
  popover) stop rendering `OverlayBackdrop` entirely. Outside-click dismissal
  already works via each component's window `pointerdown` listener, so no
  backdrop element is needed for close behavior.
- Dropdown panels get a subtle open animation (fast scale/fade, ~120ms,
  origin top) and keep `shadow-xl` + border so they read as floating layers.
- If `OverlayBackdrop` ends up used only by dropdowns' removal, keep the
  component for modals that use it; delete only if it becomes dead code.

This also applies inside modals (item 1): a dropdown opened within a modal
must not add a second blur layer on top of the modal's own backdrop.

## 2. Theme-aware chart palette (color collisions)

**Problem:** `CompHeroWidget.tsx` `COMP_COLORS` uses `var(--color-accent)`
for Base Salary plus hard-coded hexes for the rest. `EquityVestingWidget.tsx`
`COLORS` uses accent for grant 1 and `#f59e0b` for grant 3. Collisions:
- Glassmorphism accent `#22d3ee` (cyan) ≈ RSU `#06b6d4` (cyan).
- Luxury accent `#d4a853` (gold) ≈ ESPP `#f59e0b` (amber), and grant 1 ≈
  grant 3 in the vesting schedule.

**Design:**
- Add per-theme chart series variables `--chart-1` … `--chart-6` to every
  `[data-theme='…']` block in `src/index.css` (and the `:root` fallback).
- `--chart-1` may equal the theme accent only where that causes no collision;
  the six stops within a theme must be mutually distinguishable AND
  distinguishable from that theme's accent. Concretely: glass avoids a second
  cyan; luxury avoids a second gold/amber.
- `CompHeroWidget.COMP_COLORS` and `EquityVestingWidget.COLORS` switch to
  `var(--chart-N)`. Other charts with hard-coded palettes found during
  implementation (e.g. ExpenseWidget category colors) may adopt the same
  variables opportunistically but are not required to.
- Verification: view the compensation monthly cash flow and equity vesting
  charts in all six themes; no two adjacent series may share a hue family.

## 4. Expenses widget $0 state

- Title stays **"Expenses"** (plural, matches "Income").
- When the month's expense total is 0, render the normal widget layout with
  `$0.00` and an empty breakdown area — remove the
  `EmptyState "No expenses this month"` branch in
  `src/components/budget/ExpenseWidget.tsx`. No hint text.

## 6. Category dropdown clipped by frame

**Problem:** In All Transactions (budgeting), the ThemedSelect categories
listbox (`max-h-64`) can extend past the visible frame; part of the list is
unreachable visually even though it scrolls.

**Design:** ThemedSelect measures available space below the trigger on open
(viewport-aware): `maxHeight = min(256px, space below − 16px margin)`. If
space below is under a usable threshold (~160px) and there is more room
above, the menu flips to open upward with the same clamped height. The whole
list always scrolls within the visible viewport. Same logic applies to
ThemedDatePicker if it exhibits the same clipping.

## 7. Planner tool-switcher hover styling

**Problem:** In `ToolSwitcher.tsx`, hovered items use
`hover:bg-bg-primary/50` (reads near-black on dark themes) while the current
item uses accent. User wants the Debt Payoff strategy dropdown treatment.

**Design:** hovered/highlighted item gets `bg-accent/10 text-accent` exactly
like `ThemedSelect`'s highlight state; the currently-selected tool keeps
accent + medium weight (optionally a check icon for consistency).

## 8. Planner group order

Reorder `PLANNER_GROUPS` in `src/components/planner/toolRegistry.tsx` to:
`Forecasting & Growth, Savings, Income & Tax, Debt & Housing, Utilities`.
No regrouping of tools. Affects both hub sections and the switcher dropdown.

## 9. Dashboard: Upcoming Vests widget

**Problem:** 13 widgets, one spanning two columns = 14 grid cells; the last
lg row has an empty slot.

**Design:** add an **Upcoming Vests** widget
(`src/components/dashboard/widgets/UpcomingVestsWidget.tsx`):
- Data: `generateVestEvents` from `useCompensationStore`; show the next 3–5
  future vest events: date, grant name, shares, estimated value (shares ×
  current/assumed price consistent with how compensation widgets value RSUs).
- Empty state: invitation to add RSU grants (consistent with
  EquityVestingWidget's empty copy).
- Registered in `Dashboard.tsx` (`DASHBOARD_WIDGET_IDS` + element map, id
  `upcoming-vests`, single cell). 14 widgets = 15 cells = clean 3-column fill.
- Note: users with a persisted drag order will see the new widget appended at
  the end (existing merge logic already handles unknown ids).

## 10. Forecaster source labels

In `src/components/planner/forecaster/ForecasterTool.tsx`, the auto/manual
toggle currently renders `auto: <hint>` / `manual`. Replace with:
- Starting net worth: **"Dashboard Net Worth"** (auto) / **"Manual"**.
- Monthly savings: **"Budget Average (3 Months)"** (auto) / **"Manual"**.
The toggle mechanics are unchanged; only display strings change.

## 11. Info popups + app-wide Title Case

Two workstreams:

**a) Info popup content audit.** Review every planner tool's `ToolInfo`
(`howTo` + `params` in `toolRegistry.tsx`) and other info popovers. Every
term of art must be defined in plain language — e.g. FI Number ("the
portfolio size at which annual withdrawals at your safe-withdrawal rate cover
annual expenses"), Debt Drag, Comp Events, Safe Withdrawal Rate. A param
description must never restate the param name.

**b) Title Case audit, app-wide.** All UI labels, stat names, dropdown
options, toggle labels, and table headers use Title Case. Known offenders:
"Monthly savings" → "Monthly Savings", "Comp events" → "Comp Events",
"debt drag" → "Debt Drag", "Avalanche (highest APR first)" → "Avalanche
(Highest APR First)", "Min payment" → "Min Payment". Sweep systematically
(grep for label/option strings per component directory). Sentence-style body
copy (hints, descriptions, empty-state text) stays sentence case — Title
Case applies to labels/headings/options only.

## 12. Investments Plan vs Actual rework

Largest item. Current `AnalysisCard.tsx` mixes plan and actual concerns.

**Plan tab:**
- Gets a single **"Planned Budget ($)"** input (new field on the analysis,
  e.g. `plannedBudget`). Planned $ per position = plannedBudget ×
  allocation %.
- **Allocation %** becomes an editable cell directly in `PlanTable`.
- The per-position "Allocation % / Extra planned $" input rows above the
  table are removed. The `extraPlanned` concept is dropped from Plan (extra
  money deployed is an Actual concern).
- Initial fund / Extra fund inputs are removed from the Plan tab.

**Actual tab:**
- Owns the **Initial Fund ($)** and **Extra Fund ($)** inputs (moved from
  Plan; same stored fields `initialFund` / `extraFund`).
- One **"Add Trade"** button above the Actual table opening a small form:
  ticker (select from the analysis's positions), date, shares, price. Saves
  as a lot on that position.
- The Actual table shows **only positions that have at least one actual
  trade/lot**. Positions with no lots do not appear (no mirroring of plan
  tickers). Before the first trade, show an empty state with the Add Trade
  action.

**Position (ticker) cards** (`PositionCard`, rendered below the tables):
- Collapsed by default: single header row with ticker + key numbers
  (invested, current value, return). Chevron expands to the full card.

**New Analysis modal** (`AnalysisModal`):
- Restructure inputs to mirror the Plan table 1:1: analysis name/date/thesis,
  planned budget, then per-ticker rows of (ticker, allocation %, start price
  — auto-filled from the analysis date as today). What you enter is what the
  Plan table shows.

**Migration:** existing analyses have `initialFund`/`extraFund` but no
`plannedBudget`. On first load, default `plannedBudget` to
`initialFund + extraFund` (preserves prior planned math as closely as
possible); `extraPlanned` values are ignored going forward.

## 13. Spending calendar legend

In `src/components/budget/SpendingHeatmapWidget.tsx`, replace the text
"Darker = more spent that day (max $X)." with a visual legend: a horizontal
ramp of 4–5 swatches using the exact heatmap color scale, labeled `$0` on the
left and `max` (formatted, e.g. `$412`) on the right.

## 14. Net worth trend Y-axis (added during review)

In `src/components/dashboard/widgets/NetWorthTrendWidget.tsx`, the Recharts
YAxis uses the default `[0, auto]` domain. Change to a brokerage-style
padded domain: `[dataMin − pad, dataMax + pad]` where
`pad = max(range × 0.08, smallFloor)` and range = dataMax − dataMin. The
axis never forces zero into view; a flat-ish series still shows visible
variation. Guard the degenerate case range = 0 (pad by a fixed % of the
value). Tooltip and tick formatting unchanged.

## Out of scope

- Item 5: researching live ticker/FX price sources (explicitly deferred).
- Changing modal backdrop styling (stays as-is).
- Reassigning planner tools between groups.

## Testing

Follow existing patterns (Vitest + Testing Library, colocated `*.test.tsx`):
- ThemedSelect/ToolSwitcher: no `overlay-backdrop` testid rendered when open;
  outside click still closes. Update `OverlayBackdrop.test.tsx` consumers.
- ThemedSelect: clamped max-height/flip logic unit-tested with mocked rects.
- ExpenseWidget: renders $0.00 layout, not EmptyState, when total is 0.
- UpcomingVestsWidget: shows next vests sorted by date; empty state without
  grants.
- Forecaster: toggle renders new label strings.
- Analysis store: migration defaults `plannedBudget`; Actual table filters
  positions without lots; Add Trade appends a lot.
- NetWorthTrendWidget: domain function returns padded min/max, no zero-forcing.
- Chart palette: themes each define `--chart-1..6` (string-level CSS check is
  sufficient); manual visual pass across all six themes for item 2.
