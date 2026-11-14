import React, { useId, useState } from 'react'
import { formatMoney } from '../planner/format'
import { foldSmallest } from '../../utils/budget/foldSmallest'
import { useShowMore } from '../../hooks/useShowMore'
import type { MonthRange } from '../../utils/budget/period'
import { useBudgetOverview, type BudgetOverview, type CategoryRow } from './useBudgetOverview'
import { isOverRow, type RowPace } from '../../utils/budget/pace'
import { OwedToMeWidget } from './OwedToMeWidget'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5, var(--error))']

const sign = (n: number) => `${n >= 0 ? '+' : '-'}${formatMoney(Math.abs(n))}`
const tone = (n: number) => (n >= 0 ? 'text-accent' : 'text-error')
const share = (n: number, of: number) => (of > 0 ? Math.max(0, Math.min(1, n / of)) : 0)
const PACE_TEXT: Record<RowPace, string> = { over: 'Over Pace', under: 'Under Pace', on: 'On Pace', due: 'Due', paid: 'Paid', overBudget: 'Over Budget' }

const Card: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <section aria-label={label} className="themed-card rounded-2xl p-4">{children}</section>
)
const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => <h2 className="text-[18px] font-semibold text-text-primary">{children}</h2>

const Bar: React.FC<{ frac: number; bad?: boolean; h?: string }> = ({ frac, bad, h = 'h-1.5' }) => (
  <div className={`${h} rounded-full bg-bg-tertiary overflow-hidden`}>
    <div className={`h-full rounded-full ${bad ? 'bg-error' : 'bg-accent'}`} style={{ width: `${frac * 100}%` }} />
  </div>
)

/** A ring split by slice, with a label and a figure in the middle. */
const Donut: React.FC<{ items: [string, number][]; total: number; top: string; main: string; mainClass: string }> = ({ items, total, top, main, mainClass }) => {
  const size = 132, stroke = 16
  const r = (size - stroke) / 2, len = 2 * Math.PI * r, c = size / 2
  const fracs = items.map(([, value]) => share(value, total))
  const starts = fracs.map((_, i) => fracs.slice(0, i).reduce((sum, f) => sum + f, 0))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth={stroke} />
        {items.map(([name], i) => {
          const f = fracs[i]
          const slice = <circle key={name} cx={c} cy={c} r={r} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={stroke} strokeDasharray={`${f * len} ${len}`} strokeDashoffset={-starts[i] * len} />
          return slice
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[12px] text-text-secondary">{top}</span>
        <span className={`text-[18px] font-bold tabular-nums ${mainClass}`}>{main}</span>
      </div>
    </div>
  )
}

/** One category as a tile: name, spent, "of target" and a bar. Over rows sit on an error tint. A bill shows Paid or Due
 *  beside its target; the pace of a spread category is only said to a screen reader, since the tint and the bar show it. */
const Tiles: React.FC<{ rows: CategoryRow[]; showPace: boolean; className?: string }> = ({ rows, showPace, className = 'grid grid-cols-2 gap-2' }) => (
  <div className={className}>
    {rows.map((r) => {
      const over = isOverRow(r.pace)
      const bill = r.pace === 'due' || r.pace === 'paid' || r.pace === 'overBudget'
      return (
        <div key={r.id} className={`min-w-0 rounded-xl p-3 ${over ? 'bg-error/10' : 'bg-bg-secondary'}`}>
          <div className="truncate text-[13px] text-text-secondary">{r.name}</div>
          <div className={`text-[17px] font-semibold tabular-nums ${over ? 'text-error' : 'text-text-primary'}`}>{formatMoney(r.spent)}</div>
          <div className="text-meta tabular-nums text-text-secondary">of {formatMoney(r.target)}{showPace && bill ? ` · ${PACE_TEXT[r.pace]}` : ''}</div>
          {showPace && !bill && <span className="sr-only">{PACE_TEXT[r.pace]}</span>}
          <div className="mt-2"><Bar frac={share(r.spent, r.target)} bad={over} /></div>
        </div>
      )
    })}
  </div>
)

const BudgetCard: React.FC<{ d: BudgetOverview }> = ({ d }) => {
  const list = useShowMore(d.rows, 6)
  const listId = useId()
  const hasAnything = d.rows.length > 0 || d.annualRows.length > 0
  return (
    <Card label="Budget vs. Actual">
      <Title>Budget vs. Actual</Title>
      {!hasAnything ? (
        <p className="mt-2 text-[14px] text-text-secondary">Set target amounts on categories to track progress.</p>
      ) : (
        <>
          {d.budgeted > 0 && (
            <div className="mt-2 flex justify-between text-[14px]">
              <span className="text-text-secondary">Total</span>
              <span className={`tabular-nums font-medium ${d.expense > d.budgeted ? 'text-error' : 'text-text-primary'}`}>{formatMoney(d.expense)} / {formatMoney(d.budgeted)}</span>
            </div>
          )}
          <div id={listId} role="group" aria-label="Category budgets" className="mt-3"><Tiles rows={list.visible} showPace={d.current} /></div>
          {list.truncates && (
            <button type="button" onClick={list.toggle} aria-expanded={list.expanded} aria-controls={listId}
              className="mt-2 w-full min-h-11 rounded-xl border border-border-strong text-[14px] font-medium text-accent">
              {list.expanded ? 'Show Fewer' : `Show All ${d.rows.length} Categories`}
            </button>
          )}
          {d.annualRows.length > 0 && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="text-[12px] uppercase tracking-wide text-text-secondary">Annual Budgets</p>
              <div className="mt-2"><Tiles rows={d.annualRows} showPace /></div>
            </div>
          )}
          {d.unbudgeted > 0 && (
            <div className="flex justify-between border-t border-border pt-2 text-[14px]"><span className="text-text-secondary">Unbudgeted Spending</span><span className="font-medium tabular-nums text-error">{formatMoney(d.unbudgeted)}</span></div>
          )}
        </>
      )}
    </Card>
  )
}

/** Phone Budgeting, This Month: In, Out, Net and Saved lead, then whatever needs attention, the budget, this
 *  month's bills, the Expense and Income donut, and who owes you. Cash flow and savings rate live in Insights. */
export const BudgetOverviewMobile: React.FC<{ range: MonthRange; attention?: React.ReactNode; bills?: React.ReactNode }> = ({ range, attention, bills }) => {
  const d = useBudgetOverview(range)
  const [view, setView] = useState<'out' | 'in'>('out')
  const spending = view === 'out'
  const total = spending ? d.expense : d.income
  const slices = foldSmallest(spending ? d.groups : d.sources, COLORS.length - 1, 'Other')

  return (
    <div className="flex flex-col gap-4">
      <Card label="Net Change">
        <div className="grid grid-cols-4 gap-1 text-center">
          <div data-testid="overview-in"><div className="text-[12px] text-text-secondary">In</div><div className="text-[16px] font-semibold tabular-nums text-accent">{formatMoney(d.income)}</div></div>
          <div><div className="text-[12px] text-text-secondary">Out</div><div className="text-[16px] font-semibold tabular-nums text-text-primary">{formatMoney(d.expense)}</div></div>
          <div><div className="text-[12px] text-text-secondary">Net</div><div data-key-figure className={`text-[16px] font-semibold tabular-nums ${tone(d.net)}`}>{sign(d.net)}</div></div>
          <div><div className="text-[12px] text-text-secondary">Saved</div><div className="text-[16px] font-semibold tabular-nums text-text-primary">{d.rate === null ? '-' : `${Math.round(d.rate * 100)}%`}</div></div>
        </div>
        {d.projected !== null && (
          <div className="mt-3 border-t border-border pt-3 text-center text-[14px] text-text-secondary">
            Projected Net <span className={`font-medium tabular-nums ${tone(d.projected)}`}>{sign(d.projected)}</span>
          </div>
        )}
      </Card>
      {attention}
      <BudgetCard d={d} />
      {bills}
      <Card label={spending ? 'Expense' : 'Income'}>
        {total > 0 ? (
          <div className="flex items-center gap-4">
            <Donut items={slices} total={total} top={spending ? 'Out' : 'In'} main={formatMoney(total)} mainClass={spending ? 'text-text-primary' : 'text-accent'} />
            <div className="min-w-0 flex-1 space-y-1.5">
              {slices.map(([name, value], i) => (
                <div key={name} className="flex items-center gap-2 text-[14px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
                  <span className="flex-1 truncate text-text-primary">{name}</span>
                  <span className="tabular-nums text-text-secondary">{Math.round(share(value, total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-text-secondary">No {spending ? 'expenses' : 'income'} in this period yet.</p>
        )}
        <div role="group" aria-label="Chart shows" className="mt-4 flex bg-bg-secondary border border-border rounded-xl p-1">
          {([['out', 'Expense'], ['in', 'Income']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}
              className={`flex-1 min-h-11 rounded-lg text-[14px] font-medium ${view === id ? 'bg-accent/15 text-accent' : 'text-text-secondary'}`}>{label}</button>
          ))}
        </div>
      </Card>
      <OwedToMeWidget />
    </div>
  )
}
