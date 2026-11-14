import React from 'react'
import { formatMoney } from '../../planner/format'
import type { MonthlyBudgetStats } from '../../../store/useBudgetStore'
import { useBillIds } from '../../../hooks/useBillIds'

interface BudgetPaceMobileProps {
  stats: MonthlyBudgetStats
  now: Date
}

/** Phone body of This Month's Budget: what is safe to spend each day from here, whether spending is ahead of
 *  the calendar, and a bar with a tick for where spending should be by now (bills count in full, the rest by the day). `stats.remaining + stats.spent` is the month's total target. */
export const BudgetPaceMobile: React.FC<BudgetPaceMobileProps> = ({ stats, now }) => {
  const bills = useBillIds()
  const target = stats.remaining + stats.spent
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const day = now.getDate()
  const daysLeft = daysInMonth - day + 1
  const spentPct = target > 0 ? Math.min(Math.max(stats.spent / target, 0), 1) * 100 : 0
  // Bills are paid in one go, so they count in full from the start; only the rest is spread across the days.
  const billTarget = Object.values(stats.perCategory).filter((c) => bills.has(c.id)).reduce((sum, c) => sum + c.effectiveTarget, 0)
  const expected = target > 0 ? Math.min(target, billTarget + (target - billTarget) * (day / daysInMonth)) : 0
  const todayPct = target > 0 ? (expected / target) * 100 : (day / daysInMonth) * 100
  const ahead = spentPct > todayPct
  const perDay = Math.max(stats.remaining, 0) / daysLeft

  return (
    <div className="mt-2">
      <div className="mb-1 text-[13px] font-medium text-text-secondary">Daily Spent Limit</div>
      <div className="flex items-center justify-between gap-3">
        <div data-key-figure className={`text-[28px] font-bold leading-none tabular-nums ${stats.remaining >= 0 ? 'text-accent' : 'text-error'}`}>{formatMoney(perDay)}</div>
        {target > 0 && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${ahead ? 'bg-error/15 text-error' : 'bg-accent/15 text-accent'}`}>{ahead ? 'Ahead of Pace' : 'On Pace'}</span>
        )}
      </div>
      <div className="relative mt-4 h-3 rounded-full bg-bg-tertiary" aria-hidden="true">
        <div className={`h-full rounded-full ${ahead ? 'bg-error' : 'bg-accent'}`} style={{ width: `${spentPct}%` }} />
        <div className="absolute -top-1.5 h-6 w-0.5 bg-text-primary" style={{ left: `${todayPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-text-secondary tabular-nums">
        <span>{formatMoney(stats.spent)} spent</span>
        <span>Day {day} of {daysInMonth}</span>
      </div>
    </div>
  )
}
