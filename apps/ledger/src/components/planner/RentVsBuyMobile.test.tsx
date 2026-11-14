import { fireEvent, render, screen } from '@testing-library/react'
import { RentVsBuyMobile } from './RentVsBuyMobile'
import { useRentVsBuy } from './useRentVsBuy'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <RentVsBuyMobile s={useRentVsBuy()} />

it('leads with the verdict and both costs', () => {
  render(<Harness />)
  expect(screen.getByText('Break-even')).toBeInTheDocument()
  expect(screen.getByText(/Renting by Year 15/)).toBeInTheDocument()
  expect(screen.getByText(/Buying by Year 15/)).toBeInTheDocument()
})

it('changes the horizon with a preset', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '25 yrs' }))
  expect(screen.getByText(/Renting by Year 25/)).toBeInTheDocument()
})

it('keeps the calculation note behind an info button', () => {
  render(<Harness />)
  expect(screen.queryByText(/money you never get back/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'How This Is Calculated' }))
  expect(screen.getByText(/money you never get back/)).toBeInTheDocument()
})

it('centres the chart legend', () => {
  const { container } = render(<Harness />)
  expect(container.querySelector('ul.justify-center')).not.toBeNull()
})
