import { describe, expect, it, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MonthlySummaryWidget } from './MonthlySummaryWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  useBudgetStore.setState(budgetInitial, true)
})

describe('MonthlySummaryWidget', () => {
  it('keeps net 1920 when an ordinary receipt becomes an expense offset', () => {
    const rows = {
      salary: { id: 'salary', date: '2026-10-01', amount: 2000, description: 'Salary', type: 'income' as const },
      purchase: { id: 'purchase', date: '2026-10-02', amount: 120, description: 'Purchase', type: 'expense' as const },
      receipt: { id: 'receipt', date: '2026-10-03', amount: 40, description: 'Receipt', type: 'income' as const },
    }
    useBudgetStore.setState({ transactions: rows })
    render(<MonthlySummaryWidget range={{ from: '2026-10', to: '2026-10' }} />)
    const netRow = () => screen.getByText('Net Change').parentElement?.textContent
    expect(netRow()).toBe('Net Change+$1,920')
    act(() => useBudgetStore.setState({ transactions: { ...rows, receipt: { ...rows.receipt, type: 'expense', amount: -40 } } }))
    expect(netRow()).toBe('Net Change+$1,920')
  })
  it('nets cross-month payments only when the selected range includes both months', () => {
    useBudgetStore.setState({ transactions: {
      purchase: { id: 'purchase', date: '2026-09-25', amount: 120, description: 'Purchase', type: 'expense' },
      payment: { id: 'payment', date: '2026-10-03', amount: -40, description: 'Payment', type: 'expense' },
    } })
    const { rerender } = render(<MonthlySummaryWidget range={{ from: '2026-09', to: '2026-09' }} />)
    const moneyOut = () => screen.getByText('Money Out').closest('div.flex.justify-between')?.textContent
    expect(moneyOut()).toBe('Money Out-$120')
    rerender(<MonthlySummaryWidget range={{ from: '2026-10', to: '2026-10' }} />)
    expect(moneyOut()).toBe('Money Out$40')
    rerender(<MonthlySummaryWidget range={{ from: '2026-09', to: '2026-10' }} />)
    expect(moneyOut()).toBe('Money Out-$80')
  })
  it('shows a Projected Net row matching the summary row style', () => {
    const month = new Date().toISOString().slice(0, 7)
    render(<MonthlySummaryWidget range={{ from: month, to: month }} />)
    expect(screen.getByText('Projected Net')).toBeTruthy()
  })
})

describe('MonthlySummaryWidget Money Out', () => {
  it('does not render a double minus when refunds exceed spending for the month', () => {
    // A Chase refund is stored as an expense-typed transaction with a
    // negative amount. If a month's refunds outweigh its other spending,
    // totalExpense (a plain sum over expense-typed transactions) goes
    // negative, and "-{formatMoney(totalExpense)}" renders a double minus
    // like "--$40" instead of a plain positive figure.
    useBudgetStore.setState({
      transactions: {
        a: { id: 'a', date: '2026-08-10', amount: 10, description: 'COFFEE SHOP', type: 'expense' },
        b: { id: 'b', date: '2026-08-15', amount: -50, description: 'RETURN CHASE CREDIT', type: 'expense' },
      },
    })
    render(<MonthlySummaryWidget range={{ from: '2026-08', to: '2026-08' }} />)
    const moneyOutLabel = screen.getByText('Money Out')
    const moneyOutRow = moneyOutLabel.closest('div.flex.justify-between')
    const moneyOutText = moneyOutRow?.textContent ?? ''
    // Pinned to the exact string so a wrong-sign regression (e.g. "-$40")
    // fails this test instead of slipping through a loose toContain check.
    expect(moneyOutText).toBe('Money Out$40')
  })
})
