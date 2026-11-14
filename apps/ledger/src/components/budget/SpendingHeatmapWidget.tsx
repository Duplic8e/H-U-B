import React from 'react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { formatMoney } from '../planner/format'
import { countsAsIncome } from '../../utils/budget/sharedExpenses'
import { isSingleMonth, monthKeysInRange, inRange, type MonthRange } from '../../utils/budget/period'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export const SpendingHeatmapWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)

  if (!isSingleMonth(range)) {
    const monthKeys = monthKeysInRange(range)
    const byMonth = new Map<string, number>()
    for (const t of Object.values(transactions)) {
      if (t.type !== 'expense' || !inRange(t.date, range)) continue
      const k = t.date.slice(0, 7)
      byMonth.set(k, (byMonth.get(k) ?? 0) + t.amount)
    }
    const max = Math.max(0, ...byMonth.values())
    return (
      <WidgetWrapper title="Spending by Month">
        <div className="grid grid-cols-4 gap-1 mt-2 text-meta">
          {monthKeys.map((k) => {
            const spend = byMonth.get(k) ?? 0
            const opacity = max > 0 ? 0.15 + 0.85 * (spend / max) : 0
            return (
              <div
                key={k}
                title={`${k}: ${formatMoney(spend)} spent`}
                className="rounded flex flex-col items-center justify-center border border-border text-text-primary py-3 gap-1"
                style={{ backgroundColor: spend > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)` : 'transparent' }}
              >
                <span>{k}</span>
                <span className="text-micro text-text-secondary">{formatMoney(spend)}</span>
              </div>
            )
          })}
        </div>
      </WidgetWrapper>
    )
  }

  const selectedMonth = range.from

  const byDay = new Map<number, number>()
  for (const t of Object.values(transactions)) {
    if (t.type !== 'expense' || !t.date.startsWith(selectedMonth)) continue
    const day = Number(t.date.slice(8, 10))
    byDay.set(day, (byDay.get(day) ?? 0) + t.amount)
  }
  const max = Math.max(0, ...byDay.values())

  const incomeByDay = new Map<number, number>()
  for (const t of Object.values(transactions)) {
    if (!countsAsIncome(t) || !t.date.startsWith(selectedMonth)) continue
    const day = Number(t.date.slice(8, 10))
    incomeByDay.set(day, (incomeByDay.get(day) ?? 0) + t.amount)
  }

  const [y, m] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Monday-first

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <WidgetWrapper title="Spending Calendar">
      <div className="grid grid-cols-7 gap-1 mt-2 text-meta">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-text-secondary">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />
          const spend = byDay.get(day) ?? 0
          const income = incomeByDay.get(day) ?? 0
          const opacity = max > 0 ? 0.15 + 0.85 * (spend / max) : 0
          return (
            <div
              key={day}
              title={`${selectedMonth}-${String(day).padStart(2, '0')}: ${formatMoney(spend)} spent${income > 0 ? ` · ${formatMoney(income)} income` : ''}`}
              className="relative aspect-square rounded flex items-center justify-center border border-border text-text-primary"
              style={{ backgroundColor: spend > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)` : 'transparent' }}
            >
              {day}
              {income > 0 && (
                <span
                  data-testid={`income-marker-${day}`}
                  className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-500"
                />
              )}
            </div>
          )
        })}
      </div>
      <div data-testid="heatmap-legend" className="flex items-center gap-1.5 mt-2 text-meta text-text-secondary">
        <span>$0</span>
        {[0.15, 0.36, 0.57, 0.78, 1].map((op) => (
          <span
            key={op}
            className="w-4 h-3 rounded-sm border border-border"
            style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(op * 100)}%, transparent)` }}
          />
        ))}
        <span>{max > 0 ? formatMoney(max) : 'max'}</span>
        <span className="ml-3 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        <span>income</span>
      </div>
    </WidgetWrapper>
  )
}
