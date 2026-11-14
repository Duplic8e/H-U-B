import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { JournalMobile } from './JournalMobile'
import { useAnalysisStore, type InvestmentAnalysis } from '../../store/useAnalysisStore'
import { installMatchMedia, resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

vi.mock('../../services/marketData', () => ({
  useCurrentPrice: () => ({ data: undefined, status: 'idle', refresh: () => {}, setManual: () => {}, clearManual: () => {} }),
  useHistoricalPrice: () => ({ data: undefined, status: 'idle', refresh: () => {} }),
  quoteKey: (t: string) => t,
}))

const analysis: InvestmentAnalysis = {
  id: 'a1', name: 'Banks Rotation', thesis: 'Rates peaked.', analysisDate: '2026-03-10', plannedBudget: 10000, swaps: [],
  positions: [
    { id: 'p1', ticker: 'RY', plannedAmount: 6000, allocationPct: 60, startPrice: 100, startPriceSource: 'auto', acted: true,
      lots: [{ id: 'l1', date: '2026-03-12', amountInvested: 5000, price: 100 }] },
    { id: 'p2', ticker: 'TD', plannedAmount: 4000, allocationPct: 40, startPrice: 80, startPriceSource: 'auto', acted: false, lots: [] },
  ],
}
const initial = useAnalysisStore.getState()
const renderIt = () => render(<MemoryRouter><JournalMobile analyses={useAnalysisStore.getState().analyses} planned={10000} invested={5000} current={5000} /></MemoryRouter>)

describe('JournalMobile', () => {
  beforeEach(() => {
    installMatchMedia()
    setMatchMedia(false)
    useAnalysisStore.setState({ analyses: [analysis] })
  })
  afterEach(() => {
    setMatchMedia(true)
    resetMatchMedia()
    useAnalysisStore.setState(initial, true)
  })

  it('lists each analysis as one row under the totals', () => {
    renderIt()
    expect(screen.getByText('Current Value')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Banks Rotation' })).toHaveTextContent('Plan $10,000')
  })

  it('opens an analysis in a sheet with Plan and Actual and its positions', () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Open Banks Rotation' }))
    const toggle = screen.getByRole('group', { name: 'Plan or actual' })
    expect(within(toggle).getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Details for RY' })).toBeInTheDocument()
    fireEvent.click(within(toggle).getByRole('button', { name: 'Actual' }))
    expect(screen.getByRole('button', { name: 'Details for TD' })).toHaveTextContent('No trades yet')
  })

  it('edits a position allocation from its expanded row', () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Open Banks Rotation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Details for RY' }))
    fireEvent.change(screen.getByLabelText('Allocation % for RY'), { target: { value: '50' } })
    expect(useAnalysisStore.getState().analyses[0].positions[0]).toMatchObject({ allocationPct: 50, plannedAmount: 5000 })
  })

  it('needs two taps to delete an analysis', () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Open Banks Rotation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete analysis' }))
    expect(useAnalysisStore.getState().analyses).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(useAnalysisStore.getState().analyses).toHaveLength(0)
  })

  it('deletes a position only after a second tap', () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Open Banks Rotation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Details for TD' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete position' }))
    expect(useAnalysisStore.getState().analyses[0].positions).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Delete TD' }))
    expect(useAnalysisStore.getState().analyses[0].positions).toHaveLength(1)
  })
})
