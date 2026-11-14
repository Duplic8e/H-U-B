# Ledger v2.0 — Progress Tracker

> **Fable 5: this is your resume anchor.** Read it first on every "continue". Keep it accurate — update it in (or immediately after) the same commit as each task. If it disagrees with `git log`, trust git and reconcile.

**Milestone:** v2.0 (see `2026-07-02-ledger-v2-master-plan.md`)

## Current position

- **Current phase:** ALL PHASES COMPLETE — v2.0 milestone done (2026-07-04); awaiting merge/PR decision
- **Phase plan:** umbrella `2026-07-02-phase-4-planner.md` + sub-plans 4a-4e — **ALL written in full** (4b/4c/4d/4e written 2026-07-03; 4d includes sourced 2026 CRA/provincial tax tables)
- **Later phase plans:** ALSO written in full (2026-07-03) — `…phase-5a-plan-vs-actual.md`, `…phase-5b-portfolio-viewer.md`, `…phase-6-budgeting-enhancements.md`, `…phase-7-uiux-refresh.md`. No JIT planning remains; execute plans in order.
- **Testing policy change (user, 2026-07-03):** plans 4b onward keep TDD only for pure math/store modules; UI components get no dedicated test files (covered by the registry-driven hub test + manual gates). Tests are not a priority this release.
- **Last completed task:** FINAL WHOLE-BRANCH REVIEW passed after fixes — ErrorBoundary f68a328 + null-safe widget resolution 116f329 (review verdict: ready to merge)
- **Next task:** none — awaiting user's merge/PR decision
- **Deferred follow-ups (post-merge tickets):** geometric theme `--accent` (#3b82f6 on white = 3.68:1) fails WCAG AA for normal text — token-level design decision; delete-or-wire unused Skeleton primitive; theme-token the comp-chart hex color arrays (pre-existing v1.0); market-data cache eviction/TTL; wire clearManualPrice button in Compensation. (Former crash-class deferrals — malformed RSU, garbage backup import — are now contained by the app-level ErrorBoundary.)
- **Status:** IN PROGRESS (branch `ledger-v2`)

**Note:** `npm run lint` has 287 pre-existing errors from v1.0 (none in files this milestone touched — all branch files lint clean). The per-phase "lint clean" gate is applied to changed files until the pre-existing debt is addressed; surfaced to the user 2026-07-02.

## Phase checklist

- [x] Phase 1 — Foundation: Save + PWA + Mobile base (2026-07-02)
- [x] Phase 2 — Market Data Service (2026-07-02)
- [x] Phase 3 — Compensation: live price + CAD toggle (2026-07-02)
- [x] Phase 4 — Planner (tools/calculators hub) — 12 tools + FIRE forecaster (2026-07-03)
- [x] Phase 5a — Investments: Plan vs Actual (2026-07-03)
- [x] Phase 5b — Investments: Portfolio Viewer (2026-07-03)
- [x] Phase 6 — Budgeting enhancements (2026-07-04)
- [x] Phase 7 — UI/UX 2026 refresh + Dashboard polish (2026-07-04) — **v2.0 MILESTONE COMPLETE**

## Log (append one line per completed task)

<!-- e.g. "2026-07-02 P1.T1 backup core — commit abc1234" -->
2026-07-02 P1.T1 backup export/import core — commit baf5f63 (review clean; + a4ed65a npm test script)
2026-07-02 P1.T2 backup blob/filename/parse helpers — commits 16ffd07 + 7cfb265 (review clean after DRY fix)
2026-07-02 P1.T3 backup UI in nav dock — commits 3fbe5a8 + 7cc061d (added --error token to all 6 themes; input reset fix)
2026-07-02 P1.T4 PWA manifest + real icons — commits e85ed42 + cff1893 (sharp devDep; fixed pre-existing tsc blocker in T3 test)
2026-07-02 P1.T5 mobile viewport-fit + overflow guards — commit 0fe19c3 (review clean)
2026-07-02 P1.T6 phase gate — tests 12/12, build OK, branch files lint-clean (287 pre-existing v1.0 lint errors flagged), 375px no-overflow verified on all 5 routes in live preview, backup UI + error token verified live
2026-07-02 P2.T1 market-data types + date helpers — commit 577bff1 (review clean)
2026-07-02 P2.T2 cache keys + throttle/single-flight — commits 1378107 + 96a5d21 (review clean after coverage additions)
2026-07-02 P2.T3 Yahoo provider adapter — commit e398bc2 (review clean)
2026-07-02 P2.T4 Frankfurter FX adapter — commit 981ca4e (review clean; implementer cut off by session limit, tests verified by controller)
2026-07-02 P2.T5 market-data cache store + backup registration — commit c8a7f53 (review clean)
2026-07-02 P2.T6 market-data service facade — commit c125e72 (review clean; 2 triage notes for final review)
2026-07-02 P2.T7 market-data hooks + barrel — commits 8d4ee0b + b831868 (review clean after unmount-guard/override-subscription fixes)
2026-07-02 P2.T8 phase gate — commit 217757d fixed tsc vitest-globals types + set-state-in-effect lint; 51/51 tests, build OK, changed files lint clean, ledger-market-data in BACKUP_KEYS
2026-07-02 P3.T1 useCadConversion toggle in compensation store — commit 101d040 (review clean)
2026-07-02 P3.T2 convertPackageToCad pure FX layer — commit e5201c0 (review clean)
2026-07-02 P3.T3 useCompensationDisplay hook + companyTicker field — commits d9028e6 + 71aa856 (review caught live-price/CAD-toggle coupling; fixed)
2026-07-02 P3.T4 Compensation page live-price bar + CAD toggle — commit de94b4c (review clean)
2026-07-02 P3.T5 widgets read converted package — commit 5259588 (review clean)
2026-07-02 P3.T6 conversion correctness tests — commit b557c4e (plan's ESPP×FX expectation was mathematically wrong; amended to FX-invariant, reviewer-verified)
2026-07-02 P3.T7 CompensationModal ticker field — commit 52cb8ec (review clean)
2026-07-02 P3.T8 phase gate — 71/71 tests, build OK, changed files lint clean (+0513003 pre-existing lint fix); live-verified at 375px in all themes: modal ticker field, price bar, refresh, manual set, CAD toggle ON/OFF with FX fallback, no overflow
2026-07-02 P4a.T1 planner store (ledger-planner) + backup registration — commit 4c11b3c (review clean)
2026-07-02 P4a.T2 compound-interest math module — commit 623f23a (review clean, math independently verified)
2026-07-02 P4a.T3 savings-goal solvers — commit 04705ca (review clean, math independently verified)
2026-07-02 P4a.T4 calculator UI primitives — commit 5d9c33d (review clean)
2026-07-03 planning — wrote all remaining JIT plans in full: 4b, 4c, 4d (2026 CRA tables sourced + cited), 4e, 5a, 5b, 6, 7; minimal-test policy applied per user
2026-07-03 P4a.T5 Planner hub + tool registry + routes (Projections removed) — commit 03c4c2f (review clean; recovered from interrupted session)
2026-07-03 P4a.T6 Compound Interest calculator — commit dbfe728 (review clean; CalculatorField htmlFor/id a11y fix folded in, adjudicated OK)
2026-07-03 P4a.T7 Savings Goal calculator (solve any variable) — commit a0ff23f (review clean)
2026-07-03 P4a.T8 sub-phase gate — 112/112 tests, build OK after Recharts Tooltip typing fix (f79e7c7), changed files lint clean; live-verified: nav rename, /projections redirect, 3 tiles, invalid-id bounce, both calculators compute + persist across reload, all 4 solve-for modes, 5 themes on 3 routes (chart uses theme accent), 375px no-overflow/single-column tiles/2-col fields. Known: full-width sidebar squeezes 375px content (labels crowd) — Phase 7 reflow, logged since P1.
2026-07-03 P4b.T1 pure budget selectors (monthly totals, rolling averages) — commit 76ab10d (review clean)
2026-07-03 P4b.T2 Emergency Fund calculator (budget-average prefill) — commit 50cd3fc (review clean)
2026-07-03 P4b.T3 Currency Converter (live FX + manual fallback) — commit 422b22a (review clean)
2026-07-03 P4b.T4 Raise/Inflation calculator (Fisher real raise) — commit b652c99 (review clean)
2026-07-03 P4b.T5 sub-phase gate — 120/120 tests, build OK, changed files lint clean; live-verified: 6 hub tiles, emergency-fund prefill/presets/progress/persistence, currency-converter manual-override fallback (offline path; live FX unverifiable in sandboxed preview) + swap + reload persistence, raise-inflation verdicts (1.94% / -1.92%), 5 themes x 3 tools, 375px no overflow
2026-07-03 P4c.T1 amortization math (payment/inverse/schedule+extra) — commit 0df4829 (review clean, math hand-verified)
2026-07-03 P4c.T2 debt payoff simulation (snowball/avalanche) — commits 20961e1+00ca318 (review caught min-payment starvation, fixed; PLAN AMENDMENT: brief's strategy-test fixture unsatisfiable, replaced with discriminating fixture, reviewer-verified)
2026-07-03 P4c.T3 Debt Payoff calculator (avalanche vs snowball + chart) — commits ee0e9b1+3d45c39 (review caught tooltip label regression in tsc fix; restored)
2026-07-03 P4c.T4 Mortgage calculator (payment + affordability) — commit 8a431d2 (review clean)
2026-07-03 P4c.T5 Rent-vs-Buy (unrecoverable-cost math + crossover chart) — commit 3f7012a (review clean, math hand-verified)
2026-07-03 P4c.T6 sub-phase gate — 138/138 tests, build OK, lint clean after Date.now->crypto.randomUUID purity fix (688211d); live-verified: 9 tiles, debt CRUD + strategy switch + reload persistence, mortgage payment/affordability modes, rent-vs-buy break-even flip (renting wins -> Year 1 on rent bump) + persistence, 5 themes x 3 tools, 375px no overflow
2026-07-03 P4d.T1 2026 Canada tax module (sourced tables, CPP/CPP2/EI, take-home) — commit 6321a07 (review clean; tables diff-verified zero deltas, math hand-verified)
2026-07-03 P4d.T2 Take-Home Pay calculator (2026, all provinces) — commit 7159af9 (review clean)
2026-07-03 P4d.T3 Income Tax Estimator (marginal/effective + bracket bars) — commit 5b8958c (review clean)
2026-07-03 P4d.T4 RRSP-vs-TFSA optimizer (marginal-rate driven) — commit fce6bb3 (review clean, math hand-verified)
2026-07-03 P4d.T5 sub-phase gate — 153/153 tests, build OK, lint clean; live-verified: 12 tiles, take-home $100k ON=$73,460 exact + QC abatement/EI check, income-tax marginal 31.48% exact + bracket bars, RRSP-vs-TFSA Either/RRSP verdicts, persistence, 5 themes x 3 tools, 375px no overflow
2026-07-03 P4e.T1 deterministic forecast engine (bands/step-up/lumps/real/drag) — commit ef4949e (review clean, math hand-verified)
2026-07-03 P4e.T2 FIRE math (FI number, months-to-target, Coast-FI) — commit 5d69cc6 (review clean, math hand-verified)
2026-07-03 P4e.T3 Monte Carlo simulation (mulberry32, Box-Muller, percentile bands) — commits b95f3a1+9256631 (review caught fractional-year band bug, fixed)
2026-07-03 P4e.T4 compensation lump-sum feed (RSU/bonus/ESPP -> LumpSum) — commits 30bbf4a+55f1c43 (review caught same-month event drop, fixed)
2026-07-03 P4e.T5 forecaster settings hook + auto-feed resolution + ListEditor — commit 0596119 (review clean)
2026-07-03 P4e.T6 forecast chart (history + bands + stacked + goal markers) — commit 80329ae (review clean)
2026-07-03 P4e.T7 FIRE forecaster tool page + registry swap (ProjectionWidget deleted) — commit a919c32 (review clean)
2026-07-03 P4e.T8 Monte Carlo section (percentile fan + success probability) — commit 340589f (review clean)
2026-07-03 P4e.T9 PHASE 4 GATE — 175/175 tests, build OK, lint clean; spec 'Done when' verified end-to-end live (12 tools, auto-feeds, all forecaster views, persistence, 5 themes, 375px, offline). New triage: malformed RSU grant in storage blanks app (no error boundary). PHASE 4 COMPLETE.
2026-07-03 P5a.T1 analysis store (ledger-analyses) + backup registration — commit 37f08bc (review clean)
2026-07-03 P5a.T2 analysis metrics (lots, P/L, counterfactual, variance) — commit 0cd5677 (review clean, math hand-verified)
2026-07-03 P5a.T3 analysis entry modal (historical start-price autofill + override) — commit b9e3b69 (review clean)
2026-07-03 P5a.T4 analysis card (live P/L, variance, counterfactual, lots) — commits 20213ef+e816343 (review caught missing error surface + manual override, fixed)
2026-07-03 P5a.T5 Investments page rebuilt as plan-vs-actual journal; v1.0 mock tracker deleted — commit 0074420 (review clean)
2026-07-03 P5a.T6 sub-phase gate — 185/185 tests, build OK, lint clean; live-verified: modal + manual fallback, lot metrics hand-checked (avg 113.33, P/L +32.4%), allocations/totals, manual override + clear, persistence + wipe/restore, 5 themes, 375px. Live-network autofill unverifiable in sandbox (error path exercised). PHASE 5a COMPLETE.
2026-07-03 P5b.T1 portfolio store (ledger-portfolio) + backup registration — commit f0650fd (review clean)
2026-07-03 P5b.T2 portfolio CSV parsing (IBKR + Wealthsimple + generic mapper) — commit 8049cfa (review clean)
2026-07-03 P5b.T3 portfolio valuation metrics (CAD normalization) — commit 4c01913 (review clean, math hand-verified)
2026-07-03 P5b.T4 portfolio CSV import UI (auto-detect + column mapper) — commit f731d21 (review clean)
2026-07-03 P5b.T5 holdings table + CAD totals + Investments tabs — commit cda106e (review clean)
2026-07-03 P5b.T6 sub-phase gate — 199/199 tests, build OK, lint clean; live-verified: WS auto-detect + mapper paths (math hand-checked), override in fallback chain, replace/clear/persistence, journal intact, 5 themes, 375px table-in-card scroll. PHASE 5b COMPLETE.
2026-07-03 P6.T1 recurring/subscription detection — commit 1a50e29 (review clean, logic hand-traced)
2026-07-04 P6.T2 category stats + anomaly detection — commit 55f9e04 (review clean; thresholds + sign convention verified)
2026-07-04 P6.T3 month-end cash-flow forecast — commit 6fd275d (review clean; projection semantics verified, loop bounded)
2026-07-04 P6.T4 smart widgets: subscriptions/anomaly/forecast + Insights row — commit 4435c21 (review clean; interfaces + theme tokens verified)
2026-07-04 P6.T5 Sankey income-flow widget — commit 1a629eb (review clean; custom node renderer deviation brief-anticipated, theme-vars only)
2026-07-04 P6.T6 category sparklines + budget pace bars — commits 8622b9e+fe0bfcd (review caught UTC/local clock mix in pace check; fixed)
2026-07-04 P6.T7 spending calendar heatmap — commit 1dacc9c (review clean; calendar + opacity math verified)
2026-07-04 P6.T8 PHASE 6 GATE — 209/209 tests, build OK, changed files lint clean; live-verified: subscriptions $1,517/mo (rent+Netflix, grocery correctly rejected), anomalies 3.6×/2.3× with steady categories silent, forecast −2,125+5,000−1,517=1,358 with 4 pending rows, Sankey flows (July expense-only, June Salary→3 groups, empty month → empty state no crash), heatmap day totals hand-checked, pace bars over-pace correct at day 4/31, month selector drives all visuals; regression pass: CSV import → triage (2) → categorize+approve to store, rules UI, paradigm switch both ways, add-transaction modal, reload persistence; 5 themes verified via computed styles (accent/text vars propagate to heatmap/Sankey/sparklines); 375px no horizontal scroll (known pre-existing sidebar squeeze deferred to Phase 7). Preview screenshot tool timed out (harness) — verification DOM/computed-style based. PHASE 6 COMPLETE.
2026-07-04 P7.T1 dashboard rollups + trend; mock store deleted — commits 6d8bfba+1452757 (review caught missing BudgetHealth empty state; fixed)
2026-07-04 P7.T2 drag-to-reorder dashboard + ledger-dashboard-layout store — commits adce1d4+5ea660e (review flagged render-scoped registry + dragend; fixed)
2026-07-04 P7.T3 mobile bottom tab navigation + safe-area — commit 281c13e (review clean; components reused not duplicated)
2026-07-04 P7.T4 motion polish: AnimatedNumber/PageTransition/Skeleton — commit 6dac964 (review clean; CompHero skeleton validly skipped, lint adaptation drift-free)
2026-07-04 P7.T5 command palette Ctrl/Cmd+K — commit 6cf52a9 (review clean; mobile-row overflow fix disclosed + adjudicated)
2026-07-04 P7.T6 a11y pass + v2.0 MILESTONE GATE — commit 4ef7877 (a11y: 5 modals Escape+dialog role, ~12 focus-visible rings, sidebar aria-current; contrast AA verified computationally across 5 themes×4 routes except geometric accent-token defect, deferred). Gate: 215/215 tests, build OK, lint total unchanged (285 pre-existing); live-verified: all 5 rollups empty-state (fresh profile) AND populated (math hand-checked: remaining $280=1900−1620, portfolio 10×130, goal 83%), trend chart renders, layout order persists + resolves (stored-first/defaults-appended), ⌘K opens/filters/navigates/Escapes in all 5 themes, mobile: bottom bar + hidden sidebar + full-width main (375px sidebar squeeze FIXED — logged since P1) + 52px targets + no h-scroll on all 5 routes + forecaster + 2 calculators, mobile ⌘K/Backup/Theme row reachable. Sandbox limits (as all prior gates): offline toggle, Lighthouse, backup file round-trip (unit-tested incl. new layout key; UI present) not live-exercised; drag gesture verified via persisted-order path, not synthetic DnD. PHASE 7 + MILESTONE v2.0 COMPLETE.

2026-08-17 v0.9.2-beta Task 15/15 — AUDIT REMEDIATION GATE CLOSED. Combined `npm run verify` script added (lint + full unit suite + build + bundle budget + e2e in sequence). Final state: 1118 unit tests across 177 files, eslint 0 problems, `tsc -b` and `vite build` both clean, all bundle budgets met (entry chunk `index-BM47DIBF.js` 233.4 kB, largest chunk `charts-CU61cV25.js` 364.9 kB), 11/11 Playwright e2e specs passing including 5/5 routes at zero serious/critical axe violations (dashboard, budgeting, investments, compensation, planner), offline and transactions specs green. Flakiness investigation: `TransactionListWidget selection at scale › keeps selection scoped to visible rows when the search narrows` (flagged from Task 8's virtualization work) was reproduced twice running the full suite standalone, timing out at its 30s cap; root cause found and fixed, not band-aided — jsdom never lays out elements so the scroll container's `clientHeight` reads 0, which trips `computeWindow`'s documented "not measured yet" fallback and renders all 600 (then 100) transaction rows into jsdom on every assertion, correct behavior but expensive under load. Test now stubs a realistic `clientHeight` before rendering so the widget windows rows the same way a real browser would; the single test dropped from ~12-35s to well under 1s, and the full suite subsequently passed clean 3/3 runs in a row. Audit dimensions closed by this plan: performance (bundle budget, chart isolation, precache exclusion, selection cost, virtualization — Tasks 4, 5, 8, 9), accessibility (axe gate, contrast, heading structure, skip link, keyboard operability — Tasks 2, 3, 6, 9), UX (sidebar dock, dismissal — Tasks 10, 11), engagement (demo mode backup exclusion, recurring bill reminders, permission timing — Tasks 12, 13, 14). Security dimension intentionally out of scope per the original request. TASK 15 + PLAN COMPLETE.

2026-08-18 v0.9.3-beta Task 12/12: AUDIT REMEDIATION GATE CLOSED (final task of the 12-task follow-up plan). `verify` script extended to also run `check:eager`. Full gate run: eslint 0 problems, unit suite 1151 tests across 179 files all green, `vite build` clean, `check:bundle` all budgets met (initial load graph 7 chunks / 534.5 kB raw: NumberInput, createLucideIcon, index, motion, rolldown-runtime, vendor-react, vendor-router; largest single chunk `charts-ThemedDatePicker` 309.5 kB, no longer in the eager graph), `check:eager` clean (94 files reachable from `src/main.tsx`, no forbidden package eagerly reachable), 17/17 Playwright e2e specs green including `a11y.spec.ts` and `a11y-mobile.spec.ts` (5 routes each, zero serious/critical violations, desktop and mobile), `npx tsc -b` 0 errors. Flakiness check: ran `npx vitest run` three consecutive times with nothing else concurrent; all three runs identical and clean (1151/1151, 179/179 files), including `src/App.test.tsx`'s lazy-route-loading test, which had flaked twice earlier in this plan's history (once during its original fix, once during a later task's review), with no recurrence in these 3 runs, so the existing 5000ms `findByRole` timeout was left as is rather than raised speculatively. Changelog: added `## [0.9.3-beta] - 2026-08-18` (Added/Changed/Fixed, no em dashes, `WhatsNewModal.test.tsx` reparse verified) describing auto-sync with its real limits (opt-in, requires one manual sync first in the session, acts only on unambiguous outcomes, conflicts still route to Settings), mobile virtualization and keyboard operability reaching parity with desktop, a genuine first-load speed improvement stated in user terms, the due-today reminder fix, the demo banner state-tracking fix, the dismissible checklist, and the remaining opacity-driven contrast fixes. `package.json` version bumped 0.9.2-beta -> 0.9.3-beta. Audit dimensions closed by this plan: performance (Tasks 1, 2, 5, 7: eager chart bytes removed, budget regression guard, mobile virtualization, row-height measurement), accessibility (Tasks 3, 4, 6: five contrast failures fixed, opacity-class and mobile-viewport guards, 2.1.1 button audit), UX (Tasks 9, 10, 11: auto-sync, demo banner fix, dismissible checklist), engagement (Task 8: due-date reminder fix). Security dimension intentionally out of scope, unchanged at 5/10. Overall audit score: 80 -> 90. TASK 12 + PLAN COMPLETE.
