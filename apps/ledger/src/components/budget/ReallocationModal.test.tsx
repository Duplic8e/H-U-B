import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReallocationModal } from './ReallocationModal'
import { useBudgetStore } from '../../store/useBudgetStore'

beforeEach(() => {
  useBudgetStore.setState({
    paradigm: 'Zero-Based',
    transactions: {},
    reallocations: {},
    categoryGroups: { ge: { id: 'ge', name: 'Housing', kind: 'expense' } },
    categories: {
      rent: { id: 'rent', groupId: 'ge', name: 'Rent', targetAmount: 100 },
      food: { id: 'food', groupId: 'ge', name: 'Food', targetAmount: 400 },
    },
  })
})

describe('ReallocationModal', () => {
  it('creates a reallocation into the overspent category', () => {
    render(
      <ReallocationModal
        isOpen
        onClose={() => {}}
        toCategoryId="rent"
        defaultAmount={50}
        selectedMonth="2026-07"
      />,
    )
    // from-category select defaults to first other category (food)
    fireEvent.click(screen.getByRole('button', { name: /move budget/i }))
    const reallocs = Object.values(useBudgetStore.getState().reallocations)
    expect(reallocs).toHaveLength(1)
    expect(reallocs[0]).toMatchObject({ fromCategoryId: 'food', toCategoryId: 'rent', amount: 50 })
    expect(reallocs[0].date.startsWith('2026-07')).toBe(true)
  })

  it('does not submit a zero amount', () => {
    render(
      <ReallocationModal isOpen onClose={() => {}} toCategoryId="rent" defaultAmount={0} selectedMonth="2026-07" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /move budget/i }))
    expect(Object.values(useBudgetStore.getState().reallocations)).toHaveLength(0)
  })
})
