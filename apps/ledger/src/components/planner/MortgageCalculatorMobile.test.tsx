import { fireEvent, render, screen } from '@testing-library/react'
import { MortgageCalculatorMobile } from './MortgageCalculatorMobile'
import { useMortgageCalculator } from './useMortgageCalculator'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <MortgageCalculatorMobile m={useMortgageCalculator()} />

it('leads with the monthly payment and its two supporting figures', () => {
  render(<Harness />)
  expect(screen.getByText('Monthly Payment')).toBeInTheDocument()
  expect(screen.getByText('$2,668')).toBeInTheDocument()
  expect(screen.getByText('Total Interest')).toBeInTheDocument()
  expect(screen.getAllByText('Down Payment')).toHaveLength(2)
  expect(screen.getByLabelText('Home Price')).toBeInTheDocument()
})

it('switches to biweekly with its own result and hides extra payments', () => {
  render(<Harness />)
  expect(screen.getByText('Extra Payments')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Biweekly Accelerated' }))
  expect(screen.getByText('Biweekly Payment')).toBeInTheDocument()
  expect(screen.getByText('Interest Saved vs Monthly')).toBeInTheDocument()
  expect(screen.queryByText('Extra Payments')).not.toBeInTheDocument()
})

it('keeps the affordability note behind Estimation Details', () => {
  render(<Harness />)
  expect(screen.queryByText('Estimation Details')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Affordability' }))
  expect(screen.getByText('Max Home Price')).toBeInTheDocument()
  expect(screen.queryByText(/GDS estimate/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Estimation Details' }))
  expect(screen.getByText(/GDS estimate: 39% of income/)).toBeInTheDocument()
})

it('adds and removes an extra payment and shows what it saves', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: /Add/ }))
  expect(screen.getByText('Extra Payments')).toHaveTextContent('(1)')
  expect(screen.getByText('Interest Saved')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Remove extra payment' }))
  expect(screen.queryByText('Interest Saved')).not.toBeInTheDocument()
})

it('keeps the extra payments hint behind an info button', () => {
  render(<Harness />)
  expect(screen.queryByText(/Add monthly extras for a range of years/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'About Extra Payments' }))
  expect(screen.getByText(/Add monthly extras for a range of years/)).toBeInTheDocument()
})
