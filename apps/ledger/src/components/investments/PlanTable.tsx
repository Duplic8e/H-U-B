import React from 'react'
import type { InvestmentAnalysis, Position } from '../../store/useAnalysisStore'
import { planRow } from '../../utils/investments/planMetrics'
import { formatMoney } from '../planner/format'
import { NumberInput } from '../ui/NumberInput'

const th = 'px-3 py-2 text-right text-meta font-semibold uppercase tracking-wide text-text-secondary'
const td = 'px-3 py-2 text-right text-[13px] text-text-primary tabular-nums'

interface PlanTableProps {
  analysis: InvestmentAnalysis
  priceFor: (p: Position) => number
  onAllocationChange: (positionId: string, pct: number) => void
}

export const PlanTable: React.FC<PlanTableProps> = ({ analysis, priceFor, onAllocationChange }) => {
  const budget = analysis.plannedBudget ?? 0
  const rows = analysis.positions.map((p) => planRow(p, budget, priceFor(p)))
  const totalAllocation = rows.reduce((s, r) => s + r.allocationPct, 0)
  return (
    <div>
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead className="bg-bg-primary/50">
            <tr>
              <th className={`${th} text-left`}>Ticker</th>
              <th className={th}>Allocation %</th>
              <th className={th}>Planned $</th>
              <th className={th}>Start Price</th>
              <th className={th}>Shares</th>
              <th className={th}>Current Price</th>
              <th className={th}>Current Value</th>
              <th className={th}>Return $</th>
              <th className={th}>Return %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.positionId} className="border-t border-border/60">
                <td className={`${td} text-left font-medium`}>{r.ticker}</td>
                <td className={td}>
                  <NumberInput
                    min={0}
                    max={100}
                    aria-label={`Allocation % for ${r.ticker}`}
                    className="w-20 bg-bg-primary/50 border border-border rounded px-2 py-1 text-right text-[13px] text-text-primary outline-none focus:border-accent"
                    value={r.allocationPct}
                    onCommit={(n) => onAllocationChange(r.positionId, n)}
                  />
                </td>
                <td className={td}>{formatMoney(r.plannedDollars)}</td>
                <td className={td}>{formatMoney(r.startPrice)}</td>
                <td className={td}>{r.shares.toFixed(2)}</td>
                <td className={td}>{formatMoney(r.currentPrice)}</td>
                <td className={td}>{formatMoney(r.currentValue)}</td>
                <td className={`${td} ${r.returnDollars < 0 ? 'text-error' : 'text-accent'}`}>{formatMoney(r.returnDollars)}</td>
                <td className={`${td} ${(r.returnPct ?? 0) < 0 ? 'text-error' : 'text-accent'}`}>{r.returnPct === null ? 'n/a' : `${r.returnPct.toFixed(2)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {Math.round(totalAllocation * 100) !== 10000 && analysis.positions.length > 0 && (
          <p className="px-3 py-2 text-[12px] text-error">Allocations sum to {totalAllocation.toFixed(1)}% (should be 100%).</p>
        )}
      </div>
      <div data-testid="plan-cards" className="md:hidden flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.positionId} className="themed-card rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-text-primary">{r.ticker}</span>
              <span className={`text-[14px] font-semibold tabular-nums ${r.returnDollars < 0 ? 'text-error' : 'text-accent'}`}>
                {formatMoney(r.returnDollars)} ({r.returnPct === null ? 'n/a' : `${r.returnPct.toFixed(2)}%`})
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-text-secondary">Allocation %</span>
              <NumberInput
                min={0}
                max={100}
                aria-label={`Allocation % for ${r.ticker}`}
                className="w-20 bg-bg-primary/50 border border-border rounded px-2 py-1 text-right text-[13px] text-text-primary outline-none focus:border-accent"
                value={r.allocationPct}
                onCommit={(n) => onAllocationChange(r.positionId, n)}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <span className="text-text-secondary">Planned</span><span className="text-right tabular-nums">{formatMoney(r.plannedDollars)}</span>
              <span className="text-text-secondary">Start Price</span><span className="text-right tabular-nums">{formatMoney(r.startPrice)}</span>
              <span className="text-text-secondary">Shares</span><span className="text-right tabular-nums">{r.shares.toFixed(2)}</span>
              <span className="text-text-secondary">Current / Value</span><span className="text-right tabular-nums">{formatMoney(r.currentPrice)} / {formatMoney(r.currentValue)}</span>
            </div>
          </div>
        ))}
        {Math.round(totalAllocation * 100) !== 10000 && analysis.positions.length > 0 && (
          <p className="px-1 text-[12px] text-error">Allocations sum to {totalAllocation.toFixed(1)}% (should be 100%).</p>
        )}
      </div>
    </div>
  )
}
