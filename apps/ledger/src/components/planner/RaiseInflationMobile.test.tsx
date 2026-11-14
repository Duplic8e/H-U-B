import { render, screen } from '@testing-library/react'
import { RaiseInflationMobile } from './RaiseInflationMobile'
import { useRaiseInflation } from './useRaiseInflation'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <RaiseInflationMobile s={useRaiseInflation()} />

it('puts the inputs before the result and shows the real raise', () => {
  render(<Harness />)
  const order = screen.getByLabelText('Old Salary').compareDocumentPosition(screen.getByRole('status'))
  expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('1.94%')).toBeInTheDocument()
  expect(screen.getByText('Nominal Raise')).toBeInTheDocument()
  expect(screen.getByText('Real Change')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(/A real raise/)
})

it('turns the result card to the error tone when inflation outruns the raise', () => {
  usePlannerStore.getState().setInput('raise-inflation', 'inflationPct', 8)
  render(<Harness />)
  expect(screen.getByRole('status')).toHaveClass('border-error/50')
  expect(screen.getByRole('status')).toHaveTextContent(/Not a real raise/)
})
