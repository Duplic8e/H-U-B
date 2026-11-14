# CIBC Transaction CSV Implementation Plan

**Goal:** Import the supplied CIBC transaction format directly into existing triage for 0.11.1-beta.

**Architecture:** Register a positional CIBC credit card parser in csvParser.ts and recognize ISO-date headerless files. Reuse existing payment flags, negative expense refunds, category rules, and duplicate checking.

**Tech Stack:** TypeScript, PapaParse, Vitest, React Testing Library.

## Global Constraints

No em dashes. Preserve unrelated checkout changes. Do not commit the supplied financial file. No currency or account inference. Version is 0.11.1-beta.

## Task 1: Parser and upload regression coverage

- [x] Add synthetic parser tests in src/utils/csvParser.test.ts for five-column detection, debit 15.99, refund -27.11, both observed payment descriptions, quoted merchant commas, first-row retention, BOM/CRLF, invalid dates/amounts, row-number errors, and legacy format preservation.
- [x] Add a CSVUploader.test.tsx case uploading an expense, refund, and payment; assert three pending rows, category-rule application, existing-transaction duplicate flag, payment flag, and no mapping dialog.
- [x] Run `node node_modules/vitest/vitest.mjs run src/utils/csvParser.test.ts src/components/budget/CSVUploader.test.tsx` and confirm new tests fail because CIBC is not recognized.
- [x] Add CIBC parser detection and strict row parsing in src/utils/csvParser.ts. Extend headerless recognition to ISO dates, strip BOM, and report CIBC parse errors by transaction row.
- [x] Re-run the focused tests and inspect the diff.

## Task 2: Release metadata and validation

- [x] Update package.json and package-lock.json root versions to 0.11.1-beta and add a changelog entry.
- [x] Run the full verify gate, using a separate preview port if the default port belongs to another app.
- [x] Parse the user-provided CSV locally, assert all 192 rows retained, and summarize counts without exposing transactions.
- [x] Review the diff against the approved scope, fix findings, and commit the finished change locally.
