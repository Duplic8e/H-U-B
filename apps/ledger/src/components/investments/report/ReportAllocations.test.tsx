import { render, screen } from '@testing-library/react'
import { ReportAllocations } from './ReportAllocations'
import { sampleReport } from './testFixtures'

describe('ReportAllocations', () => {
  it('labels each of the three breakdowns', () => {
    render(<ReportAllocations report={sampleReport} />)
    expect(screen.getByText('By Asset Class')).toBeInTheDocument()
    expect(screen.getByText('By Sector')).toBeInTheDocument()
    expect(screen.getByText('By Region')).toBeInTheDocument()
  })

  it('lists each slice with its percentage and value', () => {
    render(<ReportAllocations report={sampleReport} />)
    expect(screen.getByText(/Technology · 60\.0% · \$70,800/)).toBeInTheDocument()
  })

  it('orders slices largest-first regardless of the order the report listed them', () => {
    render(
      <ReportAllocations
        report={{
          ...sampleReport,
          sectorAllocation: [
            { name: 'Small', endingNav: 1000, endingPct: 1 },
            { name: 'Biggest', endingNav: 90000, endingPct: 76 },
            { name: 'Middle', endingNav: 27000, endingPct: 23 },
          ],
          regionAllocation: [],
          assetClassAllocation: [],
        }}
      />,
    )
    const labels = screen.getAllByRole('listitem').map((el) => el.textContent)
    expect(labels).toEqual([
      expect.stringContaining('Biggest'),
      expect.stringContaining('Middle'),
      expect.stringContaining('Small'),
    ])
  })

  it('renders nothing when every breakdown is empty', () => {
    const { container } = render(
      <ReportAllocations report={{ ...sampleReport, sectorAllocation: [], regionAllocation: [], assetClassAllocation: [] }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
