# Ledger v2.0 — Design Spec

**Date:** 2026-07-02
**Status:** Approved for planning
**Audience:** Implementation model (Fable 5) — execute phase by phase.

---

## 1. Purpose

Ledger is a local-first, backendless financial dashboard PWA (React 19 + Vite + Tailwind v4 + Zustand `persist` + Recharts + PapaParse + Framer Motion, deployed static to GitHub Pages). v1.0 shipped Dashboard, Budgeting (CSV import, triage, rules, paradigms), and a full Compensation calculator. Investments and Projections are placeholder stubs with mock data.

v2.0 turns the stubs into real modules, adds live market data within the zero-infra model, makes the app genuinely installable and mobile-friendly, and gives users a way to back up their data — then finishes with a 2026 UI/UX pass.

## 2. Hard constraints (do not violate)

- **Zero backend / zero-infra.** Static SPA on GitHub Pages. No server, no auth, no database. All new features must work client-side.
- **Local-first persistence.** Continue using Zustand `persist` → LocalStorage. New stores follow the same pattern.
- **Bento component architecture.** Widget cards are layout wrappers that take `children`; layout stays decoupled from widget logic. New widgets follow this.
- **Recharts** for all charts (SVG + CSS-variable theming for instant theme swaps).
- **Dual-theme system** (Tactical Monospace / Geometric Abstraction) is sacred. New UI works in *both* themes and uses theme CSS variables — never hardcoded colors.
- **CSV parsing** reuses the existing PapaParse + bank-specific-parser + generic-column-mapper pattern from `src/utils/csvParser.ts`.

## 3. Foundational decisions (apply across phases)

### Market data (live prices + FX)
- **Approach:** free public APIs, fetched **directly from the browser** (no key, no proxy). Use CORS-friendly endpoints — e.g. an unofficial Yahoo Finance quote/chart endpoint for equities and historical prices, and a free FX API (e.g. Frankfurter / exchangerate.host) for USD→CAD.
- **Resilience (required, not optional):** cache the last-known value in LocalStorage; always allow a **manual override**; degrade gracefully offline or when an endpoint rate-limits/breaks. Live fetch is an enhancement layered on top of manual entry — the app must remain fully usable with manual prices.

### Save / backup
- **Export/import a single JSON backup file.** One action serializes *all* app state (every persisted store) to a `.json` the user downloads; a second imports it back and restores state. Fully local, no accounts, works on mobile. This is the "save" feature — cloud sync remains out of scope.

## 4. Phases

Build in this order. Each phase depends on the ones before it. Foundation and Market Data are prerequisites for the feature phases.

---

### Phase 1 — Foundation: Save + PWA + Mobile base

**Goal:** a trustworthy, installable, mobile-ready base before feature work.

- **Backup export/import:** serialize all persisted Zustand stores into one versioned JSON (include a schema version for forward-compat). Import validates + restores. Accessible from a Settings/menu location reachable on mobile.
- **PWA hardening:** fix manifest icon paths so they resolve under the `base: '/ledger/'` path (currently absolute `/icon-*.png` — will 404 on GitHub Pages). Verify installability (valid manifest, icons, service worker, offline app-shell). Confirm "Add to Home Screen" works on iOS + Android.
- **Mobile base:** establish responsive primitives the later mobile-first pass builds on (viewport, safe-area insets, base breakpoints). Full reflow lands in Phase 7; here just ensure nothing is horizontally broken on a phone.

**Done when:** user can install the PWA on a phone, use it offline (shell), and export → wipe → import their data losslessly.

---

### Phase 2 — Market Data Service

**Goal:** one shared module every pricing feature consumes. Interface designed up front for *all* consumers so no feature needs retrofitting.

- **Capabilities:**
  - `getCurrentPrice(ticker, exchange)` → live quote.
  - `getHistoricalPrice(ticker, exchange, date)` → close price on/near a date (for Investments start prices).
  - `getFxRate('USD', 'CAD', date?)` → current or historical FX rate.
- **Behavior:** in-memory + LocalStorage cache with timestamps; last-known fallback; manual override hook; loading/error states surfaced to consumers. Throttle/debounce to respect free-tier limits.
- **Consumers (known now):** Compensation (current price + FX), Investments 5a (current + historical + FX), Investments 5b (current + FX), Planner currency converter (FX).

**Done when:** a consumer can request current/historical price and FX, get cached-or-live values, and the app still works offline via cache/manual entry.

---

### Phase 3 — Compensation: live price + CAD toggle

**Goal:** auto-updating stock price and seamless USD⇄CAD, without changing the comp math the user is happy with.

- **Live price:** wire `companyCurrentPrice` to the market-data service (fetch button + auto-refresh; manual override preserved).
- **USD⇄CAD toggle (global, togglable):** stock prices are entered/fetched in **USD**; comp calculations are in **CAD**. When conversion is on, USD price inputs (`companyCurrentPrice`, `esppLockedInPrice`, RSU `grantPrice`) auto-convert to CAD everywhere they're used — ESPP, RRSP match context, and RSU vest values — via the FX rate. User enters share counts and USD prices; all CAD outputs convert automatically. Toggle off = treat inputs as already-CAD (current behavior).
- Preserve existing `useCompensationStore` functions and their semantics; add a currency/FX layer around them, don't rewrite them.

**Done when:** user enters USD grant/lock-in prices, flips the toggle, and every CAD figure (ESPP, RRSP, RSU, total comp) reflects live-converted values; toggling off restores CAD-native behavior.

---

### Phase 4 — Planner (tools & calculators hub)

**Goal:** rename the "Projections" tab to **Planner** and turn it into a Bento grid of financial tools. The forecaster is the flagship; the rest are focused single-purpose calculators. Persist all inputs.

**Flagship — Net-Worth / FIRE Forecaster** (all tiers):
- *Core:* continuous actual-history→future chart (history from Dashboard); nominal vs. real (inflation-adjusted) toggle; contributions-vs-growth stacked view; annual contribution step-up %; Conservative/Base/Optimistic scenario bands; free-choice time horizon.
- *Smart / cross-module:* auto-fed inputs — starting balance from Dashboard net worth, monthly savings from Budgeting (income − expenses), and **future RSU vests / ESPP / bonus injected as lump sums on their real dates** from Compensation; goal tracker with projected dates + crossover markers; FIRE engine (FI number via withdrawal rate, years-to-FI, Coast-FI point); life-event timeline (house, kid, sabbatical, car) adjusting the forecast; live what-if sliders.
- *Advanced:* Monte Carlo confidence bands (shaded percentile fan + probability-of-success readout); debt-payoff projections (amortization + extra-payment impact).

**Calculators (all in scope):**
- Savings-goal (solve for any variable), Compound interest, Emergency-fund
- Debt payoff (snowball vs. avalanche), Mortgage (payment/amortization/affordability), Rent-vs-buy (break-even)
- **Canada:** Take-home pay (gross→net, CPP/EI + federal/provincial tax), RRSP-vs-TFSA optimizer, Income tax estimator (marginal + effective, by province) — these need real Canadian tax tables; source and document them.
- Currency converter (reuses market-data FX), Raise/inflation ("is my raise a real raise?").

**Done when:** Planner shows a Bento grid of tools; the forecaster pulls live from other modules and renders all listed views; each calculator is functional and persisted.

---

### Phase 5a — Investments: Plan vs. Actual (decision journal)

**Goal:** a standalone tool for tracking investment *analyses/theses* and follow-through. **Not** a portfolio; **not** connected to 5b.

- **Record an analysis:** ticker, exchange, planned amount, date → **start price auto-fills** from `getHistoricalPrice` (manual override allowed).
- **Track follow-through:** whether the user actually acted, and the real investment(s) — supports **multiple buy lots** (follow-on buys) with average cost basis.
- **Compute & display:** live current price, P/L $ and %, % change since analysis; totals (planned vs. actually invested); each entry's allocation % at start vs. now; plan-vs-actual variance ("planned $10k, invested $8.5k"); the counterfactual "how the thesis would have performed."
- Persist via a dedicated store; replace the mock-data stub in `useInvestmentStore`.

**Done when:** user logs an analysis, records (or doesn't record) the actual investment(s), and sees thesis-vs-actual performance and variance with live prices.

---

### Phase 5b — Investments: Portfolio Viewer

**Goal:** a standalone view of the user's real holdings via broker CSV import. Independent from 5a.

- **CSV import:** Interactive Brokers + Wealthsimple parsers + generic column mapper, following the Budgeting CSV pattern (`csvParser.ts`).
- **Holdings view:** per-holding cost basis, live current value, P/L $/%, allocation % of total; portfolio totals (total invested, total now, total P/L); **multi-currency aware** — USD holdings converted to CAD via market-data FX.
- Out of scope for now (explicitly deferred): dividends, ACB/capital-gains, rebalancing, benchmark comparison, watchlist.

**Done when:** user imports an IBKR or Wealthsimple CSV and sees a correct, multi-currency portfolio with live values and allocation.

---

### Phase 6 — Budgeting enhancements (all in scope)

**Goal:** additive polish on the already-solid budgeting module.

- **Smart:** recurring/subscription detection (flag repeating charges + a subscriptions list); spending anomaly alerts (vs. rolling average); month-end cash-flow forecast from recurring in/out.
- **Visual:** Sankey income-flow diagram; per-category trend sparklines; budget-vs-actual progress bars with pace indicator; spending calendar heatmap.
- All visuals theme-aware (both themes) and mobile-legible.

**Done when:** the above surface in the Budgeting module without regressing CSV import, triage, rules, or paradigms.

---

### Phase 7 — UI/UX 2026 refresh + Dashboard polish

**Goal:** polish finished features (done last, deliberately). Stay inside the existing Tactical/Geometric themes — refine, don't replace.

- **Dashboard:** live module rollups (portfolio value, comp snapshot + upcoming RSU vests, this-month budget health, top Planner goal progress) alongside net worth; net-worth-over-time trend chart; drag-to-reorder Bento widgets (architecture already supports 1-line swaps).
- **Mobile-first responsive pass:** Bento reflow to single column on phones, **bottom tab navigation**, larger touch targets. Core to the mobile-friendly requirement.
- **Motion & async polish:** animated number counters, charts that draw in, smooth view transitions (Framer Motion); skeleton loaders for live-price fetches; strong empty/first-run states (app starts data-empty).
- **Command palette (⌘K):** jump to any module/tool/action.
- **Accessibility hygiene** (baseline, folded into the above): sufficient contrast in both themes, keyboard-navigable palette/nav, honor `prefers-reduced-motion`.

**Done when:** the app is fully usable and attractive on a phone, the dashboard aggregates all modules, and ⌘K + motion polish are in place across both themes.

## 5. Out of scope (v2.0)

- Cloud sync / accounts / auth (save = local JSON export/import only).
- Serverless proxy or user-provided API keys for market data (direct free-API fetch only).
- Live bank/brokerage sync (e.g. Plaid).
- Investments extras: dividends, ACB/capital-gains, rebalancing, benchmark comparison, watchlist.
- Planner: detailed multi-account tax-withdrawal modeling beyond the listed calculators.

## 6. Cross-cutting acceptance criteria

- Works offline (cached/manual) and online (live) without breaking.
- Every new store uses Zustand `persist`; all state is captured by the backup export.
- Every new view renders correctly in both themes and on a phone.
- No hardcoded colors; CSS theme variables only.
- Live-data features always have a manual fallback.
