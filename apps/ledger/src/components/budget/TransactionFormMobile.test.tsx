import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TransactionModal } from './TransactionModal'
import { useBudgetStore } from '../../store/useBudgetStore'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

const seed = () =>
  useBudgetStore.setState({
    categoryGroups: {
      gi: { id: 'gi', name: 'Income', kind: 'income' },
      ge: { id: 'ge', name: 'Food', kind: 'expense' },
    },
    categories: {
      salary: { id: 'salary', groupId: 'gi', name: 'Salary', targetAmount: 0 },
      groceries: { id: 'groceries', groupId: 'ge', name: 'Groceries', targetAmount: 0 },
      dining: { id: 'dining', groupId: 'ge', name: 'Dining', targetAmount: 0 },
    },
    refundsAndPaymentsEnabled: true,
    transactions: {},
  })

const setAmount = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe('TransactionModal on a phone', () => {
  beforeEach(() => {
    seed()
    setMatchMedia(false)
  })
  afterEach(() => resetMatchMedia())

  it('has no Add Transaction title row, only the pinned button', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    expect(screen.queryByRole('heading', { name: 'Add Transaction' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeInTheDocument()
  })

  it('keeps the Edit Transaction title and a Save Changes button when editing', () => {
    useBudgetStore.setState({
      transactions: { t1: { id: 't1', amount: 12, categoryId: 'groceries', date: '2026-10-01', description: 'Milk', type: 'expense' } },
    })
    render(<TransactionModal isOpen onClose={() => {}} initialTransaction={useBudgetStore.getState().transactions.t1} />)
    expect(screen.getByRole('heading', { name: 'Edit Transaction' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows the core fields and keeps the extra cards closed until a Details tab is chosen', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    expect(screen.getByLabelText('Amount')).toBeInTheDocument()
    expect(screen.getByLabelText('Description (Optional)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Paid for Others')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Shared Bill' }))
    expect(screen.getByLabelText('Paid for Others')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Shared Bill' }))
    expect(screen.queryByLabelText('Paid for Others')).toBeNull()
  })

  it('saves a shared bill from the Paid for Others card with Total Paid and My Share', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    setAmount('Amount', '120')
    fireEvent.click(screen.getByRole('button', { name: 'Shared Bill' }))
    fireEvent.click(screen.getByLabelText('Paid for Others'))
    expect(screen.getByLabelText('Total Paid')).toHaveValue('120')
    fireEvent.click(screen.getByRole('button', { name: '50%' }))
    expect(screen.getByLabelText('Your share')).toHaveValue('60')
    expect(screen.getByText('$60 Owed to You')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Shared With'), { target: { value: 'Alex' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }))
    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.amount).toBe(60)
    expect(saved.shared).toEqual({ totalAmount: 120, sharedWith: 'Alex' })
  })

  it('asks who owes the rest when the total paid exceeds the share', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    setAmount('Amount', '40')
    fireEvent.click(screen.getByRole('button', { name: 'Shared Bill' }))
    fireEvent.click(screen.getByLabelText('Paid for Others'))
    setAmount('Total Paid', '100')
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter who owes you the rest of this bill.')
  })

  it('splits across categories and saves the slices', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    setAmount('Amount', '100')
    fireEvent.click(screen.getByRole('button', { name: 'Split' }))
    fireEvent.click(screen.getByLabelText('Split Across Categories'))
    fireEvent.click(screen.getByRole('button', { name: 'Slice category' }))
    fireEvent.click(screen.getByRole('option', { name: 'Dining' }))
    setAmount('Slice amount', '30')
    expect(screen.getByText(/\$70\.00 left to allocate, which stays on Groceries\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }))
    const saved = Object.values(useBudgetStore.getState().transactions)[0]
    expect(saved.splits).toEqual([{ categoryId: 'dining', amount: 30 }])
  })

  it('shows a reimbursement card for income instead of Shared Bill and Split', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    expect(screen.queryByRole('button', { name: 'Shared Bill' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reimbursement' }))
    fireEvent.click(screen.getByLabelText(/Reimbursement for a shared bill/))
    expect(screen.getByPlaceholderText('Who paid you back?')).toBeInTheDocument()
  })

  it('keeps the Refunds & Payments explanation and hides the Shared Bill tab but keeps Split', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    setAmount('Amount', '40')
    fireEvent.click(screen.getByRole('button', { name: 'Refunds & Payments' }))
    expect(screen.getByText('Reduces Groceries spending by $40.00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Shared Bill' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Split' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tags & Note' })).toBeInTheDocument()
  })

  it('explains an amount that fails validation', () => {
    render(<TransactionModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero.')
  })
})
