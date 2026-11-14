import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { HoldingRow } from './HoldingRow'
import { __setProviders, __resetProviders } from '../../services/marketData/marketDataService'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { __resetMinInterval } from '../../services/marketData/throttle'
import { formatMoney } from '../planner/format'
import { pct, share } from './holdingMetrics'
import { allocationPct } from '../../utils/investments/analysisMetrics'

beforeEach(() => {
  useMarketDataStore.setState({ quotes: {}, historical: {}, fx: {}, overrides: {} })
  __resetMinInterval()
})

afterEach(() => {
  __resetProviders()
})

describe('quote currency', () => {
  it('converts a USD quote into the holding currency before computing P/L', async () => {
    __setProviders({
      fetchQuote: async () => ({
        ticker: 'ASML', price: 100, currency: 'USD', asOf: '2026-07-21T00:00:00.000Z',
      }) as never,
    })
    const holding = {
      id: '1', ticker: 'ASML', quantity: 1, avgCost: 50,
      currency: 'EUR' as const, account: 'A',
    }
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{ USD: 1.37, EUR: 1.47 }} totalValueCad={1000} onPrice={() => {}} />
      </tbody></table>,
    )
    // 100 USD -> 137 CAD -> 93.20 EUR against a 50 EUR cost basis.
    expect(await screen.findByText('93.20')).toBeInTheDocument()
  })

  it('falls back to the native price and flags when the cross rate is missing', async () => {
    __setProviders({
      fetchQuote: async () => ({
        ticker: 'ASML', price: 100, currency: 'USD', asOf: '2026-07-21T00:00:00.000Z',
      }) as never,
    })
    const holding = {
      id: '1', ticker: 'ASML', quantity: 1, avgCost: 50,
      currency: 'EUR' as const, account: 'A',
    }
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{}} totalValueCad={1000} onPrice={() => {}} />
      </tbody></table>,
    )
    expect(await screen.findByTitle(/quoted in USD/)).toBeInTheDocument()
  })

  it('renders a currency badge, and a prompt when the currency is unknown', () => {
    const holding = {
      id: '1', ticker: 'XXX', quantity: 1, avgCost: 50,
      currency: null, account: 'A',
    }
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{}} totalValueCad={1000} onPrice={() => {}} />
      </tbody></table>,
    )
    expect(screen.getByText('Set currency')).toBeInTheDocument()
  })

  it('shows no allocation rather than 0% when the holding cannot be converted', () => {
    const holding = {
      id: '1', ticker: 'XXX', quantity: 1, avgCost: 50,
      currency: null, account: 'A',
    }
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{}} totalValueCad={1000} onPrice={() => {}} />
      </tbody></table>,
    )
    expect(screen.getByTestId('allocation-cell')).toHaveTextContent('-')
    expect(screen.getByTestId('allocation-cell')).not.toHaveTextContent('0.0%')
  })

  it('values a holding at cost, with zero P/L, when the holding currency has a rate but the quote currency does not', async () => {
    __setProviders({
      fetchQuote: async () => ({
        ticker: 'ASML', price: 100, currency: 'USD', asOf: '2026-07-21T00:00:00.000Z',
      }) as never,
    })
    const holding = {
      id: '1', ticker: 'ASML', quantity: 1, avgCost: 50,
      currency: 'EUR' as const, account: 'A',
    }
    render(
      <table><tbody>
        {/* EUR has a rate; USD (the quote's currency) does not, so the
            cross rate is unavailable even though the holding's own
            currency converts fine. The product decision is that this
            holding still counts at cost basis, matching the account
            subtotal and header totals above it, with the "unconverted"
            marker as the only signal that the live price was unusable. */}
        <HoldingRow holding={holding} rates={{ EUR: 1.47 }} totalValueCad={1000} onPrice={() => {}} />
      </tbody></table>,
    )
    await screen.findByTitle(/quoted in USD/)
    // Cost basis: 1 share at a 50 EUR avg cost, so value equals book value
    // and P/L is exactly zero.
    expect(screen.getByTestId('value-cell')).toHaveTextContent(formatMoney(50))
    expect(screen.getByTestId('pl-cell')).toHaveTextContent(`${formatMoney(0)} (${pct(0)})`)
    // 50 EUR at 1.47 into CAD, against a 1000 CAD total.
    expect(screen.getByTestId('allocation-cell')).toHaveTextContent(share(allocationPct(50 * 1.47, 1000)))
  })

  it('says how old the price is and offers a refresh', async () => {
    useMarketDataStore.setState({
      quotes: {
        VFV: {
          value: { ticker: 'VFV', price: 130, currency: 'CAD', asOf: '2026-08-14T11:00:00Z' },
          fetchedAt: '2026-08-14T11:00:00Z',
        },
      },
    })
    const holding = {
      id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100, currency: 'CAD' as const, account: 'RRSP',
    }
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{}} totalValueCad={1000} onPrice={() => {}} />
      </tbody></table>,
    )
    expect(await screen.findByLabelText('Refresh VFV price')).toBeInTheDocument()
  })

  it('does not convert a manual override, which is already in the holding currency', async () => {
    // A CAD holding with a manually entered CAD price. Reading the
    // override's placeholder currency as USD multiplies this price by the
    // USD rate: 148.90 becomes 206.51, and the tab disagrees with the
    // dashboard rollup on the same data.
    useMarketDataStore.setState({ overrides: { VFV: 148.9 } })
    const holding = {
      id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100,
      currency: 'CAD' as const, account: 'TFSA',
    }
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{ USD: 1.3869 }} totalValueCad={10000} onPrice={() => {}} />
      </tbody></table>,
    )
    expect(await screen.findByText('148.90')).toBeInTheDocument()
    expect(screen.queryByText('206.51')).not.toBeInTheDocument()
  })
})

describe('row disclosure', () => {
  const holding = {
    id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100,
    currency: 'CAD' as const, account: 'TFSA',
  }

  const renderRow = () =>
    render(
      <table><tbody>
        <HoldingRow holding={holding} rates={{}} totalValueCad={10000} onPrice={() => {}} />
      </tbody></table>,
    )

  it('starts collapsed, with avg cost and book hidden', () => {
    renderRow()
    expect(screen.getByRole('button', { name: 'Details for VFV' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Avg cost')).not.toBeInTheDocument()
    expect(screen.queryByText('Book')).not.toBeInTheDocument()
  })

  it('reveals avg cost and book when opened', () => {
    renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Details for VFV' }))
    expect(screen.getByRole('button', { name: 'Details for VFV' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Avg cost')).toBeInTheDocument()
    expect(screen.getByText('Book')).toBeInTheDocument()
    // Scoped to the detail row: with no live quote, the Price cell also
    // reads 100.00 (it falls back to avgCost), so a page-wide getByText
    // would match both cells.
    const detail = document.getElementById('holding-detail-h1')!
    expect(within(detail).getByText('100.00')).toBeInTheDocument()
    expect(within(detail).getByText(formatMoney(1000))).toBeInTheDocument()
  })

  it('closes again on a second click', () => {
    renderRow()
    const toggle = screen.getByRole('button', { name: 'Details for VFV' })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Avg cost')).not.toBeInTheDocument()
  })

  it('points the disclosure at the detail row it controls', () => {
    renderRow()
    const toggle = screen.getByRole('button', { name: 'Details for VFV' })
    fireEvent.click(toggle)
    const controlled = toggle.getAttribute('aria-controls')
    expect(controlled).toBe('holding-detail-h1')
    expect(document.getElementById(controlled!)).not.toBeNull()
  })
})
