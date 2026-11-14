import React, { useState } from 'react'
import { BarChart3, Gauge, TrendingUp } from 'lucide-react'
import { useBudgetStore } from '../../store/useBudgetStore'
import { incomeExpenseSeries, savingsRate } from '../../store/budgetSelectors'
import { formatMoney } from '../planner/format'
import { monthsInRange, type MonthRange } from '../../utils/budget/period'
import { ChartLegend } from '../ui/ChartLegend'

type View = 'rate' | 'trend' | 'split'
const VIEWS: { id: View; label: string; Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }[] = [
  { id: 'rate', label: 'Rate', Icon: Gauge },
  { id: 'trend', label: 'Trend', Icon: TrendingUp },
  { id: 'split', label: 'Split', Icon: BarChart3 },
]

/** Months the Trend and Split views show, ending with the last month of the period. */
const HISTORY_MONTHS = 6

const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' })
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const pct = (r: number | null) => (r === null ? '-' : `${Math.round(r * 100)}%`)
const rateTone = (r: number | null) => (r === null ? 'text-text-secondary' : r < 0 ? 'text-error' : 'text-success')

const GAUGE_RADIUS = 80
const GAUGE_LENGTH = Math.PI * GAUGE_RADIUS

const Stat: React.FC<{ label: string; value: string; cls?: string }> = ({ label, value, cls = 'text-text-primary' }) => (
  <div className="min-w-0 text-center">
    <div className="text-[12px] text-text-secondary">{label}</div>
    <div className={`text-[16px] font-semibold tabular-nums ${cls}`}>{value}</div>
  </div>
)

/** Phone Savings Rate: a Rate, Trend and Split switch beside the title. Rate is the gauge with Income, Spent and
 *  Saved under it; Trend is the rate for each of the last six months; Split is saved against spent for each of them. */
export const SavingsRateMobile: React.FC<{ range: MonthRange }> = ({ range }) => {
  const transactions = useBudgetStore((s) => s.transactions)
  const [view, setView] = useState<View>('rate')

  const refDate = new Date(`${range.to}-15T12:00:00`)
  const series = incomeExpenseSeries(transactions, monthsInRange(range), refDate)
  const rate = savingsRate(series)
  const income = series.reduce((s, m) => s + m.income, 0)
  const expense = series.reduce((s, m) => s + m.expense, 0)
  const hasData = series.some((m) => m.income > 0 || m.expense > 0)

  const months = incomeExpenseSeries(transactions, HISTORY_MONTHS, refDate).map((m) => ({
    key: m.month,
    label: monthLabel(m.month),
    income: m.income,
    expense: m.expense,
    rate: m.income > 0 ? (m.income - m.expense) / m.income : null,
  }))
  const topRate = Math.max(0.5, ...months.map((m) => Math.abs(m.rate ?? 0)))
  const topFlow = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)))
  const filled = rate === null || rate < 0 ? 0 : clamp(rate) * GAUGE_LENGTH

  return (
    <section aria-label="Savings Rate" className="themed-card rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[18px] font-semibold text-text-primary">Savings Rate</h2>
        {hasData && (
          <div role="group" aria-label="Savings view" className="flex rounded-xl border border-border bg-bg-secondary p-1">
            {VIEWS.map(({ id, label }) => (
              <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}
                className={`min-h-11 rounded-lg px-3 text-[14px] font-medium ${view === id ? 'bg-accent/15 text-accent' : 'text-text-secondary'}`}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {!hasData ? (
        <p className="mt-2 text-[14px] text-text-secondary">No income or expenses in this window yet.</p>
      ) : view === 'rate' ? (
        <>
          <div className="flex justify-center pt-3">
            <svg viewBox="0 0 200 112" className="w-[280px]" role="img" aria-label={rate === null ? 'Savings rate not available' : `Savings rate ${Math.round(rate * 100)} percent`}>
              <title>Saved {formatMoney(income - expense)} of {formatMoney(income)} income, {formatMoney(expense)} spent</title>
              <path d="M20,98 A80,80 0 0 1 180,98" fill="none" stroke="var(--border-color)" strokeWidth={14} strokeLinecap="round" />
              {filled > 0 && (
                <path d="M20,98 A80,80 0 0 1 180,98" fill="none" stroke="var(--success)" strokeWidth={14} strokeLinecap="round" strokeDasharray={`${filled} ${GAUGE_LENGTH}`} />
              )}
              <text x="100" y="84" textAnchor="middle" fontSize="32" fontWeight="700" fill={rate !== null && rate < 0 ? 'var(--error)' : 'var(--text-primary)'}>{pct(rate)}</text>
              <text x="100" y="104" textAnchor="middle" fontSize="12" fill="var(--text-secondary)">of Income Saved</text>
            </svg>
          </div>
          <div className="mt-2 grid grid-cols-3 divide-x divide-border border-t border-border pt-3">
            <Stat label="Income" value={formatMoney(income)} cls="text-accent" />
            <Stat label="Spent" value={formatMoney(expense)} />
            <Stat label="Saved" value={formatMoney(income - expense)} cls={rateTone(rate)} />
          </div>
        </>
      ) : view === 'trend' ? (
        <>
          <div className="mt-3 flex items-end gap-2" style={{ height: 130 }} role="img" aria-label={`Savings rate for each of the last ${months.length} months`}>
            {months.map((m, i) => {
              const last = i === months.length - 1
              return (
                <div key={m.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className={`text-meta tabular-nums ${last ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{pct(m.rate)}</span>
                  <div className={`w-full rounded-t-md ${m.rate !== null && m.rate < 0 ? 'bg-error' : last ? 'bg-success' : 'bg-success/40'}`}
                    style={{ height: `${Math.max(3, clamp(Math.abs(m.rate ?? 0) / topRate) * 80)}px` }} />
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-2">
            {months.map((m) => <span key={m.key} className="min-w-0 flex-1 text-center text-meta text-text-secondary">{m.label}</span>)}
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2.5">
          {months.map((m) => (
            <div key={m.key}>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-secondary">{m.label}</span>
                <span className="tabular-nums text-text-secondary">{formatMoney(m.expense)} of {formatMoney(m.income)}</span>
              </div>
              <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-bg-tertiary">
                <div className="bg-error" style={{ width: `${(m.expense / topFlow) * 100}%` }} />
                <div className="bg-success" style={{ width: `${(Math.max(0, m.income - m.expense) / topFlow) * 100}%` }} />
              </div>
            </div>
          ))}
          <ChartLegend centered items={[{ name: 'Saved', color: 'var(--success)' }, { name: 'Spent', color: 'var(--error)' }]} />
        </div>
      )}
    </section>
  )
}
