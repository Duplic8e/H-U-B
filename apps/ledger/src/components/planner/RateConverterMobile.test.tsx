import { fireEvent, render, screen } from '@testing-library/react'
import { RateConverterMobile } from './RateConverterMobile'
import { useRateConverter } from './useRateConverter'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <RateConverterMobile s={useRateConverter()} />

it('shows the APR to APY result and swaps direction', () => {
  render(<Harness />)
  expect(screen.getByText('Effective Annual Rate (APY)')).toBeInTheDocument()
  expect(screen.getByText('6.1678%')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Swap direction' }))
  expect(screen.getByText('Nominal Rate (APR)')).toBeInTheDocument()
  expect(screen.getByLabelText('APY')).toBeInTheDocument()
})

it('switches to the annualized return mode with its own fields', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Annualized Return (CAGR)' }))
  expect(screen.getByText('Total Return')).toBeInTheDocument()
  expect(screen.getByLabelText('Starting Value')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Swap direction' })).not.toBeInTheDocument()
})
