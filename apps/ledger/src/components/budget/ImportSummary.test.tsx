import { fireEvent, render, screen } from '@testing-library/react'
import { ImportSummary } from './ImportSummary'
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

it('shows skipped counts and restores an ignored original through View skipped', () => {
  const store = useTriageStore.getState()
  const sourceId = store.createImportSource('Card A')
  const row = { id: 'a', date: '2026-06-10', amount: 5, description: 'Coffee', type: 'expense' as const }
  store.importTransactions([row], sourceId)
  store.rejectTransaction('a')
  store.importTransactions([{ ...row, id: 'b' }], sourceId)
  render(<ImportSummary />)
  expect(screen.getByRole('status')).toHaveTextContent('1 previously handled transaction skipped')
  fireEvent.click(screen.getByText(/View skipped/))
  expect(screen.getByText(/Card A/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review again' }))
  expect(useTriageStore.getState().pendingTransactions.a).toBeDefined()
})

it('separates automatic exclusions from review and navigates in-page', () => {
  useTriageStore.setState({lastImport:{addedIds:['a','b','c'],excludedIds:['b','c'],skippedIds:[],changedDays:[]}})
  const onViewExcluded = vi.fn()
  render(<ImportSummary onViewExcluded={onViewExcluded} />)
  expect(screen.getByRole('status')).toHaveTextContent('1 new transaction sent to review. 2 excluded by your rules.')
  fireEvent.click(screen.getByRole('button',{name:'View excluded imports'}))
  expect(onViewExcluded).toHaveBeenCalledOnce()
})

it('undoes same-ID skipped restoration without retaining a new inclusion override', () => {
  const store = useTriageStore.getState(), sourceId = store.createImportSource('Card A')
  const row = {id:'a',date:'2026-06-10',amount:5,description:'Coffee',type:'expense' as const}
  store.importTransactions([row],sourceId); store.rejectTransaction('a')
  store.importTransactions([{...row,id:'new'}],sourceId)
  const original = useTriageStore.getState().importRecords.a
  render(<ImportSummary />)
  fireEvent.click(screen.getByText(/View skipped/))
  fireEvent.click(screen.getByRole('button',{name:'Review again'}))
  useUndoStore.getState().runUndo()
  expect(useTriageStore.getState().importRecords.a).toEqual(original)
  expect(useTriageStore.getState().pendingTransactions.a).toBeUndefined()
})
