import { fireEvent, render, screen } from '@testing-library/react'
import { SavingsGoalMobile } from './SavingsGoalMobile'
import { useSavingsGoal } from './useSavingsGoal'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <SavingsGoalMobile s={useSavingsGoal()} />

it('solves for the monthly contribution by default and hides that field', () => {
  render(<Harness />)
  expect(screen.getByText('Monthly Contribution Needed')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Monthly Contribution' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Goal Amount')).toBeInTheDocument()
})

it('puts the inputs before the result', () => {
  render(<Harness />)
  const order = screen.getByLabelText('Goal Amount').compareDocumentPosition(screen.getByRole('status'))
  expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('switches what is solved and the fields that apply', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Time to Goal' }))
  expect(screen.getAllByText('Time to Goal').length).toBeGreaterThan(0)
  expect(screen.queryByRole('textbox', { name: 'Years' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Final Balance' }))
  expect(screen.queryByLabelText('Goal Amount')).not.toBeInTheDocument()
})
