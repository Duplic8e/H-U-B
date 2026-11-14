import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HoldingCard } from './HoldingCard'
import type { Holding } from '../../store/usePortfolioStore'
import { formatMoney } from '../planner/format'
import { pct, share } from './holdingMetrics'
import { allocationPct } from '../../utils/investments/analysisMetrics'

const { useCurrentPriceMock } = vi.hoisted(() => ({ useCurrentPriceMock: vi.fn() }))

vi.mock('../../services/marketData', () => ({
  useCurrentPrice: useCurrentPriceMock,
}))

function buildHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h-1',
    ticker: 'AAPL',
    quantity: 10,
    avgCost: 100,
    currency: 'USD',
    account: 'Default',
    ...overrides,
  }
}

describe('HoldingCard', () => {
  it('shows a loading skeleton for the current price instead of avgCost while the live quote is loading', () => {
    useCurrentPriceMock.mockReturnValue({
      data: undefined,
      status: 'loading',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })

    const { container } = render(
      <HoldingCard holding={buildHolding()} rates={{ USD: 1 }} totalValueCad={1000} onPrice={() => {}} />,
    )

    // avgCost (100.00) must not appear as the rendered "current price": it still
    // appears once for the Avg Cost field itself, so assert on skeleton presence.
    const skeletons = container.querySelectorAll('[aria-hidden="true"].animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders the live price once loaded, with no skeletons', () => {
    useCurrentPriceMock.mockReturnValue({
      data: { value: { price: 150 }, source: 'test', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })

    const { container } = render(
      <HoldingCard holding={buildHolding()} rates={{ USD: 1 }} totalValueCad={1000} onPrice={() => {}} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Details for AAPL' }))
    expect(container.textContent).toContain('150.00')
    const skeletons = container.querySelectorAll('[aria-hidden="true"].animate-pulse')
    expect(skeletons.length).toBe(0)
  })

  it('shows no allocation rather than 0% when the holding cannot be converted', () => {
    useCurrentPriceMock.mockReturnValue({
      data: undefined,
      status: 'idle',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })

    const { getByTestId, getByText } = render(
      <HoldingCard
        holding={buildHolding({ currency: null })}
        rates={{}}
        totalValueCad={1000}
        onPrice={() => {}}
      />,
    )

    expect(getByTestId('allocation-cell')).toHaveTextContent('-')
    expect(getByTestId('allocation-cell')).not.toHaveTextContent('0.0%')
    expect(getByText('Set currency')).toBeInTheDocument()
  })

  it('values a holding at cost, with zero P/L, when the holding currency has a rate but the quote currency does not', () => {
    useCurrentPriceMock.mockReturnValue({
      data: { value: { price: 100, currency: 'USD' }, source: 'live', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })

    // EUR has a rate; USD (the quote's currency) does not, so the cross
    // rate is unavailable even though the holding's own currency converts
    // fine. The product decision is that this holding still counts at cost
    // basis, matching the account subtotal and header totals above it, with
    // the "unconverted" marker as the only signal the live price was unusable.
    const holding = buildHolding({ currency: 'EUR' })
    const { getByTestId } = render(
      <HoldingCard
        holding={holding}
        rates={{ EUR: 1.47 }}
        totalValueCad={1000}
        onPrice={() => {}}
      />,
    )

    // Cost basis: 10 shares at a 100 EUR avg cost, so value equals book
    // value and P/L is exactly zero.
    expect(getByTestId('value-cell')).toHaveTextContent(formatMoney(1000))
    expect(getByTestId('pl-cell')).toHaveTextContent(`${formatMoney(0)} (${pct(0)})`)
    // 1000 EUR at 1.47 into CAD, against a 1000 CAD total.
    expect(getByTestId('allocation-cell')).toHaveTextContent(share(allocationPct(1000 * 1.47, 1000)))
  })

  it('does not convert a manual override, which is already in the holding currency', () => {
    // source: 'override' is the point. The placeholder currency the service
    // stamps on overrides is USD; believing it turns this CAD price of
    // 148.90 into 206.51.
    useCurrentPriceMock.mockReturnValue({
      data: { value: { price: 148.9, currency: 'USD' }, source: 'override', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })
    const holding = buildHolding({
      id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA',
    })
    const { getByText, queryByText } = render(
      <HoldingCard holding={holding} rates={{ USD: 1.3869 }} totalValueCad={10000} onPrice={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Details for VFV' }))
    expect(getByText('148.90')).toBeInTheDocument()
    expect(queryByText('206.51')).not.toBeInTheDocument()
  })
})

describe('card disclosure', () => {
  const holding = {
    id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100,
    currency: 'CAD' as const, account: 'TFSA',
  }

  it('starts collapsed, with avg cost and book hidden', () => {
    // Set explicitly rather than relying on whatever the previous test in
    // this file configured: there is no beforeEach resetting this mock, so
    // an unset value here would make the test order-dependent. A settled,
    // matching-currency quote keeps the render free of loading skeletons
    // and unconverted markers, which are not what this test is about.
    useCurrentPriceMock.mockReturnValue({
      data: { value: { price: 150, currency: 'CAD' }, source: 'live', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })
    render(<HoldingCard holding={holding} rates={{}} totalValueCad={10000} onPrice={() => {}} />)
    expect(screen.getByRole('button', { name: 'Details for VFV' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Avg Cost')).not.toBeInTheDocument()
    expect(screen.queryByText('Book')).not.toBeInTheDocument()
  })

  it('reveals avg cost and book when opened', () => {
    useCurrentPriceMock.mockReturnValue({
      data: { value: { price: 150, currency: 'CAD' }, source: 'live', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })
    render(<HoldingCard holding={holding} rates={{}} totalValueCad={10000} onPrice={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Details for VFV' }))
    expect(screen.getByText('Avg Cost')).toBeInTheDocument()
    expect(screen.getByText('Book')).toBeInTheDocument()
  })

  it('is one row when collapsed: value and P/L visible, currency and price behind the disclosure', () => {
    useCurrentPriceMock.mockReturnValue({
      data: { value: { price: 150, currency: 'CAD' }, source: 'live', stale: false },
      status: 'success',
      refresh: () => {},
      setManual: () => {},
      clearManual: () => {},
    })
    render(<HoldingCard holding={holding} rates={{}} totalValueCad={10000} onPrice={() => {}} />)
    expect(screen.getByTestId('value-cell')).toHaveTextContent(formatMoney(1500))
    expect(screen.getByTestId('pl-cell')).toBeInTheDocument()
    expect(screen.getByTestId('allocation-cell')).toBeInTheDocument()
    expect(screen.queryByLabelText('Currency for VFV')).toBeNull()
    expect(screen.queryByText('150.00')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Details for VFV' }))
    expect(screen.getByLabelText('Currency for VFV')).toBeInTheDocument()
    expect(screen.getByText('150.00')).toBeInTheDocument()
  })
})
