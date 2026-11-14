# UI/UX Audit: Ledger v0.9.4-beta (desktop, tablet and mobile)

**Date:** 2026-08-20
**Scope:** the whole app, both platforms. This does not supersede `MOBILE_AUDIT_2026-08-19.md`; it complements it. That audit covered phone mechanics and scored them 100/100. This one re-tested a sample of those claims (they hold) and then covered what it did not: desktop, tablet, the 768px boundary, the five themes, keyboard and screen-reader semantics, forms, error states, empty states, charts, and cross-surface consistency.

**Method:** real Chromium through Playwright, not the in-app browser pane (which cannot composite frames, so animated content reads as stale). Five viewport profiles:

| Profile | Viewport | Notes |
|---|---|---|
| desktop | 1440 x 900 | |
| laptop | 1280 x 800 | |
| tablet | 768 x 1024 | touch enabled, iPad portrait, exactly on the `desktop:` breakpoint |
| mobile | 390 x 844 | iPhone 12 device profile |
| narrow | 320 x 700 | smallest width still in use |

Eight routes per profile (dashboard, budget, investments, planner, mortgage, forecaster, salary-tax, compensation), plus the Transactions tab, the Portfolio tab, the Setup tab, the Settings sheet, the Add Transaction sheet and the command palette. Seeded with realistic data: 7 accounts (including two long names), 8 holdings across 2 broker accounts in 2 currencies, 17 transactions across 2 months in 4 category groups, a compensation package with 2 RSU grants. Every route was also scanned with axe-core against wcag2a, wcag2aa, wcag21a and wcag21aa, and re-measured under all five themes. Numbers below come from live DOM measurement in that browser; screenshots were read directly.

---

## Scores

| # | Area | Desktop / tablet | Mobile |
|---|---|---|---|
| 1 | Layout and viewport fit | **5** / 10 | **9** / 10 |
| 2 | Information architecture and navigation | **7** / 10 | **7** / 10 |
| 3 | Visual hierarchy and density | **6** / 10 | **5** / 10 |
| 4 | Consistency and design system | **5** / 10 | **6** / 10 |
| 5 | Forms and data entry | **4** / 10 | **5** / 10 |
| 6 | Feedback, errors and empty states | **5** / 10 | **5** / 10 |
| 7 | Charts and data visualisation | **6** / 10 | **4** / 10 |
| 8 | Accessibility (WCAG 2.1 AA) | **6** / 10 | **7** / 10 |
| 9 | Keyboard and pointer support | **5** / 10 | **8** / 10 |
| 10 | Theming and visual polish | **9** / 10 | **9** / 10 |
| | **Total** | **58** / 100 | **65** / 100 |

The mobile score is lower than the previous audit's 100 because this audit measures different things. Nothing that audit fixed has regressed: at 320 and 390 there is still zero horizontal overflow on every route, zero inputs below 16px, and effectively zero tap targets below 44px. The deductions here are for form semantics, error handling, chart legibility and empty-state quality, which that audit did not score.

---

## Rescore 2026-08-22

Re-measured on branch `feat/v0.9.5-beta` after the 18-task remediation plan in
`docs/superpowers/plans/2026-08-20-desktop-ui-100.md`. Same method as the original pass:
production build driven by Playwright, five viewport profiles, all five themes, axe-core at
wcag2a / wcag2aa / wcag21a / wcag21aa. The raw numbers are in
`.superpowers/sdd/d100-rescore-measurements.md`.

| # | Area | Was (desktop) | Now | What closed it |
|---|---|---|---|---|
| 1 | Layout and viewport fit | 5 | **10** | B1, B4, the Planner grid, the portfolio import move |
| 2 | Information architecture and navigation | 7 | **10** | M2, M6, the Setup disclosure |
| 3 | Visual hierarchy and density | 6 | **8** | D1, D9, D13. Card dead space is only partly reclaimed |
| 4 | Consistency and design system | 5 | **9** | M3, D1, D3, D5, the breakpoint reconciliation, one focus ring |
| 5 | Forms and data entry | 4 | **8** | B2 both halves. Input number formatting is still open |
| 6 | Feedback, errors and empty states | 5 | **10** | B2, D1, D2, the FX retry control |
| 7 | Charts and data visualisation | 6 | **10** | M1, D4's axis half, D5, chart accessible names |
| 8 | Accessibility (WCAG 2.1 AA) | 6 | **10** | B2, B3, M3, M5, M6, and 0 axe violations across 16 scans |
| 9 | Keyboard and pointer support | 5 | **10** | B3, M2's arrow keys, scroll regions, sortable headers |
| 10 | Theming and visual polish | 9 | **10** | `--border-strong` across all five themes |
| | **Total (desktop and tablet)** | **58** | **95** | |

### Measured, after

| Measurement | Before | After |
|---|---|---|
| Horizontal overflow (5 viewports x 8 routes) | present | 0 of 40 |
| Genuinely clipped text | 7 of 7 account names at 768px | 0 (every hit is `sr-only`) |
| Form controls with no programmatic label | 3, plus 2 more found during the work | 0 across 10 locations, both modals opened |
| Focus stops invisible while focused | 12 of the first 30 | 0 of 40, at both viewports |
| Control borders below 3:1 | every theme, 1.18 to 1.24 | 0 in all five themes |
| Text contrast failures | 0 | 0 |
| SVG text escaping its chart frame | 5 of 5 donut labels at 390px | 0 reproducible |
| axe violations | 1 critical, 1 serious | 0 across 16 scans |
| Distinct document titles | 1 for all routes | 8 of 8 distinct |
| Table headers missing `scope` | 22 | 0, captions present, `aria-sort` working |

Every guard behind these numbers runs on `npm run verify`, which is green: 1192 unit tests
across 185 files, and 140 e2e tests across five Playwright projects (`chromium`,
`mobile-narrow`, `mobile-landscape`, `tablet`, `short-wide`).

A whole-branch review after the rescore found four further defects, each a composition of
two individually correct changes that no per-task gate could see: eight tab panels that the
new focus-outline default left focusable with no indicator, an Import button whose
`control-border` painted nothing because it carried no border width (and a contrast guard
that skipped it for exactly that reason), holding rows still showing a dash for figures the
subtotal above them counted at cost, and sixteen charts whose Recharts surface stayed
focusable inside a presentational wrapper. All four are fixed, with guards, and the guards
in turn surfaced a real zero-width sparkline at 768px.

### Why this is 95 and not 100

Three things the plan did not fully close. Naming them is more useful than rounding up.

1. **Numeric inputs still render raw digits** (area 5). `NumberInput` renders `String(value)`,
   so Gross Annual Income shows `100000` and Home Price shows `600000` while every displayed
   figure alongside them is formatted. D4's axis half is fixed and its input half is not:
   Task 11's scope was the mortgage chart's axes.
2. **Card dead space is only partly reclaimed** (area 3). The dashboard empty states no longer
   reserve chart height, and the portfolio import no longer occupies the top of its tab, but
   Income, Receivables, Monthly Summary and Package Details still leave 100 to 300px voids at
   desktop width. D6's desktop half is partly open.
3. **One money-display inconsistency survives** (area 4). A manual price override is wrapped in
   a synthetic quote hardcoded to USD, so for a non-USD holding carrying an override the
   dashboard rollup and the Investments tab can still disagree. This is pre-existing, was found
   during Task 12, and is a narrower trigger than the reported finding, which is closed.

### Still out of scope

The mobile-only findings (D6's mobile half, D10, D11) were excluded from this plan by design
and are unchanged. The mobile column of the original scorecard is not rescored here.

---

## Blocking findings

### B1. Account names collapse to one or two characters at 768px

At 768 x 1024 (iPad portrait, and the exact width where the `desktop:` variant switches on) the dashboard account rows render as `M..`, `E...`, `Q..`, `V.`, `Personal Loan...`. Measured name-column widths against the width each name needs:

| Account | Rendered width | Needs |
|---|---|---|
| Main Checking | 19px | 91px |
| EQ Bank High Interest Savings | 19px | 185px |
| Questrade TFSA | 19px | 101px |
| Vanguard 401k | 11px | 94px |
| Mortgage - 12 Maplewood Crescent | 11px | 220px |
| Amex Cobalt | 27px | 79px |
| Personal Loan to Bob | 27px | 129px |

Seven of seven accounts are unreadable. Cause: [AccountCategoryWidget.tsx:83](src/components/dashboard/AccountCategoryWidget.tsx#L83) switches to `desktop:flex-row desktop:justify-between` with the name on `min-w-0 desktop:truncate` and the value block on `shrink-0`. At 768px the sidebar takes 256px and the grid is 2 columns, so each card is about 186px wide; the formatted amount plus two 32px icon buttons consume almost all of it and `truncate` gives the name whatever is left.

The same defect is visible at 1440px, just milder: `EQ Bank High Interest Savings` gets 164px of the 185px it needs and `Mortgage - 12 Maplewood Crescent` gets 156px of 220px, both truncated while the card has spare room to the right of the amount.

**Fix:** give the name `flex-1 min-w-0` and let the row wrap to two lines rather than truncate, or hold the stacked mobile layout until about 900px, or move the row actions into an overflow control so they stop competing for width. The previous audit fixed exactly this problem for phones ([Task 10](MOBILE_AUDIT_2026-08-19.md)); the fix stops at the `desktop:` boundary and the tablet case is worse than the phone case ever was.

### B2. Add Transaction has unlabelled fields and fails silently

Two of the six fields in the Add Transaction sheet have no programmatic label at all (no `<label for>`, no `aria-label`, no `aria-labelledby`): the amount field (the one carrying `inputMode="decimal"`) and the description field. They are identified by placeholder text only, which disappears on input. WCAG 3.3.2 and 1.3.1.

Submitting the form empty does nothing observable. Measured after clicking "Add Transaction" with no amount: the sheet stays open, there is no error text anywhere in the panel, zero elements carry `aria-invalid="true"`, and there is no `role="alert"`. The user gets no explanation and no focus move. WCAG 3.3.1.

axe also flags a second instance as **critical** on the Compensation route at every breakpoint: the manual stock-price input in the toolbar (`<input inputmode="decimal" ... value="428.5">`) has no label. On a 320px phone that control stacks into a bare box containing `0` with a `Set` button beside it and no text explaining what it sets.

### B3. Keyboard focus is invisible on every row-action button

Tabbing through the desktop dashboard, 12 of the first 30 focus stops land on elements with computed `opacity: 0`. The focus outline is drawn but the element is fully transparent, so nothing appears on screen. WCAG 2.4.7 Focus Visible.

These are the per-row "Edit account" and "Delete <name>" buttons. The pattern is `sm:opacity-0 sm:group-hover:opacity-100` ([AccountCategoryWidget.tsx:98](src/components/dashboard/AccountCategoryWidget.tsx#L98) and :113, [TransactionListWidget.tsx:360](src/components/budget/TransactionListWidget.tsx#L360)). Three call sites use this guarded form (2 in AccountCategoryWidget, 1 in TransactionListWidget). Across all 5 hover-reveal call sites in the app, **none** pairs the hover reveal with a focus reveal: `grep -c focus` over those lines returns 0.

The same pattern also breaks touch. At 768 x 1024 with touch enabled, all four measured account row buttons report `opacity: 0` and finger input never produces hover, so an iPad user cannot see, and has no reason to try, the edit and delete controls at all.

Two further call sites in [CategoryManagerWidget.tsx:240](src/components/budget/CategoryManagerWidget.tsx#L240) and :317 use `opacity-0 group-hover:opacity-100` with no `sm:` guard, so those delete buttons are hover-only at every width including phones. I could not get those rows to render (the category manager sits inside the collapsed "Budget Setup" disclosure on the Setup tab), so the user-facing reach of that one is unconfirmed; the class list is not.

**Fix:** add `focus-visible:opacity-100 group-focus-within:opacity-100` to all five call sites, and gate the hover reveal on `(hover: hover)` rather than on width so touch devices always show the controls.

### B4. Sheets render their header twice on short, wide viewports

At 932 x 430 the first-run disclaimer shows the heading "A Quick Note" twice, and the Settings sheet shows "Settings" twice with two close buttons stacked one above the other. Measured: `matchMedia('(min-width: 768px)')` is `true`, `matchMedia('(min-width: 768px) and (min-height: 500px)')` is `false`, and both `<h2>` elements report non-zero width.

Cause: [Sheet.tsx](src/components/ui/Sheet.tsx) picks its desktop or mobile branch from `useIsDesktop`, which is width **and** height (`DESKTOP_QUERY` in [useMediaQuery.ts:26](src/hooks/useMediaQuery.ts#L26)), while the modal bodies hide their own desktop header with Tailwind's width-only `md:` (for example `hidden md:flex` in [DisclaimerModal.tsx:26](src/components/ui/DisclaimerModal.tsx#L26)). Between 768px wide and 500px tall the two disagree, so the mobile sheet header and the desktop header both render.

This is not an exotic case. It covers landscape on every Pro Max class phone (932 x 430), any short desktop window, and any desktop browser zoomed far enough that the CSS viewport drops below 500px tall (a 1920px monitor at 200% zoom gives 960 x 450).

The underlying problem is systemic: the codebase runs four breakpoint systems at once. `md:` (768 wide, no height condition) is used **138** times, `desktop:` (768 wide and 500 tall) **33** times, `sm:` (640) **35** times, `lg:` (1024) **15** times, and 5 files mix `sm:` and `desktop:` in the same component. `src/index.css` already carries comments warning that a variant "must be the exact negation of `desktop`"; the 138 `md:` usages were never brought into line. B1's `sm:`-gated icon buttons inside a `desktop:`-gated row are the same class of mismatch: between 640px and 767px the row is still stacked while its buttons have already shrunk below 44px.

---

## Major findings

### M1. The compensation donut is only legible on a desktop monitor

At 1440px the donut is good: five outside labels with name and percent, leader lines, and a working hover tooltip. Below that it degrades badly, because the labels are positioned outside the chart surface and the surface shrinks with the container while the labels do not.

| Viewport | Labels outside the chart surface | Off-screen |
|---|---|---|
| 1440 | 0 of 5 | none |
| 768 | 3 of 5 | `ESPP Profit 1%` reaches x=767 in a 768px viewport |
| 390 | 5 of 5 | `Bonus 6%` starts at x=-31, `ESPP Profit 1%` ends at x=446, `RRSP 3%` at x=409 |
| 320 | 5 of 5 | the ring itself is clipped left and right by its container |

On a phone the result is a cropped coloured ring with a total in the middle and no way to tell which arc is base salary, bonus, equity, ESPP or RRSP. There is no legend to fall back on. `RRSP 3%` and `ESPP Profit 1%` also nearly collide at 1440px (24px apart vertically for 19px-tall labels), so small slices are fragile even at full width.

The app already contains the right pattern: the Investments allocation donut renders a legend listing each holding with its percentage and dollar value beside the chart. Use that on Compensation and drop the outside labels.

### M2. Tab strips are not tabs

`role="tab"` appears **0** times in the codebase. The Budgeting strip (Overview / Insights / Transactions / Setup), the Investments strip (Plan vs Actual / Portfolio / Trades / Options) and the segmented controls on Compensation and Mortgage are plain `<button>` elements. [Budgeting.tsx:123](src/pages/Budgeting.tsx#L123) shows the pattern: the only difference between the active and inactive tab is `border-accent text-accent bg-accent/10`.

Consequences:

- No `aria-selected`, `aria-current` or `aria-pressed`, so a screen reader announces all four identically and never says which one is active. WCAG 4.1.2.
- No arrow-key navigation. Keyboard users must Tab through every tab individually.
- Tab state is not in the URL. Measured: navigating to `#/investments` and clicking "Portfolio" leaves the address at `#/investments`. You cannot deep-link or bookmark a tab, browser Back will not undo a tab switch, and a reload always drops you back on the first tab.

That last point compounds with the default: **Investments opens on "Plan vs Actual", which is empty, even when the Portfolio tab has eight holdings in it.** A user with a portfolio and no analyses lands on "No analyses yet" every single time.

### M3. Outline-button borders fail non-text contrast in all five themes

The secondary button style relies on its border to read as a control, and that border is effectively invisible:

| Theme | Border colour | Contrast vs its background | Required |
|---|---|---|---|
| geometric | rgb(229, 231, 235) | 1.24 : 1 | 3 : 1 |
| tactical | rgb(26, 26, 26) | 1.21 : 1 | 3 : 1 |
| luxury | rgb(26, 26, 26) | 1.21 : 1 | 3 : 1 |
| aurora | rgb(26, 26, 26) | 1.21 : 1 | 3 : 1 |
| glass | rgba(255, 255, 255, 0.08) | 1.18 : 1 | 3 : 1 |

Affected on the routes measured: Search, Customize, Import CSV, the time-period select, and the three inactive Budgeting tabs. WCAG 1.4.11 Non-text Contrast.

Worth stating clearly alongside it: **text** contrast is excellent. Across four routes in all five themes the audit found **zero** text contrast failures, at any size or weight. Only the component boundaries fail.

### M4. Two different portfolio totals in one app

The dashboard Portfolio widget reports **$114,937** for 8 holdings. The Investments Portfolio tab reports **$36,705** invested and **$36,705** in holdings value, with `5 holdings excluded, no FX rate` set below it in 11px red text. The five USD holdings are silently dropped from one total and included in the other.

Whichever is correct, the app shows a user two different numbers for the same portfolio on two screens with no cross-reference. The exclusion notice is the smallest text on the page, does not say which holdings, and does not offer a way to fix the FX rate from where it appears.

### M5. Tables have no header semantics and no sorting

Across the Transactions table (6 `th`) and the Portfolio tables (16 `th`), **zero** headers carry a `scope` attribute, no table has a `<caption>`, and there is no `aria-sort` or sortable header anywhere. Screen-reader table navigation cannot associate a cell with its column header (WCAG 1.3.1), and no user can sort a transaction list by amount or date, or a holdings list by ticker or value. For an app whose core surfaces are financial tables, sorting is a notable functional gap rather than only an accessibility one.

### M6. No page title and no route announcement

`document.title` is `"Ledger"` on every route; it never changes. Browser tabs, history entries and bookmarks are indistinguishable across the whole app (WCAG 2.4.2 Page Titled). The single `aria-live` region in the DOM is `assertive` and empty, so a screen-reader user who activates a nav link gets no confirmation that the view changed. Scroll position does correctly reset to 0 on navigation, and focus stays on the activated link, which is acceptable.

---

## Moderate findings

**D1. Empty states are inconsistent, and the good one is barely used.** [EmptyState.tsx](src/components/ui/EmptyState.tsx) is a well-built shared component (icon, message, hint, action button). Six components use it, but only one of the six dashboard component files does. "Net Worth Over Time", "This Month's Budget" and "Top Goal" instead render a single line of grey text inside a card that still reserves its full chart height, leaving 100 to 200px of dead space with the only call to action sitting as a 16px-tall inline link.

**D2. A change indicator that reports change where none exists.** Net Worth shows `+0.00% vs Last Month` in accent colour with an upward trend arrow when there is no history at all, including on a brand-new install where net worth is $0.00. Show a neutral placeholder until there are two points to compare.

**D3. Toggle labelling has no single convention.** Four different phrasings for the same idea: `Convert to CAD: OFF` ([Compensation.tsx:117](src/pages/Compensation.tsx#L117)), `70 Comp Events On`, `Debt Drag Off`, and bare mode buttons like `Nominal` and `Show Contributions vs Growth` that give no clue which state they are in. Across the whole app there are 4 uses of `aria-pressed` and 0 of `role="switch"`, so most of these are announced as plain buttons with a label that states a condition, and it is never clear whether the label describes the current state or the action.

**D4. Number formatting is inconsistent between inputs, outputs and axes.** Inputs show raw digits (`100000` on Salary & Tax, `600000` on Mortgage, `48000` on the Forecaster) while every displayed figure is formatted with separators and a currency symbol. The Mortgage chart's Y axis prints `600000 / 450000 / 300000 / 150000 / 0` with no currency and no separators, while the Compensation and Forecaster charts abbreviate correctly (`$34k`, `$7.5M`).

**D5. Four different chart conventions.** Portfolio allocation uses a value legend; the Forecaster and Salary & Tax use custom inline legends; Compensation uses outside labels with leader lines; Mortgage has no legend, no axis titles and 25 crammed x-axis ticks. The Compensation vesting chart carries two Y axes ($34k scale left, $800k scale right) with neither labelled. Every Recharts surface renders `role="application"` with no accessible name and there is no text alternative for any chart (WCAG 1.1.1).

**D6. Low information density, especially on mobile.** On the Budgeting page at 390px a user scrolls roughly two screens before the first transaction: H1, a three-line subtitle, a month stepper, an unlabelled upload button, Add Transaction, four tab pills, a card heading, a search box, a category filter, a Clear All button and an unlabelled expand button. On desktop, Income, Receivables, Monthly Summary, Package Details and the Investments empty state each reserve a fixed card height and leave 100 to 300px of void. The page subtitles ("All your accounts, balances, and trends in one place") add nothing after the first visit and cost two to three lines on a phone.

**D7. "Clear All" reads as "clear filters" and deletes every transaction.** The button sits inside the filter row immediately beside "All Categories", styled in red with a trash icon ([TransactionListWidget.tsx:196](src/components/budget/TransactionListWidget.tsx#L196)). Its accessible name is just "Clear All". The confirm dialog it opens is genuinely good (it states the exact count, warns that filtered-out rows are included, and mentions undo), but the affordance itself invites the wrong mental model. Rename it "Delete all transactions" and move it out of the filter row.

**D8. The Budgeting Setup tab hides its content behind an unobvious disclosure.** The Setup tab shows a "Budget Setup" card whose only affordance is a small chevron at the far left, vertically centred against a three-line block and visually detached from the heading. The category manager, paradigm picker and monthly targets all live behind it. Below it, the Categorization Rules form offers a placeholder-only text input, a "Select Category..." dropdown and an icon-only `+` button, none with a visible label.

**D9. Portfolio import controls occupy the top of the data view permanently.** Account, Import Mode, an "Import broker CSV" button and a two-line help paragraph sit above the stat cards and the allocation chart, so an occasional action dominates a screen meant for reading. The Account field also reads `Default` while the actual holdings belong to "Questrade TFSA" and "Vanguard 401k".

**D10. Command palette semantics and mobile focus.** The palette is good overall (Ctrl+K, `role="listbox"` and `role="option"`, arrow keys plus Enter navigate correctly, focus lands in the input on desktop). Missing: `aria-expanded`, `aria-controls` and `aria-activedescendant` on the input, so a screen reader never announces the highlighted option, and there is no live region reporting the result count. On mobile, opening it from the Search button leaves focus on the button rather than the input, so typing needs a second tap.

**D11. Sheet focus is not restored on mobile.** On desktop and tablet, closing the Settings sheet with Escape returns focus to the Settings button. On the mobile profile it returns focus to `<body>`, dropping the keyboard user back to the top of the document.

**D12. Planner grid changes column count mid-page.** Forecasting, Savings and Income & Tax render as two columns while Debt & Housing and Utilities render as three, so card widths change halfway down a page of otherwise identical cards. Single-line cards like "Compound Interest" become very wide for their content.

**D13. Competing first actions on an empty dashboard.** A new user sees the same task offered four ways at once: the "Add your first account" checklist link, the "+ Add" affordance in each card header, an "Add account" button inside each card's empty state, and the checklist's "Import or add a transaction" link. No single primary action is emphasised.

**D14. Small type in sheets.** The Shared bill and Split across categories checkbox labels in Add Transaction compute to 12px on mobile, below the tier the previous audit's type-scale sweep established for phones.

---

## Minor findings

- Mobile sheets render two "Close" controls (the sheet's own plus the modal body's).
- The bottom bar says "Comp" where the sidebar says "Compensation".
- Focus rings are inconsistent: some controls use a 2px accent-gold outline, others fall back to the browser's default grey `outline: auto`, sometimes 2px and sometimes 3px.
- The Salary & Tax page emphasises two cards with the same gold border treatment (Total Income Tax and Net Annual), so there is no single primary figure.
- The Mortgage page shows two segmented controls in two different visual styles on the same row (Payment / Affordability uses a gold-outlined active pill, Monthly / Biweekly uses gold text on a white-bordered inactive pill).
- The Forecaster's "fill from" chips ("Dashboard Net Worth", "Budget Average (3 Months)") sit on the label line and are styled as badges rather than buttons, and the two input rows do not align to the same grid.
- Section headers use three registers across the app: serif title case ("Total Compensation"), uppercase micro-labels ("EXTRA PAYMENTS", "TOTAL PLANNED") and sentence case.
- Recharts surfaces are `role="application"` with no `aria-label`.
- The app scrolls an inner container rather than the document, so full-page screenshots and browser print capture only one viewport.

---

## What works well

- **The phone build holds up.** Re-measured independently: zero horizontal overflow on all 8 routes at both 320 and 390, zero inputs below 16px, and the only sub-44px targets found were the skip link (visually hidden by design) and an inline link inside a sentence, which WCAG exempts. The previous audit's fixes are real.
- **Text contrast is excellent.** Zero failures across four routes in all five themes, measured against composited backgrounds at the correct AA threshold for each size and weight.
- **The Sheet component is well built.** Focus held inside the panel across 40 consecutive Tab presses with zero escapes, Escape closes, body scroll locks, focus restores to the trigger on desktop, safe-area padding is applied and reduced motion is respected.
- **Destructive-action copy is specific.** The clear-transactions dialog names the exact count, warns that rows hidden by the current filter are included, and tells the user undo is available.
- **The command palette works.** Ctrl+K, autofocus on desktop, listbox and option roles, arrow keys and Enter navigate correctly, and 17 commands with descriptive subtitles.
- **Salary & Tax is the best screen in the app.** Labelled inputs with unit prefixes, a bracket visualisation that explains why the marginal rate exceeds the bracket rate, a legend on the stacked bar, and a clear primary/secondary stat hierarchy.
- **Investments empty state and allocation legend** are the strongest patterns in the app and should be the template for the rest of it.
- **Five complete themes**, all passing text contrast, with a genuine identity shift between them (the light theme switches headings from serif to sans) rather than a recoloured palette.
- **Error boundary per route, a working skip link, `aria-current` on nav, labelled icon buttons, and a Suspense fallback with `role="status"`.**

---

## Recommended order of work

1. **B1** (768px account names) and **B2** (unlabelled fields, silent submit failure). Both are user-blocking and small.
2. **B3** (invisible focus, hover-only controls on touch). One shared fix across five call sites.
3. **B4** and the breakpoint reconciliation behind it. Pick one boundary. The cheapest safe step is to redefine `md:` to match `desktop:`, then audit the 138 usages for anything that genuinely wanted width alone.
4. **M2** (tab semantics plus tab state in the URL) and **M6** (page titles). Both improve keyboard, screen-reader and plain-browser behaviour at once.
5. **M1** and **D5**: standardise on the Investments legend pattern for every chart, and fix the Mortgage axis formatting.
6. **M4**: reconcile the two portfolio totals and promote the FX exclusion notice into something actionable.
7. **M3** (border contrast), **M5** (table semantics and sorting), then the D-series.
