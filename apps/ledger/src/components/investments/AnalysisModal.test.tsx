import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AnalysisModal } from './AnalysisModal'
import { useAnalysisStore } from '../../store/useAnalysisStore'
import { setMatchMedia } from '../../test-utils/matchMedia'

vi.mock('../../services/marketData', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHistoricalPrice: () => ({ data: { value: { close: 150 }, source: 'test', stale: false }, status: 'success' }),
}))

describe('AnalysisModal (new analysis)', () => {
  it('creates an analysis with plannedBudget and per-ticker allocations', () => {
    useAnalysisStore.setState({ analyses: [] })
    render(<AnalysisModal isOpen onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Planned Budget ($)'), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText('Ticker 1'), { target: { value: 'aapl' } })
    fireEvent.change(screen.getByLabelText('Allocation % 1'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /save analysis/i }))
    const a = useAnalysisStore.getState().analyses[0]
    expect(a.plannedBudget).toBe(10000)
    expect(a.positions).toHaveLength(1)
    expect(a.positions[0].ticker).toBe('AAPL')
    expect(a.positions[0].allocationPct).toBe(100)
    expect(a.positions[0].plannedAmount).toBe(10000)
    expect(a.positions[0].startPrice).toBe(150)
  })

  it('closes when the scrim is clicked (desktop)', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<AnalysisModal isOpen onClose={onClose} />)
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })
})
