# v0.7.0-beta Implementation Plan: Budget Paradigms, After-Tax Comp, PWA Icons

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the budget paradigm selector functional (4 paradigms with real math, warnings, and a reallocation UI), add an after-tax view of total compensation reusing the Salary & Tax calculator, and cache-bust the stale PWA icons.

**Architecture:** All paradigm math lives in `getMonthlyBudgetStats` in the Zustand budget store (pure, unit-testable); UI components read the block for the active paradigm. The after-tax estimate is a small hook composing the existing pure `takeHomeWithDeductions` from `utils/finance/canadaTax` with the province saved in the planner store. PWA fix is a filename rename plus manifest update.

**Tech Stack:** React 18 + TypeScript, Zustand (persist), react-router-dom, Tailwind, Vitest + React Testing Library, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-07-17-v07-paradigms-takehome-pwa-design.md`

## Global Constraints

- Do not use em dashes in any user-facing copy or docs (user rule).
- Warnings only: no paradigm ever blocks a user action.
- Paradigm feedback appears on the Budgeting page only; `BudgetHealthWidget` (dashboard) must not change.
- The comp page tax estimate uses province from planner tool `salary-tax`, RRSP/FHSA always 0.
- Deep link writes ONLY the `income` input of the `salary-tax` tool, never province/rrsp/fhsa.
- Release version: `0.7.0-beta`.
- Run tests with `npx vitest run <path>`; full suite is `npx vitest run` (338+ tests, excludes `.claude/worktrees`).
- Every commit message ends with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Paradigm types, v3 migration, seeded group classes

**Files:**
- Modify: `src/types/budget.ts`
- Modify: `src/store/useBudgetStore.ts` (migration, persist version, seedDefaults)
- Test: `src/store/useBudgetStore.test.ts`

**Interfaces:**
- Consumes: existing `migrateBudgetState` (v1 to v2), `CategoryGroup`.
- Produces: `BudgetingParadigm = 'Ledger Custom' | 'Zero-Based' | 'Target-Based' | '50/30/20'`; `BudgetClass = 'need' | 'want' | 'savings'`; `CategoryGroup.budgetClass?: BudgetClass`; exported `migrateBudgetStateV3(persisted: unknown): unknown`; persist `version: 3`.

- [ ] **Step 1: Write the failing tests**

Append to `src/store/useBudgetStore.test.ts`:

```ts
import { migrateBudgetStateV3 } from './useBudgetStore'

describe('budget store migration v2 -> v3', () => {
  it('remaps out-of-type paradigms to Ledger Custom', () => {
    expect((migrateBudgetStateV3({ paradigm: 'Envelope' }) as { paradigm: string }).paradigm).toBe('Ledger Custom')
    expect((migrateBudgetStateV3({ paradigm: 'Zero-Based' }) as { paradigm: string }).paradigm).toBe('Zero-Based')
    expect((migrateBudgetStateV3({ paradigm: '50/30/20' }) as { paradigm: string }).paradigm).toBe('50/30/20')
    expect((migrateBudgetStateV3({}) as { paradigm: string }).paradigm).toBe('Ledger Custom')
  })

  it('classifies known seeded expense groups and leaves others alone', () => {
    const v2 = {
      paradigm: 'Ledger Custom',
      categoryGroups: {
        h: { id: 'h', name: 'Housing', kind: 'expense' },
        e: { id: 'e', name: 'Entertainment', kind: 'expense' },
        x: { id: 'x', name: 'Mystery', kind: 'expense' },
        i: { id: 'i', name: 'Income', kind: 'income' },
        pre: { id: 'pre', name: 'Food', kind: 'expense', budgetClass: 'want' },
      },
    }
    const out = migrateBudgetStateV3(v2) as { categoryGroups: Record<string, { budgetClass?: string }> }
    expect(out.categoryGroups.h.budgetClass).toBe('need')
    expect(out.categoryGroups.e.budgetClass).toBe('want')
    expect(out.categoryGroups.x.budgetClass).toBeUndefined()
    expect(out.categoryGroups.i.budgetClass).toBeUndefined()
    expect(out.categoryGroups.pre.budgetClass).toBe('want') // never overwrites an explicit class
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/useBudgetStore.test.ts`
Expected: FAIL with `migrateBudgetStateV3` not exported.

- [ ] **Step 3: Implement types and migration**

In `src/types/budget.ts` replace the first line and `CategoryGroup`:

```ts
export type BudgetingParadigm = 'Ledger Custom' | 'Zero-Based' | 'Target-Based' | '50/30/20';

export type BudgetClass = 'need' | 'want' | 'savings';

export interface CategoryGroup {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  /** 50/30/20 bucket for expense groups. Unclassified counts as need. */
  budgetClass?: BudgetClass;
}
```

In `src/store/useBudgetStore.ts`, import `BudgetClass` from the types file and add below `migrateBudgetState`:

```ts
const VALID_PARADIGMS: readonly string[] = ['Ledger Custom', 'Zero-Based', 'Target-Based', '50/30/20'];
const SEED_CLASS_BY_NAME: Record<string, BudgetClass> = {
  housing: 'need',
  necessities: 'need',
  food: 'need',
  entertainment: 'want',
  shopping: 'want',
};

/** v2 -> v3: paradigm becomes one of the four real values (Envelope and any
 *  unknown value fall back to Ledger Custom); known seeded expense groups get
 *  a 50/30/20 budgetClass. Explicit classes are never overwritten. */
export function migrateBudgetStateV3(persisted: unknown): unknown {
  const state = persisted as {
    paradigm?: string;
    categoryGroups?: Record<string, CategoryGroup>;
  };
  const paradigm = VALID_PARADIGMS.includes(state?.paradigm ?? '')
    ? state.paradigm
    : 'Ledger Custom';
  const categoryGroups = state?.categoryGroups
    ? Object.fromEntries(
        Object.entries(state.categoryGroups).map(([id, g]) => {
          const seeded = SEED_CLASS_BY_NAME[g.name?.toLowerCase?.() ?? ''];
          if (g.kind === 'expense' && !g.budgetClass && seeded) {
            return [id, { ...g, budgetClass: seeded }];
          }
          return [id, g];
        }),
      )
    : state?.categoryGroups;
  return { ...state, paradigm, categoryGroups };
}
```

Update the persist config: `version: 3`, and chain migrations:

```ts
      version: 3,
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<BudgetState>;
        const withDefaults = {
          ...persisted,
          budgetSetupCollapsed: persisted.budgetSetupCollapsed ?? true,
        };
        const v2 = migrateBudgetState(withDefaults, version);
        return (version >= 3 ? v2 : migrateBudgetStateV3(v2)) as Partial<BudgetState>;
      },
```

In `seedDefaults`, add classes to the seeded expense groups (income group unchanged):

```ts
'b7ca0301-94c8-4c58-98d5-b94a61294a24': { id: 'b7ca0301-94c8-4c58-98d5-b94a61294a24', name: 'Housing', kind: 'expense', budgetClass: 'need' },
'02d13ccd-9d3a-4585-ada4-5c3b9041b539': { id: '02d13ccd-9d3a-4585-ada4-5c3b9041b539', name: 'Entertainment', kind: 'expense', budgetClass: 'want' },
'6252c9d2-7035-4a58-baf2-ef4d78de6a43': { id: '6252c9d2-7035-4a58-baf2-ef4d78de6a43', name: 'Necessities', kind: 'expense', budgetClass: 'need' },
'616e0658-95ed-4db7-97bc-0810b94b849b': { id: '616e0658-95ed-4db7-97bc-0810b94b849b', name: 'Shopping', kind: 'expense', budgetClass: 'want' },
'dc29db87-cfde-4c89-91e1-36a9436f6e5a': { id: 'dc29db87-cfde-4c89-91e1-36a9436f6e5a', name: 'Food', kind: 'expense', budgetClass: 'need' },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/useBudgetStore.test.ts`
Expected: PASS (old v1 to v2 test included).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` (expect one new error in `CategoryManagerWidget.tsx` only if the `as any` cast were removed; it is not yet, so expect clean).

```bash
git add src/types/budget.ts src/store/useBudgetStore.ts src/store/useBudgetStore.test.ts
git commit -m "feat(budget): paradigm type union, v3 migration, seeded group classes"
```

---

### Task 2: Paradigm-aware monthly stats

**Files:**
- Modify: `src/store/useBudgetStore.ts` (`getMonthlyBudgetStats`)
- Test: `src/store/useBudgetStore.test.ts`

**Interfaces:**
- Consumes: `BudgetState`, existing effective-target reallocation math.
- Produces (exact shape later tasks rely on):

```ts
export interface CategoryStat {
  id: string;
  effectiveTarget: number;
  spent: number;
  overspend: number; // max(spent - effectiveTarget, 0)
}

export interface MonthlyBudgetStats {
  spent: number;
  remaining: number;
  unallocated: number;
  perCategory: Record<string, CategoryStat>; // expense categories only
  zeroBased: { unassigned: number; overspentCategoryIds: string[] };
  targetBased: { buffer: number; negative: boolean };
  fiftyThirtyTwenty: {
    needsSpent: number; wantsSpent: number; savingsSpent: number;
    needsPct: number; wantsPct: number; savingsPct: number; // of month income, 0 when income is 0
    hasUnclassified: boolean;
  };
}
```

- [ ] **Step 1: Write the failing tests**

Append to `src/store/useBudgetStore.test.ts`:

```ts
import { getMonthlyBudgetStats } from './useBudgetStore'
import type { BudgetingParadigm } from '../types/budget'

function makeState(paradigm: BudgetingParadigm) {
  return {
    paradigm,
    budgetSetupCollapsed: true,
    categoryGroups: {
      gi: { id: 'gi', name: 'Income', kind: 'income' as const },
      gn: { id: 'gn', name: 'Housing', kind: 'expense' as const, budgetClass: 'need' as const },
      gw: { id: 'gw', name: 'Fun', kind: 'expense' as const, budgetClass: 'want' as const },
      gs: { id: 'gs', name: 'Investing', kind: 'expense' as const, budgetClass: 'savings' as const },
      gu: { id: 'gu', name: 'Mystery', kind: 'expense' as const },
    },
    categories: {
      inc: { id: 'inc', groupId: 'gi', name: 'Salary', targetAmount: 0 },
      rent: { id: 'rent', groupId: 'gn', name: 'Rent', targetAmount: 1000 },
      games: { id: 'games', groupId: 'gw', name: 'Games', targetAmount: 200 },
      etf: { id: 'etf', groupId: 'gs', name: 'ETF', targetAmount: 500 },
      misc: { id: 'misc', groupId: 'gu', name: 'Misc', targetAmount: 100 },
    },
    transactions: {
      t1: { id: 't1', date: '2026-07-01', amount: 4000, categoryId: 'inc', description: 'pay', type: 'income' as const },
      t2: { id: 't2', date: '2026-07-02', amount: 1200, categoryId: 'rent', description: 'rent', type: 'expense' as const },
      t3: { id: 't3', date: '2026-07-03', amount: 150, categoryId: 'games', description: 'game', type: 'expense' as const },
      t4: { id: 't4', date: '2026-07-04', amount: 500, categoryId: 'etf', description: 'buy', type: 'expense' as const },
      t5: { id: 't5', date: '2026-07-05', amount: 50, categoryId: 'misc', description: '?', type: 'expense' as const },
    },
    reallocations: {},
  }
}

describe('getMonthlyBudgetStats paradigm blocks', () => {
  // Targets total 1800, income 4000, spent 1900. Rent overspends by 200.
  it('computes per-category overspend and zero-based flags', () => {
    const stats = getMonthlyBudgetStats(makeState('Zero-Based') as never, 2026, 6)
    expect(stats.perCategory.rent.overspend).toBe(200)
    expect(stats.perCategory.games.overspend).toBe(0)
    expect(stats.zeroBased.unassigned).toBe(4000 - 1800)
    expect(stats.zeroBased.overspentCategoryIds).toEqual(['rent'])
    expect(stats.perCategory.inc).toBeUndefined() // income categories excluded
  })

  it('reallocation coverage clears the zero-based flag', () => {
    const state = makeState('Zero-Based')
    ;(state.reallocations as Record<string, unknown>).r1 = {
      id: 'r1', fromCategoryId: 'misc', toCategoryId: 'rent', amount: 200, date: '2026-07-06',
    }
    const stats = getMonthlyBudgetStats(state as never, 2026, 6)
    expect(stats.perCategory.rent.effectiveTarget).toBe(1200)
    expect(stats.zeroBased.overspentCategoryIds).toEqual([]) // rent covered
    expect(stats.perCategory.misc.overspend).toBe(150) // misc now over its reduced target
    expect(stats.zeroBased.unassigned).toBe(2200) // reallocations never change unassigned
  })

  it('target-based buffer absorbs overspend and flags negative', () => {
    const stats = getMonthlyBudgetStats(makeState('Target-Based') as never, 2026, 6)
    expect(stats.targetBased.buffer).toBe(2200 - 200) // unallocated minus total overspend
    expect(stats.targetBased.negative).toBe(false)
  })

  it('50/30/20 buckets: unclassified counts as need, pct of income', () => {
    const stats = getMonthlyBudgetStats(makeState('50/30/20') as never, 2026, 6)
    expect(stats.fiftyThirtyTwenty.needsSpent).toBe(1200 + 50) // rent + unclassified misc
    expect(stats.fiftyThirtyTwenty.wantsSpent).toBe(150)
    expect(stats.fiftyThirtyTwenty.savingsSpent).toBe(500)
    expect(stats.fiftyThirtyTwenty.needsPct).toBeCloseTo((1250 / 4000) * 100)
    expect(stats.fiftyThirtyTwenty.hasUnclassified).toBe(true)
  })

  it('50/30/20 pct are 0 on zero-income months', () => {
    const state = makeState('50/30/20')
    delete (state.transactions as Record<string, unknown>).t1
    const stats = getMonthlyBudgetStats(state as never, 2026, 6)
    expect(stats.fiftyThirtyTwenty.needsPct).toBe(0)
    expect(stats.fiftyThirtyTwenty.savingsPct).toBe(0)
  })

  it('keeps legacy top-level numbers unchanged', () => {
    const stats = getMonthlyBudgetStats(makeState('Ledger Custom') as never, 2026, 6)
    expect(stats.spent).toBe(1900)
    expect(stats.unallocated).toBe(2100)
    expect(stats.remaining).toBe(1800 - 1900)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/useBudgetStore.test.ts`
Expected: FAIL (property `perCategory` does not exist / TS errors on the new shape).

- [ ] **Step 3: Implement the stats expansion**

Replace `MonthlyBudgetStats` and `getMonthlyBudgetStats` in `src/store/useBudgetStore.ts` (keep the income/target/reallocation loops that exist; the diff below shows the full replacement):

```ts
export interface CategoryStat {
  id: string;
  effectiveTarget: number;
  spent: number;
  overspend: number;
}

export interface MonthlyBudgetStats {
  spent: number;
  remaining: number;
  unallocated: number;
  perCategory: Record<string, CategoryStat>;
  zeroBased: { unassigned: number; overspentCategoryIds: string[] };
  targetBased: { buffer: number; negative: boolean };
  fiftyThirtyTwenty: {
    needsSpent: number; wantsSpent: number; savingsSpent: number;
    needsPct: number; wantsPct: number; savingsPct: number;
    hasUnclassified: boolean;
  };
}

export function getMonthlyBudgetStats(
  state: BudgetState,
  year: number,
  monthIndex: number // 0-11
): MonthlyBudgetStats {
  let spent = 0;
  let totalIncome = 0;

  const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  const perCategorySpent: Record<string, number> = {};
  Object.values(state.transactions).forEach((tx) => {
    if (!tx.date.startsWith(monthStr)) return;
    if (tx.type === 'expense') {
      spent += tx.amount;
      if (tx.categoryId) {
        perCategorySpent[tx.categoryId] = (perCategorySpent[tx.categoryId] ?? 0) + tx.amount;
      }
    } else if (tx.type === 'income') {
      totalIncome += tx.amount;
    }
  });

  // Effective targets: base + reallocations in - reallocations out (this month).
  const categoryEffectiveTargets: Record<string, number> = {};
  Object.values(state.categories).forEach((cat) => {
    categoryEffectiveTargets[cat.id] = cat.targetAmount;
  });
  Object.values(state.reallocations).forEach((realloc) => {
    if (!realloc.date.startsWith(monthStr)) return;
    if (categoryEffectiveTargets[realloc.fromCategoryId] !== undefined) {
      categoryEffectiveTargets[realloc.fromCategoryId] -= realloc.amount;
    }
    if (categoryEffectiveTargets[realloc.toCategoryId] !== undefined) {
      categoryEffectiveTargets[realloc.toCategoryId] += realloc.amount;
    }
  });

  const totalTarget = Object.values(categoryEffectiveTargets).reduce((sum, amt) => sum + amt, 0);
  const unallocated = totalIncome - totalTarget;
  const remaining = totalTarget - spent;

  // Per-category stats for expense categories only.
  const perCategory: Record<string, CategoryStat> = {};
  Object.values(state.categories).forEach((cat) => {
    const group = state.categoryGroups[cat.groupId];
    if (group?.kind !== 'expense') return;
    const catSpent = perCategorySpent[cat.id] ?? 0;
    const effectiveTarget = categoryEffectiveTargets[cat.id] ?? cat.targetAmount;
    perCategory[cat.id] = {
      id: cat.id,
      effectiveTarget,
      spent: catSpent,
      overspend: Math.max(catSpent - effectiveTarget, 0),
    };
  });

  const overspentCategoryIds = Object.values(perCategory)
    .filter((c) => c.overspend > 0)
    .map((c) => c.id);
  const totalOverspend = Object.values(perCategory).reduce((sum, c) => sum + c.overspend, 0);

  // 50/30/20 buckets. Unclassified expense groups count as need. Expense
  // transactions without a category also count as need.
  let needsSpent = 0;
  let wantsSpent = 0;
  let savingsSpent = 0;
  let hasUnclassified = false;
  Object.values(state.transactions).forEach((tx) => {
    if (tx.type !== 'expense' || !tx.date.startsWith(monthStr)) return;
    const cat = tx.categoryId ? state.categories[tx.categoryId] : undefined;
    const group = cat ? state.categoryGroups[cat.groupId] : undefined;
    const cls = group?.budgetClass;
    if (cls === 'want') wantsSpent += tx.amount;
    else if (cls === 'savings') savingsSpent += tx.amount;
    else needsSpent += tx.amount;
  });
  Object.values(state.categoryGroups).forEach((g) => {
    if (g.kind === 'expense' && !g.budgetClass) hasUnclassified = true;
  });
  const pct = (v: number) => (totalIncome > 0 ? (v / totalIncome) * 100 : 0);

  return {
    spent,
    remaining,
    unallocated,
    perCategory,
    zeroBased: { unassigned: unallocated, overspentCategoryIds },
    targetBased: { buffer: unallocated - totalOverspend, negative: unallocated - totalOverspend < 0 },
    fiftyThirtyTwenty: {
      needsSpent,
      wantsSpent,
      savingsSpent,
      needsPct: pct(needsSpent),
      wantsPct: pct(wantsSpent),
      savingsPct: pct(savingsSpent),
      hasUnclassified,
    },
  };
}
```

Note: the empty `if (state.paradigm === 'Zero-Based')` block and its comment are gone.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/useBudgetStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify no consumer broke, commit**

Run: `npx tsc --noEmit` then `npx vitest run src/components/dashboard`
Expected: clean; `BudgetHealthWidget` consumes only `spent/remaining/unallocated`, which are unchanged.

```bash
git add src/store/useBudgetStore.ts src/store/useBudgetStore.test.ts
git commit -m "feat(budget): paradigm-aware monthly stats with per-category overspend"
```

---

### Task 3: Fix paradigm selector, add descriptions and class chips

**Files:**
- Modify: `src/components/budget/CategoryManagerWidget.tsx`
- Test: `src/components/budget/CategoryManagerWidget.test.tsx` (create)

**Interfaces:**
- Consumes: `BudgetingParadigm`, `BudgetClass`, `updateCategoryGroup` from the store.
- Produces: dropdown limited to the four real paradigms (no `as any`); `PARADIGM_DESCRIPTIONS` exported for reuse by tests; Need/Want/Savings chips on expense groups when paradigm is `50/30/20`.

- [ ] **Step 1: Write the failing test**

Create `src/components/budget/CategoryManagerWidget.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryManagerWidget } from './CategoryManagerWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

beforeEach(() => {
  useBudgetStore.setState({
    paradigm: '50/30/20',
    budgetSetupCollapsed: false,
    transactions: {},
    reallocations: {},
    categoryGroups: {
      g1: { id: 'g1', name: 'Housing', kind: 'expense', budgetClass: 'need' },
      g2: { id: 'g2', name: 'Income', kind: 'income' },
    },
    categories: {
      c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 100 },
    },
  })
})

describe('CategoryManagerWidget paradigm controls', () => {
  it('shows the description for the active paradigm', () => {
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    expect(screen.getByText(/50% of income on needs/i)).toBeInTheDocument()
  })

  it('shows class chips on expense groups only under 50/30/20 and updates the class', () => {
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    const wantChip = screen.getByRole('button', { name: 'Set Housing class to want' })
    fireEvent.click(wantChip)
    expect(useBudgetStore.getState().categoryGroups.g1.budgetClass).toBe('want')
    expect(screen.queryByRole('button', { name: /Set Income class/ })).toBeNull()
  })

  it('hides class chips under other paradigms', () => {
    useBudgetStore.setState({ paradigm: 'Zero-Based' })
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    expect(screen.queryByRole('button', { name: /class to want/ })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/budget/CategoryManagerWidget.test.tsx`
Expected: FAIL (description text and chips not rendered).

- [ ] **Step 3: Implement the selector fix, description, chips**

In `src/components/budget/CategoryManagerWidget.tsx`:

Add imports and constants near the top:

```tsx
import type { BudgetingParadigm, BudgetClass } from '../../types/budget';

export const PARADIGM_DESCRIPTIONS: Record<BudgetingParadigm, string> = {
  'Ledger Custom': 'Freeform tracking. Targets are informational; nothing is enforced.',
  'Zero-Based': 'Every dollar gets assigned. Overspending must be covered by moving budget from another category.',
  'Target-Based': 'Targets are soft ceilings. Overspending is absorbed by your unallocated buffer.',
  '50/30/20': 'Aim to spend about 50% of income on needs, 30% on wants, and 20% toward savings.',
};

const BUDGET_CLASSES: BudgetClass[] = ['need', 'want', 'savings'];
```

Destructure `updateCategoryGroup` from the store hook alongside the existing actions.

Replace the paradigm `<ThemedSelect>` block (currently the `Envelope` list with `as any`) with:

```tsx
<div className="flex flex-col items-end gap-1">
  <div className="flex items-center gap-3">
    <label className="text-[14px] text-text-secondary">Paradigm:</label>
    <ThemedSelect
      value={paradigm}
      onChange={(v) => setParadigm(v as BudgetingParadigm)}
      className="min-w-[180px]"
      options={[
        { value: 'Ledger Custom', label: 'Ledger Custom' },
        { value: 'Zero-Based', label: 'Zero-Based' },
        { value: 'Target-Based', label: 'Target-Based' },
        { value: '50/30/20', label: '50/30/20 Rule' },
      ]}
    />
  </div>
  <p className="text-[12px] text-text-secondary max-w-[420px] text-right">
    {PARADIGM_DESCRIPTIONS[paradigm]}
  </p>
</div>
```

(The cast to `BudgetingParadigm` is safe because the options list is exactly the union. If a persisted out-of-type value slips through pre-migration, `PARADIGM_DESCRIPTIONS[paradigm]` may be undefined; migration in Task 1 prevents this.)

In the group header (next to the group name and total badge), add chips:

```tsx
{paradigm === '50/30/20' && !isIncomeGroup && (
  <div className="flex items-center gap-1">
    {BUDGET_CLASSES.map((cls) => (
      <button
        key={cls}
        type="button"
        aria-label={`Set ${group.name} class to ${cls}`}
        onClick={() => updateCategoryGroup(group.id, { budgetClass: cls })}
        className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors capitalize ${
          group.budgetClass === cls
            ? 'border-accent text-accent bg-accent/10'
            : 'border-border text-text-secondary hover:text-text-primary'
        }`}
      >
        {cls}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/budget/CategoryManagerWidget.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/CategoryManagerWidget.tsx src/components/budget/CategoryManagerWidget.test.tsx
git commit -m "feat(budget): real paradigm options, descriptions, 50/30/20 class chips"
```

---

### Task 4: ParadigmBanner component on the Budgeting page

**Files:**
- Create: `src/components/budget/ParadigmBanner.tsx`
- Modify: `src/pages/Budgeting.tsx`
- Test: `src/components/budget/ParadigmBanner.test.tsx` (create)

**Interfaces:**
- Consumes: `getMonthlyBudgetStats`, `useBudgetStore`, `formatMoney` from `../planner/format`.
- Produces: `<ParadigmBanner selectedMonth="YYYY-MM" />`, rendered on the Budgeting page above the tab content. Renders `null` for Ledger Custom, for Zero-Based at exactly 0 unassigned, and for Target-Based when the buffer is not negative it renders the positive framing (not null).

- [ ] **Step 1: Write the failing tests**

Create `src/components/budget/ParadigmBanner.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ParadigmBanner } from './ParadigmBanner'
import { useBudgetStore } from '../../store/useBudgetStore'

function seed(paradigm: string, incomeAmount: number) {
  useBudgetStore.setState({
    paradigm: paradigm as never,
    transactions: {
      i: { id: 'i', date: '2026-07-01', amount: incomeAmount, categoryId: 'inc', description: 'pay', type: 'income' },
      e: { id: 'e', date: '2026-07-02', amount: 300, categoryId: 'rent', description: 'rent', type: 'expense' },
    },
    categories: {
      inc: { id: 'inc', groupId: 'gi', name: 'Salary', targetAmount: 0 },
      rent: { id: 'rent', groupId: 'ge', name: 'Rent', targetAmount: 200 },
    },
    categoryGroups: {
      gi: { id: 'gi', name: 'Income', kind: 'income' },
      ge: { id: 'ge', name: 'Housing', kind: 'expense', budgetClass: 'need' },
    },
    reallocations: {},
  })
}

describe('ParadigmBanner', () => {
  beforeEach(() => seed('Ledger Custom', 1000))

  it('renders nothing for Ledger Custom', () => {
    const { container } = render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(container.firstChild).toBeNull()
  })

  it('Zero-Based: shows unassigned amount', () => {
    seed('Zero-Based', 1000) // targets 200, unassigned 800
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/\$800 unassigned/)).toBeInTheDocument()
  })

  it('Zero-Based: shows over-assigned message when negative', () => {
    seed('Zero-Based', 100) // targets 200, unassigned -100
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/assigned \$100 more than you earned/i)).toBeInTheDocument()
  })

  it('Target-Based: shows buffer, warns when negative', () => {
    seed('Target-Based', 1000) // buffer = 800 - overspend(rent 300>200 => 100) = 700
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/\$700 buffer/i)).toBeInTheDocument()
  })

  it('50/30/20: shows bucket percentages', () => {
    seed('50/30/20', 1000)
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/Needs 30%/)).toBeInTheDocument()
    expect(screen.getByText(/Wants 0%/)).toBeInTheDocument()
    expect(screen.getByText(/Savings 0%/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/budget/ParadigmBanner.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement ParadigmBanner**

Create `src/components/budget/ParadigmBanner.tsx`:

```tsx
import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useBudgetStore, getMonthlyBudgetStats } from '../../store/useBudgetStore';
import { formatMoney } from '../planner/format';

const Banner: React.FC<{ tone: 'info' | 'warn'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-[13px] ${
      tone === 'warn'
        ? 'border-error/50 bg-error/10 text-text-primary'
        : 'border-border bg-bg-secondary text-text-primary'
    }`}
  >
    {tone === 'warn' ? (
      <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
    ) : (
      <Info size={16} className="text-text-secondary shrink-0 mt-0.5" />
    )}
    <div className="flex flex-col gap-2 min-w-0 flex-1">{children}</div>
  </div>
);

export const ParadigmBanner: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const state = useBudgetStore();
  const [year, month] = selectedMonth.split('-').map(Number);
  const stats = getMonthlyBudgetStats(state, year, month - 1);

  if (state.paradigm === 'Ledger Custom') return null;

  if (state.paradigm === 'Zero-Based') {
    const { unassigned } = stats.zeroBased;
    if (unassigned === 0) return null;
    return unassigned > 0 ? (
      <Banner tone="info">
        <span>
          <strong>{formatMoney(unassigned)} unassigned.</strong> Assign it to a category so every
          dollar has a job.
        </span>
      </Banner>
    ) : (
      <Banner tone="warn">
        <span>
          You have assigned {formatMoney(Math.abs(unassigned))} more than you earned this month.
          Lower some targets or log the missing income.
        </span>
      </Banner>
    );
  }

  if (state.paradigm === 'Target-Based') {
    const { buffer, negative } = stats.targetBased;
    return negative ? (
      <Banner tone="warn">
        <span>
          Your buffer is {formatMoney(buffer)}. Spending has exceeded income plus targets; trim
          spending or raise income to get back above zero.
        </span>
      </Banner>
    ) : (
      <Banner tone="info">
        <span>
          <strong>{formatMoney(buffer)} buffer</strong> available this month. Overspending in any
          category draws from it automatically.
        </span>
      </Banner>
    );
  }

  // 50/30/20
  const f = stats.fiftyThirtyTwenty;
  const buckets = [
    { label: 'Needs', pct: f.needsPct, target: 50, color: 'bg-accent' },
    { label: 'Wants', pct: f.wantsPct, target: 30, color: 'bg-accent/70' },
    { label: 'Savings', pct: f.savingsPct, target: 20, color: 'bg-accent/40' },
  ];
  return (
    <Banner tone="info">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {buckets.map((b) => (
          <span key={b.label} className={b.pct > b.target ? 'text-error' : ''}>
            {b.label} {Math.round(b.pct)}%
            <span className="text-text-secondary"> / {b.target}% target</span>
          </span>
        ))}
      </div>
      <div className="flex w-full h-2 rounded overflow-hidden bg-bg-primary/50">
        {buckets.map((b) => (
          <div key={b.label} className={b.color} style={{ width: `${Math.min(b.pct, 100)}%` }} />
        ))}
      </div>
      {f.hasUnclassified && (
        <span className="text-[12px] text-text-secondary">
          Some expense groups have no class yet. Set Need / Want / Savings chips in Budget Setup for
          accurate buckets (unclassified counts as Needs).
        </span>
      )}
    </Banner>
  );
};
```

In `src/pages/Budgeting.tsx`, import and render it directly above the tab-content sections (after the tab buttons `div`, before `{tab === 'overview' && ...}`):

```tsx
import { ParadigmBanner } from '../components/budget/ParadigmBanner';
// ...
<ParadigmBanner selectedMonth={selectedMonth} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/budget/ParadigmBanner.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/ParadigmBanner.tsx src/components/budget/ParadigmBanner.test.tsx src/pages/Budgeting.tsx
git commit -m "feat(budget): paradigm status banner on Budgeting page"
```

---

### Task 5: ReallocationModal and Zero-Based cover flow

**Files:**
- Create: `src/components/budget/ReallocationModal.tsx`
- Modify: `src/components/budget/CategoryManagerWidget.tsx` (flags + Cover button)
- Test: `src/components/budget/ReallocationModal.test.tsx` (create)

**Interfaces:**
- Consumes: `addReallocation`, `getMonthlyBudgetStats`, `ThemedSelect`, `NumberInput`.
- Produces: `<ReallocationModal isOpen onClose toCategoryId={string} defaultAmount={number} selectedMonth={string} />`. Creates a `Reallocation` dated inside `selectedMonth`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/budget/ReallocationModal.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReallocationModal } from './ReallocationModal'
import { useBudgetStore } from '../../store/useBudgetStore'

beforeEach(() => {
  useBudgetStore.setState({
    paradigm: 'Zero-Based',
    transactions: {},
    reallocations: {},
    categoryGroups: { ge: { id: 'ge', name: 'Housing', kind: 'expense' } },
    categories: {
      rent: { id: 'rent', groupId: 'ge', name: 'Rent', targetAmount: 100 },
      food: { id: 'food', groupId: 'ge', name: 'Food', targetAmount: 400 },
    },
  })
})

describe('ReallocationModal', () => {
  it('creates a reallocation into the overspent category', () => {
    render(
      <ReallocationModal
        isOpen
        onClose={() => {}}
        toCategoryId="rent"
        defaultAmount={50}
        selectedMonth="2026-07"
      />,
    )
    // from-category select defaults to first other category (food)
    fireEvent.click(screen.getByRole('button', { name: /move budget/i }))
    const reallocs = Object.values(useBudgetStore.getState().reallocations)
    expect(reallocs).toHaveLength(1)
    expect(reallocs[0]).toMatchObject({ fromCategoryId: 'food', toCategoryId: 'rent', amount: 50 })
    expect(reallocs[0].date.startsWith('2026-07')).toBe(true)
  })

  it('does not submit a zero amount', () => {
    render(
      <ReallocationModal isOpen onClose={() => {}} toCategoryId="rent" defaultAmount={0} selectedMonth="2026-07" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /move budget/i }))
    expect(Object.values(useBudgetStore.getState().reallocations)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/budget/ReallocationModal.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the modal**

Create `src/components/budget/ReallocationModal.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useBudgetStore, getMonthlyBudgetStats } from '../../store/useBudgetStore';
import { ThemedSelect } from '../ui/ThemedSelect';
import { NumberInput } from '../ui/NumberInput';
import { formatMoney } from '../planner/format';

interface ReallocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  toCategoryId: string;
  defaultAmount: number;
  selectedMonth: string; // YYYY-MM
}

export const ReallocationModal: React.FC<ReallocationModalProps> = ({
  isOpen,
  onClose,
  toCategoryId,
  defaultAmount,
  selectedMonth,
}) => {
  const state = useBudgetStore();
  const { categories, addReallocation } = state;
  const [year, month] = selectedMonth.split('-').map(Number);
  const stats = getMonthlyBudgetStats(state, year, month - 1);

  const sources = useMemo(
    () => Object.values(categories).filter((c) => c.id !== toCategoryId && stats.perCategory[c.id]),
    [categories, toCategoryId, stats.perCategory],
  );

  const [fromCategoryId, setFromCategoryId] = useState(sources[0]?.id ?? '');
  const [amount, setAmount] = useState(defaultAmount);
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const available = (id: string) => {
    const s = stats.perCategory[id];
    return s ? s.effectiveTarget - s.spent : 0;
  };
  const target = categories[toCategoryId];
  const short = fromCategoryId && amount > available(fromCategoryId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromCategoryId || amount <= 0) return;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const date =
      todayKey === selectedMonth ? today.toISOString().slice(0, 10) : `${selectedMonth}-01`;
    addReallocation({
      id: crypto.randomUUID(),
      fromCategoryId,
      toCategoryId,
      amount,
      date,
      note: note || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-bg-secondary border border-border rounded-xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Cover overspending"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-text-primary">
            Cover overspending{target ? ` in ${target.name}` : ''}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-text-secondary">Move budget from</label>
            <ThemedSelect
              value={fromCategoryId}
              onChange={setFromCategoryId}
              options={sources.map((c) => ({
                value: c.id,
                label: `${c.name} (${formatMoney(available(c.id))} available)`,
              }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-text-secondary">Amount</label>
            <NumberInput
              value={amount}
              onCommit={setAmount}
              className="bg-bg-primary border border-border rounded px-3 py-1.5 text-[14px] focus:outline-none focus:border-accent"
            />
            {short && (
              <p className="text-[12px] text-error">
                That is more than this category has available. You can still move it; the source
                will show as overspent.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-text-secondary">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-bg-primary border border-border rounded px-3 py-1.5 text-[14px] focus:outline-none focus:border-accent"
              placeholder="e.g. groceries ran hot this month"
            />
          </div>

          <button
            type="submit"
            className="mt-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Move Budget
          </button>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/budget/ReallocationModal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire flags and Cover button into CategoryManagerWidget**

In `src/components/budget/CategoryManagerWidget.tsx`:

Add state and the modal at component level:

```tsx
const [coverTarget, setCoverTarget] = useState<{ id: string; overage: number } | null>(null);
```

Inside the expense-category IIFE where `isOverBudget` is computed, after the over-amount span, add paradigm-aware markup (`paradigm` is already destructured):

```tsx
{isOverBudget && paradigm === 'Zero-Based' && (
  <button
    type="button"
    onClick={() => setCoverTarget({ id: cat.id, overage: actualAmount - effectiveTarget })}
    className="px-2 py-0.5 rounded text-[11px] font-medium border border-error/60 text-error hover:bg-error/10 transition-colors"
  >
    Cover
  </button>
)}
{isOverBudget && paradigm === 'Target-Based' && (
  <span className="text-[11px] text-orange-500">absorbed by buffer</span>
)}
```

At the end of the component JSX (before the final closing `</div>`):

```tsx
{coverTarget && (
  <ReallocationModal
    isOpen
    onClose={() => setCoverTarget(null)}
    toCategoryId={coverTarget.id}
    defaultAmount={coverTarget.overage}
    selectedMonth={selectedMonth}
  />
)}
```

Import `ReallocationModal` at the top.

- [ ] **Step 6: Run the widget tests and commit**

Run: `npx vitest run src/components/budget`
Expected: PASS.

```bash
git add src/components/budget/ReallocationModal.tsx src/components/budget/ReallocationModal.test.tsx src/components/budget/CategoryManagerWidget.tsx
git commit -m "feat(budget): reallocation modal and zero-based cover flow"
```

---

### Task 6: Reallocation history list

**Files:**
- Create: `src/components/budget/ReallocationHistory.tsx`
- Modify: `src/pages/Budgeting.tsx` (render on setup tab)
- Test: `src/components/budget/ReallocationHistory.test.tsx` (create)

**Interfaces:**
- Consumes: `reallocations`, `categories`, `deleteReallocation` from the store.
- Produces: `<ReallocationHistory selectedMonth="YYYY-MM" />`; renders nothing when the month has no reallocations.

- [ ] **Step 1: Write the failing tests**

Create `src/components/budget/ReallocationHistory.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReallocationHistory } from './ReallocationHistory'
import { useBudgetStore } from '../../store/useBudgetStore'

beforeEach(() => {
  useBudgetStore.setState({
    categories: {
      rent: { id: 'rent', groupId: 'g', name: 'Rent', targetAmount: 100 },
      food: { id: 'food', groupId: 'g', name: 'Food', targetAmount: 400 },
    },
    reallocations: {
      r1: { id: 'r1', fromCategoryId: 'food', toCategoryId: 'rent', amount: 50, date: '2026-07-10', note: 'oops' },
      r2: { id: 'r2', fromCategoryId: 'food', toCategoryId: 'rent', amount: 10, date: '2026-06-10' },
    },
  })
})

describe('ReallocationHistory', () => {
  it('lists only the selected month and deletes entries', () => {
    render(<ReallocationHistory selectedMonth="2026-07" />)
    expect(screen.getByText(/Food/)).toBeInTheDocument()
    expect(screen.getByText(/\$50/)).toBeInTheDocument()
    expect(screen.queryByText(/\$10/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /delete reallocation/i }))
    expect(useBudgetStore.getState().reallocations.r1).toBeUndefined()
  })

  it('renders nothing when the month is empty', () => {
    const { container } = render(<ReallocationHistory selectedMonth="2026-01" />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/budget/ReallocationHistory.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the history list**

Create `src/components/budget/ReallocationHistory.tsx`:

```tsx
import React from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { useBudgetStore } from '../../store/useBudgetStore';
import { formatMoney } from '../planner/format';

export const ReallocationHistory: React.FC<{ selectedMonth: string }> = ({ selectedMonth }) => {
  const reallocations = useBudgetStore((s) => s.reallocations);
  const categories = useBudgetStore((s) => s.categories);
  const deleteReallocation = useBudgetStore((s) => s.deleteReallocation);

  const rows = Object.values(reallocations)
    .filter((r) => r.date.startsWith(selectedMonth))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (rows.length === 0) return null;

  const name = (id: string) => categories[id]?.name ?? 'Deleted category';

  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col gap-3">
      <h2 className="text-[16px] font-semibold text-text-primary">Reallocations This Month</h2>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 text-[13px] border-b border-border/30 pb-2 last:border-0 last:pb-0">
          <span className="text-text-primary">{name(r.fromCategoryId)}</span>
          <ArrowRight size={14} className="text-text-secondary shrink-0" />
          <span className="text-text-primary">{name(r.toCategoryId)}</span>
          <span className="font-medium text-text-primary ml-auto">{formatMoney(r.amount)}</span>
          {r.note && <span className="text-text-secondary italic truncate max-w-[180px]">{r.note}</span>}
          <span className="text-text-secondary">{r.date}</span>
          <button
            type="button"
            aria-label="Delete reallocation"
            onClick={() => deleteReallocation(r.id)}
            className="p-1 text-text-secondary hover:text-error transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
```

In `src/pages/Budgeting.tsx`, render it on the setup tab between `CategoryManagerWidget` and `CategorizationRulesWidget`:

```tsx
import { ReallocationHistory } from '../components/budget/ReallocationHistory';
// in tab === 'setup':
<CategoryManagerWidget selectedMonth={selectedMonth} />
<ReallocationHistory selectedMonth={selectedMonth} />
<CategorizationRulesWidget />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/budget/ReallocationHistory.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/ReallocationHistory.tsx src/components/budget/ReallocationHistory.test.tsx src/pages/Budgeting.tsx
git commit -m "feat(budget): reallocation history list on setup tab"
```

---

### Task 7: useTakeHomeEstimate hook

**Files:**
- Create: `src/hooks/useTakeHomeEstimate.ts`
- Test: `src/hooks/useTakeHomeEstimate.test.tsx` (create)

**Interfaces:**
- Consumes: `usePlannerStore`, `takeHomeWithDeductions`, `PROVINCIAL_TAX`, `Province` from `../utils/finance/canadaTax`.
- Produces:

```ts
export function useTakeHomeEstimate(totalComp: number): {
  takeHome: TakeHomeWithDeductions; // gross, federal, provincial, cpp, ei, net, taxableIncome, taxSavings
  province: Province;
  deductionPct: number; // (gross - net) / gross * 100, 0 when gross is 0
}
```

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useTakeHomeEstimate.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTakeHomeEstimate } from './useTakeHomeEstimate'
import { usePlannerStore } from '../store/usePlannerStore'
import { takeHomeWithDeductions } from '../utils/finance/canadaTax'

beforeEach(() => {
  usePlannerStore.setState({ inputs: {} })
})

describe('useTakeHomeEstimate', () => {
  it('defaults to Ontario with zero deductions', () => {
    const { result } = renderHook(() => useTakeHomeEstimate(100_000))
    expect(result.current.province).toBe('ON')
    expect(result.current.takeHome.net).toBe(takeHomeWithDeductions(100_000, 'ON', 0, 0).net)
  })

  it('reuses the province saved in the salary-tax tool, ignoring its rrsp/fhsa', () => {
    usePlannerStore.setState({ inputs: { 'salary-tax': { province: 'BC', rrsp: 10_000, fhsa: 8_000 } } })
    const { result } = renderHook(() => useTakeHomeEstimate(100_000))
    expect(result.current.province).toBe('BC')
    expect(result.current.takeHome.net).toBe(takeHomeWithDeductions(100_000, 'BC', 0, 0).net)
  })

  it('falls back to ON for an invalid saved province and returns 0 pct at 0 gross', () => {
    usePlannerStore.setState({ inputs: { 'salary-tax': { province: 'XX' } } })
    const { result } = renderHook(() => useTakeHomeEstimate(0))
    expect(result.current.province).toBe('ON')
    expect(result.current.deductionPct).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useTakeHomeEstimate.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useTakeHomeEstimate.ts`:

```ts
import { useMemo } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  PROVINCIAL_TAX,
  takeHomeWithDeductions,
  type Province,
  type TakeHomeWithDeductions,
} from '../utils/finance/canadaTax';

/** After-tax estimate for a compensation total: province comes from the
 *  Salary & Tax tool's saved input (default ON); RRSP/FHSA are always 0 here.
 *  The full-deduction breakdown lives in the Salary & Tax tool itself. */
export function useTakeHomeEstimate(totalComp: number): {
  takeHome: TakeHomeWithDeductions;
  province: Province;
  deductionPct: number;
} {
  const province = usePlannerStore((s) => {
    const p = s.inputs['salary-tax']?.province;
    return (typeof p === 'string' && p in PROVINCIAL_TAX ? p : 'ON') as Province;
  });

  const takeHome = useMemo(
    () => takeHomeWithDeductions(totalComp, province, 0, 0),
    [totalComp, province],
  );
  const deductionPct = takeHome.gross > 0 ? ((takeHome.gross - takeHome.net) / takeHome.gross) * 100 : 0;

  return { takeHome, province, deductionPct };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useTakeHomeEstimate.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTakeHomeEstimate.ts src/hooks/useTakeHomeEstimate.test.tsx
git commit -m "feat(comp): take-home estimate hook reusing salary-tax province"
```

---

### Task 8: After-Tax toggle on CompHeroWidget

**Files:**
- Modify: `src/store/useCompensationStore.ts` (`showAfterTax` + toggle)
- Modify: `src/components/compensation/CompHeroWidget.tsx`
- Test: `src/components/compensation/CompHeroWidget.test.tsx` (create)

**Interfaces:**
- Consumes: `useTakeHomeEstimate` (Task 7), existing `calcTotalComp`, `useCompensationDisplay`.
- Produces: store fields `showAfterTax: boolean` (default `false`) and `toggleAfterTax: () => void`; hero center swaps to net when on; net summary row (`Effective Deductions`, `Net Monthly`, `Net Biweekly`) and caveat text.

- [ ] **Step 1: Add store field (no test needed beyond typecheck, it mirrors existing toggles)**

In `src/store/useCompensationStore.ts`, add to `CompensationState`:

```ts
  showAfterTax: boolean
  toggleAfterTax: () => void
```

and to the store creator (near `useCadConversion`):

```ts
      showAfterTax: false,
      toggleAfterTax: () => set((state) => ({ showAfterTax: !state.showAfterTax })),
```

- [ ] **Step 2: Write the failing widget test**

Create `src/components/compensation/CompHeroWidget.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CompHeroWidget } from './CompHeroWidget'
import { useCompensationStore, defaultPrimaryPackage } from '../../store/useCompensationStore'
import { usePlannerStore } from '../../store/usePlannerStore'

beforeEach(() => {
  usePlannerStore.setState({ inputs: {} })
  useCompensationStore.setState({
    showAfterTax: false,
    timeMode: 'current-year',
    useCadConversion: false,
    primaryPackage: { ...defaultPrimaryPackage, baseSalary: 100_000, pastSalaryChanges: [], rsuGrants: [] },
  })
})

const renderWidget = () =>
  render(
    <MemoryRouter>
      <CompHeroWidget />
    </MemoryRouter>,
  )

describe('CompHeroWidget after-tax toggle', () => {
  it('shows gross label by default and after-tax when toggled', () => {
    renderWidget()
    expect(screen.getByText('Total Annual Compensation')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'After-Tax' }))
    expect(screen.getByText('Est. After-Tax Compensation')).toBeInTheDocument()
    expect(screen.getByText(/Net Monthly/)).toBeInTheDocument()
    expect(screen.getByText(/RRSP match is actually tax-sheltered/)).toBeInTheDocument()
  })

  it('persists the toggle in the store', () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'After-Tax' }))
    expect(useCompensationStore.getState().showAfterTax).toBe(true)
  })
})
```

Note: this test needs `defaultPrimaryPackage` exported. In `useCompensationStore.ts`, change `const defaultPrimaryPackage` to `export const defaultPrimaryPackage`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: FAIL (no After-Tax button).

- [ ] **Step 4: Implement the toggle in CompHeroWidget**

In `src/components/compensation/CompHeroWidget.tsx`:

Add imports:

```tsx
import { useTakeHomeEstimate } from '../../hooks/useTakeHomeEstimate'
import { PROVINCIAL_TAX } from '../../utils/finance/canadaTax'
```

Extend the store destructure: `const { timeMode, setTimeMode, showAfterTax, toggleAfterTax, useCadConversion } = useCompensationStore()`.

After `const totalComp = calcTotalComp(primaryPackage, timeMode)` add:

```tsx
const { takeHome, province, deductionPct } = useTakeHomeEstimate(totalComp)
const hasStockComp = primaryPackage.rsuGrants.length > 0 || primaryPackage.esppContributionPercent > 0
```

Add a third toggle group next to the existing two (same styling pattern as the time-mode toggle):

```tsx
<div className="flex bg-[var(--color-bg-primary)] rounded-md border border-[var(--color-border)] p-1">
  <button
    onClick={() => showAfterTax && toggleAfterTax()}
    className={`px-3 py-1 rounded-[4px] text-[12px] font-medium transition-colors ${!showAfterTax ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
  >
    Gross
  </button>
  <button
    onClick={() => !showAfterTax && toggleAfterTax()}
    className={`px-3 py-1 rounded-[4px] text-[12px] font-medium transition-colors ${showAfterTax ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
  >
    After-Tax
  </button>
</div>
```

Change the donut center block to:

```tsx
<span className="text-[24px] font-semibold text-[var(--color-text-primary)]">
  {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(showAfterTax ? takeHome.net : totalComp)}
</span>
<span className="text-[12px] text-[var(--color-text-secondary)]">
  {showAfterTax ? 'Est. After-Tax Compensation' : 'Total Annual Compensation'}
</span>
```

After the chart container `div` (`className="relative w-full h-[400px]"`), add the net summary row and caveat, rendered only when `showAfterTax`:

```tsx
{showAfterTax && (
  <div className="mt-4 flex flex-col gap-2">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
      <div className="rounded-lg border border-[var(--color-border)] p-3">
        <p className="text-[12px] text-[var(--color-text-secondary)]">Effective Deductions</p>
        <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">{deductionPct.toFixed(1)}%</p>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] p-3">
        <p className="text-[12px] text-[var(--color-text-secondary)]">Net Monthly</p>
        <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">
          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(takeHome.net / 12)}
        </p>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] p-3">
        <p className="text-[12px] text-[var(--color-text-secondary)]">Net Biweekly</p>
        <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">
          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(takeHome.net / 26)}
        </p>
      </div>
    </div>
    <p className="text-[12px] text-[var(--color-text-secondary)]">
      Estimate. Treats all compensation as {PROVINCIAL_TAX[province].name} employment income for the
      year. RRSP match is actually tax-sheltered; ESPP and RSU values assume sale at vest.
      {!useCadConversion && hasStockComp && ' Stock components are in USD; brackets assume CAD.'}
    </p>
  </div>
)}
```

Pie segments and the monthly bar chart are intentionally untouched.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: PASS (2 tests). Also run `npx vitest run src/pages/Compensation.test.tsx`; if it renders `CompHeroWidget` without a router, wrap that test's render in `MemoryRouter` too (deep link in Task 9 adds `useNavigate`; safe to add the wrapper now).

- [ ] **Step 6: Commit**

```bash
git add src/store/useCompensationStore.ts src/components/compensation/CompHeroWidget.tsx src/components/compensation/CompHeroWidget.test.tsx src/pages/Compensation.test.tsx
git commit -m "feat(comp): gross/after-tax toggle with net summary on hero widget"
```

---

### Task 9: Deep link to Salary & Tax with confirm

**Files:**
- Modify: `src/components/compensation/CompHeroWidget.tsx`
- Test: `src/components/compensation/CompHeroWidget.test.tsx`

**Interfaces:**
- Consumes: `usePlannerStore.getState()` (`inputs`, `setInput`), `useNavigate` from react-router-dom.
- Produces: a link-button "Full breakdown in Salary & Tax" that writes only `salary-tax.income` (rounded) and navigates to `/planner/salary-tax`. `window.confirm` gates overwriting a different saved income.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/compensation/CompHeroWidget.test.tsx`:

```tsx
import { vi } from 'vitest'

describe('CompHeroWidget salary-tax deep link', () => {
  it('writes income and navigates without confirm when no saved income', () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /full breakdown in salary & tax/i }))
    expect(usePlannerStore.getState().inputs['salary-tax']?.income).toBe(100_000)
  })

  it('asks before overwriting a different saved income and respects cancel', () => {
    usePlannerStore.setState({ inputs: { 'salary-tax': { income: 55_000, province: 'BC' } } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /full breakdown in salary & tax/i }))
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(usePlannerStore.getState().inputs['salary-tax']?.income).toBe(55_000) // untouched
    expect(usePlannerStore.getState().inputs['salary-tax']?.province).toBe('BC') // never touched
    confirmSpy.mockRestore()
  })

  it('overwrites on confirm accept', () => {
    usePlannerStore.setState({ inputs: { 'salary-tax': { income: 55_000 } } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: /full breakdown in salary & tax/i }))
    expect(usePlannerStore.getState().inputs['salary-tax']?.income).toBe(100_000)
    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: FAIL (no such button).

- [ ] **Step 3: Implement the deep link**

In `CompHeroWidget.tsx` add imports:

```tsx
import { useNavigate } from 'react-router-dom'
import { usePlannerStore } from '../../store/usePlannerStore'
import { ExternalLink } from 'lucide-react'
```

Inside the component:

```tsx
const navigate = useNavigate()

const openSalaryTax = () => {
  const { inputs, setInput } = usePlannerStore.getState()
  const saved = inputs['salary-tax']?.income
  const total = Math.round(totalComp)
  const differs = typeof saved === 'number' && Math.round(saved) !== total
  if (differs) {
    const ok = window.confirm(
      `Replace the income saved in Salary & Tax (${saved.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })}) with your total compensation (${total.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })})?`,
    )
    if (ok) setInput('salary-tax', 'income', total)
  } else {
    setInput('salary-tax', 'income', total)
  }
  navigate('/planner/salary-tax')
}
```

Render the button inside the `showAfterTax` block, after the caveat paragraph (also acceptable directly under the toggles; keep it in the after-tax block so it appears with the estimate):

```tsx
<button
  type="button"
  onClick={openSalaryTax}
  className="self-start flex items-center gap-1 text-[13px] text-[var(--color-accent)] hover:underline"
>
  <ExternalLink size={14} />
  Full breakdown in Salary & Tax
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: PASS (5 tests total). Note: the first deep-link test clicks the link while the widget is in gross mode; if the button only renders in after-tax mode, add `fireEvent.click(screen.getByRole('button', { name: 'After-Tax' }))` before each link click in the tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/compensation/CompHeroWidget.tsx src/components/compensation/CompHeroWidget.test.tsx
git commit -m "feat(comp): deep link to salary-tax with income prefill and confirm"
```

---

### Task 10: PWA icon cache-bust

**Files:**
- Rename: `public/icon-192x192.png` to `public/icon-192x192-v2.png`, `public/icon-512x512.png` to `public/icon-512x512-v2.png`, `public/icon-512x512-maskable.png` to `public/icon-512x512-maskable-v2.png`
- Modify: `vite.config.ts:24-26`

- [ ] **Step 1: Rename the icons**

```bash
git mv public/icon-192x192.png public/icon-192x192-v2.png
git mv public/icon-512x512.png public/icon-512x512-v2.png
git mv public/icon-512x512-maskable.png public/icon-512x512-maskable-v2.png
```

- [ ] **Step 2: Update the manifest**

In `vite.config.ts` replace the icons array:

```ts
        icons: [
          { src: 'icon-192x192-v2.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512-v2.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512x512-maskable-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
```

- [ ] **Step 3: Verify the build emits the new manifest**

Run: `npx vite build 2>&1 | tail -5` then `grep -o 'icon-[^"]*png' dist/manifest.webmanifest`
Expected: the three `-v2` filenames; no references to the old names.

- [ ] **Step 4: Commit**

```bash
git add public vite.config.ts
git commit -m "fix(pwa): cache-bust app icons so installs pick up the new logo"
```

---

### Task 11: Full verification and v0.7.0-beta release prep

**Files:**
- Modify: `package.json` (version)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (baseline was 338; this plan adds roughly 20).

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: both clean.

- [ ] **Step 3: Bump the version**

In `package.json` change `"version": "0.6.2-beta"` to `"version": "0.7.0-beta"`.

- [ ] **Step 4: Release commit**

```bash
git add package.json
git commit -m "chore: release v0.7.0-beta"
```

Do not push without explicit approval from Mishat. Manual QA checklist before pushing: switch each paradigm on the Budgeting page and confirm banner and flags; create and delete a reallocation; toggle Gross / After-Tax on Compensation; follow the deep link with and without a differing saved income; install/refresh the PWA and confirm the new icon (note: an existing install may need a reinstall).
