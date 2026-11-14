# Account currencies

Date: 2026-10-06
Status: Agreed design, written specification awaiting user review

## Purpose and scope

Support separate CAD and USD accounts without adding unlike balances together. Each bank, investment, debt, receivable, and other asset account has exactly one currency. CAD is the default. The first version offers only CAD and USD, even though Ledger's market data service supports more currencies.

This feature concerns dashboard account balances. It does not connect accounts to transaction imports, alter investment holdings or report currencies, introduce transfers, or add a configurable reporting currency. Combined account totals continue to use CAD.

## Agreed behavior

### Creating and editing accounts

Add and Edit Account include a labeled Currency selector next to the balance controls. New accounts default to CAD. Editing initializes from the saved currency. The balance label identifies its currency, and changing selection does not convert or round the stored number.

Changing an existing account's currency requires confirmation before saving. Explain the actual change, for example: "The balance will remain 1,000.00 and change from CAD to USD. Its CAD value and your net worth will change." Cancel keeps the account unchanged. Creating a new account does not require this confirmation.

USD account rows show their native balance with an explicit USD label, followed by a smaller approximate CAD equivalent. CAD rows show a single CAD balance. Both dollar currencies must be unambiguous. Native balances remain visible during loading and failure. USD equivalents show "Conversion Needed" when no usable rate exists.

Retain existing mobile stacked account rows, desktop wrapping, Show More behavior, modal/bottom-sheet behavior, keyboard navigation, and accessible form labels. Controls and secondary amounts must fit narrow screens without horizontal scrolling.

### Valuation and totals

For CAD accounts, CAD value equals the stored balance. For USD accounts, CAD value equals the stored balance multiplied by the resolved USD-to-CAD rate. Convert before aggregating, and round only for display.

Category totals are in CAD. Net worth adds bank, investment, receivable, and other asset totals, then subtracts debt. Keep existing signed-balance semantics; currency support does not change how negative balances behave.

The same valuation result drives account equivalents, category totals, net worth, percentage trends, and net worth-based planner goal progress. A consumer must never silently use a raw USD balance as CAD.

If any USD account cannot be converted, its category total and net worth show "Conversion Needed" instead of a partial or zero total. CAD-only categories remain available. Net worth trend and goal progress are unavailable while current net worth is unavailable; do not present a fabricated percentage or progress value. An empty account set continues to follow existing empty-state behavior.

### Exchange-rate controls

Reuse the existing USD/CAD market data service, cache, and persisted manual overrides. The service supports live rates through Frankfurter without an API key. A current manual override takes precedence; otherwise attempt live resolution and use the service's cached fallback when live resolution fails.

Show one dashboard rate control when USD accounts exist, including rate direction (1 USD = X CAD), source (Live, Cached, or Manual), source timestamp/age, refresh, manual entry, and return to automatic rates. Explain that manual changes also affect other Ledger features using that shared USD/CAD override. Do not create an independent account-only override.

Accept only finite positive manual rates. Failed refreshes retain a usable cached rate with its stale status and age visible. Cached rates remain usable for totals and snapshots. If no rate is available, display "Conversion Needed" and provide retry/manual-entry actions. Loading without a prior usable rate also withholds totals and snapshots.

Resolve on app opening when USD accounts exist, when an account first requires USD conversion, on reconnect, and on explicit refresh. Manual override edits and clearing must update every account consumer promptly. CAD-only accounts require no exchange-rate request. Async responses must not overwrite newer account/rate state or publish totals for a previous selection. This version does not add background polling.

### Existing-account review

On loading existing account data without currency, preserve every balance and assign CAD. Record the affected account IDs as pending review and show a persistent dashboard notice until review is confirmed. Accounts already carrying CAD or USD are not reset. Repeat loads do not re-open a completed review; importing older currency-less accounts does.

The review list shows existing accounts with CAD selected and allows each to be changed to USD. Provide one action to confirm the entire list, including accounts that remain CAD. Keep changes as a draft until confirmation; closing the review leaves saved accounts and review status unchanged. For any currency changes, show the keep-number confirmation before applying the batch. Apply the batch atomically and record at most one resulting account-edit snapshot.

The notice does not block using accounts. Until review is complete, explain that totals assume CAD for unreviewed accounts. Removing a pending account also removes its pending review entry; no notice is needed when no pending accounts remain.

### History and snapshots

Preserve all existing net worth snapshots. They remain interpreted as the CAD totals previously recorded; do not infer original per-account balances or retroactively convert earlier totals.

Persist a currency-support start date when the new account state is first normalized. Display a marker/explanation in net worth history: earlier totals may have treated foreign balances as CAD. Keep this marker through backup restoration. Record it only once per persisted account dataset.

Record one daily snapshot when the app is opened and a complete CAD valuation is available. Account edits, additions, removals, and confirmed review changes update today's snapshot using a complete valuation. Rate refreshes or manual rate changes alone update current displayed totals but leave an existing daily snapshot unchanged. Earlier dates remain untouched.

If conversion is unavailable, defer automatic snapshots. When a rate becomes available, fulfill the pending daily snapshot or pending account-edit snapshot using the current accounts, never a captured outdated account list. Distinguish pending account changes from rate-only refreshes so a refresh cannot overwrite a saved point on its own.

Retain existing manual history editing in CAD and the current UTC snapshot date convention. App-opening snapshot creation leaves an existing point for today untouched, including a manually entered point. Account edits retain the existing behavior of replacing today's point. Do not backfill days when the app was closed or conversion remained unavailable.

## Architecture and data flow

- `useAccountsStore` owns account identity, native balances, CAD/USD currency, pending review IDs, history, and the support-start marker. Use the exported Account type in account UI instead of duplicate local interfaces.
- A focused account valuation utility calculates per-account CAD values, category totals, and net worth from accounts and an optional USD/CAD rate. Its result explicitly represents unavailable totals rather than substituting zero.
- A shared account valuation/rate integration resolves USD/CAD once, exposes source/freshness and controls, and supplies consistent valuation to all dashboard and goal consumers. Place snapshot coordination at app level so history does not depend on a particular widget being visible.
- The snapshot coordinator handles daily and account-edit requests, waits for a usable valuation, and writes only complete CAD totals. Network activity belongs outside synchronous persisted account mutations.
- Normalize old account payloads during rehydration and restoration, preserving the existing demo-account cleanup and version-less persistence compatibility. Backups already export and restore raw store payloads; new fields must survive export, restore, and undo without being dropped.

Primary integration points: `src/store/useAccountsStore.ts`, `src/components/dashboard/AddAccountModal.tsx`, `src/components/dashboard/AccountCategoryWidget.tsx`, dashboard net worth/history/goal widgets, `src/App.tsx`, `src/services/marketData/useMarketData.ts`, and `src/utils/backup.ts`.

Keep changes focused on account currency support. The existing multi-currency holdings hook is not required for a single USD/CAD pair and does not currently subscribe to manual overrides; do not adopt it unchanged for account valuation.

## Validation and acceptance

1. With CAD 1,000 and USD 1,000 at 1 USD = 1.35 CAD, category/net worth totals show CAD 2,350. A USD 100 debt subtracts CAD 135.
2. Every account type supports CAD/USD, defaults to CAD, persists its currency, and displays unambiguous balances. Currency changes retain the exact number and require confirmation.
3. Missing rates never yield raw mixed-currency totals, partial net worth, zero substitution, misleading progress, or automatic snapshots. CAD-only categories remain usable.
4. Live, cached, stale, manual, refresh failure, reconnect, invalid override input, and return-to-automatic states behave consistently across all consumers.
5. Legacy account normalization preserves balances and history. Review supports all-CAD confirmation, USD corrections, cancellation, repeated hydration, and old-backup restoration.
6. Daily and edit snapshots use complete CAD valuations. Delayed rate resolution uses current accounts. Rate-only refreshes preserve saved snapshots, and earlier history stays unchanged.
7. Backup round trips retain account currencies, review status, history marker, and existing market data overrides. Delete/undo retains account currency.
8. Browser verification covers desktop and narrow mobile add/edit, review, confirmation, rate controls, long names, large balances, keyboard access, and unavailable conversion.

During implementation, run focused tests for valuation, persistence/review, snapshots, and affected UI, then the repository's required verification gate. This document-only change requires content and diff review; it does not establish application test results.
