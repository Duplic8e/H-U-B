import { act, fireEvent, render, screen } from '@testing-library/react'
import { TriageInboxWidget } from './TriageInboxWidget'
import { useTriageStore } from '../../store/useTriageStore'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useUndoStore } from '../../store/useUndoStore'

const triageInitial = useTriageStore.getState()
const budgetInitial = useBudgetStore.getState()
const undoInitial = useUndoStore.getState()

beforeEach(() => {
  useTriageStore.setState(triageInitial, true)
  useBudgetStore.setState(budgetInitial, true)
  useUndoStore.setState(undoInitial, true)
})

it('undoes the complete discard effect, including transitive aliases, days and report', () => {
  const row = { id: 'a', date: '2026-08-04', amount: 10, description: 'Clean', type: 'expense' as const, importRecordId: 'a' }
  const record = { id: 'a', sourceId: 'source', original: row, decision: 'pending' as const }
  const records = {
    a: record,
    b: { ...record, id: 'b', decision: 'duplicate' as const, matchedRecordId: 'a' },
    c: { ...record, id: 'c', decision: 'duplicate' as const, matchedRecordId: 'b' },
    d: { ...record, id: 'd', decision: 'duplicate' as const, matchedTransactionId: 'a' },
    ignored: { ...record, id: 'ignored', decision: 'ignored' as const },
  }
  const removedDay = { sourceId: 'source', date: row.date, signature: 'removed', recordIds: ['a', 'b', 'c', 'd', 'ignored'] }
  const survivingDay = { sourceId: 'source', date: '2026-08-03', signature: 'surviving', recordIds: ['ignored'] }
  const report = { addedIds: ['a'], skippedIds: ['b', 'c', 'd'], changedDays: [] }
  useTriageStore.setState({ pendingTransactions: { a: row }, importRecords: records, importDays: [removedDay, survivingDay], lastImport: report })
  render(<TriageInboxWidget />)
  fireEvent.click(screen.getByRole('button', { name: 'Discard All' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Discard All' })[1])
  expect(Object.keys(useTriageStore.getState().importRecords)).toEqual(['ignored'])
  expect(useTriageStore.getState().importDays).toEqual([survivingDay])
  expect(useTriageStore.getState().lastImport).toBeNull()
  const unrelatedDay = { ...survivingDay, signature: 'unrelated', date: '2026-08-05' }
  const editedIgnored = { ...records.ignored, ignoreReason: 'manual' as const }
  act(() => {
    useTriageStore.setState({ pendingTransactions: { unrelated: { ...row, id: 'unrelated' } }, importRecords: { ignored: editedIgnored }, importDays: [survivingDay, unrelatedDay] })
    useUndoStore.getState().runUndo()
  })
  expect(useTriageStore.getState().pendingTransactions).toEqual({ a: row, unrelated: { ...row, id: 'unrelated' } })
  expect.soft(useTriageStore.getState().importRecords).toEqual({ ...records, ignored: editedIgnored })
  expect.soft(useTriageStore.getState().importDays).toEqual([removedDay, survivingDay, unrelatedDay])
  expect.soft(useTriageStore.getState().lastImport).toEqual(report)
})

it.each(['action', 'import'])('invalidates discard Undo after a subsequent %s', next => {
  const store = useTriageStore.getState()
  const sourceId = store.createImportSource('Card A')
  store.importTransactions([{ id: 'a', date: '2026-08-04', amount: 10, description: 'Clean', type: 'expense' }], sourceId)
  render(<TriageInboxWidget />)
  fireEvent.click(screen.getByRole('button', { name: 'Discard All' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Discard All' })[1])
  expect(useUndoStore.getState().pending).not.toBeNull()
  const row = { id: 'new', date: '2026-08-05', amount: 20, description: 'New', type: 'expense' as const }
  if (next === 'import') store.importTransactions([row], sourceId)
  else store.addPending([row])
  expect(useUndoStore.getState().pending).toBeNull()
  useUndoStore.getState().runUndo()
  expect(useTriageStore.getState().pendingTransactions.a).toBeUndefined()
})

describe('TriageInboxWidget', () => {
  it('renders nothing when the inbox is empty', () => {
    const { container } = render(<TriageInboxWidget />)
    expect(container).toBeEmptyDOMElement()
  })

  it('counts the pending transactions in its title', () => {
    useTriageStore.getState().addPending([
      { id: 'p1', date: '2026-08-01', amount: 12, description: 'NETFLIX', type: 'expense' },
      { id: 'p2', date: '2026-08-02', amount: 30, description: 'HYDRO', type: 'expense' },
    ])
    render(<TriageInboxWidget />)
    expect(screen.getByText('Triage Inbox (2)')).toBeInTheDocument()
  })

  it('lists each pending description', () => {
    useTriageStore.getState().addPending([
      { id: 'p1', date: '2026-08-01', amount: 12, description: 'NETFLIX', type: 'expense' },
    ])
    render(<TriageInboxWidget />)
    expect(screen.getByText('NETFLIX')).toBeInTheDocument()
  })

  it('marks duplicate rows and offers to reject them all', () => {
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-04', amount: 10, description: 'Clean', type: 'expense' },
        b: { id: 'b', date: '2026-08-04', amount: 20, description: 'Dupe', type: 'expense', duplicate: 'exact' },
      },
    })
    render(<TriageInboxWidget />)
    expect(screen.getByText('already imported')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept All (1)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reject 1 duplicate' }))
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['a'])
  })

  it('offers an undo that removes everything Accept All added', () => {
    useUndoStore.setState({ pending: null })
    useBudgetStore.setState({ transactions: {}, categories: {} })
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-04', amount: 10, description: 'Clean', type: 'expense' },
        b: { id: 'b', date: '2026-08-05', amount: 20, description: 'Also clean', type: 'expense' },
      },
    })
    render(<TriageInboxWidget />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept All (2)' }))

    expect(Object.keys(useBudgetStore.getState().transactions).sort()).toEqual(['a', 'b'])
    expect(useUndoStore.getState().pending?.label).toBe('Added 2 transactions')

    useUndoStore.getState().runUndo()
    expect(useBudgetStore.getState().transactions).toEqual({})
  })

  it('offers an undo that puts a cleared triage inbox back', () => {
    useUndoStore.setState({ pending: null })
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-04', amount: 10, description: 'Clean', type: 'expense' },
      },
    })
    render(<TriageInboxWidget />)
    fireEvent.click(screen.getByRole('button', { name: 'Discard All' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Discard All' })[1])

    expect(useTriageStore.getState().pendingTransactions).toEqual({})
    useUndoStore.getState().runUndo()
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['a'])
  })

  it('shows the existing bank entry and resolves a possible match with Same charge', () => {
    const store = useTriageStore.getState()
    const sourceId = store.createImportSource('Card A')
    store.importTransactions([{ id: 'a', date: '2026-06-10', amount: 5, description: 'Coffee', type: 'expense' }], sourceId)
    store.approveAll()
    store.importTransactions([{ id: 'b', date: '2026-06-10', amount: 5, description: 'Coffee shop', type: 'expense' }], sourceId)
    render(<TriageInboxWidget />)
    expect(screen.getByText(/Existing: Coffee/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Same charge' }))
    expect(useTriageStore.getState().importRecords.b.decision).toBe('duplicate')
    expect(Object.keys(useBudgetStore.getState().transactions)).toEqual(['a'])
  })

  it('allows Keep both and restores import decisions on undo', () => {
    const store = useTriageStore.getState()
    const sourceId = store.createImportSource('Card A')
    store.importTransactions([{ id: 'a', date: '2026-06-10', amount: 5, description: 'Coffee', type: 'expense' }], sourceId)
    store.approveAll()
    store.importTransactions([{ id: 'b', date: '2026-06-10', amount: 5, description: 'Coffee shop', type: 'expense' }], sourceId)
    render(<TriageInboxWidget />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep both' }))
    expect(Object.keys(useBudgetStore.getState().transactions)).toEqual(['a', 'b'])
    useUndoStore.getState().runUndo()
    expect(useTriageStore.getState().importRecords.b.decision).toBe('pending')
    expect(Object.keys(useBudgetStore.getState().transactions)).toEqual(['a'])
  })
})

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
    fireEvent.click(screen.getByRole('button', { name: 'Reject 1 Card Payment' }))
    expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['a'])
  })

  it('offers Undo for bulk card-payment exclusions and restores the pending decision', () => {
    const store = useTriageStore.getState()
    const sourceId = store.createImportSource('Card A')
    store.importTransactions([{ id: 'payment', date: '2026-06-10', amount: 50, description: 'Payment', type: 'income', flag: 'card-payment' }], sourceId)
    render(<TriageInboxWidget />)
    fireEvent.click(screen.getByRole('button', { name: 'Reject 1 Card Payment' }))
    expect(useTriageStore.getState().importRecords.payment.decision).toBe('ignored')
    useUndoStore.getState().runUndo()
    expect(useTriageStore.getState().importRecords.payment.decision).toBe('pending')
  })

  it('offers no card payment button when nothing is flagged', () => {
    useTriageStore.setState({
      pendingTransactions: {
        a: { id: 'a', date: '2026-08-22', amount: 4.29, description: 'LIDL', type: 'expense' },
      },
    })
    render(<TriageInboxWidget />)
    expect(screen.queryByRole('button', { name: /card payment/i })).not.toBeInTheDocument()
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

describe('TriageInboxWidget negative expenses', () => {
  it('renders a refund as a positive figure rather than a double minus', () => {
    useTriageStore.setState({
      pendingTransactions: {
        r: { id: 'r', date: '2026-08-15', amount: -39.99, description: 'AMAZON MKTPLACE PMTS', type: 'expense' },
      },
    })
    render(<TriageInboxWidget />)
    expect(screen.getByText('+$40')).toBeInTheDocument()
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

function seedHeld(duplicate = false, flag = false) {
  const store = useTriageStore.getState()
  const sourceId = store.createImportSource('Card A')
  store.importTransactions([{ id: 'held', date: '2026-06-10', amount: 50, description: 'PAYMENT', type: 'income', ...(flag ? {flag: 'card-payment' as const} : {}) }], sourceId)
  store.saveExclusionRule({ name: 'Payments', sourceId, description: {operator: 'exact', value: 'PAYMENT'}, direction: 'in', amount: {operator: 'any'}, behavior: 'review' }, { applyPending: true })
  if (duplicate) store.updatePending('held', {duplicate: 'possible'})
}

it('shows rule reasons and includes only the user hold with exact Undo', () => {
  seedHeld(false, true)
  const before = useTriageStore.getState().importRecords.held
  render(<TriageInboxWidget />)
  expect(screen.getByText('Matches exclusion rule: Payments')).toBeInTheDocument()
  expect(screen.getByRole('button', {name: 'Accept All (0)'})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', {name: 'Include this transaction'}))
  expect(useTriageStore.getState().pendingTransactions.held.exclusionMatches).toBeUndefined()
  expect(useTriageStore.getState().pendingTransactions.held.flag).toBe('card-payment')
  useUndoStore.getState().runUndo()
  expect(useTriageStore.getState().importRecords.held).toEqual(before)
})

it('excludes matching rows with a reason and restores exact metadata on Undo', () => {
  seedHeld()
  const before = useTriageStore.getState().importRecords.held
  render(<TriageInboxWidget />)
  fireEvent.click(screen.getByRole('button', {name: 'Exclude'}))
  expect(useTriageStore.getState().importRecords.held.ignoreReason).toBe('rule')
  useUndoStore.getState().runUndo()
  expect(useTriageStore.getState().importRecords.held).toEqual(before)
})

it('keeps possible duplicates outside the exclusion batch', () => {
  seedHeld(true)
  render(<TriageInboxWidget />)
  expect(screen.queryByRole('button', {name: /Exclude matches/})).toBeNull()
  expect(screen.getByRole('button', {name: 'Same charge'})).toBeInTheDocument()
})

it('seeds a similar-transactions rule from the original bank description', () => {
  seedHeld()
  useTriageStore.getState().updatePending('held', {description: 'Edited merchant'})
  render(<TriageInboxWidget />)
  fireEvent.click(screen.getByRole('button', {name: 'Exclude similar transactions'}))
  expect(screen.getByLabelText('Bank Description')).toHaveValue('PAYMENT')
})

it('explains why legacy rows cannot create a sourced rule', () => {
  useTriageStore.getState().addPending([{id:'legacy',date:'2026-06-10',amount:5,description:'Legacy',type:'expense'}])
  render(<TriageInboxWidget />)
  expect(screen.getByText('Source information unavailable')).toBeInTheDocument()
  expect(screen.getByRole('button', {name:'Exclude similar transactions'})).toBeDisabled()
})

it('batch excludes only sourced held rows and restores their snapshots without touching unrelated work', () => {
  seedHeld()
  const store = useTriageStore.getState(), sourceId = store.importRecords.held.sourceId
  store.importTransactions([{id:'second',date:'2026-06-11',amount:50,description:'PAYMENT',type:'income'}],sourceId)
  const before = useTriageStore.getState().importRecords
  store.updatePending('second', {duplicate:'possible'})
  render(<TriageInboxWidget />)
  fireEvent.click(screen.getByRole('button',{name:'Exclude matches (1)'}))
  expect(useTriageStore.getState().pendingTransactions.held).toBeUndefined()
  expect(useTriageStore.getState().pendingTransactions.second.duplicate).toBe('possible')
  // Merge an unrelated change without invalidating the fresh Undo.
  useTriageStore.setState(state => ({pendingTransactions:{...state.pendingTransactions,unrelated:{id:'unrelated',date:'2026-06-12',description:'New',amount:3,type:'expense'}}}))
  useUndoStore.getState().runUndo()
  expect(useTriageStore.getState().importRecords.held).toEqual(before.held)
  expect(useTriageStore.getState().pendingTransactions.unrelated).toBeDefined()
})

it('keeps unavailable sources out of the batch exclusion action', () => {
  seedHeld()
  useTriageStore.setState({importSources:{}})
  render(<TriageInboxWidget />)
  expect(screen.queryByRole('button',{name:/Exclude matches/})).toBeNull()
})


it('reviews incoming treatment and expense category before acceptance, with real undo and repeat import', () => {
  useBudgetStore.setState({ categories: { g: { id: 'g', name: 'Groceries', groupId: 'food', targetAmount: 0 }, s: { id: 's', name: 'Salary', groupId: 'income', targetAmount: 0 } }, categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' }, income: { id: 'income', name: 'Income', kind: 'income' } } })
  const store = useTriageStore.getState()
  const source = store.createImportSource('Bank')
  const row = { id: 'receipt', date: '2026-10-13', amount: 40, description: 'Transfer', type: 'income' as const, categoryId: 's' }
  store.importTransactions([row], source)
  store.addPending([{ ...row, id: 'purchase', description: 'Purchase', type: 'expense', categoryId: '' }])
  render(<TriageInboxWidget />)
  expect(screen.queryByRole('button', { name: 'Treatment for Purchase' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Treatment for Transfer' }))
  fireEvent.click(screen.getByRole('option', { name: 'Refunds & Payments' }))
  expect(screen.getByText('Choose an expense category before accepting this payment')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Approve Transfer' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Accept All (1)' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Category for Transfer' }))
  expect(screen.queryByRole('option', { name: 'Salary' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: 'Groceries' }))
  fireEvent.click(screen.getByRole('button', { name: 'Approve Transfer' }))
  expect(useBudgetStore.getState().transactions.receipt.amount).toBe(-40)
  act(() => useUndoStore.getState().runUndo())
  expect(useBudgetStore.getState().transactions.receipt).toBeUndefined()
  expect(useTriageStore.getState().pendingTransactions.receipt).toMatchObject({ amount: -40, categoryId: 'g' })
  act(() => store.importTransactions([{ ...row, id: 'repeat' }], source))
  expect(useTriageStore.getState().pendingTransactions.repeat).toBeUndefined()
  expect(useTriageStore.getState().importRecords.receipt.original).toEqual(row)
})

it('keeps existing refunds editable while disabled and displays incompatible guesses as uncategorized', () => {
  useBudgetStore.setState({ refundsAndPaymentsEnabled: false, categories: { s: { id: 's', name: 'Salary', groupId: 'income', targetAmount: 0 } }, categoryGroups: { income: { id: 'income', name: 'Income', kind: 'income' } } })
  useTriageStore.getState().addPending([{ id: 'r', date: '2026-10-13', amount: -40, description: 'Refund', type: 'expense', categoryId: 's' }, { id: 'i', date: '2026-10-13', amount: 40, description: 'Income', type: 'income' }])
  render(<TriageInboxWidget />)
  expect(screen.getByRole('button', { name: 'Category for Refund' })).toHaveTextContent('Uncategorized')
  fireEvent.click(screen.getByRole('button', { name: 'Treatment for Income' }))
  expect(screen.queryByRole('option', { name: 'Refunds & Payments' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: 'Income' }))
  fireEvent.click(screen.getByRole('button', { name: 'Treatment for Refund' }))
  expect(screen.getByRole('option', { name: 'Refunds & Payments' })).toBeInTheDocument()
})


it('keeps explicitly classified card payments out of the displayed Accept All count', () => {
  useBudgetStore.setState({ categories: { g: { id: 'g', name: 'Groceries', groupId: 'food', targetAmount: 0 } }, categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' } } })
  const store = useTriageStore.getState()
  store.addPending([{ id: 'card', date: '2026-10-13', amount: 40, description: 'Card payment', type: 'income', flag: 'card-payment' }])
  render(<TriageInboxWidget />)
  fireEvent.click(screen.getByRole('button', { name: 'Treatment for Card payment' }))
  fireEvent.click(screen.getByRole('option', { name: 'Refunds & Payments' }))
  fireEvent.click(screen.getByRole('button', { name: 'Category for Card payment' }))
  fireEvent.click(screen.getByRole('option', { name: 'Groceries' }))
  expect(screen.getByRole('button', { name: 'Accept All (0)' })).toBeDisabled()
  expect(store.approveAll()).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Approve Card payment' }))
  expect(useBudgetStore.getState().transactions.card.amount).toBe(-40)
})


it.each(['income', 'expense'] as const)('requires deliberate category review of a persisted incompatible %s guess', type => {
  useBudgetStore.setState({ categories: { g: { id: 'g', name: 'Groceries', groupId: 'food', targetAmount: 0 }, s: { id: 's', name: 'Salary', groupId: 'earn', targetAmount: 0 } }, categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' }, earn: { id: 'earn', name: 'Income', kind: 'income' } } })
  const row = { id: 'legacy', date: '2026-10-13', amount: 40, description: 'Legacy', type, categoryId: type === 'income' ? 'g' : 's' }
  useTriageStore.setState({ pendingTransactions: { legacy: row, duplicate: { ...row, id: 'duplicate', description: 'Duplicate', duplicate: 'possible' } } })
  render(<TriageInboxWidget />)
  expect(screen.getByRole('button', { name: 'Approve Legacy' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Keep both' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Accept All (0)' })).toBeDisabled()
  expect(screen.getAllByText('Review this category before accepting. Choose a valid category or Uncategorized.')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Category for Legacy' }))
  fireEvent.click(screen.getByRole('option', { name: 'Uncategorized' }))
  expect(screen.getByRole('button', { name: 'Accept All (1)' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Approve Legacy' }))
  expect(useBudgetStore.getState().transactions.legacy.categoryId).toBe('')
  expect(useTriageStore.getState().categoryRules).toEqual({})
  fireEvent.click(screen.getByRole('button', { name: 'Category for Duplicate' }))
  fireEvent.click(screen.getByRole('option', { name: type === 'income' ? 'Salary' : 'Groceries' }))
  expect(screen.getByRole('button', { name: 'Keep both' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Keep both' }))
  expect(useBudgetStore.getState().transactions.duplicate.categoryId).toBe(type === 'income' ? 's' : 'g')
  expect(useTriageStore.getState().categoryRules.duplicate).toBe(type === 'income' ? 's' : 'g')
})
