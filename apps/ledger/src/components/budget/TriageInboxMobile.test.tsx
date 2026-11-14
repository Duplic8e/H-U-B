import { fireEvent, render, screen, within } from '@testing-library/react'
import { TriageInboxMobile } from './TriageInboxMobile'
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
  useBudgetStore.getState().seedDefaults()
})

const seed = () =>
  useTriageStore.setState({
    pendingTransactions: {
      a: { id: 'a', date: '2026-08-22', amount: 4.29, description: 'LIDL', type: 'expense' },
      b: { id: 'b', date: '2026-08-21', amount: 12, description: 'TIM HORTONS', type: 'expense' },
      c: { id: 'c', date: '2026-08-20', amount: 50, description: 'Payment Thank You', type: 'income', flag: 'card-payment' },
    },
  })

it('renders nothing when the inbox is empty', () => {
  const { container } = render(<TriageInboxMobile />)
  expect(container).toBeEmptyDOMElement()
})

it('shows the count and slim rows with Accept All, Select and the overflow menu', () => {
  seed()
  render(<TriageInboxMobile />)
  expect(screen.getByText('3 to Review')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Accept All \(2\)/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'More triage actions' })).toBeInTheDocument()
  expect(screen.getByText(/Card payment, not income/)).toBeInTheDocument()
})

it('approves a row from its check button', () => {
  seed()
  render(<TriageInboxMobile />)
  fireEvent.click(screen.getByRole('button', { name: 'Approve LIDL' }))
  expect(Object.keys(useTriageStore.getState().pendingTransactions)).not.toContain('a')
  expect(Object.values(useBudgetStore.getState().transactions).map((tx) => tx.description)).toContain('LIDL')
})

it('rejects card payments from the overflow menu using the capitalised label', () => {
  seed()
  render(<TriageInboxMobile />)
  fireEvent.click(screen.getByRole('button', { name: 'More triage actions' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reject 1 Card Payment' }))
  expect(Object.keys(useTriageStore.getState().pendingTransactions).sort()).toEqual(['a', 'b'])
})

it('selects rows, shows the Selected bar and accepts the selection', () => {
  seed()
  render(<TriageInboxMobile />)
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  fireEvent.click(screen.getByRole('button', { name: 'Select All Ready (2)' }))
  expect(screen.getByText('2 Selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exclude Similar Transactions' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Accept 2' }))
  expect(Object.keys(useTriageStore.getState().pendingTransactions)).toEqual(['c'])
})

it('ignores the selected rows', () => {
  seed()
  render(<TriageInboxMobile />)
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select LIDL' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))
  expect(Object.keys(useTriageStore.getState().pendingTransactions).sort()).toEqual(['b', 'c'])
})

it('Done leaves select mode and clears the selection', () => {
  seed()
  render(<TriageInboxMobile />)
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select LIDL' }))
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.queryByText(/Selected$/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
})

it('opens the review sheet when a row is tapped', () => {
  seed()
  render(<TriageInboxMobile />)
  fireEvent.click(screen.getByText('TIM HORTONS'))
  const sheet = screen.getByRole('dialog', { name: 'Review transaction' })
  expect(within(sheet).getByRole('button', { name: 'Approve' })).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Exclude Similar Transactions' })).toBeInTheDocument()
})
