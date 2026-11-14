import React, { useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PAReport } from '../../../utils/investments/ibkrPortfolioAnalyst'
import { formatMoney } from '../../planner/format'
import { chartTooltipStyles } from '../../../utils/chartTheme'
import { contributors } from './reportMetrics'
import { Section } from './Section'
import { pct } from './format'
import { ChartFigure } from '../../ui/ChartFigure'

export const ReportContributors: React.FC<{ report: PAReport }> = ({ report }) => {
  const [showAll, setShowAll] = useState(false)
  const rows = report.performanceBySymbol
  if (rows.length === 0) return null

  const { top, bottom } = contributors(rows)
  // Best at the top, worst at the bottom, so the bar chart reads as a ranking.
  const chartData = [...top, ...bottom].map((s) => ({ symbol: s.symbol, contribution: s.contribution }))

  return (
    <Section title="Contributors & Detractors" defaultOpen>
      <ChartFigure
        label={`Contributors and detractors by return: ${chartData.map((d) => `${d.symbol} ${pct(d.contribution)}`).join(', ')}`}
        className="h-[280px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 12 }} accessibilityLayer={false}>
            <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} tickFormatter={(v: number) => `${v}%`} />
            <YAxis type="category" dataKey="symbol" stroke="var(--text-secondary)" fontSize={11} width={64} />
            <Tooltip {...chartTooltipStyles} formatter={(v) => pct(Number(v))} />
            <Bar dataKey="contribution" isAnimationActive={false}>
              {chartData.map((d) => (
                <Cell key={d.symbol} fill={d.contribution >= 0 ? 'var(--accent)' : 'var(--error)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>

      <div className="flex flex-col gap-1 text-[12px] mt-2">
        {chartData.map((d) => (
          <div key={d.symbol} className="flex justify-between items-center gap-2">
            <span className="text-text-primary">{d.symbol}</span>
            <span className={d.contribution >= 0 ? 'text-accent' : 'text-error'}>{pct(d.contribution)}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowAll(!showAll)}
        className="mt-3 text-[12px] text-text-secondary hover:text-accent transition-colors"
      >
        {showAll ? 'Hide full table' : `Show all ${rows.length} symbols`}
      </button>

      {showAll && (
        <div
          role="group"
          aria-label="Top contributors"
          tabIndex={0}
          className="overflow-x-auto max-h-[280px] desktop:max-h-[400px] overflow-y-auto mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          <table className="w-full text-[12px] min-w-[720px]">
            <thead><tr className="text-left text-text-secondary border-b border-border sticky top-0 bg-[var(--card-bg)]">
              {['Symbol', 'Sector', 'Avg Weight', 'Return', 'Contribution', 'Unrealized P/L', 'Realized P/L', 'Open'].map((h) => (
                <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[...rows].sort((a, b) => b.contribution - a.contribution).map((s) => (
                <tr key={`${s.symbol}-${s.instrument}`} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 text-text-primary" title={s.description}>{s.symbol}</td>
                  <td className="py-1.5 pr-3 text-text-secondary">{s.sector}</td>
                  <td className="py-1.5 pr-3">{s.avgWeight.toFixed(2)}%</td>
                  <td className={`py-1.5 pr-3 ${s.totalReturn >= 0 ? 'text-accent' : 'text-error'}`}>{pct(s.totalReturn)}</td>
                  <td className={`py-1.5 pr-3 ${s.contribution >= 0 ? 'text-accent' : 'text-error'}`}>{pct(s.contribution)}</td>
                  <td className={`py-1.5 pr-3 ${s.unrealizedPl >= 0 ? 'text-accent' : 'text-error'}`}>{formatMoney(s.unrealizedPl)}</td>
                  <td className={`py-1.5 pr-3 ${s.realizedPl >= 0 ? 'text-accent' : 'text-error'}`}>{formatMoney(s.realizedPl)}</td>
                  <td className="py-1.5 pr-3 text-text-secondary">{s.open ? 'Yes' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
