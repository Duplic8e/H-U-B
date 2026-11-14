import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PortfolioRollupWidget } from './PortfolioRollupWidget'
import { usePortfolioStore } from '../../../store/usePortfolioStore'
import { useMarketDataStore } from '../../../store/useMarketDataStore'
import { __setProviders, __resetProviders } from '../../../services/marketData/marketDataService'
import { __resetMinInterval } from '../../../services/marketData/throttle'

// The widget renders a react-router Link in its empty state. The store reset
// in this file's afterEach fires before the test framework's own unmount, so
// the (still mounted) widget briefly re-renders with no holdings; a
// MemoryRouter keeps that render safe regardless of test teardown ordering.
function renderWidget() {
  return render(
    <MemoryRouter>
      <PortfolioRollupWidget />
    </MemoryRouter>,
  )
}

const initialPortfolioState = usePortfolioStore.getState()

describe('PortfolioRollupWidget FX handling', () => {
  beforeEach(() => {
    useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
    __resetMinInterval()
  })

  afterEach(() => {
    __resetProviders()
    usePortfolioStore.setState(initialPortfolioState, true)
  })

  it('excludes a holding whose currency has no FX rate instead of silently dropping it from the total', async () => {
    __setProviders({
      fetchFxRate: async (from) => {
        if (from === 'EUR') throw new Error('no route for EUR')
        return { from, to: 'CAD', rate: 1, date: '2026-07-22', asOf: '2026-07-22T00:00:00.000Z' } as never
      },
    })
    usePortfolioStore.setState({
      holdings: [
        { id: '1', ticker: 'XIC', quantity: 10, avgCost: 100, currency: 'CAD', account: 'A' },
        { id: '2', ticker: 'ASML', quantity: 5, avgCost: 20, currency: 'EUR', account: 'A' },
      ],
      importedAt: '2026-07-22T00:00:00.000Z',
    })

    renderWidget()

    // Only the CAD holding (10 * 100 = $1,000) converts; the EUR holding has
    // no route and must show up as excluded rather than vanish from the total
    // or be silently folded in at a wrong rate.
    expect(await screen.findByText('$1,000')).toBeInTheDocument()
    expect(await screen.findByText(/1 holding left out of these totals: no exchange rate for its currency/)).toBeInTheDocument()
  })

  it('shows no excluded note when every holding currency has a rate', async () => {
    __setProviders({
      fetchFxRate: async (from) => ({
        from, to: 'CAD', rate: 1.4, date: '2026-07-22', asOf: '2026-07-22T00:00:00.000Z',
      }) as never,
    })
    usePortfolioStore.setState({
      holdings: [
        { id: '1', ticker: 'XIC', quantity: 10, avgCost: 100, currency: 'CAD', account: 'A' },
      ],
      importedAt: '2026-07-22T00:00:00.000Z',
    })

    renderWidget()

    expect(await screen.findByText('$1,000')).toBeInTheDocument()
    expect(screen.queryByText(/left out of these totals/)).toBeNull()
  })

  it('tells you how old the prices behind the rollup are', () => {
    usePortfolioStore.setState({
      holdings: [{ id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD', account: 'RRSP' }],
      importedAt: '2026-08-10T12:00:00Z',
    })
    renderWidget()
    expect(screen.getByText(/Cached|Live|imported/i)).toBeInTheDocument()
  })
})
