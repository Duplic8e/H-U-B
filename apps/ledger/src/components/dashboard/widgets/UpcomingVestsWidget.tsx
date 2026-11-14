import React from 'react'
import { CalendarClock } from 'lucide-react'
import { WidgetWrapper } from '../WidgetWrapper'
import { generateVestEvents } from '../../../store/useCompensationStore'
import { useCompensationDisplay } from '../../../hooks/useCompensationDisplay'
import { formatMoney } from '../../planner/format'
import { EmptyState } from '../../ui/EmptyState'
import { InfoButton } from '../../ui/InfoButton'
import { UpcomingVestsMobile } from './UpcomingVestsMobile'
import { useUpcomingVestDays } from './useUpcomingVestDays'
import { useIsDesktop } from '../../../hooks/useMediaQuery'

const MAX_SHOWN = 4

export const UpcomingVestsWidget: React.FC = () => {
  // The display package carries the live or cached price for the ticker; the stored price is only
  // a manual fallback and is 0 when the price comes from market data.
  const { pkg } = useCompensationDisplay()
  const now = new Date()
  const isDesktop = useIsDesktop()
  const days = useUpcomingVestDays()

  const upcoming = pkg.rsuGrants
    .flatMap((grant) =>
      generateVestEvents(grant, pkg.companyCurrentPrice).map((e) => ({ ...e, grantName: grant.grantName })),
    )
    .filter((e) => e.date !== undefined && new Date(e.date) > now)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .slice(0, MAX_SHOWN)

  if (!isDesktop && days.length > 0) return <UpcomingVestsMobile days={days} />

  return (
    <WidgetWrapper
      title="Upcoming Vests"
      titleAdornment={<InfoButton label="About Upcoming Vests" inline><p>Add RSU grants in Compensation to see your next vesting payouts here.</p></InfoButton>}
    >
      {upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          message="No Upcoming Vests Available"
        />
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {upcoming.map((e) => (
            <div key={`${e.grantName}-${e.monthIndex}`} className="flex items-center justify-between px-3 py-2.5 min-h-12 bg-bg-secondary rounded-xl border border-border">
              <div>
                <p className="text-[15px] text-text-primary font-medium">{e.grantName}</p>
                <p className="text-[13px] text-text-secondary">
                  {new Date(e.date!).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span className="text-[15px] font-medium text-accent">{formatMoney(e.vestValue)}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  )
}
