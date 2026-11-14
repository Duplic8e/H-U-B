# Account Currencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every dashboard account one CAD or USD currency and produce complete CAD valuations without losing native balances or existing history.

**Architecture:** Keep native account data and review/history metadata in the existing persisted account store. Derive valuations through a pure utility and resolve one shared USD/CAD rate outside account mutations. An app-level coordinator fulfills daily and account-edit snapshot requests independently of dashboard visibility.

**Tech Stack:** React 19, TypeScript, Zustand 5, existing market data services, Vitest/Testing Library, Playwright, existing Sheet/ThemedSelect/NumberInput components.

**Approved specification:** `docs/superpowers/specs/2026-10-06-account-currencies-design.md`.

## Global Constraints

- Each bank, investment, debt, receivable, and other asset account has exactly one currency.
- CAD is the default.
- The first version offers only CAD and USD, even though Ledger's market data service supports more currencies.
- Combined account totals continue to use CAD.
- Convert before aggregating, and round only for display.
- Changing an existing account's currency requires confirmation before saving.
- If any USD account cannot be converted, its category total and net worth show "Conversion Needed" instead of a partial or zero total.
- Rate refreshes or manual rate changes alone update current displayed totals but leave an existing daily snapshot unchanged.
- Retain existing manual history editing in CAD and the current UTC snapshot date convention.
- No new dependencies, reporting-currency setting, transfers, account linking, investment report changes, or background polling.
- Preserve version-less account persistence and existing demo cleanup. Never persist derived exchange-rate state in the account store.
- No em dashes. Implementation, review, debugging, and testing use medium reasoning or lower. Never select Astra unless explicitly requested.
- Keep unrelated work untouched; work in `C:/Users/misha/.codex/worktrees/account-currencies/ledger` on `codex/account-currencies`. Do not push or merge without authorization.

## File responsibilities

| File | Responsibility |
| --- | --- |
| `src/store/useAccountsStore.ts` | Native accounts, currency normalization/review, dated snapshot requests and history |
| `src/utils/accounts/accountValuation.ts` | Pure CAD conversion, complete category/net worth totals, trend comparison |
| `src/store/useAccountFxStore.ts` | Nonpersisted resolved rate, loading/error state and refresh request |
| `src/hooks/useAccountValuation.ts` | Shared reactive valuation for consumers |
| `src/components/accounts/AccountCurrencyCoordinator.tsx` | App-level rate resolution and snapshot fulfillment |
| `src/components/accounts/AccountFxControls.tsx` | Shared USD/CAD source/age, refresh and manual override controls |
| `src/components/accounts/AccountCurrencyReview.tsx` | Persistent review notice and atomic draft review sheet |
| `src/components/accounts/CurrencyChangeConfirmation.tsx` | Reusable accessible confirmation content |
| `src/components/dashboard/AddAccountModal.tsx` | CAD/USD selection, native balance input and edit confirmation |
| `src/components/dashboard/AccountCategoryWidget.tsx` | Native account rows and complete CAD category totals |
| `src/components/dashboard/widgets/NetWorthWidget.tsx` | Complete CAD net worth and available trend |
| `src/components/dashboard/widgets/PlannerGoalWidget.tsx` | CAD goal progress or unavailable state |
| `src/components/dashboard/widgets/NetWorthHistorySheet.tsx` | Currency-start explanation and CAD manual history |
| `src/components/planner/forecaster/useForecasterSettings.ts` | Converted automatic starting balance |
| `src/components/planner/forecaster/ForecasterTool.tsx` | Withhold automatic projections if conversion is unavailable |
| `src/pages/Dashboard.tsx`, `src/App.tsx` | Dashboard controls and global coordinator mount |
| Corresponding `.test.ts` / `.test.tsx` files, `e2e/account-currencies.spec.ts` | Behavioral verification |

## Preparation

- [ ] Read the approved spec and current files before editing. Run `git status --short` and confirm the branch/path above.
- [ ] Run `npm ci`, then `npm test -- --run` for the baseline. Report existing failures separately; do not broaden this feature into unrelated repairs.
- [ ] Read existing modal, undo, backup, app hydration and Playwright seeding patterns. Use `rg -n 'getNetWorth|getTotalByType|recordSnapshot|ensureDailySnapshot' src` to identify consumers. Include the Forecaster, which automatically starts from net worth, in addition to dashboard widgets.
- [ ] Produce a compact desktop/mobile mockup of the selector, review notice, USD secondary equivalent, and rate controls before consequential layout changes. Preserve the existing selected dashboard style; resolve layout questions with the user if the mockup changes that style.

## Task 1: Currency-aware native accounts and pure valuation

**Files:** Create `src/utils/accounts/accountValuation.ts` and `src/utils/accounts/accountValuation.test.ts`; modify `src/store/useAccountsStore.ts` and its tests; replace duplicate Account interfaces in `AddAccountModal.tsx` and `AccountCategoryWidget.tsx`; update typed account fixtures in affected widget tests.

**Interfaces:**

```ts
export type AccountCurrency = 'CAD' | 'USD'
// Add this required field to the existing exported Account interface:
// currency: AccountCurrency
export type NewAccount = Omit<Account, 'id' | 'currency'> & { currency?: AccountCurrency }
export interface AccountValuation {
  cadById: Record<string, number | null>
  totals: Record<AccountType, number | null>
  netWorth: number | null
}
export function valueAccounts(accounts: readonly Account[], usdCadRate?: number): AccountValuation
export function netWorthTrend(current: number | null, history: readonly NetWorthSnapshot[], now?: Date): number | null
```

Store methods retain their names with explicit optional-rate arguments: `getTotalByType(type, usdCadRate?): number | null`, `getNetWorth(usdCadRate?): number | null`, `getNetWorthTrend(usdCadRate?): number | null`, `recordSnapshot(usdCadRate?): void`, `ensureDailySnapshot(usdCadRate?): void`. Default-rate calls must return unavailable for USD accounts rather than raw sums. CAD-only calls retain their existing behavior.

- [ ] Add failing valuation tests with real mixed-currency inputs:

```ts
it('converts assets and subtracts converted debts', () => {
  const accounts: Account[] = [
    { id: 'cad', name: 'CAD', type: 'bank', value: 1000, currency: 'CAD' },
    { id: 'usd', name: 'USD', type: 'bank', value: 1000, currency: 'USD' },
    { id: 'debt', name: 'Card', type: 'debt', value: 100, currency: 'USD' },
  ]
  expect(valueAccounts(accounts, 1.35).totals.bank).toBe(2350)
  expect(valueAccounts(accounts, 1.35).netWorth).toBe(2215)
  expect(valueAccounts(accounts).totals.bank).toBeNull()
  expect(valueAccounts(accounts).totals.other).toBe(0)
  expect(valueAccounts(accounts).netWorth).toBeNull()
})
```

Add cases for CAD-only data, empty data, signed balances, invalid/nonfinite rates, and precision retained until formatting. Run `npm test -- --run src/utils/accounts/accountValuation.test.ts`; expect failure before creating the utility.

- [ ] Implement the conversion core and use it from store getters:

```ts
export function valueAccounts(accounts: readonly Account[], usdCadRate?: number): AccountValuation {
  const totals: AccountValuation['totals'] = { bank: 0, investment: 0, debt: 0, receivable: 0, other: 0 }
  const cadById: AccountValuation['cadById'] = {}
  const validRate = usdCadRate !== undefined && Number.isFinite(usdCadRate) && usdCadRate > 0
  for (const account of accounts) {
    const cad = account.currency === 'CAD' ? account.value : validRate ? account.value * usdCadRate! : null
    cadById[account.id] = cad
    const subtotal = totals[account.type]
    totals[account.type] = subtotal === null || cad === null ? null : subtotal + cad
  }
  const complete = Object.values(totals).every((value) => value !== null)
  const netWorth = complete
    ? totals.bank! + totals.investment! + totals.receivable! + totals.other! - totals.debt!
    : null
  return { cadById, totals, netWorth }
}
```

Implement `netWorthTrend` using the existing most recent snapshot at/before last month's end. Return null for unavailable current value; preserve zero when no usable comparison exists. Add currency to Account, default NewAccount input to CAD, and explicitly add CAD to demo records and typed fixtures. Export/import one Account type into account UI.

- [ ] Replace snapshot calculation with guarded valuation. Add persisted `pendingEditSnapshotDate: string | null`. Account mutations call `recordSnapshot()` once; complete CAD-only values write immediately, while unavailable USD values set today's pending date. `recordSnapshot(rate)` writes the current accounts' valuation, replaces today's point, sorts history, and clears the pending request. `ensureDailySnapshot(rate)` first fulfills a pending edit for today, drops an expired pending edit without backfilling, then writes only if accounts exist, today's point is absent, and valuation is complete. Preserve manual history methods.

The guard must precede writes:

```ts
const today = new Date().toISOString().split('T')[0]
const value = get().getNetWorth(usdCadRate)
if (value === null) {
  set({ pendingEditSnapshotDate: today })
  return
}
```

`ensureDailySnapshot` must not invoke that guard as a new edit request; unavailable opening requests simply wait for the coordinator's next valuation effect.

- [ ] Add store tests: USD edits do not write mixed totals; resolving a rate uses the latest account list; daily opening leaves today's manual point alone; pending account edits may replace today's point; rate-only ensure calls do not replace it; earlier points and UTC behavior remain unchanged.
- [ ] Run `npm test -- --run src/store/useAccountsStore.test.ts src/utils/accounts/accountValuation.test.ts` and `npm run build`; expect pass. Commit this deliverable as `feat: model CAD and USD account valuations` after reviewing the diff.

## Task 2: Legacy normalization and atomic currency review state

**Files:** Modify `src/store/useAccountsStore.ts`, `src/store/useAccountsStore.test.ts`, and `src/utils/backup.test.ts`. Modify `src/utils/backup.ts` only if tests expose field loss.

**Interfaces:** Store adds `pendingCurrencyReviewIds: string[]`, `currencySupportStartedAt: string`, and `confirmCurrencyReview(currencies: Record<string, AccountCurrency>): void`. Export `normalizeAccountState(persisted: unknown, today?: string): unknown` and a `NormalizedAccountState` payload type containing accounts, history, pendingCurrencyReviewIds, currencySupportStartedAt, and pendingEditSnapshotDate. Normalization runs after `stripDemoAccounts` in both merge and migrate. Initialize the same metadata on fresh state, preserve existing unknown top-level fields and snapshots, and retain the version-less persist options.

- [ ] Write tests for legacy normalization, repeat loads, preserving an existing marker, all-CAD confirmation, USD correction, pending-account deletion, and backup round trips. Representative test:

```ts
it('normalizes a legacy account without rewriting history', () => {
  const legacy = { accounts: [{ id: 'a', name: 'Savings', type: 'bank', value: 500 }], history: [{ date: '2026-09-01', value: 500 }] }
  const next = normalizeAccountState(legacy, '2026-10-06') as NormalizedAccountState
  expect(next.accounts[0]).toMatchObject({ currency: 'CAD', value: 500 })
  expect(next.pendingCurrencyReviewIds).toEqual(['a'])
  expect(next.currencySupportStartedAt).toBe('2026-10-06')
  expect(next.history).toEqual(legacy.history)
  expect(normalizeAccountState(next, '2026-10-07')).toEqual(next)
})
```

Import the exported normalization payload shape in the test instead of exposing private store actions. Run `npm test -- --run src/store/useAccountsStore.test.ts src/utils/backup.test.ts`; expect new cases to fail first.

- [ ] Normalize only absent currencies to CAD and queue their IDs. Keep valid saved CAD/USD. Preserve malformed payload handling from existing cleanup; an explicitly unsupported saved currency must not be silently relabeled CAD. Reject unsupported currency records on normalization with a clear error while leaving the original persisted payload intact. Do not clear accounts/history as a recovery mechanism.
- [ ] Implement confirmation as one store update, using current saved accounts and only IDs still pending. Ignore deleted draft rows; preserve accounts added during review and never replace a balance with a captured draft balance. Clear reviewed pending IDs and request one snapshot afterward:

```ts
const pending = new Set(get().pendingCurrencyReviewIds)
set((state) => ({
  accounts: state.accounts.map((account) => pending.has(account.id) && currencies[account.id]
    ? { ...account, currency: currencies[account.id] }
    : account),
  pendingCurrencyReviewIds: state.pendingCurrencyReviewIds.filter((id) => !currencies[id]),
}))
get().recordSnapshot()
```

Validate every supplied currency before applying the batch. Remove pending IDs when an account is removed; preserve currency in undo input. Do not re-queue valid new CAD/USD accounts after rehydration.

- [ ] Build and restore a real backup using `buildBackup`, `restoreBackup`, and `useAccountsStore.persist.rehydrate()`. Assert currency, review IDs, marker, history, pending edit request, and market overrides survive. Restore a legacy backup and assert review reappears. Retain existing raw-envelope format/version.
- [ ] Run focused tests and `npm run build`; expect pass. Commit as `feat: migrate and review legacy account currencies`.

## Task 3: One global rate resolver and snapshot coordinator

**Files:** Create `src/store/useAccountFxStore.ts`, `src/hooks/useAccountValuation.ts`, `src/hooks/useAccountValuation.test.tsx`, `src/components/accounts/AccountCurrencyCoordinator.tsx`, and its test; modify `src/App.tsx`.

**Interfaces:**

```ts
interface AccountFxState {
  resolved: Resolved<FxRate> | undefined
  loading: boolean
  error: string | undefined
  refreshRevision: number
  requestRefresh: () => void
  publish: (resolved: Resolved<FxRate> | undefined, loading: boolean, error?: string) => void
}
export function useAccountValuation(): AccountValuation & {
  rate: Resolved<FxRate> | undefined
  loading: boolean
  error: string | undefined
  refresh: () => void
}
export function AccountCurrencyCoordinator(): React.ReactNode
```

AccountFxState lives in a nonpersisted Zustand store. Import `Resolved` from `src/services/marketData/marketDataService.ts` and FxRate from the existing types file. The hook subscribes to accounts and AccountFxState and memoizes `valueAccounts(accounts, rate?.value.rate)`.

- [ ] Write resolver tests with mocked `getFxRate`: no request for CAD-only accounts; one shared resolution for multiple widgets; current manual key edits trigger resolution; clearing override immediately removes the old manual value; reconnect and refresh resolve again; request A cannot publish after request B; failed refresh retains usable previous resolved data marked stale. Run `npm test -- --run src/components/accounts/AccountCurrencyCoordinator.test.tsx src/hooks/useAccountValuation.test.tsx`; expect failure before implementation.
- [ ] Implement resolution in one coordinator effect, depending on has-USD, current USD/CAD override, refreshRevision, and reconnect revision. Use `fxKey('USD', 'CAD', todayKey())` and existing service lookup. Reject nonpositive/nonfinite returned rates. Use a cancellation flag per effect and cleanup on unmount. Subscribe to online events with cleanup. Clearing a manual override invalidates that resolved manual result before requesting automatic resolution; retain usable cache on ordinary refresh failure. For a failed refresh, publish retained data with `stale: true`, plus an error; never relabel an old manual override as live/cache.
- [ ] Coordinate snapshots through a separate effect:

```ts
const accounts = useAccountsStore((state) => state.accounts)
const pending = useAccountsStore((state) => state.pendingEditSnapshotDate)
const rate = useAccountFxStore((state) => state.resolved?.value.rate)
useEffect(() => {
  useAccountsStore.getState().ensureDailySnapshot(rate)
}, [accounts, pending, rate])
```

Mount `<AccountCurrencyCoordinator />` once in App beside the router. Remove the existing opening-only ensureDailySnapshot effect. The coordinator must remain active on Forecaster/other routes and when account widgets are hidden. Rehydration changes must trigger current valuation, rather than depending on a cached account array.

- [ ] Add integration tests for deferred edit fulfillment, failed-rate pause, resolving after several edits, a daily snapshot missing at opening, unchanged today's snapshot after refresh/manual rate edits, StrictMode duplicate effects, and CAD-only immediate snapshots. Run focused tests plus existing `src/services/marketData/useMarketData.test.tsx`; expect pass. Commit as `feat: coordinate account conversion and complete snapshots`.

## Task 4: Account selector and every CAD total consumer

**Files:** Modify `src/components/dashboard/AddAccountModal.tsx`, `AccountCategoryWidget.tsx`, their tests, `widgets/NetWorthWidget.tsx`, `widgets/PlannerGoalWidget.tsx`, their tests, `src/components/planner/forecaster/useForecasterSettings.ts`, `ForecasterTool.tsx`, and `ForecasterTool.test.tsx`. Create `src/components/accounts/CurrencyChangeConfirmation.tsx` and its tests.

**Interfaces:** `CurrencyChangeConfirmation` accepts `{ changes: { id: string; name: string; value: number; from: AccountCurrency; to: AccountCurrency }[]; onConfirm: () => void; onCancel: () => void }`. It renders inline within the owning Sheet, avoiding nested modal focus traps. `useForecasterSettings` returns `autoFeed.startBalance: number | null` and `resolved.startBalance: number | null`; manual selection still resolves to a number.

- [ ] Add UI tests for default CAD, both currency options for every type, saved selection, unchanged balance number, cancel/confirm currency edits, explicit native currency, approximate equivalent, missing category/net worth, and hidden unavailable trend/progress. Add Forecaster tests: converted automatic value, no projection for unavailable automatic net worth, switching to manual restores results. Run affected test files; expect new cases to fail.
- [ ] Add the form selector and accessible balance labeling:

```tsx
const [currency, setCurrency] = useState<AccountCurrency>(initial?.currency ?? 'CAD')
<ThemedSelect
  ariaLabel="Currency"
  value={currency}
  onChange={(value) => setCurrency(value as AccountCurrency)}
  options={[{ value: 'CAD', label: 'CAD' }, { value: 'USD', label: 'USD' }]}
/>
```

Submit with `{ name, value, type, currency }`. If an existing account changes currency, retain form data as a draft and render CurrencyChangeConfirmation; only confirmation invokes updateAccount. Cancel returns to the draft without saving. Add proper input IDs/labels for name and balance so browser tests can select them reliably. Balance aria label includes currency.

- [ ] Render totals and row equivalents using useAccountValuation rather than getters with default-rate calls:

```tsx
const valuation = useAccountValuation()
const total = valuation.totals[type]
const format = (amount: number, currency: AccountCurrency) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amount)
const totalLabel = total === null ? 'Conversion Needed' : format(total, 'CAD')
```

Native row label uses `format(account.value, account.currency)`. USD secondary text uses `Approx. ${format(cad, 'CAD')}` when cad is non-null, otherwise Conversion Needed. Keep existing row wrapping and actions. NetWorthWidget only passes a real number into AnimatedNumber. PlannerGoalWidget renders goal name/target but no bar or percentage while unavailable.

- [ ] Feed Forecaster from useAccountValuation. Change AutoField's autoValue to `number | null` and display Conversion Needed for null. Extract the numeric result/chart block into a `ForecasterResults` component inside ForecasterTool.tsx with `startBalance: number`, so buildForecast, coast checks, goal markers, and MonteCarloSection run only when resolved.startBalance is non-null. Keep settings/manual toggle visible outside that block; do not coerce null to zero. Display an unavailable message with a dashboard link when automatic conversion is needed.
- [ ] Run `npm test -- --run src/components/dashboard src/components/planner/forecaster/ForecasterTool.test.tsx` and `npm run build`; expect pass. Search raw total consumers again and confirm every call has a safe rate/nullable contract. Commit as `feat: display native balances and CAD account totals`.

## Task 5: Dashboard rate controls, review flow, and history marker

**Files:** Create `src/components/accounts/AccountFxControls.tsx`, `AccountCurrencyReview.tsx`, and their tests; modify `src/pages/Dashboard.tsx`, `src/components/dashboard/widgets/NetWorthHistorySheet.tsx`, its tests, and `NetWorthTrendWidget.tsx`.

**Interfaces:** AccountFxControls and AccountCurrencyReview have no props; they subscribe to the shared stores. The review component owns sheet visibility and draft currency map, uses CurrencyChangeConfirmation from Task 4, and calls confirmCurrencyReview once. Rate controls use `setOverride`/`clearOverride` on the existing market store and `requestRefresh` on AccountFxState.

- [ ] Write interaction tests for invalid rate rejection, source/age labels, shared override key, returning to automatic, refresh failure retaining stale value, all-CAD review, USD review confirmation, cancellation, pending-account removal while open, and marker persistence. Run new tests and history tests; expect failures.
- [ ] Implement manual submission with the actual shared key:

```ts
if (!Number.isFinite(manualRate) || manualRate <= 0) {
  setError('Enter a rate greater than zero.')
  return
}
useMarketDataStore.getState().setOverride(fxKey('USD', 'CAD', todayKey()), manualRate)
useAccountFxStore.getState().requestRefresh()
```

Provide labeled NumberInput, Save Rate, Use Automatic Rate and Refresh actions. Source and source date/age accompany `1 USD = X CAD`; cached stale values are explicitly labeled. Mention the shared override impact in concise prose. Hide controls when no USD accounts exist. Clear today's override with the same fxKey and request refresh. Display accessible validation errors and finite positive rate checks before writing.

- [ ] Initialize the review draft on opening from current pending account IDs; render one native balance and CAD/USD selector per row. Include confirmation for changed rows; all-CAD confirmation can apply directly. Closing discards draft data. Keep notice persistent outside Sheet until pending IDs are cleared. Use Sheet's desktop modal/mobile bottom-sheet behavior and existing confirmation content rather than a second nested Sheet.
- [ ] Mount the notice and rate controls below Dashboard header and outside the customizable widget list so hiding/reordering widgets cannot remove them. Add the marker date and earlier-total explanation to NetWorthHistorySheet, and an accessible visible explanation beside the trend chart when history predates the marker. Label manual history input as CAD; preserve existing history editing.
- [ ] Run `npm test -- --run src/components/accounts src/components/dashboard/widgets/NetWorthHistorySheet.test.tsx` and `npm run build`; expect pass. Commit as `feat: add account rate controls and currency review`.

## Task 6: Browser acceptance, backup regression, and final verification

**Files:** Create `e2e/account-currencies.spec.ts`; modify `e2e/seed.ts`, `e2e/mobile-guards.spec.ts`, `e2e/desktop-guards.spec.ts`, and `CHANGELOG.md`. Change existing test fixtures only where the required Account currency field or the explicit new UI states demand it.

- [ ] Make shared guard seed accounts explicit CAD and reviewed, with a support-start marker, so old generic layout tests do not accidentally open the legacy-review workflow. Dedicated feature tests seed actual legacy data separately. Seed a deterministic USD/CAD override and block live FX requests in feature scenarios; tests must not depend on a real provider.
- [ ] Add desktop and explicit narrow viewport scenarios to account-currencies.spec.ts (the existing mobile Playwright projects only match mobile-guards.spec.ts). A basic native/CAD-total scenario:

```ts
import { test, expect } from '@playwright/test'

test('keeps USD balances native and totals in CAD at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.addInitScript(() => {
    const day = new Date().toISOString().split('T')[0]
    localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString())
    localStorage.setItem('accounts-storage', JSON.stringify({ state: {
      accounts: [
        { id: 'cad', name: 'CAD Checking', type: 'bank', value: 1000, currency: 'CAD' },
        { id: 'usd', name: 'USD Savings', type: 'bank', value: 1000, currency: 'USD' },
      ], history: [], pendingCurrencyReviewIds: [], currencySupportStartedAt: day, pendingEditSnapshotDate: null,
    } }))
    localStorage.setItem('ledger-market-data', JSON.stringify({ version: 1, state: {
      quotes: {}, historical: {}, fx: {}, overrides: { [`USD-CAD@${day}`]: 1.35 },
    } }))
  })
  await page.goto('./')
  await expect(page.getByTestId('account-row-usd')).toContainText('USD')
  await expect(page.getByTestId('account-row-usd')).toContainText('1,350.00')
  await expect(page.getByText(/CAD\s*2,350\.00/).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
```

Also exercise desktop create/edit confirmation, legacy all-CAD and USD review, missing-rate snapshot pause, manual recovery, cached-age display, keyboard selection/focus return, and original balances after backup restore. Put a real USD debt in at least one unavailable-rate test so excluded liabilities cannot slip through as a partial total. Compare saved snapshot arrays before/after refresh and account edits.

- [ ] Run `npx playwright test e2e/account-currencies.spec.ts --project=chromium`; expect pass. Verify available preview ports first; do not reuse a server from a different checkout, and never stop another project's server. The configured server is `http://localhost:4173/ledger/`; if occupied, use a temporary Playwright config with matching isolated preview port/baseURL and remove it afterward.
- [ ] Inspect the real dashboard at 320px, 375px, desktop, and tablet widths. Check long names/large balances, selector menu clipping, sheet focus, keyboard actions, visible USD/CAD labels, secondary amount alignment, unavailable totals, and no horizontal scroll. Use browser tools for interaction; save screenshots as review evidence. Do not call offline/mock tests live-provider validation.
- [ ] Add a concise CHANGELOG entry under the unreleased section describing CAD/USD accounts, CAD totals, legacy review, and preserved-history limitation. Do not bump version or deploy as part of this feature.
- [ ] Run `npm run verify` after final implementation changes. This runs lint, all unit tests, build, bundle/eager graph/type-scale checks, and Playwright. Resolve feature regressions and repeat only the affected checks before the final full gate.
- [ ] Review the complete branch diff against all specification acceptance items. If subagent-driven execution is selected, use implementation/review/fix/re-review per task and a final whole-branch review. Commit final tests/docs as `test: verify account currency workflows`, then inspect `git status --short`, `git diff main...HEAD --check`, and run the final verification gate against the committed tree. Report exact checks, browser evidence, and remaining limitations. Do not push, merge, or claim deployment.

## Plan self-review and coverage

| Specification requirement | Tasks |
| --- | --- |
| CAD/USD on all account types, one currency, defaults | 1, 4 |
| Native amounts, USD equivalents, edit confirmation | 4, 6 |
| Complete CAD totals, debt subtraction, goal/trend guards | 1, 3, 4 |
| Shared live/cache/manual rates, age, missing state | 3, 5, 6 |
| Legacy review and cancellation/atomic confirmation | 2, 5, 6 |
| Preserved history/start marker/manual CAD history | 2, 5 |
| Complete daily/edit snapshots, deferred fulfillment | 1, 3, 6 |
| Backups, import normalization, undo | 2, 4, 6 |
| Desktop/mobile/accessibility validation | 4, 5, 6 |

The Forecaster integration in Task 4 is required because its automatic balance consumes the same net worth. It introduces no new forecast inputs or reporting currency.

Execution order is 1 through 6. No task depends on an undefined API. Rate state is shared and nonpersisted; pending edits are persisted with their UTC date so a same-day reload can fulfill them without changing earlier history.
