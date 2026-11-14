import { fireEvent, render, screen } from '@testing-library/react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { CompoundInterestCalculator } from './CompoundInterestCalculator'

beforeEach(() => {
  localStorage.clear()
  const initialState = usePlannerStore.getState()
  usePlannerStore.setState(initialState, true)
})

describe('CompoundInterestCalculator', () => {
  it('renders inputs with defaults and the three result cards', () => {
    render(<CompoundInterestCalculator />)
    expect(screen.getByLabelText('Starting Amount')).toHaveValue('10000')
    expect(screen.getByLabelText('Monthly Contribution')).toHaveValue('500')
    expect(screen.getByLabelText('Annual Return')).toHaveValue('7')
    expect(screen.getByLabelText('Years')).toHaveValue('20')
    expect(screen.getByText('Future Value')).toBeInTheDocument()
    expect(screen.getByText('Total Contributed')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
  })

  it('shows the correct future value for zero-rate inputs', () => {
    render(<CompoundInterestCalculator />)
    fireEvent.change(screen.getByLabelText('Starting Amount'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Monthly Contribution'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Annual Return'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Years'), { target: { value: '1' } })
    // 1000 + 100 * 12 = 2200, appears in both Future Value and Total Contributed
    expect(screen.getAllByText('$2,200').length).toBeGreaterThanOrEqual(2)
  })

  it('persists edited inputs to the planner store', () => {
    render(<CompoundInterestCalculator />)
    fireEvent.change(screen.getByLabelText('Starting Amount'), { target: { value: '20000' } })
    expect(usePlannerStore.getState().inputs['compound-interest'].principal).toBe(20000)
  })

  it('restores saved inputs on remount', () => {
    usePlannerStore.getState().setInput('compound-interest', 'years', 33)
    render(<CompoundInterestCalculator />)
    expect(screen.getByLabelText('Years')).toHaveValue('33')
  })
})
