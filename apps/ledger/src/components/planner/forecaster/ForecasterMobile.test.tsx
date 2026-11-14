import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForecasterMobile } from './ForecasterMobile'
import { useForecasterSettings } from './useForecasterSettings'
import { usePlannerStore } from '../../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => {
  usePlannerStore.setState(initial, true)
  usePlannerStore.getState().setInput('forecaster', 'autoStart', false)
  usePlannerStore.getState().setInput('forecaster', 'manualStart', 50000)
})

const Harness = () => <MemoryRouter><ForecasterMobile data={useForecasterSettings()} /></MemoryRouter>

it('opens on the forecast with the headline figure and year presets', () => {
  render(<Harness />)
  expect(screen.getByText(/Projected Net Worth in 25 Years/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '30 yrs' }))
  expect(screen.getByText(/Projected Net Worth in 30 Years/)).toBeInTheDocument()
})

it('orders the tabs Forecast, FIRE, Risk, Plan', () => {
  render(<Harness />)
  const names = screen.getAllByRole('button', { pressed: undefined }).map((b) => b.textContent)
  const at = (n: string) => names.indexOf(n)
  expect(at('FIRE')).toBeGreaterThan(at('Forecast'))
  expect(at('Risk')).toBeGreaterThan(at('FIRE'))
  expect(at('Plan')).toBeGreaterThan(at('Risk'))
})

it('shows the chance of reaching FI once, with the simulation note behind an info button', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Risk' }))
  expect(screen.getAllByText(/Chance of Reaching/)).toHaveLength(1)
  expect(screen.getAllByText(/Median Outcome/).length).toBeGreaterThan(0)
  expect(screen.queryByText(/500 seeded simulations/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'About This Simulation' }))
  expect(screen.getByText(/500 seeded simulations/)).toBeInTheDocument()
})

it('keeps the less common assumptions folded under More Assumptions', () => {
  render(<Harness />)
  expect(screen.getByText('Inflation, Step-Up, Spread, Events')).toBeInTheDocument()
})
