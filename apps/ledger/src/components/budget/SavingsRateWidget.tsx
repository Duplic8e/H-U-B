import React, { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { incomeExpenseSeries, savingsRate } from '../../store/budgetSelectors'
import { formatMoney } from '../planner/format'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { monthsInRange, type MonthRange } from '../../utils/budget/period'
import { ChartFigure } from '../ui/ChartFigure'
import { ChartLegend } from '../ui/ChartLegend'

type View = 'rate' | 'trend' | 'split'
const VIEWS: { id: View; label: string }[] = [
  { id: 'rate', label: 'Rate' },
  { id: 'trend', label: 'Trend' },
  { id: 'split', label: 'Split' },
]

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' })

// Semicircular gauge. A null rate (no income in the window) reads neutral, not
// red; a negative rate (spent more than earned) shows in the error color with
// no filled arc.
const Gauge: React.FC<{ rate: number | null; income: number; expense: number }> = ({ rate, income, expense }) => {
  const R = 80
  const LEN = Math.PI * R
  const negative = rate !== null && rate < 0
  const filled = rate === null ? 0 : Math.max(0, Math.min(1, rate)) * LEN
  const textColor = rate === null ? 'var(--text-secondary)' : negative ? 'var(--error)' : 'var(--accent)'
  return (
    <div className="flex justify-center py-3">
      <svg
        viewBox="0 0 200 116"
        width="230"
        height="134"
        role="img"
        aria-label={rate === null ? 'Savings rate not available' : `Savings rate ${Math.round(rate * 100)} percent`}
      >
        <title>Saved {formatMoney(income - expense)} of {formatMoney(income)} income · {formatMoney(expense)} spent</title>
        <path d="M20,98 A80,80 0 0 1 180,98" fill="none" stroke="var(--border-color)" strokeWidth={14} strokeLinecap="round" />
        {rate !== null && !negative && filled > 0 && (
          <path
            d="M20,98 A80,80 0 0 1 180,98"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${LEN}`}
          />
        )}
        <text x="100" y="86" textAnchor="middle" fontSize="30" fontWeight="600" fill={textColor}>
          {rate === null ? '-' : `${Math.round(rate * 100)}%`}
        </text>
        <text x="100" y="106" textAnchor="middle" fontSize="11" fill="var(--text-secondary)">of income saved</text>
      </svg>
    </div>
  )
}

export const SavingsRateWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const [view, setView] = useState<View>('rate')

  const refDate = new Date(`${range.to}-15T12:00:00`)
  const series = incomeExpenseSeries(transactions, monthsInRange(range), refDate)
  const rate = savingsRate(series)
  const income = series.reduce((s, m) => s + m.income, 0)
  const expense = series.reduce((s, m) => s + m.expense, 0)
  const hasData = series.some((m) => m.income > 0 || m.expense > 0)

  const data = series.map((m) => ({
    label: monthLabel(m.month),
    net: m.income - m.expense,
    saved: Math.max(0, m.income - m.expense),
    expense: m.expense,
  }))

  const toggle = (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          aria-pressed={view === v.id}
          onClick={() => setView(v.id)}
          className={`px-2.5 py-1 text-[12px] transition-colors ${
            view === v.id ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )

  return (
    <WidgetWrapper title="Savings Rate" action={hasData ? toggle : undefined}>
      {!hasData ? (
        <p className="text-[13px] text-text-secondary mt-2">No income or expenses in this window yet.</p>
      ) : view === 'rate' ? (
        <Gauge rate={rate} income={income} expense={expense} />
      ) : view === 'trend' ? (
        <>
          <ChartFigure
            label={`Net saved per month over ${data.length} months, from ${formatMoney(data[0]?.net ?? 0)} to ${formatMoney(data[data.length - 1]?.net ?? 0)}`}
            className="h-[220px] mt-2"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) => formatMoney(Number(v))}
                />
                <Tooltip formatter={(value) => [formatMoney(Number(value)), 'Net Saved']} {...chartTooltipStyles} />
                <Area type="monotone" dataKey="net" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFigure>
          <ChartLegend centered items={[{ name: 'Net Saved', color: 'var(--accent)' }]} />
        </>
      ) : (
        <>
          <ChartFigure
            label={`Saved versus spent per month over ${data.length} months: ${formatMoney(income)} income, ${formatMoney(expense)} spent`}
            className="h-[220px] mt-2"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) => formatMoney(Number(v))}
                />
                <Tooltip formatter={(value, name) => [formatMoney(Number(value)), name === 'saved' ? 'Saved' : 'Spent']} {...chartTooltipStyles} />
                <Bar dataKey="expense" name="spent" stackId="a" fill="var(--error)" isAnimationActive={false} />
                <Bar dataKey="saved" name="saved" stackId="a" fill="var(--accent)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFigure>
          <ChartLegend centered items={[
            { name: 'Saved', color: 'var(--accent)' },
            { name: 'Spent', color: 'var(--error)' },
          ]} />
        </>
      )}
    </WidgetWrapper>
  )
}
