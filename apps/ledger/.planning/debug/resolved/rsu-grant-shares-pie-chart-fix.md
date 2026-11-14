---
status: resolved
trigger: "for RSU actually total grant value doesn't matter, it's the amount of stocks, and the price at it was granted... when adding more info the texts in the pie chart went out of view"
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: rsu-grant-shares-pie-chart-fix

## Context
**Trigger**: 
1. RSU input needed to be "Number of Shares" rather than "Total Grant Value", as grants are typically awarded as a set number of shares.
2. The pie chart labels in the Annualized Breakdown view were getting cut off when multiple components (like base, bonus, ESPP, RSU) were added.

## Resolution
**Fix applied**: 
- **RSU Data Model**: Renamed `totalGrantValue` to `grantShares` across the `RSUGrant` interface, the compensation store logic, and the UI modal.
- **Pie Chart Sizing**: Increased the height of the `CompHeroWidget` container to `340px`, and decreased the pie chart radii (`innerRadius={90}`, `outerRadius={115}`) to provide ample breathing room for the text labels so they never clip out of bounds. The central total text was also scaled down slightly for balance.
- **Monthly RSU Distribution**: Rewrote the monthly bar chart's RSU logic to properly utilize the exact monthly output of `generateVestEvents`, perfectly synchronizing the bar chart visualization with the true vesting schedule.

**Files changed**: 
- `src/store/useCompensationStore.ts`
- `src/components/compensation/CompensationModal.tsx`
- `src/components/compensation/CompHeroWidget.tsx`
