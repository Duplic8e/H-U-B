# Bug-fix & Enhancement Plan

> **Status (2026-07-04): fully planned — execute from the wave plans, not this file.**
> Design decisions are locked in `docs/superpowers/specs/2026-07-04-bugfix-ui-design.md`.
> Detailed executor-proof implementation plans:
> - Wave 1 (UI fixes, items A1–A3 + #2 + #4): `docs/superpowers/plans/2026-07-04-wave1-ui-fixes.md`
> - Wave 2 (#1 merge, #3 planner redesign, #6a CSV): `docs/superpowers/plans/2026-07-04-wave2-planner.md`
> - Wave 3 (#6b multi-account, #5 multi-position): `docs/superpowers/plans/2026-07-04-wave3-migrations.md`

Reported items, grouped by area with root cause, fix approach, and files touched.
Ordered roughly by effort/risk at the end. (RSU→CAD and Categorization Rules were dropped from
this plan for now.)

---

## A. UI fixes (added 2026-07-04)

**A1. Mobile bottom tab bar too transparent.** `Layout.tsx` bottom nav uses
`bg-bg-secondary/90`; scrolled content bleeds through. Fix: solid `bg-bg-secondary`.

**A2. ⌘K button still shown in mobile view.** Remove the ⌘K button from the mobile
Backup/Theme row in `Layout.tsx`; keep the keyboard shortcut and `CommandPalette`
(desktop). The desktop sidebar button was already removed.

**A3. Dashboard bento grid disorganized / empty space.** Root cause: `items-start`
lets short cards leave holes below them in each row. **Decision: equal-height rows** —
remove `items-start`, add `h-full` to `WidgetWrapper` root and Dashboard wrapper divs;
keep `grid-flow-dense` and the 2-col spans.

---

## 1. Combine Income Tax Estimator and Take-Home Pay

They already share the same engine (`canadaTax.ts`) and the same two inputs (income, province).
Today they are two separate registry tools (`income-tax`, `take-home-pay`) with duplicated
input rows.

**Decision:** one merged tool, **both sections shown at once** (no toggle).

**Fix.** Replace both `PLANNER_TOOLS` entries with a single tool ("Salary & Tax") — one income +
province input feeding two stacked result sections: (a) tax breakdown (total, marginal, effective,
bracket bars, plus the surtax breakdown from #4) and (b) take-home (net annual/monthly/biweekly,
deductions). Remove the redundant route.

**Files.** `src/components/planner/toolRegistry.tsx`,
`src/components/planner/IncomeTaxEstimator.tsx`,
`src/components/planner/TakeHomePayCalculator.tsx` (fold into one), `Planner.test.tsx`.

**Effort.** Medium. **Note:** decide whether to preserve two saved-input namespaces
(`income-tax`, `take-home-pay`) or migrate to one `usePlannerStore` key.

---

## 2. Alignment fixes — savings goal, debt payoff, take-home, income tax etc

**Root cause.** Two different field wrappers are mixed inside the same CSS grid rows.
`CalculatorField` renders `<div><label class="block mb-1">…<div class="…py-2">input</div></div>`,
while the province `<select>` blocks render `<label class="flex flex-col gap-1"><span>…</span>
<select class="…py-2">`. The label line-heights and vertical gaps differ, so inputs and dropdowns
in the same row don't line up. Result cards use varying `md:grid-cols-{2,3,4}` counts too.

**Fix.**
- Normalize the label/spacing: give the `<select>` blocks the same label markup and spacing as
  `CalculatorField` (or extract a shared `SelectField` component mirroring `CalculatorField`).
- Add `items-end` to input-row grids so unequal-height fields bottom-align (DebtPayoff already
  does this on some rows).
- Sweep the four named calculators for consistent `gap` and column counts.

**Files.** `src/components/planner/CalculatorField.tsx` (or new `SelectField.tsx`),
`SavingsGoalCalculator.tsx`, `DebtPayoffCalculator.tsx`, `TakeHomePayCalculator.tsx`,
`IncomeTaxEstimator.tsx`. Pairs naturally with item 1.

**Effort.** Small–medium (mostly CSS).

---

## 3. Better view for the Planner

Currently the Planner hub is a flat `BentoGrid` of identical link cards; every tool is one route
with a full-width single-column body.

**Decision:** direction TBD — I'll propose a design (mockup) before building.

**Plan.** Start with a design pass: mock 1–2 options (likely a grouped hub with sections +
a persistent side-rail/tab nav, optionally a two-pane input/results layout on wide screens),
get your sign-off, then implement. Candidate building blocks:
- Group tools into sections (Cashflow, Debt/Housing, Tax/Comp, Investing) via a `group` field.
- Persistent nav so switching tools doesn't require returning to the hub.
- Consistent two-pane layout (inputs left, results/chart right) on wide screens.

**Files.** `src/pages/Planner.tsx`, `src/pages/PlannerTool.tsx`,
`src/components/planner/toolRegistry.tsx` (add a `group` field).

**Effort.** Medium–large. **Gated on a mockup review** before implementation.

---

## 4. Marginal rate doesn't show the surtax component

**Root cause.** This is a *display* gap, not a math bug. `marginalRate()` is computed correctly by
differencing `totalIncomeTax` — it already includes the Ontario surtax, which is why at $200k it
reads ~48.26%. But the bracket bars only show the *statutory* bracket rates (fed 29% + ON 12.16%
= 41.16%). The surtax (20% over $5,818 of ON tax + 36% over $7,446) is never surfaced, so the
numbers appear not to add up.

**Fix.** Decompose and display the marginal rate: federal bracket %, provincial bracket %,
provincial surtax contribution %, and (optionally) CPP/EI at the margin — summing to the shown
marginal rate. Add a `marginalRateBreakdown(income, province)` helper in `canadaTax.ts` returning
the components, and render it under the result cards. Note the existing caption already claims the
surtax is included — make it *visible*.

**Files.** `src/utils/finance/canadaTax.ts` (new breakdown helper + test),
`src/components/planner/IncomeTaxEstimator.tsx`.

**Effort.** Small–medium.

---

## 5. An analysis should hold multiple stocks

**Root cause.** The data model is single-ticker: `InvestmentAnalysis` has one `ticker`,
`startPrice`, `plannedAmount`, and a flat `lots[]`. "New analysis" creates exactly one position.

**Fix (data model change).** Restructure so an analysis is a container of positions:
```
InvestmentAnalysis { id, name, thesis?, analysisDate, positions: Position[] }
Position { id, ticker, exchange?, plannedAmount, startPrice, startPriceSource, acted, lots: BuyLot[] }
```
- Update `useAnalysisStore` actions (`addPosition`, `removePosition`, keep `addLot`/`removeLot`
  keyed by position).
- `AnalysisModal` becomes multi-step: create the analysis shell, then add one or more tickers.
- `AnalysisCard` / `analysisMetrics` aggregate across positions.
- **Migration:** persisted `ledger-analyses` uses the old shape — add a zustand `migrate`/`version`
  to wrap each existing single-ticker analysis into `{ positions: [ ... ] }`.

**Files.** `src/store/useAnalysisStore.ts`, `src/components/investments/AnalysisModal.tsx`,
`AnalysisCard.tsx`, `src/utils/investments/analysisMetrics.ts` + tests.

**Effort.** Large (schema + UI + migration). Highest-risk item.

---

## 6. Portfolio: CSV import + per-account identity

Two problems in one.

**6a. CSV "not working."** Detection is strict-equality on exact header names
(`'Symbol'` + `'Cost Basis'` for IBKR, `'Symbol'` + `'Book Value'` for Wealthsimple). Any header
drift (extra whitespace, casing, BOM, renamed export column) falls through to the manual mapper —
which can *look* like it isn't working. Harden: trim/normalize headers, case-insensitive match,
strip BOM, and confirm the mapper path stamps IDs correctly. Worth reproducing with the user's
actual CSV (see `csv-examples/`).

**6b. Account identity + merge modes.** `usePortfolioStore` has a flat `holdings[]` and
`setHoldings` *replaces everything*; there is no account concept. Import always clobbers.

**Fix.**
- Add `account` to `Holding` (or a keyed `accounts` map). Each import is tagged with an account
  name/id the user supplies.
- On import, offer **Replace** (this account only) / **Update** (upsert by ticker within account) /
  **Add** (append as a new account).
- `PortfolioView` groups/rolls up by account; the "Importing replaces the current portfolio"
  helper text and `PortfolioRollupWidget` need to reflect multi-account.

**Files.** `src/store/usePortfolioStore.ts` (schema + versioned migration),
`src/utils/portfolioCsv.ts` (header normalization), `src/components/investments/PortfolioImport.tsx`
(account name + mode selector), `PortfolioView.tsx`,
`src/components/dashboard/widgets/PortfolioRollupWidget.tsx`, tests.

**Effort.** Large. Also needs a persisted-state migration.

---

## Suggested sequencing

**Wave 1 — quick, low-risk, high visible payoff** (plan: `2026-07-04-wave1-ui-fixes.md`)
1. A1 Mobile tab bar opacity · A2 mobile ⌘K removal · A3 equal-height grid
2. #2 Alignment sweep (shared `SelectField`)
3. #4 Marginal-rate surtax breakdown

**Wave 2 — medium** (plan: `2026-07-04-wave2-planner.md`)
4. #1 Merge Income Tax + Take-Home into "Salary & Tax"
5. #3 Planner grouped hub + breadcrumb dropdown switcher
6. #6a CSV parsing hardening

**Wave 3 — large, schema + migration, do carefully** (plan: `2026-07-04-wave3-migrations.md`)
7. #6b Portfolio multi-account
8. #5 Multi-position analysis

**Cross-cutting:** items #5 and #6b both change persisted zustand shapes — versioned
`migrate` functions with old→new hydration tests are specified in the Wave 3 plan.

## Decisions (all resolved 2026-07-04)
- **#1:** one merged "Salary & Tax" tool showing tax breakdown + take-home together;
  saved inputs migrate to a `salary-tax` key seeded from the legacy keys; old routes redirect.
- **#3 Planner:** grouped hub sections + breadcrumb "Planner / {Tool} ▾" dropdown switcher
  (chosen from mockups; second side-rail explicitly rejected).
- **A3 grid:** equal-height rows (stretch), not masonry and not dropping the bento spans.
- **Testing:** no TDD — run existing suites, update only broken tests; new unit tests only
  for `marginalRateBreakdown`, both store migrations, and CSV header normalization.
