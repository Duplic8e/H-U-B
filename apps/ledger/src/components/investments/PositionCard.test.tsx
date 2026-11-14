import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PositionCard } from './PositionCard'
import type { Position } from '../../store/useAnalysisStore'

vi.mock('../../services/marketData', () => ({
  useCurrentPrice: () => ({ data: undefined, status: 'idle', refresh: () => {}, setManual: () => {}, clearManual: () => {} }),
}))

const position: Position = {
  id: 'p1', ticker: 'AAPL', plannedAmount: 5000, allocationPct: 50,
  startPrice: 100, startPriceSource: 'manual', acted: false,
  lots: [{ id: 'l1', date: '2026-01-02', amountInvested: 1000, price: 100 }],
}

describe('PositionCard', () => {
  it('starts collapsed showing header numbers, expands on toggle', () => {
    render(<PositionCard analysisId="a1" analysisDate="2026-01-01" position={position} totals={{ plannedAll: 10000, currentAll: 1000 }} />)
    // collapsed: header visible, detail grid hidden
    expect(screen.getByText('AAPL')).toBeTruthy()
    expect(screen.queryByText('If Fully Executed')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /expand aapl/i }))
    expect(screen.getByText('If Fully Executed')).toBeTruthy()
  })
})
