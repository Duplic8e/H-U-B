import React from 'react'
import type { InvestmentAnalysis, Position } from '../../store/useAnalysisStore'
import { avgCostBasis, currentValue, plDollars, plPct, sharesFromLots, totalInvested } from '../../utils/investments/analysisMetrics'
import { formatMoney } from '../planner/format'

const th = 'px-3 py-2 text-right text-meta font-semibold uppercase tracking-wide text-text-secondary'
const td = 'px-3 py-2 text-right text-[13px] text-text-primary tabular-nums'

interface ActualRow {
  positionId: string
  ticker: string
  initialInvestment: number
  extra: number
  startPrice: number
  avgPrice: number | null
  shares: number
  currentPrice: number
  currentValue: number
  returnDollars: number
  returnPct: number | null
}

function actualRow(position: Position, currentPrice: number): ActualRow {
  const { lots } = position
  const initial = lots[0]?.amountInvested ?? 0
  const invested = totalInvested(lots)
  const extra = invested - initial
  return {
    positionId: position.id,
    ticker: position.ticker,
    initialInvestment: initial,
    extra,
    startPrice: position.startPrice,
    avgPrice: avgCostBasis(lots),
    shares: sharesFromLots(lots),
    currentPrice,
    currentValue: currentValue(lots, currentPrice),
    returnDollars: plDollars(lots, currentPrice),
    returnPct: plPct(lots, currentPrice),
  }
}

export const ActualTable: React.FC<{ analysis: InvestmentAnalysis; priceFor: (p: Position) => number }> = ({ analysis, priceFor }) => {
  const rows = analysis.positions.filter((p) => p.lots.length > 0).map((p) => actualRow(p, priceFor(p)))
  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead className="bg-bg-primary/50">
            <tr>
              <th className={`${th} text-left`}>Ticker</th>
              <th className={th}>Initial Investment</th>
              <th className={th}>Extra Investment</th>
              <th className={th}>Start Price</th>
              <th className={th}>Average Price</th>
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
                <td className={td}>{formatMoney(r.initialInvestment)}</td>
                <td className={td}>{formatMoney(r.extra)}</td>
                <td className={td}>{formatMoney(r.startPrice)}</td>
                <td className={td}>{r.avgPrice === null ? 'n/a' : formatMoney(r.avgPrice)}</td>
                <td className={td}>{r.shares.toFixed(2)}</td>
                <td className={td}>{formatMoney(r.currentPrice)}</td>
                <td className={td}>{formatMoney(r.currentValue)}</td>
                <td className={`${td} ${r.returnDollars < 0 ? 'text-error' : 'text-accent'}`}>{formatMoney(r.returnDollars)}</td>
                <td className={`${td} ${(r.returnPct ?? 0) < 0 ? 'text-error' : 'text-accent'}`}>{r.returnPct === null ? 'n/a' : `${r.returnPct.toFixed(2)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div data-testid="actual-cards" className="md:hidden flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.positionId} className="themed-card rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-text-primary">{r.ticker}</span>
              <span className={`text-[14px] font-semibold tabular-nums ${r.returnDollars < 0 ? 'text-error' : 'text-accent'}`}>
                {formatMoney(r.returnDollars)} ({r.returnPct === null ? 'n/a' : `${r.returnPct.toFixed(2)}%`})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <span className="text-text-secondary">Initial</span><span className="text-right tabular-nums">{formatMoney(r.initialInvestment)}</span>
              <span className="text-text-secondary">Extra</span><span className="text-right tabular-nums">{formatMoney(r.extra)}</span>
              <span className="text-text-secondary">Start / Avg</span><span className="text-right tabular-nums">{formatMoney(r.startPrice)} / {r.avgPrice === null ? 'n/a' : formatMoney(r.avgPrice)}</span>
              <span className="text-text-secondary">Shares</span><span className="text-right tabular-nums">{r.shares.toFixed(2)}</span>
              <span className="text-text-secondary">Current / Value</span><span className="text-right tabular-nums">{formatMoney(r.currentPrice)} / {formatMoney(r.currentValue)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
