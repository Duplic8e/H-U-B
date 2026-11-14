import React, { useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PAReport } from '../../../utils/investments/ibkrPortfolioAnalyst'
import { chartTooltipStyles } from '../../../utils/chartTheme'
import { formatReportMonth } from './reportMetrics'
import { availableRanges, benchmarkView, BENCHMARK_RANGES, type BenchmarkRange } from './benchmarkRange'
import { Section } from './Section'
import { pct } from './format'
import { ChartFigure } from '../../ui/ChartFigure'
import { ChartLegend } from '../../ui/ChartLegend'

const chartColors = ['var(--accent)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)']

export const ReportPerformance: React.FC<{ report: PAReport }> = ({ report }) => {
  const ranges = availableRanges(report.cumulativeSeries, report.benchmarkSeries)
  // The report period is the honest default: it is the span every other figure
  // in this report covers. The chart used to draw the historical series with no
  // control and no label, so a report covering eight months opened in 2021.
  const [range, setRange] = useState<BenchmarkRange>(ranges[0] ?? 'period')
  const active = ranges.includes(range) ? range : (ranges[0] ?? 'period')

  const { names, data, daily } = benchmarkView(active, report.cumulativeSeries, report.benchmarkSeries)
  if (data.length <= 1) return null

  const formatX = (v: string) => (daily ? v : formatReportMonth(v))
  const first = formatX(String(data[0].month))
  const last = formatX(String(data[data.length - 1].month))
  const span = `${first} to ${last}`
  const options = BENCHMARK_RANGES.filter((r) => ranges.includes(r.id))

  return (
    <Section title="Benchmark Comparison (growth of 100)" defaultOpen>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        {/* The span is stated rather than implied. Not labelling it is what
            made the old behaviour surprising rather than merely different. */}
        <p className="text-meta text-text-secondary">{span}</p>
        {options.length > 1 && (
          <div className="flex gap-1" role="group" aria-label="Benchmark comparison range">
            {options.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                aria-pressed={active === r.id}
                className={`px-2 py-1 rounded-md text-meta border transition-colors ${
                  active === r.id
                    ? 'border-accent text-accent bg-accent/10'
                    : 'control-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ChartFigure
        label={`Growth of 100, ${span}, compared across ${names.join(', ')}`}
        className="h-[260px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} accessibilityLayer={false}>
            <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={11} tickFormatter={formatX} minTickGap={20} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} domain={['auto', 'auto']} />
            <Tooltip {...chartTooltipStyles} labelFormatter={(label) => formatX(String(label))} />
            {names.map((n, i) => (
              <Line key={n} type="monotone" dataKey={n} stroke={chartColors[i % chartColors.length]} strokeWidth={n === 'Account' ? 2 : 1.5} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      <ChartLegend items={names.map((n, i) => ({ name: n, color: chartColors[i % chartColors.length] }))} />
      {report.benchmarkSummary.length > 0 && (
        <div className="mt-3">
          {/* These are the broker's own fixed windows and do not follow the
              range control above, so say so rather than let them look stale. */}
          <p className="text-meta text-text-secondary mb-1">Broker's own periods, independent of the range above</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[560px]">
              <thead><tr className="text-left text-text-secondary border-b border-border">
                {['', 'MTD', 'QTD', 'YTD', '1Y', '3Y', '5Y', 'Incept.'].map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {report.benchmarkSummary.map((r) => (
                  <tr key={r.name} className="border-b border-border/50">
                    <td className="py-1 pr-3 text-text-primary">{r.name === report.accountId ? 'Your account' : r.name}</td>
                    {[r.mtd, r.qtd, r.ytd, r.oneYear, r.threeYear, r.fiveYear, r.inception].map((v, i) => (
                      <td key={i} className={`py-1 pr-3 ${v >= 0 ? 'text-accent' : 'text-error'}`}>{pct(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  )
}
