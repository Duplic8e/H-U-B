# Refunds & Payments research

Research date: October 12, 2026. This is product research and a record of planning decisions, not an implementation or release claim.

## Accepted direction

- Label the feature **Refunds & Payments**.
- Enable it by default for new and existing users; Settings can disable new entry controls.
- Offer an explicit third transaction choice alongside Expense and Income.
- Any incoming transaction can be deliberately assigned to reduce an expense category. Do not limit eligibility to a provable refund or repayment.
- The user clarified: "yes any incoming transaction should be able to offset expense".
- Classification is exclusive: an incoming amount either counts as income, offsets expenses, or settles an existing shared-bill balance. It must not be applied to two treatments simultaneously.
- Disabling the controls must not remove saved offsets or change historical totals.

## Primary-source findings

| Topic | Evidence | Decision for Ledger |
| --- | --- | --- |
| Direct category offsets | [Origin: Handling refunds, returns, and reimbursements](https://support.useorigin.com/hc/en-us/articles/34071814971661-Handling-refunds-returns-and-reimbursements), updated July 11, 2025, describes assigning received refunds and reimbursements directly to the original expense category without inflating income. [YNAB: Income and other inflows](https://support.ynab.com/en_us/how-to-add-income-and-other-inflows-H1ZNjfZJi) similarly distinguishes earned income from category inflows. | Explicitly select an expense category, subtract the incoming amount from spending, and exclude it from income. Ledger deliberately permits broader incoming payments at the user's request. |
| Several expenses in one payment | [YNAB: Reimbursements FAQ](https://support.ynab.com/en_us/reimbursements-faq-Sy9qDvtvgg) recommends splitting a payment that reimburses several expenses. | Reuse the optional split editor for offsets across expense categories. Keep the default to one category. Do not introduce mixed income/offset slices in this release. |
| Later-month receipts | [YNAB: Organizing and tracking reimbursements](https://support.ynab.com/en_us/organizing-and-tracking-reimbursements-S1K78wYwgx) explains using totals across selected months when repayment arrives later. Origin instead offers changing the transaction date to match the original spending. | Choose actual receipt dates. Do not silently backdate payments or reopen prior months. A range covering both dates shows the combined net cost. This is a Ledger design decision, not a universal industry rule. |
| Transfers are different from expense repayments | [Monarch: Creating your budget](https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch) distinguishes income, expenses, and transfers, and excludes own-account transfers and card payments from budgets and cash flow. [Simplifi: Understanding your spending plan](https://support.simplifi.quicken.com/en/articles/4212702-understanding-your-spending-plan) documents similar default exclusions. | Preserve existing card-payment holds and never automatically reclassify an e-transfer. The user may explicitly choose an offset for any incoming transaction, including one normally treated differently. Explain the reporting effect. |
| Expected versus received refunds | [Simplifi: Tracking refunds](https://support.simplifi.quicken.com/en/articles/4606217-tracking-refunds-in-quicken-simplifi) maintains expected refunds separately and matches them to downloaded transactions when received. It also documents restrictions on manually entered and completed refunds. | Only received transactions affect spending. Do not add expected-refund tracking or required purchase matching. Saved offsets remain editable. |
| Net-credit categories | [YNAB: Spending breakdown](https://support.ynab.com/en_us/spending-breakdown-H1H7YxmD0) explicitly shows categories whose inflows exceed outflows. | Show net credits in category detail and a separate non-income source in Cash Flow. Do not silently omit them or clamp the underlying totals to zero. |

These sources describe established product patterns. They are not usability-study evidence that a specific label or layout is superior. Validate Ledger's concrete UI on desktop and phone before implementation.

## Common gotchas and rules

1. **Income distortion:** A salary payment assigned as an offset reduces spending instead of increasing income. This is allowed, but the form must explain and preview both effects. Suggested copy: "Reduces spending in the selected category. This amount will not count as income."
2. **Ambiguous Payments label:** Keep the accepted label. Helper copy defines it as money received, since a card payment or outgoing bill payment normally means something different.
3. **Double entry:** Change classification on the existing imported transaction. Do not add a second artificial refund entry.
4. **Shared bills:** Ledger records only the user's own share as an expense. An incoming settlement normally reduces the amount owed by a person, not category spending. Converting it to an offset must explicitly remove settlement treatment and explain that the person's outstanding balance will increase again. Never keep both treatments active.
5. **Dates:** A September purchase and October receipt remain on their actual dates. October can have negative net category spending.
6. **Partial and combined receipts:** Partial offsets are valid. One payment can split into several expense categories. No requirement that it exactly match a purchase.
7. **Credits larger than spending:** Allow a net credit, including a category with no purchases in the selected period. Label it clearly; progress bars can have zero width while the money amount remains signed.
8. **Turning the feature off:** Hide the choice for new classifications. Keep existing offsets identifiable, editable, deletable, and included in totals. Imported bank refunds retain their correct direction even when the preference is off.
9. **Import identity:** Store original bank data and deduplication identity independently of editable budget treatment. Reimporting an income row after the user classified it as an offset must not duplicate it.
10. **Automatic category rules:** A description such as INTERAC E-TRANSFER can represent salary, gifts, or an expense payment. Do not learn offset intent from the description or apply it to every future occurrence. Existing category-only rules must not assign income to expense categories invisibly.
11. **Split signs:** The form accepts positive magnitudes. Stored offsets and every split slice use negative expense amounts. Sum of slices plus any remainder must equal the signed parent amount, including cents.
12. **No matching source account assumption:** Ledger's budget transactions do not contain account balances. This change provides budget classification, not bank reconciliation or a new account ledger.

## Current Ledger evidence

Reviewed the working tree on October 12, 2026 at HEAD `87239ad`, package version `0.11.2-beta`.

- `src/types/budget.ts`: transactions already use `type: 'expense' | 'income'`. Negative expense amounts can represent offsets without another persisted type.
- `src/components/budget/TransactionModal.tsx`: negative expenses are accepted, but users must enter a minus sign; category lists follow the stored transaction type. Negative expense splitting is deliberately disabled today.
- `src/store/useBudgetStore.ts`: persistence version is 4; monthly stats already sum signed expenses and exclude reimbursement income.
- `src/utils/budget/splits.ts`: category attribution is centralized; signed slices can be supported without replacing the attribution algorithm.
- `src/utils/budget/sharedExpenses.ts`: a shared expense's amount is the user's share; reimbursement income settles the person's balance and is excluded from income totals.
- `src/utils/csvParser.ts`: CIBC merchant credits are negative expenses; flagged card payments are income-shaped rows held from bulk acceptance.
- `src/store/useTriageStore.ts`: approvals copy basic transaction fields; description rules learn only category IDs. Original import records are retained separately.
- `src/components/budget/TriageInboxWidget.tsx`: pending category selection currently offers every category, regardless of treatment.
- `src/components/budget/CashFlowWidget.tsx`: zero/negative net expense groups are omitted. This can hide refunds and understate the reported remaining amount.
- `src/utils/backup.ts`: the budget store is included in backup/Drive snapshots as an opaque persisted payload. A new budget preference can travel with that store without changing the outer backup format.

The checkout contains unrelated modified and untracked files. Research and plan documents are the only files to add for this request. Execution should use an isolated worktree and preserve those files.

## Scope

Include settings, new/edit transaction entry, intentional conversion of imported incoming rows, optional offset splits, clear transaction/category displays, chart consistency, persistence and backup checks, and targeted regression coverage.

Exclude expected refunds, mandatory purchase links, automatic matching, automatic offset rules, account balance tracking, mixed income/offset split transactions, retroactive date reassignment, and changes to the shared-bill accounting model.
