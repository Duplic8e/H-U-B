# Phase 6: Total Compensation Calculator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 06-total-compensation-calculator
**Areas discussed:** Compensation breakdown structure, Equity vesting visualization, Multi-offer comparison, Annualized vs. point-in-time view

---

## Compensation Breakdown Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Core three only | Base salary, cash bonus, and equity (RSU/Options). Clean and focused. | |
| Core three + employer benefits | Add 401k match, health/dental insurance employer contribution. | |
| Full package | Everything above plus imputed value of PTO, signing bonus, relocation. | |

**User's choice:** Custom set — Base salary, cash bonus, RSU, ESPP, RRSP match
**Notes:** User specified a custom component set matching their actual compensation structure rather than selecting a preset option.

### Follow-up: Input Detail Level

| Option | Description | Selected |
|--------|-------------|----------|
| Single input per component | One field each for base, bonus, RSU, ESPP, RRSP match. | |
| Structured inputs | Base as annual salary, bonus as % of base, RSU with vesting schedule, ESPP as contribution % + discount rate, RRSP as match % up to cap. | ✓ |

**User's choice:** Structured inputs
**Notes:** None — clear preference for depth over simplicity.

---

## Equity Vesting Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Timeline bar chart | Horizontal timeline with cliff date and vest events as bars, cumulative value overlay. | ✓ |
| Waterfall chart | Each vesting event stacks upward with running total line. | |
| Table + mini-chart combo | Data table of vest dates with small area chart. | |

**User's choice:** Timeline bar chart
**Notes:** None.

### Follow-up: Vesting Schedule Format

| Option | Description | Selected |
|--------|-------------|----------|
| Standard 4yr/1yr cliff | Pre-fill with common schedule, user adjusts. | |
| Fully custom | User inputs all parameters, no presets. | |
| Preset + custom | Common presets as quick-select buttons with full override ability. | ✓ |

**User's choice:** Preset + custom
**Notes:** Consistent with Phase 5 fixed-buttons pattern for timeframe selection.

---

## Multi-Offer Comparison

| Option | Description | Selected |
|--------|-------------|----------|
| Single package only | Track current comp, no comparison. | |
| Side-by-side comparison | Support 2-3 named packages with full comparison view. | |
| Single primary + quick compare | One main package with lightweight compare mode showing deltas. | ✓ |

**User's choice:** Single primary + quick compare
**Notes:** Keeps core experience focused while remaining practical for offer evaluation.

---

## Annualized vs. Point-in-Time View

| Option | Description | Selected |
|--------|-------------|----------|
| Annualized total as hero metric | Big number + donut/pie breakdown. | |
| Monthly timeline view | 12-month bar chart showing cash flow per month. | |
| Both views | Annualized hero + donut as default, toggle to monthly cash flow timeline. | ✓ |

**User's choice:** Both views with toggle
**Notes:** Annualized hero number + donut breakdown as default state. Monthly cash flow timeline available via toggle.

---

## Agent's Discretion

- Detailed component structure inside widgets (follows dual-theme rules and established patterns)
- Internal Zustand store schema design
- Specific Recharts configuration choices

## Deferred Ideas

None — discussion stayed within phase scope
