# Phase 8: CSV Import & Smart Triage Inbox — Context

## Domain
Building a CSV import pipeline that ingests bank statements and places transactions into a persistent triage queue where users can review and categorize them before they hit the main ledger.

## Decisions

### 1. CSV Format Handling
- **Custom Bank Parsers:** The system will use specific custom parsers based on real bank statement examples provided by the user. (No visual column mapper or strict template required).

### 2. Triage Persistence
- **Persistent Inbox:** Uncategorized/pending transactions will be stored persistently across browser sessions (via Zustand `persist` in `localStorage`), allowing users to progressively triage large batches.

### 3. Auto-Categorization
- **Substring Matcher:** The app will include simple pattern matching to automatically categorize transactions based on known substrings in the description.

## Code Context
- Implementation will need to interact with the existing `useBudgetStore.ts` to push finalized transactions, and likely require a new state slice (e.g. `useTriageStore` or expanding `useBudgetStore`) to hold the persistent inbox.
- CSV parsing can be handled efficiently via `papaparse` (if installed) or basic browser-native string splitting if strict dependencies are avoided.

## Canonical Refs
- ROADMAP.md
