# Transaction exclusion patterns in finance import tools

Research date: 2026-10-12. Scope: official documentation for five apps, with five main rule documents and two supporting exclusion documents. No implementation. These are documented behaviors, not hands-on product verification. UNKNOWN means the cited documentation does not establish the behavior, not that the product lacks it.

## Verified product comparison

### Actual Budget

Rules match exact text, substrings, regular expressions, or selected values. Conditions include account, amount, date, notes, category, payee, and imported payee. String matching is case-insensitive. Imported payee preserves original imported description; ordinary payee can change during earlier rule processing. Rules run during import/sync, ordered by specificity within pre/default/post stages; later matching actions win conflicts. The editor lists matching existing transactions and lets users select rows before manually applying actions. Rules can be edited or deleted. The listed actions change fields; this document does not establish a hide/exclude action, skipped-row import rule, or automatic rollback of previously applied actions. [Actual: Rules](https://actualbudget.org/docs/budgeting/rules/)

### YNAB

Payee renaming uses exact IS rules and contiguous CONTAINS rules against the payee shown as imported in bank import details. The document describes CONTAINS matching as case-insensitive. Editing an imported payee creates an IS rule for future imports; users can customize or remove rules in Manage Payees. A per-payee control disables automatic renaming and removes existing IS rules; the document explains how to re-enable renaming. This is an adjacent precedent for original-text matching, not evidence of exclusion rules. Account/source scoping, exclusion, rule preview, historical application, and conflicting-rule precedence are UNKNOWN from this source. [YNAB: How to Rename Payees](https://support.ynab.com/en_us/how-to-rename-payees-BkotNUSyo)

### Monarch

Rules distinguish raw original statement description from merchant display name. Each supports case-insensitive exact or contiguous contains matching, with OR across multiple text conditions and AND across enabled criteria. Account, amount, category and other criteria narrow scope. Monarch recommends original statement matching for stability. The desktop editor previews changes; applying matches to existing transactions requires an explicit checkbox. Multiple rules execute in user-defined list order; the document does not explicitly specify every conflicting-action outcome or promise rollback on rule deletion. Hide is a rule action. CSV-trigger details are UNKNOWN from the current rule page. [Monarch: Transaction Rules](https://help.monarch.com/hc/en-us/articles/360048393372-Transaction-Rules)

Hidden transactions remain stored, disappear from the main list and cash flow/reports/budget calculations, and can be found via filters and unhidden individually or in bulk. Account balances/net worth remain unaffected. Hiding does not clear Needs Review. Account-level hiding can only be reversed at account level. Pending rows can reappear when replaced by finalized entries. [Monarch: Hiding or Unhiding Transactions](https://help.monarch.com/hc/en-us/articles/4405041904916-Hiding-or-Unhiding-Transactions)

### Quicken Simplifi

Rules can match original statement name or Simplifi payee name using one or more keywords, optionally scoped to account and amount. Actions include exclusion from Reports or Spending Plan. Rules apply automatically to applicable CSV imports. Manual, transfer, balance-adjustment and recurring transactions are documented exceptions. Creation and editing include a review step and an explicit choice to apply to existing transactions. Rules can be edited/deleted; the source does not establish a row-level preview, keyword combination/case semantics, conflicting-rule precedence, exclusion undo, or rollback after rule deletion. It allows only one category rule per payee and suggests unique downloaded keywords or amount conditions for distinctions. [Simplifi: Transaction Rules in the Web App](https://support.simplifi.quicken.com/en/articles/4792733-how-to-use-transaction-rules-in-the-web-app)

### Lunch Money

Rules support payee/notes contains, starts-with, or exact matching, plus account, amount/type, category and day-range conditions. Its examples show case-insensitive contains/starts-with but case-sensitive exact matching. A separate original bank text matching field and conflict precedence are UNKNOWN. Rules apply by default to synced, manually added and CSV/PDF-imported rows; import and API callers can toggle application. Historical application uses Create & Apply or Save and Apply; documented suggested-payee flows show affected rows and allow deselection. Running rules on transaction updates is separately enabled. The delete action targets one specific existing temporary transaction when another matching transaction arrives, with one-time rule deletion; this is not a general matched-row exclusion action. [Lunch Money: Rules](https://support.lunchmoney.app/setup/rules)

Category properties distinguish exclusion from budget from exclusion from spending/income totals. Reports can optionally include excluded-total categories. Subcategories inherit their parent category's properties. This retains transactions for analysis rather than establishing import omission. [Lunch Money: Category Properties](https://support.lunchmoney.app/setup/categories/category-properties)

## Cross-product interpretation

The comparison supports distinguishing three operations:

1. Import omission: a candidate row never becomes an accepted transaction. A general user rule for this operation is not established by these sources.
2. Retained exclusion: stored transactions stop contributing to selected calculations. Monarch and Simplifi document this as a rule action; Lunch Money documents category-based exclusion.
3. Deletion: the stored transaction is removed. Lunch Money's documented one-time deletion has a specific temporary-entry reconciliation purpose.

Original description and renamed display payee are explicitly separate matching choices in Actual, Monarch and Simplifi; YNAB anchors renaming to imported payee text. Preview and separate historical application have clear precedents in Actual, Monarch and Lunch Money; Simplifi documents a review step and historical choice with less detail about preview contents. These are interpretations of the cited behaviors, not claims that every app implements the same workflow.

## Evidence limits and unresolved questions

- Account scoping is documented in four rule engines; an import-format/provider-source selector is not established by these pages.
- Rule deletion is not documented as undoing already applied transaction edits. A future-rule switch and restoration of previous rows should be treated as distinct concerns.
- Sticky per-transaction exceptions after rule reapplication are not established by these sources.
- A stored reason naming the rule responsible for each exclusion is not established by these sources.
- A zero-result preview, matched amount totals, or warning threshold for unusually broad rules is not established by these pages.
- Search snippets for Monarch were stale: the live June 2026 hiding article says hidden rows are omitted from the main list by default. Findings above use the opened current article.

## Ledger context verified in the current feature worktree

Inspected the 0.11.2-beta feature branch at a7051d1 on 2026-10-12.

- CIBC recognition uses specific payment descriptions and requires a credit-side row; Chase uses its Payment transaction type. Other merchant credits remain refunds. See src/utils/csvParser.ts.
- Card-payment flags block bulk acceptance, but individual approval remains available. Exclusion is currently an explicit rejection with Undo, not automatic deletion. See src/components/budget/TriageInboxWidget.tsx and src/store/useTriageStore.ts.
- Category rules currently use case-insensitive substring matching, learned when a categorized transaction is approved. Exclusion should be a separately authorized rule action, never inferred from an ordinary one-off rejection.
- Import history retains original parsed fields and raw CSV row data separately from editable budget data, with source identity and occurrence counts. Decisions survive overlapping exports. See src/types/importHistory.ts and src/utils/budget/importHistory.ts.
- Saved budget transactions currently lack a general excluded state. Adding that state would require every income, spending, forecast and reporting calculation to honor it. Import exclusions can instead retain the record in import history without adding it to budget transactions.

## Options for review

| Approach | Benefit | Cost or limitation |
| --- | --- | --- |
| Review-first rules, with optional automatic exclusion per rule (recommended) | Familiar card-payment behavior; users can automate patterns they trust | Needs clear rule reasons and restoration |
| Always flag matches for review | Smallest initial change and easy to check | Repeated imports still require a batch decision for newly seen matching entries |
| Automatically exclude every match | Least repeated work | A broad or mistaken rule can remove real spending from analysis without a review step |

Recommendation is a product judgment informed by the sources, not a claim that every compared app uses this exact design.

## Recommended behavior

### 1. Meaning and boundary

Label the feature "Exclusion Rules". Explain: "Keep matching imports out of income and spending totals. You can review or restore them."

This is import filtering. It does not declare that money never moved, change an account balance, or create a transfer between accounts. Card payments between owned accounts are transfers; if Ledger later adds full account reconciliation, these records should remain available for that model.

Do not treat all payments, refunds, reimbursements, ATM withdrawals, or e-transfers as exclusions. A merchant payment is normally real spending, a refund normally offsets spending, and an e-transfer can be rent, income, reimbursement or an internal transfer.

### 2. Small rule editor

Offer "Exclude similar transactions..." from a review row and "Add rule" in Exclusion Rules.

Pre-fill the selected card/account and the full original bank description. Default to an exact match. Let the user deliberately change it to "Contains" or "Starts with" and edit the stable phrase.

Fields for the first version:

- A readable rule name.
- Card/account: selected source by default; all sources is an explicit choice.
- Original bank description: Exactly matches, Contains, or Starts with.
- Money direction: money in, money out, or either. Present this independently of the app's expense/income labels because refunds are negative expenses. Default to the selected row's actual direction.
- Optional amount: exact or between, expressed as positive monetary values plus the direction. Any amount is the default.
- Behavior: Review matches (default) or Automatically exclude.

All enabled fields must match. Normalize case and whitespace, while retaining the original description for display. Preserve punctuation and accents. Do not remove arbitrary numbers or add fuzzy/AI matching. Start without regular expressions or a general nested AND/OR builder. Multiple description variants can be separate rules initially.

Require nonempty description criteria. Show broad-match feedback with actual results rather than claiming a pattern is safe merely because it exceeds an arbitrary character length.

### 3. Preview before saving

Show matching count, total money in and total money out separately, with dated sample rows and source names. Include pending, accepted and already excluded counts separately where available. A mixed-sign net total can conceal the scale of exclusions.

Preview uses stored original bank descriptions, not edited merchant labels. Explain that it covers imported history currently available in Ledger, not all past or future bank transactions. Legacy rows without original bank provenance are clearly identified and not silently assigned an account.

Save defaults to future imports. Offer a separate checkbox or action for matching transactions currently awaiting review, with a concrete count. Keep already accepted transactions unchanged in the first version. Historical exclusion of accepted spending is a separate feature requiring calculation and restoration work.

### 4. Import outcomes

Run source assignment and remembered occurrence matching first. Previously handled accepted, ignored or duplicate entries retain their decision; changing a rule must not silently rewrite history.

Evaluate exclusion rules only for genuinely new, unresolved occurrences. Retain a snapshot of matching rule identity, version and reason. Keep this metadata outside the bank-original fingerprint.

Review matches: mark the row "Matches exclusion rule: [name]", hold it out of Accept All, and offer Exclude or Include this transaction. A batch Exclude matches action has Undo.

Automatically exclude: keep the original occurrence and exclusion reason in import history, omit it from budget transactions, and show it in the import summary, for example "8 excluded by your rules". Provide a persistent Excluded view beyond the most recent upload, with Restore to review.

Possible duplicates remain in review even if an automatic exclusion rule matches. Resolving identity first avoids recording the wrong occurrence or swallowing a changed charge.

### 5. Manual decisions and rule changes

An explicit Include this transaction or restoration creates an occurrence-level override so an active rule cannot immediately exclude the same row again. Other matching future occurrences still follow the rule. Restoring should return the original entry to review, never create an extra copy.

Pause, edit and delete rules affect future evaluations. They do not delete excluded records, reverse previous approvals, or automatically restore every prior exclusion. Offer restoration separately through the Excluded view.

Do not learn an exclusion rule from a single rejected transaction. "Exclude once" and "Exclude similar..." must be distinct actions.

### 6. Overlap and precedence

For an initial system where all exclusion rules have the same effect, multiple matches need no drag-to-reorder priority editor. Show matching reasons. If any matching rule requires review, prefer review over automatic exclusion.

Occurrence-specific manual decisions take priority over user rules. Built-in card-payment recognition remains visible as a separate reason; explicit individual inclusion remains possible. Categorization cannot clear an exclusion hold.

### 7. Concrete examples

- "CIBC 1234 + money in + starts with PAYMENT THANK YOU" catches variable payment amounts without affecting the same text on another source.
- "Chequing + money out + contains TRANSFER TO SAVINGS" can exclude the user's known internal transfers after preview.
- "Contains PAYMENT" is too broad to assume safe: preview may reveal utility or merchant payments.
- "Money in + contains REFUND" should not be a default rule, because it can erase legitimate spending offsets.
- Reuploading an excluded June 10 occurrence keeps it excluded once. Two real same-day coffee purchases remain separate occurrences; a coffee exclusion rule would match both deliberately.

## Suggested first release scope

Source-scoped plain-text rules, optional direction and amount, preview, review-first behavior, explicit automatic mode, match reasons, Undo, persistent excluded history, pause/edit/delete, and occurrence-level inclusion overrides.

Defer regular expressions, AI suggestions, nested logic, automatic rule learning, account reconciliation, and retroactive exclusion of accepted transactions.

## Acceptance checks for a later implementation plan

- Edited merchant labels do not change original-description matching.
- Source scoping, direction and refund signs behave correctly.
- Exact versus Contains versus Starts with produce predictable preview results.
- Preview and import evaluation use the same matching semantics.
- No matched held row is accepted by Accept All.
- Automatic exclusions stay visible and reversible after reload and repeated overlapping uploads.
- Pausing or deleting a rule does not erase history or silently recalculate past spending.
- Restoration and Undo preserve occurrence identity and do not get reapplied immediately.
- Possible duplicates stay in review; repeated identical real occurrences keep their counts.
- Rule metadata, exclusions and overrides round-trip through backup and sync.
- Creating, previewing and restoring rules works with keyboard and phone layouts.

Status: research and proposed direction only. No application code, release metadata or user data changed.
