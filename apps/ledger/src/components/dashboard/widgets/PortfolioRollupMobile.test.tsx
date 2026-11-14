import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PortfolioRollupWidget } from './PortfolioRollupWidget'
import { usePortfolioStore } from '../../../store/usePortfolioStore'
import { useMarketDataStore } from '../../../store/useMarketDataStore'
import { quoteKey } from '../../../services/marketData'
import { setMatchMedia, resetMatchMedia } from '../../../test-utils/matchMedia'

const initialPortfolio = usePortfolioStore.getState()
const hours = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString()

function seed() {
  usePortfolioStore.setState({
    holdings: [
      { id: '1', ticker: 'AAA', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA' },
      { id: '2', ticker: 'BBB', quantity: 10, avgCost: 100, currency: 'CAD', account: 'RRSP' },
    ],
    importedAt: '2026-08-10T12:00:00Z',
  })
  useMarketDataStore.setState({
    quotes: {
      [quoteKey('AAA')]: { value: { price: 150, currency: 'CAD' }, fetchedAt: hours(3) },
      [quoteKey('BBB')]: { value: { price: 60, currency: 'CAD' }, fetchedAt: hours(3) },
    },
    historical: {}, fx: {}, overrides: {},
  } as never)
}

beforeEach(() => { setMatchMedia(false); seed() })
afterEach(() => {
  resetMatchMedia()
  usePortfolioStore.setState(initialPortfolio, true)
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
})

describe('PortfolioRollupWidget on a phone', () => {
  const renderIt = () => render(<MemoryRouter><PortfolioRollupWidget /></MemoryRouter>)

  it('leads with the value and all-time gain, then the best and weakest holding', () => {
    renderIt()
    expect(screen.getByText('$2,100')).toBeInTheDocument()
    expect(screen.getByText(/\+\$100 \(\+5\.0%\)/)).toBeInTheDocument()
    expect(screen.getByText('Best Holding').parentElement).toHaveTextContent('AAA')
    expect(screen.getByText('Best Holding').parentElement).toHaveTextContent('+50.0%')
    expect(screen.getByText('Weakest Holding').parentElement).toHaveTextContent('BBB')
    expect(screen.getByText('Weakest Holding').parentElement).toHaveTextContent('-40.0%')
    expect(screen.getByText('2 Holdings · 2 Accounts · CAD')).toBeInTheDocument()
  })

  it('keeps the market data age behind an info button after the title, not under the card', () => {
    renderIt()
    expect(screen.queryByText(/Cached/)).toBeNull()
    expect(screen.queryByText(/Last Updated/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'About Portfolio Data' }))
    expect(screen.getByText(/^Stale Market Data \(Last Updated: 3 Hours Ago\)$/)).toBeInTheDocument()
  })
})
