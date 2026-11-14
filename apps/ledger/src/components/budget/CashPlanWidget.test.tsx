import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CashPlanWidget } from './CashPlanWidget'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useCompensationStore, defaultPrimaryPackage, esppSummary, esppOfferingEnd } from '../../store/useCompensationStore'
import { useRecurringStore } from '../../store/useRecurringStore'

const budgetInitial = useBudgetStore.getState()
const compInitial = useCompensationStore.getState()
const recurringInitial = useRecurringStore.getState()

beforeEach(() => {
  useBudgetStore.setState(budgetInitial, true)
  useCompensationStore.setState(compInitial, true)
  useRecurringStore.setState(recurringInitial, true)
  useBudgetStore.setState({
    categoryGroups: { g: { id: 'g', name: 'Home', kind: 'expense' } },
    categories: { housing: { id: 'housing', groupId: 'g', name: 'Housing', targetAmount: 2200 } },
  })
})
const show = () => render(<MemoryRouter><CashPlanWidget /></MemoryRouter>)

it('points to Compensation until a salary exists', () => {
  show()
  expect(screen.getByText(/Add your salary in Compensation/)).toBeInTheDocument()
})

it('takes ESPP off salary and restates every line per period', () => {
  useCompensationStore.getState().setPrimaryPackage({ baseSalary: 120000, esppContributionPercent: 10 })
  show()
  const card = screen.getByTestId('cash-plan')
  expect(within(card).getByText('$10,000')).toBeInTheDocument() // salary per month
  expect(within(card).getByText('−$1,000')).toBeInTheDocument() // ESPP per month
  fireEvent.change(screen.getByLabelText('Show amounts per'), { target: { value: 'yearly' } })
  expect(within(card).getByText('$120,000')).toBeInTheDocument()
  expect(within(card).getByText('−$12,000')).toBeInTheDocument()
  expect(useRecurringStore.getState().planPeriod).toBe('yearly')
})

it('adds, edits and deletes a recurring bill', async () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Add Bill' }))
  let sheet = await screen.findByRole('dialog', { name: 'Add bill' })
  fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Rent' } })
  fireEvent.change(within(sheet).getByLabelText('Amount'), { target: { value: '2000' } })
  fireEvent.change(within(sheet).getByLabelText('Budget category (optional)'), { target: { value: 'housing' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add Bill' }))
  expect(useRecurringStore.getState().plannedBills).toMatchObject([{ name: 'Rent', amount: 2000, cadence: 'monthly', dueDay: 1, categoryId: 'housing' }])

  fireEvent.click(screen.getByRole('button', { name: 'Edit Rent' }))
  sheet = await screen.findByRole('dialog', { name: 'Edit bill' })
  fireEvent.change(within(sheet).getByLabelText('Amount'), { target: { value: '2100' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
  expect(useRecurringStore.getState().plannedBills[0].amount).toBe(2100)

  fireEvent.click(screen.getByRole('button', { name: 'Edit Rent' }))
  sheet = await screen.findByRole('dialog', { name: 'Edit bill' })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Delete Bill' }))
  expect(useRecurringStore.getState().plannedBills).toEqual([])
})

describe('ESPP figures', () => {
  const pkg = { ...defaultPrimaryPackage, baseSalary: 100000, companyCurrentPrice: 80, esppContributionPercent: 10, esppDiscountPercent: 15,
    esppEnrollmentDate: '2025-06-01', esppOfferingMonths: 24, esppLookbackPrice: 50, esppLockedInPrice: 42.5 }

  it('ends the offering period the given months after enrollment', () => {
    expect(esppOfferingEnd('2025-06-01', 24)).toBe('2027-06-01')
    expect(esppOfferingEnd(undefined, 24)).toBeUndefined()
  })

  it('buys at the locked price while the period runs', () => {
    const s = esppSummary(pkg, new Date(2026, 10, 11))
    expect(s.annualContribution).toBe(10000)
    expect(s.expectedPurchasePrice).toBeCloseTo(42.5) // min(50, 80) less 15%
    expect(s.purchasePrice).toBe(42.5)
    expect(s.monthsLeft).toBe(6)
    expect(s.annualGain).toBeCloseTo((10000 / 42.5) * 80 - 10000)
  })

  it('falls back to today less the discount once the period has ended', () => {
    const s = esppSummary(pkg, new Date(2027, 7, 1))
    expect(s.purchasePrice).toBeCloseTo(68)
    expect(s.monthsLeft).toBe(0)
  })
})
