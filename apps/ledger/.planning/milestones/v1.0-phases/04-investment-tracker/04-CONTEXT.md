# Phase 4: Investment Tracker - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual comparison of target vs actual investments using Recharts.

</domain>

<decisions>
## Implementation Decisions

### Chart Visualization
- Use ComposedChart (Line for Target, Area for Actual) — Clear differentiation.
- Use Native CSS Variables (e.g. `var(--color-primary)`) in Recharts — Seamless transitions.

### Investment Data Structure & Input
- Use Array of monthly snapshots (`date`, `actualBalance`, `targetBalance`) — Perfectly matches Recharts.
- Use A dedicated modal overlay for adjusting target goals — Matches Phase 3 UX.

### the agent's Discretion
Any detailed component structure inside the widgets not explicitly discussed is up to the agent's discretion, provided it conforms to the Tactical Monospace and Geometric Abstraction dual-theme rules.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Layout.tsx` — Existing global layout providing Sidebar, Topbar, and Theme Toggle functionality.
- Bento Grid components from Phase 2.

### Established Patterns
- High-contrast, strictly structured aesthetics using Tailwind CSS classes.
- Modal overlay pattern from Phase 3 for data entry.

### Integration Points
- Investment Tracker widgets will be integrated into the main Dashboard layout grid built in Phase 2.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
