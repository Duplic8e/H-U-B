# v0.7.0-beta: Functional Budget Paradigms, After-Tax Total Comp, PWA Icon Fix

Date: 2026-07-17. Status: approved by Mishat (via brainstorming Q&A).
Source research: `docs/superpowers/research/2026-07-12-budget-paradigms.md`.

## Overview

Three work areas, one release (v0.7.0-beta):

1. Make the budget paradigm selector functional: four paradigms with real,
   paradigm-specific math and UI, plus the missing reallocation UI.
2. Show after-tax (take-home) total compensation on the Compensation page,
   reusing the Salary & Tax tool's calculation, with a deep link into the tool.
3. Fix the stale PWA app icon via filename cache-busting.

## Decisions (locked during brainstorming)

- Paradigms: `Ledger Custom`, `Zero-Based`, `Target-Based`, `50/30/20`.
  Envelope is dropped; persisted `Envelope` values migrate to `Ledger Custom`.
- 50/30/20 classification lives per category group (need/want/savings), on
  expense groups only. Categories inherit their group's class.
- 50/30/20 ratio base is the month's logged income transactions.
- 50/30/20 savings bucket counts spending in savings-classed groups only
  (leftover income does not count as savings).
- Enforcement is warnings only. Nothing ever blocks user actions.
- Reallocation UI: modal launched from an overspent category, plus a simple
  current-month history list with delete.
- Paradigm feedback surfaces on the Budget page only. The dashboard
  BudgetHealthWidget is untouched.
- After-tax comp: Gross / After-Tax toggle on the hero widget AND a deep link
  to Salary & Tax.
- The tax estimate treats the full displayed total comp (CAD-converted when
  that toggle is on) as employment income.
- Province is reused from the Salary & Tax tool's saved input (default ON).
  RRSP/FHSA inputs are NOT reused; the comp page estimate is pure gross-to-net.
- Toggle changes the donut center and adds a net summary row. Pie segments and
  the monthly bar chart stay gross.
- Deep link asks for confirmation before overwriting the tool's saved income.
- Release version: 0.7.0-beta.

## 1. Budget paradigm engine (store layer)

### Types (`src/types/budget.ts`)

- `BudgetingParadigm = 'Ledger Custom' | 'Zero-Based' | 'Target-Based' | '50/30/20'`
- `CategoryGroup` gains `budgetClass?: 'need' | 'want' | 'savings'`
  (meaningful for expense groups only).

### Migration (`src/store/useBudgetStore.ts`, persist v2 to v3)

- Persisted paradigm `Envelope` (or any unknown value) maps to `Ledger Custom`.
- Seeded default groups get classes: Housing, Necessities, Food = `need`;
  Entertainment, Shopping = `want`. Other existing groups stay unclassified.
- Unclassified expense groups count as `need` in 50/30/20 math, and the
  banner shows a hint to classify groups while any remain unclassified.

### Stats selector

`getMonthlyBudgetStats` becomes paradigm-aware. Return shape grows from
`{ spent, remaining, unallocated }` to also include:

- `perCategory`: for each expense category `{ id, effectiveTarget, spent,
  overspend }` where `effectiveTarget` is base target adjusted by the month's
  reallocations (existing logic) and `overspend = max(spent - effectiveTarget, 0)`.
- `zeroBased`: `{ unassigned, overspentCategoryIds }`.
  `unassigned = totalIncome - totalTarget`. Overspend never reduces
  unassigned; overspent categories are flagged until covered by reallocation.
- `targetBased`: `{ buffer, negative }` where
  `buffer = (totalIncome - totalTarget) - totalOverspend`. Warn only when
  `buffer < 0`.
- `fiftyThirtyTwenty`: `{ needsSpent, wantsSpent, savingsSpent, needsPct,
  wantsPct, savingsPct }`, percentages of the month's logged income
  (0 when income is 0).

All blocks are computed unconditionally (cheap); the UI reads the block for
the active paradigm. The empty `if (state.paradigm === 'Zero-Based')` and its
misleading comment are removed.

### Tests

Unit tests in the budget store test file covering: overspend flag math,
unassigned vs buffer behavior for the same inputs, reallocation coverage
clearing a Zero-Based flag, 50/30/20 bucket sums and percentages including
the unclassified-counts-as-need rule and zero-income months, and the v2 to v3
migration (Envelope remap + seeded group classes).

## 2. Budget page UI

### Paradigm selector (`CategoryManagerWidget`)

- Dropdown options become exactly the four type members. The `as any` cast is
  removed.
- A one-line description of the selected paradigm renders under the selector
  (e.g. Zero-Based: "Every dollar gets assigned. Overspending must be covered
  by moving budget from another category.").

### ParadigmBanner (new component, Budget page)

- Zero-Based: "{X} unassigned. Assign it to a category." (positive) or
  "You have assigned {X} more than you earned." (negative). Nothing at zero.
- Target-Based: buffer amount framed positively; warning styling only when
  the buffer is negative.
- 50/30/20: a three-segment bar showing needs/wants/savings percentages
  against the 50/30/20 targets, with per-bucket over/under labels; plus the
  classify-your-groups hint when unclassified expense groups exist.
- Ledger Custom: banner renders nothing.

### Per-category overspend flags

- Zero-Based: overspent categories show a red "needs coverage" state with a
  Cover button.
- Target-Based: overspent categories show a quiet amber "absorbed by buffer"
  note. No action required.
- Ledger Custom and 50/30/20: no per-category flags (50/30/20 feedback is
  bucket-level in the banner).

### ReallocationModal (new component)

Opened from Cover. Fields: from-category (picker showing each category's
available amount = effectiveTarget - spent), to-category (prefilled with the
overspent category), amount (prefilled with the overage), optional note.
Submits via existing `addReallocation`. Validation: amount > 0; warn (do not
block) when the source lacks available budget.

### Reallocation history

Collapsible list on the Budget page showing the current month's reallocations
(from, to, amount, note, date) with a delete action via existing
`deleteReallocation`.

### Group class chips

When the active paradigm is 50/30/20, expense groups in Budget Setup show a
Need / Want / Savings chip selector writing `budgetClass` via
`updateCategoryGroup`. Hidden under other paradigms.

## 3. After-tax total comp (Compensation page)

### Shared estimate hook

New `useTakeHomeEstimate` (src/hooks): reads the displayed total comp (the
same CAD-converted figure the hero shows), reads `province` from
`usePlannerStore` inputs for tool id `salary-tax` (fallback `'ON'`), and
returns `takeHomeWithDeductions(total, province, 0, 0)` from
`utils/finance/canadaTax`.

### CompHeroWidget changes

- Gross / After-Tax toggle rendered alongside the existing time-mode and view
  toggles. Persisted as `showAfterTax: boolean` in `useCompensationStore`.
- After-Tax mode: donut center shows the net total (label "Est. After-Tax
  Compensation"), and a compact summary row appears under the chart with
  effective rate, net monthly, and net biweekly.
- Caveat line in After-Tax mode: "Estimate. Treats all compensation as {province}
  employment income for the year. RRSP match is actually tax-sheltered; ESPP
  and RSU values assume sale at vest." When CAD conversion is off and stock
  components exist, append: "Stock components are in USD; brackets assume CAD."
- Pie segments and the monthly bar chart remain gross in both modes.

### Deep link

- "Full breakdown in Salary & Tax" link near the toggle.
- On click: if the tool's saved income differs from the displayed total comp,
  show an in-app confirm ("Replace saved income {X} with {Y}?"). Confirm
  writes income via `usePlannerStore.setInput('salary-tax', 'income', total)`
  then navigates to `/planner/salary-tax`. Cancel navigates without writing.
  If no saved income exists or it already matches, write (or no-op) and
  navigate without asking.
- Only `income` is ever written. Province, RRSP, and FHSA are never touched.

### Tests

Hook test (province fallback, planner input reuse, CAD-displayed total in),
widget test (toggle renders net summary row, caveat text, gross pie retained),
deep-link test (confirm shown only when values differ, income written on
confirm, untouched on cancel).

## 4. PWA icon fix

- Rename `public/icon-192x192.png`, `public/icon-512x512.png`,
  `public/icon-512x512-maskable.png` to `-v2` suffixed filenames and update
  the manifest entries in `vite.config.ts`. New URLs force icon refetch.
- `favicon.svg` already carries the new logo; unchanged.
- Known limitation to note in the release: already-installed PWAs may need a
  reinstall (or OS icon-cache refresh) before the home-screen icon updates.

## 5. Release

- Bump `package.json` version to `0.7.0-beta`; release commit follows the
  existing `chore: release vX.Y.Z-beta` convention after verification.

## Out of scope

Monthly reset / savings sweep carry-over, take-home in the Compare view,
dashboard BudgetHealthWidget changes, per-category class overrides, an
Envelope paradigm, US or multi-country tax support.
