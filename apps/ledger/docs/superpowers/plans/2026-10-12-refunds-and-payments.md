# Refunds & Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use subagent-driven-development only if the user chooses delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users deliberately apply any received payment to reduce expense-category spending through a clear Refunds & Payments transaction choice, enabled by default and optionally disabled in Settings.

**Architecture:** Preserve Ledger's signed expense model: the UI accepts positive amounts and stores offsets as negative expenses. Derive the transaction choice from existing data instead of introducing a third persisted transaction type. Keep the preference independent of calculations, preserve original import identity, and use existing category attribution for signed splits and totals.

**Tech Stack:** React 19, TypeScript 6, Zustand 5 persistence, existing themed controls, Vitest/Testing Library, Playwright, Recharts.

## Global Constraints

- User-approved feature label: **Refunds & Payments**. Transaction choice uses the same label.
- Default enabled for both fresh installs and existing users. Explicit `false` survives migration, reload, backup, and restore.
- Any incoming transaction may be intentionally classified as an offset. Eligibility is not restricted to refunds or proven repayments.
- The user authorized subagent-driven implementation and approved the desktop/phone preview on October 13, 2026. Push, merge, and release actions remain pending.
- October 14 triage decision: use prototype B from `f50daeb`. Put the real Exclude similar transactions action beside the amount on desktop and below metadata on phones. Incoming treatment and category controls share one row at every width, with flexible widths and truncated labels. Outgoing rows retain category only. Approve and Ignore sit on a separate right-aligned row on phones. Preserve all validation, helper warnings, source restrictions, and exclusion behavior. Prototype code stays out of production.
- Use the approved preview: Expense and Income share the first choice row; Refunds & Payments occupies the full second row. Preserve surrounding form anatomy and existing fields.
- Preserve unrelated checkout changes. Execute in an isolated worktree after reading using-git-worktrees.
- Do not use em dashes. Do not select Astra unless explicitly requested. Implementation, review, research, and test execution use medium reasoning effort or lower.
- No new third persisted transaction type, duplicate synthetic transaction, mandatory purchase link, automatic offset classification, or change to shared-bill accounting.
- Feature preference affects entry controls only. No selector, forecast, budget total, or chart may consult it to include/exclude saved offsets.
- Real transaction dates remain unchanged. Do not backdate received payments automatically.
- Signed data is authoritative. UI magnitudes are positive and validation rejects zero, non-finite amounts, and invalid allocations.
- Settings, entry, and import review must work at 320px and 375px with keyboard access and existing Sheet/ThemedSelect/Checkbox patterns.
- Research and decisions: `docs/research/2026-10-12-refunds-and-payments.md`.

## Product contract

### Entry and Settings

Settings gains a Transactions section with a **Refunds & Payments** checkbox and helper text: "Let money received reduce spending in an expense category. Turning this off hides the option for new transactions; saved payments still count."

The transaction form normally offers Expense, Income, and Refunds & Payments. Keep Expense as the default choice. For the third choice, use positive Amount input, expense-only categories, optional existing split controls, date, description, tags, and notes. Per user review on October 14, omit the generic explanatory description. Retain amount-specific reduction previews and conditional warnings, and hide the message container when it has no content.

Once an amount and category are valid, show "Reduces Groceries spending by $40.00" using `formatMoney`. For a split, show each category's allocated reduction and the remainder's category. Avoid an extra wizard or required person/purchase field. No separate toggle in Transactions is needed because the feature starts enabled.

When disabled, new transactions and normal income edits do not offer the third choice. Existing negative expenses open in Refunds & Payments mode and remain editable even when disabled, with "Refunds & Payments is off for new transactions. This saved payment still counts." Do not reclassify them on open.

### Exclusive treatment of incoming money

Converting an income receipt to an offset changes the same transaction ID to a negative expense and requires an expense category. Income decreases by the received amount and expense spending decreases by the same amount; the net budget result stays unchanged for an ordinary income-to-offset conversion.

An income transaction marked `reimbursement` has different existing behavior. When the user chooses offset mode for it, show: "This payment currently settles a shared bill. Using it to reduce expenses will stop settling that balance. Shared bills already count only your share, so this can reduce spending again." Require an unchecked checkbox: "Use this payment to reduce expenses instead of settling the shared bill." Saving clears `reimbursement`; cancellation leaves it untouched. Keep it out of automatic conversion and bulk actions. An existing shared purchase has no incoming offset to classify, so its form must require turning off Shared bill before switching to offset mode and must explain the discarded IOU treatment.

### Splits, dates, and display

- Optional splits may distribute an entire offset across several expense categories. Mixed income and expense treatment within one payment is out of scope.
- The form edits slice magnitudes; canonical parent and slices are negative for offset mode. Positive remainder is shown in the form and stored as a negative contribution to the parent category.
- Every populated allocation and any nonzero remainder need a valid expense category. No allocation may exceed the total. Do not silently discard incompatible income-category slices after a mode change; require the user to correct them before saving.
- A credit greater than purchases is valid. Category main text: `$40.00 net credit`; optional details: `$60.00 purchases · $100.00 refunds & payments`.
- Transaction signs follow cash direction: expense purchases negative, income and offsets positive. Offset badges use `Refunds & Payments`; color is supplemental.
- New payment previews and breakdowns use the separate `formatMoneyWithCents` helper; existing `formatMoney` behavior remains unchanged. Preview, validation, and save use the same rounded cent amounts and reject unsafe/nonfinite results.
- Expense-only bulk category choices include offsets; mixed income/expense selections cannot recategorize together. Category filters include a transaction when a split slice references the category.
- October receipts affect October. September purchase plus October receipt net together only in a range covering both months.

## File responsibilities

| File | Responsibility |
| --- | --- |
| Create `src/utils/budget/transactionKinds.ts` and `.test.ts` | UI mode classification, signed encoding, cash-direction helper; no store or UI dependency |
| Modify `src/types/budget.ts` | Document signed split convention; no extra persisted transaction kind |
| Modify `src/store/useBudgetStore.ts` and `.test.ts` | Default-enabled preference, setter, version-5 migration |
| Modify `src/components/settings/SettingsSheet.tsx` and `.test.tsx` | Preference UI using existing section anatomy |
| Modify `src/components/budget/TransactionModal.tsx`, `.test.tsx`, `.errors.test.tsx` | Three modes, positive entry, safe conversion, signed splits, saved-offset editing |
| Modify `src/components/budget/TriageInboxWidget.tsx`, `.test.tsx` | Explicit incoming-row treatment and direction-compatible categories |
| Modify `src/store/useTriageStore.ts` and `.test.ts` | Safe incoming reclassification without changing original import records or learning offset intent |
| Modify `src/components/budget/CSVUploader.tsx` and `.test.tsx` | Reject category guesses whose group kind conflicts with the parsed transaction treatment |
| Modify `src/types/triage.ts` | Correct the inaccurate absolute-amount comment; no split schema needed for pending rows |
| Modify `src/utils/budget/categoryStats.ts` and `.test.ts` | Purchases, offset magnitude, and signed net breakdown |
| Modify `src/components/budget/CategoryManagerWidget.tsx` and `.test.tsx` | Net spending/credit and optional breakdown using existing category rows |
| Modify `src/components/budget/TransactionListWidget.tsx` and `.test.tsx` | Positive cash-direction offset display, badge, search text |
| Modify `src/components/budget/CashFlowWidget.tsx`, `.test.tsx`, `.phone.test.tsx` | Non-income net-credit source, correct remaining total, accessible labels |
| Test existing `src/store/budgetSelectors.test.ts`, `src/utils/budget/cashFlowForecast.test.ts`, `src/components/budget/MonthlySummaryWidget.test.tsx`, `src/components/budget/ParadigmBanner.test.tsx` | Cross-surface arithmetic stays signed and independent of preference |
| Test existing `src/utils/backup.test.ts`, `src/utils/budget/importHistory.test.ts`, `src/utils/budget/importDedupe.test.ts` | Data compatibility and import identity |
| Create `e2e/refunds-and-payments.spec.ts`; modify `e2e/mobile-guards.spec.ts` | End-to-end behavior and narrow-phone controls |
| Modify `CHANGELOG.md` at completion | User-facing unreleased note; do not choose a release version or publish without authorization |

## Task 1: Lock signed transaction contracts and persistence

**Interfaces:** Produce `TransactionEntryKind`, `entryKindOf(tx)`, `cashMovement(tx)`, and `encodeEntryAmounts(kind, amount, splits)` from `transactionKinds.ts`. Add store fields `refundsAndPaymentsEnabled: boolean` and `setRefundsAndPaymentsEnabled(enabled: boolean): void`.

- [ ] Write utility tests for purchase, income, legacy negative expense, shared settlement, signed split slices, and cent remainder. Include executable fixtures:

```ts
const receipt: Transaction = {
  id: 'receipt', date: '2026-10-12', description: 'Incoming payment',
  type: 'income', amount: 40, categoryId: 'salary',
};
expect(entryKindOf({ ...receipt, type: 'expense', amount: -40 }))
  .toBe('refund-payment');
expect(cashMovement({ ...receipt, type: 'expense', amount: -40 })).toBe(40);
expect(encodeEntryAmounts('refund-payment', 40, [
  { categoryId: 'groceries', amount: 25 },
  { categoryId: 'dining', amount: 15 },
])).toEqual({ type: 'expense', amount: -40, splits: [
  { categoryId: 'groceries', amount: -25 },
  { categoryId: 'dining', amount: -15 },
] });
```

- [ ] Run `npm test -- --run src/utils/budget/transactionKinds.test.ts`. Expect failure because the helper does not exist yet.
- [ ] Add the small pure module:

```ts
import type { Transaction, TransactionSplit } from '../../types/budget';
import { round2 } from './splits';

export type TransactionEntryKind = 'expense' | 'income' | 'refund-payment';
export function entryKindOf(tx: Pick<Transaction, 'type' | 'amount'>): TransactionEntryKind {
  return tx.type === 'expense' && tx.amount < 0 ? 'refund-payment' : tx.type;
}
export function cashMovement(tx: Pick<Transaction, 'type' | 'amount'>): number {
  return tx.type === 'income' ? tx.amount : -tx.amount;
}
export function encodeEntryAmounts(
  kind: TransactionEntryKind, amount: number, slices: TransactionSplit[] = [],
): Pick<Transaction, 'type' | 'amount' | 'splits'> {
  const sign = kind === 'refund-payment' ? -1 : 1;
  const splits = slices.map(p => ({ ...p, amount: sign * round2(p.amount) }));
  return {
    type: kind === 'income' ? 'income' : 'expense',
    amount: sign * round2(amount),
    splits: splits.length ? splits : undefined,
  };
}
```

The encoder receives validated positive form values. Keep validation in the form; never use `Math.abs` to silently repair invalid submissions. Update the TransactionSplit comment to say slices have the same sign as the canonical parent; form values are positive magnitudes. Leave `splitParts` intact and add tests with signed negative slices.

- [ ] Add persistence tests through `migrateBudgetPersisted`, covering old versions 1, 2, 3, 4, missing preference, explicit false, and unchanged negative transactions. Add fresh-store and reload assertions. Preserve all existing migration behaviors.
- [ ] Set `BUDGET_PERSIST_VERSION = 5`; add the default and setter to BudgetState/store. Complete the migration chain after v4:

```ts
const v4 = version >= 4 ? v3 : migrateBudgetStateV4(v3);
const state = v4 as Partial<BudgetState>;
return {
  ...state,
  refundsAndPaymentsEnabled: state.refundsAndPaymentsEnabled ?? true,
};
```

Use `?? true`, never `|| true`. Same-version hydration merges store defaults for absent fields; add a same-version malformed/missing-field fixture to confirm behavior through persistence, not only the migration function.

- [ ] Run `npm test -- --run src/utils/budget/transactionKinds.test.ts src/utils/budget/splits.test.ts src/store/useBudgetStore.test.ts`; expect pass. Run `npm run build` to confirm type compatibility.
- [ ] Commit only Task 1 files: `feat: define refund payment entry and preference`.

## Task 2: Settings and clear transaction entry

**Consumes:** Task 1 helpers and preference. **Produces:** existing `TransactionModal` contract with a positive-magnitude offset mode; saved transactions retain existing Transaction shape and IDs.

- [ ] Write Settings tests: checked by default, disable persists, reenable persists. Write form tests for a $120 grocery purchase followed by a $40 offset, no income-category options in offset mode, saved legacy refund editing while disabled, zero/non-finite rejection, and category required before save. Assert saved data, not just labels:

```ts
expect(saved).toMatchObject({ type: 'expense', amount: -40, categoryId: 'groceries' });
expect(saved.reimbursement).toBeUndefined();
expect(saved.shared).toBeUndefined();
expect(getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 9).spent).toBe(80);
```

- [ ] Run focused Settings and TransactionModal tests and confirm the new behavior fails before code changes.
- [ ] Add a Transactions `SectionCard` in Settings with existing `Checkbox` and the exact copy from the product contract. Read and update the persisted budget preference directly; do not duplicate it in local component state.
- [ ] Refactor form state so UI mode is `TransactionEntryKind`, with `entryKindOf(initialTransaction)` and `Math.abs(initialTransaction.amount)` only during initialization of valid saved data. Initialize split amounts as magnitudes for canonical negative slices. New entry amount must be strictly greater than zero in every mode.
- [ ] Render the third choice only when enabled or editing an existing offset. Keep controls within the existing sheet, using a wrapping/stacked layout at 320px. Preserve accessible selected state and tab order. Map categories by `kind === 'income' ? 'income' : 'expense'`.
- [ ] Validate category IDs against current categoryGroups immediately before save. Require the selected category when unsplit or when a split has a remainder. Require each positive slice's category; reject rounding-to-zero, non-finite values, nonpositive populated slices, and over-allocation. Use `splitRemainder` with positive form values.
- [ ] Save using `encodeEntryAmounts`, preserving ID/date/description/tags/note. Income-to-offset conversion does not change cash direction. Disable Shared bill controls in offset mode, clear shared/reimbursement fields on offset save, and enforce the shared-settlement acknowledgment described in the product contract. Save cancellation must leave original transaction untouched.
- [ ] Replace the negative-expense error guidance with "Enter an amount greater than zero." If a user types a minus sign in new positive-magnitude entry, explain "Use Refunds & Payments for money received." Keep saved negative expenses editable while disabled.
- [ ] Add split regression fixtures: $100 offset allocated $60 Groceries and $40 Dining; $100 offset with $60 Groceries and $40 parent-category remainder; 0.01 rounding; over-allocation; switching income with salary slices to offset must require recategorization. Existing positive expense and income split behavior must stay valid.
- [ ] Run `npm test -- --run src/components/settings/SettingsSheet.test.tsx src/components/budget/TransactionModal.test.tsx src/components/budget/TransactionModal.errors.test.tsx src/utils/budget/splits.test.ts`; expect pass. Run `npm run build`.
- [ ] Commit only Task 2 files: `feat: add refunds and payments entry controls`.

## Task 3: Safe classification in import review

**Consumes:** `cashMovement`, `entryKindOf`, default-enabled preference. **Produces:** `setPendingReceiptTreatment(id: string, treatment: 'income' | 'refund-payment'): void` on useTriageStore. Existing approval APIs and original import records stay intact.

- [ ] Write store/widget tests for converting an imported +$40 income receipt to expense -$40, selecting Groceries, accepting it once, undoing acceptance, reimporting the same bank file, and confirming no second budget transaction. Check that original date/type/amount and source identity remain unchanged in importRecords.
- [ ] Add tests that outgoing purchases cannot change cash direction through the new incoming treatment control; category lists match treatment; feature-off preserves existing merchant refunds; flagged card payments remain excluded from Accept All after explicit classification; conversion is not learned for subsequent e-transfers. Offsets lacking a valid expense category cannot be accepted individually or through Accept All; its displayed count must match the store's eligible rows.
- [ ] Run `npm test -- --run src/store/useTriageStore.test.ts src/components/budget/TriageInboxWidget.test.tsx src/utils/budget/importHistory.test.ts`; expect the new conversion tests to fail.
- [ ] Implement the store method, using a positive cash-direction eligibility check and preserving bank originals:

```ts
setPendingReceiptTreatment: (id, treatment) => {
  const tx = get().pendingTransactions[id];
  if (!tx || cashMovement(tx) <= 0) return;
  if (!useBudgetStore.getState().refundsAndPaymentsEnabled &&
      entryKindOf(tx) !== 'refund-payment' && treatment === 'refund-payment') return;
  const amount = cashMovement(tx);
  get().updatePending(id, {
    type: treatment === 'income' ? 'income' : 'expense',
    amount: treatment === 'income' ? amount : -amount,
    categoryId: undefined,
  });
},
```

The UI must not call this when the selected treatment is unchanged, since that would unnecessarily clear the category. Before applying a change, explain that category selection must be reviewed. Keep flag/duplicate/exclusionMatches unchanged. Existing `updatePending` handles undo dismissal; do not mutate importRecord.original or rerun import identity from edited values.

- [ ] In incoming triage rows show an accessible treatment select: Income / Refunds & Payments. New offset choice obeys preference; existing negative refunds stay labeled and editable while disabled. Outgoing purchases have no incoming-treatment select. Categories are filtered to the chosen stored type; invalid preexisting category guesses are visibly unselected and require review rather than hidden reassignment.
- [ ] Skip `learnRule` for negative expenses in both single and bulk approvals. Category guesses are applied in `CSVUploader.handleTransactions`, not in `addPending`. Filter both learned/heuristic guesses and the Chase category fallback against current categoryGroups so the guessed group's kind matches the parsed stored type. Do not erase existing rules or create offset rules. Normal expense and income categorization behavior stays intact.
- [ ] Add the same offset-category readiness predicate to single/bulk store approval and the widget's acceptable-row count. Put the shared pure predicate in `transactionKinds.ts`, importing Category and CategoryGroup types. Ordinary uncategorized income/purchases retain current behavior:

```ts
export function hasValidOffsetCategory(
  tx: Pick<Transaction, 'type' | 'amount' | 'categoryId'>,
  categories: Record<string, Category>, groups: Record<string, CategoryGroup>,
): boolean {
  if (entryKindOf(tx) !== 'refund-payment') return true;
  const category = tx.categoryId ? categories[tx.categoryId] : undefined;
  return !!category && groups[category.groupId]?.kind === 'expense';
}
```

Combine this predicate with existing duplicate, flag, and exclusion guards without weakening them. Individual card-payment approval retains its existing explicit-review behavior; Accept All continues to hold flagged rows. Show "Choose an expense category before accepting this payment" beside unresolved offsets.
- [ ] Keep pending offsets single-category in this version. Users can split after acceptance in the normal transaction editor. State this limit in helper copy if they need allocation. No extra pending split or metadata schema is necessary.
- [ ] Run `npm test -- --run src/store/useTriageStore.test.ts src/components/budget/TriageInboxWidget.test.tsx src/utils/budget/importHistory.test.ts src/utils/budget/importDedupe.test.ts src/components/budget/CSVUploader.test.tsx`; expect pass. Confirm import-review record display still shows raw bank direction and values.
- [ ] Commit only Task 3 files: `feat: classify incoming imports as expense offsets`.

## Task 4: Explain signed totals in category and transaction views

**Consumes:** signed stored expenses and splitParts. **Produces:** `categoryExpenseBreakdown(transactions, categoryId, month): { purchases: number; offsets: number; net: number }`, with offsets a positive magnitude and net signed.

- [ ] Add breakdown tests for purchase 120 / offset 40 / net 80; purchase 60 / offset 100 / net -40; offset-only month; split offsets; and filtering by month. Add transaction display/search tests for the new badge and positive cash-direction signs.
- [ ] Run the new targeted tests and confirm failure before implementation.
- [ ] Add the helper beside existing category stats:

```ts
export function categoryExpenseBreakdown(
  transactions: Record<string, Transaction>, categoryId: string, month: string,
): { purchases: number; offsets: number; net: number } {
  let purchases = 0, offsets = 0;
  for (const tx of Object.values(transactions)) {
    if (tx.type !== 'expense' || !tx.date.startsWith(month)) continue;
    for (const part of splitParts(tx)) {
      if (part.categoryId !== categoryId) continue;
      if (part.amount >= 0) purchases += part.amount;
      else offsets -= part.amount;
    }
  }
  return { purchases: round2(purchases), offsets: round2(offsets), net: round2(purchases - offsets) };
}
```

Import `splitParts` and `round2` from splits. Use this for explanatory breakdown, preserving existing `categoryMonthlyTotal` and budget arithmetic contracts.

- [ ] Update expense category rows to show normal spent text for nonnegative totals and `formatMoney(-net) + ' net credit'` for negative totals. Show purchases/offset detail only when offsets exist, using a native disclosure or existing expansion pattern agreed in the mockup. Keep budget target, remaining budget, and progress semantics; clamp only visual progress, not money totals.
- [ ] Update transaction display using cashMovement for signs, add `Refunds & Payments` badge on negative expenses, and include that label in search text. Preserve shared and reimbursement badges for their existing types. Keep category filter, bulk edit, virtualization, and undo behavior.
- [ ] Pin the ordinary conversion invariant with monthly stats: income 2000 + receipt 40 - purchase 120 gives net 1920; after reclassifying the receipt, income 2000 - expense 80 still gives net 1920. Pin September/October behavior and 50/30/20 class calculations. Verify shared purchase own-share 60 plus settlement 60 stays expense 60 and income 0.
- [ ] Run `npm test -- --run src/utils/budget/categoryStats.test.ts src/components/budget/CategoryManagerWidget.test.tsx src/components/budget/TransactionListWidget.test.tsx src/store/budgetSelectors.test.ts src/components/budget/MonthlySummaryWidget.test.tsx src/components/budget/ParadigmBanner.test.tsx src/utils/budget/cashFlowForecast.test.ts`; expect pass.
- [ ] Commit only Task 4 files: `feat: show expense offsets and net credits clearly`.

## Task 5: Keep net credits visible in Cash Flow

**Consumes:** expenseByGroup signed totals. **Produces:** visible non-income credit sources and remaining amount consistent with signed net expense. No earned-income selector changes.

- [ ] Write chart tests for income 1000, Housing 500, Shopping -40: draw Housing 500, separate Shopping credit 40, and remaining 540. Verify zero net groups, credit-only periods, phone folding, and accessible chart narration. Replace the current regression expectation that omits net-credit groups entirely.
- [ ] Run `npm test -- --run src/components/budget/CashFlowWidget.test.tsx src/components/budget/CashFlowWidget.phone.test.tsx`; confirm expected failures.
- [ ] Separate positive expense groups from negative net-credit sources, preserving the existing net-by-group approach:

```ts
const positiveExpenses = [...expenseByGroup].filter(([, n]) => n > 0);
const expenseCredits = [...expenseByGroup]
  .filter(([, n]) => n < 0)
  .map(([name, n]) => [`${name} credit`, -n] as [string, number]);
const totalExpense = positiveExpenses.reduce((sum, [, n]) => sum + n, 0);
const totalCredits = expenseCredits.reduce((sum, [, n]) => sum + n, 0);
const remaining = Math.max(0, totalIncome + totalCredits - totalExpense);
```

- [ ] Add `credit` to the chart node-kind union and render credits on the source side without treating them as income. For periods with credits, use pool label `Available funds` and terminal label `Net remaining`; keep existing no-credit labels/layout. Add credit sources to links and link-index/color calculations before the pool. Net credits must not increase the earned-income total.
- [ ] Phone folding treats incomes and credit sources separately, so a credit cannot disappear into `Other sources` and appear to be earnings. Fold credit sources into `Other expense credits` if necessary. Empty state checks all drawn source and expense collections, so credit-only periods render instead of reporting no transactions.
- [ ] Accessible narration names income, expense credits, positive net expenses, and net remaining separately. Note in chart helper text, only when credits exist: "Expense credits reduce spending and are not income." Zero groups need no Sankey node because they contribute no flow; their purchases/offsets remain visible in category detail.
- [ ] Keep the existing handling of underfunded/overspent periods; do not turn this into a cash-account reconciliation project. Add a regression that no negative link values reach Recharts.
- [ ] Run chart tests and `npm run build`; expect pass.
- [ ] Commit only Task 5 files: `fix: include expense credits in cash flow`.

## Task 6: Persistence, end-to-end checks, and handoff

**Consumes:** all previous tasks. **Produces:** verified user flows, backup compatibility evidence, unreleased change note, reviewable isolated branch.

- [ ] Add backup round-trip fixtures with preference false, a negative expense, and negative split slices. Verify `buildBackup` and `restoreBackup` retain values; rehydrate the budget store and confirm disabled controls with unchanged monthly totals. Restore an older v4 backup and confirm the feature defaults enabled. Outer `BACKUP_VERSION` remains 2.
- [ ] Test toggling the setting before/after saved offsets, reload, and backup restore. Test explicit conversion of a shared settlement with acknowledgment, showing the restored IOU balance and ensuring reimbursement and offset are never simultaneously applied.
- [ ] Create desktop E2E for manual receipt, editing an existing income receipt without changing its ID, split allocations, imported receipt classification and reimport, feature disable and saved-offset editing. Use existing budget fixture patterns and an actual date in the selected month. Assert stored canonical values and visible amounts rather than only clicking buttons.
- [ ] Add phone flow to `e2e/mobile-guards.spec.ts`, since the configured mobile projects only run that file. At 320px and landscape verify the three choices, Settings toggle, split editor, selected state, touch targets, focus, and no horizontal overflow. Check 375px manually or in an explicit viewport test.
- [ ] Run focused checks:

```powershell
npm test -- --run src/utils/backup.test.ts src/utils/budget/transactionKinds.test.ts src/store/useBudgetStore.test.ts src/store/useTriageStore.test.ts
npm run e2e -- e2e/refunds-and-payments.spec.ts e2e/shared-bill.spec.ts e2e/import-overlap.spec.ts e2e/import-exclusions.spec.ts --project=chromium
npm run e2e -- e2e/mobile-guards.spec.ts --project=mobile-narrow --project=mobile-landscape
```

Expected: all targeted tests pass. Confirm the server on configured port 4173 belongs to this worktree before allowing reuse. If another checkout owns the port, use an isolated temporary Playwright config/port for this run; do not kill or silently test against that server.

- [ ] Add an unreleased CHANGELOG bullet: "Added Refunds & Payments to apply incoming money against expense categories, with a Settings option to hide the entry controls." Preserve package version unless the user supplies a release target.
- [ ] Run the existing full gate once after final code changes: `npm run verify`. This includes lint, unit tests, build, bundle/eager/type-scale checks, and E2E. Resolve new failures; distinguish preexisting failures with evidence. Do not equate focused green checks with full-gate success.
- [ ] Review diff and changed/untracked files. Confirm no unrelated work, no unexpected generated artifacts, no em dashes in added copy/documents, and no data migration that changes historical transactions. Run the requesting-code-review skill before integration; do not delegate unless the user chooses delegation or an applicable skill explicitly requires it.
- [ ] Commit only Task 6 changes: `test: cover refunds and payments workflows`. If code changes after verification, rerun affected checks and the required gate as justified before claiming completion.
- [ ] Report implementation status, exact validation results, browser scope, and remaining limitations. Leave push, merge, deployment, and release version selection pending until authorized.

## Acceptance matrix

| Scenario | Expected result | Coverage |
| --- | --- | --- |
| Fresh install or old budget snapshot | Feature enabled | Task 1, 6 |
| Explicit false | Remains false after reload/restore | Task 1, 2, 6 |
| $120 purchase + $40 incoming offset | Expense 80; offset not income | Task 2, 4, 6 |
| Salary/gift deliberately assigned as offset | Allowed with reporting preview | Task 2, 3 |
| Ordinary income becomes offset | Same ID/date; unchanged net budget result | Task 2, 4, 6 |
| Shared-bill settlement | Existing IOU treatment preserved by default | Task 2, 4, 6 |
| Settlement deliberately becomes offset | Acknowledgment; IOU restored; no simultaneous treatment | Task 2, 6 |
| Partial/combined receipt | Positive entry; optional signed expense splits | Task 2, 4 |
| Expense credits exceed purchases | Net-credit label and non-income chart source | Task 4, 5 |
| Receipt in later month | Actual date retained; range totals net correctly | Task 4, 6 |
| Disable after recording offsets | Controls hide; saved offsets still count/edit | Task 2, 6 |
| Imported receipt reclassified | Original import identity retained; no duplicate on reimport | Task 3, 6 |
| Incoming card-payment row | Explicit choice allowed; bulk hold retained | Task 3 |
| Generic e-transfer description | No automatic offset intent or incompatible category guess | Task 3 |
| Incoming rows awaiting review | Single-category conversion; split after acceptance | Task 3 |
| Mobile controls | Usable at 320px/375px, no overflow, keyboard/touch access | Task 2, 6 |

## Plan self-review

- Signed expense storage, default enabled, Settings disable, any incoming transaction, legacy editing, receipt dates, split allocation, imports, shared bills, charts, backup, and validation each map to a task above.
- No new dependency or third persisted type is required. Entry helpers are pure and do not include preference checks.
- No offset intent is learned from generic incoming descriptions. Original import identity remains separate from edited treatment.
- Pending-row splits are explicitly deferred to the normal editor after acceptance; mixed income/offset payments and expected-refund tracking are excluded.
- Concrete desktop/phone mockups were approved on October 13, 2026, and the user authorized subagent-driven execution. The branch remains isolated for review until integration is separately authorized.
