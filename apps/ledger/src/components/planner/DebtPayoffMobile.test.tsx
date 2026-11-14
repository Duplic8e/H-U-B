import { fireEvent, render, screen } from '@testing-library/react'
import { DebtPayoffMobile } from './DebtPayoffMobile'
import { useDebtPayoff } from './useDebtPayoff'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <DebtPayoffMobile s={useDebtPayoff()} />

it('leads with the debt-free time and its supporting figures', () => {
  render(<Harness />)
  expect(screen.getByText('Debt-free in')).toBeInTheDocument()
  expect(screen.getByText('Total Interest')).toBeInTheDocument()
  expect(screen.getByText('vs Snowball')).toBeInTheDocument()
})

it('ranks debts in payoff order and relabels when the strategy changes', () => {
  render(<Harness />)
  expect(screen.getByText('Payoff Order')).toBeInTheDocument()
  expect(screen.getByText('Highest APR First')).toBeInTheDocument()
  expect(screen.getByText('Pay First').closest('button')).toHaveTextContent('Credit Card')
  fireEvent.click(screen.getByRole('button', { name: 'Snowball (Smallest)' }))
  expect(screen.getByText('Smallest Balance First')).toBeInTheDocument()
  expect(screen.getByText('vs Avalanche')).toBeInTheDocument()
})

it('expands a debt to edit and remove it', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: /Car Loan/ }))
  expect(screen.getByLabelText('Name')).toHaveValue('Car Loan')
  fireEvent.click(screen.getByRole('button', { name: 'Remove Car Loan' }))
  expect(screen.queryByRole('button', { name: /Car Loan/ })).not.toBeInTheDocument()
})

it('adds a debt and opens it for editing', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: /Add Debt/ }))
  expect(screen.getByLabelText('Name')).toHaveValue('New Debt')
})
