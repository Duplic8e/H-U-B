import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CompensationMobile } from './CompensationMobile'
import { useCompensationStore, defaultPrimaryPackage } from '../../store/useCompensationStore'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

const renderIt = () =>
  render(
    <MemoryRouter>
      <CompensationMobile equity={<div>Equity Slot</div>} compare={<button>Compare Another Offer</button>} />
    </MemoryRouter>,
  )

describe('CompensationMobile', () => {
  beforeEach(() => {
    setMatchMedia(false)
    useCompensationStore.setState({
      primaryPackage: {
        ...defaultPrimaryPackage,
        baseSalary: 150000,
        cashBonusPercent: 10,
        companyCurrentPrice: 100,
        rsuGrants: [{
          id: 'g1', grantName: 'Hire', grantShares: 100, grantPrice: 100, grantStartDate: '2025-01-01',
          vestingSchedule: { preset: '3yr-no-cliff', totalVestMonths: 36, cliffMonths: 0, frequency: 'monthly' },
        }],
      },
      timeMode: 'next-1-year',
      showAfterTax: false,
      useCadConversion: false,
    })
  })
  afterEach(() => resetMatchMedia())

  it('leads with the total and a described donut, then the breakdown rows', () => {
    const { container } = renderIt()
    expect(container.querySelector('[data-key-figure]')).toHaveTextContent('$')
    expect(screen.getByRole('img', { name: /Total annual compensation split as Base Salary/ })).toBeInTheDocument()
    expect(screen.getAllByText('Base Salary').length).toBeGreaterThan(0)
  })

  it('flips the period with both options visible', () => {
    renderIt()
    const flip = screen.getByRole('button', { name: 'Period: Next 1 Year. Switch to Current Year' })
    expect(flip).toHaveTextContent('Current Year')
    expect(flip).toHaveTextContent('Next 1 Year')
    fireEvent.click(flip)
    expect(useCompensationStore.getState().timeMode).toBe('current-year')
  })

  it('shows the after-tax block only while After-Tax is on', () => {
    renderIt()
    expect(screen.queryByText('Net Monthly')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Gross or After-Tax: Gross. Switch to After-Tax' }))
    expect(screen.getByText('Net Monthly')).toBeInTheDocument()
    expect(screen.getByText('Net Biweekly')).toBeInTheDocument()
    expect(screen.getByText('Deductions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Full Breakdown in Salary & Tax/ })).toBeInTheDocument()
  })

  it('switches the breakdown to the Monthly Cash Flow view', () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Monthly Cash Flow' }))
    expect(screen.getByText('Average per month')).toBeInTheDocument()
    expect(screen.getAllByText('/ mo').length).toBeGreaterThan(0)
  })

  it('edits the stock price from Package Details and locks it under CAD conversion', () => {
    renderIt()
    const input = screen.getByLabelText('Current Stock Price (USD)')
    fireEvent.change(input, { target: { value: '125' } })
    fireEvent.blur(input)
    expect(useCompensationStore.getState().primaryPackage.companyCurrentPrice).toBe(125)
    fireEvent.click(screen.getByRole('switch', { name: 'Convert to CAD' }))
    expect(screen.getByLabelText('Current Stock Price (CAD)')).toBeDisabled()
  })

  it('labels the base salary by period and renders the equity and compare slots', () => {
    renderIt()
    expect(screen.getByText('Current Base Salary')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }))
    expect(screen.getByText('Blended Base Salary')).toBeInTheDocument()
    expect(screen.getByText('Equity Slot')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compare Another Offer' })).toBeInTheDocument()
  })
})
