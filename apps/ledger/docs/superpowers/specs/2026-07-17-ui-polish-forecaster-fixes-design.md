# UI Polish + Forecaster Fixes Design

Date: 2026-07-17
Status: Approved pending spec review

Five small fixes and improvements across Compensation, Budgeting, and the Net-Worth / FIRE Forecaster, agreed in brainstorming (mockup Option B chosen for the forecaster controls).

## 1. Themed ConfirmDialog (replace native `window.confirm`)

**Problem:** `window.confirm` shows the browser-native "miishat.github.io says" popup, which ignores the app theme.

**Solution:** New reusable component `src/components/ui/ConfirmDialog.tsx` built on the existing `Sheet` primitive (`desktop="modal"`), with:

- Props: `open`, `title`, `message` (ReactNode), `confirmLabel`, `cancelLabel` (default "Cancel"), `tone: 'accent' | 'danger'`, `onConfirm`, `onCancel`.
- Accent tone: confirm button uses `--color-accent` background. Danger tone: error color background.
- Escape / backdrop click cancels (Sheet behavior).

**Call sites replaced (all three native confirms):**

| Location | Message | Tone |
| --- | --- | --- |
| `CompHeroWidget.openSalaryTax` | Replace saved Salary & Tax income with total compensation | accent |
| `TransactionListWidget` clear-all transactions | Clear all transactions, cannot be undone | danger |
| `WheelView` clear wheel data | Clear all wheel tracker data, cannot be undone | danger |

For `openSalaryTax`, the flow becomes async: open dialog; on confirm set income then navigate; on cancel navigate without overwriting (matches current behavior where Cancel still navigates but keeps the saved income).

## 2. Compensation Monthly Cash Flow: gross-only with note

**Decision:** Keep monthly bars gross. Do not scale by tax.

When `view === 'monthly'` and `showAfterTax` is on, render a small secondary-text note near the chart:

> Monthly bars are shown gross. Withholding varies too much month to month to estimate honestly; after-tax figures below are annual estimates.

The Gross / After-Tax toggle continues to drive the summary cards and pie center as today. No chart data changes.

## 3. Budgeting paradigm text and banner alignment

- **Dropdown description one line:** widen the description container (raise `max-w-[420px]` as needed) and shorten the 50/30/20 text in `PARADIGM_DESCRIPTIONS` to "Spend ~50% of income on needs, 30% on wants, 20% toward savings." Every paradigm description must render on a single line at typical desktop widths.
- **ParadigmBanner (50/30/20):** the progress bar currently sits inside the text column, indented past the info icon. Restructure the banner so the bar spans the full inner width of the card. When all buckets are 0%, show the empty track (bg only) rather than a collapsed strip, so it reads as an intentional empty state.

## 4. Forecaster: changelog entries + Comp Events / Debt Drag redesign (Option B)

**Changelog:** add the missing forecaster items to the `[0.7.0-beta]` section of CHANGELOG.md:

- Projected goal and event dates shown inside Forecaster list cards
- After-tax comp events: comp lump sums can be taxed at your auto-detected marginal rate (with province) or a manual rate
- Forecaster fixes from that drop (planner store reset between tests is internal; only user-facing items listed)

**Control redesign (mockup Option B):** in `ForecasterTool.tsx`, the "Comp Events / Debt Drag" grid cell keeps only:

- Two pills, height-matched with the AutoField inputs: "N Comp Events On / Comp Events Off" and "Debt Drag $X/mo / Debt Drag Off"
- A small gear icon button that toggles a themed popover

The popover (anchored to the gear, themed-menu styling) contains:

- "After-tax comp events" toggle (`compTaxEnabled`)
- "Auto marginal rate" toggle showing rate and province, visible when after-tax is on (`compTaxAuto`)
- Manual rate % field when after-tax is on and auto is off (`compTaxManualPct`)
- Caption: "Comp events taxed at your marginal rate; RSU/ESPP treated as employment income."

Popover closes on outside click and Escape. No store/setting shape changes; this is layout only.

## 5. Forecaster chart: real-mode bands bug + legend

**Bug:** in `ForecastChart.tsx`, when `showReal` is true the projected line uses deflated values but `conservative` and `optimistic` stay nominal, so the real projected line can fall below the nominal conservative band.

**Fix:** deflate band values in real mode. Preferred implementation: extend `ForecastPoint` in `src/utils/finance/forecast.ts` with `conservativeReal` and `optimisticReal` (each nominal value divided by the same deflator), and have `ForecastChart` pick real or nominal per `showReal`, consistent with how `real` / `contributedReal` / `growthReal` already work.

**Legend:** add a compact legend to the chart card:

- Line view: Projected, Conservative to Optimistic band, Actual
- Stacked view: Contributed (grey), Growth (accent), Actual

## Testing

- `ConfirmDialog` component tests: renders title/message, confirm and cancel callbacks, danger tone class.
- `CompHeroWidget` tests updated: dialog appears instead of `window.confirm` when saved income differs; monthly + after-tax note renders.
- `ParadigmBanner` tests updated for new structure and 0% empty state.
- `ForecasterTool` test: gear opens popover, toggles wired to settings.
- `forecast.ts` test: `conservativeReal === conservative / deflator` (same for optimistic).
- Full suite passes (458+ tests, excluding `.claude/worktrees`).

## Out of scope

- Per-month withholding modeling in the compensation chart
- Any change to forecast math besides adding deflated band fields
- Mobile-specific redesign of the forecaster controls (popover must merely not break on mobile; Sheet-style fallback not required)
