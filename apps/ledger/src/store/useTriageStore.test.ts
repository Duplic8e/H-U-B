import { useTriageStore } from './useTriageStore'
import { useBudgetStore } from './useBudgetStore'
import type { TriageTransaction } from '../types/triage'
import { buildBackup, restoreBackup } from '../utils/backup'
import { useUndoStore } from './useUndoStore'
import { migrateTriageState } from './useTriageStore'
import type { ExclusionRuleDraft } from '../types/exclusionRules'

const triageInitial = useTriageStore.getState()
const budgetInitial = useBudgetStore.getState()
const undoInitial = useUndoStore.getState()

const sources = { a: { id: 'a', name: 'Card A' } }
const draft: ExclusionRuleDraft = {
  name: 'Payments', sourceId: 'a', description: { operator: 'exact', value: 'PAYMENT' },
  direction: 'in', amount: { operator: 'any' }, behavior: 'review',
}
const row: TriageTransaction = {
  id: 'a', date: '2026-06-10', description: 'PAYMENT', amount: 50, type: 'income',
}

beforeEach(() => {
  useTriageStore.setState(triageInitial, true)
  useBudgetStore.setState(budgetInitial, true)
  useUndoStore.setState(undoInitial, true)
})

describe('new import exclusions', () => {
  const setup = (behavior: 'review' | 'automatic' = 'review') => {
    useTriageStore.setState({ importSources: sources })
    const store = useTriageStore.getState()
    store.saveExclusionRule({ ...draft, behavior })
    return store
  }

  it('retains automatically excluded originals across repeat uploads', () => {
    const store = setup('automatic')
    expect(store.importTransactions([row], 'a').excludedIds).toEqual(['a'])
    expect(useTriageStore.getState().importRecords.a).toMatchObject({ decision: 'ignored', ignoreReason: 'rule', original: row })
    expect(useBudgetStore.getState().transactions.a).toBeUndefined()
    const repeat = store.importTransactions([{ ...row, id: 'b' }], 'a')
    expect(repeat.skippedIds).toEqual(['a'])
    expect(repeat.excludedIds).toEqual([])
  })

  it('holds review matches from both batch and ordinary approval', () => {
    const store = setup()
    store.importTransactions([row], 'a')
    expect(useTriageStore.getState().pendingTransactions.a.exclusionMatches).toHaveLength(1)
    expect(store.approveAll()).toEqual([])
    store.approveTransaction('a')
    expect(useBudgetStore.getState().transactions.a).toBeUndefined()
  })

  it('does not hold a different source', () => {
    const store = setup()
    const other = store.createImportSource('Card B')
    store.importTransactions([row], other)
    expect(useTriageStore.getState().pendingTransactions.a.exclusionMatches).toBeUndefined()
    expect(store.approveAll()).toEqual(['a'])
  })

  it('keeps possible duplicates pending despite automatic matches', () => {
    const store = setup('automatic')
    useBudgetStore.setState({ transactions: { legacy: { ...row, id: 'legacy' } } })
    expect(store.importTransactions([row], 'a').excludedIds).toEqual([])
    expect(useTriageStore.getState().pendingTransactions.a).toMatchObject({ duplicate: 'possible' })
    expect(useTriageStore.getState().importRecords.a.decision).toBe('pending')
  })

  it('prefers review when automatic and review rules overlap', () => {
    const store = setup('automatic')
    store.saveExclusionRule(draft)
    expect(store.importTransactions([row], 'a').excludedIds).toEqual([])
    expect(useTriageStore.getState().pendingTransactions.a.exclusionMatches).toHaveLength(2)
  })

  it('does not recalculate earlier pending holds or accepted history on import', () => {
    useTriageStore.setState({ importSources: sources })
    const store = useTriageStore.getState()
    store.importTransactions([row], 'a')
    store.approveAll()
    store.importTransactions([{ ...row, id: 'old', date: '2026-07-10' }], 'a')
    store.saveExclusionRule({ ...draft, behavior: 'automatic' })
    expect(store.importTransactions([{ ...row, id: 'new', date: '2026-08-10' }], 'a').excludedIds).toEqual(['new'])
    expect(useTriageStore.getState().pendingTransactions.old.exclusionMatches).toBeUndefined()
    expect(useTriageStore.getState().importRecords.a.decision).toBe('accepted')
  })

  it('validates before writes and preserves enabled state while incrementing revisions', () => {
    const store = setup()
    const id = Object.keys(useTriageStore.getState().exclusionRules)[0]
    useTriageStore.setState({ exclusionRules: { [id]: { ...useTriageStore.getState().exclusionRules[id], enabled: false } } })
    expect(store.saveExclusionRule({ ...draft, name: 'Edited' }, { id })).toBe(id)
    expect(useTriageStore.getState().exclusionRules[id]).toMatchObject({ revision: 2, enabled: false })
    const before = useTriageStore.getState()
    expect(() => store.saveExclusionRule({ ...draft, sourceId: 'missing' })).toThrow('Choose an available card or account')
    expect(() => store.saveExclusionRule(draft, { id: 'missing', applyPending: true })).toThrow()
    expect(useTriageStore.getState()).toBe(before)
  })

  it('filters runtime-invalid rules and disabled rules before import evaluation', () => {
    useTriageStore.setState({ importSources: sources, exclusionRules: {
      disabled: { ...draft, id: 'disabled', revision: 1, enabled: false, behavior: 'automatic' },
      missing: { ...draft, id: 'missing', revision: 1, enabled: true, sourceId: 'gone', behavior: 'automatic' },
      malformed: { ...draft, id: 'malformed', revision: 1, enabled: true, behavior: 'automatic', direction: 'sideways' as never },
    } })
    expect(useTriageStore.getState().importTransactions([row], 'a').excludedIds).toEqual([])
    expect(useTriageStore.getState().pendingTransactions.a.exclusionMatches).toBeUndefined()
  })
})

describe('triage exclusion persistence migration', () => {
  const sources = { a: { id: 'a', name: 'Card A' } }
  const draft: ExclusionRuleDraft = {
    name: 'Payments', sourceId: 'a', description: { operator: 'exact', value: 'PAYMENT' },
    direction: 'in', amount: { operator: 'any' }, behavior: 'review',
  }

  it.each([0, 1, 2, 3])('rehydrates version %s without losing the inbox or valid history', async version => {
    const original = pending({ id: 'accepted' })
    const importRecords = {
      accepted: { id: 'accepted', sourceId: 'a', original, decision: 'accepted' },
      ignored: { id: 'ignored', sourceId: 'a', original: { ...original, id: 'ignored' }, decision: 'ignored' },
    }
    const importDays = [{ sourceId: 'a', date: original.date, signature: 'daily-original', recordIds: ['accepted', 'ignored'] }]
    const lastImport = { addedIds: ['accepted'], skippedIds: [], changedDays: [] }
    const state = { pendingTransactions: { old: pending({ id: 'old' }) }, categoryRules: { coffee: 'c' },
      importSources: sources, importRecords, importDays, lastImport,
      ...(version === 3 ? { exclusionRules: { r: { ...draft, id: 'r', revision: 1, enabled: true } } } : {}),
    }
    localStorage.setItem('ledger-triage', JSON.stringify({ state, version }))
    await useTriageStore.persist.rehydrate()
    expect(useTriageStore.getState().pendingTransactions).toEqual(state.pendingTransactions)
    expect(useTriageStore.getState().categoryRules).toEqual(state.categoryRules)
    expect(useTriageStore.getState().importSources).toEqual(version < 2 ? {} : sources)
    expect(useTriageStore.getState().importRecords).toEqual(version < 2 ? {} : importRecords)
    expect(useTriageStore.getState().importDays).toEqual(version < 2 ? [] : importDays)
    expect(useTriageStore.getState().lastImport).toEqual(version < 2 ? null : lastImport)
    expect(useTriageStore.getState().exclusionRules).toEqual(version === 3 ? state.exclusionRules : {})
    useTriageStore.setState({ categoryRules: { coffee: 'c' } })
    expect(JSON.parse(localStorage.getItem('ledger-triage')!).version).toBe(3)
    await useTriageStore.persist.rehydrate()
    expect(useTriageStore.getState().importRecords).toEqual(version < 2 ? {} : importRecords)
  })

  it('exports a migration that handles absent state and preserves version-2 history', () => {
    expect(migrateTriageState(null, 0)).toMatchObject({ importSources: {}, importRecords: {}, importDays: [], lastImport: null, exclusionRules: {} })
    expect(migrateTriageState({ importSources: sources }, 2)).toMatchObject({ importSources: sources, exclusionRules: {} })
  })

  it.each([2, 3])('keeps malformed restored rules inert and available for correction at version %s', async version => {
    const exclusionRules = {
      valid: { ...draft, id: 'valid', revision: 1, enabled: true },
      invalid: { ...draft, id: 'invalid', revision: 1, enabled: true, direction: 'sideways' },
      revision: { ...draft, id: 'revision', revision: -1, enabled: true },
      missing: { ...draft, id: 'missing', revision: 1, enabled: true, sourceId: 'gone' },
    }
    localStorage.setItem('ledger-triage', JSON.stringify({ state: { importSources: sources, exclusionRules }, version }))
    await useTriageStore.persist.rehydrate()
    expect(useTriageStore.getState().exclusionRules.valid).toEqual(exclusionRules.valid)
    for (const id of ['invalid', 'revision', 'missing']) {
      expect(useTriageStore.getState().exclusionRules[id]).toEqual({ ...exclusionRules[id as keyof typeof exclusionRules], enabled: false })
    }
  })
})

const pending = (over: Partial<TriageTransaction> = {}): TriageTransaction => ({
  id: 't1',
  date: '2026-08-01',
  amount: 12.5,
  description: 'NETFLIX',
  type: 'expense',
  ...over,
})

describe('useTriageStore approval', () => {
  it('moves an approved transaction into the budget store and out of the inbox', () => {
    useTriageStore.getState().addPending([pending()])
    useTriageStore.getState().approveTransaction('t1')
    expect(useBudgetStore.getState().transactions.t1.description).toBe('NETFLIX')
    expect(useTriageStore.getState().pendingTransactions.t1).toBeUndefined()
  })

  it('learns a rule from an approved transaction that carries a category', () => {
    useBudgetStore.setState({ categories: { 'c-1': { id: 'c-1', name: 'Entertainment', groupId: 'expense', targetAmount: 0 } }, categoryGroups: { expense: { id: 'expense', name: 'Expenses', kind: 'expense' } } })
    useTriageStore.getState().addPending([pending({ categoryId: 'c-1' })])
    useTriageStore.getState().approveTransaction('t1')
    // Stored by merchant, so every branch and reference number matches.
    expect(useTriageStore.getState().categoryRules.netflix).toBe('c-1')
  })

  it('learns nothing from an uncategorized approval', () => {
    useTriageStore.getState().addPending([pending()])
    useTriageStore.getState().approveTransaction('t1')
    expect(useTriageStore.getState().categoryRules).toEqual({})
  })

  it('ignores an id that is not pending instead of writing an empty transaction', () => {
    useTriageStore.getState().approveTransaction('nope')
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(0)
  })

  it('approves every pending transaction at once and empties the inbox', () => {
    useTriageStore.getState().addPending([pending(), pending({ id: 't2', description: 'SPOTIFY' })])
    useTriageStore.getState().approveAll()
    expect(Object.keys(useBudgetStore.getState().transactions).sort()).toEqual(['t1', 't2'])
    expect(useTriageStore.getState().pendingTransactions).toEqual({})
  })
})

describe('useTriageStore rejection and rules', () => {
  it('rejects without writing anything to the budget store', () => {
    useTriageStore.getState().addPending([pending()])
    useTriageStore.getState().rejectTransaction('t1')
    expect(useTriageStore.getState().pendingTransactions.t1).toBeUndefined()
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(0)
  })

  it('clears the whole inbox without approving anything', () => {
    useTriageStore.getState().addPending([pending(), pending({ id: 't2' })])
    useTriageStore.getState().clearAll()
    expect(useTriageStore.getState().pendingTransactions).toEqual({})
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(0)
  })

  it('updates a pending transaction in place', () => {
    useTriageStore.getState().addPending([pending()])
    useTriageStore.getState().updatePending('t1', { categoryId: 'c-9' })
    expect(useTriageStore.getState().pendingTransactions.t1.categoryId).toBe('c-9')
  })

  it('removes only the named rule', () => {
    useTriageStore.getState().learnRule('NETFLIX', 'c-1')
    useTriageStore.getState().learnRule('SPOTIFY', 'c-2')
    useTriageStore.getState().removeRule('netflix')
    expect(useTriageStore.getState().categoryRules).toEqual({ spotify: 'c-2' })
  })
})

describe('approveAll with duplicates', () => {
  it('approves only the rows that are not flagged and returns their ids', () => {
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-04', amount: 10, description: 'Clean', type: 'expense' },
        b: { id: 'b', date: '2026-08-04', amount: 20, description: 'Dupe', type: 'expense', duplicate: 'exact' },
      },
    })
    const approved = useTriageStore.getState().approveAll()
    expect(approved).toEqual(['a'])
    expect(Object.keys(useBudgetStore.getState().transactions)).toEqual(['a'])
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['b'])
  })
})

describe('rejectDuplicates', () => {
  it('discards every flagged row and leaves the rest pending', () => {
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-04', amount: 10, description: 'Clean', type: 'expense' },
        b: { id: 'b', date: '2026-08-04', amount: 20, description: 'Dupe', type: 'expense', duplicate: 'possible' },
      },
    })
    useTriageStore.getState().rejectDuplicates()
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['a'])
  })
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

describe('remembered imports', () => {
  const coffees = (prefix: string) => [pending({ id: `${prefix}1`, amount: 5, description: 'Coffee' }), pending({ id: `${prefix}2`, amount: 5, description: 'Coffee' })]
  const importCoffees = () => {
    const store = useTriageStore.getState()
    const sourceId = store.createImportSource('Card A')
    store.importTransactions(coffees('a'), sourceId)
    return sourceId
  }

  it('remembers accepted and ignored occurrences even after the accepted amount and description change', () => {
    const sourceId = importCoffees()
    const store = useTriageStore.getState()
    store.approveTransaction('a1')
    store.rejectTransaction('a2')
    useBudgetStore.getState().updateTransaction('a1', { amount: 2.5, description: 'My coffee share', shared: { totalAmount: 5, sharedWith: 'Friend' } })
    store.importTransactions(coffees('b'), sourceId)
    expect(useTriageStore.getState().pendingTransactions).toEqual({})
    expect(useTriageStore.getState().lastImport?.skippedIds).toHaveLength(2)
    expect(useTriageStore.getState().importRecords.a1.original.amount).toBe(5)
    expect(useTriageStore.getState().importRecords.a2.decision).toBe('ignored')
  })

  it('does not duplicate rows still waiting for review', () => {
    const sourceId = importCoffees()
    useTriageStore.getState().importTransactions(coffees('b'), sourceId)
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['a1', 'a2'])
  })

  it('lets cancelled rows import again and undo cancellation restore their history', () => {
    const sourceId = importCoffees()
    const rows = Object.values(useTriageStore.getState().pendingTransactions)
    useTriageStore.getState().clearAll()
    expect(useTriageStore.getState().importRecords).toEqual({})
    expect(useTriageStore.getState().importDays).toEqual([])
    useTriageStore.getState().addPending(rows)
    useTriageStore.getState().importTransactions(coffees('b'), sourceId)
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['a1', 'a2'])
  })

  it('restores an ignored charge to review with its original bank amount', () => {
    importCoffees()
    useTriageStore.getState().rejectTransaction('a1')
    useTriageStore.getState().restoreImportRecord('a1')
    expect(useTriageStore.getState().pendingTransactions.a1.amount).toBe(5)
    expect(useTriageStore.getState().importRecords.a1.decision).toBe('pending')
  })

  it('returns accepted decisions to pending during Accept All undo', () => {
    importCoffees()
    const rows = Object.values(useTriageStore.getState().pendingTransactions)
    const ids = useTriageStore.getState().approveAll()
    useBudgetStore.getState().deleteTransactions(ids)
    useTriageStore.getState().addPending(rows)
    expect(useTriageStore.getState().importRecords.a1.decision).toBe('pending')
    expect(useTriageStore.getState().importRecords.a2.decision).toBe('pending')
  })

  it('keeps history after deletion of an accepted budget transaction', () => {
    const sourceId = importCoffees()
    useTriageStore.getState().approveAll()
    useBudgetStore.getState().deleteTransactions(['a1', 'a2'])
    useTriageStore.getState().importTransactions(coffees('b'), sourceId)
    expect(useTriageStore.getState().pendingTransactions).toEqual({})
  })

  it('tracks deliberate duplicate resolution without adding another real occurrence', () => {
    const sourceId = importCoffees()
    useTriageStore.getState().approveAll()
    useTriageStore.getState().importTransactions([...coffees('b'), pending({ id: 'extra', amount: 5, description: 'Coffee' })], sourceId)
    useTriageStore.getState().resolveDuplicate('extra')
    expect(useTriageStore.getState().importRecords.extra.decision).toBe('duplicate')
    expect(useTriageStore.getState().importRecords.extra.matchedRecordId).toBeTruthy()
  })

  it('migrates version-1 inboxes without inventing old source identity', async () => {
    localStorage.setItem('ledger-triage', JSON.stringify({ state: { pendingTransactions: { old: pending({ id: 'old' }) }, categoryRules: { coffee: 'c' } }, version: 1 }))
    await useTriageStore.persist.rehydrate()
    expect(useTriageStore.getState().pendingTransactions.old).toBeDefined()
    expect(useTriageStore.getState().importRecords).toEqual({})
    expect(useTriageStore.getState().importSources).toEqual({})
  })

  it('backs up and restores import history through the existing triage key', async () => {
    importCoffees()
    useTriageStore.getState().rejectTransaction('a1')
    const envelope = buildBackup()
    useTriageStore.setState(triageInitial, true)
    restoreBackup(envelope)
    await useTriageStore.persist.rehydrate()
    expect(useTriageStore.getState().importRecords.a1.decision).toBe('ignored')
    expect(useTriageStore.getState().importDays).toHaveLength(1)
    expect(Object.values(useTriageStore.getState().importSources)[0].name).toBe('Card A')
  })

  it('invalidates duplicate decisions that refer to cancelled pending originals', () => {
    const store = useTriageStore.getState()
    const sourceId = store.createImportSource('Card A')
    store.importTransactions([pending({ id: 'a', description: 'Coffee' })], sourceId)
    store.importTransactions([pending({ id: 'b', description: 'Coffee shop' })], sourceId)
    store.resolveDuplicate('b')
    store.clearAll()
    store.importTransactions([pending({ id: 'c', description: 'Coffee shop' })], sourceId)
    expect(useTriageStore.getState().pendingTransactions.c).toBeDefined()
    expect(useTriageStore.getState().lastImport?.skippedIds).toEqual([])
  })

  it('dismisses stale undo when another import is confirmed', () => {
    const sourceId = importCoffees()
    const rows = Object.values(useTriageStore.getState().pendingTransactions)
    useTriageStore.getState().clearAll()
    useUndoStore.getState().offerUndo('Discarded', () => useTriageStore.getState().addPending(rows))
    useTriageStore.getState().importTransactions(coffees('b'), sourceId)
    useUndoStore.getState().runUndo()
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['b1', 'b2'])
  })

  it('binds a recognized card to an existing manual source without losing its history', () => {
    const sourceId = importCoffees()
    useTriageStore.getState().approveAll()
    useTriageStore.getState().bindImportSource(sourceId, 'cibc:1234:5678')
    expect(useTriageStore.getState().createImportSource('CIBC card 5678', 'cibc:1234:5678')).toBe(sourceId)
    useTriageStore.getState().importTransactions(coffees('b'), sourceId)
    expect(useTriageStore.getState().lastImport?.skippedIds).toHaveLength(2)
  })
})


describe('incoming receipt treatment', () => {
  const setup = () => {
    useBudgetStore.setState({ categories: { groceries: { id: 'groceries', name: 'Groceries', groupId: 'food', targetAmount: 0 }, salary: { id: 'salary', name: 'Salary', groupId: 'earn', targetAmount: 0 } }, categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' }, earn: { id: 'earn', name: 'Income', kind: 'income' } } })
    return useTriageStore.getState()
  }
  it('classifies an incoming receipt without changing its original import identity and survives acceptance undo and repeat upload', () => {
    const store = setup()
    const source = store.createImportSource('Bank')
    const original = pending({ type: 'income', amount: 40, categoryId: 'salary', description: 'E-transfer' })
    store.importTransactions([original], source)
    const record = useTriageStore.getState().importRecords.t1
    store.setPendingReceiptTreatment('t1', 'refund-payment')
    expect(useTriageStore.getState().pendingTransactions.t1).toMatchObject({ type: 'expense', amount: -40, date: original.date, categoryId: undefined })
    expect(useTriageStore.getState().importRecords.t1).toEqual(record)
    store.updatePending('t1', { categoryId: 'groceries' })
    const converted = useTriageStore.getState().pendingTransactions.t1
    store.setPendingReceiptTreatment('t1', 'refund-payment')
    expect(useTriageStore.getState().pendingTransactions.t1).toBe(converted)
    store.approveTransaction('t1')
    store.approveTransaction('t1')
    expect(Object.keys(useBudgetStore.getState().transactions)).toEqual(['t1'])
    expect(useBudgetStore.getState().transactions.t1).toMatchObject({ type: 'expense', amount: -40, categoryId: 'groceries' })
    expect(useTriageStore.getState().categoryRules).toEqual({})
    useBudgetStore.getState().deleteTransactions(['t1'])
    store.addPending([converted])
    store.importTransactions([{ ...original, id: 'repeat' }], source)
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['t1'])
    store.approveAll()
    expect(useTriageStore.getState().categoryRules).toEqual({})
    store.importTransactions([{ ...original, id: 'repeat2' }], source)
    expect(Object.keys(useBudgetStore.getState().transactions)).toEqual(['t1'])
    expect(useTriageStore.getState().importRecords.t1.original).toEqual(original)
  })
  it('blocks offsets with missing, deleted, or income categories from both approvals', () => {
    const store = setup()
    for (const categoryId of [undefined, 'missing', 'salary']) {
      store.addPending([pending({ type: 'expense', amount: -40, categoryId })])
      store.approveTransaction('t1')
      expect(store.approveAll()).toEqual([])
      expect(useBudgetStore.getState().transactions.t1).toBeUndefined()
    }
  })
  it('preserves holds and never changes outgoing purchases or disabled new receipts', () => {
    const store = setup()
    store.addPending([pending(), pending({ id: 'in', type: 'income', flag: 'card-payment', duplicate: 'possible' })])
    store.setPendingReceiptTreatment('t1', 'refund-payment')
    expect(useTriageStore.getState().pendingTransactions.t1.amount).toBe(12.5)
    store.setPendingReceiptTreatment('in', 'refund-payment')
    store.updatePending('in', { categoryId: 'groceries' })
    expect(useTriageStore.getState().pendingTransactions.in).toMatchObject({ flag: 'card-payment', duplicate: 'possible', amount: -12.5 })
    expect(store.approveAll()).toEqual(['t1'])
    useBudgetStore.setState({ refundsAndPaymentsEnabled: false })
    store.setPendingReceiptTreatment('in', 'income')
    store.setPendingReceiptTreatment('in', 'refund-payment')
    expect(useTriageStore.getState().pendingTransactions.in.type).toBe('income')
    store.addPending([pending({ id: 'legacy', amount: -40, categoryId: 'groceries' })])
    store.approveTransaction('legacy')
    expect(useBudgetStore.getState().transactions.legacy.amount).toBe(-40)
    expect(useTriageStore.getState().categoryRules.NETFLIX).toBeUndefined()
  })
})


it.each(['income', 'expense'] as const)('holds a persisted incompatible %s category until deliberately cleared, without learning it', type => {
  useBudgetStore.setState({ categories: { g: { id: 'g', name: 'Groceries', groupId: 'food', targetAmount: 0 }, s: { id: 's', name: 'Salary', groupId: 'earn', targetAmount: 0 } }, categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' }, earn: { id: 'earn', name: 'Income', kind: 'income' } } })
  const store = useTriageStore.getState()
  const categoryId = type === 'income' ? 'g' : 's'
  const row = pending({ type, categoryId })
  useTriageStore.setState({ pendingTransactions: { t1: row } })
  store.approveTransaction('t1')
  expect(useBudgetStore.getState().transactions.t1).toBeUndefined()
  expect(store.approveAll()).toEqual([])
  expect(useTriageStore.getState().categoryRules).toEqual({})
  store.updatePending('t1', { categoryId: '' })
  expect(store.approveAll()).toEqual(['t1'])
  expect(useBudgetStore.getState().transactions.t1.categoryId).toBe('')
  expect(useTriageStore.getState().categoryRules).toEqual({})
})
