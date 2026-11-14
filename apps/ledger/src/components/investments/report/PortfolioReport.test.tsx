import { render, screen, fireEvent } from '@testing-library/react'
import { PortfolioReport } from './PortfolioReport'
import { usePortfolioReportStore } from '../../../store/usePortfolioReportStore'
import { sampleReport } from './testFixtures'

describe('PortfolioReport', () => {
  beforeEach(() => {
    usePortfolioReportStore.setState({ report: sampleReport, uploadedAt: '2026-07-01T00:00:00.000Z' })
  })

  it('renders nothing without a report', () => {
    usePortfolioReportStore.setState({ report: null, uploadedAt: null })
    const { container } = render(<PortfolioReport />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the report period', () => {
    render(<PortfolioReport />)
    expect(screen.getByText('Jan 2026 - Jun 2026')).toBeInTheDocument()
  })

  it('reveals the fee detail when its section is expanded', () => {
    render(<PortfolioReport />)
    fireEvent.click(screen.getByRole('button', { name: /PortfolioAnalyst Report/ }))
    fireEvent.click(screen.getByRole('button', { name: /Fees/ }))
    expect(screen.getByText('Commission')).toBeInTheDocument()
  })

  describe('collapsed by default', () => {
    it('hides the report body until the header is clicked', () => {
      render(<PortfolioReport />)
      expect(screen.queryByText('Ending NAV')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /PortfolioAnalyst Report/ }))
      expect(screen.getByText('Ending NAV')).toBeInTheDocument()
    })
  })
})
