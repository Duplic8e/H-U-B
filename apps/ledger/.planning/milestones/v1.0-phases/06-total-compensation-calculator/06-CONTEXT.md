# Phase 6: Total Compensation Calculator - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Break down and visualize total employment compensation. Users can enter structured compensation inputs (base salary, cash bonus, RSU, ESPP, RRSP match) and see annualized totals, component breakdowns, equity vesting timelines, and lightweight offer comparisons.

</domain>

<decisions>
## Implementation Decisions

### Compensation Components
- **D-01:** Total comp consists of five components: Base salary, Cash bonus, RSU, ESPP, and RRSP match. No other benefits (health insurance, PTO value, etc.) are in scope for this phase.

### Input Structure
- **D-02:** Structured inputs for each component:
  - **Base salary** — annual dollar amount
  - **Cash bonus** — percentage of base salary
  - **RSU** — total grant value with vesting schedule (see D-04/D-05)
  - **ESPP** — contribution percentage + discount rate
  - **RRSP match** — employer match percentage up to a dollar cap

### Primary View
- **D-03:** Default view shows an annualized hero number (total comp) with a donut/pie chart breaking down each component's share. A toggle switches to a monthly cash flow timeline showing when each component actually pays out (salary monthly, bonus quarterly/annual, RSU vests on schedule, etc.).

### Equity Vesting Visualization
- **D-04:** RSU vesting displayed as a timeline bar chart (Recharts) — horizontal timeline with cliff date marker and quarterly/monthly vest events as bars, with a cumulative vested value line overlaid.

### Vesting Schedule Input
- **D-05:** Preset + custom approach for vesting schedules — offer common presets as quick-select buttons (4-year with 1-year cliff, 3-year with no cliff) with full override ability for total vest period, cliff length, and vesting frequency.

### Multi-Offer Comparison
- **D-06:** Single primary package tracked in detail, with a lightweight "compare" mode. In compare mode, the user enters another offer's numbers and sees a delta view against their primary package. Not a full multi-package manager.

### Agent's Discretion
Any detailed component structure inside the widgets not explicitly discussed is up to the agent's discretion, provided it conforms to the Tactical Monospace and Geometric Abstraction dual-theme rules and follows established patterns (modal overlays for data entry, Recharts with CSS variables, Zustand store).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Level
- `.planning/PROJECT.md` — High-level architecture, constraints (Vite SPA, Tailwind, Recharts, Zustand), and design vision
- `.planning/REQUIREMENTS.md` — COMP-01 and COMP-02 requirement definitions
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, and plan structure (06-01, 06-02)

### Prior Phase Patterns
- `.planning/phases/04-investment-tracker/04-CONTEXT.md` — Recharts ComposedChart pattern with CSS variables, modal overlay for targets, monthly snapshot data structure
- `.planning/phases/05-future-projections/05-CONTEXT.md` — Fixed button presets pattern (reuse for vesting presets), stacked area chart approach
- `.planning/phases/03-budgeting-module/03-CONTEXT.md` — Modal overlay for data entry, fixed categories, calendar month default

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/store/useThemeStore.ts` — Zustand theme store for dual-theme switching
- `src/store/useProjectionStore.ts` — Reference for financial calculation store pattern
- `src/store/useInvestmentStore.ts` — Reference for investment data structure pattern
- `src/components/investments/InvestmentTrackerWidget.tsx` — Recharts integration with CSS variable theming
- `src/components/investments/ProjectionWidget.tsx` — Recharts area chart with toggle pattern
- `src/components/investments/SetTargetModal.tsx` — Modal overlay pattern for structured input
- `src/components/Layout.tsx` — Global layout with sidebar navigation (already has `/compensation` route)

### Established Patterns
- Recharts `ResponsiveContainer` with `ComposedChart`, `Area`, `Line` components using `var(--color-*)` CSS variables
- Zustand stores with LocalStorage persistence for financial data
- Modal overlay pattern for data entry (keeps Bento Grid widgets read-only)
- High-contrast, strictly structured aesthetics using Tailwind CSS classes

### Integration Points
- Route `/compensation` already exists in `App.tsx` (currently a placeholder)
- New `useCompensationStore.ts` Zustand store needed
- New component directory `src/components/compensation/` following established pattern
- New page `src/pages/Compensation.tsx` to replace inline placeholder

</code_context>

<specifics>
## Specific Ideas

- Donut/pie chart for annualized comp breakdown by component
- Timeline bar chart for RSU vesting with cliff marker + cumulative line
- Quick-select preset buttons for common vesting schedules (mirrors Phase 5 timeframe buttons)
- Delta view in compare mode showing +/- differences per component

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-total-compensation-calculator*
*Context gathered: 2026-06-18*
