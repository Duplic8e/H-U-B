# Phase 9: Milestone v1.0 Gap Closure — Context

## Domain
This phase exists to close architectural and feature gaps discovered during the v1.0 milestone audit. It covers three distinct domains: CSV Ingestion, Auto-Categorization, and Budget Core Math.

## Decisions

### 1. Generic CSV Mapper
Instead of creating a massive complex wizard, if a CSV is unknown, we just dump the raw parsed matrix to the `CSVUploader` widget. The widget will display 3 `<select>` dropdowns (Date, Amount, Description) populated with the CSV headers. Once mapped, it parses and pushes to Triage. Only one-time mapping is supported for now (no saving configs).

### 2. Rules Engine
`autoCategorize.ts` will receive the dictionary of rules from the `useTriageStore`. A new `CategorizationRulesWidget.tsx` will be created below the inbox to view, add, and delete these exact-match (or substring) rules.

### 3. Budget Math Enforcements
The `useBudgetStore`'s `getMonthlyBudgetStats` selector will be refactored to compute `Effective Targets` by aggregating base targets + reallocations for that specific month. Zero-based unallocated math will strictly enforce that income minus effective targets equals unallocated funds.

## Canonical Refs
- v1.0-MILESTONE-AUDIT.md
- v1.0-ROADMAP.md
