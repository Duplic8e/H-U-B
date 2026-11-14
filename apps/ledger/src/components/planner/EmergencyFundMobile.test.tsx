import { fireEvent, render, screen } from '@testing-library/react'
import { EmergencyFundMobile } from './EmergencyFundMobile'
import { useEmergencyFund } from './useEmergencyFund'
import { usePlannerStore } from '../../store/usePlannerStore'

const initial = usePlannerStore.getState()
beforeEach(() => usePlannerStore.setState(initial, true))

const Harness = () => <EmergencyFundMobile s={useEmergencyFund()} />

it('leads with progress, then target and gap', () => {
  render(<Harness />)
  expect(screen.getByText('28%')).toBeInTheDocument()
  expect(screen.getByText('$5,000 of $18,000')).toBeInTheDocument()
  expect(screen.getByText('Target Fund')).toBeInTheDocument()
  expect(screen.getByText('Gap to Close')).toBeInTheDocument()
  expect(screen.queryByText(/more to reach/)).not.toBeInTheDocument()
})

it('updates the target when a months preset is chosen', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '3 months' }))
  expect(screen.getByText('$5,000 of $9,000')).toBeInTheDocument()
})
