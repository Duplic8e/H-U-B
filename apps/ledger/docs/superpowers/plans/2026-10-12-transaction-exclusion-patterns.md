# Transaction Exclusion Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Use inline execution unless the user chooses delegation. The user authorized subagent-driven execution; all tasks and reviews are complete.

**Goal:** Let users define predictable, source-scoped import exclusions, preview their effects, and recover excluded occurrences without duplicates or silent changes to accepted spending.

**Architecture:** A pure exclusion evaluator runs after the existing source/occurrence matcher and uses immutable original parsed bank fields. The persisted triage store owns rules, snapshots of match reasons, occurrence-level overrides and decisions. Small editor, review and history components expose the behavior through the existing Budgeting route, Sheet, ThemedSelect and Undo patterns.

**Tech Stack:** TypeScript, React 19, Zustand persist, Vitest, Testing Library, Playwright, existing Tailwind tokens. No new dependencies.

## Global Constraints

- No em dashes, no new dependencies, no external writes or deployment.
- Preserve unrelated main-checkout changes; work on codex/transaction-import-history.
- Use medium effort or lower during implementation, tests and review.
- Bank originals must survive budget edits. Preserve occurrence counts and card scope.
- Legacy rows require review; never infer source or reconstruct discarded decisions.
- Existing CAD budget semantics remain unchanged.
- Baseline is commit `a7051d1`, version `0.11.2-beta`, in `C:/Users/misha/.codex/worktrees/transaction-import-history/ledger`.
- Keep exclusion metadata outside `importRowKey`, daily signatures and `ImportRecord.original`.
- Saving rules affects future imports by default. Applying to current pending rows is explicit. Accepted transactions remain untouched.
- Excluded records remain in import history. Never add an excluded record to the budget store or erase its bank original.
- Default to review. Automatic exclusion is an explicit per-rule choice. A possible duplicate always remains in review.
- Manual inclusion/restoration bypasses user exclusion rules for that occurrence, including edited or newly created rules. It does not bypass duplicate review or built-in card-payment recognition.
- No regex, fuzzy/AI matching, automatic exclusion learning, nested rule logic, account reconciliation or accepted-history exclusion in this release.

## Product decisions fixed by this plan

Source: [research and proposed direction](../../research/2026-10-12-transaction-exclusion-patterns.md). The user's request to write this plan selects the recommended direction for planning; the UI remains reviewable before implementation.

1. Match original parsed bank description, not the edited merchant label. Normalize surrounding/repeated whitespace and case only. Preserve punctuation and accents.
2. Text operators are Exactly matches, Contains, Starts with. All enabled criteria combine with AND. There is one text criterion per rule.
3. Scope is one saved import source or explicit all sources. A row-created rule defaults to its source, exact original description, observed money direction, any amount and review mode. A blank new rule requires an explicit source selection, including an explicit All cards/accounts choice.
4. Direction is money in/out/either, derived from signed cash movement rather than `type` alone. An expense refund is money in. Zero amounts match only either.
5. Amount matching uses absolute rounded cents with inclusive exact/range operators. Inputs allow nonnegative values with at most two decimal places; reject nonfinite values, inverted ranges and unsafe integer cents.
6. Preview shows all canonical sourced import records, including accepted, ignored and pending; duplicate aliases do not inflate totals. Pending possible duplicates appear as identity-needs-review and cannot be automatically excluded. Unscoped legacy pending rows are shown as unavailable for source/original-bank preview, not guessed.
7. When rules overlap, any review-mode match wins over automatic mode. Display every matching rule name, sorted by stable ID. There is no priority editor.
8. Review flags and reason snapshots persist until the user resolves them. Pausing/editing/deleting a rule does not clear previous flags or decisions. Explicitly applying current rules to pending rows recalculates user-rule holds for those eligible rows only.
9. Exclude once is distinct from Exclude similar transactions. Ordinary Ignore never learns a rule. Existing card-payment recognition retains its behavior.
10. Included/restored occurrences retain a persisted `include` override. Restoration returns the same original ID to review. It never auto-approves or creates an extra occurrence.
11. Excluded view covers all ignored import records, not only the last upload. Distinguish Rule exclusion, Card payment and Ignored once. Older ignored records without a reason display Ignored once.
12. Cancel closes the editor without writes. Discard All cancels pending imports using the existing semantics; already automatic-excluded decisions remain deliberate handled history.
13. Save-plus-apply is one synchronous validated store action. No partial save or partial exclusion if the draft or source is invalid.
14. Continue the pending 0.11.2-beta release on this branch, add accurate changelog bullets only after implementation is verified, and leave merge/push/deployment for separate authorization.

## File structure and ownership

Paths below are relative to the worktree above.

| File | Responsibility |
|---|---|
| `src/types/exclusionRules.ts` (new) | Persisted rule, draft, match snapshot and preview contracts |
| `src/utils/budget/exclusionRules.ts` (new) | Validation, text matching, direction, evaluation and pure previews |
| `src/utils/budget/applyImportExclusions.ts` (new) | Pure decision/hold transformation of newly matched import records |
| `src/types/importHistory.ts` | Optional reason/override fields and report extension |
| `src/types/triage.ts` | Optional user-rule hold snapshot on review rows |
| `src/store/useTriageStore.ts` | Version-3 migration, rule lifecycle, application, inclusion and restoration |
| `src/components/budget/ExclusionRuleSheet.tsx` (new) | Draft inputs, validation and explicit save/apply choices |
| `src/components/budget/ExclusionRulePreview.tsx` (new) | Preview counts, separate movement totals and sample rows |
| `src/components/budget/ExclusionRulesWidget.tsx` (new) | Rule management in Setup |
| `src/components/budget/ExcludedImportsWidget.tsx` (new) | Persistent excluded history in Transactions |
| `src/components/budget/TriageInboxWidget.tsx` | Rule reasons, Exclude/Include/batch actions and rule creation |
| `src/components/budget/ImportSummary.tsx` | New automatic-exclusion counts and links to history |
| `src/components/budget/CSVUploader.tsx` | Aggregate automatic-exclusion IDs across source groups |
| `src/pages/Budgeting.tsx` | Place management and history widgets on current tabs |
| New colocated tests and `e2e/import-exclusions.spec.ts` | Behavior, persistence, keyboard and viewport coverage |
| `CHANGELOG.md` | Verified 0.11.2-beta release note |

Do not restructure `useBudgetStore`, rewrite the importer, replace categorization rules or modify source identity. Extract the pure helpers above to keep additional logic out of the store/component bodies.

### Shared test fixtures

Put these declarations directly in each new utility/store test file that uses `draft`, `sources` or `row`, with imports from the exact module under test. Tests are self-contained; do not import fixtures from another test module.

```ts
const sources = { a: { id: 'a', name: 'Card A' } }
const draft: ExclusionRuleDraft = {
  name: 'Payments', sourceId: 'a', description: { operator: 'exact', value: 'PAYMENT' },
  direction: 'in', amount: { operator: 'any' }, behavior: 'review',
}
const row: TriageTransaction = {
  id: 'a', date: '2026-06-10', description: 'PAYMENT', amount: 50, type: 'income',
}
```

Store tests reset `useTriageStore`, `useBudgetStore` and `useUndoStore` to captured initial states before each case, matching existing store tests. UI tests seed the same source, record and pending ID explicitly before rendering; use `vi.fn()` for `onClose`. Do not assume fixtures left behind by another test.

## Task 1: Rule contracts, migration and monetary semantics

**Files:** Create `src/types/exclusionRules.ts`, `src/utils/budget/exclusionRules.ts`, `src/utils/budget/exclusionRules.test.ts`; modify `src/types/importHistory.ts`, `src/types/triage.ts`, `src/store/useTriageStore.ts`; extend `src/store/useTriageStore.test.ts`.

**Interfaces produced:** `ExclusionRuleDraft`, `ExclusionRule`, `ExclusionMatch`, `ExclusionPreview`, `cashMovementCents`, `validateExclusionDraft`. No evaluation of imports yet.

- [x] Add contracts:

```ts
export type ExclusionRuleDraft = {
  name: string
  sourceId: string | null // null is an explicitly chosen all-source rule
  description: { operator: 'exact' | 'contains' | 'starts-with'; value: string }
  direction: 'in' | 'out' | 'either'
  amount: { operator: 'any' } | { operator: 'exact'; cents: number } |
    { operator: 'between'; minCents: number; maxCents: number }
  behavior: 'review' | 'automatic'
}
export type ExclusionRule = ExclusionRuleDraft & {
  id: string; revision: number; enabled: boolean
}
export type ExclusionMatch = {
  ruleId: string; revision: number; name: string; behavior: 'review' | 'automatic'
}
export type ExclusionPreview = {
  rows: Array<{ recordId: string; sourceId: string; description: string;
    date: string; movementCents: number; decision: 'pending' | 'accepted' | 'ignored';
    identityNeedsReview: boolean; overridden: boolean }>
  count: number; moneyInCents: number; moneyOutCents: number
  pendingCount: number; acceptedCount: number; ignoredCount: number
  eligiblePendingCount: number; legacyUnavailableCount: number
}
```

In `ImportRecord` add `exclusionMatches?: ExclusionMatch[]`, `exclusionOverride?: 'include'`, `ignoreReason?: 'rule' | 'card-payment' | 'manual'`. In `TriageTransaction` add `exclusionMatches?: ExclusionMatch[]`. In `ImportReport` add optional `excludedIds?: string[]` for backward compatibility with old persisted reports and existing callers.

- [x] Write a failing direction/validation test:

```ts
it('distinguishes refunds from purchases and rejects inverted cent ranges', () => {
  expect(cashMovementCents({ type: 'expense', amount: -12.5 })).toBe(1250)
  expect(cashMovementCents({ type: 'expense', amount: 12.5 })).toBe(-1250)
  expect(cashMovementCents({ type: 'income', amount: 12.5 })).toBe(1250)
  expect(validateExclusionDraft({ ...draft,
    amount: { operator: 'between', minCents: 2000, maxCents: 1000 } }, sources))
    .toContain('Enter a valid amount range')
})
```

Define `draft` as a valid Card A exact PAYMENT rule and `sources = { a: { id: 'a', name: 'Card A' } }` in this test file. Add tests for missing source, empty name/text, zero, NaN, unsafe integer cents and valid inclusive boundaries.

- [x] Run `npm test -- --run src/utils/budget/exclusionRules.test.ts`; expect a missing exported helper or missing module failure, not a fixture/setup failure.
- [x] Implement helper and validation with explicit errors:

```ts
export const cashMovementCents = (row: Pick<TriageTransaction, 'type' | 'amount'>) =>
  Math.round((row.type === 'income' ? row.amount : -row.amount) * 100)

export function validateExclusionDraft(draft: ExclusionRuleDraft,
  sources: Record<string, ImportSource>): string[] {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Enter a rule name')
  if (!draft.description.value.trim()) errors.push('Enter a description pattern')
  if (draft.sourceId !== null && !sources[draft.sourceId]) errors.push('Choose an available card or account')
  const cents = (n: number) => Number.isSafeInteger(n) && n >= 0
  if (draft.amount.operator === 'exact' && !cents(draft.amount.cents)) errors.push('Enter a valid amount')
  if (draft.amount.operator === 'between' && (!cents(draft.amount.minCents) ||
    !cents(draft.amount.maxCents) || draft.amount.minCents > draft.amount.maxCents))
    errors.push('Enter a valid amount range')
  return errors
}
```

Validate operator/direction/behavior unions at the persistence boundary before executing imported rules; invalid persisted rules must be inert and shown as needing correction, never broadened by a fallback. Test malformed restored rules.

- [x] Add persisted `exclusionRules: Record<string, ExclusionRule>` with initial `{}`. Bump only triage persist version to 3. Export `migrateTriageState(persisted: unknown, version: number)` and wire it as `migrate`:

```ts
export function migrateTriageState(persisted: unknown, version: number) {
  const state = (persisted ?? {}) as Partial<TriageState>
  return { ...state,
    ...(version < 2 ? { importSources: {}, importRecords: {}, importDays: [], lastImport: null } : {}),
    exclusionRules: state.exclusionRules ?? {},
  }
}
```

Version-2 history must survive intact; the current migration that initializes history on every migration cannot remain. Keep version-0/1 behavior. New optional record fields need no fabricated past reason.

- [x] Test versions 0, 1, 2 and 3 round-trip via `persist.rehydrate`, including old pending rows and accepted/ignored daily snapshots. Run `npm test -- --run src/utils/budget/exclusionRules.test.ts src/store/useTriageStore.test.ts`; expect all selected tests pass.
- [x] Stage only this task's files and commit `feat: define exclusion rule contracts and preserve import migration`.

## Task 2: Pure matching and inspectable previews

**Files:** Extend `src/utils/budget/exclusionRules.ts` and its tests.

**Consumes:** Task 1 contracts and validation. **Produces:** `matchesExclusionRule(rule, original, sourceId): boolean`, `evaluateExclusionRules(rules, original, sourceId): ExclusionMatch[]`, `previewExclusionRule(draft, records, pending): ExclusionPreview`.

- [x] Write failing operator/source tests:

```ts
it('matches original text with precise scope and normalized whitespace', () => {
  const row = { id: 'x', date: '2026-06-10', description: '  PAYMENT   THANK YOU / MERCI ',
    type: 'income' as const, amount: 50 }
  const rule: ExclusionRule = { ...draft, id: 'r', revision: 1, enabled: true,
    description: { operator: 'starts-with', value: 'payment thank you' } }
  expect(matchesExclusionRule(rule, row, 'a')).toBe(true)
  expect(matchesExclusionRule(rule, row, 'b')).toBe(false)
  expect(matchesExclusionRule({ ...rule, description: { operator: 'exact', value: 'payment thank you' } }, row, 'a')).toBe(false)
})
```

Add isolated tests for contains contiguous phrase, starts-with position, punctuation/accents, paused rule, negative-expense refund, zero direction, exact/range inclusive cents and source-null intentional global rule. A pending edited description must not affect preview.

- [x] Run the focused test file; expect missing matching exports.
- [x] Implement matcher using the exact contracts:

```ts
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
export function matchesExclusionRule(rule: ExclusionRule, original: TriageTransaction,
  sourceId: string): boolean {
  if (!rule.enabled || !normalize(rule.description.value)) return false
  if (rule.sourceId !== null && rule.sourceId !== sourceId) return false
  const movement = cashMovementCents(original)
  if (!Number.isSafeInteger(movement)) return false
  if (rule.direction === 'in' && movement <= 0) return false
  if (rule.direction === 'out' && movement >= 0) return false
  const text = normalize(original.description), pattern = normalize(rule.description.value)
  const textMatches = rule.description.operator === 'exact' ? text === pattern :
    rule.description.operator === 'contains' ? text.includes(pattern) : text.startsWith(pattern)
  if (!textMatches) return false
  const amount = Math.abs(movement)
  return rule.amount.operator === 'any' || (rule.amount.operator === 'exact'
    ? amount === rule.amount.cents : amount >= rule.amount.minCents && amount <= rule.amount.maxCents)
}
export function evaluateExclusionRules(rules: ExclusionRule[], original: TriageTransaction,
  sourceId: string): ExclusionMatch[] {
  return [...rules].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .filter(rule => matchesExclusionRule(rule, original, sourceId))
    .map(({ id, revision, name, behavior }) => ({ ruleId: id, revision, name, behavior }))
}
```

Call validation before supplying rules to this helper; add exhaustive union validation so unsupported runtime operators cannot accidentally become starts-with/between.

- [x] Implement preview: turn draft into an enabled temporary rule; filter `records` to decisions other than duplicate and matching originals; build rows from originals; determine ambiguity using the current pending row's duplicate field, override from the record, and current decision. Count rows and absolute directional cents separately. `eligiblePendingCount` includes pending matches without include override; possible duplicates are eligible for a review hold but never automatic exclusion. Count legacy unavailable pending rows where `!tx.importRecordId`; don't include them in match totals. Sort by date descending then record ID, without mutating inputs.

```ts
const summary = rows.reduce((a, row) => ({
  ...a, count: a.count + 1,
  moneyInCents: a.moneyInCents + Math.max(0, row.movementCents),
  moneyOutCents: a.moneyOutCents + Math.max(0, -row.movementCents),
  pendingCount: a.pendingCount + Number(row.decision === 'pending'),
  acceptedCount: a.acceptedCount + Number(row.decision === 'accepted'),
  ignoredCount: a.ignoredCount + Number(row.decision === 'ignored'),
  eligiblePendingCount: a.eligiblePendingCount + Number(row.decision === 'pending' && !row.overridden),
}), { count: 0, moneyInCents: 0, moneyOutCents: 0, pendingCount: 0,
  acceptedCount: 0, ignoredCount: 0, eligiblePendingCount: 0 })
```

- [x] Add preview tests proving two original $5 coffees count twice, a confirmed alias does not count again, accepted matches are read-only, amounts don't cancel each other, and legacy unavailable counts are explicit. Run the focused file to green; commit `feat: match and preview source-scoped exclusion rules`.

## Task 3: New-import evaluation and accurate summaries

**Files:** Create `src/utils/budget/applyImportExclusions.ts` and `.test.ts`; modify `src/store/useTriageStore.ts`, `src/components/budget/CSVUploader.tsx`, `src/components/budget/CSVUploader.test.tsx`, `src/store/useTriageStore.test.ts`.

**Consumes:** `matchImport` result and Task 2 evaluator. **Produces:** `applyImportExclusions(pending, records, rules): { pending: TriageTransaction[]; records: Record<string, ImportRecord>; excludedIds: string[] }`. Call only on newly returned pending rows, not the entire inbox.

- [x] Write failing integration tests: automatic match creates ignored history without budget entry; review match remains pending and is absent from approveAll results; repeated excluded upload returns one skip and zero new exclusions; different source is not held; possible duplicate with automatic match stays pending; overlapping review+automatic rules prefer review.

```ts
it('retains automatically excluded originals across repeat uploads', () => {
  const s = useTriageStore.getState(), sourceId = s.createImportSource('Card A')
  s.saveExclusionRule({ ...draft, sourceId, behavior: 'automatic' })
  const row = { id: 'a', date: '2026-06-10', description: 'PAYMENT', amount: 50, type: 'income' as const }
  const first = s.importTransactions([row], sourceId)
  expect(first.excludedIds).toEqual(['a'])
  expect(useTriageStore.getState().importRecords.a.decision).toBe('ignored')
  expect(useBudgetStore.getState().transactions.a).toBeUndefined()
  const repeat = s.importTransactions([{ ...row, id: 'b' }], sourceId)
  expect(repeat.skippedIds).toEqual(['a'])
  expect(repeat.excludedIds).toEqual([])
})
```

`saveExclusionRule` is introduced as part of this task with signature `(draft: ExclusionRuleDraft, options?: { id?: string; applyPending?: boolean }): string`; pending application is implemented in Task 4. Reject `applyPending: true` until Task 4 rather than silently ignoring it.

- [x] Run selected tests and verify failures are missing behavior.
- [x] Implement the pure transform:

```ts
export function applyImportExclusions(pending: TriageTransaction[],
  existing: Record<string, ImportRecord>, rules: ExclusionRule[]) {
  const records = { ...existing }, kept: TriageTransaction[] = [], excludedIds: string[] = []
  for (const tx of pending) {
    const record = tx.importRecordId ? records[tx.importRecordId] : undefined
    if (!record || record.exclusionOverride === 'include') {
      kept.push({ ...tx, exclusionMatches: undefined }); continue
    }
    const matches = evaluateExclusionRules(rules, record.original, record.sourceId)
    const automatic = matches.length > 0 && !tx.duplicate && matches.every(m => m.behavior === 'automatic')
    records[record.id] = { ...record, exclusionMatches: matches.length ? matches : undefined,
      decision: automatic ? 'ignored' : 'pending', ignoreReason: automatic ? 'rule' : undefined }
    if (automatic) excludedIds.push(record.id)
    else kept.push({ ...tx, exclusionMatches: matches.length ? matches : undefined })
  }
  return { pending: kept, records, excludedIds }
}
```

In `importTransactions`, pass `result.pending` and `result.records` through this helper; merge kept rows with existing pending, persist transformed records and untouched days, and return/persist `{ ...result.report, excludedIds }`. Retain existing Undo invalidation.

Implement `saveExclusionRule` validation before mutation, UUID on creation, revision increment on edits, preserve enabled state on edit. Invalid sources/drafts throw the first explicit error and write nothing. Filter invalid persisted rules out before evaluation.

- [x] Update `approveAll` and the UI's acceptable-count predicate to require `!tx.exclusionMatches?.length` in addition to existing flag/duplicate checks. Do not automatically approve a held row through plain store approval; Task 4 provides an explicit override action.
- [x] Initialize CSV aggregate `excludedIds: []` and concatenate `result.excludedIds ?? []`. Define report `addedIds` as all newly recorded occurrences, including excluded; display sent-to-review count as added minus excluded. Skipped and excluded counters remain distinct. Add multi-source aggregation test.
- [x] Run `npm test -- --run src/utils/budget/applyImportExclusions.test.ts src/store/useTriageStore.test.ts src/components/budget/CSVUploader.test.tsx src/utils/budget/importHistory.test.ts`. Commit `feat: evaluate exclusions after import occurrence matching`.

## Task 4: Manual resolution, rule lifecycle, explicit pending application and Undo

**Files:** Modify `src/store/useTriageStore.ts`, `src/store/useTriageStore.test.ts`; create `src/store/triageExclusions.test.ts` for focused state-transition coverage; extend `src/utils/backup.test.ts`, `src/utils/syncService.test.ts` only where serialization assertions are needed.

**Interfaces produced:**

```ts
saveExclusionRule(draft: ExclusionRuleDraft, options?: { id?: string; applyPending?: boolean }): string
setExclusionRuleEnabled(id: string, enabled: boolean): void
deleteExclusionRule(id: string): void
applyExclusionRulesToPending(): string[] // returns automatically excluded IDs
includeExclusionMatch(id: string): void // remove user-rule hold, preserve duplicate/card flags
excludeExclusionMatches(ids: string[]): string[] // returns actual ignored record IDs
```

`restoreImportRecord(id)` retains its existing signature, now clears user holds and adds include override. Existing `rejectTransaction(id)` retains its signature and records rule/card/manual reason from the pending row.

- [x] Write RED tests for sticky inclusion, restoration with same ID, pause/edit/delete preserving history/reasons, applying pending without modifying accepted rows, ordinary rejection not learning a rule, and stale Undo after reimport. Add a test where restoration plus Discard All invalidates dependent aliases using existing cancellation behavior.

```ts
it('restores the same occurrence without reapplying active rules', () => {
  const s = useTriageStore.getState(), sourceId = s.createImportSource('Card A')
  s.saveExclusionRule({ ...draft, sourceId, behavior: 'automatic' })
  s.importTransactions([row], sourceId)
  s.restoreImportRecord(row.id)
  s.applyExclusionRulesToPending()
  const current = useTriageStore.getState()
  expect(current.pendingTransactions[row.id].exclusionMatches).toBeUndefined()
  expect(current.importRecords[row.id].exclusionOverride).toBe('include')
  expect(Object.keys(current.pendingTransactions)).toEqual([row.id])
})
```

- [x] Run `npm test -- --run src/store/triageExclusions.test.ts` and confirm behavioral failures.
- [x] Implement scoped transitions. `includeExclusionMatch` looks up a sourced pending record, sets `exclusionOverride: 'include'`, clears row/record user-rule matches, leaves duplicate fields and built-in flag unchanged. It does not approve. Plain approve refuses user-rule-held rows; the explicit Include then Approve flow handles them.

```ts
includeExclusionMatch: (id) => set(state => {
  const tx = state.pendingTransactions[id]
  const record = tx?.importRecordId ? state.importRecords[tx.importRecordId] : undefined
  if (!tx || !record) return state
  return {
    pendingTransactions: { ...state.pendingTransactions,
      [id]: { ...tx, exclusionMatches: undefined } },
    importRecords: { ...state.importRecords,
      [record.id]: { ...record, exclusionOverride: 'include', exclusionMatches: undefined } },
  }
}),
```

Implement `restoreImportRecord` for ignored records by preserving original, constructing the pending row with the same ID/source, clearing rule matches and prior ignore reason, and setting include override. Retain the original built-in flag. Resolve duplicates first; a rule exclusion cannot be used as a substitute for Same charge.

`excludeExclusionMatches` processes only present rows with rule holds and without duplicate flags. Rejecting a duplicate manually remains possible as Ignore this charge using existing controls, but batch rule exclusion skips it. Batch uses one state update and records `ignoreReason: 'rule'`. `rejectTransaction` preserves matches as historical reasons, selecting rule first, card second, manual otherwise.

`applyExclusionRulesToPending` evaluates only sourced pending records, excludes accepted/ignored/duplicate decisions, honors include overrides, and uses the same helper as new imports. It replaces only the selected pending record decisions/holds, keeping budget transactions and days unchanged. Explicit apply recalculates holds from all currently valid enabled rules, not just the newly saved rule. Label the UI action accordingly: Apply current rules to transactions awaiting review.

For Save-plus-apply, validate the draft/source first, assemble the next rule set, evaluate eligible pending rows before `set`, and commit rules/records/pending in one update. Disabled rule edits stay disabled. Reject nonexistent edit IDs instead of creating replacements.

- [x] Add pause/delete methods that mutate only the rule set. Store snapshot names/revisions remain after a rule disappears. No past budget mutation, restoration or hold-clearing side effect.
- [x] Preserve metadata during `addPending`: start from previous record metadata; set decision pending, clear duplicate links as current Undo semantics require, retain original, restored include override and previous reason snapshots as appropriate. Undo must restore the pre-action scoped row and record snapshots, including missing optional fields, not rebuild them from the current rules. Invalidate old Undo on every new store action affecting import decisions/rules; UI installs the fresh offer after the action. Never restore the entire store from a snapshot.

Use `useUndoStore.offerUndo` with captured affected pending rows and `ImportRecord`s, and merge only those IDs on Undo. Rule save Undo also restores the prior rule or removes the newly created ID. A subsequent import dismisses that closure, as it does today. Do not create a persisted closure.

- [x] Add backup/rehydration test containing a paused rule, revision snapshot, ignored record and include override. Verify the existing `ledger-triage` storage key handles all fields without new backup registry keys. Confirm sync service passes the same persisted payload; extend its tests without adding a new remote service.
- [x] Run `npm test -- --run src/store/triageExclusions.test.ts src/store/useTriageStore.test.ts src/utils/backup.test.ts src/utils/syncService.test.ts src/utils/budget/importHistory.test.ts`. Commit `feat: resolve and restore exclusion decisions safely`.

## Task 5: Rule editor, preview and management

**Files:** Create `ExclusionRuleSheet.tsx`, `ExclusionRulePreview.tsx`, `ExclusionRulesWidget.tsx` and colocated `.test.tsx` files under `src/components/budget`; modify `src/pages/Budgeting.tsx` and `src/pages/Budgeting.test.tsx`.

**Interfaces:**

```ts
type ExclusionRuleSheetProps = {
  open: boolean; onClose: () => void
  ruleId?: string; seedRecordId?: string
}
// ExclusionRulePreview consumes { preview: ExclusionPreview }.
// ExclusionRulesWidget has no props and opens ExclusionRuleSheet.
```

- [x] Before building UI, show a simple mockup on the actual Transactions/Setup route for user review, consistent with surrounding widgets. Show row entry point, compact rule editor and collapsed excluded history. Preserve the agreed small surface; user review of this plan does not select an elaborate replacement screen.
- [x] Write failing UI tests for row defaults, cancel with no writes, form errors, original-text preview after display-name edits, exact/contains/starts-with selection, explicit global scope, preview count changes, unchecked pending-apply default, and automatic-mode explanatory copy.

```tsx
it('does not save or apply on cancel', () => {
  render(<ExclusionRuleSheet open onClose={onClose} seedRecordId="a" />)
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'My payments' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(useTriageStore.getState().exclusionRules).toEqual({})
  expect(useTriageStore.getState().pendingTransactions.a).toBeDefined()
  expect(onClose).toHaveBeenCalledOnce()
})
```

- [x] Run the three component test files to RED.
- [x] Implement controlled draft initialization on editor open or editing-target change. When `seedRecordId` exists, read only `importRecords[id].original` and source. Missing seed/source reports Source information unavailable; do not guess a scoped rule from a legacy row. A blank Add rule sheet uses empty name/text and a required scope placeholder, then maps the explicit All cards/accounts option to null.

Amount parsing must preserve invalid user input instead of coercing it to zero:

```ts
function parseAmountCents(text: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim())) return null
  const value = Math.round(Number(text.trim()) * 100)
  return Number.isSafeInteger(value) ? value : null
}
```

Keep amount text local; construct the typed draft only after valid parsing. Render inline errors with `role="alert"`, associate them with labels/fields and disable save until draft validation passes. Do not use placeholder text as a label.

Sheet structure and actual copy:

```tsx
<Sheet open={open} onClose={onClose} title="Exclusion Rule"
  ariaLabel="Exclusion Rule" panelClassName="max-w-xl"
  contentClassName="flex flex-col gap-4 p-4">
  <h2 className="hidden desktop:block text-[18px] font-semibold">Exclusion Rule</h2>
  <p className="text-[14px] text-text-secondary">
    Keep matching imports out of income and spending totals. You can review or restore them.
  </p>
  <label className="flex flex-col gap-1 text-[14px]">Rule name
    <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
  </label>
  <ThemedSelect ariaLabel="Card or account" value={scopeChoice}
    onChange={value => { setScopeChoice(value); setDraft({ ...draft, sourceId: value === 'all' ? null : value }) }}
    options={[{ value: '', label: 'Choose a card or account' }, { value: 'all', label: 'All cards/accounts' },
      ...Object.values(sources).map(source => ({ value: source.id, label: source.name }))]} />
  <ThemedSelect ariaLabel="Description match" value={draft.description.operator}
    onChange={value => setDraft({ ...draft, description: { ...draft.description,
      operator: value as ExclusionRuleDraft['description']['operator'] } })}
    options={[{ value: 'exact', label: 'Exactly matches' }, { value: 'contains', label: 'Contains' },
      { value: 'starts-with', label: 'Starts with' }]} />
  <label className="flex flex-col gap-1 text-[14px]">Original bank description
    <input value={draft.description.value} onChange={e => setDraft({ ...draft,
      description: { ...draft.description, value: e.target.value } })} />
  </label>
  <ThemedSelect ariaLabel="Money direction" value={draft.direction}
    onChange={value => setDraft({ ...draft, direction: value as ExclusionRuleDraft['direction'] })}
    options={[{ value: 'in', label: 'Money in' }, { value: 'out', label: 'Money out' }, { value: 'either', label: 'Either' }]} />
  <ThemedSelect ariaLabel="Amount match" value={amountOperator}
    onChange={value => setAmountOperator(value as ExclusionRuleDraft['amount']['operator'])}
    options={[{ value: 'any', label: 'Any amount' }, { value: 'exact', label: 'Exact amount' },
      { value: 'between', label: 'Between amounts' }]} />
  {amountOperator !== 'any' && <label className="flex flex-col gap-1 text-[14px]">
    {amountOperator === 'exact' ? 'Amount' : 'Minimum amount'}
    <input inputMode="decimal" value={amountText} onChange={e => setAmountText(e.target.value)} />
  </label>}
  {amountOperator === 'between' && <label className="flex flex-col gap-1 text-[14px]">Maximum amount
    <input inputMode="decimal" value={maxAmountText} onChange={e => setMaxAmountText(e.target.value)} />
  </label>}
  <ThemedSelect ariaLabel="Behavior" value={draft.behavior}
    onChange={value => setDraft({ ...draft, behavior: value as ExclusionRuleDraft['behavior'] })}
    options={[{ value: 'review', label: 'Review matches' }, { value: 'automatic', label: 'Automatically exclude' }]} />
  <ExclusionRulePreview preview={preview} />
  <label className="flex items-start gap-2 text-[14px]">
    <input type="checkbox" checked={applyPending} onChange={e => setApplyPending(e.target.checked)} />
    Apply current rules to transactions awaiting review
  </label>
  <p className="text-[13px] text-text-secondary">Already accepted transactions will stay unchanged.</p>
  <div className="flex flex-wrap justify-end gap-2">
    <button type="button" className="min-h-11 px-3" onClick={onClose}>Cancel</button>
    <button type="button" className="min-h-11 px-3" disabled={errors.length > 0}
      onClick={save}>Save Rule</button>
  </div>
</Sheet>
```

Field matrix (implement every row as controlled state; ThemedSelect uses its existing `value`, `onChange`, `ariaLabel`, `options` props):

| Label | Values / handler |
|---|---|
| Rule name | input; draft.name |
| Card or account | source IDs, explicit All cards/accounts; draft.sourceId |
| Description match | exact/contains/starts-with |
| Original bank description | input; draft.description.value |
| Money direction | in/out/either |
| Amount match | any/exact/between |
| Amount / Minimum amount / Maximum amount | decimal inputs, conditionally visible; parsed cents |
| Behavior | review/automatic |

Automatic copy: Matching new imports will be excluded automatically and kept in Excluded imports. Possible duplicates still need review. Review copy: Matches will wait for your decision and stay out of Accept All.

`save` builds/validates current draft, calls `saveExclusionRule(draft, { id: ruleId, applyPending })`, catches errors for inline display, then closes only on success. Never write while changing form fields. When applyPending is selected, show the total eligible pending count across the next enabled rule set, including the drafted rule, and explain that all current rules will be reapplied; do not present the drafted rule's own preview count as the total affected count.

- [x] Preview component uses `moneyInCents / 100` and `moneyOutCents / 100` with existing `formatMoney`. Render count, separate movement totals, pending/accepted/ignored counts, preview coverage note, explicit no-matches state, legacy unavailable note and first 20 matched rows with Show 20 more. Each row shows original description, date, source name, decision and identity/override badges. Preview is read-only; no selection of accepted entries.
- [x] Management widget shows name, source, human-readable conditions and Review/Automatic plus Active/Paused status. Add labeled Edit, Pause/Resume and Delete actions. Delete uses existing ConfirmDialog with copy Deleting this rule stops future matches. Previous exclusions remain available to restore. Include empty state No exclusion rules yet. No drag-to-reorder control.
- [x] Place ExclusionRulesWidget after CategorizationRulesWidget on Setup. Test it renders once and preserves the existing tabs. Run component and Budgeting tests; commit `feat: add exclusion rule editing and preview`.

## Task 6: Review actions, persistent excluded history and import report

**Files:** Modify `TriageInboxWidget.tsx`, `ImportSummary.tsx`, their tests and `Budgeting.tsx`; create `ExcludedImportsWidget.tsx` and `.test.tsx`.

**Consumes:** Store methods from Task 4 and editor from Task 5. **Produces:** complete user flow without reliance on the latest report.

- [x] Write RED tests: rule reason visible, held row not counted in Accept All, Include clears only user hold, Exclude captures reason, possible duplicate not in batch, creation seed uses original record, persistent history survives lastImport null and deletion of rule, restored row same ID, prior card/ignored history visible.

```tsx
it('can restore a rule exclusion without a recent upload report', () => {
  useTriageStore.setState({ lastImport: null })
  render(<ExcludedImportsWidget />)
  fireEvent.click(screen.getByText(/Excluded imports/))
  fireEvent.click(screen.getByRole('button', { name: 'Restore PAYMENT to review' }))
  expect(useTriageStore.getState().pendingTransactions.a.id).toBe('a')
  expect(useTriageStore.getState().importRecords.a.exclusionOverride).toBe('include')
})
```

- [x] Run targeted UI files to RED.
- [x] Extend triage cards with matching snapshot names and explicit Exclude and Include this transaction buttons. Include removes the user hold only; category selection and existing Approve/duplicate actions still work afterward. Never clear card-payment flags implicitly. Keep Same charge/Keep both on ambiguous rows. Exclude similar transactions opens one shared ExclusionRuleSheet with seed record ID; legacy rows display Source information unavailable rather than silently drafting a source.

```tsx
{tx.exclusionMatches?.length ? <div className="flex flex-col gap-2">
  <p className="text-[13px] text-text-secondary">
    Matches exclusion rule: {tx.exclusionMatches.map(match => match.name).join(', ')}
  </p>
  <div className="flex flex-wrap gap-2">
    {!tx.duplicate && <button className="min-h-11 px-3" onClick={() => excludeWithUndo(tx)}>Exclude</button>}
    <button className="min-h-11 px-3" onClick={() => includeWithUndo(tx)}>Include this transaction</button>
  </div>
</div> : null}
```

`excludeWithUndo` and `includeWithUndo` capture affected row/record snapshots before calling the store action; install a fresh Undo entry afterward. Batch Exclude matches selects only sourced held nonduplicate rows, uses the same action once and offers one Undo. Update every acceptable-count/Accept All selector to the same hold predicate so labels and store behavior agree.

- [x] Implement ExcludedImportsWidget as collapsed `<details>` on Transactions, after the inbox and before TransactionListWidget. Query all `importRecords` with decision ignored; no dependence on lastImport. Sort date descending and ID ascending; render 50 at a time with Show 50 more. Show source, original date/description/amount, reason and rule snapshot names. Allow Restore to review with an accessible name containing description. Use 44px controls, wrapping text and `min-w-0`; no horizontal table.
- [x] Restoration uses the Task 4 action, provides Undo scoped to that record and focuses/announces the new review entry. If the restored row was a built-in card payment, show that flag in the inbox. The ignored decision disappears from excluded history when pending.
- [x] ImportSummary reads `excludedIds ?? []`, displays e.g. 3 new transactions sent to review. 8 excluded by your rules. Keep skipped count separate. Offer View excluded imports as an in-page navigation action that switches to Transactions and opens/focuses the history details. Use a stable component ID and existing search-param tab setter; do not query fragile text labels to locate the section. Last-import skipped ignored entries use the updated same-ID restoration method.
- [x] Run `npm test -- --run src/components/budget/TriageInboxWidget.test.tsx src/components/budget/ImportSummary.test.tsx src/components/budget/ExcludedImportsWidget.test.tsx src/pages/Budgeting.test.tsx src/store/triageExclusions.test.ts`. Commit `feat: review and recover excluded transaction imports`.

## Task 7: End-to-end behavior and release validation

**Files:** Create `e2e/import-exclusions.spec.ts`; extend `e2e/import-overlap.spec.ts` only for shared regression assertions; modify `CHANGELOG.md` after checks pass. Keep version files at 0.11.2-beta.

**Consumes:** All prior tasks. **Produces:** desktop/phone/keyboard proof, validated changelog and a reviewable branch.

- [x] Add browser tests using the existing disclaimer initialization, CSV upload and Budgeting tab patterns in `e2e/import-overlap.spec.ts`. Use fresh browser storage per test and reload without clearing it mid-test.

```ts
for (const width of [1280, 375]) {
  test(`exclusion rules preserve overlap decisions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 })
    await page.addInitScript(() => {
      if (!localStorage.getItem('exclusion-test-ready')) {
        localStorage.clear()
        localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString())
        localStorage.setItem('exclusion-test-ready', '1')
      }
    })
    await page.goto('./#/budget?tab=transactions')
    await page.locator('input[type=file]').setInputFiles({ name: 'first.csv',
      mimeType: 'text/csv', buffer: Buffer.from(
        '2026-06-10,TRANSFER TO SAVINGS,50,,1234********5678\n2026-06-10,Coffee,5,,1234********5678') })
    await page.getByRole('button', { name: 'Exclude similar transactions for TRANSFER TO SAVINGS' }).click()
    await expect(page.getByRole('dialog', { name: 'Exclusion Rule' })).toBeVisible()
    await expect(page.getByLabel('Original bank description')).toHaveValue('TRANSFER TO SAVINGS')
    await page.getByLabel('Rule name').fill('Savings transfer')
    await page.getByRole('button', { name: 'Save Rule' }).click()
    await expect(page.getByRole('button', { name: 'Accept All (2)' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
```

This first test proves save defaults to future imports. Extend it with UI-only selection of automatic mode and explicit pending application, then assert Excluded imports, review coffee, restore transfer, reload/reupload and confirm counts. ThemedSelect exposes a button/listbox, not a native select. Use existing label/role interactions and meaningful visible state waits; move the mouse away before keyboard menu tests to avoid hover selecting a different option.

- [x] Add separate tests for: review-first batch exclusion+Undo; automatic exclusion over a new overlapping file; another card unaffected; edited bank-label preview stability; exact-vs-contains operator; two identical real purchases; changed-day possible duplicate held; pause/delete affecting only future imports; Include override persisting through reload/reapply; phone sheet focus/scroll and 320px/932x430 no overflow; keyboard-only create/cancel/restore.
- [x] Run `npm test -- --run src/utils/budget/exclusionRules.test.ts src/utils/budget/applyImportExclusions.test.ts src/store/triageExclusions.test.ts src/store/useTriageStore.test.ts src/components/budget/ExclusionRuleSheet.test.tsx src/components/budget/ExclusionRulePreview.test.tsx src/components/budget/ExclusionRulesWidget.test.tsx src/components/budget/ExcludedImportsWidget.test.tsx src/components/budget/TriageInboxWidget.test.tsx src/components/budget/ImportSummary.test.tsx src/components/budget/CSVUploader.test.tsx src/utils/backup.test.ts src/utils/syncService.test.ts`. Expect all selected tests pass.
- [x] Run `npm run build`, then `npm run e2e -- e2e/import-exclusions.spec.ts e2e/import-overlap.spec.ts --project=chromium`. Ensure port 4173 belongs to this worktree's preview. If occupied by another project, use a temporary local Playwright config on a free port and remove it afterward; do not stop an unrelated server. Expect all feature tests pass.
- [x] Run `npm run verify` once on the completed feature. Expected: lint, unit tests, build, bundle/eager/type-scale guards and browser suite pass with only existing configured skips. Diagnose actual failures; do not increase global timeouts or weaken assertions. Record counts and skipped tests from actual output rather than copying historical counts.
- [x] Add these bullets under 0.11.2-beta Added only after the behavior exists and passes:

```md
- User-defined exclusion rules match original bank descriptions by card or account, with a preview and optional direction and amount conditions.
- Matching imports can wait for review or be excluded automatically. Excluded entries retain their reasons and can return to review without creating duplicate charges.
```

Keep package.json/package-lock version unchanged. Do not claim accepted transactions can be retroactively excluded.
- [x] Commit `test: verify transaction exclusion workflows and document release`. Request code review using the applicable review skill at execution time, fix material findings and rerun the checks affected by any final change. A review request can use a subagent only if that skill/user explicitly authorizes delegation.
- [x] Confirm `git diff --check`, targeted tests after final changes, `git status --short` and current branch. Leave main, push, PR and deployment untouched. Open the dev preview from this worktree with npm_package_version=0.11.2-beta and a free port; show the implemented rule flow without modifying real user data.

## Coverage map and self-review

| Requirement | Task |
|---|---|
| Original description, exact/contains/prefix, source, direction and cents | 1, 2 |
| Stable occurrence counts and aliases | 2, 3, 7 |
| Preview totals, decisions and legacy limits | 2, 5 |
| Review-first, automatic opt-in, conflict precedence | 3, 5, 6 |
| Explicit pending application, accepted-history boundary | 4, 5 |
| Sticky inclusion, restoration, scoped Undo | 4, 6, 7 |
| Rule lifecycle without retrospective mutation | 4, 5, 7 |
| Persistent excluded view and accurate upload counts | 3, 6 |
| Card flags, refunds, duplicate-review precedence | 1, 3, 4, 6 |
| Migration, backup and sync | 1, 4 |
| Keyboard, mobile, release notes and full gate | 5, 7 |

Self-review performed against the research recommendations: no accepted-history mutation; restoration and duplicate identity remain separate; all shared method/type names are defined above; absent report fields are backward compatible; version-2 import history is preserved; explicit save/apply semantics and rule conflict precedence are fixed. Tasks 1 through 7 are complete. Validation and review results are recorded below.

## Execution handoff

1. **Subagent-driven execution:** fresh implementation agent per task with reviews between tasks, if the user chooses delegation.
2. **Inline execution:** use executing-plans in this session, implementing task by task with checkpoints.

Implementation must start by reading this plan, inspecting the actual branch state and reviewing the small UI mockup. Do not skip the migration/Undo/occurrence tests to accelerate visible UI work.


## Execution record

Implemented on codex/transaction-import-history through commit 398539f. The user selected subagent-driven execution and approved the compact UI layout. Each task received a separate spec and quality review; the whole branch received final review and re-review, with no outstanding Critical, Important or Minor findings.

- Full project gate before the final narrow UI refinements: lint, 223 unit files / 1,845 tests, build, bundle/eager/type-scale checks, and 276 browser tests passed; 5 configured browser tests skipped.
- Final affected verification after refinements: 13 component tests, 14 import browser scenarios, TypeScript, lint and build passed. Final bundle, eager graph and type-scale checks passed again.
- Browser coverage includes desktop, phone, narrow and short-wide layouts; native keyboard history toggle; source scoping; overlap counts; rule precedence; manual inclusion; restoration; cancellation; and complete Discard All Undo.
- Changelog includes exclusions under 0.11.2-beta. Package and lock versions remain 0.11.2-beta.
- Detailed task reports, review findings, validation logs and sample-data screenshots are retained locally in .superpowers/sdd/2026-10-12-transaction-exclusions/.
- Main checkout is preserved. No merge, push or deployment performed. The development preview uses port 5176 from this worktree.
