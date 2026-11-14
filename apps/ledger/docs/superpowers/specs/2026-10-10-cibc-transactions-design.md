# CIBC transaction CSV support

Approved scope: recognize the supplied headerless five-column CIBC credit card export in Budgeting's existing Import CSV flow. Columns are ISO date, description, debit, credit, and masked card number. Preserve the first transaction, quoted descriptions, and raw row metadata. Debit amounts are positive expenses; merchant credits are negative expenses. Recognized payment credits use the existing card-payment flag so bulk acceptance holds them for review. Existing categorization and duplicate detection continue to apply.

Use a dedicated parser instead of extending the generic headerless parser, because card refunds and payments have different meanings from bank deposits. Manual mapping cannot represent both amount columns. Detect ISO dates and the masked card shape, without depending on the filename. Reject malformed CIBC rows with a row number instead of silently importing a partial file. Do not infer currency or link an account from a masked card number.

Use synthetic regression fixtures only. Verify detection, debit/refund/payment semantics, all rows including the first, quoted commas, BOM/CRLF, malformed rows, existing formats, upload triage and duplicate flags. Validate the supplied file locally without committing financial data. This change is part of 0.11.1-beta.

Validation: all 192 supplied rows parsed locally (169 expenses, 4 refunds, 19 flagged payments). Synthetic upload and bulk acceptance passed in browser contexts at 1280px and 375px widths. Independent focused review found no actionable issues.
Full verify gate passed: lint, 1616 unit/component tests, production build, bundle/eager/type-scale checks, and 246 browser tests (5 skipped).
