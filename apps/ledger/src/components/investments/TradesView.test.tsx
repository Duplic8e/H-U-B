import { render, screen, fireEvent, within } from '@testing-library/react'
import { TradesView } from './TradesView'
import { useTradesStore } from '../../store/useTradesStore'
import { usePortfolioStore } from '../../store/usePortfolioStore'

const initialTrades = useTradesStore.getState()
const initialPortfolio = usePortfolioStore.getState()

beforeEach(() => {
  useTradesStore.setState(initialTrades, true)
  usePortfolioStore.setState(initialPortfolio, true)
})

describe('TradesView', () => {
  it('invites the first trade when the log is empty', () => {
    render(<TradesView />)
    expect(screen.getByText('No trades yet')).toBeInTheDocument()
  })

  it('records a trade from the form', () => {
    render(<TradesView />)
    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'vfv' } })
    fireEvent.change(screen.getByLabelText('Trade date'), { target: { value: '2026-03-02' } })
    const qty = screen.getByLabelText('Quantity')
    fireEvent.change(qty, { target: { value: '10' } })
    fireEvent.blur(qty)
    const price = screen.getByLabelText('Price per unit')
    fireEvent.change(price, { target: { value: '120' } })
    fireEvent.blur(price)
    fireEvent.click(screen.getByRole('button', { name: 'Add trade' }))

    const [t] = useTradesStore.getState().trades
    expect(t.ticker).toBe('VFV')
    expect(t.quantity).toBe(10)
    expect(t.price).toBe(120)
  })

  it('shows realised gain per ticker and in total', () => {
    useTradesStore.setState({
      trades: [
        { id: '1', date: '2026-01-05', ticker: 'VFV', account: 'RRSP', side: 'buy', quantity: 10, price: 100, fees: 0, currency: 'CAD' },
        { id: '2', date: '2026-02-05', ticker: 'VFV', account: 'RRSP', side: 'sell', quantity: 5, price: 150, fees: 0, currency: 'CAD' },
      ],
    })
    render(<TradesView />)
    const summary = screen.getByTestId('realized-summary')
    expect(summary.textContent).toContain('$250')
  })

  it('flags a ticker whose trade-derived quantity disagrees with the imported holding', () => {
    useTradesStore.setState({
      trades: [
        { id: '1', date: '2026-01-05', ticker: 'VFV', account: 'RRSP', side: 'buy', quantity: 10, price: 100, fees: 0, currency: 'CAD' },
      ],
    })
    usePortfolioStore.setState({
      holdings: [{ id: 'h1', ticker: 'VFV', quantity: 12, avgCost: 100, currency: 'CAD', account: 'RRSP' }],
    })
    render(<TradesView />)
    const row = screen.getByTestId('position-VFV')
    expect(within(row).getByText(/holding says 12/i)).toBeInTheDocument()
  })

  it('shows a holding that has no trades recorded at all', () => {
    useTradesStore.setState({
      trades: [
        { id: '1', date: '2026-01-05', ticker: 'VFV', account: 'RRSP', side: 'buy', quantity: 10, price: 100, fees: 0, currency: 'CAD' },
      ],
    })
    usePortfolioStore.setState({
      holdings: [
        { id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD', account: 'RRSP' },
        { id: 'h2', ticker: 'XEQT', quantity: 25, avgCost: 30, currency: 'CAD', account: 'TFSA' },
      ],
    })
    render(<TradesView />)
    const row = screen.getByTestId('position-XEQT')
    expect(within(row).getByText(/holding says 25/i)).toBeInTheDocument()
  })
})
