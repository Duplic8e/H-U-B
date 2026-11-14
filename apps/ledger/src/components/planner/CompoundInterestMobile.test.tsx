import { fireEvent, render, screen } from '@testing-library/react'
import { CompoundInterestMobile } from './CompoundInterestMobile'
import { useCompoundInterest } from './useCompoundInterest'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <CompoundInterestMobile s={useCompoundInterest()} />

it('shows the future value with its contributed and growth split', () => {
  render(<Harness />)
  expect(screen.getByText('Future Value')).toBeInTheDocument()
  expect(screen.getAllByText(/Contributed/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/Growth/).length).toBeGreaterThan(0)
})

it('changes the horizon with a year preset', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '30 yrs' }))
  expect(screen.getByLabelText('Years')).toHaveValue('30')
})

it('centres the chart legend', () => {
  const { container } = render(<Harness />)
  expect(container.querySelector('ul.justify-center')).not.toBeNull()
})
