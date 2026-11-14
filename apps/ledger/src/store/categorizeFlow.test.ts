import { useTriageStore } from './useTriageStore'
import { useBudgetStore } from './useBudgetStore'
import { useUndoStore } from './useUndoStore'
import type { TriageTransaction } from '../types/triage'

const triageInitial = useTriageStore.getState()
const budgetInitial = useBudgetStore.getState()
const undoInitial = useUndoStore.getState()

const row = (id: string, description: string, date: string, amount = 20, extra: Partial<TriageTransaction> = {}): TriageTransaction =>
  ({ id, description, date, amount, type: 'expense', ...extra })

beforeEach(() => {
  useTriageStore.setState(triageInitial, true)
  useBudgetStore.setState(budgetInitial, true)
  useUndoStore.setState(undoInitial, true)
  useBudgetStore.setState({
    categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' }, pay: { id: 'pay', name: 'Income', kind: 'income' } },
    categories: {
      groceries: { id: 'groceries', groupId: 'food', name: 'Groceries', targetAmount: 0 },
      coffee: { id: 'coffee', groupId: 'food', name: 'Coffee', targetAmount: 0 },
      salary: { id: 'salary', groupId: 'pay', name: 'Salary', targetAmount: 0 },
    },
  })
})

describe('categorizing a store', () => {
  it('files the chosen rows, learns the store, and files its other branches still waiting', () => {
    const store = useTriageStore.getState()
    store.addPending([
      row('recent', 'LOBLAWS #1234 TORONTO ON', '2026-11-03'),
      row('older', 'LOBLAWS #5678 NORTH YORK ON', '2025-04-02'),
      row('other', 'TIM HORTONS #22 OTTAWA ON', '2026-11-04'),
    ])
    const added = store.categorizeAndAdd(['recent'], 'groceries')
    expect(added.sort()).toEqual(['older', 'recent'])
    const budget = useBudgetStore.getState().transactions
    expect(budget.recent.categoryId).toBe('groceries')
    expect(budget.older.categoryId).toBe('groceries')
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['other'])
    expect(useTriageStore.getState().categoryRules).toEqual({ loblaws: 'groceries' })
  })

  it('files one row without teaching the store when learn is off', () => {
    const store = useTriageStore.getState()
    store.addPending([row('a', 'AMZN Mktp CA*1AA', '2026-11-01'), row('b', 'AMZN Mktp CA*2BB', '2026-11-02')])
    expect(store.categorizeAndAdd(['a'], 'coffee', { learn: false })).toEqual(['a'])
    expect(useTriageStore.getState().categoryRules).toEqual({})
    expect(useTriageStore.getState().pendingTransactions.b).toBeDefined()
  })

  it('will not file money in under a spending category', () => {
    const store = useTriageStore.getState()
    store.addPending([row('pay', 'PAYROLL ACME', '2026-11-01', 2000, { type: 'income' })])
    expect(store.categorizeAndAdd(['pay'], 'groceries')).toEqual([])
    expect(useTriageStore.getState().pendingTransactions.pay).toBeDefined()
  })

  it('leaves possible duplicates and card payments for a person even when a rule matches', () => {
    useTriageStore.setState({ categoryRules: { loblaws: 'groceries' } })
    useTriageStore.getState().addPending([
      row('dup', 'LOBLAWS #1', '2026-11-01', 20, { duplicate: 'possible' }),
      row('pay', 'LOBLAWS #2', '2026-11-01', 20, { flag: 'card-payment' }),
      row('ok', 'LOBLAWS #3', '2026-11-01'),
    ])
    expect(useTriageStore.getState().addRuleMatches()).toEqual(['ok'])
  })
})

describe('later imports', () => {
  it('file known stores straight into the budget and leave new ones waiting', () => {
    useTriageStore.setState({ importSources: { cibc: { id: 'cibc', name: 'CIBC Visa' } }, categoryRules: { 'tim hortons': 'coffee' } })
    const report = useTriageStore.getState().importTransactions([
      row('t1', 'TIM HORTONS #900 KINGSTON ON', '2026-12-01', 4),
      row('n1', 'NEW CAFE TORONTO ON', '2026-12-02', 6),
    ], 'cibc')
    expect(report.autoAddedIds).toEqual(['t1'])
    expect(useBudgetStore.getState().transactions.t1.categoryId).toBe('coffee')
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['n1'])
  })

  it('files a thousand rows in one save', () => {
    useTriageStore.setState({ categoryRules: { loblaws: 'groceries' } })
    useTriageStore.getState().addPending(Array.from({ length: 1000 }, (_, i) => row(`r${i}`, `LOBLAWS #${i}`, '2026-10-01')))
    let budgetWrites = 0
    const stop = useBudgetStore.subscribe(() => { budgetWrites++ })
    expect(useTriageStore.getState().addRuleMatches()).toHaveLength(1000)
    stop()
    expect(budgetWrites).toBe(1)
  })
})

describe('bringing set-aside and excluded rows back', () => {
  it('restores every excluded import to review in one go', () => {
    useTriageStore.setState({ importSources: { cibc: { id: 'cibc', name: 'Chequing' } } })
    useTriageStore.getState().importTransactions([
      row('x1', 'SHOP ONE', '2026-11-01'),
      row('x2', 'SHOP TWO', '2026-11-02'),
      row('x3', 'SHOP THREE', '2026-11-03'),
    ], 'cibc')
    useTriageStore.getState().rejectTransaction('x1')
    useTriageStore.getState().rejectTransaction('x2')
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['x3'])
    expect(useTriageStore.getState().restoreAllExcluded().sort()).toEqual(['x1', 'x2'])
    expect(Object.keys(useTriageStore.getState().pendingTransactions).sort()).toEqual(['x1', 'x2', 'x3'])
    expect(useTriageStore.getState().importRecords.x1.decision).toBe('pending')
    expect(useTriageStore.getState().restoreAllExcluded()).toEqual([])
  })

  it('moves set-aside transfers into the queue but leaves possible duplicates', () => {
    useTriageStore.getState().addPending([
      row('t', 'INTERNET TRANSFER 1', '2026-11-01', 100, { flag: 'card-payment' }),
      row('d', 'SHOP', '2026-11-01', 5, { flag: 'card-payment', duplicate: 'possible' }),
    ])
    expect(useTriageStore.getState().includeSetAside()).toEqual(['t'])
    expect(useTriageStore.getState().pendingTransactions.t.flag).toBeUndefined()
    expect(useTriageStore.getState().pendingTransactions.d.flag).toBe('card-payment')
  })
})
