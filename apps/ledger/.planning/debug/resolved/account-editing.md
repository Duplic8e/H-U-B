---
status: resolved
trigger: the different accounts (banks, investments, receivables, etc) should also be editable, other assets should just be Others
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: account-editing

## Context
**Trigger**: the different accounts (banks, investments, receivables, etc) should also be editable, other assets should just be Others.

## Resolution
**Root Cause**: The recently created `AccountCategoryWidget` only allowed adding and removing accounts, but lacked an edit flow. The title for the "other" category was hardcoded as "Other Assets" in `Dashboard.tsx`.
**Fix applied**: 
- Added an `updateAccount` action to `useAccountsStore.ts`.
- Updated `AddAccountModal.tsx` to accept an `editingAccount` prop and dynamically switch between "Add" and "Edit" modes, calling the appropriate store action.
- Added an Edit button to the list items in `AccountCategoryWidget.tsx` which opens the modal populated with the account data.
- Renamed "Other Assets" to "Others" in `Dashboard.tsx`.
**Files changed**: 
- `src/store/useAccountsStore.ts`
- `src/components/dashboard/AddAccountModal.tsx`
- `src/components/dashboard/AccountCategoryWidget.tsx`
- `src/pages/Dashboard.tsx`
