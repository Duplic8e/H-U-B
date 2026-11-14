import React from 'react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { categoryMonthlySeries } from '../../utils/budget/categoryStats'
import { formatMoney } from '../planner/format'
import { isSingleMonth, monthsInRange, type MonthRange } from '../../utils/budget/period'
import { ChartFigure } from '../ui/ChartFigure'

const rangeTotal = (series: { month: string; total: number }[], range: MonthRange) =>
  series.filter((p) => p.month >= range.from && p.month <= range.to).reduce((s, p) => s + p.total, 0)

export const CategoryTrendsWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const monthsBack = Math.max(6, monthsInRange(range))
  const refDate = new Date(`${range.to}-15T12:00:00`)

  const rows = Object.values(categories)
    .map((cat) => ({ cat, series: categoryMonthlySeries(transactions, cat.id, monthsBack, refDate) }))
    .filter(({ series }) => series.some((p) => p.total > 0))
    .sort((a, b) => b.series[b.series.length - 1].total - a.series[a.series.length - 1].total)
    .slice(0, 8)

  return (
    <WidgetWrapper title={`Category Trends (${monthsBack} Months)`}>
      {rows.length === 0 ? (
        <p className="text-[13px] text-text-secondary mt-2">No categorized spending yet.</p>
      ) : (
        <div className="flex flex-col gap-1 mt-2">
          {rows.map(({ cat, series }) => (
            <div key={cat.id} className="flex items-center gap-3 text-[13px]">
              <span className="w-28 truncate text-text-secondary">{cat.name}</span>
              {/* flex-1 alone resolves to `flex: 1 1 0%`: a zero flex-basis
                  that only grows into space left over after the label and
                  total columns take theirs. On a narrow card (768px tablet,
                  where the sidebar first appears) those two fixed columns
                  alone already exceed the row's available width, so there is
                  never anything left over and the sparkline silently renders
                  at 0 width forever, not merely small. An explicit min-width
                  floor forces the flexbox shrink pass to take the difference
                  from the label and total instead (both already truncate),
                  guaranteeing the chart a sliver of real width at any card
                  size. */}
              <ChartFigure
                label={`${cat.name} spending trend over ${series.length} months, from ${formatMoney(series[0]?.total ?? 0)} to ${formatMoney(series[series.length - 1]?.total ?? 0)}`}
                className="flex-1 min-w-[28px] h-8"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} accessibilityLayer={false}>
                    <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFigure>
              <span className="w-20 text-right text-text-primary">
                {formatMoney(isSingleMonth(range) ? series[series.length - 1].total : rangeTotal(series, range))}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  )
}
