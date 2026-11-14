import React from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { PAAllocationRow, PAReport } from '../../../utils/investments/ibkrPortfolioAnalyst'
import { formatMoney } from '../../planner/format'
import { chartTooltipStyles, sliceColor } from '../../../utils/chartTheme'
import { Section } from './Section'
import { ChartFigure } from '../../ui/ChartFigure'
import { ChartLegend } from '../../ui/ChartLegend'

const Donut: React.FC<{ title: string; rows: PAAllocationRow[] }> = ({ title, rows: rawRows }) => {
  // The report lists allocation rows in whatever order the CSV had them. Sort
  // largest-first so these donuts read the same way as the Portfolio tab's,
  // which allocationBreakdown already orders by value.
  const rows = React.useMemo(
    () => [...rawRows].sort((a, b) => b.endingNav - a.endingNav),
    [rawRows],
  )
  if (rows.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] uppercase tracking-wide text-text-secondary">{title}</p>
      <ChartFigure
        label={`${title}: ${rows.length} slices, ${rows.map((r) => `${r.name} ${r.endingPct.toFixed(1)}%`).join(', ')}`}
        className="h-[160px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie data={rows} dataKey="endingNav" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} isAnimationActive={false} rootTabIndex={-1}>
              {rows.map((r, i) => <Cell key={r.name} fill={sliceColor(i)} />)}
            </Pie>
            <Tooltip {...chartTooltipStyles} formatter={(value) => formatMoney(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </ChartFigure>
      <ChartLegend items={rows.map((r, i) => ({
        name: r.name,
        color: sliceColor(i),
        value: `${r.endingPct.toFixed(1)}% · ${formatMoney(r.endingNav)}`,
      }))} />
    </div>
  )
}

export const ReportAllocations: React.FC<{ report: PAReport }> = ({ report }) => {
  const hasAny =
    report.assetClassAllocation.length > 0 ||
    report.sectorAllocation.length > 0 ||
    report.regionAllocation.length > 0
  if (!hasAny) return null

  return (
    <Section title="Allocations" defaultOpen>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Donut title="By Asset Class" rows={report.assetClassAllocation} />
        <Donut title="By Sector" rows={report.sectorAllocation} />
        <Donut title="By Region" rows={report.regionAllocation} />
      </div>
    </Section>
  )
}
