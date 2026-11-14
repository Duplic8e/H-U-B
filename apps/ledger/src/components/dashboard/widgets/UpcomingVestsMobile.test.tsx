import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { UpcomingVestsWidget } from './UpcomingVestsWidget'
import { useCompensationStore } from '../../../store/useCompensationStore'
import { useMarketDataStore } from '../../../store/useMarketDataStore'
import { quoteKey } from '../../../services/marketData'
import { setMatchMedia, resetMatchMedia } from '../../../test-utils/matchMedia'

const initial = useCompensationStore.getState()

function grant(id: string, name: string, shares: number) {
  const nextYear = new Date().getFullYear() + 1
  return {
    id, grantName: name, grantShares: shares, grantPrice: 50,
    grantStartDate: `${nextYear - 1}-01-01`,
    vestingSchedule: { preset: '4yr-1yr-cliff' as const, totalVestMonths: 48, cliffMonths: 12, frequency: 'quarterly' as const },
  }
}

beforeEach(() => setMatchMedia(false))
afterEach(() => {
  resetMatchMedia()
  useCompensationStore.setState(initial, true)
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
})

describe('UpcomingVestsWidget on a phone', () => {
  const renderIt = () => render(<MemoryRouter><UpcomingVestsWidget /></MemoryRouter>)

  it('leads with the next vest total and folds grants that vest the same day into one entry', () => {
    useCompensationStore.setState((s) => ({
      primaryPackage: { ...s.primaryPackage, companyCurrentPrice: 100, rsuGrants: [grant('a', 'Grant A', 480), grant('b', 'Grant B', 480)] },
    }))
    renderIt()
    expect(screen.getByText(/^Next Vest · /)).toBeInTheDocument()
    expect(screen.getByText(/· 2 Grants$/)).toBeInTheDocument()
    expect(screen.queryByText('Grant A')).toBeNull()
  })

  it('prices vests from the market price when the stored price is 0', async () => {
    useCompensationStore.setState((s) => ({
      primaryPackage: { ...s.primaryPackage, companyTicker: 'ZZZ', companyCurrentPrice: 0, rsuGrants: [grant('a', 'Grant A', 480)] },
    }))
    useMarketDataStore.setState({ overrides: { [quoteKey('ZZZ')]: 100 } } as never)
    renderIt()
    // 480 shares over 48 months, vesting quarterly after a 12 month cliff, at $100: the cliff is $12,000.
    expect((await screen.findAllByText(/\$12,000/)).length).toBeGreaterThan(0)
  })

  it('keeps the empty state when nothing is upcoming', () => {
    useCompensationStore.setState((s) => ({ primaryPackage: { ...s.primaryPackage, rsuGrants: [] } }))
    renderIt()
    expect(screen.getByText('No Upcoming Vests Available')).toBeInTheDocument()
  })
})
