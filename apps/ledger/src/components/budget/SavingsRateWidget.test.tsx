import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SavingsRateWidget } from './SavingsRateWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

const seedIncomeExpense = () =>
  useBudgetStore.setState({
    transactions: {
      i: { id: 'i', date: '2026-06-10', amount: 5000, description: 'Salary', type: 'income' },
      e: { id: 'e', date: '2026-06-12', amount: 2500, description: 'Rent', type: 'expense' },
    },
  })

afterEach(() => {
  useBudgetStore.setState({ transactions: {} })
})

describe('SavingsRateWidget', () => {
  it('defaults to the rate gauge and shows the savings rate for the range', () => {
    seedIncomeExpense()
    render(<SavingsRateWidget range={{ from: '2026-06', to: '2026-06' }} />)
    // income 5000, expense 2500 over the single-month range -> 50%
    expect(screen.getByText('Savings Rate')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('toggles to the split view showing saved and spent', () => {
    seedIncomeExpense()
    render(<SavingsRateWidget range={{ from: '2026-06', to: '2026-06' }} />)
    fireEvent.click(screen.getByText('Split'))
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Spent')).toBeInTheDocument()
  })

  it('toggles to the trend view', () => {
    seedIncomeExpense()
    render(<SavingsRateWidget range={{ from: '2026-06', to: '2026-06' }} />)
    fireEvent.click(screen.getByText('Trend'))
    expect(screen.getByText('Net Saved')).toBeInTheDocument()
  })

  it('renders an empty state when the window has no income or expenses', () => {
    useBudgetStore.setState({ transactions: {} })
    render(<SavingsRateWidget range={{ from: '2026-06', to: '2026-06' }} />)
    expect(screen.getByText('No income or expenses in this window yet.')).toBeInTheDocument()
  })
})
