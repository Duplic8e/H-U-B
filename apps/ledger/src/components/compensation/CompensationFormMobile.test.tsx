import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CompensationModal } from './CompensationModal'
import { useCompensationStore, defaultPrimaryPackage } from '../../store/useCompensationStore'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

const setNum = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe('Edit Compensation Package on a phone', () => {
  beforeEach(() => {
    setMatchMedia(false)
    useCompensationStore.setState({
      primaryPackage: {
        ...defaultPrimaryPackage,
        baseSalary: 120000,
        cashBonusPercent: 10,
        companyCurrentPrice: 100,
        rsuGrants: [{
          id: 'g1', grantName: 'Hire', grantShares: 100, grantPrice: 100, grantStartDate: '2025-01-01',
          vestingSchedule: { preset: '3yr-no-cliff', totalVestMonths: 36, cliffMonths: 0, frequency: 'monthly' },
        }],
      },
      timeMode: 'next-1-year',
    })
  })
  afterEach(() => resetMatchMedia())

  it('has no title row, only the pinned Save button, and leads with the live total', () => {
    const { baseElement } = render(<CompensationModal isOpen onClose={() => {}} />)
    expect(screen.queryByRole('heading', { name: 'Edit Compensation Package' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save Compensation Package' })).toBeInTheDocument()
    expect(baseElement.querySelector('[data-key-figure]')).toHaveTextContent('$')
  })

  it('updates the total as the base salary changes', () => {
    const { baseElement } = render(<CompensationModal isOpen onClose={() => {}} />)
    const before = baseElement.querySelector('[data-key-figure]')!.textContent
    setNum('Current Base Salary ($)', '200000')
    expect(baseElement.querySelector('[data-key-figure]')!.textContent).not.toBe(before)
  })

  it('shows the stock fields above the tabs and each tab in its own cards', () => {
    render(<CompensationModal isOpen onClose={() => {}} />)
    expect(screen.getByLabelText('Ticker (Optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Stock Price (USD)')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Base Salary ($)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Equity' }))
    expect(screen.getByText('Current Grants')).toBeInTheDocument()
    expect(screen.getByText('Hire')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Benefits' }))
    expect(screen.getByLabelText('Contribution (%)')).toBeInTheDocument()
    expect(screen.getByLabelText('Lock-In End Date')).toBeInTheDocument()
    expect(screen.getByLabelText('Match Cap ($)')).toBeInTheDocument()
  })

  it('saves the package fields from all three tabs', () => {
    render(<CompensationModal isOpen onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ticker (Optional)'), { target: { value: ' msft ' } })
    setNum('Stock Price (USD)', '300')
    setNum('Current Base Salary ($)', '150000')
    setNum('Cash Bonus (%)', '12')
    fireEvent.click(screen.getByRole('button', { name: 'Benefits' }))
    setNum('Contribution (%)', '8')
    setNum('Match (%)', '4')
    fireEvent.click(screen.getByRole('button', { name: 'Save Compensation Package' }))
    const pkg = useCompensationStore.getState().primaryPackage
    expect(pkg).toMatchObject({ companyTicker: 'MSFT', companyCurrentPrice: 300, baseSalary: 150000, cashBonusPercent: 12, esppContributionPercent: 8, rrspMatchPercent: 4 })
  })

  it('adds and removes a past salary change with labelled fields on every row', () => {
    render(<CompensationModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Add$/ }))
    expect(screen.getAllByLabelText('Previous Salary ($)').length).toBeGreaterThan(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove salary change' })[0])
    expect(screen.getAllByLabelText('Previous Salary ($)')).toHaveLength(1)
  })

  it('edits a grant from its pencil button and removes a grant', () => {
    render(<CompensationModal isOpen onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Equity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Hire' }))
    expect(screen.getByRole('heading', { name: 'Edit RSU Grant' })).toBeInTheDocument()
    expect(screen.getByLabelText('RSU Grant Name')).toHaveValue('Hire')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hire' }))
    expect(useCompensationStore.getState().primaryPackage.rsuGrants).toHaveLength(0)
  })
})
