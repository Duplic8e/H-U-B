# Remembered transaction imports

Approved in conversation on 2026-10-12: plan and implement repeated-day matching.

## Behavior

Compare original bank entries within an import source and date. A daily signature is the sorted multiset of original date, amount in cents, direction and description. Preserve punctuation and Unicode; normalize only case and surrounding/repeated whitespace. Two identical coffees remain two occurrences. Row order and filename do not affect identity.

An identical previously observed day skips every incoming copy, including copies already pending, accepted or deliberately ignored. Original pending rows remain reviewable. Changed days consume known occurrences one for one, skip exact known entries and add unmatched entries to triage. An extra identical occurrence or a changed merchant/date with a plausible existing match is held for review. Never remove or overwrite accepted entries because an export omits or changes a row.

Keep immutable original fields and decisions separately from editable budget transactions, inside the persisted triage store. Rejection remembers an ignored charge; rejecting a possible duplicate records a duplicate decision. Approval permits keeping both. Discard All cancels the pending records rather than permanently ignoring them. Existing Undo restores pending decisions. Skipped entries are inspectable, and ignored entries can return to review.

CIBC parser carries a bank/card identity into import routing. Other formats require a saved source selection or a named new source. Filename is never account identity. Preserve existing CAD budget amount semantics; do not introduce currency conversion or account balances. Legacy entries without source provenance can produce possible matches but are never silently assigned a card or skipped. Old discarded rejection decisions cannot be reconstructed.

## Presentation and safety

Use the existing import button, Sheet, Triage Inbox and Undo patterns. A compact summary announces new and skipped counts, expands to show skipped originals and changed-day omissions, and provides Review again for ignored entries. Possible matches show incoming and existing details with Same charge, Keep both and Ignore this charge. Bulk acceptance excludes uncertain and card-payment rows. Source selection can be cancelled without writes. All history travels in the existing triage backup key and is version-migrated without changing old data.

## Acceptance

Cover overlapping May 17-June 16 and June 8-July 7 exports; two identical coffees; reversed row order; differing cards; additional, omitted and changed entries; merchant edits and shared bills; ignored card payments; repeated pending imports; legacy rows; persistence/backup restore; cancellation and Undo. Check desktop and phone interaction, keyboard access and no horizontal overflow. Run the complete repository verification gate, then independent review before offering integration.
