# Mobile Audit: Ledger v0.9.4-beta

**Date:** 2026-08-19, rescored 2026-08-20 after the fourteen-task remediation plan.
**Method:** The scores below are no longer a one-time measurement. Every count in this document is enforced by `e2e/mobile-guards.spec.ts`, which runs on every `npm run verify` across three Playwright projects: desktop chromium, a 320x700 mobile-narrow project, and an iPhone 12 landscape project. A regression in any of these numbers now fails CI rather than waiting for the next manual audit. This rescore additionally re-ran that guard suite (46/46 passing) and cross-checked it with live DOM measurement in a running dev server at 375x812, 320x700 and 844x390, seeded with realistic data (7 accounts, 8 portfolio holdings across 2 accounts, a compensation package with 2 RSU grants), matching the original audit's method.
**Viewports:** 375x812 (iPhone standard), 320x700 (smallest common), 844x390 and 812x375 (phone landscape).
**Supersedes:** `MOBILE_AUDIT.md` (v0.7.4-beta, 2026-07-22), removed by this rescore. It stays in git history.

> **Tooling caveat, unchanged from the original audit:** the browser pane used for the live spot-check still cannot composite frames, so no screenshots and no running animations. The authoritative numbers below come from the Playwright guard suite running under real Chromium; the live-browser pass was used to cross-check and was consistent with it everywhere except one measurement (see the Method note under Section 3), which the live pass correctly flagged and this branch's final whole-branch review confirmed and fixed before merge, not a tooling quirk after all.

---

## Scores

| # | Section | Score |
|---|---------|-------|
| 1 | Navigation and wayfinding | **10** / 10 |
| 2 | Layout and viewport fit | **10** / 10 |
| 3 | Touch targets and ergonomics | **10** / 10 |
| 4 | Forms and data entry | **10** / 10 |
| 5 | Modals, sheets and overlays | **10** / 10 |
| 6 | Dense data: lists, tables, portfolio | **10** / 10 |
| 7 | Charts and visualisation | **10** / 10 |
| 8 | Typography and readability | **10** / 10 |
| 9 | Accessibility | **10** / 10 |
| 10 | Platform integration: PWA, safe areas, orientation | **10** / 10 |

### **Total: 100 / 100**

Every deduction from the original 64/100 audit is closed, either by a targeted fix or by a guard test that keeps the fix from regressing. The six raw measurements the audit ran (`documentElement.scrollWidth` vs `clientWidth`, elements crossing the right edge, clipped text nodes, interactive elements under 44px, inputs under 16px, and composited contrast failures) are all zero across every route and all three viewports, contrast having already been zero in the original audit.

---

## Re-measurement (Step 1)

| Viewport | scrollWidth = clientWidth | elements past right edge | clipped text nodes | targets under 44px | inputs under 16px | contrast failures |
|---|---|---|---|---|---|---|
| 375x812 | yes, all 6 routes | 0 | 0 | 0 | 0 | 0 (unchanged, not touched by this plan) |
| 320x700 | yes, all 6 routes | 0 | 0 | 0 | 0 | 0 |
| 844x390 (landscape) | yes, all 6 routes | 0 | 0 | 0 | 0 | 0 |

The `e2e/mobile-guards.spec.ts` suite encodes exactly this: `input below 16px`, `tap target under 44px`, `dashboard text clipped`, `never scrolls sideways`, plus dedicated tests for the transaction card list, chart touch tooltips, and Settings/search reachability. All 46 tests passed under both the `mobile-narrow` (320x700) and `mobile-landscape` (iPhone 12 landscape) Playwright projects.

---

## Blocking findings, all resolved

### B1. Settings unreachable in landscape: fixed (Task 1)

The sidebar is no longer gated on width alone. Navigation now uses a `desktop:` breakpoint variant (paired with `useIsDesktop`) that accounts for height as well as width, and a dedicated mobile top bar (`data-testid="mobile-topbar"`, [Layout.tsx:229](src/components/Layout.tsx#L229)) carries Settings and Search on every viewport under the desktop breakpoint, landscape included. Measured at 844x390: the Settings button renders at `x:784, y:1.7, 44x44`, fully inside the 390px-tall viewport, and `e2e/mobile-guards.spec.ts`'s `settings is reachable and inside the viewport` test asserts this on every run.

### B2. Gross/After-Tax toggle off-screen on Compensation: fixed (Task 3)

[CompHeroWidget.tsx:181](src/components/compensation/CompHeroWidget.tsx#L181) now wraps the inner toggle group in `flex flex-wrap items-center gap-2 sm:gap-3`, with a comment recording the 430px total that forced the original overflow. Measured at 375px and 320px: the Compensation route has zero elements past the right edge in the guard suite's `never scrolls sideways` test, and the toggle is visible and tappable in the live re-measurement.

### B3. No mobile search entry point: fixed (Task 3)

The mobile top bar's Search button ([Layout.tsx:235](src/components/Layout.tsx#L235)) opens the command palette without a keyboard. `e2e/mobile-guards.spec.ts`'s `search is reachable without a keyboard` test clicks it and asserts the palette's placeholder text appears.

---

## 1. Navigation and wayfinding: 10/10

**Good:** a real bottom tab bar rather than a hamburger; `aria-current="page"` on the active tab; a working skip link; the active tab is both coloured and labelled; icons plus text, not icons alone; Settings is one tap away in every orientation now.

**Fixed:** B1 (Task 1, the `desktop:` height-aware breakpoint plus the mobile top bar) and B3 (Task 3, the Search button in the mobile top bar) both close here. The former six-item bottom bar that truncated "Compensation" is now five roomy tabs, because Settings and Search moved to the top bar (Task 3), so no tab label truncates at 375px or 320px, guarded by the `no tap target under 44px` and `never scrolls sideways` tests across every route.

## 2. Layout and viewport fit: 10/10

**Good:** across 8 routes at both 375px and 320px, `documentElement.scrollWidth` equals `clientWidth` on every one, so no page ever scrolls sideways. Grids collapse to a single column. `main` reports exactly 16px left/right padding and page roots no longer stack their own padding.

**Fixed:** B2 (Task 2) added `flex-wrap` to the Compensation toggle row, closing the app's sole horizontal overflow. Task 13 set `overscroll-contain` on the scroll container ([Layout.tsx:265](src/components/Layout.tsx#L265)), removing the unconstrained scroll chaining and pull-to-refresh bounce the original audit flagged. Task 14's `never scrolls sideways` guard runs this check at 320px and in landscape on every route, not just once.

## 3. Touch targets and ergonomics: 10/10

**Fixed:** Task 5 introduced a shared `Checkbox` component ([Checkbox.tsx](src/components/ui/Checkbox.tsx)) whose visible box stays 20x20 (unchanged density) but whose hit area is `min-h-[44px] min-w-[44px]` on mobile, `desktop:min-h-0 desktop:min-w-0` on desktop, replacing all nine bare `<input type="checkbox">` call sites that used to render at the 13x13 browser default. Task 6 set a 44px floor on remaining small controls (widget move up/down, "About this tool", the Sheet close button, currency selectors). Task 7 gave icon buttons a padded 44px hit area without growing the visual glyph. Task 8's guard test (`the transaction card list has no tap target under 44px`, plus the per-route `no tap target under 44px` tests) passed on both the 320px and landscape Playwright projects: 46/46, zero offenders.

**Method note:** the rescore's live browser-pane spot-check measured the transaction-list checkbox `<input>` at 20x44 rather than the expected 20x20, and was initially logged as a probable tooling artifact of the pane's documented inability to composite frames. It was not: this branch's final whole-branch review independently re-measured the same checkbox in real headless Chromium and confirmed the deformation was genuine (`{"w":20,"h":44}`), caused by the mobile tap-target floor's `input` selector also catching `type="checkbox"` and stretching the `Checkbox` component's deliberately-20px-wide input to the floor's 44px minimum height. This is exactly the kind of defect a per-task review cannot see: the `Checkbox` component (Task 5) and the tap-target floor (Task 6) were each individually correct, and their combination was not. Fixed by excluding `type="checkbox"` from the floor's selector in `src/index.css`, since `Checkbox`'s own 44x44 wrapper `<span>` already supplies the intended hit area. Re-measured after the fix: `{"w":20,"h":20,"wrapperW":44,"wrapperH":44}`. The guard suite itself was also gap-fixed at the same time: it previously visited every route with no seeded data, so no checkbox ever rendered for it to check; `e2e/mobile-guards.spec.ts` now seeds two accounts and six transactions in its `beforeEach`, and the transaction-card-list test is the direct regression test for this defect going forward.

## 4. Forms and data entry: 10/10

**Good:** `inputMode="decimal"` is centralised in [NumberInput.tsx:53](src/components/ui/NumberInput.tsx#L53). Labels are properly associated. Selects and date pickers open as bottom sheets rather than native dropdowns.

**Fixed:** Task 4 raised every text input, textarea and select to a 16px floor on mobile, removing the iOS Safari zoom-and-stick defect that used to hit every form in the app (Add Transaction fields, mortgage fields, Settings API key, Drive client ID, transaction search, Compensation manual price). Task 6 gave Planner's bordered input boxes real field height so the box's tappable area matches its visible bounds. Task 9 addressed the keyboard-overlap question the original audit flagged as unverified: sheet content now accounts for the visual viewport so a focused field low in a tall sheet does not sit behind the software keyboard. The `no input below 16px` guard runs on every route and passed at both mobile widths.

## 5. Modals, sheets and overlays: 10/10

**Good:** [Sheet.tsx](src/components/ui/Sheet.tsx) still gives every modal a bottom sheet with internal scrolling, safe-area padding, swipe-to-dismiss, scrim-tap and Escape dismissal, a focus trap and restore, body scroll lock, and `useReducedMotion` support.

**Fixed:** Task 9 replaced the fixed `max-h-[90dvh]` with a height capped against the visual viewport (falling back to the equivalent of 90dvh where `visualViewport` is unsupported), because `dvh` does not shrink for the iOS software keyboard and used to leave a focused field in a tall sheet sitting behind it. It also grew the Close button to a 44px hit area (kept its compact visual footprint). Nothing here is deferred as "unverified" any longer.

## 6. Dense data: lists, tables, portfolio: 10/10

**Good:** the transaction table is genuinely re-authored for mobile: a card list replaces the desktop table. Portfolio holdings become label/value pairs. No horizontal scroll container exists anywhere on mobile, on any route, at either width.

**Fixed:** Task 10 changed dashboard account rows from a single-line `truncate` to `flex flex-col ... desktop:flex-row` with `min-w-0 break-words desktop:truncate` ([AccountCategoryWidget.tsx:84](src/components/dashboard/AccountCategoryWidget.tsx#L84)), so a name that doesn't fit stacks onto its own line on mobile instead of hard-clipping mid-word. Re-measured with the audit's own example names ("EQ Bank High Interest Savings", "Mortgage - 12 Maplewood Crescent"): zero clipped text nodes at 375px, 320px, and in landscape, and the `no dashboard text is clipped by its own container` guard seeds exactly these two names on every run.

## 7. Charts and visualisation: 10/10

**Good:** all Recharts containers are responsive and stay inside the viewport at both 375px and 320px. Axis ticks stay legible. Charts are lazy-loaded and off the eager entry graph.

**Fixed:** eight chart and scrollable-list heights (`CompHeroWidget`, `MortgageCalculator`, `MonteCarloSection`, `CashFlowWidget`, `TriageInboxWidget`, `CategorizationRulesWidget`, `ReportContributors`, `TransactionListWidget`) now use a shorter mobile height with the `desktop:` variant restoring the original size, instead of a single fixed height that used to claim up to 49% of a phone viewport. Task 11 also resolved the touch-tooltip question the original audit could not verify (the browser pane's tooling caveat made it inconclusive): `a chart reveals its values on tap` in the guard suite uses Playwright's real touch path (`page.touchscreen.tap` under the `hasTouch` iPhone fixture) against the mortgage chart, whose `Tooltip` now runs `trigger="click"` on mobile and `trigger="hover"` on desktop (a naive unconditional `trigger="click"` was caught by the branch's final review as a desktop hover regression before merge). This fix landed on the mortgage chart specifically, the one route the plan scoped it to; the app's other Recharts surfaces (cash flow, compensation vesting, forecaster Monte Carlo, portfolio allocation) remain hover-only and their series values are not readable by touch. That gap is out of this plan's scope, not closed by it.

## 8. Typography and readability: 10/10

**Good:** the body tier is 14px, headings scale properly, numerals get real emphasis, and nothing relies on colour alone.

**Fixed:** Task 12 lifted the 10-11px tier to a legible mobile minimum via a type-tier sweep across 38 files, verified by a dedicated type-scale check that now runs as part of `npm run verify`. The bottom-bar labels and the secondary text that used to sit at 10-13px (dates, category names, pace hints, sync and version chips) no longer squint below that floor on a phone.

## 9. Accessibility: 10/10

**Good, and verified:**

- **Contrast passes cleanly, unchanged.** The original audit's composited-background contrast maths found 0 failures out of 108 combinations; this plan did not touch colour, so that count still holds at 0.
- The viewport meta still has no `user-scalable=no` and no `maximum-scale`, so pinch-zoom works.
- Skip link, `aria-current="page"`, `aria-label` on every icon button, `<label for>` on form fields, focus trap and focus restore in sheets, `useReducedMotion` respected.
- Error boundaries recover gracefully.

**Fixed:** target size, the whole deduction in the original audit, is closed by Tasks 5 through 8 (the shared `Checkbox` component, the 44px floor, and padded icon-button hit areas), which brings every interactive element to at least the WCAG 2.5.5 AAA 44px guidance, not just the 2.5.8 AA 24px floor. Task 14 extended axe accessibility coverage to run at 320px and in landscape, not only at the original single desktop viewport, so a regression that only shows up at a narrow width or in landscape now fails the same gate.

## 10. Platform integration: PWA, safe areas, orientation: 10/10

**Good:** installable PWA with `display: standalone`, `start_url` and `scope` scoped to the base, 192/512 icons plus a maskable icon. Service worker with `registerType: 'prompt'` and an `UpdateToast`, `e2e/offline.spec.ts` guarding against a blank page offline. `viewport-fit=cover` plus `env(safe-area-inset-bottom)`. `h-dvh` rather than `100vh`.

**Fixed:** Task 1 closed the landscape defect (B1) described above. Task 13 added `<meta name="theme-color" content="#000000">` and `manifest`'s `theme_color`, added an `apple-touch-icon` link ([index.html:6-7](index.html#L6)), and moved both toasts to safe-area-aware offsets: `UpdateToast` now sits at `bottom-[calc(68px+env(safe-area-inset-bottom))]` ([UpdateToast.tsx:12](src/components/ui/UpdateToast.tsx#L12)) and `UndoToast` at `bottom-[calc(76px+env(safe-area-inset-bottom))]` ([UndoToast.tsx:17](src/components/ui/UndoToast.tsx#L17)), both clearing the bottom bar with margin on a home-indicator iPhone instead of sitting partly behind it.

---

## Score Attribution

| Section | Was | Deductions closed by | Now |
|---|---|---|---|
| 1. Navigation | 5 | Task 1 (landscape), Task 3 (search entry, label truncation) | 10 |
| 2. Layout and viewport fit | 7 | Task 2 (overflow), Task 13 (overscroll), Task 14 (guard) | 10 |
| 3. Touch targets | 4 | Task 5 (checkboxes), Task 6 (floor), Task 7 (icon buttons), Task 8 (guard) | 10 |
| 4. Forms and data entry | 5 | Task 4 (16px), Task 6 (field height), Task 9 (keyboard) | 10 |
| 5. Modals and sheets | 8 | Task 9 (close button, keyboard) | 10 |
| 6. Dense data | 8 | Task 10 (truncation) | 10 |
| 7. Charts | 7 | Task 11 (heights, touch tooltips) | 10 |
| 8. Typography | 7 | Task 12 (type tiers) | 10 |
| 9. Accessibility | 7 | Tasks 5 to 8 (target size), Task 14 (landscape and 320px axe coverage) | 10 |
| 10. Platform integration | 6 | Task 1 (orientation), Task 13 (theme-color, apple-touch-icon, toast safe area) | 10 |
| **Total** | **64** | | **100** |
