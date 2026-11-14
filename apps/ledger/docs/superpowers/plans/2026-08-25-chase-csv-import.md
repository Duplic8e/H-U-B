# Chase Credit Card CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import Chase credit card activity CSVs correctly, treating bill payments as flagged non-income and refunds as negative expenses.

**Architecture:** A new entry in the existing `PARSERS` array in `src/utils/csvParser.ts` recognizes the Chase header shape and routes each row by its `Type` column. Card payments carry a new triage-only `flag` field that mirrors the existing `duplicate` mechanism end to end. Refunds are stored as expense transactions with a negative amount, which every spend aggregation already handles arithmetically, so the remaining work is confined to six display and validation sites.

**Tech Stack:** React 19, TypeScript, Zustand (with `persist`), PapaParse, Vitest + @testing-library/react, Tailwind 4.

## Global Constraints

- Do not use em dashes in any code comment, commit message, changelog entry or UI copy.
- Ships as **v0.9.6-beta**. Current version in `package.json` is `0.9.5-beta`.
- Test runner is Vitest. Run a single file with `npx vitest run <path>`; a single test with `npx vitest run <path> -t "<test name>"`. `npm test` alone starts watch mode, so always pass `run`.
- Every test covering **new** behavior must be shown failing before it is made to pass. A step that says "run the test to verify it fails" is not optional, and its stated expected failure must actually be observed. If a test of new behavior passes on the first run, the guard is not testing what it claims and must be fixed before proceeding.
- Tests explicitly labelled as **regression guards for existing behavior** are expected to pass immediately. That is their purpose: they pin behavior a refactor in the same task must not break. Each task below names which of its tests are regression guards. Report them as such; do not delete or rewrite them to manufacture a failure.
- Duplicate detection in `src/utils/budget/importDedupe.ts` is **out of scope**. Do not modify it or its tests.
- Splits on negative transactions are **out of scope**. Do not add support for them.
- Follow the surrounding file's existing conventions. `src/utils/budget/*.ts` files omit semicolons; `src/components/budget/*.tsx` files use them. Match whichever file you are editing.

---

### Task 1: Chase parser

**Files:**
- Modify: `src/types/triage.ts` (add the `flag` field)
- Modify: `src/utils/csvParser.ts` (add a `decodeEntities` helper and a new entry to the `PARSERS` array, before the `Standard Ledger CSV` entry)
- Create: `src/utils/csvParser.test.ts`

**Interfaces:**
- Consumes: the existing `BankParserConfig`, `CsvRow` and `CsvHeaderlessRow` types already exported from `src/utils/csvParser.ts`.
- Produces:
  - `TriageTransaction.flag?: 'card-payment'` in `src/types/triage.ts`, used by Tasks 3 and 4.
  - A `PARSERS` entry with `name: 'Chase Credit Card'`, found by later tests via `PARSERS.find(p => p.name === 'Chase Credit Card')`.

**Background:** `PARSERS` is an ordered array and `parseCSV` picks the first entry whose `detect` returns true. The existing `Standard Ledger CSV` entry matches any file with `Date`, `Amount` and `Description` headers, so the Chase entry must be inserted **before** it. Chase has `Transaction Date`, not `Date`, so today it matches nothing and falls through to the manual mapping dialog. The existing `Download Transactions (Visa)` entry also keys on `Transaction Date` but additionally requires a `CAD$` header, which Chase files do not have, so there is no conflict.

Note that `src/types/triage.ts` contains a second, stale `BankParserConfig` interface that nothing imports. Leave it alone; removing it is not part of this work.

- [ ] **Step 1: Add the `flag` field to the triage type**

In `src/types/triage.ts`, inside `interface TriageTransaction`, after the existing `duplicate` field, add:

```typescript
  /** Set at import time for rows that are not real income or spending, such as
   *  a credit card bill payment. Flagged rows are held back from bulk accept. */
  flag?: 'card-payment';
```

- [ ] **Step 2: Write the failing tests**

Create `src/utils/csvParser.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { PARSERS } from './csvParser'

const CHASE_HEADERS = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo']

const chase = () => {
  const p = PARSERS.find((x) => x.name === 'Chase Credit Card')
  if (!p) throw new Error('Chase Credit Card parser not registered')
  return p
}

const row = (over: Record<string, string> = {}) => ({
  'Transaction Date': '08/22/2026',
  'Post Date': '08/23/2026',
  Description: 'LIDL #1590',
  Category: 'Groceries',
  Type: 'Sale',
  Amount: '-4.29',
  Memo: '',
  ...over,
})

describe('Chase Credit Card parser detection', () => {
  it('detects the Chase header shape', () => {
    expect(chase().detect(CHASE_HEADERS, row())).toBe(true)
  })

  it('does not claim a Visa download file', () => {
    const visa = ['Account Type', 'Transaction Date', 'Description 1', 'CAD$']
    expect(chase().detect(visa, undefined)).toBe(false)
  })

  it('is registered ahead of Standard Ledger CSV', () => {
    const chaseIdx = PARSERS.findIndex((p) => p.name === 'Chase Credit Card')
    const stdIdx = PARSERS.findIndex((p) => p.name === 'Standard Ledger CSV')
    expect(chaseIdx).toBeGreaterThanOrEqual(0)
    expect(chaseIdx).toBeLessThan(stdIdx)
  })
})

describe('Chase Credit Card parser rows', () => {
  it('converts the transaction date and ignores the post date', () => {
    expect(chase().parse(row())?.date).toBe('2026-08-22')
  })

  it('reads a Sale as a positive expense', () => {
    const r = chase().parse(row())
    expect(r?.type).toBe('expense')
    expect(r?.amount).toBe(4.29)
  })

  it('reads a Return as a negative expense', () => {
    const r = chase().parse(
      row({ Description: 'AMAZON MKTPLACE PMTS', Category: 'Shopping', Type: 'Return', Amount: '39.99' }),
    )
    expect(r?.type).toBe('expense')
    expect(r?.amount).toBe(-39.99)
  })

  it('flags a Payment instead of importing it as plain income', () => {
    const r = chase().parse(
      row({ Description: 'Payment Thank You-Mobile', Category: '', Type: 'Payment', Amount: '50.00' }),
    )
    expect(r?.type).toBe('income')
    expect(r?.amount).toBe(50)
    expect(r?.flag).toBe('card-payment')
  })

  it('falls back to the sign for an unrecognized Type rather than dropping the row', () => {
    const r = chase().parse(row({ Type: 'Fee', Amount: '-1.50' }))
    expect(r?.type).toBe('expense')
    expect(r?.amount).toBe(1.5)
    expect(r?.flag).toBeUndefined()
  })

  it('decodes HTML entities in the description', () => {
    expect(chase().parse(row({ Description: 'H&amp;M  0500NEW YORK' }))?.description).toBe('H&M  0500NEW YORK')
  })

  it('returns null when the amount is not a number', () => {
    expect(chase().parse(row({ Amount: '' }))).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/utils/csvParser.test.ts`

Expected: every test fails. The `chase()` helper throws `Chase Credit Card parser not registered`, because no such entry exists yet.

- [ ] **Step 4: Add the entity decoder**

In `src/utils/csvParser.ts`, after the `import` statements and before `export type CsvRow`, add:

```typescript
/** Chase escapes a handful of characters in merchant names, so `H&M` arrives as
 *  `H&amp;M`. Only the entities Chase actually emits are handled; this is
 *  deliberately not a general HTML parser. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
```

The `&amp;` replacement is deliberately last, so a doubly escaped `&amp;lt;` does not collapse all the way to `<`.

- [ ] **Step 5: Add the parser entry**

In `src/utils/csvParser.ts`, insert this object into the `PARSERS` array immediately **before** the `Standard Ledger CSV` entry:

```typescript
  {
    name: 'Chase Credit Card',
    // Headers: Transaction Date,Post Date,Description,Category,Type,Amount,Memo
    detect: (headers) =>
      headers.includes('Transaction Date') && headers.includes('Post Date') && headers.includes('Type'),
    parse: (row) => {
      if (Array.isArray(row)) return null;
      const amountRaw = parseFloat(row['Amount']);
      if (isNaN(amountRaw)) return null;

      let date = row['Transaction Date'];
      if (date && date.includes('/')) {
        const [m, d, y] = date.split('/');
        date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      const description = decodeEntities(row['Description']?.trim() || 'Unknown');
      const chaseType = row['Type'];

      // A card bill payment is a transfer between the user's own accounts, so it
      // is flagged rather than counted as earnings. A refund is money returning
      // to the category it left, so it is a negative expense rather than income.
      if (chaseType === 'Payment') {
        return {
          date,
          amount: Math.abs(amountRaw),
          description,
          type: 'income' as const,
          flag: 'card-payment' as const,
          originalRowData: row,
        };
      }
      if (chaseType === 'Return') {
        return { date, amount: -Math.abs(amountRaw), description, type: 'expense' as const, originalRowData: row };
      }

      return {
        date,
        amount: Math.abs(amountRaw),
        description,
        type: amountRaw > 0 ? ('income' as const) : ('expense' as const),
        originalRowData: row,
      };
    }
  },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/utils/csvParser.test.ts`

Expected: PASS, 10 tests.

- [ ] **Step 7: Verify no other parser regressed**

Run: `npx vitest run src/utils src/components/budget`

Expected: PASS. If `CSVUploader.test.tsx` fails, the Chase entry was inserted in the wrong position; confirm it sits before `Standard Ledger CSV`.

- [ ] **Step 8: Commit**

```bash
git add src/utils/csvParser.ts src/utils/csvParser.test.ts src/types/triage.ts
git commit -m "feat(import): parse Chase credit card activity CSVs"
```

---

### Task 2: Chase category fallback

**Files:**
- Create: `src/utils/budget/chaseCategoryMap.ts`
- Create: `src/utils/budget/chaseCategoryMap.test.ts`
- Modify: `src/components/budget/CSVUploader.tsx` (the `handleTransactions` categorize step, around line 28)
- Modify: `src/components/budget/CSVUploader.test.tsx` (append one test)

**Interfaces:**
- Consumes: `Category` from `src/types/budget.ts`; `TriageTransaction.originalRowData` from `src/types/triage.ts`.
- Produces: `chaseCategoryId(chaseCategory: string | undefined, categories: Record<string, Category>): string | undefined`, used only by `CSVUploader`.

**Background:** `guessCategory` in `src/utils/autoCategorize.ts` matches the user's own learned substring rules and returns `undefined` on a miss. The Chase column is a fallback consulted only on that miss, so the user's deliberate rules always win over Chase's guess. Resolution is by category **name** against whatever categories currently exist, so renaming or deleting a category degrades to a miss rather than to a wrong assignment. Do not modify `guessCategory`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/budget/chaseCategoryMap.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import type { Category } from '../../types/budget'
import { chaseCategoryId } from './chaseCategoryMap'

const cats: Record<string, Category> = {
  c1: { id: 'c1', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
  c2: { id: 'c2', groupId: 'g1', name: 'Takeout', targetAmount: 0 },
}

describe('chaseCategoryId', () => {
  it('maps a Chase category to the ledger category of the same name', () => {
    expect(chaseCategoryId('Groceries', cats)).toBe('c1')
  })

  it('maps Food & Drink to Takeout', () => {
    expect(chaseCategoryId('Food & Drink', cats)).toBe('c2')
  })

  it('returns undefined for a Chase category with no mapping', () => {
    expect(chaseCategoryId('Health & Wellness', cats)).toBeUndefined()
  })

  it('returns undefined when the mapped ledger category does not exist', () => {
    expect(chaseCategoryId('Travel', cats)).toBeUndefined()
  })

  it('returns undefined for an empty or missing Chase category', () => {
    expect(chaseCategoryId('', cats)).toBeUndefined()
    expect(chaseCategoryId(undefined, cats)).toBeUndefined()
  })

  it('matches the ledger category name case-insensitively', () => {
    const renamed: Record<string, Category> = {
      c1: { id: 'c1', groupId: 'g1', name: 'groceries', targetAmount: 0 },
    }
    expect(chaseCategoryId('Groceries', renamed)).toBe('c1')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/budget/chaseCategoryMap.test.ts`

Expected: FAIL, cannot resolve `./chaseCategoryMap`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/budget/chaseCategoryMap.ts`:

```typescript
import type { Category } from '../../types/budget'

/** Chase's own category column, mapped onto the names of the default ledger
 *  categories. Health & Wellness is deliberately absent: no default category
 *  fits it, and a wrong guess is worse than leaving the row uncategorized. */
const CHASE_TO_LEDGER: Record<string, string> = {
  Groceries: 'Groceries',
  'Food & Drink': 'Takeout',
  Travel: 'Transportation',
  Shopping: 'Personal',
  Entertainment: 'Night Out',
  'Gifts & Donations': 'Gifts',
}

/** The id of the ledger category Chase's category suggests, or undefined.
 *
 *  Resolution is by name against the categories that exist right now, so a
 *  category the user renamed or deleted simply misses instead of resolving to
 *  something they did not intend. */
export function chaseCategoryId(
  chaseCategory: string | undefined,
  categories: Record<string, Category>,
): string | undefined {
  if (!chaseCategory) return undefined
  const targetName = CHASE_TO_LEDGER[chaseCategory]
  if (!targetName) return undefined
  const wanted = targetName.toLowerCase()
  return Object.values(categories).find((c) => c.name.toLowerCase() === wanted)?.id
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/budget/chaseCategoryMap.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit the helper**

```bash
git add src/utils/budget/chaseCategoryMap.ts src/utils/budget/chaseCategoryMap.test.ts
git commit -m "feat(import): map Chase categories onto ledger categories"
```

- [ ] **Step 6: Write the failing wiring test**

Append to `src/components/budget/CSVUploader.test.tsx`. This file already imports `useBudgetStore`, `useTriageStore`, `parseCSV`, `render`, `fireEvent`, `waitFor` and `vi`, so no new imports are needed.

```typescript
describe('CSVUploader Chase category fallback', () => {
  it('uses the Chase category only when no learned rule matches', async () => {
    useBudgetStore.setState({
      ...useBudgetStore.getState(),
      categories: {
        cg: { id: 'cg', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        cp: { id: 'cp', groupId: 'g1', name: 'Personal', targetAmount: 0 },
      },
    })
    useTriageStore.setState({ pendingTransactions: {}, categoryRules: { lidl: 'cp' } })

    vi.mocked(parseCSV).mockResolvedValueOnce([
      {
        id: 'r1', date: '2026-08-22', amount: 4.29, description: 'LIDL #1590', type: 'expense',
        originalRowData: { Category: 'Groceries' },
      },
      {
        id: 'r2', date: '2026-08-22', amount: 11.38, description: 'TARGET T-3284', type: 'expense',
        originalRowData: { Category: 'Shopping' },
      },
    ])

    render(<CSVUploader />)
    const file = new File(['x'], 'chase.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      const pending = useTriageStore.getState().pendingTransactions
      // The learned "lidl" rule wins over Chase's own Groceries category.
      expect(pending['r1'].categoryId).toBe('cp')
      // No rule matches TARGET, so Chase's Shopping maps to Personal.
      expect(pending['r2'].categoryId).toBe('cp')
    })
  })
})
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run src/components/budget/CSVUploader.test.tsx -t "uses the Chase category only when no learned rule matches"`

Expected: FAIL. `pending['r2'].categoryId` is `undefined`, because the fallback is not wired in yet.

- [ ] **Step 8: Wire the fallback into CSVUploader**

In `src/components/budget/CSVUploader.tsx`, add the import beside the existing `guessCategory` import:

```typescript
import { chaseCategoryId } from '../../utils/budget/chaseCategoryMap';
```

Then replace the `categorized` map inside `handleTransactions` with:

```typescript
    const categorized = transactions.map(tx => {
      // The user's own learned rules are deliberate, so they win. Chase's own
      // category column is consulted only where no rule matched.
      const categoryId =
        guessCategory(tx.description, categories, categoryRules) ??
        chaseCategoryId(tx.originalRowData?.['Category'], categories);
      return {
        ...tx,
        categoryId
      };
    });
```

Delete the stale `// NOTE: guessCategory will be updated to take categoryRules shortly.` comment, which no longer describes anything true.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/components/budget/CSVUploader.test.tsx`

Expected: PASS, all tests in the file.

- [ ] **Step 10: Commit**

```bash
git add src/components/budget/CSVUploader.tsx src/components/budget/CSVUploader.test.tsx
git commit -m "feat(import): fall back to the Chase category when no rule matches"
```

---

### Task 3: Hold flagged rows back from bulk accept

**Files:**
- Modify: `src/store/useTriageStore.ts` (the `TriageState` interface, `approveAll`, and a new `rejectCardPayments`)
- Create: `src/store/useTriageStore.test.ts`

**Interfaces:**
- Consumes: `TriageTransaction.flag?: 'card-payment'` from Task 1.
- Produces: `rejectCardPayments: () => void` on the triage store, used by Task 4. `approveAll` keeps its existing `() => string[]` signature.

**Background:** `approveAll` already filters out rows where `tx.duplicate` is set. Flagged rows get the same treatment, so a card payment is never swept into the budget by a bulk accept. `rejectCardPayments` mirrors the existing `rejectDuplicates` exactly. A flagged row keeps its individual accept path, so a payment can still be imported deliberately.

- [ ] **Step 1: Write the failing tests**

Create `src/store/useTriageStore.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { useTriageStore } from './useTriageStore'
import { useBudgetStore } from './useBudgetStore'

const triageInitial = useTriageStore.getState()
const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  useTriageStore.setState(triageInitial, true)
  useBudgetStore.setState(budgetInitial, true)
})

const seed = () =>
  useTriageStore.setState({
    pendingTransactions: {
      a: { id: 'a', date: '2026-08-22', amount: 4.29, description: 'LIDL', type: 'expense' },
      b: {
        id: 'b', date: '2026-08-21', amount: 50, description: 'Payment Thank You-Mobile',
        type: 'income', flag: 'card-payment',
      },
    },
  })

describe('triage store card payment flag', () => {
  it('holds flagged rows back from approveAll', () => {
    seed()
    const approved = useTriageStore.getState().approveAll()
    expect(approved).toEqual(['a'])
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['b'])
    expect(useBudgetStore.getState().transactions['b']).toBeUndefined()
  })

  it('still approves a flagged row individually', () => {
    seed()
    useTriageStore.getState().approveTransaction('b')
    expect(useBudgetStore.getState().transactions['b']).toBeDefined()
  })

  it('rejectCardPayments clears only the flagged rows', () => {
    seed()
    useTriageStore.getState().rejectCardPayments()
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/store/useTriageStore.test.ts`

Expected: `holds flagged rows back from approveAll` FAILS because `approved` is `['a', 'b']`. `rejectCardPayments clears only the flagged rows` FAILS because the function does not exist. `still approves a flagged row individually` passes already, and is present as a regression guard.

- [ ] **Step 3: Declare the new action**

In `src/store/useTriageStore.ts`, in the `TriageState` interface, add below `rejectDuplicates`:

```typescript
  /** Clears every row flagged as not real income or spending, such as a credit
   *  card bill payment. */
  rejectCardPayments: () => void;
```

Also update the doc comment above `approveAll` to read:

```typescript
  /** Approves every row that is neither flagged as a duplicate nor held back by
   *  a flag. Returns the ids it approved, so the caller can offer to undo the
   *  batch. */
```

- [ ] **Step 4: Implement the change**

In `src/store/useTriageStore.ts`, inside `approveAll`, change the filter line to:

```typescript
        const txs = Object.values(state.pendingTransactions).filter((tx) => !tx.duplicate && !tx.flag);
```

Then add the new action immediately after `rejectDuplicates`:

```typescript
      rejectCardPayments: () =>
        set((state) => ({
          pendingTransactions: Object.fromEntries(
            Object.entries(state.pendingTransactions).filter(([, tx]) => tx.flag !== 'card-payment'),
          ),
        })),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/store/useTriageStore.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/store/useTriageStore.ts src/store/useTriageStore.test.ts
git commit -m "feat(triage): hold card payments back from bulk accept"
```

---

### Task 4: Card payment badge and bulk reject button

**Files:**
- Modify: `src/components/budget/TriageInboxWidget.tsx` (the store selectors near line 17, the counts at lines 31-32, `handleAcceptAll` at line 35, the header buttons at lines 52-64, and the badge at lines 74-80)
- Modify: `src/components/budget/TriageInboxWidget.test.tsx` (append tests)

**Interfaces:**
- Consumes: `rejectCardPayments` from Task 3; `TriageTransaction.flag` from Task 1.
- Produces: nothing consumed by later tasks.

**Background:** The widget already renders a duplicate badge in the date line and already offers a `Reject N duplicates` header button. The flag badge and button sit alongside them using the same structure, so a row can carry both a duplicate badge and a flag badge at once.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/budget/TriageInboxWidget.test.tsx`. The file already imports `render`, `screen`, `fireEvent`, `useTriageStore` and `useBudgetStore`, and resets both stores in a `beforeEach`.

```typescript
describe('TriageInboxWidget card payments', () => {
  const seedFlagged = () =>
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-22', amount: 4.29, description: 'LIDL', type: 'expense' },
        b: {
          id: 'b', date: '2026-08-21', amount: 50, description: 'Payment Thank You-Mobile',
          type: 'income', flag: 'card-payment',
        },
      },
    })

  it('badges a flagged row', () => {
    seedFlagged()
    render(<TriageInboxWidget />)
    expect(screen.getByText('card payment, not income')).toBeInTheDocument()
  })

  it('excludes flagged rows from the accept all count', () => {
    seedFlagged()
    render(<TriageInboxWidget />)
    expect(screen.getByRole('button', { name: /Accept All \(1\)/ })).toBeInTheDocument()
  })

  it('rejects only the flagged rows via the header button', () => {
    seedFlagged()
    render(<TriageInboxWidget />)
    fireEvent.click(screen.getByRole('button', { name: 'Reject 1 card payment' }))
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['a'])
  })

  it('offers no card payment button when nothing is flagged', () => {
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-22', amount: 4.29, description: 'LIDL', type: 'expense' },
      },
    })
    render(<TriageInboxWidget />)
    expect(screen.queryByRole('button', { name: /card payment/ })).not.toBeInTheDocument()
  })

  it('counts a row that is both duplicate and flagged only once', () => {
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-22', amount: 4.29, description: 'LIDL', type: 'expense' },
        b: {
          id: 'b', date: '2026-08-21', amount: 50, description: 'Payment Thank You-Mobile',
          type: 'income', flag: 'card-payment', duplicate: 'exact',
        },
      },
    })
    render(<TriageInboxWidget />)
    expect(screen.getByRole('button', { name: /Accept All \(1\)/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/budget/TriageInboxWidget.test.tsx -t "card payments"`

Expected: FAIL. The badge text is not found, the accept count reads 2, and the reject button does not exist. The `counts a row that is both duplicate and flagged only once` case would read 0 under a naive subtraction, which is exactly what Step 4 avoids.

- [ ] **Step 3: Read the new action from the store**

In `src/components/budget/TriageInboxWidget.tsx`, beside the existing `rejectDuplicates` selector, add:

```typescript
  const rejectCardPayments = useTriageStore((state) => state.rejectCardPayments);
```

- [ ] **Step 4: Update the counts and bulk accept**

Replace the two lines computing `duplicates` and `acceptableCount` with:

```typescript
  const duplicates = txList.filter((tx) => tx.duplicate);
  const cardPayments = txList.filter((tx) => tx.flag === 'card-payment');
  // Recomputed from the list rather than subtracted, because one row can be both
  // a duplicate and flagged, and subtracting both counts would double-count it.
  const acceptableCount = txList.filter((tx) => !tx.duplicate && !tx.flag).length;
```

In `handleAcceptAll`, change the `rows` line so the undo snapshot matches what the store actually approves:

```typescript
    const rows = txList.filter((tx) => !tx.duplicate && !tx.flag);
```

- [ ] **Step 5: Add the header button**

Immediately after the existing `{duplicates.length > 0 && (...)}` block, add:

```tsx
        {cardPayments.length > 0 && (
          <button
            onClick={rejectCardPayments}
            className="text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors border border-border px-2 py-1 rounded-md"
          >
            Reject {cardPayments.length} card payment{cardPayments.length === 1 ? '' : 's'}
          </button>
        )}
```

- [ ] **Step 6: Add the badge**

First check which color tokens exist:

Run: `grep -rn "text-warning\|bg-warning" src/index.css src/**/*.tsx | head`

If `warning` tokens exist, add this in the date line, immediately after the existing `{tx.duplicate && (...)}` block and still inside the same `<p>`:

```tsx
                  {tx.flag === 'card-payment' && (
                    <span className="ml-2 px-2 py-0.5 rounded-md text-meta bg-warning/10 text-warning">
                      card payment, not income
                    </span>
                  )}
```

If they do not exist, use the same `bg-error/10 text-error` pair the duplicate badge already uses rather than introducing a new color token, and say which you chose in the commit body.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/components/budget/TriageInboxWidget.test.tsx`

Expected: PASS, all tests in the file including the pre-existing duplicate tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/budget/TriageInboxWidget.tsx src/components/budget/TriageInboxWidget.test.tsx
git commit -m "feat(triage): badge card payments and offer to reject them"
```

---

### Task 5: Render negative expense amounts correctly

**Files:**
- Modify: `src/components/budget/TriageInboxWidget.tsx:83`
- Modify: `src/components/budget/TransactionListWidget.tsx:174`, `:340`, `:394`, `:431`, `:464`
- Modify: `src/components/budget/MonthlySummaryWidget.tsx:37`
- Modify: `src/components/budget/TriageInboxWidget.test.tsx` and `src/components/budget/TransactionListWidget.test.tsx` (append tests)

**Interfaces:**
- Consumes: the negative amounts Task 1 produces.
- Produces: nothing consumed by later tasks.

**Background:** `formatMoney` in `src/components/planner/format.ts` rounds to whole dollars and already emits its own leading minus for a negative input. Three sites prepend a second sign by hand, so a refund of `-39.99` currently renders `-$-40`.

**The intended result:** an ordinary expense of `21.31` renders `-$21`, and a refund of `-39.99` renders `$40` with no sign. Formatting `-tx.amount` gives both from one expression. Showing a refund as a positive figure among negative ones is the point: it is money coming back.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/budget/TriageInboxWidget.test.tsx`:

```typescript
describe('TriageInboxWidget negative expenses', () => {
  it('renders a refund as a positive figure rather than a double minus', () => {
    useTriageStore.setState({
      pendingTransactions: {
        r: { id: 'r', date: '2026-08-15', amount: -39.99, description: 'AMAZON MKTPLACE PMTS', type: 'expense' },
      },
    })
    render(<TriageInboxWidget />)
    expect(screen.getByText('$40')).toBeInTheDocument()
    expect(screen.queryByText('-$-40')).not.toBeInTheDocument()
  })

  it('still renders an ordinary expense with a minus sign', () => {
    useTriageStore.setState({
      pendingTransactions: {
        e: { id: 'e', date: '2026-08-15', amount: 21.31, description: 'TST FIG 19', type: 'expense' },
      },
    })
    render(<TriageInboxWidget />)
    expect(screen.getByText('-$21')).toBeInTheDocument()
  })

  it('still renders income with a plus sign', () => {
    useTriageStore.setState({
      pendingTransactions: {
        i: { id: 'i', date: '2026-08-15', amount: 100, description: 'PAYROLL', type: 'income' },
      },
    })
    render(<TriageInboxWidget />)
    expect(screen.getByText('+$100')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/budget/TriageInboxWidget.test.tsx -t "negative expenses"`

Expected: `renders a refund as a positive figure rather than a double minus` FAILS, because the rendered text is `-$-40`. The other two PASS already, as regression guards.

- [ ] **Step 3: Fix the triage widget**

In `src/components/budget/TriageInboxWidget.tsx`, replace the amount line:

```tsx
                {tx.type === 'income' ? `+${formatMoney(tx.amount)}` : formatMoney(-tx.amount)}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/budget/TriageInboxWidget.test.tsx`

Expected: PASS, all tests in the file.

- [ ] **Step 5: Write the failing transaction list test**

Read the top of `src/components/budget/TransactionListWidget.test.tsx` first and reuse whatever seeding helper and imports it already has. Append:

```typescript
describe('TransactionListWidget negative expenses', () => {
  it('renders a refund without a double minus', () => {
    useBudgetStore.setState({
      ...useBudgetStore.getState(),
      transactions: {
        r: {
          id: 'r', date: '2026-08-15', amount: -39.99, description: 'AMAZON MKTPLACE PMTS',
          type: 'expense', categoryId: '',
        },
      },
    })
    render(<TransactionListWidget />)
    expect(screen.queryByText('-$-40')).not.toBeInTheDocument()
    expect(screen.getAllByText('$40').length).toBeGreaterThan(0)
  })
})
```

`getAllByText` is used because this widget renders both a table layout and a card layout, so the same amount can legitimately appear twice.

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/components/budget/TransactionListWidget.test.tsx -t "negative expenses"`

Expected: FAIL, the rendered text is `-$-40`.

- [ ] **Step 7: Fix the transaction list**

`getTransactionDisplay` returns an `amountPrefix` consumed at lines 394 and 464. Replace the prefix with a fully formatted string so both call sites stay in sync and cannot drift.

In the object returned by `getTransactionDisplay`, delete the `amountPrefix` line and add:

```typescript
    amountText: tx.type === 'income' ? `+${formatMoney(tx.amount)}` : formatMoney(-tx.amount),
```

At both destructuring sites (lines 340 and 431), replace `amountPrefix` with `amountText`. At both render sites (lines 394 and 464), replace:

```tsx
                      {amountPrefix}{formatMoney(tx.amount)}
```

with:

```tsx
                      {amountText}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/components/budget/TransactionListWidget.test.tsx`

Expected: PASS, all tests in the file.

- [ ] **Step 9: Fix the monthly summary forecast text**

In `src/components/budget/MonthlySummaryWidget.tsx`, replace the `pendingSummary` map line:

```typescript
    .map((p) => `${p.expectedDate}: ${p.type === 'income' ? `+${formatMoney(p.amount)}` : formatMoney(-p.amount)} ${p.description}`)
```

This string is a tooltip listing forecast rows. Check whether a test file exists:

Run: `ls src/components/budget/MonthlySummaryWidget.test.tsx`

If it exists and already seeds transactions, add a guard there matching its conventions. If it does not exist, do not create one for a tooltip string; the behavior is covered by the shared `formatMoney` guards above.

- [ ] **Step 10: Run the full budget component suite**

Run: `npx vitest run src/components/budget`

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/budget/TriageInboxWidget.tsx src/components/budget/TriageInboxWidget.test.tsx src/components/budget/TransactionListWidget.tsx src/components/budget/TransactionListWidget.test.tsx src/components/budget/MonthlySummaryWidget.tsx
git commit -m "fix(budget): render negative expense amounts without a double minus"
```

---

### Task 6: Allow a negative expense in the transaction modal

**Files:**
- Modify: `src/components/budget/TransactionModal.tsx:84-96` (`handleSubmit` validation and the shared-bill guard)
- Modify: `src/components/budget/TransactionModal.test.tsx` (append tests)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

**Background:** `handleSubmit` rejects `amount <= 0` outright, so a refund cannot be hand-entered or corrected after import. Only expenses may be negative. Income stays strictly positive, because a negative income has no meaning in this model and would corrupt income totals.

The existing test file defines a `seed()` helper that sets two category groups and two categories, renders with `<TransactionModal isOpen onClose={...} />`, and drives the amount field via `screen.getAllByPlaceholderText('0.00')[0]`. Reuse all of it.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/budget/TransactionModal.test.tsx`:

```typescript
describe('TransactionModal negative amounts', () => {
  const setAmount = (value: string) => {
    const input = screen.getAllByPlaceholderText('0.00')[0] as HTMLInputElement
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input)
  }

  const submit = () => fireEvent.click(screen.getByRole('button', { name: /add transaction|save/i }))

  it('accepts a negative expense as a refund', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)
    setAmount('-39.99')
    submit()

    const saved = Object.values(useBudgetStore.getState().transactions)
    expect(saved).toHaveLength(1)
    expect(saved[0].amount).toBe(-39.99)
    expect(saved[0].type).toBe('expense')
  })

  it('still rejects a negative income', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    setAmount('-10')
    submit()

    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero.')
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  })

  it('still rejects an amount of exactly zero', () => {
    seed()
    render(<TransactionModal isOpen onClose={() => {}} />)
    setAmount('0')
    submit()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(Object.values(useBudgetStore.getState().transactions)).toHaveLength(0)
  })
})
```

If the submit button's accessible name does not match `/add transaction|save/i`, run the file once and read the rendered output to find the real name, then correct the `submit` helper. Do not weaken the assertions to compensate.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/budget/TransactionModal.test.tsx -t "negative amounts"`

Expected: `accepts a negative expense as a refund` FAILS, with the amount error shown and nothing saved. The other two PASS already, as regression guards.

- [ ] **Step 3: Change the validation**

In `src/components/budget/TransactionModal.tsx`, replace the guard at the top of `handleSubmit`:

```typescript
    // An expense may be negative: that is a refund, money returning to the
    // category it left. Income may not, because a negative income has no
    // meaning here and would corrupt income totals.
    const amountInvalid = type === 'expense' ? amount === 0 : amount <= 0;
    if (amountInvalid) {
      setAmountError(
        type === 'expense'
          ? 'Enter an amount. Use a negative amount for a refund.'
          : 'Enter an amount greater than zero.',
      );
      document.getElementById('tx-amount')?.focus();
      return;
    }
```

- [ ] **Step 4: Close the shared-bill hole this opens**

The next statement reads `type === 'expense' && isShared && totalPaid > amount && sharedWith.trim()`. With a negative `amount`, `totalPaid > amount` is trivially true, so a refund could pick up a nonsensical shared-bill record. Add a floor:

```typescript
    const sharedField =
      type === 'expense' && amount > 0 && isShared && totalPaid > amount && sharedWith.trim()
        ? { totalAmount: totalPaid, sharedWith: sharedWith.trim() }
        : undefined;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/budget/TransactionModal.test.tsx`

Expected: PASS, all tests in the file. The zero-amount test now sees the new expense-mode message; it asserts only that an alert is present, so it needs no edit.

- [ ] **Step 6: Commit**

```bash
git add src/components/budget/TransactionModal.tsx src/components/budget/TransactionModal.test.tsx
git commit -m "feat(budget): allow a negative expense amount for refunds"
```

---

### Task 7: Keep the cash flow Sankey valid when a group nets negative

**Files:**
- Modify: `src/components/budget/CashFlowWidget.tsx:109-111`
- Modify or create: `src/components/budget/CashFlowWidget.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

**Background:** `expenseByGroup` sums spend per group. A group whose refunds exceed its spending in the period nets zero or less. The `links` array already ends with `.filter((l) => l.value > 0)`, so the bad link is dropped, but the group's **node** is still built from `expenseNames` and would render as an orphan node carrying a label and no flow. `totalExpense` would also disagree with the nodes actually drawn. The fix belongs upstream of both, in `expenseNames` itself.

- [ ] **Step 1: Check what the test file looks like**

Run: `ls src/components/budget/CashFlowWidget.test.tsx && head -30 src/components/budget/CashFlowWidget.test.tsx`

If the file does not exist, create it following the store-seeding conventions in `src/components/budget/TriageInboxWidget.test.tsx`.

- [ ] **Step 2: Confirm the accessible label wording**

Read the `ChartFigure` `label` prop at `src/components/budget/CashFlowWidget.tsx:130`. It reads:

```
`Cash flow this period: ${formatMoney(totalIncome)} income across ${incomeNames.length} sources into ${formatMoney(totalExpense)} of expenses across ${expenseNames.length} groups, leaving ${formatMoney(savings)} saved`
```

Then check how `ChartFigure` exposes that label, so the test grabs the right node:

Run: `grep -rn "label" src/components/dashboard/ChartFigure.tsx`

Write the Step 3 assertion against whatever role and attribute it actually renders. Do not guess.

- [ ] **Step 3: Write the failing test**

Append to `src/components/budget/CashFlowWidget.test.tsx`, adjusting the label query to match what Step 2 found:

```typescript
describe('CashFlowWidget negative group totals', () => {
  it('omits an expense group whose refunds exceed its spending', () => {
    useBudgetStore.setState({
      ...useBudgetStore.getState(),
      categoryGroups: { g1: { id: 'g1', name: 'Shopping', kind: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Personal', targetAmount: 0 } },
      transactions: {
        i1: { id: 'i1', date: '2026-08-01', amount: 1000, description: 'PAYROLL', type: 'income', categoryId: '' },
        s1: { id: 's1', date: '2026-08-02', amount: 20, description: 'BUY', type: 'expense', categoryId: 'c1' },
        r1: { id: 'r1', date: '2026-08-03', amount: -50, description: 'REFUND', type: 'expense', categoryId: 'c1' },
      },
    })
    render(<CashFlowWidget />)
    // The Shopping group nets -30, so it must not be drawn as a flow at all.
    expect(screen.getByLabelText(/across 0 groups/)).toBeInTheDocument()
  })
})
```

The seeded dates must fall inside the widget's active range, which defaults to the current month. If the suite does not mock the clock to August 2026, change the seeded dates to the current month, or the widget renders its empty state and the test passes without proving anything.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/components/budget/CashFlowWidget.test.tsx -t "negative group totals"`

Expected: FAIL, the label reports 1 group because `Shopping` is still in `expenseNames`.

- [ ] **Step 5: Filter negative groups out of the node list**

In `src/components/budget/CashFlowWidget.tsx`, replace the `expenseNames` line:

```typescript
  // A group whose refunds outweigh its spending nets zero or less. A Sankey has
  // no way to draw a negative flow, so the group is left out of the diagram
  // rather than drawn as a node with no link into it.
  const expenseNames = [...expenseByGroup.keys()].filter((name) => (expenseByGroup.get(name) ?? 0) > 0)
```

Then change `totalExpense` so it counts only the groups actually drawn:

```typescript
  const totalExpense = expenseNames.reduce((s, name) => s + (expenseByGroup.get(name) ?? 0), 0)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/budget/CashFlowWidget.test.tsx`

Expected: PASS, all tests in the file.

- [ ] **Step 7: Commit**

```bash
git add src/components/budget/CashFlowWidget.tsx src/components/budget/CashFlowWidget.test.tsx
git commit -m "fix(cashflow): omit expense groups that net negative from the Sankey"
```

---

### Task 8: Clamp budget progress bars at zero

**Files:**
- Modify: `src/components/budget/BudgetProgressWidget.tsx:109`, `:126`, `:146`
- Modify or create: `src/components/budget/BudgetProgressWidget.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

**Background:** Three bar widths are computed as `Math.min(100, (spent / target) * 100)`. When refunds push a category's net spend below zero the width goes negative, which is invalid CSS. The displayed **number** must stay truthful and negative; only the bar width is clamped.

- [ ] **Step 1: Write the failing test**

Append to `src/components/budget/BudgetProgressWidget.test.tsx`, creating the file if it does not exist:

```typescript
describe('BudgetProgressWidget negative spend', () => {
  it('clamps the bar at zero width but still reports the negative figure', () => {
    const month = new Date().toISOString().slice(0, 7)
    useBudgetStore.setState({
      ...useBudgetStore.getState(),
      categoryGroups: { g1: { id: 'g1', name: 'Shopping', kind: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Personal', targetAmount: 100 } },
      transactions: {
        r1: {
          id: 'r1', date: `${month}-03`, amount: -50, description: 'REFUND',
          type: 'expense', categoryId: 'c1',
        },
      },
    })
    const { container } = render(<BudgetProgressWidget />)
    const widths = [...container.querySelectorAll<HTMLElement>('[style*="width"]')].map((el) => el.style.width)
    expect(widths.length).toBeGreaterThan(0)
    expect(widths.every((w) => !w.startsWith('-'))).toBe(true)
  })
})
```

The date is built from the current month so the row falls inside the widget's default range. The `widths.length` assertion matters: without it, a widget that rendered no rows at all would pass vacuously.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/budget/BudgetProgressWidget.test.tsx -t "negative spend"`

Expected: FAIL, at least one width is `-50%`.

- [ ] **Step 3: Clamp all three bars**

In `src/components/budget/BudgetProgressWidget.tsx`, add a lower bound at each of lines 109, 126 and 146.

Line 109:

```tsx
                  style={{ width: `${Math.max(0, Math.min(100, (totalSpent / budgeted) * 100))}%` }}
```

Line 126:

```tsx
                  style={{ width: `${Math.max(0, Math.min(100, (spent / target) * 100))}%` }}
```

Line 146:

```tsx
                      style={{ width: `${Math.max(0, Math.min(100, (spent / annual) * 100))}%` }}
```

Do not change how `spent`, `totalSpent` or any displayed figure is computed. A category that nets negative should read as a negative amount spent, which is accurate.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/budget/BudgetProgressWidget.test.tsx`

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/BudgetProgressWidget.tsx src/components/budget/BudgetProgressWidget.test.tsx
git commit -m "fix(budget): clamp progress bars at zero when refunds exceed spend"
```

---

### Task 9: Release v0.9.6-beta

**Files:**
- Modify: `package.json` (the `version` field)
- Modify: `CHANGELOG.md` (a new section below `## [Unreleased]`)

**Interfaces:**
- Consumes: every preceding task.
- Produces: nothing.

**Background:** `CHANGELOG.md` follows Keep a Changelog and describes changes in plain user-facing language, not in terms of file names. Read the `## [0.9.5-beta]` section first and match its voice.

- [ ] **Step 1: Run the full verification suite**

Run: `npm run verify`

Expected: PASS at every stage: lint, unit tests, build, bundle check, eager-graph check, type-scale check, e2e.

Do not proceed past this step on a failure. Fix the cause. If the fix belongs to an earlier task's area, commit it with that area's scope in the message.

- [ ] **Step 2: Bump the version**

In `package.json`:

```json
  "version": "0.9.6-beta",
```

- [ ] **Step 3: Write the changelog entry**

In `CHANGELOG.md`, insert below the `## [Unreleased]` line:

```markdown
## [0.9.6-beta] - 2026-08-25

Support for Chase credit card statements, and the groundwork refunds needed in
order to be recorded honestly.

### Added
- Chase credit card activity exports now import directly, instead of falling through to the manual column-mapping dialog. Merchant names arrive readable rather than HTML-escaped
- A credit card bill payment is now recognized for what it is. It arrives in triage badged "card payment, not income", is held back from Accept All so it can never be swept in as earnings, and can be cleared in one click with "Reject N card payments"
- Where you have no rule of your own for a merchant, Chase's own category is now used as a starting guess. Your own learned rules always win

### Changed
- A refund is now recorded as money returning to the category it left, rather than as income. Your income figure no longer counts refunds, and the category the money came back to reflects it
- A transaction amount may now be negative when it is an expense, so a refund can be entered or corrected by hand. Income still has to be greater than zero

### Fixed
- Amounts no longer render with two minus signs where a transaction is negative
```

- [ ] **Step 4: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): v0.9.6-beta"
```

- [ ] **Step 5: Report, do not push**

Report the final `npm run verify` output and the commit list to the user. Do not push, tag, or merge. That is the user's call.

---

## Manual verification

One thing the suite cannot check is whether the real file imports correctly end to end. After Task 9, ask the user to import
`C:\Users\misha\Downloads\Chase8207_Activity_20260824.csv` through the UI and confirm:

- 89 rows arrive in triage
- 5 rows are badged "card payment, not income", and `Accept All` reads 83 rather than 89. That is 89 rows, minus the 5 card payments, minus the 1 row that the pre-existing duplicate detection flags because the file lists two genuinely separate `TST* FIG 19` charges of $16.57 on the same day
- the `H&M` and `DON JUAN DELI & GROCERY` rows read with a real ampersand
- the `AMAZON MKTPLACE PMTS` refund shows as `$40` with no minus sign, among the negative expenses
- `LIDL`, `TRADER JOE S` and `CHOPCHEESE DELI` rows arrive pre-set to Groceries
