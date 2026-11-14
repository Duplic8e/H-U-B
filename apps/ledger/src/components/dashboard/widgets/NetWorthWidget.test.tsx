import { render, screen } from '@testing-library/react'
import { NetWorthWidget } from './NetWorthWidget'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { useAccountFxStore } from '../../../store/useAccountFxStore'

const initialState = useAccountsStore.getState()

beforeEach(() => {
  useAccountsStore.setState(initialState, true)
  useAccountFxStore.setState({ resolved: undefined, loading: false, error: undefined })
})

describe('NetWorthWidget currency formatting', () => {
  it('uses the shared rate before combining CAD assets and USD debt', () => {
    useAccountFxStore.setState({ resolved: { value: { from: 'USD', to: 'CAD', rate: 1.35, date: '2026-10-06', asOf: '2026-10-06T00:00:00Z' }, source: 'live', status: 'success', asOf: '2026-10-06T00:00:00Z', stale: false } })
    useAccountsStore.setState({ accounts: [
      { id: 'cad', name: 'Bank', value: 1000, type: 'bank', currency: 'CAD' },
      { id: 'usd', name: 'Debt', value: 100, type: 'debt', currency: 'USD' },
    ], history: [] })
    render(<NetWorthWidget />)
    expect(screen.getByText('$865.00')).toBeInTheDocument()
  })

  it('renders a negative net worth with a leading minus sign', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'd1', name: 'Mortgage', value: 210000, type: 'debt', currency: 'CAD' }],
      history: [],
    })
    render(<NetWorthWidget />)
    expect(screen.getByText('-$210,000.00')).toBeInTheDocument()
  })

  it('renders a positive net worth without a sign', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'b1', name: 'Chequing', value: 15000, type: 'bank', currency: 'CAD' }],
      history: [],
    })
    render(<NetWorthWidget />)
    expect(screen.getByText('$15,000.00')).toBeInTheDocument()
  })
})

describe('NetWorthWidget trend formatting', () => {
  // A month-over-month ratio is an arbitrary float, so it has to be rounded
  // before display or it renders its full binary expansion.
  const seedTrend = (past: number, currentValue: number) => {
    const now = new Date()
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const date = `${endOfLastMonth.getFullYear()}-${String(endOfLastMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfLastMonth.getDate()).padStart(2, '0')}`
    useAccountsStore.setState({
      accounts: [{ id: 'b1', name: 'Chequing', value: currentValue, type: 'bank', currency: 'CAD' }],
      history: [{ date, value: past }],
    })
  }

  it('rounds a repeating trend to two decimals instead of printing the raw float', () => {
    seedTrend(319430.77, 318930.77)
    render(<NetWorthWidget />)
    expect(screen.getByText('-0.16%')).toBeInTheDocument()
    expect(screen.queryByText(/\d\.\d{4,}%/)).not.toBeInTheDocument()
  })

  it('keeps two decimals and a plus sign on a positive trend', () => {
    seedTrend(100000, 110000)
    render(<NetWorthWidget />)
    expect(screen.getByText('+10.00%')).toBeInTheDocument()
  })

  it('does not claim a change when there is no prior month to compare to', () => {
    useAccountsStore.setState({ accounts: [], history: [] })
    render(<NetWorthWidget />)
    expect(screen.getByText('No comparison for last month yet')).toBeInTheDocument()
    expect(screen.queryByText('+0.00%')).not.toBeInTheDocument()
  })

  it('hides comparison text when current conversion is unavailable even with prior history', () => {
    const date = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toLocaleDateString('en-CA')
    useAccountsStore.setState({ accounts: [{ id: 'usd', name: 'USD bank', value: 100, type: 'bank', currency: 'USD' }], history: [{ date, value: 90 }] })
    render(<NetWorthWidget />)
    expect(screen.getByText('Conversion Needed')).toBeInTheDocument()
    expect(screen.queryByText(/comparison for last month/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/vs Last Month/)).not.toBeInTheDocument()
  })
})
