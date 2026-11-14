---
status: resolved
trigger: "in dark mode, base salary and cash bonus have the same color. ESPP should have a Locked In Price, and Current Price for the stock... same with RSU, Total Grant Value needs stock price at grant and current price to show current amount"
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: compensation-equity-math

## Context
**Trigger**: 
1. In dark mode, `var(--color-accent)` and the `emerald` color used for the cash bonus looked identical.
2. ESPP and RSUs were using flat dollar/discount math instead of converting inputs into stock shares and evaluating them at a current market price, making the calculator inaccurate for real-world equity plans.

## Resolution
**Fix applied**: 
- Changed the `cashBonus` pie chart color in `CompHeroWidget` from emerald to blue to ensure stark contrast against the base salary accent color in dark mode.
- Overhauled `useCompensationStore` equity math:
  - Added `companyCurrentPrice` and `esppLockedInPrice` to `CompensationPackage`.
  - Added `grantPrice` to `RSUGrant`.
  - `calcAnnualESPP` now calculates the total shares bought at the lock-in price minus discount, then calculates the true profit based on the current market price.
  - `generateVestEvents` now calculates the exact number of shares granted, vests those shares across the schedule, and evaluates the cash value of each vest event using the current market price.
- Added all necessary inputs to the `CompensationModal` and `CompareView` forms to allow users to input these stock prices.

**Files changed**: 
- `src/store/useCompensationStore.ts`
- `src/components/compensation/CompensationModal.tsx`
- `src/components/compensation/CompareView.tsx`
- `src/components/compensation/CompHeroWidget.tsx`
- `src/components/compensation/EquityVestingWidget.tsx`
