# Phase 05: Future Projections - Plan

Provide a forecasting tool for future net worth based on compounding interest and savings rates.

## User Review Required
Please review the proposed approach for the Future Projections widget.

## Proposed Changes

### State Management
#### [NEW] [useProjectionStore.ts](file:///c:/Users/misha/ledger/src/store/useProjectionStore.ts)
- `horizon`: 10 | 20 | 30 (default 30)
- `monthlyContribution`: number (default 1000)
- `marketReturn`: number (default 10)
- `inflation`: number (default 3)
- `history`: array of `{ year, baseContribution, interest }`
- Actions to update inputs and automatically recalculate the history array.
- The calculation will compound monthly but store data points yearly for the graph.
- Real Return = Market Return - Inflation.

### Components
#### [NEW] [ProjectionWidget.tsx](file:///c:/Users/misha/ledger/src/components/investments/ProjectionWidget.tsx)
- Recharts `ResponsiveContainer` and `ComposedChart`.
- Two `Area` components stacked (`stackId="1"`):
  1. Base Contributions (solid subtle color)
  2. Compounded Interest (accent color with gradient)
- Include fixed buttons at the top for 10, 20, 30 years.
- Include simple number inputs for Monthly Contribution, Market Return, and Inflation below or beside the chart.

### Dashboard Integration
#### [MODIFY] [Dashboard.tsx](file:///c:/Users/misha/ledger/src/pages/Dashboard.tsx)
- Import and add `<ProjectionWidget />` to the BentoGrid.

## Verification Plan

### Automated Tests
- Run `npm run build` to verify typings and recharts imports.
- Run `npm run lint` for standard checks.

### Manual Verification
- Open the Master Dashboard and interact with the Future Projections widget.
- Adjust the Monthly Contribution and verify the chart updates in real-time.
- Switch the horizon from 30 years to 10 years and ensure the chart rescales.
