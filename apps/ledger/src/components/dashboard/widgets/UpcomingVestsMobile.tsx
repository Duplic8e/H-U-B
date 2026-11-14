import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { VestDay } from './useUpcomingVestDays'
import { formatMoney } from '../../planner/format'
import { InfoButton } from '../../ui/InfoButton'

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })

const until = (iso: string) => {
  const days = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 60) return `In ${days} Days`
  return `In ${Math.round(days / 30)} Months`
}

/** Phone Upcoming Vests: the next vest with a countdown and its total, then the three dates after it. */
export const UpcomingVestsMobile: React.FC<{ days: VestDay[] }> = ({ days }) => {
  const next = days[0]
  return (
    <section className="themed-card rounded-2xl p-4" aria-label="Upcoming Vests">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          <h2 className="text-[18px] font-semibold text-text-primary">Upcoming Vests</h2>
          <InfoButton label="About Upcoming Vests" inline><p>Your next RSU vesting payouts, at the current stock price.</p></InfoButton>
        </div>
        <Link to="/compensation" className="inline-flex items-center gap-0.5 min-h-11 pl-2 -mr-1 text-[14px] font-medium text-text-secondary">
          View All<ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-1 text-[13px] text-text-secondary">Next Vest · {until(next.iso)}</div>
      <div className="text-[30px] font-bold leading-[1.1] tabular-nums text-accent">{formatMoney(next.total)}</div>
      <div className="text-[14px] text-text-secondary">{fmtDay(next.iso)} · {next.grants} Grant{next.grants === 1 ? '' : 's'}</div>
      {days.length > 1 && (
        <div className="mt-3 divide-y divide-border border-t border-border">
          {days.slice(1, 4).map((d) => (
            <div key={d.day} className="flex items-center justify-between min-h-12">
              <span className="text-[15px] text-text-primary">{fmtDay(d.iso)}</span>
              <span className="text-[15px] font-medium tabular-nums text-text-primary">{formatMoney(d.total)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
