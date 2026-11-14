import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReallocationHistory } from './ReallocationHistory'
import { useBudgetStore } from '../../store/useBudgetStore'

beforeEach(() => {
  useBudgetStore.setState({
    categories: {
      rent: { id: 'rent', groupId: 'g', name: 'Rent', targetAmount: 100 },
      food: { id: 'food', groupId: 'g', name: 'Food', targetAmount: 400 },
    },
    reallocations: {
      r1: { id: 'r1', fromCategoryId: 'food', toCategoryId: 'rent', amount: 50, date: '2026-07-10', note: 'oops' },
      r2: { id: 'r2', fromCategoryId: 'food', toCategoryId: 'rent', amount: 10, date: '2026-06-10' },
    },
  })
})

describe('ReallocationHistory', () => {
  it('lists only the selected month and deletes entries', () => {
    render(<ReallocationHistory selectedMonth="2026-07" />)
    expect(screen.getByText(/Food/)).toBeInTheDocument()
    expect(screen.getByText(/\$50/)).toBeInTheDocument()
    expect(screen.queryByText(/\$10/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /delete reallocation/i }))
    expect(useBudgetStore.getState().reallocations.r1).toBeUndefined()
  })

  it('renders nothing when the month is empty', () => {
    const { container } = render(<ReallocationHistory selectedMonth="2026-01" />)
    expect(container.firstChild).toBeNull()
  })

  it('hides rows after collapsing the history', () => {
    render(<ReallocationHistory selectedMonth="2026-07" />)
    expect(screen.getByText(/Food/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reallocations This Month/i }))
    expect(screen.queryByText(/Food/)).toBeNull()
  })
})
