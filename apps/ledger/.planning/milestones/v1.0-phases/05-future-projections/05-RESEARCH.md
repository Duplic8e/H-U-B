# Phase 05: Future Projections - Research

## Context
Goal: Forecasting tool for future net worth based on compounding interest and savings rates.
The user decided:
- Fixed buttons for projection horizon (10, 20, 30 years).
- Separate inputs for Market Return and Inflation.
- Stacked area chart showing Base Contributions and Compounded Interest.

## Codebase Analysis
- Recharts is already installed and used in `InvestmentTrackerWidget.tsx`.
- Zustand is used for state. We can create `useProjectionStore.ts`.
- `WidgetWrapper` can be used to wrap the projection chart and controls.
- The UI should have inputs for Monthly Contribution, Market Return, and Inflation. We can place these controls inside a modal or directly in the widget header/body. Since they are central to the interactive forecast, placing them alongside or below the chart inside the widget is ideal.

## Approach
1. Create `useProjectionStore.ts`.
2. Create `ProjectionWidget.tsx` using Recharts `AreaChart` with `stackId="1"` for stacking.
3. Integrate into `Dashboard.tsx`.
