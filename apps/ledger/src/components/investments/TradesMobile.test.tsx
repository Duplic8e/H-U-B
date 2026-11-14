import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TradesMobile } from './TradesMobile'
import { useTradesStore } from '../../store/useTradesStore'
import { usePortfolioStore } from '../../store/usePortfolioStore'
import type { Trade } from '../../types/trades'

const trade = (o: Partial<Trade>): Trade => ({
  id: 't', date: '2026-10-02', ticker: 'VFV', account: 'TFSA', side: 'buy', quantity: 10, price: 100, fees: 0, currency: 'CAD', ...o,
})
const tradesInitial = useTradesStore.getState()
const holdingsInitial = usePortfolioStore.getState()

describe('TradesMobile', () => {
  beforeEach(() => {
    useTradesStore.setState({ trades: [] })
    usePortfolioStore.setState({ holdings: [] })
  })
  afterEach(() => {
    useTradesStore.setState(tradesInitial, true)
    usePortfolioStore.setState(holdingsInitial, true)
  })

  it('shows the empty state, not sample data, when nothing is recorded', () => {
    render(<TradesMobile />)
    expect(screen.getByText('No trades yet')).toBeInTheDocument()
    expect(screen.queryByText(/Sample trades/)).not.toBeInTheDocument()
    expect(screen.getByText('Record a Trade')).toBeInTheDocument()
  })

  it('records a trade from the fold and closes it afterwards', () => {
    render(<TradesMobile />)
    const fold = screen.getByText('Record a Trade').closest('details') as HTMLDetailsElement
    fold.open = true
    fireEvent(fold, new Event('toggle'))
    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'vfv' } })
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Price per unit'), { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Trade' }))
    expect(useTradesStore.getState().trades).toHaveLength(1)
    expect(useTradesStore.getState().trades[0]).toMatchObject({ ticker: 'VFV', side: 'buy', quantity: 5, price: 120 })
    expect(fold.open).toBe(false)
  })

  it('groups the log by month, newest first, with a Delete per trade', () => {
    useTradesStore.setState({ trades: [
      trade({ id: 'a', date: '2026-08-07' }),
      trade({ id: 'b', date: '2026-10-02', side: 'sell', quantity: 4, price: 110 }),
    ] })
    render(<TradesMobile />)
    const months = screen.getAllByText(/^(August|October) 2026$/).map((e) => e.textContent)
    expect(months).toEqual(['October 2026', 'August 2026'])
    expect(screen.getByRole('button', { name: 'Delete sell of VFV on 2026-10-02' })).toBeInTheDocument()
  })

  it('flags a position that disagrees with the imported holding', () => {
    useTradesStore.setState({ trades: [trade({ quantity: 10 })] })
    usePortfolioStore.setState({ holdings: [{ id: 'h', ticker: 'VFV', quantity: 12, avgCost: 100, currency: 'CAD', account: 'TFSA' }] })
    render(<TradesMobile />)
    expect(screen.getByTestId('position-VFV')).toHaveTextContent('Holding Says 12')
  })

  it('removes a trade and offers undo', () => {
    useTradesStore.setState({ trades: [trade({ id: 'a' })] })
    render(<TradesMobile />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete buy of VFV on 2026-10-02' }))
    expect(useTradesStore.getState().trades).toHaveLength(0)
  })
})
