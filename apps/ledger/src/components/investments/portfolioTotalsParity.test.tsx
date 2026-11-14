import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PortfolioView } from './PortfolioView'
import { PortfolioRollupWidget } from '../dashboard/widgets/PortfolioRollupWidget'
import { usePortfolioStore } from '../../store/usePortfolioStore'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { installMatchMedia } from '../../test-utils/matchMedia'
import { quoteKey } from '../../services/marketData'
import { __setProviders, __resetProviders } from '../../services/marketData/marketDataService'
import { __resetMinInterval } from '../../services/marketData/throttle'

const HOLDINGS = [
  { id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD' as const, account: 'TFSA' },
  { id: 'h2', ticker: 'AAPL', quantity: 10, avgCost: 200, currency: 'USD' as const, account: 'TFSA' },
]

beforeEach(() => {
  installMatchMedia()
  usePortfolioStore.setState({ holdings: HOLDINGS, importedAt: new Date().toISOString(), currencyReviewPending: false })
  // No cached quotes and no overrides: the live-price path is unavailable,
  // which is the exact condition under which the two totals used to disagree.
  useMarketDataStore.setState({ quotes: {}, overrides: {} })
})

const moneyOnScreen = (): string[] =>
  screen.getAllByText(/^\$[\d,]+/).map((el) => el.textContent!.trim())

describe('portfolio totals parity', () => {
  it('reports the same holdings value on the dashboard and on the Investments tab', () => {
    const { unmount } = render(<MemoryRouter><PortfolioRollupWidget /></MemoryRouter>)
    const rollupValues = moneyOnScreen()
    unmount()

    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    const viewValues = moneyOnScreen()

    // The rollup's headline value must appear among the Investments totals.
    expect(viewValues).toEqual(expect.arrayContaining([rollupValues[0]]))
  })
})

describe('portfolio totals parity: unconvertible cached quote', () => {
  // TRAP's own currency is CAD, but a quote is already cached for it in USD
  // and there is no USD rate, so the cached 200 cannot be read as a CAD
  // price. Both surfaces must fall back to the $500 cost basis (10 * $50),
  // not TRAP's raw USD price misread as $2,000 CAD.
  const holdings = [
    { id: 'h1', ticker: 'TRAP', quantity: 10, avgCost: 50, currency: 'CAD' as const, account: 'RRSP' },
  ]

  beforeEach(() => {
    installMatchMedia()
    usePortfolioStore.setState({ holdings, importedAt: new Date().toISOString(), currencyReviewPending: false })
    useMarketDataStore.setState({
      quotes: {
        [quoteKey('TRAP')]: {
          value: { ticker: 'TRAP', price: 200, currency: 'USD', asOf: '2026-08-21T00:00:00.000Z' },
          fetchedAt: '2026-08-21T00:00:00.000Z',
        },
      },
      overrides: {},
    })
    __resetMinInterval()
    __setProviders({
      fetchFxRate: async () => { throw new Error('no rate available in test') },
    })
  })

  afterEach(() => {
    __resetProviders()
  })

  it('falls back to cost basis on both surfaces when a cached quote currency cannot be converted', async () => {
    const { unmount } = render(<MemoryRouter><PortfolioRollupWidget /></MemoryRouter>)
    expect(await screen.findByText('$500')).toBeInTheDocument()
    unmount()

    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    expect(await screen.findByText('Holdings Value (CAD)')).toBeInTheDocument()
    const viewValues = screen.getAllByText(/^\$[\d,]+/).map((el) => el.textContent!.trim())
    expect(viewValues).toContain('$500')
    expect(viewValues).not.toContain('$2,000')
  })
})

describe('portfolio totals parity: manual override', () => {
  // A CAD holding priced by hand. With no FX rate resolvable in the test
  // environment, the bug was believing the override's placeholder USD
  // currency made the price unconvertible, so the holding silently fell
  // back to its cost basis and read $1,000 instead of $1,489. PortfolioView
  // renders both the desktop table and the mobile card list for every
  // holding at once (CSS only hides one of them), so each surface is
  // asserted independently here, scoped to its own container, or a
  // regression in one surface could hide behind a correct value from
  // the other.
  const holdings = [
    { id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD' as const, account: 'TFSA' },
  ]

  beforeEach(() => {
    installMatchMedia()
    usePortfolioStore.setState({ holdings, importedAt: new Date().toISOString(), currencyReviewPending: false })
    useMarketDataStore.setState({ quotes: {}, overrides: { [quoteKey('VFV')]: 148.9 } })
    __resetMinInterval()
  })

  it('reports the same holdings value on both surfaces when the price is a manual override', async () => {
    const { unmount } = render(<MemoryRouter><PortfolioRollupWidget /></MemoryRouter>)
    expect(await screen.findByText('$1,489')).toBeInTheDocument()
    unmount()

    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    expect(await screen.findByText('Holdings Value (CAD)')).toBeInTheDocument()

    const table = document.querySelector('table')
    expect(table, 'expected exactly one desktop table to be rendered').not.toBeNull()
    const tableValues = within(table as HTMLElement).getAllByText(/^\$[\d,]+/).map((el) => el.textContent!.trim())
    expect(tableValues, 'desktop table did not show the converted override price').toContain('$1,489')

    const cards = screen.getByTestId('portfolio-cards-TFSA')
    const cardValues = within(cards).getAllByText(/^\$[\d,]+/).map((el) => el.textContent!.trim())
    expect(cardValues, 'mobile card did not show the converted override price').toContain('$1,489')
  })
})

describe('portfolio totals: holdings beyond the phone cap', () => {
  // Rule 4 caps the cards at 8 per account, but the headline must be computed
  // from the store, not from the mounted cards. The 10th holding carries a
  // manual override: 9 * $100 cost basis + $5,000 override = $5,900. A total
  // that only counted the first 8 would read $800.
  const holdings = Array.from({ length: 10 }, (_, i) => ({
    id: `h${i + 1}`, ticker: `T${i + 1}`, quantity: 1, avgCost: 100, currency: 'CAD' as const, account: 'TFSA',
  }))

  beforeEach(() => {
    installMatchMedia()
    usePortfolioStore.setState({ holdings, importedAt: new Date().toISOString(), currencyReviewPending: false })
    useMarketDataStore.setState({ quotes: {}, overrides: { [quoteKey('T10')]: 5000 } })
    __resetMinInterval()
  })

  it('includes a holding past the cap, with its override price, in the headline total', async () => {
    render(<MemoryRouter><PortfolioView /></MemoryRouter>)
    const label = await screen.findByText('Holdings Value (CAD)')
    expect(await within(label.parentElement as HTMLElement).findByText('$5,900')).toBeInTheDocument()
  })
})
