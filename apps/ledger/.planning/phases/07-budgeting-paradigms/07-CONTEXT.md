# Phase 7: Budgeting Paradigms & Architecture — Context

## Goal
Build the underlying budgeting engine that supports Target-Based, Zero-Based, and Ledger Custom paradigms, alongside hierarchical categorization and auditable reallocation.

## Decisions

### 1. Data Model for Transactions
- Use an indexed object (`Record<string, Transaction>`) in Zustand for transactions. Although volume is low (~300-400/year), this ensures fast updates, deletes, and a robust architecture for tracking reallocation links.

### 2. Category Hierarchy
- **Hierarchical Groups:** Categories must be organized into customizable parent groups (e.g., "Housing > Rent"). The engine must support adding/removing both groups and categories dynamically. The UI should be able to roll up group totals.

### 3. Reallocation Mechanics
- **Auditable Transfers (Option A):** When a user covers overspending or reallocates, the engine must create a separate "Transfer" record to move funds between categories, preserving the original category targets and maintaining a clear history.

### 4. Time Boundaries
- **Monthly Reset with Savings Sweep:** Every month starts fresh with default target limits. Unspent funds or surplus from the previous month are calculated dynamically and shown explicitly as "Unallocated / Swept to Savings" rather than seamlessly rolling over into the same categories.

## Canonical Refs
- `.planning/REQUIREMENTS.md` — Core feature requirements for v1.1.

## Code Context
- **Patterns:** Reference `useCompensationStore.ts` for Zustand persist patterns.
