import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BudgetHealthWidget } from './BudgetHealthWidget'
import { useBudgetStore } from '../../../store/useBudgetStore'
import { setMatchMedia } from '../../../test-utils/matchMedia'

const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  useBudgetStore.setState(budgetInitial, true)
})

const renderWidget = () =>
  render(
    <MemoryRouter>
      <BudgetHealthWidget />
    </MemoryRouter>,
  )

describe('BudgetHealthWidget', () => {
  it('points a user with no transactions at the Budgeting page', () => {
    renderWidget()
    expect(screen.getByRole('link', { name: 'Add Transactions' })).toHaveAttribute(
      'href',
      '/budget',
    )
  })

  it('shows the remaining figure once transactions exist', () => {
    const month = new Date().toISOString().slice(0, 7)
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Housing', kind: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 1000 } },
      transactions: {
        t1: { id: 't1', date: `${month}-05`, amount: 400, description: 'Rent', type: 'expense', categoryId: 'c1' },
      },
    })
    renderWidget()
    expect(screen.getByText('$600')).toBeInTheDocument()
    expect(screen.getByText('left of targets · $400 spent')).toBeInTheDocument()
  })

  describe('on a phone', () => {
    const seed = (amount: number) => {
      const month = new Date().toISOString().slice(0, 7)
      useBudgetStore.setState({
        categoryGroups: { g1: { id: 'g1', name: 'Housing', kind: 'expense' } },
        categories: { c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 1000 } },
        transactions: {
          t1: { id: 't1', date: `${month}-01`, amount, description: 'Rent', type: 'expense', categoryId: 'c1' },
        },
      })
    }
    beforeEach(() => setMatchMedia(false))
    afterEach(() => setMatchMedia(true))

    it('shows the daily limit, the pace pill and the day caption', () => {
      seed(1)
      renderWidget()
      expect(screen.getByText('Daily Spent Limit')).toBeInTheDocument()
      expect(screen.getByText('On Pace')).toBeInTheDocument()
      expect(screen.getByText('$1 spent')).toBeInTheDocument()
      expect(screen.getByText(/^Day \d+ of \d+$/)).toBeInTheDocument()
    })

    it('says Ahead of Pace once spending outruns the calendar', () => {
      seed(1000)
      renderWidget()
      expect(screen.getByText('Ahead of Pace')).toBeInTheDocument()
    })
  })
})
