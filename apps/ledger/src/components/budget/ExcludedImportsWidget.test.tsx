import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExcludedImportsWidget } from './ExcludedImportsWidget'
import { TriageInboxWidget } from './TriageInboxWidget'
import { useTriageStore } from '../../store/useTriageStore'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useUndoStore } from '../../store/useUndoStore'
const initial = useTriageStore.getState()
const budgetInitial = useBudgetStore.getState()
const undoInitial = useUndoStore.getState()
beforeEach(() => {
  useTriageStore.setState(initial, true)
  useBudgetStore.setState(budgetInitial, true)
  useUndoStore.setState(undoInitial, true)
})
function seed() {
  const store = useTriageStore.getState()
  const sourceId = store.createImportSource('Card A')
  store.importTransactions([{id:'a', date:'2026-06-10', amount:50, description:'PAYMENT', type:'income'}], sourceId)
  const ruleId = store.saveExclusionRule({name:'Payments', sourceId, description:{operator:'exact',value:'PAYMENT'},direction:'in',amount:{operator:'any'},behavior:'automatic'}, {applyPending:true})
  store.deleteExclusionRule(ruleId)
  useTriageStore.setState({lastImport:null})
}
it('hides the history bar when no entries are excluded', () => {
  const { container } = render(<ExcludedImportsWidget />)
  expect(container.querySelector('details')).toBeNull()
})
it('keeps the collapsed history summary in the tab order without a recent report', () => {
  seed()
  const { container, rerender } = render(<ExcludedImportsWidget />)
  const summary = screen.getByText('Excluded imports (1)')
  expect(container.querySelector('details')).not.toHaveAttribute('open')
  expect(summary.tabIndex).toBe(0)
  rerender(<ExcludedImportsWidget focusRequest={1} />)
  expect(summary).toHaveFocus()
  expect(container.querySelector('details')).toHaveAttribute('open')
})
it('restores a rule exclusion with no recent report or surviving rule and offers exact Undo', () => {
  seed()
  const original = useTriageStore.getState().importRecords.a
  const { container } = render(<ExcludedImportsWidget />)
  fireEvent.click(screen.getByText(/Excluded imports/))
  expect(screen.getByText(/Rule exclusion.*Payments/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', {name:'Restore PAYMENT to review'}))
  expect(useTriageStore.getState().pendingTransactions.a.id).toBe('a')
  expect(useTriageStore.getState().importRecords.a.exclusionOverride).toBe('include')
  expect(screen.getByRole('status')).toHaveTextContent('PAYMENT restored to review')
  expect(container.querySelector('details')).toBeNull()
  useUndoStore.getState().runUndo()
  expect(useTriageStore.getState().importRecords.a).toEqual(original)
  expect(useTriageStore.getState().pendingTransactions.a).toBeUndefined()
})
it('shows prior card payments and legacy ignored history', () => {
  const store = useTriageStore.getState(), sourceId = store.createImportSource('Card A')
  store.importTransactions([{id:'card',date:'2026-06-10',amount:50,description:'Card pay',type:'income',flag:'card-payment'}, {id:'manual',date:'2026-06-11',amount:3,description:'Old ignored',type:'expense'}],sourceId)
  store.rejectTransaction('card'); store.rejectTransaction('manual')
  useTriageStore.setState({lastImport:null})
  render(<ExcludedImportsWidget />)
  fireEvent.click(screen.getByText(/Excluded imports/))
  expect(screen.getByText('Card payment')).toBeInTheDocument()
  expect(screen.getByText('Ignored once')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Restore Card pay to review'}))
  expect(useTriageStore.getState().pendingTransactions.card.flag).toBe('card-payment')
})

it('pages history in date-descending order with stable ID ties', () => {
  const store = useTriageStore.getState(), sourceId = store.createImportSource('Card A')
  const rows = Array.from({length:51}, (_, i) => ({id:`row${String(i).padStart(2,'0')}`,date:'2026-06-10',amount:i + 1,description:`Entry ${i}`,type:'expense' as const}))
  store.importTransactions(rows,sourceId)
  rows.forEach(row => store.rejectTransaction(row.id))
  render(<ExcludedImportsWidget />)
  fireEvent.click(screen.getByText(/Excluded imports/))
  expect(screen.getAllByRole('button',{name:/Restore .* to review/})).toHaveLength(50)
  expect(screen.queryByRole('button',{name:'Restore Entry 50 to review'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Show 50 more'}))
  expect(screen.getAllByRole('button',{name:/Restore .* to review/})).toHaveLength(51)
})

it('focuses the restored inbox entry', async () => {
  seed()
  render(<><TriageInboxWidget /><ExcludedImportsWidget /></>)
  fireEvent.click(screen.getByText(/Excluded imports/))
  fireEvent.click(screen.getByRole('button', {name:'Restore PAYMENT to review'}))
  await waitFor(() => expect(document.getElementById('import-review-a')).toHaveFocus())
})

it('restores every excluded import at once, with undo', () => {
  const store = useTriageStore.getState()
  const sourceId = store.createImportSource('Card B')
  store.importTransactions([
    { id: 'p1', date: '2026-06-10', amount: 5, description: 'ONE', type: 'expense' },
    { id: 'p2', date: '2026-06-11', amount: 6, description: 'TWO', type: 'expense' },
  ], sourceId)
  store.rejectTransaction('p1')
  store.rejectTransaction('p2')
  render(<ExcludedImportsWidget />)
  fireEvent.click(screen.getByRole('button', { name: 'Restore All (2)' }))
  expect(Object.keys(useTriageStore.getState().pendingTransactions).sort()).toEqual(['p1', 'p2'])
  expect(useUndoStore.getState().pending?.label).toBe('Restored 2 transactions to review')
  useUndoStore.getState().pending!.undo()
  expect(useTriageStore.getState().pendingTransactions).toEqual({})
  expect(useTriageStore.getState().importRecords.p1.decision).toBe('ignored')
})
