import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PortfolioView } from './PortfolioView'
import { usePortfolioStore } from '../../store/usePortfolioStore'
import { __setProviders, __resetProviders } from '../../services/marketData/marketDataService'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __resetMinInterval } from '../../services/marketData/throttle'

// Separate from PortfolioView.test.tsx because this test needs the real
// useCurrentPrice/useFxRate hooks (that file mocks '../../services/marketData'
// entirely), so it can prove the quote currency actually reaches useFxRates.
const initialPortfolioState = usePortfolioStore.getState()

describe('PortfolioView quote currency wiring', () => {
  beforeEach(() => {
    useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
    __resetMinInterval()
  })

  afterEach(() => {
    __resetProviders()
    usePortfolioStore.setState(initialPortfolioState, true)
  })

  it('requests a rate for the quote currency even when it differs from the holding currency', async () => {
    __setProviders({
      fetchQuote: async () => ({
        ticker: 'ASML', price: 100, currency: 'USD', asOf: '2026-07-21T00:00:00.000Z',
      }) as never,
      fetchFxRate: async (from, to) => ({
        from, to, rate: from === 'USD' ? 1.37 : 1.47, date: '2026-07-21', asOf: '2026-07-21T00:00:00.000Z',
      }) as never,
    })
    usePortfolioStore.setState({
      holdings: [
        { id: '1', ticker: 'ASML', quantity: 1, avgCost: 50, currency: 'EUR', account: 'A' },
      ],
      importedAt: '2026-07-21T00:00:00.000Z',
    })
    render(<PortfolioView />)
    // USD only shows up here because HoldingRow reported the live quote's
    // currency upward through onPrice and PortfolioView asked useFxRates
    // for it, even though no holding is denominated in USD.
    expect(await screen.findByText(/USD 1\.3700 \(live\)/)).toBeInTheDocument()
  })
})
