import { render, screen, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InsightsMobile } from './InsightsMobile'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useRecurringStore } from '../../store/useRecurringStore'

const budgetInitial = useBudgetStore.getState()
const recurringInitial = useRecurringStore.getState()
const range = { from: '2026-08', to: '2026-08' }

const monthly = (name: string, amount: number, day: string) =>
  ['2026-05', '2026-06', '2026-07'].map((m, i) => ({ id: `${name}${i}`, date: `${m}-${day}`, amount, description: name, type: 'expense' as const, categoryId: 'c1' }))
const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((t) => [t.id, t]))

const seed = (extra: ReturnType<typeof monthly> = []) =>
  useBudgetStore.setState({
    categories: { c1: { id: 'c1', groupId: 'g', name: 'Bills', targetAmount: 0 }, dining: { id: 'dining', groupId: 'g', name: 'Dining Out', targetAmount: 0 } },
    transactions: byId([
      ...monthly('NETFLIX', 18, '15'), ...monthly('GYM', 49, '25'), ...extra,
      // Dining: about 100 a month, then 400 in August, which is the alert.
      { id: 'd1', date: '2026-05-10', amount: 100, description: 'Cafe A', type: 'expense', categoryId: 'dining' },
      { id: 'd2', date: '2026-06-10', amount: 100, description: 'Cafe B', type: 'expense', categoryId: 'dining' },
      { id: 'd3', date: '2026-07-10', amount: 100, description: 'Cafe C', type: 'expense', categoryId: 'dining' },
      { id: 'd4', date: '2026-08-10', amount: 400, description: 'Tasting Menu', type: 'expense', categoryId: 'dining' },
    ] as never[]),
  })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-14T12:00:00'))
  useBudgetStore.setState(budgetInitial, true)
  useRecurringStore.setState(recurringInitial, true)
})
afterEach(() => vi.useRealTimers())

describe('InsightsMobile', () => {
  it('asks for more history when nothing repeats', () => {
    render(<InsightsMobile range={range} />)
    expect(screen.getByText(/No repeating charges detected/)).toBeInTheDocument()
    expect(screen.queryByText(/Spending Alert/)).toBeNull()
  })

  it('groups what is due by week with a total', () => {
    seed()
    render(<InsightsMobile range={range} />)
    const week = screen.getByRole('group', { name: 'This Week' })
    expect(within(week).getByText('NETFLIX')).toBeInTheDocument()
    expect(within(week).getByText(/Aug 15/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Next Week' })).toHaveTextContent('GYM')
    expect(screen.getByText(/in 30 Days/)).toBeInTheDocument()
  })

  it('shows a banner for spending alerts and opens the comparison on tap', () => {
    seed()
    render(<InsightsMobile range={range} />)
    expect(screen.queryByText('Usual')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /1 Spending Alert/ }))
    expect(screen.getByText('Dining Out')).toBeInTheDocument()
    expect(screen.getByText('4.0×')).toBeInTheDocument()
    expect(screen.getByText('Usual')).toBeInTheDocument()
  })

  it('has no banner when nothing is unusual', () => {
    render(<InsightsMobile range={range} />)
    expect(screen.queryByRole('button', { name: /Spending Alert/ })).toBeNull()
  })

  it('keeps the long lists folded until opened, each under one title', () => {
    seed()
    render(<InsightsMobile range={range} />)
    expect(screen.queryByTestId('recurring-list')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /All Recurring Charges/ }))
    expect(within(screen.getByTestId('recurring-list')).getByText('GYM')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Spending Calendar/ }))
    expect(screen.getAllByText('Spending Calendar')).toHaveLength(2)
  })

  it('ignores a charge and restores it from the Ignored list', () => {
    seed()
    render(<InsightsMobile range={range} />)
    fireEvent.click(screen.getByRole('button', { name: /All Recurring Charges/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ignore GYM' }))
    expect(within(screen.getByTestId('recurring-list')).queryByText('GYM')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Ignored \(1\)/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore GYM' }))
    expect(within(screen.getByTestId('recurring-list')).getByText('GYM')).toBeInTheDocument()
  })
})
