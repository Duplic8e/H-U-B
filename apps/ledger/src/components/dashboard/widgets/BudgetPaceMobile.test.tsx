import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BudgetPaceMobile } from './BudgetPaceMobile'
import { useBudgetStore } from '../../../store/useBudgetStore'
import type { MonthlyBudgetStats } from '../../../store/useBudgetStore'

const initial = useBudgetStore.getState()

// Rent of 1,000 is a bill; 600 of everyday targets. By day 16 of 30 the rent has been paid in full.
const stats = (spent: number): MonthlyBudgetStats => ({
  spent, totalIncome: 0, unallocated: 0, remaining: 1600 - spent,
  perCategory: {
    rent: { id: 'rent', effectiveTarget: 1000, spent: 1000, overspend: 0 },
    food: { id: 'food', effectiveTarget: 600, spent: spent - 1000, overspend: 0 },
  },
} as unknown as MonthlyBudgetStats)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 16)) // day 16 of 30
  useBudgetStore.setState(initial, true)
})
afterEach(() => vi.useRealTimers())

const setBill = (billing: 'bill' | 'everyday') => useBudgetStore.setState({
  categories: { rent: { id: 'rent', groupId: 'g', name: 'Rent', targetAmount: 1000, billing }, food: { id: 'food', groupId: 'g', name: 'Food', targetAmount: 600, billing: 'everyday' } },
})

describe('BudgetPaceMobile', () => {
  it('is on pace after paying rent early, because a bill counts in full from the start', () => {
    setBill('bill')
    const { getByText } = render(<BudgetPaceMobile stats={stats(1200)} now={new Date(2026, 8, 16)} />)
    expect(getByText('On Pace')).toBeInTheDocument()
  })

  it('reads the same spending as ahead of pace when rent is everyday', () => {
    setBill('everyday')
    const { getByText } = render(<BudgetPaceMobile stats={stats(1200)} now={new Date(2026, 8, 16)} />)
    expect(getByText('Ahead of Pace')).toBeInTheDocument()
  })
})
