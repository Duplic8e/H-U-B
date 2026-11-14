# Bugfix & UI Improvements — Design

Date: 2026-07-04. Supersedes the open decisions in `.planning/BUGFIX-PLAN.md`.
All decisions below are user-approved. Execution is split into three wave plans;
executors follow the plans, not this doc, but this doc is the source of truth for intent.

## Baseline

The working tree contains completed, kept changes: desktop "Jump to… ⌘K" sidebar button
removed from `Layout.tsx`, widget min-height tweaks, `WIDGET_SPAN` map in `Dashboard.tsx`.
The `items-start` addition to `BentoGrid.tsx` was an unsuccessful attempt at the grid fix
and will be reworked (see A3).

## A. New UI fixes

### A1 — Mobile bottom tab bar too transparent
`Layout.tsx` bottom nav uses `bg-bg-secondary/90`; scrolled content bleeds through.
**Fix:** solid `bg-bg-secondary` (remove `/90`). Keep blur, border, safe-area padding.

### A2 — Remove ⌘K button from mobile top row
Delete the ⌘K button block from the mobile Backup/Theme row in `Layout.tsx`
(the `md:hidden` row above the outlet). Keep the `Ctrl/⌘+K` key handler and
`CommandPalette` — they are inert on touch devices and still serve desktop.

### A3 — Dashboard grid: equal-height rows
Empty space comes from `items-start` letting short cards leave holes below them.
**Fix:**
- `BentoGrid.tsx`: remove `items-start` (grid children stretch by default); keep
  `grid-flow-dense` and `gap-6`.
- `Dashboard.tsx`: widget wrapper divs get `h-full`.
- Every dashboard widget's root card element gets `h-full flex flex-col` so the card
  visually fills its row. The wave plan enumerates each widget file and its root element.
- Keep `WIDGET_SPAN` (net-worth trend spans 2 cols on md+).

## B. Existing small items

### #2 — Calculator field alignment
Root cause: `CalculatorField` and ad-hoc `<select>` blocks have different label
markup/spacing, so grid rows misalign.
**Fix:** new shared `SelectField` component mirroring `CalculatorField` markup;
replace ad-hoc selects in SavingsGoal, DebtPayoff, TakeHomePay (pre-merge), IncomeTax;
add `items-end` to input-row grids; normalize `gap`/column counts.

### #4 — Marginal rate surtax breakdown
Display gap, not math bug. **Fix:** `marginalRateBreakdown(income, province)` helper in
`canadaTax.ts` returning `{ federal, provincial, surtax, total }` (percent components
summing to the marginal rate, within rounding); render breakdown under result cards in
the tax estimator. Unit tests for ON surtax bands ($100k / $150k / $200k) and a
no-surtax province (BC/AB).

## C. #1 Merge Income Tax + Take-Home → "Salary & Tax"

One registry tool `salary-tax` ("Salary & Tax") replacing `income-tax` and
`take-home-pay`. One income + province input pair feeding two stacked sections:
1. Tax breakdown — total, marginal, effective, bracket bars, surtax decomposition (#4).
2. Take-home — net annual/monthly/biweekly and deductions.

**Saved inputs:** migrate to a single `salary-tax` key in `usePlannerStore`; on first
load, if no `salary-tax` entry exists, seed from old `income-tax`, else `take-home-pay`.
**Routes:** `/planner/income-tax` and `/planner/take-home-pay` redirect to
`/planner/salary-tax`.

## D. #3 Planner redesign — grouped hub + breadcrumb dropdown (chosen via mockups)

- `toolRegistry.tsx`: add `group` field. Groups: Forecasting & Growth (forecaster,
  compound-interest), Savings (savings-goal, emergency-fund), Debt & Housing
  (debt-payoff, mortgage, rent-vs-buy), Income & Tax (salary-tax, raise-inflation,
  rrsp-vs-tfsa), Utilities (currency-converter).
- `Planner.tsx` hub: render one section per group (label header + card grid), same cards.
- `PlannerTool.tsx`: header becomes breadcrumb "Planner / {Tool} ▾"; clicking the tool
  name opens a grouped dropdown listing all tools for direct switching. Closes on
  selection, outside click, and Escape. Same component on mobile. No second side-rail
  (explicitly rejected: double-rail with the app sidebar).

## E. Large items

### #6a — CSV import hardening
Normalize headers before detection: trim, strip BOM, case-insensitive compare.
Confirm mapper fallback path stamps holding IDs. Test against `csv-examples/`.

### #6b — Portfolio multi-account
Add `account: string` to `Holding`; import dialog asks for account name and mode:
**Replace** (this account only) / **Update** (upsert by ticker within account) /
**Add** (append as new account). `PortfolioView` groups by account;
`PortfolioRollupWidget` and helper text updated. Versioned zustand migration:
existing holdings get `account: 'Default'`. Hydration test old→new.

### #5 — Multi-stock analysis
Restructure: `InvestmentAnalysis { id, name, thesis?, analysisDate, positions: Position[] }`,
`Position { id, ticker, exchange?, plannedAmount, startPrice, startPriceSource, acted, lots }`.
Store actions `addPosition`/`removePosition`; `addLot`/`removeLot` keyed by position.
`AnalysisModal` becomes two-step (shell → tickers); `AnalysisCard`/`analysisMetrics`
aggregate across positions. Versioned zustand migration wraps each old single-ticker
analysis into `positions: [ … ]`. Hydration test old→new.

## Sequencing

- **Wave 1 (small, CSS/UI):** A1, A2, A3, #2, #4
- **Wave 2 (medium):** #1 merge, #3 planner redesign, #6a CSV hardening
- **Wave 3 (large, migrations):** #6b multi-account, #5 multi-stock

## Testing policy

No TDD. Run the existing suite per wave; update only tests broken by the changes
(`Planner.test.tsx`, portfolio/analysis store tests). New unit tests only where logic is
new: `marginalRateBreakdown`, both zustand migrations, CSV header normalization.
