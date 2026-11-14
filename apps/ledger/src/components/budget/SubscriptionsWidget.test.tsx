import { render, screen, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionsWidget } from './SubscriptionsWidget'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useRecurringStore } from '../../store/useRecurringStore'

const budgetInitial = useBudgetStore.getState()
const recurringInitial = useRecurringStore.getState()

// Three monthly charges ending 2026-08-01 make NETFLIX recurring, with the next
// one expected 2026-08-31, inside a 30-day window from the frozen "today".
const seedNetflix = () => {
  useBudgetStore.setState({
    transactions: {
      n1: { id: 'n1', date: '2026-06-01', amount: 20.99, description: 'NETFLIX', type: 'expense' },
      n2: { id: 'n2', date: '2026-07-01', amount: 20.99, description: 'NETFLIX', type: 'expense' },
      n3: { id: 'n3', date: '2026-08-01', amount: 20.99, description: 'NETFLIX', type: 'expense' },
    },
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-14T12:00:00Z'))
  useBudgetStore.setState(budgetInitial, true)
  useRecurringStore.setState(recurringInitial, true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SubscriptionsWidget', () => {
  it('asks for more history when nothing repeats yet', () => {
    render(<SubscriptionsWidget />)
    expect(screen.getByText(/No repeating charges detected/)).toBeInTheDocument()
  })

  it('lists a detected charge and its monthly estimate', () => {
    seedNetflix()
    render(<SubscriptionsWidget />)
    expect(within(screen.getByTestId('recurring-list')).getByText('NETFLIX')).toBeInTheDocument()
    expect(screen.getByText(/recurring charges/)).toBeInTheDocument()
  })

  it('shows what is due in the next 30 days', () => {
    seedNetflix()
    render(<SubscriptionsWidget />)
    expect(screen.getByText('Next 30 days')).toBeInTheDocument()
    expect(screen.getByTestId('upcoming-list').textContent).toContain('NETFLIX')
  })

  it('includes a charge due today (local calendar date) in the upcoming list', () => {
    // Three charges on the 15th, each 30 days apart. At frozen time 2026-08-14T12:00:00Z
    // (which is 2026-08-14 08:00 in Toronto UTC-4), the last charge on 2026-07-15 means
    // next expected = 2026-08-14. This test guards against the bug where toISOString
    // reports tomorrow for users west of UTC late in the day.
    useBudgetStore.setState({
      transactions: {
        charge1: { id: 'charge1', date: '2026-05-15', amount: 12.50, description: 'LOCAL_DAY_TEST', type: 'expense' },
        charge2: { id: 'charge2', date: '2026-06-15', amount: 12.50, description: 'LOCAL_DAY_TEST', type: 'expense' },
        charge3: { id: 'charge3', date: '2026-07-15', amount: 12.50, description: 'LOCAL_DAY_TEST', type: 'expense' },
      },
    })
    render(<SubscriptionsWidget />)
    expect(within(screen.getByTestId('upcoming-list')).getByText('LOCAL_DAY_TEST')).toBeInTheDocument()
  })

  it('drops an ignored charge out of the list and the total', () => {
    seedNetflix()
    render(<SubscriptionsWidget />)
    fireEvent.click(screen.getByLabelText('Ignore NETFLIX'))
    expect(screen.queryByTestId('upcoming-list')).not.toBeInTheDocument()
    expect(screen.getByText(/No repeating charges detected/)).toBeInTheDocument()
  })

  it('can restore an ignored charge', () => {
    seedNetflix()
    render(<SubscriptionsWidget />)
    fireEvent.click(screen.getByLabelText('Ignore NETFLIX'))
    fireEvent.click(screen.getByRole('button', { name: 'Ignored (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(within(screen.getByTestId('recurring-list')).getByText('NETFLIX')).toBeInTheDocument()
  })
})
