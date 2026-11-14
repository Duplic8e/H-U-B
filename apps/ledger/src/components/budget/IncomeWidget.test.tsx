import { fireEvent, render, screen } from '@testing-library/react'
import { IncomeWidget } from './IncomeWidget'
import { useBudgetStore } from '../../store/useBudgetStore'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  useBudgetStore.setState(budgetInitial, true)
})

const range = { from: '2026-08', to: '2026-08' }

describe('IncomeWidget', () => {
  it('totals income inside the range only', () => {
    useBudgetStore.setState({
      transactions: {
        i1: { id: 'i1', date: '2026-08-05', amount: 3000, description: 'Pay', type: 'income' },
        i2: { id: 'i2', date: '2026-07-05', amount: 9999, description: 'Old pay', type: 'income' },
      },
    })
    render(<IncomeWidget range={range} />)
    expect(screen.getAllByText(/3,000/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/9,999/)).not.toBeInTheDocument()
  })

  it('breaks income down by category name', () => {
    useBudgetStore.setState({
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Salary', targetAmount: 0 } },
      transactions: {
        i1: { id: 'i1', date: '2026-08-05', amount: 3000, description: 'Pay', type: 'income', categoryId: 'c1' },
      },
    })
    render(<IncomeWidget range={range} />)
    expect(screen.getByText('Salary')).toBeInTheDocument()
  })

  it('files uncategorized income under Other income', () => {
    useBudgetStore.setState({
      transactions: {
        i1: { id: 'i1', date: '2026-08-05', amount: 500, description: 'Cash gift', type: 'income' },
      },
    })
    render(<IncomeWidget range={range} />)
    expect(screen.getByText('Other income')).toBeInTheDocument()
  })

  it('excludes an expense from the income total', () => {
    useBudgetStore.setState({
      transactions: {
        e1: { id: 'e1', date: '2026-08-05', amount: 40, description: 'Groceries', type: 'expense' },
      },
    })
    render(<IncomeWidget range={range} />)
    expect(screen.queryByText(/\$40/)).not.toBeInTheDocument()
  })
})

describe('IncomeWidget on a phone', () => {
  afterEach(() => resetMatchMedia())

  const eightSources = () => {
    const categories: Record<string, { id: string; groupId: string; name: string; targetAmount: number }> = {}
    const transactions: Record<string, { id: string; date: string; amount: number; description: string; type: 'income'; categoryId: string }> = {}
    for (let i = 1; i <= 8; i++) {
      categories[`c${i}`] = { id: `c${i}`, groupId: 'g', name: `Source ${i}`, targetAmount: 0 }
      transactions[`t${i}`] = { id: `t${i}`, date: '2026-08-05', amount: 1000 - i * 10, description: 'x', type: 'income', categoryId: `c${i}` }
    }
    useBudgetStore.setState({ categories, transactions })
  }

  it('shows five sources and a Show all button instead of a scroll area', () => {
    setMatchMedia(false)
    eightSources()
    render(<IncomeWidget range={range} />)
    const group = screen.getByRole('group', { name: 'Income sources' })
    expect(group.children).toHaveLength(5)
    expect(group).not.toHaveAttribute('tabindex')
    expect(group.className).not.toMatch(/overflow-y-auto/)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8 sources' }))
    expect(group.children).toHaveLength(8)
  })

  it('keeps the fixed-height scroll list on desktop', () => {
    eightSources()
    render(<IncomeWidget range={range} />)
    const group = screen.getByRole('group', { name: 'Income sources' })
    expect(group.children).toHaveLength(8)
    expect(group).toHaveAttribute('tabindex', '0')
    expect(group.className).toMatch(/max-h-\[200px\]/)
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull()
  })
})
