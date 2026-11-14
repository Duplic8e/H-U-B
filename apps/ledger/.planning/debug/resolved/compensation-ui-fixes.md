---
status: resolved
trigger: "in compensation, bonus automatically gets added to December, the user should have the option to select a month. the pie chart is broken as it doesn't label anything. the Total Annual Compensation text overlaps with the pie"
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: compensation-ui-fixes

## Context
**Trigger**: 
1. Bonus automatically vests in December on the Monthly Cash Flow bar chart, with no way to customize it.
2. The Annualized Breakdown Pie Chart doesn't display any labels, and the central "Total Annual Compensation" text overlaps with the pie slices.

## Resolution
**Root Cause**: 
1. `useCompensationStore`'s `CompensationPackage` model was missing a `cashBonusMonth` property, defaulting hardcoded logic to index 11 (December) in `CompHeroWidget.tsx`.
2. The `PieChart` component from `recharts` inside `CompHeroWidget.tsx` was missing the `label` and `labelLine` properties. Additionally, the `innerRadius` (80) and `outerRadius` (110) were too small to accommodate the large text font size in the center.

**Fix applied**: 
- Added `cashBonusMonth` (number) to `CompensationPackage` in `useCompensationStore.ts` with a default of 12.
- Updated `CompensationModal.tsx` and `CompareView.tsx` to include a `<select>` dropdown for users to pick the Bonus Payout Month (Jan-Dec).
- Updated the `BarChart` data generation logic in `CompHeroWidget.tsx` to map the bonus value to the selected `cashBonusMonth`.
- Increased `PieChart` radii (`innerRadius={110}`, `outerRadius={135}`) to prevent overlap with the center text.
- Added a custom percentage label (`label={({ name, percent }) => ...}`) and `labelLine={true}` to the PieChart to ensure all slices are clearly labeled.

**Files changed**: 
- `src/store/useCompensationStore.ts`
- `src/components/compensation/CompensationModal.tsx`
- `src/components/compensation/CompareView.tsx`
- `src/components/compensation/CompHeroWidget.tsx`
