# Phase 4 — Planner (Tools & Calculators Hub) — Umbrella Plan

> **STATUS: PHASE 4 COMPLETE (2026-07-03).** All sub-plans 4a-4e executed and gate-verified; 12 tools live in the Planner hub. This file remains as the architectural index.

> **For agentic workers:** This is the UMBRELLA plan for Phase 4. You do NOT execute tasks from this file. Execute the sub-plans below in order, each via **superpowers:subagent-driven-development**. Sub-plans 4b–4e are scope stubs here — plan each one JIT (dispatch a planning subagent invoking **superpowers:writing-plans**) right before executing it, exactly as the master plan prescribes for phases.

**Goal:** Rename the "Projections" tab to **Planner** and turn it into a Bento grid of financial tools — 11 focused calculators plus a flagship Net-Worth/FIRE Forecaster that auto-feeds from Dashboard, Budgeting, and Compensation. All inputs persisted.

**Spec authority:** `docs/superpowers/specs/2026-07-02-ledger-v2-design.md` → "Phase 4 — Planner (tools & calculators hub)". Done when: Planner shows a Bento grid of tools; the forecaster pulls live from other modules and renders all listed views; each calculator is functional and persisted.

**Tech Stack:** React 19, Vite, Tailwind v4, Zustand `persist`, Recharts, react-router-dom v7 (HashRouter), lucide-react, Vitest (globals) + Testing Library.

## Global Constraints (apply to EVERY task in EVERY sub-plan — copy into each sub-plan)

- **Zero backend / zero-infra.** Static SPA on GitHub Pages. Everything client-side.
- **Local-first persistence.** Every new store uses Zustand `persist` → LocalStorage, following `src/store/useCompensationStore.ts`.
- **Backup coverage.** Every new persisted store key MUST be appended to `BACKUP_KEYS` in `src/utils/backup.ts` with a registration test in `src/utils/backup.test.ts` (pattern: `expect(BACKUP_KEYS).toContain('<key>')`).
- **Recharts only** for charts (SVG + CSS-variable theming — pass `var(--accent)` etc. directly as stroke/fill props; see `src/components/investments/ProjectionWidget.tsx`).
- **No hardcoded colors — theme CSS variables only.** The codebase has **5 themes** (`geometric`, `tactical`, `luxury`, `aurora`, `glass` — see `src/index.css` and `src/store/useThemeStore.ts`; `luxury` is default). Every new view must work in ALL 5. (Note: earlier docs said "2" or "6" themes; the codebase is the authority — it is 5.)
- **Live data always has a manual fallback.** Anything using market data must remain usable offline via cache + manual override (the `Resolved<T>` pattern in `src/services/marketData`).
- **Mobile + all themes are acceptance gates.** Every new view must render correctly on a phone viewport and in all 5 themes before its sub-phase is "done".
- **Bento architecture.** Widget cards are layout wrappers taking `children`; layout decoupled from logic (`src/components/dashboard/WidgetWrapper.tsx`, `BentoGrid.tsx`).
- **TDD every task** (Vitest, `globals: true` — do NOT import `describe/it/expect` in new tests; co-locate `*.test.ts(x)` next to source). **Commit after every task.** Lint rule `react-hooks/set-state-in-effect` is enforced — no synchronous setState in effect bodies.

---

## Architecture

### Shared infrastructure (built in 4a, reused by all later sub-plans)

1. **Route & hub.** `/projections` is replaced by `/planner` (with a `<Navigate>` redirect from the old path so bookmarks survive). `src/pages/Planner.tsx` renders a `BentoGrid` of tool tiles; `src/pages/PlannerTool.tsx` (route `/planner/:toolId`) renders the selected calculator with a back link. Nav item in `src/components/Layout.tsx` renamed "Projections" → "Planner".
2. **Tool registry.** `src/components/planner/toolRegistry.tsx` exports `PLANNER_TOOLS: PlannerTool[]` — `{ id, name, description, icon, component }`. The hub grid and the `:toolId` route both read from it. Each later sub-plan ships calculators by appending registry entries; nothing else in the hub changes. Tools not yet built simply aren't in the registry (no dead tiles).
3. **Persisted inputs store.** ONE store for all calculators: `src/store/usePlannerStore.ts`, key **`ledger-planner`**, shape `inputs: Record<toolId, Record<field, number | string | boolean>>` with `setInput(tool, field, value)` and `resetTool(tool)`. Components read inputs merged over per-tool defaults and write directly on change (controlled inputs → store; no effects, satisfying `set-state-in-effect`). Registered in `BACKUP_KEYS` once, in 4a — later sub-plans need NO new keys.
4. **Pure finance math in `src/utils/finance/`.** Every calculator's math is a pure, unit-tested module (e.g. `compound.ts`, `savingsGoal.ts`, later `amortization.ts`, `canadaTax.ts`, `fire.ts`, `monteCarlo.ts`). Components stay thin: read inputs → call pure function → render. This is where all TDD leverage lives.
5. **Calculator UI primitives.** `src/components/planner/CalculatorField.tsx` (labeled numeric/select input) and `ResultCard.tsx` (label + big formatted value), themed via CSS variables only. All calculators compose these for visual consistency.

### Cross-module auto-feed interfaces (for 4e, documented now so nothing drifts)

- **Starting balance:** `useAccountsStore.getState().getNetWorth()` (`src/store/useAccountsStore.ts`, sums bank+investment+receivable+other − debt).
- **Monthly savings:** no store-level selector exists — 4e must add a small pure selector (e.g. `src/store/budgetSelectors.ts`) replicating the income/expense filters in `src/components/budget/IncomeWidget.tsx` / `ExpenseWidget.tsx` over `useBudgetStore.getState().transactions` (`t.type === 'income' | 'expense'`, month prefix on `t.date`).
- **Comp lump sums on real dates:** RSU — `generateVestEvents(grant, currentPrice): VestEvent[]` from `src/store/useCompensationStore.ts` (each event has ISO `date?` and `vestValue`); bonus — `cashBonusMonth` (1–12) × `calcAnnualBonus(pkg)`; ESPP — no per-purchase dates exist, treat as annual lump via `calcAnnualESPP(pkg)` (document this simplification in 4e).
- **FX / prices:** `getFxRate`, `useFxRate`, `useCurrentPrice` from `src/services/marketData` (barrel `index.ts`); `Currency = 'USD' | 'CAD'`.
- **Existing forecaster seed:** `src/store/useProjectionStore.ts` (NOT persisted) + `src/components/investments/ProjectionWidget.tsx` hold today's simple real-return compounding chart. 4e replaces them; until then the widget stays reachable as the "Forecaster" registry entry (done in 4a).

### File structure (final state, all sub-plans)

```
src/pages/Planner.tsx                      # hub grid (4a)
src/pages/PlannerTool.tsx                  # /planner/:toolId shell (4a)
src/components/planner/
  toolRegistry.tsx                         # tool list, grows per sub-plan (4a)
  CalculatorField.tsx  ResultCard.tsx      # shared primitives (4a)
  CompoundInterestCalculator.tsx           # 4a
  SavingsGoalCalculator.tsx                # 4a
  EmergencyFundCalculator.tsx  CurrencyConverter.tsx  RaiseInflationCalculator.tsx   # 4b
  DebtPayoffCalculator.tsx  MortgageCalculator.tsx  RentVsBuyCalculator.tsx          # 4c
  TakeHomePayCalculator.tsx  IncomeTaxEstimator.tsx  RrspVsTfsaCalculator.tsx        # 4d
  forecaster/…  (FIRE forecaster widgets)                                            # 4e
src/store/usePlannerStore.ts               # ONE persisted store, key 'ledger-planner' (4a)
src/utils/finance/
  compound.ts  savingsGoal.ts              # 4a
  amortization.ts                          # 4c (also used by 4e debt payoff)
  canadaTax.ts (+ sourced 2026 tables)     # 4d
  fire.ts  monteCarlo.ts  forecast.ts      # 4e
```

---

## Sub-plan index (execute in order)

| # | File | Scope | Status |
|---|------|-------|--------|
| 4a | `2026-07-02-phase-4a-hub-and-core-calculators.md` | Hub scaffold + shared infra + Compound Interest + Savings Goal | **Written — execute first** |
| 4b | `2026-07-02-phase-4b-savings-tools.md` | Emergency fund, Currency converter, Raise/inflation | **Written (2026-07-03)** |
| 4c | `2026-07-02-phase-4c-debt-and-housing.md` | Debt payoff, Mortgage, Rent-vs-buy | **Written (2026-07-03)** |
| 4d | `2026-07-02-phase-4d-canada-tax.md` | Take-home pay, Income tax estimator, RRSP-vs-TFSA | **Written (2026-07-03; 2026 CRA tables sourced)** |
| 4e | `2026-07-02-phase-4e-fire-forecaster.md` | Flagship Net-Worth / FIRE Forecaster (all tiers) | **Written (2026-07-03)** |

> **Note (2026-07-03):** All sub-plans are now written in full — the stub sections below are superseded by the plan files and kept only as scope summaries. Later phases also have written plans: `2026-07-02-phase-5a-plan-vs-actual.md`, `2026-07-02-phase-5b-portfolio-viewer.md`, `2026-07-02-phase-6-budgeting-enhancements.md`, `2026-07-02-phase-7-uiux-refresh.md`. Per user direction (2026-07-03), testing in the new plans is minimal: pure math/store modules keep tests; UI components rely on the registry-driven hub test + manual gates.

### 4b — Savings tools (stub)

Three small calculators, each a registry entry + pure util + component + tests. **Emergency-fund:** monthly essential expenses × target months (3/6/12 presets), gap vs. a current-savings input, optionally prefilled from the budget expense selector; simple progress bar (CSS, no chart needed). **Currency converter:** amount + from/to (`USD`/`CAD` — the only currencies the FX service supports) using `useFxRate` from `src/services/marketData`; must show `Resolved` source/staleness and allow a manual-rate override input as offline fallback; optional historical-date lookup via the `date` param. **Raise/inflation ("is my raise a real raise?"):** old salary, new salary, inflation % → nominal raise %, real raise % (`(1+nom)/(1+infl)−1`), verdict copy. No new store keys; all inputs via `usePlannerStore`. Ends with a sub-phase gate task (test/lint/build + mobile + 5 themes).

### 4c — Debt & housing (stub)

Builds `src/utils/finance/amortization.ts` (shared: monthly payment formula, full amortization schedule generator with extra-payment support — 4e's debt-payoff projection reuses it). **Debt payoff:** list of debts (name, balance, APR, min payment) — this list lives in `usePlannerStore` inputs as a JSON-serializable array — snowball vs. avalanche simulation, payoff date + total interest per strategy, extra-monthly-payment slider, Recharts line of balances over time. **Mortgage:** price, down %, rate, term → payment + amortization chart + affordability mode (income/GDS-style ratio → max price). **Rent-vs-buy:** monthly rent vs. buy inputs (price, rate, property tax %, maintenance %, opportunity-cost return %) → cumulative-cost crossover chart + break-even year. Ends with a sub-phase gate task.

### 4d — Canada tax calculators (stub)

First task creates `src/utils/finance/canadaTax.ts` with **2026 federal + all-province/territory brackets, basic personal amounts, CPP (incl. CPP2) and EI parameters as typed constant tables** — the planning subagent must source these from CRA published figures at planning time and cite the source + retrieval date in a doc comment (spec: "these need real Canadian tax tables; source and document them"). Pure functions: `federalTax(income)`, `provincialTax(income, province)`, `cppContribution(income)`, `eiPremium(income)`, `marginalRate`, `effectiveRate`, `takeHomePay(gross, province)` — heavily table-driven tests against hand-computed values. Then three thin calculators: **Take-home pay** (gross→net by province, monthly/biweekly views), **Income tax estimator** (marginal + effective, bracket visualization bar), **RRSP-vs-TFSA optimizer** (current marginal rate vs. expected retirement rate → recommendation + contribution-split illustration). Ends with a sub-phase gate task.

### 4e — FIRE forecaster (flagship, own sub-plan — stub)

Replaces `ProjectionWidget`/`useProjectionStore` with a full-page forecaster tool (registry entry `forecaster`, rendered larger on the hub). Core: continuous actual-history→future chart (history from `useAccountsStore` snapshots as used by `NetWorthWidget`), nominal vs. real toggle, contributions-vs-growth stacked view, annual contribution step-up %, Conservative/Base/Optimistic bands, free time horizon. Smart: auto-fed starting balance (`getNetWorth()`), monthly savings (budget selector from the umbrella's interface notes), comp lump sums on real dates (`generateVestEvents`, bonus month, ESPP annual — per interface notes above), goal tracker with projected dates + crossover markers, FIRE engine (`fire.ts`: FI number = spend/withdrawal-rate, years-to-FI, Coast-FI point), life-event timeline (house/kid/sabbatical/car as dated deltas), live what-if sliders. Advanced: `monteCarlo.ts` (seeded PRNG for testability, percentile fan P10–P90 + probability-of-success), debt-payoff projection reusing 4c `amortization.ts`. Forecaster settings persist in `usePlannerStore` under tool id `forecaster`. This is the largest sub-plan (~10–12 tasks); pure math (`forecast.ts`, `fire.ts`, `monteCarlo.ts`) TDD-first, chart components after. Ends with the PHASE gate: spec "Done when" verified end-to-end.

---

## Phase-level definition of done

All five sub-plans complete; `npm test`, `npm run build`, `npm run lint` clean; PROGRESS.md updated; spec Phase 4 "Done when" met: Planner shows a Bento grid of tools, forecaster pulls live from other modules and renders all listed views, each calculator functional and persisted; everything verified mobile + all 5 themes.
