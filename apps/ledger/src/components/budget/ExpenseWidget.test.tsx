import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ExpenseWidget } from './ExpenseWidget'
import { useBudgetStore } from '../../store/useBudgetStore'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

describe('ExpenseWidget', () => {
  it('renders $0.00 without an empty-state message when there are no expenses', () => {
    useBudgetStore.setState({ transactions: {}, categories: {} })
    render(<ExpenseWidget range={{ from: '2026-07', to: '2026-07' }} />)
    expect(screen.getByText('Expenses')).toBeTruthy()
    expect(screen.getByText(/\$0/)).toBeTruthy()
    expect(screen.queryByText(/No expenses this month/i)).toBeNull()
  })

  it('splits a transaction across the two groups its slices belong to', () => {
    useBudgetStore.setState({
      categoryGroups: {
        g1: { id: 'g1', name: 'Food', kind: 'expense' },
        g2: { id: 'g2', name: 'Shopping', kind: 'expense' },
      },
      categories: {
        groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        household: { id: 'household', groupId: 'g2', name: 'Household', targetAmount: 0 },
      },
      transactions: {
        t1: {
          id: 't1',
          date: '2026-08-04',
          amount: 180,
          description: 'Costco',
          type: 'expense',
          categoryId: 'groceries',
          splits: [
            { categoryId: 'groceries', amount: 120 },
            { categoryId: 'household', amount: 60 },
          ],
        },
      },
    })
    render(<ExpenseWidget range={{ from: '2026-08', to: '2026-08' }} />)
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Shopping')).toBeInTheDocument()
  })
})

describe('ExpenseWidget on a phone', () => {
  afterEach(() => resetMatchMedia())

  const range = { from: '2026-08', to: '2026-08' }

  const eightGroups = () => {
    const categoryGroups: Record<string, { id: string; name: string; kind: 'expense' }> = {}
    const categories: Record<string, { id: string; groupId: string; name: string; targetAmount: number }> = {}
    const transactions: Record<string, { id: string; date: string; amount: number; description: string; type: 'expense'; categoryId: string }> = {}
    for (let i = 1; i <= 8; i++) {
      categoryGroups[`g${i}`] = { id: `g${i}`, name: `Group ${i}`, kind: 'expense' }
      categories[`c${i}`] = { id: `c${i}`, groupId: `g${i}`, name: `Category ${i}`, targetAmount: 0 }
      transactions[`t${i}`] = { id: `t${i}`, date: '2026-08-05', amount: 1000 - i * 10, description: 'x', type: 'expense', categoryId: `c${i}` }
    }
    useBudgetStore.setState({ categoryGroups, categories, transactions })
  }

  it('shows five groups and a Show all button instead of a scroll area', () => {
    setMatchMedia(false)
    eightGroups()
    render(<ExpenseWidget range={range} />)
    const group = screen.getByRole('group', { name: 'Expense categories' })
    expect(group.children).toHaveLength(5)
    expect(group).not.toHaveAttribute('tabindex')
    expect(group.className).not.toMatch(/overflow-y-auto/)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8 categories' }))
    expect(group.children).toHaveLength(8)
  })

  it('keeps the fixed-height scroll list on desktop', () => {
    eightGroups()
    render(<ExpenseWidget range={range} />)
    const group = screen.getByRole('group', { name: 'Expense categories' })
    expect(group.children).toHaveLength(8)
    expect(group).toHaveAttribute('tabindex', '0')
    expect(group.className).toMatch(/max-h-\[200px\]/)
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull()
  })
})
