# v0.7.2 Plan 3: Shared Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark transactions as shared bills (your share counts in the budget, the rest is tracked as an IOU per person), record reimbursements that clear IOUs without inflating income, and show an "Owed to Me" widget.

**Architecture:** `Transaction.amount` keeps meaning "what counts in MY budget", so all existing budget math stays correct with zero changes. Two optional fields (`shared`, `reimbursement`) carry the extra data. IOU balances are derived from transactions by pure selectors in a new `sharedExpenses.ts`. The only aggregate that must change is income totals, which now skip reimbursements via a shared `countsAsIncome` helper.

**Tech Stack:** React 19 + TypeScript, zustand persist, vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-v0.7.2-beta-design.md` section 2
- `amount` on a shared expense is the user's share; `shared.totalAmount` is the full payment; invariant `shared.totalAmount >= amount`
- Reimbursement transactions are `type: 'income'` and are excluded from every income aggregate
- Theme vars for colors, `formatMoney` for currency, no em dashes in copy
- Run `npx tsc -b && npx vitest run` before each commit

---

### Task 1: Data model + derived IOU selectors

**Files:**
- Modify: `src/types/budget.ts`
- Create: `src/utils/budget/sharedExpenses.ts`
- Test: `src/utils/budget/sharedExpenses.test.ts`

**Interfaces:**
- Produces (types on `Transaction`):
  ```ts
  shared?: { totalAmount: number; sharedWith: string }
  reimbursement?: { from: string }
  ```
- Produces (selectors, consumed by Tasks 2-4):
  ```ts
  countsAsIncome(t: Transaction): boolean            // income and not a reimbursement
  iouBalances(transactions: Record<string, Transaction>): Record<string, number>
  sharedPeople(transactions: Record<string, Transaction>): string[]  // unique names, for autocomplete
  ```

- [ ] **Step 1: Extend the Transaction type**

In `src/types/budget.ts` extend the interface:

```ts
export interface Transaction {
  id: string;
  date: string;
  amount: number;
  categoryId?: string;
  description: string;
  type: 'expense' | 'income';
  /** Shared bill: amount is YOUR share; totalAmount is what you actually paid.
   *  The difference is owed to you by sharedWith. */
  shared?: { totalAmount: number; sharedWith: string };
  /** Income that pays back a shared bill; excluded from income totals. */
  reimbursement?: { from: string };
}
```

No store migration needed: optional fields on persisted objects are backward and forward compatible, and the zustand persist version stays 3.

- [ ] **Step 2: Write the failing selector tests**

Create `src/utils/budget/sharedExpenses.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { countsAsIncome, iouBalances, sharedPeople } from './sharedExpenses'
import type { Transaction } from '../../types/budget'

const tx = (partial: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  date: '2026-07-10',
  amount: 0,
  description: '',
  type: 'expense',
  ...partial,
})

describe('sharedExpenses selectors', () => {
  it('countsAsIncome excludes reimbursements', () => {
    expect(countsAsIncome(tx({ type: 'income', amount: 100 }))).toBe(true)
    expect(countsAsIncome(tx({ type: 'income', amount: 100, reimbursement: { from: 'Alex' } }))).toBe(false)
    expect(countsAsIncome(tx({ type: 'expense', amount: 100 }))).toBe(false)
  })

  it('iouBalances sums shared remainders per person minus reimbursements', () => {
    const transactions = {
      a: tx({ id: 'a', amount: 40, shared: { totalAmount: 120, sharedWith: 'Alex' } }),
      b: tx({ id: 'b', amount: 50, shared: { totalAmount: 100, sharedWith: 'Alex' } }),
      c: tx({ id: 'c', amount: 30, shared: { totalAmount: 90, sharedWith: 'Sam' } }),
      d: tx({ id: 'd', type: 'income', amount: 80, reimbursement: { from: 'Alex' } }),
      e: tx({ id: 'e', type: 'income', amount: 500 }), // plain income, ignored
    }
    expect(iouBalances(transactions)).toEqual({ Alex: 50, Sam: 60 })
  })

  it('iouBalances keeps negative balances (overpaid)', () => {
    const transactions = {
      a: tx({ id: 'a', amount: 40, shared: { totalAmount: 100, sharedWith: 'Alex' } }),
      d: tx({ id: 'd', type: 'income', amount: 90, reimbursement: { from: 'Alex' } }),
    }
    expect(iouBalances(transactions)).toEqual({ Alex: -30 })
  })

  it('sharedPeople returns unique names from shared and reimbursement fields', () => {
    const transactions = {
      a: tx({ id: 'a', amount: 40, shared: { totalAmount: 100, sharedWith: 'Alex' } }),
      b: tx({ id: 'b', type: 'income', amount: 10, reimbursement: { from: 'Sam' } }),
      c: tx({ id: 'c', amount: 10, shared: { totalAmount: 20, sharedWith: 'Alex' } }),
    }
    expect(sharedPeople(transactions).sort()).toEqual(['Alex', 'Sam'])
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/utils/budget/sharedExpenses.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement the selectors**

Create `src/utils/budget/sharedExpenses.ts`:

```ts
// Shared-bill IOU tracking, derived from transactions. amount on a shared
// expense is the user's own share; the remainder is owed by sharedWith.

import type { Transaction } from '../../types/budget'

/** Income that should count in income totals (reimbursements do not). */
export function countsAsIncome(t: Transaction): boolean {
  return t.type === 'income' && !t.reimbursement
}

/** Per-person outstanding balance: shared remainders minus reimbursements.
 *  Negative means the person overpaid. */
export function iouBalances(
  transactions: Record<string, Transaction>,
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const t of Object.values(transactions)) {
    if (t.type === 'expense' && t.shared) {
      const owed = t.shared.totalAmount - t.amount
      if (owed !== 0) {
        balances[t.shared.sharedWith] = (balances[t.shared.sharedWith] ?? 0) + owed
      }
    } else if (t.type === 'income' && t.reimbursement) {
      balances[t.reimbursement.from] = (balances[t.reimbursement.from] ?? 0) - t.amount
    }
  }
  return balances
}

/** Unique person names seen on shared bills or reimbursements. */
export function sharedPeople(transactions: Record<string, Transaction>): string[] {
  const names = new Set<string>()
  for (const t of Object.values(transactions)) {
    if (t.shared?.sharedWith) names.add(t.shared.sharedWith)
    if (t.reimbursement?.from) names.add(t.reimbursement.from)
  }
  return [...names]
}
```

- [ ] **Step 5: Run tests, then commit**

Run: `npx vitest run src/utils/budget/sharedExpenses.test.ts`
Expected: PASS.

```bash
git add src/types/budget.ts src/utils/budget/sharedExpenses.ts src/utils/budget/sharedExpenses.test.ts
git commit -m "feat(budget): shared-bill data model and IOU selectors"
```

---

### Task 2: Exclude reimbursements from all income aggregates

**Files:**
- Modify: `src/store/budgetSelectors.ts` (`monthlyIncomeTotal`)
- Modify: `src/store/useBudgetStore.ts` (`getMonthlyBudgetStats`, income branch ~line 271)
- Modify: `src/components/budget/IncomeWidget.tsx`
- Modify: `src/components/budget/MonthlySummaryWidget.tsx`
- Modify: `src/components/budget/SankeyWidget.tsx`
- Modify: `src/components/budget/SpendingHeatmapWidget.tsx` (income markers)

**Interfaces:**
- Consumes: `countsAsIncome` from `../utils/budget/sharedExpenses` (path relative per file)

- [ ] **Step 1: Update each income filter**

Everywhere the pattern `t.type === 'income'` feeds an income total or income display, add the reimbursement guard by switching to `countsAsIncome(t)`:

`src/store/budgetSelectors.ts`:

```ts
import { countsAsIncome } from '../utils/budget/sharedExpenses'

export function monthlyIncomeTotal(
  transactions: Record<string, Transaction>,
  month: string,
): number {
  return Object.values(transactions)
    .filter((t) => countsAsIncome(t) && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0)
}
```

`src/store/useBudgetStore.ts` in `getMonthlyBudgetStats` (income accumulation):

```ts
    } else if (tx.type === 'income') {
      if (!tx.reimbursement) totalIncome += tx.amount;
    }
```

`IncomeWidget.tsx` (line 16): `.filter(t => countsAsIncome(t) && t.date.startsWith(selectedMonth))`

`MonthlySummaryWidget.tsx` (line 20): `.filter(t => countsAsIncome(t))` in the totalIncome chain (keep the month filter above it).

`SankeyWidget.tsx` (line 39): change `if (t.type === 'income')` to `if (t.type === 'income') { if (t.reimbursement) continue; ... }` or restructure:

```ts
    if (t.type === 'income') {
      if (t.reimbursement) continue
      const name = (t.categoryId && categories[t.categoryId]?.name) || 'Other income'
      incomeByCat.set(name, (incomeByCat.get(name) ?? 0) + t.amount)
    } else {
```

`SpendingHeatmapWidget.tsx` (line 21): `if (!countsAsIncome(t) || !t.date.startsWith(selectedMonth)) continue`

- [ ] **Step 2: Verify the whole suite**

Run: `npx tsc -b && npx vitest run`
Expected: PASS (no behavior change for transactions without the new fields).

- [ ] **Step 3: Commit**

```bash
git add src/store/budgetSelectors.ts src/store/useBudgetStore.ts src/components/budget/IncomeWidget.tsx src/components/budget/MonthlySummaryWidget.tsx src/components/budget/SankeyWidget.tsx src/components/budget/SpendingHeatmapWidget.tsx
git commit -m "feat(budget): reimbursements excluded from income aggregates"
```

---

### Task 3: TransactionModal shared/reimbursement controls

**Files:**
- Modify: `src/components/budget/TransactionModal.tsx`

**Interfaces:**
- Consumes: `sharedPeople` from `../../utils/budget/sharedExpenses`; `Transaction.shared` / `Transaction.reimbursement` from Task 1
- Produces: submitted transactions carry the new fields; editing prefills them

- [ ] **Step 1: Add state and prefill**

Add state after the existing fields:

```tsx
const transactions = useBudgetStore((state) => state.transactions);

const [isShared, setIsShared] = useState(false);
const [totalPaid, setTotalPaid] = useState<number>(0);
const [sharedWith, setSharedWith] = useState<string>('');
const [isReimbursement, setIsReimbursement] = useState(false);
const [reimbursementFrom, setReimbursementFrom] = useState<string>('');

const peopleSuggestions = React.useMemo(() => sharedPeople(transactions), [transactions]);
```

In the prefill `useEffect`, inside the `if (initialTransaction)` branch add:

```tsx
setIsShared(!!initialTransaction.shared);
setTotalPaid(initialTransaction.shared?.totalAmount ?? 0);
setSharedWith(initialTransaction.shared?.sharedWith ?? '');
setIsReimbursement(!!initialTransaction.reimbursement);
setReimbursementFrom(initialTransaction.reimbursement?.from ?? '');
```

and in the else branch reset all five to `false / 0 / '' / false / ''`.

- [ ] **Step 2: Render the controls**

After the Amount field block, insert (expense type only):

```tsx
{type === 'expense' && (
  <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
      <input
        type="checkbox"
        checked={isShared}
        onChange={(e) => setIsShared(e.target.checked)}
        className="accent-[var(--color-accent)]"
      />
      Shared bill (I paid for others too)
    </label>
    {isShared && (
      <div className="flex flex-col gap-2 pl-1 border-l-2 border-[var(--color-border)] ml-1">
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Total I paid</label>
        <NumberInput
          value={totalPaid}
          onCommit={setTotalPaid}
          className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          placeholder="0.00"
        />
        <div className="flex gap-2">
          {[0.5, 1 / 3, 0.25].map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAmount(Math.round(totalPaid * f * 100) / 100)}
              className="px-2 py-1 rounded-md text-[12px] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
            >
              My share {['50%', '33%', '25%'][i]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          Amount above is your share; the rest ({formatMoney(Math.max(0, totalPaid - amount))}) is owed to you.
        </p>
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Shared with</label>
        <input
          type="text"
          list="shared-people"
          value={sharedWith}
          onChange={(e) => setSharedWith(e.target.value)}
          className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          placeholder="e.g. Alex, roommates"
        />
        <datalist id="shared-people">
          {peopleSuggestions.map((p) => <option key={p} value={p} />)}
        </datalist>
      </div>
    )}
  </div>
)}
{type === 'income' && (
  <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
      <input
        type="checkbox"
        checked={isReimbursement}
        onChange={(e) => setIsReimbursement(e.target.checked)}
        className="accent-[var(--color-accent)]"
      />
      Reimbursement for a shared bill (not income)
    </label>
    {isReimbursement && (
      <>
        <input
          type="text"
          list="shared-people"
          value={reimbursementFrom}
          onChange={(e) => setReimbursementFrom(e.target.value)}
          className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          placeholder="Who paid you back?"
        />
        <datalist id="shared-people">
          {peopleSuggestions.map((p) => <option key={p} value={p} />)}
        </datalist>
      </>
    )}
  </div>
)}
```

Add imports: `NumberInput` is already imported; add `formatMoney` from `../planner/format` and `sharedPeople` from `../../utils/budget/sharedExpenses`. Note: render the `<datalist>` only once if both branches could coexist; since `type` is exclusive, one at a time is fine.

- [ ] **Step 3: Include the fields on submit**

In `handleSubmit`, build the optional fields and spread into both `updateTransaction` and `addTransaction` payloads:

```tsx
const sharedField =
  type === 'expense' && isShared && totalPaid > amount && sharedWith.trim()
    ? { totalAmount: totalPaid, sharedWith: sharedWith.trim() }
    : undefined;
const reimbursementField =
  type === 'income' && isReimbursement && reimbursementFrom.trim()
    ? { from: reimbursementFrom.trim() }
    : undefined;
```

Payload additions: `shared: sharedField, reimbursement: reimbursementField`. Because `updateTransaction` merges partials, passing `shared: undefined` explicitly is required to clear a previously shared transaction; the store's spread (`{ ...old, ...updates }`) keeps an explicit `undefined`, which is fine for our selectors (`t.shared` is falsy).

- [ ] **Step 4: Verify and commit**

Run: `npx tsc -b && npx vitest run`
Expected: PASS (TransactionModal.test.tsx must still pass; if it snapshots the form, update the snapshot).

Browser: add an expense of 120 total, share 50% with "Alex": transaction saved with amount 60; Expenses widget counts 60.

```bash
git add src/components/budget/TransactionModal.tsx
git commit -m "feat(budget): shared bill and reimbursement controls in transaction modal"
```

---

### Task 4: Owed to Me widget + list badges

**Files:**
- Create: `src/components/budget/OwedToMeWidget.tsx`
- Modify: `src/pages/Budgeting.tsx` (Overview tab)
- Modify: `src/components/budget/TransactionListWidget.tsx` (badges)

**Interfaces:**
- Consumes: `iouBalances`, from Task 1; `useBudgetStore` `transactions` + `addTransaction`; `ConfirmDialog`
- Produces: `OwedToMeWidget` React component (no props)

- [ ] **Step 1: Create the widget**

Create `src/components/budget/OwedToMeWidget.tsx`:

```tsx
import React, { useState } from 'react'
import { HandCoins } from 'lucide-react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { iouBalances } from '../../utils/budget/sharedExpenses'
import { formatMoney } from '../planner/format'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/** All-time per-person balances from shared bills. Hidden when empty. */
export const OwedToMeWidget: React.FC = () => {
  const transactions = useBudgetStore((s) => s.transactions)
  const addTransaction = useBudgetStore((s) => s.addTransaction)
  const [settling, setSettling] = useState<{ person: string; amount: number } | null>(null)

  const balances = Object.entries(iouBalances(transactions))
    .filter(([, v]) => Math.abs(v) >= 0.005)
    .sort((a, b) => b[1] - a[1])

  if (balances.length === 0) return null

  return (
    <WidgetWrapper title="Owed to Me">
      <div className="flex flex-col gap-2 mt-2">
        {balances.map(([person, balance]) => (
          <div key={person} className="flex justify-between items-center text-[13px]">
            <span className="text-text-primary flex items-center gap-2">
              <HandCoins size={14} className="text-accent" /> {person}
            </span>
            <span className="flex items-center gap-2">
              <span className={`font-medium ${balance >= 0 ? 'text-text-primary' : 'text-error'}`}>
                {balance >= 0 ? formatMoney(balance) : `${formatMoney(-balance)} overpaid`}
              </span>
              {balance > 0 && (
                <button
                  onClick={() => setSettling({ person, amount: balance })}
                  className="px-2 py-1 rounded-md text-[12px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
                >
                  Settle up
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={settling !== null}
        title="Settle up?"
        message={settling ? `Record a ${formatMoney(settling.amount)} reimbursement from ${settling.person}, clearing their balance.` : ''}
        confirmLabel="Record reimbursement"
        onConfirm={() => {
          if (settling) {
            addTransaction({
              id: crypto.randomUUID(),
              date: new Date().toISOString().split('T')[0],
              amount: Math.round(settling.amount * 100) / 100,
              description: `Settle up from ${settling.person}`,
              type: 'income',
              reimbursement: { from: settling.person },
            })
          }
          setSettling(null)
        }}
        onCancel={() => setSettling(null)}
      />
    </WidgetWrapper>
  )
}
```

- [ ] **Step 2: Mount it on the Overview tab**

In `src/pages/Budgeting.tsx`: `import { OwedToMeWidget } from '../components/budget/OwedToMeWidget';` and inside the `tab === 'overview'` fragment, after the BudgetProgress/Sankey grid, add:

```tsx
<OwedToMeWidget />
```

- [ ] **Step 3: Badges in the transaction list**

In `src/components/budget/TransactionListWidget.tsx`, extend `getTransactionDisplay`:

```tsx
const getTransactionDisplay = (tx: Transaction) => ({
  amountClass: tx.type === 'income' ? 'text-accent' : 'text-text-primary',
  amountPrefix: tx.type === 'income' ? '+' : '-',
  categoryLabel: tx.categoryId ? categories[tx.categoryId]?.name || 'Unknown' : 'Uncategorized',
  badge: tx.shared
    ? `shared · ${tx.shared.sharedWith}`
    : tx.reimbursement
      ? `reimb · ${tx.reimbursement.from}`
      : null,
});
```

In the desktop table row, after the category `<span>` inside the same `<td>`, and in the mobile card next to the category span, render:

```tsx
{badge && (
  <span className="ml-1 px-2 py-1 bg-accent/10 text-accent rounded-md text-[12px]">{badge}</span>
)}
```

(destructure `badge` alongside the other fields at both call sites).

- [ ] **Step 4: Verify and commit**

Run: `npx tsc -b && npx vitest run`
Expected: PASS.

Browser: with the Task 3 shared transaction, Overview shows "Owed to Me: Alex $60" with Settle up; settling creates the reimbursement, balance disappears, Income widget total does NOT change.

```bash
git add src/components/budget/OwedToMeWidget.tsx src/pages/Budgeting.tsx src/components/budget/TransactionListWidget.tsx
git commit -m "feat(budget): owed-to-me widget with settle-up and shared badges"
```

---

## Self-Review Checklist

- Spec section 2 covered: model (T1), budget math via amount-as-share (no change needed, by design), income exclusion (T2), modal controls incl. quick share buttons and autocomplete (T3), per-person widget + settle-up + mark-imports-as-reimbursement (T3 income branch covers imported transactions opened for edit; T4 widget).
- Triage badge from spec ("triage inbox rows show a badge"): triage transactions cannot be shared before approval (no shared field on TriageTransaction); marking happens on edit after approval. This is a deliberate simplification; the list badge covers visibility.
- Type names consistent: `shared.totalAmount`, `shared.sharedWith`, `reimbursement.from` everywhere.
