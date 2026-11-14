import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpendingHeatmapWidget } from './SpendingHeatmapWidget'
import { useBudgetStore } from '../../store/useBudgetStore'

beforeEach(() => {
  useBudgetStore.setState({ transactions: {} })
})

describe('SpendingHeatmapWidget legend', () => {
  it('shows a color-swatch legend instead of the darker-equals-more text', () => {
    useBudgetStore.setState({
      transactions: {
        t1: { id: 't1', date: '2026-07-03', amount: 50, type: 'expense', description: '', categoryId: undefined },
      } as never,
    })
    render(<SpendingHeatmapWidget range={{ from: '2026-07', to: '2026-07' }} />)
    expect(screen.queryByText(/Darker = more/i)).toBeNull()
    expect(screen.getByTestId('heatmap-legend')).toBeTruthy()
    expect(screen.getByText('$0')).toBeTruthy()
  })
})

describe('SpendingHeatmapWidget income marker', () => {
  it('marks income days with a green dot without affecting spend heat', () => {
    // seed store: one income tx on day 05, no expenses
    useBudgetStore.setState({
      transactions: {
        i1: { id: 'i1', date: '2026-07-05', amount: 2000, description: 'pay', type: 'income' },
      } as never,
    })
    render(<SpendingHeatmapWidget range={{ from: '2026-07', to: '2026-07' }} />)
    expect(screen.getByTestId('income-marker-5')).toBeInTheDocument()
    // day cell must have no heat background (income excluded from spend)
    const cell = screen.getByTitle(/2026-07-05/)
    expect(cell.style.backgroundColor).toBe('transparent')
  })

  it('shows the income legend entry', () => {
    render(<SpendingHeatmapWidget range={{ from: '2026-07', to: '2026-07' }} />)
    expect(screen.getByText(/income/i)).toBeInTheDocument()
  })
})
