import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NeedsAttentionCard } from './NeedsAttentionCard'
import { BillsThisMonthCard } from './BillsThisMonthCard'
import { useTriageStore } from '../../store/useTriageStore'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useRecurringStore } from '../../store/useRecurringStore'

const triageInitial = useTriageStore.getState()
const budgetInitial = useBudgetStore.getState()
const recurringInitial = useRecurringStore.getState()
beforeEach(() => {
  useTriageStore.setState(triageInitial, true)
  useBudgetStore.setState(budgetInitial, true)
  useRecurringStore.setState(recurringInitial, true)
  localStorage.clear()
})
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)
const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

describe('NeedsAttentionCard', () => {
  it('renders nothing when there is nothing to do', () => {
    const { container } = wrap(<NeedsAttentionCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists what to categorize and what to review, each linking to its place', () => {
    useTriageStore.getState().addPending([
      { id: 'a', date: '2026-11-01', description: 'SHOP', amount: 5, type: 'expense' },
      { id: 'b', date: '2026-11-01', description: 'TRANSFER', amount: 5, type: 'expense', flag: 'card-payment' },
    ])
    wrap(<NeedsAttentionCard />)
    expect(screen.getByRole('link', { name: /1 to categorize/ })).toHaveAttribute('href', '/budget/categorize')
    expect(screen.getByRole('link', { name: /1 to review/ })).toHaveAttribute('href', '/budget?tab=transactions')
  })

  it('asks for last month once there is data and no import this month, until dismissed', () => {
    useBudgetStore.setState({ transactions: { t: { id: 't', date: '2026-01-01', description: 'X', amount: 1, type: 'expense' } } })
    wrap(<NeedsAttentionCard />)
    expect(screen.getByTestId('import-reminder')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Remind me on the 1st/ })).toHaveAttribute('download')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss import reminder' }))
    expect(screen.queryByTestId('import-reminder')).toBeNull()
  })
})

describe('BillsThisMonthCard', () => {
  it('marks a bill paid once a matching transaction exists, unpaid first', () => {
    useRecurringStore.setState({ plannedBills: [
      { id: 'r', name: 'Rent', amount: 2000, cadence: 'monthly', dueDay: 1 },
      { id: 'p', name: 'Phone', amount: 60, cadence: 'monthly', dueDay: 15 },
      { id: 'y', name: 'Domain', amount: 20, cadence: 'yearly' },
    ] })
    useBudgetStore.setState({ transactions: { t: { id: 't', date: `${thisMonth}-01`, description: 'RENT PAYMENT', amount: 2000, type: 'expense' } } })
    wrap(<BillsThisMonthCard month={thisMonth} />)
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toHaveLength(2) // the yearly bill is not a monthly row
    expect(items[0]).toContain('Phone')
    expect(items[1]).toContain('RentPaid')
    expect(screen.getByText('$60 still to pay')).toBeInTheDocument()
  })

  it('invites adding bills when there are none', () => {
    wrap(<BillsThisMonthCard month={thisMonth} />)
    expect(screen.getByRole('link', { name: /Add bills in Plan/ })).toHaveAttribute('href', '/budget?tab=setup')
  })
})
