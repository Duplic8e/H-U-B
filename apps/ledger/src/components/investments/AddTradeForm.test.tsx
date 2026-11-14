import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AddTradeForm } from './AddTradeForm'
import { useAnalysisStore, type InvestmentAnalysis } from '../../store/useAnalysisStore'

const analysis: InvestmentAnalysis = {
  id: 'a1', name: 'Test', analysisDate: '2026-01-01', plannedBudget: 10000,
  positions: [
    { id: 'p1', ticker: 'AAPL', plannedAmount: 5000, allocationPct: 50, startPrice: 100, startPriceSource: 'manual', acted: false, lots: [] },
    { id: 'p2', ticker: 'MSFT', plannedAmount: 5000, allocationPct: 50, startPrice: 200, startPriceSource: 'manual', acted: false, lots: [] },
  ],
  swaps: [],
}

describe('AddTradeForm', () => {
  it('adds a lot (shares x price) to the chosen position', () => {
    useAnalysisStore.setState({ analyses: [analysis] })
    render(<AddTradeForm analysis={analysis} open onOpenChange={() => {}} />)
    fireEvent.change(screen.getByLabelText('Shares'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '110' } })
    fireEvent.click(screen.getByRole('button', { name: /^save trade$/i }))
    const saved = useAnalysisStore.getState().analyses[0].positions[0]
    expect(saved.lots).toHaveLength(1)
    expect(saved.lots[0].amountInvested).toBe(1100)
    expect(saved.lots[0].price).toBe(110)
  })
})
