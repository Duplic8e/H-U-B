import { render, screen } from '@testing-library/react'
import { AnomalyAlertsWidget } from './AnomalyAlertsWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  useBudgetStore.setState(budgetInitial, true)
})

describe('AnomalyAlertsWidget', () => {
  it('reassures the user when nothing is unusual', () => {
    render(<AnomalyAlertsWidget range={{ from: '2026-08', to: '2026-08' }} />)
    expect(screen.getByText('Nothing unusual in this period.')).toBeInTheDocument()
  })

  it('flags a category spiking well above its three-month average', () => {
    useBudgetStore.setState({
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Dining', targetAmount: 0 } },
      transactions: {
        a: { id: 'a', date: '2026-05-10', amount: 100, description: 'D', type: 'expense', categoryId: 'c1' },
        b: { id: 'b', date: '2026-06-10', amount: 100, description: 'D', type: 'expense', categoryId: 'c1' },
        c: { id: 'c', date: '2026-07-10', amount: 100, description: 'D', type: 'expense', categoryId: 'c1' },
        d: { id: 'd', date: '2026-08-10', amount: 900, description: 'D', type: 'expense', categoryId: 'c1' },
      },
    })
    render(<AnomalyAlertsWidget range={{ from: '2026-08', to: '2026-08' }} />)
    expect(screen.getByText('Dining')).toBeInTheDocument()
  })
})
