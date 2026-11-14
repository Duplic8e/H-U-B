import { render, screen, waitFor } from '@testing-library/react'
import { CustomEquityTooltip, EquityVestingWidget } from './EquityVestingWidget'
import { LEADING_LABEL, TRAILING_LABEL } from './vestingPadding'
import { useCompensationStore } from '../../store/useCompensationStore'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __setProviders, __resetProviders } from '../../services/marketData/marketDataService'
import { __resetMinInterval } from '../../services/marketData/throttle'

const initialCompState = useCompensationStore.getState()

beforeEach(() => {
  localStorage.clear()
  useCompensationStore.setState(initialCompState, true)
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
  __setProviders({
    fetchFxRate: async () => ({ from: 'USD' as const, to: 'CAD' as const, rate: 2, date: '2026-07-01', asOf: '2026-07-01T00:00:00Z' }),
  })
})
afterEach(() => __resetProviders())

describe('EquityVestingWidget with CAD conversion', () => {
  it('renders the vesting chart using the converted package price when conversion is on', async () => {
    useCompensationStore.getState().addRSUGrant({
      id: 'g1',
      grantName: 'Initial Grant',
      grantShares: 1200,
      grantPrice: 50,
      grantStartDate: '2026-01-01',
      vestingSchedule: { preset: '4yr-1yr-cliff', totalVestMonths: 48, cliffMonths: 12, frequency: 'monthly' },
    })
    useCompensationStore.getState().setPrimaryPackage({ companyCurrentPrice: 100 })
    useCompensationStore.getState().toggleCadConversion()
    render(<EquityVestingWidget />)
    await waitFor(() => expect(screen.getByText(/Equity Vesting Schedule/i)).toBeInTheDocument())
  })
})

describe('EquityVestingWidget unvested line', () => {
  const addGrant = () => {
    useCompensationStore.getState().addRSUGrant({
      id: 'g1',
      grantName: 'Initial Grant',
      grantShares: 1200,
      grantPrice: 50,
      grantStartDate: '2026-01-01',
      vestingSchedule: { preset: '4yr-1yr-cliff', totalVestMonths: 48, cliffMonths: 12, frequency: 'quarterly' },
    })
    useCompensationStore.getState().setPrimaryPackage({ companyCurrentPrice: 100 })
  }

  it('names the unvested series rather than a cumulative one', async () => {
    addGrant()
    render(<EquityVestingWidget />)
    await waitFor(() => expect(screen.getAllByText('Unvested Remaining').length).toBeGreaterThan(0))
    expect(screen.queryByText(/cumulative/i)).toBeNull()
  })

  it('lists every grant so the stacked colours are identifiable', async () => {
    addGrant()
    render(<EquityVestingWidget />)
    await waitFor(() => expect(screen.getByText('Initial Grant')).toBeInTheDocument())
  })

  it('states the share price the unvested value depends on', async () => {
    addGrant()
    render(<EquityVestingWidget />)
    await waitFor(() => expect(screen.getByText(/Valued at .* per share/)).toBeInTheDocument())
  })

  it('restates the price when the package price changes, since unvested value moves with it', async () => {
    addGrant()
    const { rerender } = render(<EquityVestingWidget />)
    await waitFor(() => expect(screen.getByText(/\$100 per share/)).toBeInTheDocument())

    useCompensationStore.getState().setPrimaryPackage({ companyCurrentPrice: 250 })
    rerender(<EquityVestingWidget />)
    await waitFor(() => expect(screen.getByText(/\$250 per share/)).toBeInTheDocument())
  })
})

describe('EquityVestingWidget tooltip', () => {
  const grantPayload = (value: number) => [
    { dataKey: 'g1', name: 'Initial Grant', value, color: '#c9a44c' },
    { dataKey: 'unvestedRemaining', name: 'Unvested Remaining', value: 170880 },
  ]

  it('still answers with the unvested figure in a month where nothing vests', () => {
    render(<CustomEquityTooltip active payload={grantPayload(0)} label="Nov" />)
    expect(screen.getByText('Nov')).toBeInTheDocument()
    expect(screen.getByText('Unvested Remaining')).toBeInTheDocument()
    expect(screen.getByText('$170,880')).toBeInTheDocument()
    expect(screen.queryByText('Initial Grant')).toBeNull()
  })

  it('shows the vesting grants and the unvested figure together in a vest month', () => {
    render(<CustomEquityTooltip active payload={grantPayload(13120)} label="Oct" />)
    expect(screen.getByText('Initial Grant')).toBeInTheDocument()
    expect(screen.getByText('Vesting this month')).toBeInTheDocument()
    // With a single grant the row and the month total are the same figure.
    expect(screen.getAllByText('$13,120')).toHaveLength(2)
    expect(screen.getByText('$170,880')).toBeInTheDocument()
  })

  it.each([
    ['leading', LEADING_LABEL],
    ['trailing', TRAILING_LABEL],
  ])('renders nothing for the %s padding row, which is not a real month', (_name, label) => {
    const { container } = render(
      <CustomEquityTooltip active payload={grantPayload(0)} label={label} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when inactive', () => {
    const { container } = render(<CustomEquityTooltip active={false} payload={grantPayload(0)} label="Nov" />)
    expect(container).toBeEmptyDOMElement()
  })
})
