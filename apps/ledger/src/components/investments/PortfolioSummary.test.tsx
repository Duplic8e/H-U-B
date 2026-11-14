import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PortfolioSummary } from './PortfolioSummary'
import type { Holding } from '../../store/usePortfolioStore'

const h = (over: Partial<Holding>): Holding => ({
  id: 'h1', ticker: 'AAA', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA', ...over,
})

const rows = [
  { holding: h({ id: '1', ticker: 'VFV' }), price: 150 },
  { holding: h({ id: '2', ticker: 'CNQ', account: 'RRSP' }), price: 90 },
]

describe('PortfolioSummary', () => {
  it('leads with the holdings value and its all-time delta', () => {
    render(<PortfolioSummary rows={rows} rates={{}} nav={null} onRetryRates={() => {}} />)
    // 1500 + 900 against a 2000 cost basis.
    expect(screen.getByText('$2,400')).toBeInTheDocument()
    expect(screen.getByText(/\+\$400/)).toBeInTheDocument()
    expect(screen.getByText(/\+20\.0%/)).toBeInTheDocument()
  })

  it('names the strongest and weakest holdings', () => {
    render(<PortfolioSummary rows={rows} rates={{}} nav={null} onRetryRates={() => {}} />)
    expect(screen.getByText('Strongest')).toBeInTheDocument()
    expect(screen.getByText(/VFV \+50\.0%/)).toBeInTheDocument()
    expect(screen.getByText('Weakest')).toBeInTheDocument()
    expect(screen.getByText(/CNQ -10\.0%/)).toBeInTheDocument()
  })

  it('colours the strongest value by its own sign instead of always positive', () => {
    // Both holdings are down. VFV lost the least, so it is "strongest" by
    // rank, but that is not the same as being positive: it must not carry
    // the accent (positive) colour.
    const allNegative = [
      { holding: h({ id: '1', ticker: 'VFV' }), price: 80 },
      { holding: h({ id: '2', ticker: 'CNQ', account: 'RRSP' }), price: 50 },
    ]
    render(<PortfolioSummary rows={allNegative} rates={{}} nav={null} onRetryRates={() => {}} />)
    const strongestValue = screen.getByText(/VFV -20\.0%/)
    expect(strongestValue).toHaveClass('text-error')
    expect(strongestValue).not.toHaveClass('text-accent')
  })

  it('omits both strongest and weakest for a single holding portfolio', () => {
    // A single holding has no second data point to contrast against
    // (portfolioHighlights leaves weakest null for exactly this reason), so
    // the spread check that also gates strongest never has both sides to
    // compare and neither fact renders.
    const single = [{ holding: h({ id: '1', ticker: 'VFV' }), price: 150 }]
    render(<PortfolioSummary rows={single} rates={{}} nav={null} onRetryRates={() => {}} />)
    expect(screen.queryByText('Strongest')).not.toBeInTheDocument()
    expect(screen.queryByText('Weakest')).not.toBeInTheDocument()
  })

  it('shows the account value and its cash sleeve only when a report has been uploaded', () => {
    const { rerender } = render(<PortfolioSummary rows={rows} rates={{}} nav={null} onRetryRates={() => {}} />)
    expect(screen.queryByText(/^Account Value/)).not.toBeInTheDocument()
    rerender(
      <PortfolioSummary
        rows={rows}
        rates={{}}
        nav={{ nav: 5000, cash: -250, baseCurrency: 'CAD' }}
        onRetryRates={() => {}}
      />,
    )
    expect(screen.getByText('Account Value (CAD)')).toBeInTheDocument()
    expect(screen.getByText('$5,000')).toBeInTheDocument()
    expect(screen.getByText(/Cash -\$250/)).toBeInTheDocument()
  })

  it('omits the cash line when the report has no cash sleeve', () => {
    render(
      <PortfolioSummary
        rows={rows}
        rates={{}}
        nav={{ nav: 5000, cash: null, baseCurrency: 'USD' }}
        onRetryRates={() => {}}
      />,
    )
    expect(screen.getByText('Account Value (USD)')).toBeInTheDocument()
    expect(screen.queryByText(/Cash/)).not.toBeInTheDocument()
  })

  it('warns about excluded holdings and offers a retry', () => {
    const onRetryRates = vi.fn()
    // EUR has no rate, so this holding cannot be valued in CAD at all.
    const excluded = [...rows, { holding: h({ id: '3', ticker: 'ASML', currency: 'EUR' as const }), price: 100 }]
    render(<PortfolioSummary rows={excluded} rates={{}} nav={null} onRetryRates={onRetryRates} />)
    expect(screen.getByText(/1 holding left out of these totals/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry exchange rates' }))
    expect(onRetryRates).toHaveBeenCalledTimes(1)
  })

  it('says nothing about exclusions when every holding converts', () => {
    render(<PortfolioSummary rows={rows} rates={{}} nav={null} onRetryRates={() => {}} />)
    expect(screen.queryByText(/left out of these totals/)).not.toBeInTheDocument()
  })

  it('omits strongest and weakest when every holding is flat', () => {
    // With no live quotes every holding prices at its own cost basis, so
    // every plPct is 0 and there is no genuine spread to report.
    const flatRows = [
      { holding: h({ id: '1', ticker: 'VFV' }), price: 100 },
      { holding: h({ id: '2', ticker: 'CNQ', account: 'RRSP' }), price: 100 },
    ]
    render(<PortfolioSummary rows={flatRows} rates={{}} nav={null} onRetryRates={() => {}} />)
    expect(screen.queryByText('Strongest')).not.toBeInTheDocument()
    expect(screen.queryByText('Weakest')).not.toBeInTheDocument()
  })
})
