import { render, screen, fireEvent } from '@testing-library/react'
import { ReportContributors } from './ReportContributors'
import { sampleReport } from './testFixtures'

describe('ReportContributors', () => {
  it('names the best contributor and the worst detractor', () => {
    render(<ReportContributors report={sampleReport} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('XYZ')).toBeInTheDocument()
  })

  it('hides the full symbol table until asked', () => {
    render(<ReportContributors report={sampleReport} />)
    expect(screen.queryByText('Avg Weight')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show all 2 symbols/ }))
    expect(screen.getByText('Avg Weight')).toBeInTheDocument()
  })

  it('renders nothing without symbol performance data', () => {
    const { container } = render(<ReportContributors report={{ ...sampleReport, performanceBySymbol: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
