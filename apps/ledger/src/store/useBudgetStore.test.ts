import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { migrateBudgetState, migrateBudgetStateV3, migrateBudgetStateV4, migrateBudgetPersisted, BUDGET_PERSIST_VERSION } from './useBudgetStore'

describe('budget store migration v1 -> v2', () => {
  it('assigns kind=income to income-named groups, expense otherwise', () => {
    const v1 = {
      categoryGroups: {
        'g-2': { id: 'g-2', name: 'Income' },
        'g-h': { id: 'g-h', name: 'Housing' },
        'g-e': { id: 'g-e', name: 'Side Earnings' },
      },
    }
    const out = migrateBudgetState(v1, 1) as {
      categoryGroups: Record<string, { kind: string }>
    }
    expect(out.categoryGroups['g-2'].kind).toBe('income')
    expect(out.categoryGroups['g-e'].kind).toBe('income')
    expect(out.categoryGroups['g-h'].kind).toBe('expense')
  })
})

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

describe('budget store migration v3 -> v4', () => {
  it('opens the Setup disclosure for an existing user, leaving the rest of the payload untouched', () => {
    const v3 = {
      paradigm: 'Zero-Based',
      budgetSetupCollapsed: true,
      categoryGroups: { h: { id: 'h', name: 'Housing', kind: 'expense', budgetClass: 'need' } },
      categories: { c1: { id: 'c1', groupId: 'h', name: 'Rent', targetAmount: 1000 } },
    }
    const out = migrateBudgetStateV4(v3) as typeof v3
    expect(out.budgetSetupCollapsed).toBe(false)
    expect(out.paradigm).toBe('Zero-Based')
    expect(out.categoryGroups).toEqual(v3.categoryGroups)
    expect(out.categories).toEqual(v3.categories)
  })
})

import { getMonthlyBudgetStats, useBudgetStore } from './useBudgetStore'
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
    expect(stats.zeroBased.overspentCategoryIds).toEqual(['misc']) // rent covered by realloc, but misc (the donor) now overspends its reduced target
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
    expect(stats.unallocated).toBe(2200) // brief said 2100; corrected to match income(4000) - totalTarget(1800), consistent with zeroBased.unassigned and targetBased.buffer tests above
    expect(stats.remaining).toBe(1800 - 1900)
  })
})

describe('bulk transaction actions', () => {
  const seed = () => {
    useBudgetStore.setState({
      transactions: {
        t1: { id: 't1', date: '2026-08-01', amount: 10, description: 'A', type: 'expense' },
        t2: { id: 't2', date: '2026-08-02', amount: 20, description: 'B', type: 'expense' },
        t3: { id: 't3', date: '2026-08-03', amount: 30, description: 'C', type: 'expense', categoryId: 'keep' },
      },
    })
  }

  it('sets the category on every named transaction and leaves the rest alone', () => {
    seed()
    useBudgetStore.getState().setTransactionsCategory(['t1', 't2'], 'cat-1')
    const txs = useBudgetStore.getState().transactions
    expect(txs.t1.categoryId).toBe('cat-1')
    expect(txs.t2.categoryId).toBe('cat-1')
    expect(txs.t3.categoryId).toBe('keep')
  })

  it('ignores ids that do not exist rather than creating empty transactions', () => {
    seed()
    useBudgetStore.getState().setTransactionsCategory(['nope'], 'cat-1')
    expect(useBudgetStore.getState().transactions.nope).toBeUndefined()
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(3)
  })

  it('deletes every named transaction in one update', () => {
    seed()
    useBudgetStore.getState().deleteTransactions(['t1', 't3'])
    expect(Object.keys(useBudgetStore.getState().transactions)).toEqual(['t2'])
  })

  it('treats an empty id list as a no-op', () => {
    seed()
    useBudgetStore.getState().deleteTransactions([])
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(3)
  })
})

describe('getMonthlyBudgetStats with annual categories', () => {
  it('uses the monthly equivalent as the effective target', () => {
    useBudgetStore.setState({
      transactions: {},
      categoryGroups: { g1: { id: 'g1', name: 'Travel', kind: 'expense' } },
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Vacation', targetAmount: 2400, cadence: 'annual' },
      },
      reallocations: {},
    })
    const stats = getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 6)
    expect(stats.perCategory.c1.effectiveTarget).toBe(200)
  })

  it('applies reallocations on top of the monthly equivalent', () => {
    useBudgetStore.setState({
      transactions: {},
      categoryGroups: { g1: { id: 'g1', name: 'Travel', kind: 'expense' } },
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Vacation', targetAmount: 2400, cadence: 'annual' },
        c2: { id: 'c2', groupId: 'g1', name: 'Rent', targetAmount: 1000 },
      },
      reallocations: {
        r1: { id: 'r1', fromCategoryId: 'c2', toCategoryId: 'c1', amount: 50, date: '2026-07-05' },
      },
    })
    const stats = getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 6)
    expect(stats.perCategory.c1.effectiveTarget).toBe(250)
    expect(stats.perCategory.c2.effectiveTarget).toBe(950)
  })
})

describe('getMonthlyBudgetStats with split transactions', () => {
  it('attributes each slice to its own category and leaves the total spend unchanged', () => {
    useBudgetStore.setState({
      categoryGroups: {
        g1: { id: 'g1', name: 'Food', kind: 'expense', budgetClass: 'need' },
        g2: { id: 'g2', name: 'Shopping', kind: 'expense', budgetClass: 'want' },
      },
      categories: {
        groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 400 },
        household: { id: 'household', groupId: 'g2', name: 'Household', targetAmount: 100 },
      },
      transactions: {
        t1: {
          id: 't1',
          date: '2026-08-04',
          amount: 180,
          description: 'Costco',
          type: 'expense',
          categoryId: 'groceries',
          splits: [
            { categoryId: 'groceries', amount: 120 },
            { categoryId: 'household', amount: 60 },
          ],
        },
      },
      reallocations: {},
    })
    const stats = getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 7)
    expect(stats.spent).toBe(180)
    expect(stats.perCategory.groceries.spent).toBe(120)
    expect(stats.perCategory.household.spent).toBe(60)
  })

  it('splits the 50/30/20 buckets by slice, not by the parent category', () => {
    useBudgetStore.setState({
      categoryGroups: {
        g1: { id: 'g1', name: 'Food', kind: 'expense', budgetClass: 'need' },
        g2: { id: 'g2', name: 'Shopping', kind: 'expense', budgetClass: 'want' },
      },
      categories: {
        groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        household: { id: 'household', groupId: 'g2', name: 'Household', targetAmount: 0 },
      },
      transactions: {
        t1: {
          id: 't1',
          date: '2026-08-04',
          amount: 180,
          description: 'Costco',
          type: 'expense',
          categoryId: 'groceries',
          splits: [
            { categoryId: 'groceries', amount: 120 },
            { categoryId: 'household', amount: 60 },
          ],
        },
      },
      reallocations: {},
    })
    const stats = getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 7)
    expect(stats.fiftyThirtyTwenty.needsSpent).toBe(120)
    expect(stats.fiftyThirtyTwenty.wantsSpent).toBe(60)
  })
})

describe('budget persist migration wiring', () => {
  it('opens Budget Setup for a user whose v3 state has it collapsed', () => {
    // The defect this pins: changing the store's default only ever reached
    // fresh installs, because an existing user already has the field
    // persisted, and the old step substituted a default only when the field
    // was undefined. Testing migrateBudgetStateV4 alone passed straight
    // through that, because the bug was in which steps the version guard ran.
    const v3 = {
      transactions: { t1: { id: 't1', date: '2026-08-01', amount: 12, description: 'Coffee', type: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Everyday', targetAmount: 100 } },
      categoryGroups: { g1: { id: 'g1', name: 'Everyday', kind: 'expense' } },
      budgetSetupCollapsed: true,
    }

    const out = migrateBudgetPersisted(v3, 3) as Record<string, unknown>

    expect(out.budgetSetupCollapsed).toBe(false)
    expect(out.transactions).toEqual(v3.transactions)
    expect(out.categories).toEqual(v3.categories)
    expect(out.categoryGroups).toEqual(v3.categoryGroups)
  })

  it('leaves a payload already at the current version alone', () => {
    const current = { budgetSetupCollapsed: true, transactions: {}, categories: {}, categoryGroups: {} }
    const out = migrateBudgetPersisted(current, BUDGET_PERSIST_VERSION) as Record<string, unknown>
    expect(out.budgetSetupCollapsed).toBe(true)
  })

  it('is idempotent, so a repeated migration cannot drift', () => {
    const v3 = { budgetSetupCollapsed: true, transactions: {}, categories: {}, categoryGroups: {} }
    const once = migrateBudgetPersisted(v3, 3)
    const twice = migrateBudgetPersisted(once, 3)
    expect(twice).toEqual(once)
  })
})

describe('refund payment preference persistence', () => {
  const offset = {
    id: 'refund', date: '2026-10-12', amount: -40, description: 'Incoming payment',
    type: 'expense' as const, categoryId: 'groceries',
    splits: [{ categoryId: 'dining', amount: -15 }],
  }
  const initial = useBudgetStore.getInitialState()

  beforeEach(() => {
    localStorage.removeItem('ledger-budget')
    useBudgetStore.setState(initial, true)
  })

  afterEach(() => {
    useBudgetStore.setState(initial, true)
    localStorage.removeItem('ledger-budget')
  })

  it('starts enabled on fresh stores at persistence version 5', () => {
    expect(BUDGET_PERSIST_VERSION).toBe(5)
    expect(useBudgetStore.getInitialState().refundsAndPaymentsEnabled).toBe(true)
  })

  it.each([1, 2, 3, 4])('enables absent preferences from version %s without rewriting negative transactions', version => {
    const migrated = migrateBudgetPersisted({ transactions: { refund: offset } }, version) as Record<string, unknown>
    expect(migrated.refundsAndPaymentsEnabled).toBe(true)
    expect(migrated.transactions).toEqual({ refund: offset })
  })

  it.each([1, 2, 3, 4])('preserves explicit false from version %s', version => {
    const migrated = migrateBudgetPersisted({ refundsAndPaymentsEnabled: false, transactions: { refund: offset } }, version) as Record<string, unknown>
    expect(migrated.refundsAndPaymentsEnabled).toBe(false)
    expect(migrated.transactions).toEqual({ refund: offset })
  })

  it('persists explicit false and restores it after reload', async () => {
    useBudgetStore.getState().setRefundsAndPaymentsEnabled(false)
    const saved = localStorage.getItem('ledger-budget')!
    expect(JSON.parse(saved).state.refundsAndPaymentsEnabled).toBe(false)
    useBudgetStore.setState(initial, true)
    localStorage.setItem('ledger-budget', saved)
    await useBudgetStore.persist.rehydrate()
    expect(useBudgetStore.getState().refundsAndPaymentsEnabled).toBe(false)
    useBudgetStore.getState().setRefundsAndPaymentsEnabled(true)
    expect(useBudgetStore.getState().refundsAndPaymentsEnabled).toBe(true)
  })

  it('merges defaults into a same-version payload missing the preference and other fields', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({
      version: 5, state: { transactions: { refund: offset } },
    }))
    await useBudgetStore.persist.rehydrate()
    expect(useBudgetStore.getState().refundsAndPaymentsEnabled).toBe(true)
    expect(useBudgetStore.getState().categories).toEqual({})
    expect(useBudgetStore.getState().transactions.refund).toEqual(offset)
  })

  it('rehydrates an older disabled preference without changing signed slices', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({
      version: 4, state: { refundsAndPaymentsEnabled: false, transactions: { refund: offset } },
    }))
    await useBudgetStore.persist.rehydrate()
    expect(useBudgetStore.getState().refundsAndPaymentsEnabled).toBe(false)
    expect(useBudgetStore.getState().transactions.refund).toEqual(offset)
    expect(JSON.parse(localStorage.getItem('ledger-budget')!).version).toBe(5)
  })
})
