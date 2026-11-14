import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PortfolioView } from './PortfolioView'
import { usePortfolioStore, type Holding } from '../../store/usePortfolioStore'
import { installMatchMedia, resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

const mockPrices = vi.hoisted(() => new Map<string, number>())

vi.mock('../../services/marketData', () => ({
  useCurrentPrice: (ticker: string) => {
    const price = mockPrices.get(ticker)
    if (price === undefined) return { data: undefined, status: 'idle', refresh: () => {}, setManual: () => {}, clearManual: () => {} }
    return {
      data: { value: { ticker, price, currency: 'CAD', asOf: '2026-07-21T00:00:00.000Z' }, source: 'live', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    }
  },
  useFxRate: () => ({ data: undefined, status: 'idle', refresh: () => {} }),
}))

const holding = (o: Partial<Holding>): Holding => ({
  id: 'h', ticker: 'AAA', quantity: 10, avgCost: 100, currency: 'CAD', account: 'Default', ...o,
})
const initial = usePortfolioStore.getState()

const renderPhone = () => render(<MemoryRouter><PortfolioView /></MemoryRouter>)
const tickers = () => screen.getAllByRole('button', { name: /^Details for / })
  .filter((b) => b.closest('[data-testid^="portfolio-mobile-"]'))
  .map((b) => b.getAttribute('aria-label')!.replace('Details for ', ''))

describe('phone Portfolio', () => {
  beforeEach(() => {
    installMatchMedia()
    setMatchMedia(false)
    mockPrices.clear()
    mockPrices.set('UP', 150)
    mockPrices.set('DOWN', 50)
    usePortfolioStore.setState({
      holdings: [
        holding({ id: '1', ticker: 'UP', quantity: 10, avgCost: 100 }),
        holding({ id: '2', ticker: 'DOWN', quantity: 20, avgCost: 100 }),
      ],
      importedAt: '2026-01-01T00:00:00Z',
    })
  })
  afterEach(() => {
    setMatchMedia(true)
    resetMatchMedia()
    usePortfolioStore.setState(initial, true)
  })

  it('shows the value band and switches the allocation cut', () => {
    renderPhone()
    expect(screen.getByText('Holdings Value (CAD)')).toBeInTheDocument()
    const by = screen.getByRole('group', { name: 'Allocation by' })
    fireEvent.click(within(by).getByRole('button', { name: 'Currency' }))
    expect(within(by).getByRole('button', { name: 'Currency' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('caps the allocation legend at five and offers the rest', () => {
    usePortfolioStore.setState({
      holdings: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((t, i) => holding({ id: t, ticker: t, quantity: 10 + i })),
    })
    renderPhone()
    const legend = document.getElementById('allocation-legend')!
    expect(legend.querySelectorAll('li')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Show All 7 Holdings' }))
    expect(legend.querySelectorAll('li')).toHaveLength(7)
    expect(screen.queryByText(/shown in the bar/)).not.toBeInTheDocument()
  })

  it('filters to gainers and losers and keeps the selector row put', () => {
    renderPhone()
    expect(tickers()).toEqual(['UP', 'DOWN'])
    const filter = screen.getByRole('group', { name: 'Filter holdings' })
    fireEvent.click(within(filter).getByRole('button', { name: /Gainers/ }))
    expect(tickers()).toEqual(['UP'])
    fireEvent.click(within(filter).getByRole('button', { name: /Losers/ }))
    expect(tickers()).toEqual(['DOWN'])
    fireEvent.click(within(filter).getByRole('button', { name: /All/ }))
    expect(tickers()).toHaveLength(2)
  })

  it('cycles the sort and orders by P/L then name', () => {
    renderPhone()
    fireEvent.click(screen.getByRole('button', { name: /Sorted by Value/ }))
    expect(tickers()[0]).toBe('UP')
    fireEvent.click(screen.getByRole('button', { name: /Sorted by P\/L/ }))
    expect(tickers()).toEqual(['DOWN', 'UP'])
  })

  it('needs two taps to clear the portfolio', () => {
    renderPhone()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Portfolio' }))
    expect(usePortfolioStore.getState().holdings).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Clear all 2 holdings' }))
    expect(usePortfolioStore.getState().holdings).toHaveLength(0)
  })

  it('expands a row to show price, average cost and book', () => {
    renderPhone()
    const row = screen.getAllByRole('button', { name: 'Details for UP' }).find((b) => b.closest('[data-testid^="portfolio-mobile-"]'))!
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Avg cost')).toBeInTheDocument()
  })
})
