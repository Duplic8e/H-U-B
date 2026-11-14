---
title: "RSU & Salary Calculation Assumptions"
date: 2026-06-18
context: "Exploration for Phase 06 Total Compensation Calculator"
---

# RSU & Salary Calculation Assumptions

Based on our exploration, we've decided on the following constraints for calculating Total Compensation to keep the user experience simple and focused:

1. **Static Salary & Bonus:** The calculation will always use the currently entered base salary and target bonus. We will intentionally ignore multi-year forecasting or expected future salary increases.
2. **Filtered RSU Vestings:** Instead of projecting multiple years into the past or future, Total Compensation will be displayed using two specific time modes:
   - **Current Year:** Summing salary, bonus, and RSUs vesting strictly between Jan 1 and Dec 31 of the current calendar year.
   - **Next 1 Year:** Summing salary, bonus, and RSUs vesting exactly from today's date through 12 months from now.
3. **Excluded RSUs:** Any RSUs that vested in the past (before the start of the selected window) or vest beyond the end of the window are strictly ignored in the Total Compensation sum.
