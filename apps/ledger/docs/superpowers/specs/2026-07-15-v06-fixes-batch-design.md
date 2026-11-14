# v0.6 Fixes Batch — Design

Date: 2026-07-15 (item 9 added 2026-07-16)
Status: Approved
Scope: 9 items — 5 small fixes, 2 features (multi-currency converter; wheel tracker port), 1 redesign (settings hub), 1 bug (mobile scroll). Minimal testing.

## 1. Live stock price in Edit Compensation modal

**Problem:** `CompensationModal.tsx` seeds its "Company Current Stock Price" field from the stored manual `primaryPackage.companyCurrentPrice`, not the live API price. The top bar on the Compensation page uses `useCompensationDisplay()` and shows the live price correctly; the modal shows a stale number, and saving the modal overwrites the manual fallback with that stale number.

**Decision:** Pre-fill live, stay editable.
- The modal reads `rawPrice` from `useCompensationDisplay()` (live/override price when a ticker resolves, manual fallback otherwise) and seeds the field with it when the modal opens.
- The field stays editable; on save, whatever is shown is stored as `companyCurrentPrice` (the manual fallback), exactly as today.
- Small caption under the field when the shown value came from a live source: e.g. "Live price (alphaVantage) — edit to override".
- The modal keeps local state; re-seed on open (key the state init off `isOpen` or reset in an effect) so a reopened modal shows the fresh live price.

## 2. "Select date" → "Select Date"

`ThemedDatePicker.tsx:98` placeholder text becomes `Select Date`. One-line change.

## 3. Beta version labels

- `CHANGELOG.md`: rename headings `[0.4.0]` → `[0.4.0-beta]` and `[0.5.0]` → `[0.5.0-beta]` (dates unchanged).
- `package.json`: bump `version` from `0.4.0` to `0.5.0-beta` so the app displays `v0.5.0-beta`.
- Note: bumping the version string changes `__APP_VERSION__`, which will trigger the What's New modal once for existing users (stored last-seen version differs). Accepted.
- This corrects the *current* release's labeling. What version this batch itself ships as (e.g. `0.6.0-beta`) is decided at release time and is out of scope here; batch changes go under `[Unreleased]`.

## 4. Multi-currency converter

**Currencies:** USD, CAD, EUR, JPY, KRW, BDT, GBP, AUD, INR.

**Type change:** widen `Currency` in `services/marketData/types.ts` from `'USD' | 'CAD'` to the nine codes. Compensation flows keep using the fixed `USD → CAD` pair; no behavior change there.

**Provider strategy:**
- Frankfurter (ECB) stays primary; it covers all list members except BDT.
- Add a fallback provider `erApi` (`https://open.er-api.com/v6/latest/{FROM}`, free, no key) used when the requested pair involves a currency Frankfurter doesn't support (BDT). Routing lives in `marketDataService`: a `FRANKFURTER_SUPPORTED` set decides which provider serves a pair. Historical-date lookups for BDT pairs are not supported by er-api's free tier → the date field is ignored for those pairs with a visible note ("historical rates unavailable for BDT").
- Same caching/override machinery (`fxKey`, overrides) — keys already encode from/to/date so no migration needed.

**Converter UX (`CurrencyConverter.tsx`):**
- Two `ThemedSelect` dropdowns, From and To, defaulting to USD → CAD.
- Keep the swap button (flips from/to).
- Persisted tool inputs gain a `to` field; existing stored `from` values remain valid.
- Amount formatting: use `Intl.NumberFormat` with the target currency's conventional decimals (JPY/KRW → 0 decimals, others → 2).

**Testing (minimal):** unit tests for provider routing (BDT pair → er-api, EUR pair → Frankfurter) and the er-api response parser.

## 5. Mortgage toggle layout

In `MortgageCalculator.tsx`, merge the two toggle rows into one flex row: `Payment / Affordability` left, `Monthly / Biweekly (Accelerated)` right (`justify-between`, `flex-wrap`). On narrow screens the frequency group wraps below, left-aligned. The frequency group still renders only in `payment` mode.

## 6. Settings hub (dock redesign)

**Decision:** Option B — single settings hub, modal style.

**Desktop sidebar dock** shrinks to:
- One "Settings" button (gear icon + label) opening the settings sheet (`Sheet` with `desktop="modal"`).
- The `v{version} · What's New` text link stays in the dock.

**Settings sheet sections** (one scrollable sheet):
1. **Appearance** — swatch-grid theme picker: card per theme showing its bg color, accent bar, and name; active theme gets an accent border/check. Replaces the popover list. `ThemeSelector` is refactored into a `ThemeSwatchGrid` used inside the sheet.
2. **Market Data** — the existing Alpha Vantage key UI (from `MarketDataSettings`), inlined as a section instead of its own modal.
3. **Backup** — the existing export/import controls (from `BackupControls`), inlined as a section.
4. **About** — version, "What's New" (opens the existing modal), and "Estimates Only · Not Financial Advice" (opens the disclaimer).

Existing components are refactored so their *content* is reusable inside the sheet (strip their own trigger buttons/modal shells or add a `variant="inline"` render); their logic (stores, handlers) is unchanged.

**Mobile:**
- Remove the top control row entirely (frees vertical space on every page).
- Bottom tab bar goes from 5 to 6 slots: a "Settings" gear tab at the end opens the same settings sheet (as a bottom sheet). It is a button, not a route; no active-route styling.
- What's New/version and disclaimer links live in the sheet's About section on mobile (they were in the top row before).

**Testing:** update existing `ThemeSelector`/`MarketDataSettings`/`Layout` tests to the new structure; no new test files beyond that.

## 7. Debt payoff — no empty columns

In `DebtPayoffCalculator.tsx`, the second detail row uses a fixed `md:grid-cols-[1.4fr_1fr_1fr]`. Replace with a grid whose column count adapts to how many fields actually render:
- credit card / line of credit → 1 field (Min Payment) → single full-width (or capped-width) cell, no dead space
- loan + "I Know My Payment" → 2 fields → 2 columns
- loan + "I Know My Term" → 3 fields → 3 columns (unchanged)

Implementation: compute the grid-cols class from `d.type`/`loanMode` (e.g. `md:grid-cols-[1.4fr_1fr]` when 2 fields, etc.). Mobile stays single-column.

## 8. Mobile scroll cutoff (all pages)

**Root cause hypothesis (verify during implementation):** `main` carries `pb-[calc(52px+env(safe-area-inset-bottom)+16px)]`, but page roots like Compensation use `h-full` — a child sized to 100% of the scroll container whose content then overflows the child box; the parent's bottom padding sits after the child's border box, not after the overflowed content, so the tail is hidden under the fixed tab bar.

**Fix direction:** make padding-bottom apply to the real content end on every page:
- Remove `h-full` from page-root wrappers that don't need it (Compensation and any others found by grep), using `min-h-full` where full-height background/stretch is desired, and/or
- Move the bottom spacing inside the scroll content: wrap `<Outlet/>` in a div that carries the tab-bar clearance padding instead of putting it on `main`.
Verify on Dashboard, Budgeting, Investments, Planner (incl. debt payoff tool), Compensation in the mobile viewport (375×812), confirming the last card clears the tab bar.

Note: item 6 removes the mobile top row, and item 8's verification happens after that change, so the two are sequenced (settings hub first or scroll fix verified after both).

## 9. Wheel tracker → Investments "Options" tab

**Source:** the standalone tool at `C:\Users\misha\wheel_tracker` (React 19 + Vite, ~930 lines). It parses Interactive Brokers Activity Statement CSVs into per-ticker wheel-strategy state (shares held, reconstructed cost basis, options premium collected, open put obligations), computes true breakeven and spot-price-dependent net P/L, and renders ticker cards with a detail ledger.

**Decision: native port** as a third Investments tab. Tab set becomes `Plan vs Actual | Portfolio | Options` (state union `'journal' | 'portfolio' | 'wheel'`).

**Logic layer** — ported nearly verbatim into `src/utils/investments/wheel/`:
- `types.ts` — `TradeRecord`, `TickerState`, `TickerMap` (as in the source tool).
- `calculations.ts` — `calculateBreakeven`, `calculateNetPL` (V6 options-only math preserved exactly).
- `ibkrActivityParser.ts` — `processIBKR(rows)` plus the dedupe/aggregation logic extracted from the tool's `App.tsx` into a pure `mergeActivityRows(existingRows, newRows)`: trades dedupe by the deterministic hash; Open Positions rows come ONLY from the newest upload (so positions move Open→Closed correctly across files).

**State** — new `src/store/useWheelStore.ts` (zustand + persist, key `ledger-wheel`): stores `{ rawRows, fileCount }`. Ticker states are DERIVED (`processIBKR` memoized on `rawRows`), never persisted — parser fixes retroactively apply. Actions: `addRows(newRows, fileCount)`, `clearAll()`. `'ledger-wheel'` is appended to `BACKUP_KEYS` in `src/utils/backup.ts` so backups include it.

**UI** — rebuilt in ledger idiom (themed-card, `Sheet`, `EmptyState`, existing animation classes; NO framer-motion stagger, NO custom CSS port):
- `src/components/investments/wheel/WheelView.tsx` — empty state with CSV drop/upload (multi-file, papaparse `skipEmptyLines`), or dashboard: compact upload bar (Add CSVs / Clear with `confirm()`), search box, sort select (Alphabetical / Highest Net P/L / Lowest Net P/L), Active/Closed toggle, sections "Active Stock Wheels", "Cash-Secured Puts (Options Only)", "Closed Wheels".
- `src/components/investments/wheel/WheelTickerCard.tsx` — metrics: Shares, Total Cost of Shares, Total Premium Collected, Current Stock Price (input), True Breakeven, Net P/L (colored), copy-summary button, View Details button.
- `src/components/investments/wheel/WheelLedgerSheet.tsx` — the detail ledger as a `Sheet` (modal desktop / bottom sheet mobile): date/instrument/qty/price/net-cash-flow table with a running total row.

**Spot price** — live with manual override: each card resolves its price as quote override → live/cached `useCurrentPrice(ticker)` → CSV-parsed `currentPrice` fallback. Editing the field writes the shared quote override (`setManual`, same mechanism as Portfolio), so it persists and is consistent app-wide. All USD; no CAD conversion.

**Dropped from the original:** PDF export (html2canvas + jspdf are not added to ledger), framer-motion animation variants, the standalone header/branding. Copy-to-clipboard summary is kept but the "Generated by Wheel Strategy Tracker" footer line is dropped.

**Migration:** none — the standalone tool's localStorage is a different origin. The user re-uploads their CSVs once.

**Testing (minimal):** `calculations.test.ts` (breakeven + net P/L: stock wheel, options-only above/below breakeven) and `ibkrActivityParser.test.ts` (synthetic fixture: parses option + stock trades and open positions; dedupes repeated trade rows; open positions from only the latest upload). No component tests.

## Testing policy (whole batch)

Minimal: new unit tests only for FX provider routing/parsing and (if logic is extracted) the modal live-price seeding; everything else covered by updating existing tests that the refactors break, plus visual verification in the browser (desktop + 375px mobile) per item. Full suite (`npx vitest run`, 338 tests baseline) must stay green.

## Out of scope

- No change to compensation USD/CAD FX behavior or investments quotes.
- No historical BDT rates.
- No new themes; no theme preview-on-hover.
- No route-level Settings page (the sheet is the only surface).
