import { render, screen } from '@testing-library/react'
import { CategoryTrendsWidget } from './CategoryTrendsWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  useBudgetStore.setState(budgetInitial, true)
})

describe('CategoryTrendsWidget', () => {
  it('says so when no categorized spending exists', () => {
    render(<CategoryTrendsWidget range={{ from: '2026-08', to: '2026-08' }} />)
    expect(screen.getByText('No categorized spending yet.')).toBeInTheDocument()
  })

  it('names the months covered in its title', () => {
    render(<CategoryTrendsWidget range={{ from: '2026-08', to: '2026-08' }} />)
    expect(screen.getByText('Category Trends (6 Months)')).toBeInTheDocument()
  })

  it('lists a category that has spending', () => {
    useBudgetStore.setState({
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Groceries', targetAmount: 0 } },
      transactions: {
        a: { id: 'a', date: '2026-08-10', amount: 120, description: 'Loblaws', type: 'expense', categoryId: 'c1' },
      },
    })
    render(<CategoryTrendsWidget range={{ from: '2026-08', to: '2026-08' }} />)
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })
})
