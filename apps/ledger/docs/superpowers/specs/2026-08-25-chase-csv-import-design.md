# Chase credit card CSV import — design

Date: 2026-08-25
Ships as: v0.9.6-beta (current: 0.9.5-beta)

## Problem

Chase credit card activity exports use the header row
`Transaction Date,Post Date,Description,Category,Type,Amount,Memo`.
No parser in `src/utils/csvParser.ts` detects that shape, so the file falls
through to the manual column-mapping dialog in `CSVUploader`. That dialog maps
only date, amount and description, which means three things in the file are
lost or actively wrong:

1. Credit card bill payments (`Type=Payment`, positive amount) import as
   income. In the reference file that is five rows totalling $637.80 of
   fictitious August income. A card payment is a transfer between the user's
   own accounts, not earnings.
2. Refunds (`Type=Return`, positive amount) import as income. The refund
   inflates income and leaves the original spend uncorrected, so the category
   the money came back to still reads as fully spent.
3. Chase's own `Category` column is discarded, so every row lands
   uncategorized in triage.

Descriptions also arrive HTML-escaped (`H&amp;M  0500NEW YORK`,
`DON JUAN DELI &amp; GROCERY`).

## Scope

Four pieces. Duplicate detection is explicitly out of scope; the current
behavior in `importDedupe.ts` is retained unchanged.

### 1. Chase parser

A new entry in the `PARSERS` array in `src/utils/csvParser.ts`, placed before
`Standard Ledger CSV` so the more specific shape wins.

- **Detect:** headers include `Transaction Date`, `Post Date` and `Type`. No
  existing parser matches this combination, so no other format changes
  behavior. In particular `Download Transactions (Visa)` also keys on
  `Transaction Date` but additionally requires `CAD$`, which Chase lacks.
- **Date:** `Transaction Date`, converted `MM/DD/YYYY` to `YYYY-MM-DD` with the
  same split-and-pad the sibling parsers use. `Post Date` is ignored.
  Transaction date is used because it is when the purchase happened; this can
  place a charge in the prior month relative to the statement, which is
  correct and intended.
- **Description:** the `Description` column with HTML entities decoded. The
  decoder handles the named entities Chase emits (`&amp;` `&lt;` `&gt;`
  `&quot;` `&#39;`) and is not a general HTML parser.
- **Row routing by `Type`:**

  | `Type` | Result |
  |---|---|
  | `Sale` | `type: 'expense'`, `Math.abs(amount)` |
  | `Return` | `type: 'expense'`, negative amount |
  | `Payment` | `type: 'income'`, `flag: 'card-payment'` |
  | anything else | expense or income by sign, no flag |

  Unrecognized `Type` values fall through to sign-based handling rather than
  being dropped, so a Chase export containing a type not seen here still
  imports rather than silently losing rows.

### 2. Card payment flag in triage

Mirrors the existing duplicate mechanism rather than inventing a parallel one.

- `TriageTransaction` in `src/types/triage.ts` gains `flag?: 'card-payment'`.
- `TriageInboxWidget` renders a `card payment, not income` badge next to the
  date, in the same slot the duplicate badge already occupies.
- The `Accept all` count and the rows `handleAcceptAll` submits both exclude
  flagged rows, exactly as they exclude duplicates today.
- A `Reject N card payments` header button, backed by a new
  `rejectCardPayments` action in the triage store that mirrors
  `rejectDuplicates`.

A flagged row keeps its individual accept button, so a payment can still be
imported deliberately if the user ever wants it.

### 3. Refunds as negative expenses

A refund is stored as `type: 'expense'` with a negative `amount`, so it reduces
the category the money originally left. Every spend aggregation in the codebase
is a plain `sum += t.amount`, so the arithmetic requires no changes anywhere.

The changes are confined to display and validation. Each is listed here
explicitly because each is a deliberate, separately reviewable behavior change:

| Site | Today | Problem | Change |
|---|---|---|---|
| `TriageInboxWidget.tsx:83` | prefixes `'-'` then calls `formatMoney` | renders `-$-40` for a refund | drop the manual prefix; `formatMoney` already emits the sign |
| `TransactionListWidget.tsx:174` | `amountPrefix: '-'` | same | same |
| `MonthlySummaryWidget.tsx:37` | same pattern in forecast text | same | same |
| `TransactionModal.tsx:86` | `if (amount <= 0)` rejects | a refund cannot be hand-entered or edited | permit negative when type is expense; keep rejecting exactly zero |
| `CashFlowWidget.tsx:93` | Sankey sums spend per group | a group netting negative yields an invalid flow | clamp the group node at zero, with a comment recording why |
| `BudgetProgressWidget.tsx:43` | spend per category | arithmetic is correct, but a bar width could go negative | clamp bar width at zero; the displayed number stays truthful |

Splits are out of scope for negative amounts. `budget.ts:26` documents that
slices carry the parent transaction's sign convention, which is undefined for
negatives. Refunds import unsplit, and splitting a negative transaction is not
supported by this change.

### 4. Chase Category as a categorization fallback

A new `src/utils/budget/chaseCategoryMap.ts` holding a Chase-name to
ledger-category-name table. Resolution is by category *name* against whatever
categories currently exist, so a renamed or deleted category degrades to a miss
rather than to a wrong assignment.

`guessCategory` is unchanged. `CSVUploader` consults the fallback only when
`guessCategory` returns undefined, so the user's own substring rules always
win over Chase's guess.

Mapping:

| Chase category | Ledger category |
|---|---|
| Groceries | Groceries |
| Food & Drink | Takeout |
| Travel | Transportation |
| Shopping | Personal |
| Entertainment | Night Out |
| Gifts & Donations | Gifts |
| Health & Wellness | unmapped |

`Health & Wellness` is deliberately unmapped: the default category set has no
good fit, and a wrong assignment is worse than none.

## Explicitly out of scope

- **Duplicate detection.** `importDedupe.ts` keeps its current behavior. The
  reference file contains two genuine, separate `TST* FIG 19` charges of
  $16.57 on the same day; the second imports flagged `already imported` and is
  excluded from `Accept all`, and the user un-flags it by accepting it
  individually. This is pre-existing behavior, was reviewed, and is retained.
- **Splitting negative transactions.**
- **Post Date** as an alternate date source.

## Testing

- `csvParser` unit tests over the reference file shape: detection, date
  conversion, entity decoding, and one case per `Type` value including an
  unrecognized one.
- `chaseCategoryMap` unit tests: a hit, a miss for an unmapped Chase category,
  and a miss when the target ledger category has been renamed away.
- `CSVUploader` test that a user substring rule beats the Chase category.
- `TriageInboxWidget` tests: the badge renders, `Accept all` excludes flagged
  rows, and `Reject N card payments` clears only flagged rows.
- A regression test per display site in the refund table above, each asserting
  the rendered string for a negative expense. These must fail before the fix.
