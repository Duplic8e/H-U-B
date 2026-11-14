---
phase: 07-budgeting-paradigms
date: 2026-06-19
---

# Phase 7: Validation Strategy (Nyquist)

## Core Threat to Validity
The primary threat is that the Zero-Based budgeting paradigm mathematically drifts when transactions cross month boundaries or when reallocations occur, causing the sum of "assigned funds" and "unallocated funds" to mismatch the user's actual income.

## Validation Dimensions

### Dimension 2: System Boundaries
- Ensure the state updates properly via Zustand when `reallocateFunds` is called.
- Ensure the UI components can query specific month segments without causing excessive re-renders.

### Dimension 8: Edge Cases
- Moving more funds in a reallocation than what exists in the `fromCategory`.
- Modifying a transaction from a past month and ensuring the "Swept to Savings" or roll-over logic reflects the change.

## Required Proofs
1. **Mathematical Consistency**: Total Income - (Total Spent + Unallocated) == 0 in Zero-Based mode.
2. **Persistence**: The Zustand store accurately restores `reallocations` and `transactions` across browser refreshes.
