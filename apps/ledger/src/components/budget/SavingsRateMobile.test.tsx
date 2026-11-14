import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SavingsRateMobile } from './SavingsRateMobile'
import { useBudgetStore } from '../../store/useBudgetStore'

const range = { from: '2026-06', to: '2026-06' }

const tx = (id: string, date: string, amount: number, type: 'income' | 'expense') =>
  ({ id, date, amount, description: id, type, categoryId: '' })

const seed = () =>
  useBudgetStore.setState({
    transactions: Object.fromEntries([
      tx('i6', '2026-06-01', 5000, 'income'), tx('e6', '2026-06-12', 2500, 'expense'),
      tx('i5', '2026-05-01', 4000, 'income'), tx('e5', '2026-05-12', 3000, 'expense'),
      tx('i4', '2026-04-01', 4000, 'income'), tx('e4', '2026-04-12', 4400, 'expense'),
    ].map((t) => [t.id, t])) as never,
  })

afterEach(() => useBudgetStore.setState({ transactions: {} }))

describe('SavingsRateMobile', () => {
  it('leads with the rate gauge and puts Income, Spent and Saved under it', () => {
    seed()
    render(<SavingsRateMobile range={range} />)
    const card = screen.getByRole('region', { name: 'Savings Rate' })
    expect(within(card).getByText('50%')).toBeInTheDocument()
    expect(within(card).getByText('of Income Saved')).toBeInTheDocument()
    expect(within(card).getByText('$5,000')).toBeInTheDocument()
    expect(within(card).getAllByText('$2,500')).toHaveLength(2)
  })

  it('shows a negative rate in the error colour with no filled arc', () => {
    useBudgetStore.setState({ transactions: Object.fromEntries([tx('i', '2026-06-01', 1000, 'income'), tx('e', '2026-06-02', 1500, 'expense')].map((t) => [t.id, t])) as never })
    render(<SavingsRateMobile range={range} />)
    expect(screen.getByText('-50%')).toHaveAttribute('fill', 'var(--error)')
    expect(document.querySelectorAll('svg path[stroke="var(--success)"]')).toHaveLength(0)
  })

  it('switches to the rate of each of the last six months, even for a one month period', () => {
    seed()
    render(<SavingsRateMobile range={range} />)
    fireEvent.click(screen.getByRole('button', { name: 'Trend' }))
    const chart = screen.getByRole('img', { name: /for each of the last 6 months/ })
    expect(within(chart).getByText('50%')).toBeInTheDocument()
    expect(within(chart).getByText('25%')).toBeInTheDocument()
    expect(within(chart).getByText('-10%')).toBeInTheDocument()
    expect(screen.getByText('Apr')).toBeInTheDocument()
  })

  it('switches to saved against spent with a text legend', () => {
    seed()
    render(<SavingsRateMobile range={range} />)
    fireEvent.click(screen.getByRole('button', { name: 'Split' }))
    expect(screen.getByText('$2,500 of $5,000')).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Spent')).toBeInTheDocument()
  })

  it('says so when the period has no income or expenses, and hides the switch', () => {
    render(<SavingsRateMobile range={range} />)
    expect(screen.getByText('No income or expenses in this window yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Trend' })).toBeNull()
  })
})
