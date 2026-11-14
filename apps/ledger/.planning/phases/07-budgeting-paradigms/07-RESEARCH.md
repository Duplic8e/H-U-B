# Phase 7: Budgeting Paradigms & Architecture — Research

## Context and Goal
The goal of Phase 7 is to build the underlying budgeting engine that supports Target-Based, Zero-Based, and Ledger Custom paradigms, alongside hierarchical categorization and auditable reallocation.

## Architecture Decisions

### 1. Store Structure (`useBudgetStore.ts`)
Using Zustand with `zustand/middleware` `persist` to match the existing `useCompensationStore.ts` pattern.
The store will contain:
- `transactions: Record<string, Transaction>`: Core expenses and income.
- `categories: Record<string, Category>`: Budget categories with monthly targets.
- `categoryGroups: Record<string, CategoryGroup>`: For hierarchical grouping of categories.
- `reallocations: Record<string, Reallocation>`: Auditable transfer events to cover overspending.
- `paradigm: BudgetingParadigm`: The strictness level setting.

### 2. The Budgeting Paradigms
- **Target-Based**: The simplest mode. Users set targets, and we track spending against those targets without enforcing strict coverage.
- **Zero-Based**: Strict YNAB-style budgeting where every dollar must be assigned to a category. Income minus assigned equals zero. Overspending must be explicitly covered via Reallocations.
- **Ledger Custom**: A hybrid approach offering passive tracking but the *option* to use Reallocations if desired.

### 3. Reallocation Mechanics (Option A)
To provide an auditable trail, when funds are moved between categories to cover overspending, a `Reallocation` object will be created.
```typescript
interface Reallocation {
  id: string;
  fromCategoryId: string;
  toCategoryId: string;
  amount: number;
  date: string;
  note?: string;
}
```

### 4. Time Boundaries
Budgets reset monthly. The store will use dynamic getter functions (or selectors) to compute:
- The total spent in a month per category.
- The net carry-over (surplus) from the previous month.
- The "Unallocated" pool (income minus targets/spent).

## Validation Architecture
- Testing will focus on ensuring the selectors calculate spent/remaining correctly based on the month and year.
- Validating that `reallocations` properly shift available amounts between `fromCategory` and `toCategory`.
