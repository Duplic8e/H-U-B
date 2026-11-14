import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { PortfolioView } from './PortfolioView'
import { usePortfolioStore, type Holding } from '../../store/usePortfolioStore'
import { usePortfolioReportStore } from '../../store/usePortfolioReportStore'
import { sampleReport } from './report/testFixtures'
import { __setProviders, __resetProviders } from '../../services/marketData/marketDataService'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __resetMinInterval } from '../../services/marketData/throttle'
import { installMatchMedia } from '../../test-utils/matchMedia'

// Ticker -> quote override, consulted by the mocked useCurrentPrice below.
// Empty by default so every existing test keeps getting the idle/no-quote
// response; individual tests populate an entry to simulate a live quote
// coming back in a specific currency (the account-subtotal regression test
// below needs a quote whose currency differs from the holding's own).
const mockQuotes = vi.hoisted(() => new Map<string, { price: number; currency: string }>())

vi.mock('../../services/marketData', () => ({
  useCurrentPrice: (ticker: string) => {
    const q = mockQuotes.get(ticker)
    if (!q) return { data: undefined, status: 'idle', refresh: () => {}, setManual: () => {}, clearManual: () => {} }
    return {
      data: { value: { ticker, price: q.price, currency: q.currency, asOf: '2026-07-21T00:00:00.000Z' }, source: 'live', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    }
  },
  useFxRate: () => ({ data: undefined, status: 'idle', refresh: () => {} }),
}))

// CAD so useFxRates resolves without a network call (CAD-to-CAD is 1
// unconditionally); avoids these render-only tests making a real FX request.
function buildHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h-1',
    ticker: 'AAPL',
    quantity: 10,
    avgCost: 100,
    currency: 'CAD',
    account: 'Default',
    ...overrides,
  }
}

const initialPortfolioState = usePortfolioStore.getState()

describe('PortfolioView', () => {
  beforeEach(() => {
    usePortfolioStore.setState({ holdings: [buildHolding()], importedAt: '2026-01-01T00:00:00Z' })
  })

  afterEach(() => {
    usePortfolioStore.setState(initialPortfolioState, true)
  })

  it('renders a mobile card list alongside the desktop table with matching values', () => {
    const { container } = render(<PortfolioView />)

    const cards = container.querySelector('[data-testid="portfolio-cards-Default"]')
    expect(cards).not.toBeNull()
    expect(cards?.textContent).toContain('AAPL')
    expect(cards?.textContent).toContain('$1,000')

    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    expect(table?.textContent).toContain('AAPL')
  })

  it('gives each account its own uniquely queryable mobile card list', () => {
    usePortfolioStore.setState({
      holdings: [
        buildHolding({ id: 'h-1', ticker: 'AAPL', account: 'acc1' }),
        buildHolding({ id: 'h-2', ticker: 'VFV', account: 'acc2', currency: 'CAD' }),
      ],
      importedAt: '2026-01-01T00:00:00Z',
    })

    const { getByTestId } = render(<PortfolioView />)

    const acc1Cards = getByTestId('portfolio-cards-acc1')
    const acc2Cards = getByTestId('portfolio-cards-acc2')

    expect(acc1Cards.textContent).toContain('AAPL')
    expect(acc1Cards.textContent).not.toContain('VFV')

    expect(acc2Cards.textContent).toContain('VFV')
    expect(acc2Cards.textContent).not.toContain('AAPL')
  })
})

describe('multi-currency totals', () => {
  it('flags holdings excluded from the CAD totals', async () => {
    usePortfolioStore.setState({
      holdings: [
        { id: '1', ticker: 'ENB', quantity: 10, avgCost: 50, currency: 'CAD', account: 'A' },
        { id: '2', ticker: 'XXX', quantity: 10, avgCost: 50, currency: null, account: 'A' },
      ],
      importedAt: '2026-07-21T00:00:00.000Z',
    })
    render(<PortfolioView />)
    expect(await screen.findByText(/1 holding left out of these totals: no exchange rate for its currency/)).toBeInTheDocument()
  })

  it('says nothing about exclusions when every currency resolves', async () => {
    usePortfolioStore.setState({
      holdings: [
        { id: '1', ticker: 'ENB', quantity: 10, avgCost: 50, currency: 'CAD', account: 'A' },
      ],
      importedAt: '2026-07-21T00:00:00.000Z',
    })
    render(<PortfolioView />)
    expect(await screen.findByText('Holdings Value (CAD)')).toBeInTheDocument()
    expect(screen.queryByText(/left out of these totals/)).not.toBeInTheDocument()
  })
})

describe('account value from the PortfolioAnalyst report', () => {
  const initialReportState = usePortfolioReportStore.getState()

  beforeEach(() => {
    usePortfolioStore.setState({
      holdings: [{ id: '1', ticker: 'ENB', quantity: 10, avgCost: 50, currency: 'CAD', account: 'A' }],
      importedAt: '2026-07-21T00:00:00.000Z',
    })
  })

  afterEach(() => {
    usePortfolioReportStore.setState(initialReportState, true)
  })

  it('shows only the holdings value when no report has been uploaded', async () => {
    usePortfolioReportStore.setState({ report: null, uploadedAt: null })
    render(<PortfolioView />)
    expect(await screen.findByText('Holdings Value (CAD)')).toBeInTheDocument()
    expect(screen.queryByText(/^Account Value/)).not.toBeInTheDocument()
  })

  it('adds an account value card with the cash sleeve once a report exists', async () => {
    usePortfolioReportStore.setState({
      report: {
        ...sampleReport,
        assetClassAllocation: [
          { name: 'Stocks', endingNav: 143000, endingPct: 121.2 },
          { name: 'Cash', endingNav: -25000, endingPct: -21.2 },
        ],
      },
      uploadedAt: '2026-07-21T00:00:00.000Z',
    })
    render(<PortfolioView />)
    expect(await screen.findByText('Account Value (CAD)')).toBeInTheDocument()
    expect(screen.getByText('$118,000')).toBeInTheDocument()
    expect(screen.getByText(/Cash -\$25,000/)).toBeInTheDocument()
  })

  it('labels the card with the report base currency instead of converting', async () => {
    usePortfolioReportStore.setState({
      report: { ...sampleReport, baseCurrency: 'USD' },
      uploadedAt: '2026-07-21T00:00:00.000Z',
    })
    render(<PortfolioView />)
    expect(await screen.findByText('Account Value (USD)')).toBeInTheDocument()
  })
})

describe('FX provenance footer', () => {
  beforeEach(() => {
    useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
    __resetMinInterval()
    __setProviders({
      fetchFxRate: async (from, to) => ({
        from, to, rate: 1.3712, date: '2026-07-21', asOf: '2026-07-21T00:00:00.000Z',
      }) as never,
    })
  })

  afterEach(() => {
    __resetProviders()
  })

  it('shows each resolved currency alongside its rate source', async () => {
    usePortfolioStore.setState({
      holdings: [
        { id: '1', ticker: 'AAPL', quantity: 10, avgCost: 50, currency: 'USD', account: 'A' },
      ],
      importedAt: '2026-07-21T00:00:00.000Z',
    })
    render(<PortfolioView />)
    expect(await screen.findByText(/USD 1\.3712 \(live\)/)).toBeInTheDocument()
  })
})

describe('holdings table polish', () => {
  beforeEach(() => {
    usePortfolioStore.setState({
      holdings: [
        { id: '1', ticker: 'ENB', quantity: 10, avgCost: 10, currency: 'CAD', account: 'RRSP' },
        { id: '2', ticker: 'BCE', quantity: 10, avgCost: 30, currency: 'CAD', account: 'RRSP' },
      ],
      importedAt: '2026-07-21T00:00:00.000Z',
      currencyReviewPending: false,
    })
  })

  it('shows a subtotal in the account header', async () => {
    render(<PortfolioView />)
    expect(await screen.findByRole('heading', { name: /RRSP/ })).toBeInTheDocument()
    expect(screen.getByTestId('account-subtotal-RRSP')).toHaveTextContent('$400')
  })

  it('sorts by value descending by default', async () => {
    render(<PortfolioView />)
    const tickers = (await screen.findAllByTestId('holding-ticker')).map((n) => n.textContent)
    expect(tickers).toEqual(['BCE', 'ENB'])
  })

  it('reverses the order when the value header is clicked', async () => {
    render(<PortfolioView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sort by Value' }))
    const tickers = screen.getAllByTestId('holding-ticker').map((n) => n.textContent)
    expect(tickers).toEqual(['ENB', 'BCE'])
  })

  it('renders an allocation bar per row', async () => {
    render(<PortfolioView />)
    expect(await screen.findAllByTestId('allocation-bar')).toHaveLength(2)
  })
})

describe('account subtotal correctness', () => {
  beforeEach(() => {
    useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
    __resetMinInterval()
    // USD has no rate into CAD, so a quote that comes back in USD for a CAD
    // holding is unconvertible. CAD-to-CAD never reaches this provider (it
    // is short-circuited to 1), so throwing here only affects the trap.
    __setProviders({
      fetchFxRate: async () => { throw new Error('no rate available in test') },
    })
    mockQuotes.set('TRAP', { price: 200, currency: 'USD' })
  })

  afterEach(() => {
    __resetProviders()
    mockQuotes.clear()
  })

  it('prices an unconvertible holding at cost in both its own row and the account subtotal instead of reading its raw quote currency as CAD', async () => {
    usePortfolioStore.setState({
      holdings: [
        { id: '1', ticker: 'ENB', quantity: 10, avgCost: 10, currency: 'CAD', account: 'RRSP' },
        // TRAP's own currency is CAD, but its live quote resolves in USD and
        // there is no USD rate, so its raw 200 cannot be read as a CAD
        // price. It still has a known quantity and cost basis in CAD, so it
        // counts toward the subtotal at cost (10 * $50 = $500), not at the
        // raw USD price misread as CAD (2000), and not dropped to zero.
        { id: '2', ticker: 'TRAP', quantity: 10, avgCost: 50, currency: 'CAD', account: 'RRSP' },
      ],
      importedAt: '2026-07-21T00:00:00.000Z',
      currencyReviewPending: false,
    })
    render(<PortfolioView />)
    await screen.findByRole('heading', { name: /RRSP/ })

    // TRAP's own row (table and mobile card) must show its cost basis
    // ($500), the same number the subtotal counts it at, not a dash: the
    // rows must sum to the subtotal above them, not merely agree that a
    // number exists.
    const valueCells = await screen.findAllByTestId('value-cell')
    expect(valueCells.filter((c) => c.textContent === '-')).toHaveLength(0)
    expect(valueCells.filter((c) => c.textContent === '$100')).toHaveLength(2)
    expect(valueCells.filter((c) => c.textContent === '$500')).toHaveLength(2)

    // The subtotal reflects ENB's $100 plus TRAP at its $500 cost basis
    // ($600 total, $0 P/L since cost basis has no gain), not TRAP's raw USD
    // price of 200 misread as $2,000 CAD, and not TRAP dropped to zero.
    const subtotal = screen.getByTestId('account-subtotal-RRSP')
    expect(subtotal.textContent).toBe('$600 +$0')
    expect(subtotal).not.toHaveTextContent('$2,100')
    expect(subtotal).not.toHaveTextContent('$1,500')

    // The visible per-row values must literally sum to the subtotal shown
    // above them: this is the property that broke when rows dashed out a
    // holding the subtotal already counted at cost.
    const rowValues = (await screen.findAllByTestId('value-cell'))
      .slice(0, 2) // table row values only; the mobile cards duplicate the same two numbers
      .map((c) => Number((c.textContent ?? '').replace(/[$,]/g, '')))
    expect(rowValues.reduce((a, b) => a + b, 0)).toBe(600)
  })

  // The import sheet became page controlled so its trigger could move into the
  // Investments page header, beside where New Analysis sits on the other tab.
  // These pin both halves of that wiring, since the page is the only caller
  // that passes the props and nothing else would catch them drifting.
  describe('page controlled import sheet', () => {
    it('opens the sheet from the page prop rather than any control of its own', () => {
      const { rerender, queryByRole } = render(<PortfolioView importOpen={false} onImportOpenChange={() => {}} />)
      expect(queryByRole('dialog')).toBeNull()
      rerender(<PortfolioView importOpen onImportOpenChange={() => {}} />)
      expect(queryByRole('dialog')).not.toBeNull()
    })

    it('reports a close back to the page instead of closing itself', () => {
      const onChange = vi.fn()
      render(<PortfolioView importOpen onImportOpenChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(onChange).toHaveBeenCalledWith(false)
      // Still open: the page owns the state, so the sheet may only close when
      // the page sends a new importOpen. Closing itself here would desync the
      // two and leave the header trigger unable to reopen it.
      expect(screen.queryByRole('dialog')).not.toBeNull()
    })

    it('still manages the sheet itself when the page passes nothing', () => {
      render(<PortfolioView />)
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

})

describe('portfolio page composition', () => {
  beforeEach(() => {
    installMatchMedia()
    usePortfolioStore.setState({
      holdings: [
        { id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA' },
      ],
      importedAt: new Date().toISOString(),
      currencyReviewPending: false,
    })
    useMarketDataStore.setState({ quotes: {}, overrides: {} })
  })

  it('leads with the summary band and shows all three allocation cuts', async () => {
    // The shared beforeEach seeds a single holding in a single account and
    // currency, so every cut would have exactly one slice and a single-slice
    // bar is a full-width 100% bar with nothing to say, which is now
    // suppressed. Seed two holdings across two accounts and two currencies,
    // with a resolvable USD rate, so all three cuts have a genuine breakdown
    // to show.
    // A prior describe block's test already fetched a USD-CAD rate today,
    // which leaves the real per-key fetch throttle locked; without resetting
    // it here this test's own USD fetch is silently skipped and the rate
    // never resolves, so the by-currency and by-holding cuts stay stuck at
    // one visible slice (VFV alone) and never render.
    __resetMinInterval()
    useMarketDataStore.setState({ quotes: {}, overrides: {}, fx: {} })
    __setProviders({
      fetchFxRate: async (from, to) => ({
        from, to, rate: 1.35, date: '2026-01-01', asOf: '2026-01-01T00:00:00.000Z',
      }) as never,
    })
    usePortfolioStore.setState({
      holdings: [
        { id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA' },
        { id: 'h2', ticker: 'AAPL', quantity: 5, avgCost: 100, currency: 'USD', account: 'RRSP' },
      ],
      importedAt: new Date().toISOString(),
      currencyReviewPending: false,
    })
    try {
      render(<MemoryRouter><PortfolioView /></MemoryRouter>)
      expect(await screen.findByText('Holdings Value (CAD)')).toBeInTheDocument()
      expect(screen.getByText('Total invested')).toBeInTheDocument()
      // Plain getByText('Holding') is ambiguous here: the holdings table also
      // has a sortable "Holding" column header with the exact same text, so it
      // matches two elements. The bar's accessible name is unambiguous and is
      // the thing that actually matters: that all three cuts render.
      // The trailing \S requires at least one non-space character after the
      // colon and space, so a bar whose slice list came back empty (label
      // "Allocation by holding: ") does not satisfy this match.
      expect(await screen.findByRole('img', { name: /^Allocation by holding: \S/ })).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /^Allocation by account: \S/ })).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /^Allocation by currency: \S/ })).toBeInTheDocument()
    } finally {
      __resetProviders()
    }
  })

  it('no longer offers the allocation mode toggle', async () => {
    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    await screen.findByText('Holdings Value (CAD)')
    expect(screen.queryByRole('button', { name: 'By holding' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'By account' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'By currency' })).not.toBeInTheDocument()
  })

  it('no longer shows the separate Total Invested stat card', async () => {
    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    await screen.findByText('Holdings Value (CAD)')
    expect(screen.queryByText('Total Invested (CAD)')).not.toBeInTheDocument()
    expect(screen.queryByText('Total P/L')).not.toBeInTheDocument()
  })
})
