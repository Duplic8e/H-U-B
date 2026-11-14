import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatMoney } from '../../planner/format'
import { InfoButton } from '../../ui/InfoButton'

interface Props { label: string; amount: number; netWorth: number; others: number }

const Cell: React.FC<{ name: string; value: string; tone?: string }> = ({ name, value, tone = 'text-text-primary' }) => (
  <div className="min-w-0">
    <div className="text-[12px] text-text-secondary">{name}</div>
    <div className={`text-[16px] font-semibold tabular-nums truncate ${tone}`}>{value}</div>
  </div>
)

/** Phone Top Goal: the goal's name and percent, a bar, then where you are now, what is left and the target. */
export const TopGoalMobile: React.FC<Props> = ({ label, amount, netWorth, others }) => {
  const frac = amount > 0 ? Math.min(1, Math.max(0, netWorth / amount)) : 0
  const left = Math.max(0, amount - netWorth)
  return (
    <section className="themed-card rounded-2xl p-4" aria-label="Top Goal">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          <h2 className="text-[18px] font-semibold text-text-primary">Top Goal</h2>
          <InfoButton label="About Top Goal" inline><p>Your largest savings target from the Forecaster, measured against your net worth.</p></InfoButton>
        </div>
        <Link to="/planner/forecaster" className="inline-flex items-center gap-0.5 min-h-11 pl-2 -mr-1 text-[14px] font-medium text-text-secondary">
          View All<ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-[16px] font-medium text-text-primary truncate">{label}</span>
        <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[12px] font-semibold text-accent">{Math.round(frac * 100)}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-bg-tertiary overflow-hidden" role="progressbar" aria-label={`${label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${frac * 100}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Cell name="Now" value={formatMoney(netWorth)} />
        <Cell name="Left" value={formatMoney(left)} tone="text-accent" />
        <Cell name="Goal" value={formatMoney(amount)} />
      </div>
      {others > 0 && <div className="mt-3 text-[13px] text-text-secondary">+ {others} More Goal{others === 1 ? '' : 's'}</div>}
    </section>
  )
}
