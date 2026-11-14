# Transaction Import History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Upload overlapping statements without reviewing already handled charges again, preserving identical real purchases.

**Architecture:** A pure matcher compares immutable original bank rows and daily occurrence signatures. The existing triage store owns persisted records, source profiles and decisions, so backup and sync remain coherent. CSV routing and review components present only new or uncertain rows plus an inspectable skip summary.

**Tech Stack:** TypeScript, React, Zustand persist, Vitest, Testing Library, Playwright.

## Global Constraints

- No em dashes, no new dependencies, no external writes or deployment.
- Preserve unrelated main-checkout changes; work on codex/transaction-import-history.
- Use medium effort or lower during implementation, tests and review.
- Bank originals must survive budget edits. Preserve occurrence counts and card scope.
- Legacy rows require review; never infer source or reconstruct discarded decisions.
- Existing CAD budget semantics remain unchanged.

### Task 1: Pure matching and source metadata

**Files:** Create `src/types/importHistory.ts`, `src/utils/budget/importHistory.ts`, `src/utils/budget/importHistory.test.ts`; modify `src/types/triage.ts`, `src/utils/csvParser.ts`, `src/utils/csvParser.test.ts`.

**Interfaces:** `ImportSource { id, name, bankKey? }`; `ImportRecord { id, sourceId, original: TriageTransaction, decision: pending | accepted | ignored | duplicate }`; `ImportDay { sourceId, date, signature, recordIds }`; `ImportReport { addedIds, skippedIds, changedDays }`. `matchImport(incoming, sourceId, records, days, legacy): { pending, records, days, report }` returns a pure delta. Triage rows may carry `importRecordId`, `duplicateRecordId`, `duplicateTransactionId`; parser rows may carry `bankSource { key, name }`.

- [x] Write behavior tests before the module exists. Example fixture:

```ts
const coffee = (id: string) => ({ id, date: '2026-06-10', amount: 5, description: 'Coffee', type: 'expense' as const })
const first = matchImport([coffee('a'), coffee('b')], 'card-a', {}, [], [])
expect(first.pending).toHaveLength(2)
const repeat = matchImport([coffee('c'), coffee('d')], 'card-a', first.records, first.days, [])
expect(repeat.pending).toHaveLength(0)
expect(repeat.report.skippedIds).toHaveLength(2)
```

- [x] Run `npm test -- --run src/utils/budget/importHistory.test.ts`; expected missing-module failure.
- [x] Implement canonical keys, order-independent daily signatures, exact snapshot matches, one-to-one occurrence consumption, extra-occurrence review and legacy/near-date possible candidates. Store only new daily signatures. No mutation of inputs. Test refund signs, different source/date, extra/omitted/changed rows, pending/ignored decisions and Unicode punctuation.
- [x] Add CIBC bankSource metadata and parser regression coverage; generic exports retain the existing parse return shape.
- [x] Run matcher/parser tests; expected all pass. Commit `feat: match overlapping imports by card and daily occurrences`.

### Task 2: Persist history and decisions

**Files:** Modify `src/store/useTriageStore.ts`, `src/store/useTriageStore.test.ts`, `src/utils/backup.test.ts`.

**Interfaces:** Store adds `importSources`, `importRecords`, `importDays`, `lastImport`; `createImportSource(name, bankKey?)`, `importTransactions(rows, sourceId)`, `restoreImportRecord(id)`. Existing approve/reject/bulk/cancel methods update corresponding record decisions; `addPending` restores pending decisions during Undo.

- [x] Add store tests that import two coffees, approve one, ignore one, edit the accepted budget row, and reimport. Expect zero added, two skipped and original decisions unchanged. Add persistence version-1 migration, cancelled inbox reimport, restored ignores and Accept All Undo tests.
- [x] Run `npm test -- --run src/store/useTriageStore.test.ts src/utils/backup.test.ts`; expect new tests to fail because APIs do not exist.
- [x] Implement source registration, matching commit in a single triage set, immutable record originals, decisions and version-2 migration. Compare legacy budget/pending rows only when they lack provenance. Cancel pending records and invalidate snapshots referring to cancelled IDs; keep accepted/ignored history. Restore ignored entries without auto-approval. Retain bank history after budget deletion.
- [x] Verify history in buildBackup/restoreBackup using existing STORAGE_KEYS.triage. Run store/backup tests; expected all pass. Commit `feat: remember transaction import decisions`.

### Task 3: Import and review interface, end-to-end verification

**Files:** Modify `src/components/budget/CSVUploader.tsx`, `CSVUploader.test.tsx`, `TriageInboxWidget.tsx`, `TriageInboxWidget.test.tsx`; create `ImportSourceSheet.tsx`, `ImportSummary.tsx`, corresponding component tests and `e2e/import-overlap.spec.ts`; update `CHANGELOG.md`.

**Interfaces:** CSVUploader routes bankSource rows automatically; other rows use ImportSourceSheet `onImport(sourceId)` and cancellable source selection. ImportSummary reads `lastImport` and shows inspectable skipped records. Triage actions consume Task 2 APIs.

- [x] Add failing UI tests for source cancellation, source selection, repeated CIBC import summaries, ignored-charge restore, possible-match actions and Undo decision restoration. Adjust legacy assertions to possible duplicate, since original card provenance is unavailable.
- [x] Implement components using existing Sheet/ThemedSelect/Undo patterns. Keep controls accessible, mobile rows wrapping, and source selection labelled. Bulk acceptance excludes flags and possible duplicates; individual Keep both remains deliberate. Show comparison details and omission notices without deleting accepted rows.
- [x] Run focused component tests; expected all pass. Add browser scenario with overlapping exports, two identical coffees, row reorder, persisted reload, deliberate ignore, source isolation and phone overflow check.
- [x] Run lint/build plus focused browser test against an isolated port. Run `npm run verify` with a port-overridden Playwright config if repository port 4173 is occupied. Expected all repository gates pass; diagnose real failures without increasing global timeouts.
- [x] Document feature under Unreleased. Commit `feat: review new charges and summarize repeated imports`.
- [x] Request an independent branch review and fix important findings with regression tests. Re-run affected checks after fixes and report exact validation, plan path and branch status. Keep branch for review; no merge/push without user direction.

## Review Focus

Occurrence counts when identical rows are reordered; partial-day imports; duplicate decisions excluded from occurrence pools; source isolation after imports from different formats; immutable bank originals after shared-bill edits; cancelled snapshots; Undo and persisted reload; legacy migrations; large-history rendering and backup contents.


## Completion evidence

Completed on codex/transaction-import-history. Independent review findings were resolved with regression tests, including transitive cancellation, stale Undo, manual-source binding, multi-card reservations and confirmed aliases. Full repository gate passed: 1,726 unit tests and 265 browser tests, with five configured skips. After the final alias refinement: 1,728 unit tests, lint, TypeScript/build, bundle/eager/type-scale checks and all three desktop/phone/keyboard import browser scenarios passed. No push, merge or deployment.
