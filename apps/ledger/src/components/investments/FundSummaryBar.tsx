import React from 'react'
import { Stat } from '../ui/Stat'
import { NumberInput } from '../ui/NumberInput'
import { formatMoney } from '../planner/format'
import type { FundSummary } from '../../utils/investments/planMetrics'

interface FundSummaryBarProps {
  summary: FundSummary
  startDate: string
  side: 'plan' | 'actual'
  onPlannedBudgetChange?: (budget: number) => void
}

/** Full-width summary strip. Plan: 4 evenly-spread cells (budget editable
 *  in place). Actual: 5 cells with trade-derived initial/extra split. */
export const FundSummaryBar: React.FC<FundSummaryBarProps> = ({ summary, startDate, side, onPlannedBudgetChange }) => {
  const returnTone = summary.totalReturnDollars < 0 ? 'error' : 'accent'
  const pctSub = summary.totalReturnPct === null ? undefined : `${summary.totalReturnPct.toFixed(2)}%`

  return (
    <div className={`grid grid-cols-2 gap-4 themed-card rounded-lg p-4 ${side === 'plan' ? 'md:grid-cols-4' : 'md:grid-cols-5'}`}>
      <Stat label="Start Date" value={startDate} />
      {side === 'plan' ? (
        onPlannedBudgetChange ? (
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] uppercase tracking-wide text-text-secondary">Planned Budget</p>
            <NumberInput
              aria-label="Planned Budget ($)"
              min={0}
              value={summary.totalInvested}
              onCommit={onPlannedBudgetChange}
              className="text-[22px] font-semibold text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none w-full max-w-[10ch]"
            />
          </div>
        ) : (
          <Stat label="Planned Budget" value={formatMoney(summary.totalInvested)} />
        )
      ) : (
        <>
          <Stat label="Initial Investment" value={formatMoney(summary.initialInvested)} />
          <Stat label="Extra Investment" value={formatMoney(summary.extraInvested)} />
        </>
      )}
      <Stat label="Current Value" value={formatMoney(summary.currentValue)} tone="accent" />
      <Stat
        label="Total Return"
        value={summary.totalReturnPct === null ? 'n/a' : formatMoney(summary.totalReturnDollars)}
        sub={pctSub}
        tone={returnTone}
      />
    </div>
  )
}
