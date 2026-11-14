import { render, screen } from '@testing-library/react'
import { TaxYearNotice } from './TaxYearNotice'

describe('TaxYearNotice', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing while the tax year is current and no year label is requested', () => {
    const { container } = render(<TaxYearNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the year label without a warning when asked, while current', () => {
    render(<TaxYearNotice showYearLabel />)
    expect(screen.getByText(/2026 tax year/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  describe('once the tax year has passed', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2027-03-01T00:00:00Z'))
    })

    it('warns even when the year label was not requested', () => {
      render(<TaxYearNotice />)
      expect(
        screen.getByText(/These are 2026 rates\. Brackets and contribution limits have not been updated for 2027\./i),
      ).toBeInTheDocument()
    })

    it('shows both the year label and the warning when the label is requested', () => {
      render(<TaxYearNotice showYearLabel />)
      expect(screen.getByText(/2026 tax year/i)).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(/These are 2026 rates/i)
    })
  })
})
