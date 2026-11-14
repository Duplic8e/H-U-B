import { fireEvent, render, screen } from '@testing-library/react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { SavingsGoalCalculator } from './SavingsGoalCalculator'

const initialState = usePlannerStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initialState, true)
})

function selectSolveFor(optionLabel: string) {
  fireEvent.click(screen.getByLabelText('Solve For'))
  fireEvent.click(screen.getByRole('option', { name: optionLabel }))
}

describe('SavingsGoalCalculator', () => {
  it('defaults to solving for the monthly contribution and hides that input', () => {
    render(<SavingsGoalCalculator />)
    expect(screen.getByLabelText('Solve For')).toHaveTextContent('Monthly Contribution')
    expect(screen.getByText('Monthly Contribution Needed')).toBeInTheDocument()
    expect(screen.queryByLabelText('Monthly Contribution')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Goal Amount')).toBeInTheDocument()
  })

  it('solves months and formats as years + months', () => {
    render(<SavingsGoalCalculator />)
    selectSolveFor('Time to Goal')
    fireEvent.change(screen.getByLabelText('Goal Amount'), { target: { value: '2200' } })
    fireEvent.change(screen.getByLabelText('Starting Amount'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Annual Return'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Monthly Contribution'), { target: { value: '100' } })
    // solveMonths(2200, 1000, 0, 100) === 12
    expect(screen.getByText('1y 0m')).toBeInTheDocument()
  })

  it('shows "Not reachable" when the goal cannot be met', () => {
    render(<SavingsGoalCalculator />)
    selectSolveFor('Time to Goal')
    fireEvent.change(screen.getByLabelText('Goal Amount'), { target: { value: '999999999999' } })
    fireEvent.change(screen.getByLabelText('Starting Amount'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Annual Return'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Monthly Contribution'), { target: { value: '1' } })
    expect(screen.getByText('Not reachable')).toBeInTheDocument()
  })

  it('persists the solve-for selection', () => {
    render(<SavingsGoalCalculator />)
    selectSolveFor('Required Return')
    expect(usePlannerStore.getState().inputs['savings-goal'].solveFor).toBe('rate')
  })
})
