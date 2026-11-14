---
status: resolved
trigger: there's 3 dots on soe cards, net worth, cashflow, income for example, but it doesn't do anything at the moment. also add transaction should be part of budgeting not in dashboard.
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: dashboard-budget-ui-tweaks

## Context
**Trigger**: there's 3 dots on some cards, net worth, cashflow, income for example, but it doesn't do anything at the moment. also add transaction should be part of budgeting not in dashboard, but Expenses, Income in dashboard should be connected to those ones in the budgeting.

## Resolution
**Root Cause**: `WidgetWrapper` had a fallback UI showing a 3-dots `MoreHorizontal` icon when no action was provided, which was confusing since it had no functionality. The "Add Transaction" button was incorrectly placed on the Master Dashboard instead of the dedicated Budgeting module.
**Fix applied**: 
- Removed the fallback 3-dots icon from `WidgetWrapper.tsx`. Widgets will now only show an action area if a specific action (like the "Add" button on Account categories) is explicitly passed in.
- Removed the "Add Transaction" button and its associated `TransactionModal` state from `Dashboard.tsx`.
- Added the "Add Transaction" button and its `TransactionModal` state to `Budgeting.tsx` in the page header.
- (Note: The Income/Expense/CashFlow widgets on the dashboard and budgeting pages already share the exact same components and global `useBudgetStore`, so adding a transaction in Budgeting will instantly update the widgets on the Dashboard as requested).
**Files changed**: 
- `src/components/dashboard/WidgetWrapper.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Budgeting.tsx`
