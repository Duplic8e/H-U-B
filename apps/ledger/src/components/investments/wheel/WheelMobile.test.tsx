import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { WheelMobile } from './WheelMobile'
import type { TickerState } from '../../../utils/investments/wheel/types'

vi.mock('../../../services/marketData', () => ({
  useCurrentPrice: () => ({ data: undefined, status: 'idle', refresh: () => {}, setManual: () => {}, clearManual: () => {} }),
}))
vi.mock('../../../hooks/useFxRates', () => ({
  useFxRates: () => ({ rates: { CAD: 1, USD: 1.4, KRW: 0.001 }, sources: {}, refresh: () => {} }),
}))

const ticker = (o: Partial<TickerState>): TickerState => ({
  ticker: 'AAA', opSharesHeld: 10, displayCost: 1000, displayRealized: 0, currentPrice: 120, marketValue: 1200,
  openPutContracts: 0, openPutStrikeSum: 0, premiumCollected: 100, hasOpenPosition: true, history: [], currency: 'USD', ...o,
})
const noop = () => {}
const base = {
  fileCount: 2, status: null, onUpload: noop, onClear: noop, onViewDetails: noop,
}
const names = () => screen.getAllByRole('button', { name: /^Details for / }).map((b) => b.getAttribute('aria-label')!.replace('Details for ', ''))

describe('WheelMobile', () => {
  afterEach(() => vi.clearAllMocks())

  it('titles the statement and ticker counts and the search box in Title Case', () => {
    render(<WheelMobile {...base} tickers={[ticker({ ticker: 'A' }), ticker({ ticker: 'B' })]} />)
    expect(screen.getByText(/2 Statements · 2 Tickers/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search Tickers')).toBeInTheDocument()
    expect(screen.queryByText('Top Premium')).not.toBeInTheDocument()
  })

  it('shows each ticker in its own currency', () => {
    render(<WheelMobile {...base} tickers={[ticker({ ticker: 'KR', currency: 'KRW', displayCost: 7141000, currentPrice: 261500, opSharesHeld: 25 })]} />)
    const row = screen.getByRole('button', { name: 'Details for KR' })
    expect(row).toHaveTextContent('KRW')
    expect(row.textContent).toContain('₩')
    expect(row.textContent).not.toContain('$')
  })

  it('totals open wheels in CAD using the exchange rates', () => {
    // USD: premium 100 -> $140 CAD. KRW: premium 100000 -> $100 CAD.
    render(<WheelMobile {...base} tickers={[
      ticker({ ticker: 'US', currency: 'USD', premiumCollected: 100 }),
      ticker({ ticker: 'KR', currency: 'KRW', premiumCollected: 100000, displayCost: 7000000, currentPrice: 1000, opSharesHeld: 1 }),
    ]} />)
    const premium = screen.getByText('Premium', { selector: 'p' }).nextElementSibling
    expect(premium).toHaveTextContent('$240')
  })

  it('switches between stock wheels, puts and closed', () => {
    render(<WheelMobile {...base} tickers={[
      ticker({ ticker: 'STK' }),
      ticker({ ticker: 'PUT', opSharesHeld: 0, hasOpenPosition: true }),
      ticker({ ticker: 'OLD', opSharesHeld: 0, hasOpenPosition: false }),
    ]} />)
    expect(names()).toEqual(['STK'])
    fireEvent.click(within(screen.getByRole('group', { name: 'Wheel status' })).getByRole('button', { name: /Puts/ }))
    expect(names()).toEqual(['PUT'])
    fireEvent.click(within(screen.getByRole('group', { name: 'Wheel status' })).getByRole('button', { name: /Closed/ }))
    expect(names()).toEqual(['OLD'])
  })

  it('searches and expands a row to the stock price field', () => {
    render(<WheelMobile {...base} tickers={[ticker({ ticker: 'AAPL' }), ticker({ ticker: 'MSFT' })]} />)
    fireEvent.change(screen.getByLabelText('Search Tickers'), { target: { value: 'ms' } })
    expect(names()).toEqual(['MSFT'])
    fireEvent.click(screen.getByRole('button', { name: 'Details for MSFT' }))
    fireEvent.click(screen.getByRole('button', { name: /Stock price for MSFT/ }))
    expect(screen.getByLabelText('Stock price for MSFT')).toBeInTheDocument()
    expect(screen.getByText('Stock Price (USD)')).toBeInTheDocument()
  })
})
