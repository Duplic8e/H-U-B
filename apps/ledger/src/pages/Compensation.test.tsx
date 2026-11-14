import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { resetMatchMedia, setMatchMedia } from '../test-utils/matchMedia'
import { MemoryRouter } from 'react-router-dom'
import { Compensation } from './Compensation'
import { useCompensationStore } from '../store/useCompensationStore'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { __setProviders, __resetProviders } from '../services/marketData/marketDataService'
import { __resetMinInterval } from '../services/marketData/throttle'
import { quoteKey } from '../services/marketData'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
  useCompensationStore.setState({
    primaryPackage: {
      ...useCompensationStore.getState().primaryPackage,
      companyTicker: 'AAPL',
      baseSalary: 150000,
    },
  })
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
  __setProviders({
    fetchQuote: async () => ({ ticker: 'AAPL', price: 150, currency: 'USD' as const, asOf: '2026-07-01T00:00:00Z' }),
    fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 1.35, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
  })
})
afterEach(() => __resetProviders())

describe('Compensation page - live price + CAD toggle', () => {
  it('shows a Convert to CAD toggle that flips the store flag', async () => {
    render(<MemoryRouter><Compensation /></MemoryRouter>)
    const toggle = screen.getByRole('button', { name: /convert to cad/i })
    expect(useCompensationStore.getState().useCadConversion).toBe(false)
    fireEvent.click(toggle)
    await waitFor(() => expect(useCompensationStore.getState().useCadConversion).toBe(true))
  })

  it('shows a refresh price control', () => {
    render(<MemoryRouter><Compensation /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /refresh price/i })).toBeInTheDocument()
  })

  it('returns to a live price when refreshing a manual override', async () => {
    useMarketDataStore.getState().setOverride(quoteKey('AAPL'), 250)
    render(<MemoryRouter><Compensation /></MemoryRouter>)
    await screen.findByText('(override)')
    expect(screen.getByText('$250.00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /refresh price/i }))

    await waitFor(() => expect(useMarketDataStore.getState().getOverride(quoteKey('AAPL'))).toBeUndefined())
    await waitFor(() => expect(screen.getByText('$150.00')).toBeInTheDocument())
    expect(screen.queryByText('(override)')).not.toBeInTheDocument()
  })

  it('explains when a live price cannot replace the manual override', async () => {
    __setProviders({ fetchQuote: async () => { throw new Error('network down') } })
    useMarketDataStore.getState().setOverride(quoteKey('AAPL'), 250)
    render(<MemoryRouter><Compensation /></MemoryRouter>)
    await screen.findByText('(override)')

    fireEvent.click(screen.getByRole('button', { name: /refresh price/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Live price unavailable')
    expect(screen.queryByText('(override)')).not.toBeInTheDocument()
  })
})

describe('Compensation page gutter (no double padding)', () => {
  it('page root does not add its own p-6 padding', () => {
    const { container } = render(<MemoryRouter><Compensation /></MemoryRouter>)
    const root = container.firstChild as HTMLElement
    expect(root.className.split(/\s+/)).not.toContain('p-6')
  })
})

describe('Compensation header on a phone', () => {
  afterEach(() => resetMatchMedia())

  it('offers Edit Package as the phone action', () => {
    setMatchMedia(false)
    render(<MemoryRouter><Compensation /></MemoryRouter>)
    expect(screen.getAllByRole('button', { name: 'Edit Package' })).toHaveLength(1)
  })
})

describe('Compensation empty state', () => {
  it('puts an add button in the empty Package Details card', () => {
    useCompensationStore.setState(initialCompState, true)
    render(<MemoryRouter><Compensation /></MemoryRouter>)
    // One in the header, one in the empty card.
    expect(screen.getAllByRole('button', { name: 'Add Compensation Package' })).toHaveLength(2)
  })
})

describe('Compensation key figure on a phone', () => {
  afterEach(() => resetMatchMedia())

  it('puts the price and currency card after the total on a phone', () => {
    setMatchMedia(false)
    const { container } = render(<MemoryRouter><Compensation /></MemoryRouter>)
    const figure = container.querySelector('[data-key-figure]') as HTMLElement
    const refresh = screen.getByRole('button', { name: /refresh price/i })
    expect(figure.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the toolbar above the total on desktop', () => {
    render(<MemoryRouter><Compensation /></MemoryRouter>)
    const hero = screen.getByRole('heading', { name: 'Total Compensation' })
    const refresh = screen.getByRole('button', { name: /refresh price/i })
    expect(hero.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })
})
