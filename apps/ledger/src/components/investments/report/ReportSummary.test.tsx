import { render, screen } from '@testing-library/react'
import { ReportSummary } from './ReportSummary'
import { sampleReport } from './testFixtures'

describe('ReportSummary', () => {
  it('leads with ending NAV and cumulative return', () => {
    render(<ReportSummary report={sampleReport} />)
    expect(screen.getByText('Ending NAV')).toBeInTheDocument()
    expect(screen.getByText('$118,000')).toBeInTheDocument()
    expect(screen.getByText('+18.00%')).toBeInTheDocument()
  })

  it('shows the delta against the first benchmark', () => {
    render(<ReportSummary report={sampleReport} />)
    expect(screen.getByText(/\+6.00% vs SPX/)).toBeInTheDocument()
  })

  it('combines dividends and interest into one income figure', () => {
    render(<ReportSummary report={sampleReport} />)
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
  })

  it('renders nothing when the report has no key statistics', () => {
    const { container } = render(<ReportSummary report={{ ...sampleReport, keyStats: undefined }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
