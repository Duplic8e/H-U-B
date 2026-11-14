import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from './storageKeys'
import type {
  BudgetingParadigm,
  BudgetClass,
  Category,
  CategoryGroup,
  Reallocation,
  Transaction,
} from '../types/budget';
import { monthlyEquivalent } from '../utils/budget/cadence';
import { splitParts } from '../utils/budget/splits';

/** v1 -> v2: category groups gain a kind. Existing groups are classified by
 *  the old name heuristic once; from then on kind is explicit. */
export function migrateBudgetState(persisted: unknown, version: number): unknown {
  if (version >= 2) return persisted
  const state = persisted as { categoryGroups?: Record<string, Omit<CategoryGroup, 'kind'> & { kind?: CategoryGroup['kind'] }> }
  if (!state?.categoryGroups) return persisted
  const categoryGroups = Object.fromEntries(
    Object.entries(state.categoryGroups).map(([id, g]) => [
      id,
      {
        ...g,
        kind:
          g.kind ??
          (g.name.toLowerCase().includes('income') || g.name.toLowerCase().includes('earn')
            ? ('income' as const)
            : ('expense' as const)),
      },
    ]),
  )
  return { ...state, categoryGroups }
}

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

/** v3 -> v4: budgetSetupCollapsed's shipped default flips from collapsed to
 *  open. Every user who ever loaded the Budget page before this change
 *  already has `true` persisted, so `?? false` in the outer migrate never
 *  substitutes for them. Force the flag open once, unconditionally, since
 *  this is a one-time reset of a UI preference, not user data. */
export function migrateBudgetStateV4(persisted: unknown): unknown {
  const state = persisted as Partial<BudgetState>;
  return { ...state, budgetSetupCollapsed: false };
}

interface BudgetState {
  paradigm: BudgetingParadigm;
  transactions: Record<string, Transaction>;
  categories: Record<string, Category>;
  categoryGroups: Record<string, CategoryGroup>;
  reallocations: Record<string, Reallocation>;
  budgetSetupCollapsed: boolean;
  refundsAndPaymentsEnabled: boolean;

  setParadigm: (paradigm: BudgetingParadigm) => void;
  toggleBudgetSetup: () => void;
  setRefundsAndPaymentsEnabled: (enabled: boolean) => void;
  
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  setTransactionsCategory: (ids: string[], categoryId: string) => void;
  deleteTransactions: (ids: string[]) => void;
  clearAllTransactions: () => void;

  addCategory: (category: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addCategoryGroup: (group: CategoryGroup) => void;
  updateCategoryGroup: (id: string, updates: Partial<CategoryGroup>) => void;
  deleteCategoryGroup: (id: string) => void;

  addReallocation: (reallocation: Reallocation) => void;
  deleteReallocation: (id: string) => void;

  seedDefaults: () => void;
}

export const BUDGET_PERSIST_VERSION = 5;

/** The composition the persist config actually runs. Extracted and exported so
 *  a test can pin the wiring, not just the individual steps: the defect this
 *  chain was written to fix was a version guard that skipped a step entirely,
 *  which every per-step unit test passed straight through. */
export function migrateBudgetPersisted(persistedState: unknown, version: number): unknown {
  const persisted = persistedState as Partial<BudgetState>;
  const withDefaults = {
    ...persisted,
    budgetSetupCollapsed: persisted.budgetSetupCollapsed ?? false,
  };
  const v2 = migrateBudgetState(withDefaults, version);
  const v3 = version >= 3 ? v2 : migrateBudgetStateV3(v2);
  const v4 = version >= 4 ? v3 : migrateBudgetStateV4(v3);
  const state = v4 as Partial<BudgetState>;
  return {
    ...state,
    refundsAndPaymentsEnabled: state.refundsAndPaymentsEnabled ?? true,
  };
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set) => ({
      paradigm: 'Ledger Custom',
      transactions: {},
      categories: {},
      categoryGroups: {},
      reallocations: {},
      budgetSetupCollapsed: false,
      refundsAndPaymentsEnabled: true,

      setParadigm: (paradigm) => set({ paradigm }),
      toggleBudgetSetup: () => set((state) => ({ budgetSetupCollapsed: !state.budgetSetupCollapsed })),
      setRefundsAndPaymentsEnabled: (enabled) => set({ refundsAndPaymentsEnabled: enabled }),

      addTransaction: (transaction) =>
        set((state) => ({
          transactions: { ...state.transactions, [transaction.id]: transaction },
        })),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: {
            ...state.transactions,
            [id]: { ...state.transactions[id], ...updates },
          },
        })),
      deleteTransaction: (id) =>
        set((state) => {
          const newTransactions = { ...state.transactions };
          delete newTransactions[id];
          return { transactions: newTransactions };
        }),
      setTransactionsCategory: (ids, categoryId) =>
        set((state) => {
          const next = { ...state.transactions };
          for (const id of ids) {
            if (!next[id]) continue;
            next[id] = { ...next[id], categoryId };
          }
          return { transactions: next };
        }),
      deleteTransactions: (ids) =>
        set((state) => {
          const next = { ...state.transactions };
          for (const id of ids) delete next[id];
          return { transactions: next };
        }),
      clearAllTransactions: () => set({ transactions: {} }),

      addCategory: (category) =>
        set((state) => ({
          categories: { ...state.categories, [category.id]: category },
        })),
      updateCategory: (id, updates) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [id]: { ...state.categories[id], ...updates },
          },
        })),
      deleteCategory: (id) =>
        set((state) => {
          const newCategories = { ...state.categories };
          delete newCategories[id];
          return { categories: newCategories };
        }),

      addCategoryGroup: (group) =>
        set((state) => ({
          categoryGroups: { ...state.categoryGroups, [group.id]: group },
        })),
      updateCategoryGroup: (id, updates) =>
        set((state) => ({
          categoryGroups: {
            ...state.categoryGroups,
            [id]: { ...state.categoryGroups[id], ...updates },
          },
        })),
      deleteCategoryGroup: (id) =>
        set((state) => {
          const newGroups = { ...state.categoryGroups };
          delete newGroups[id];
          return { categoryGroups: newGroups };
        }),

      addReallocation: (reallocation) =>
        set((state) => ({
          reallocations: { ...state.reallocations, [reallocation.id]: reallocation },
        })),
      deleteReallocation: (id) =>
        set((state) => {
          const newReallocations = { ...state.reallocations };
          delete newReallocations[id];
          return { reallocations: newReallocations };
        }),

      seedDefaults: () => set((state) => {
        if (Object.keys(state.categories).length > 0) return state; // Only seed if empty
        return {
          categoryGroups: {
            'g-2': { id: 'g-2', name: 'Income', kind: 'income' },
            'b7ca0301-94c8-4c58-98d5-b94a61294a24': { id: 'b7ca0301-94c8-4c58-98d5-b94a61294a24', name: 'Housing', kind: 'expense', budgetClass: 'need' },
            '02d13ccd-9d3a-4585-ada4-5c3b9041b539': { id: '02d13ccd-9d3a-4585-ada4-5c3b9041b539', name: 'Entertainment', kind: 'expense', budgetClass: 'want' },
            '6252c9d2-7035-4a58-baf2-ef4d78de6a43': { id: '6252c9d2-7035-4a58-baf2-ef4d78de6a43', name: 'Necessities', kind: 'expense', budgetClass: 'need' },
            '616e0658-95ed-4db7-97bc-0810b94b849b': { id: '616e0658-95ed-4db7-97bc-0810b94b849b', name: 'Shopping', kind: 'expense', budgetClass: 'want' },
            'dc29db87-cfde-4c89-91e1-36a9436f6e5a': { id: 'dc29db87-cfde-4c89-91e1-36a9436f6e5a', name: 'Food', kind: 'expense', budgetClass: 'need' }
          },
          categories: {
            'c-6': { id: 'c-6', groupId: 'g-2', name: 'Salary', targetAmount: 0 },
            '9bdce21b-f12a-42a8-b064-94ebc94fea6b': { id: '9bdce21b-f12a-42a8-b064-94ebc94fea6b', groupId: 'g-2', name: 'ESPP', targetAmount: 0 },
            'f8624fe3-2323-4e21-b103-11b8a0cad757': { id: 'f8624fe3-2323-4e21-b103-11b8a0cad757', groupId: 'g-2', name: 'RSU', targetAmount: 0 },
            '4ecbc8dd-b2cd-44bb-ad66-1f5a9f1dbbb9': { id: '4ecbc8dd-b2cd-44bb-ad66-1f5a9f1dbbb9', groupId: 'g-2', name: 'Bonus', targetAmount: 0 },
            
            'b409bff3-0cba-443d-a6e0-827ada469528': { id: 'b409bff3-0cba-443d-a6e0-827ada469528', groupId: 'b7ca0301-94c8-4c58-98d5-b94a61294a24', name: 'Rent', targetAmount: 1021 },
            '9bfed7b1-b6aa-4950-af5b-afbc4087ba52': { id: '9bfed7b1-b6aa-4950-af5b-afbc4087ba52', groupId: 'b7ca0301-94c8-4c58-98d5-b94a61294a24', name: 'Utilities', targetAmount: 200 },
            
            '4e3699b4-5077-4617-81af-c5bbc228878f': { id: '4e3699b4-5077-4617-81af-c5bbc228878f', groupId: '02d13ccd-9d3a-4585-ada4-5c3b9041b539', name: 'Night Out', targetAmount: 0 },
            '51d01f29-9a0e-4032-89f1-63c6e33c8752': { id: '51d01f29-9a0e-4032-89f1-63c6e33c8752', groupId: '02d13ccd-9d3a-4585-ada4-5c3b9041b539', name: 'Dining', targetAmount: 0 },
            '468cbbb7-7571-4185-8d71-9dce157fe754': { id: '468cbbb7-7571-4185-8d71-9dce157fe754', groupId: '02d13ccd-9d3a-4585-ada4-5c3b9041b539', name: 'Events', targetAmount: 0 },
            'bdca2db9-3734-4e9c-8e19-c965b4a336e6': { id: 'bdca2db9-3734-4e9c-8e19-c965b4a336e6', groupId: '02d13ccd-9d3a-4585-ada4-5c3b9041b539', name: 'Vacation', targetAmount: 0 },
            
            '7a9e68b5-da77-4754-9f28-3a37c65c01db': { id: '7a9e68b5-da77-4754-9f28-3a37c65c01db', groupId: '6252c9d2-7035-4a58-baf2-ef4d78de6a43', name: 'Phone Bill', targetAmount: 0 },
            'ad76c6c1-7747-4083-b070-6f1d284ae644': { id: 'ad76c6c1-7747-4083-b070-6f1d284ae644', groupId: '6252c9d2-7035-4a58-baf2-ef4d78de6a43', name: 'Subscriptions', targetAmount: 0 },
            '6fbd8ccd-c8f2-4fd9-b96e-63ccfc0b84df': { id: '6fbd8ccd-c8f2-4fd9-b96e-63ccfc0b84df', groupId: '6252c9d2-7035-4a58-baf2-ef4d78de6a43', name: 'Transportation', targetAmount: 0 },
            '607e9771-8a54-489e-b1db-460cb03dabe9': { id: '607e9771-8a54-489e-b1db-460cb03dabe9', groupId: '6252c9d2-7035-4a58-baf2-ef4d78de6a43', name: 'Gym Membership', targetAmount: 0 },
            
            '9b6ce3c5-4946-4378-84e6-0b2020b27c30': { id: '9b6ce3c5-4946-4378-84e6-0b2020b27c30', groupId: '616e0658-95ed-4db7-97bc-0810b94b849b', name: 'Personal', targetAmount: 0 },
            '879ced4f-74e6-4a46-8092-010ed24d0263': { id: '879ced4f-74e6-4a46-8092-010ed24d0263', groupId: '616e0658-95ed-4db7-97bc-0810b94b849b', name: 'Gifts', targetAmount: 0 },
            
            '41d4eb7f-f576-4d1c-97b6-efdc7315df4f': { id: '41d4eb7f-f576-4d1c-97b6-efdc7315df4f', groupId: 'dc29db87-cfde-4c89-91e1-36a9436f6e5a', name: 'Groceries', targetAmount: 0 },
            'dc2dbe26-3f1c-4e76-b0ad-a3e6d5ce5ea0': { id: 'dc2dbe26-3f1c-4e76-b0ad-a3e6d5ce5ea0', groupId: 'dc29db87-cfde-4c89-91e1-36a9436f6e5a', name: 'Takeout', targetAmount: 0 }
          }
        };
      }),
    }),
    {
      name: STORAGE_KEYS.budget,
      version: BUDGET_PERSIST_VERSION,
      migrate: migrateBudgetPersisted,
    }
  )
);

// Dynamic computation selectors

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
      for (const part of splitParts(tx)) {
        if (!part.categoryId) continue;
        perCategorySpent[part.categoryId] = (perCategorySpent[part.categoryId] ?? 0) + part.amount;
      }
    } else if (tx.type === 'income') {
      if (!tx.reimbursement) totalIncome += tx.amount;
    }
  });

  // Effective targets: monthly contribution + reallocations in - reallocations
  // out (this month). Annual categories contribute one twelfth.
  const categoryEffectiveTargets: Record<string, number> = {};
  Object.values(state.categories).forEach((cat) => {
    categoryEffectiveTargets[cat.id] = monthlyEquivalent(cat);
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
    const effectiveTarget = categoryEffectiveTargets[cat.id] ?? monthlyEquivalent(cat);
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
    for (const part of splitParts(tx)) {
      const cat = part.categoryId ? state.categories[part.categoryId] : undefined;
      const group = cat ? state.categoryGroups[cat.groupId] : undefined;
      const cls = group?.budgetClass;
      if (cls === 'want') wantsSpent += part.amount;
      else if (cls === 'savings') savingsSpent += part.amount;
      else needsSpent += part.amount;
    }
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
