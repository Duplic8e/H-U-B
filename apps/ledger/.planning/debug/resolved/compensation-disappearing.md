---
status: resolved
trigger: "the compensation total amount is gone, so is the RSU details, and nothing is on package details either"
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: compensation-disappearing

## Context
**Trigger**: 
After the recent update to introduce stock prices for ESPP and RSU calculations, the entire compensation UI went blank (charts disappeared, package details emptied, and total amount vanished).

## Resolution
**Root Cause**: 
The state saved in your browser's `localStorage` from previous sessions did not have the newly introduced `companyCurrentPrice` and `esppLockedInPrice` properties. Because these were `undefined`, the new stock math tried to multiply and divide by `undefined`, which resulted in `NaN` (Not a Number). This `NaN` cascaded up to the `calcTotalComp` function, causing the entire package value to become `NaN` and breaking the Recharts rendering engine and UI components.

**Fix applied**: 
- Added robust fallback values (`|| 0` or `|| 1`) to `calcAnnualESPP`, `calcAnnualRSU`, and `generateVestEvents` in `useCompensationStore.ts`.
- If a stock price doesn't exist in your current local state, it will gracefully fallback to `0` or `1` during math operations to prevent `NaN` cascading, keeping the UI intact while you open the modal to define the stock prices.

**Files changed**: 
- `src/store/useCompensationStore.ts`
