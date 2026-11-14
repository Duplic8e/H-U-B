import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UpcomingVestsWidget } from './UpcomingVestsWidget'
import { useCompensationStore } from '../../../store/useCompensationStore'

describe('UpcomingVestsWidget', () => {
  it('shows an invitation when there are no grants', () => {
    useCompensationStore.setState((s) => ({
      primaryPackage: { ...s.primaryPackage, rsuGrants: [] },
    }))
    render(<UpcomingVestsWidget />)
    expect(screen.getByText('Upcoming Vests')).toBeTruthy()
    expect(screen.getByText('No Upcoming Vests Available')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'About Upcoming Vests' })).toBeTruthy()
  })

  it('lists future vest events sorted by date with values', () => {
    const nextYear = new Date().getFullYear() + 1
    useCompensationStore.setState((s) => ({
      primaryPackage: {
        ...s.primaryPackage,
        companyCurrentPrice: 100,
        rsuGrants: [{
          id: 'g1',
          grantName: 'New Hire',
          grantShares: 480,
          grantPrice: 50,
          grantStartDate: `${nextYear - 1}-01-01`,
          vestingSchedule: { preset: '4yr-1yr-cliff', totalVestMonths: 48, cliffMonths: 12, frequency: 'quarterly' },
        }],
      },
    }))
    render(<UpcomingVestsWidget />)
    expect(screen.getAllByText(/New Hire/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0)
  })
})
