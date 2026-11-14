import { fireEvent, render, screen } from '@testing-library/react'
import { InflationAdjusterMobile } from './InflationAdjusterMobile'
import { useInflationAdjuster } from './useInflationAdjuster'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <InflationAdjusterMobile s={useInflationAdjuster()} />

it('leads with the future cost and the purchasing power change', () => {
  render(<Harness />)
  expect(screen.getByText('Cost in 10 Years')).toBeInTheDocument()
  expect(screen.getByText('$12,801')).toBeInTheDocument()
  expect(screen.getByText('Purchasing Power Change Over 10 Years')).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
})

it('changes the years with a preset and the direction with the toggle', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '20 yrs' }))
  expect(screen.getByText('Cost in 20 Years')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: "Future $ → Today's Value" }))
  expect(screen.getByText("Worth in Today's Dollars")).toBeInTheDocument()
  expect(screen.getByLabelText('Future Amount')).toBeInTheDocument()
})
