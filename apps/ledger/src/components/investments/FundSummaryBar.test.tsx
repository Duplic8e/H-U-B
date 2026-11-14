import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { FundSummaryBar } from './FundSummaryBar'
import type { FundSummary } from '../../utils/investments/planMetrics'

const summary: FundSummary = {
  initialInvested: 10000,
  extraInvested: 2000,
  totalInvested: 12000,
  currentValue: 11500,
  totalReturnDollars: -500,
  totalReturnPct: -4.17,
}

describe('FundSummaryBar', () => {
  it('actual side shows Initial Investment, Extra Investment and Total Return in dollars', () => {
    render(<FundSummaryBar side="actual" summary={summary} startDate="2026-07-01" />)
    expect(screen.getByText('Initial Investment')).toBeInTheDocument()
    expect(screen.getByText('Extra Investment')).toBeInTheDocument()
    expect(screen.getByText('-$500')).toBeInTheDocument()
    expect(screen.getByText('-4.17%')).toBeInTheDocument()
  })

  it('plan side budget is editable when onPlannedBudgetChange is provided', () => {
    const onChange = vi.fn()
    render(
      <FundSummaryBar
        side="plan"
        onPlannedBudgetChange={onChange}
        summary={{ ...summary, initialInvested: 10000, extraInvested: 0, totalInvested: 10000 }}
        startDate="2026-07-01"
      />,
    )
    const input = screen.getByLabelText('Planned Budget ($)')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '15000' } })
    expect(onChange).toHaveBeenLastCalledWith(15000)
  })

  it('totalReturnPct === null renders "n/a" as the Total Return value', () => {
    render(
      <FundSummaryBar
        side="plan"
        summary={{ totalInvested: 0, totalReturnPct: null, totalReturnDollars: 0, initialInvested: 0, extraInvested: 0, currentValue: 0 }}
        startDate="2026-07-01"
      />,
    )
    expect(screen.getByText('n/a')).toBeInTheDocument()
  })

  it('plan side without onPlannedBudgetChange renders static Planned Budget cell', () => {
    render(
      <FundSummaryBar
        side="plan"
        summary={summary}
        startDate="2026-07-01"
      />,
    )
    expect(screen.queryByLabelText('Planned Budget ($)')).not.toBeInTheDocument()
    expect(screen.getByText('Planned Budget')).toBeInTheDocument()
  })
})
