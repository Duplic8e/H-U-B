---
wave: 1
depends_on: []
files_modified:
  - src/types/budget.ts
  - src/store/useBudgetStore.ts
autonomous: true
---

# Phase 7: Budgeting Paradigms & Architecture — Plan

## Objective
Implement the core Zustand store and typings for the budgeting engine, supporting hierarchical categories, transactions, auditable reallocations, and paradigm selection.

## Tasks

<task>
  <objective>Define TypeScript models for Budgeting</objective>
  <read_first>
    - src/store/useCompensationStore.ts
  </read_first>
  <action>
    Create `src/types/budget.ts` containing the following exported interfaces/types:
    - `BudgetingParadigm`: 'Target-Based' | 'Zero-Based' | 'Ledger Custom'
    - `CategoryGroup`: `id`, `name`
    - `Category`: `id`, `groupId`, `name`, `targetAmount`
    - `Transaction`: `id`, `date`, `amount`, `categoryId` (optional), `description`, `type` ('expense' | 'income')
    - `Reallocation`: `id`, `fromCategoryId`, `toCategoryId`, `amount`, `date`, `note`
  </action>
  <acceptance_criteria>
    - `src/types/budget.ts` exports all specified types correctly.
  </acceptance_criteria>
</task>

<task>
  <objective>Implement useBudgetStore in Zustand</objective>
  <read_first>
    - src/types/budget.ts
    - src/store/useCompensationStore.ts
  </read_first>
  <action>
    Create `src/store/useBudgetStore.ts`.
    Implement the store state using `persist` middleware with the key `ledger-budget`.
    State properties:
    - `paradigm: BudgetingParadigm` (default: 'Ledger Custom')
    - `transactions: Record<string, Transaction>`
    - `categories: Record<string, Category>`
    - `categoryGroups: Record<string, CategoryGroup>`
    - `reallocations: Record<string, Reallocation>`
    
    Implement actions:
    - `setParadigm`, `addTransaction`, `updateTransaction`, `deleteTransaction`
    - `addCategory`, `updateCategory`, `deleteCategory`
    - `addCategoryGroup`, `updateCategoryGroup`, `deleteCategoryGroup`
    - `addReallocation`, `deleteReallocation`
    
    Implement dynamic computation selectors (e.g., `getMonthlyBudgetStats(year, month)`) as exported helper functions (similar to `calcAnnualBaseSalary` in `useCompensationStore`).
  </action>
  <acceptance_criteria>
    - `src/store/useBudgetStore.ts` compiles without TypeScript errors.
    - Store is persisted using the `ledger-budget` key.
  </acceptance_criteria>
</task>

## Artifacts this phase produces
- `src/types/budget.ts`
- `src/store/useBudgetStore.ts`
- `useBudgetStore`
- `getMonthlyBudgetStats`
