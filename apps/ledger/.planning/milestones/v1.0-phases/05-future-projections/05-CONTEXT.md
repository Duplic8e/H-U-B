# Phase 5: Future Projections - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Forecasting tool for future net worth based on compounding interest and savings rates.
</domain>

<decisions>
## Implementation Decisions

### Projection Horizon
- **D-01:** Users will pick the timeframe using fixed buttons (10, 20, 30 years) to keep the UI clean rather than typing custom years.

### Input Variables
- **D-02:** The form will require separate inputs for Market Return (e.g., 10%) and Inflation (e.g., 3%) to calculate real compounding interest, rather than a single net return rate.

### Graph Detail
- **D-03:** The visualization will use a stacked area chart showing Base Contributions at the bottom and the Compounded Interest layered on top.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Level
- `c:\Users\misha\ledger\.planning\PROJECT.md` — High-level architecture and vision
- `c:\Users\misha\ledger\.planning\REQUIREMENTS.md` — Feature requirements and phase boundaries
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Recharts `ResponsiveContainer` and `Area` / `ComposedChart` components used in Phase 4.
- Phase 3 data entry modal patterns and Phase 4 target modal patterns.
</code_context>

<specifics>
## Specific Ideas
- Fixed buttons for 10, 20, 30 years.
- Stacked area charts with base + interest areas.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>

---

*Phase: 05-future-projections*
*Context gathered: 2026-06-18*
