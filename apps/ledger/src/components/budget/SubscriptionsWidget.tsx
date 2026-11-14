import React, { useEffect, useState } from 'react'
import { Repeat, EyeOff, CalendarClock } from 'lucide-react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useRecurringStore } from '../../store/useRecurringStore'
import { detectRecurring, upcomingWithin } from '../../utils/budget/recurring'
import { dispatchReminders } from '../../utils/reminders'
import { formatMoney } from '../planner/format'

const UPCOMING_DAYS = 30

export const SubscriptionsWidget: React.FC = () => {
  const transactions = useBudgetStore((s) => s.transactions)
  const ignoredKeys = useRecurringStore((s) => s.ignoredKeys)
  const ignore = useRecurringStore((s) => s.ignore)
  const unignore = useRecurringStore((s) => s.unignore)
  const [showIgnored, setShowIgnored] = useState(false)

  const detected = detectRecurring(transactions).filter((i) => i.type === 'expense')
  const items = detected.filter((i) => !ignoredKeys.includes(i.key))
  const ignored = detected.filter((i) => ignoredKeys.includes(i.key))
  const monthlyTotal = items.reduce((s, i) => s + i.monthlyEstimate, 0)

  // Use local calendar date, not UTC. toISOString reports UTC date, which rolls over to
  // tomorrow late in the day for users west of UTC, causing today's charges to disappear.
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcoming = upcomingWithin(items, today, UPCOMING_DAYS)
  const upcomingTotal = upcoming.reduce((s, i) => s + i.avgAmount, 0)

  // Reminders are opt-in (see Settings > Reminders) and dispatchReminders()
  // itself is a no-op unless Notification permission has been granted, so
  // this runs unconditionally: it fires real notifications only for users
  // who already turned the feature on.
  useEffect(() => {
    dispatchReminders(
      detected.map((i) => ({ key: i.key, label: i.description, nextDate: i.nextExpected })),
      { ignoredKeys },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, ignoredKeys])

  return (
    <WidgetWrapper title="Subscriptions & Recurring">
      {items.length === 0 ? (
        <p className="text-[13px] text-text-secondary mt-2">No repeating charges detected yet. Import more history.</p>
      ) : (
        <div data-testid="recurring-list" className="flex flex-col gap-2 mt-2">
          <p className="text-[13px] text-text-secondary">
            ~<span className="text-accent font-semibold">{formatMoney(monthlyTotal)}</span>/month across {items.length} recurring charges
          </p>
          {items.slice(0, 8).map((i) => (
            <div key={i.key} className="flex items-center justify-between text-[13px] border-b border-border pb-1 last:border-b-0">
              <span className="flex items-center gap-2 text-text-primary truncate min-w-0">
                <Repeat className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate">{i.description}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-text-secondary whitespace-nowrap">
                  {formatMoney(i.avgAmount)} · every {i.intervalDays}d · next {i.nextExpected}
                </span>
                <button
                  onClick={() => ignore(i.key)}
                  aria-label={`Ignore ${i.description}`}
                  title="Not a subscription"
                  className="p-1 text-text-secondary hover:text-text-primary rounded-md"
                >
                  <EyeOff size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
            <CalendarClock className="w-3.5 h-3.5 text-accent" /> Next 30 days
            <span className="ml-auto text-text-secondary font-normal">{formatMoney(upcomingTotal)}</span>
          </p>
          <div data-testid="upcoming-list" className="flex flex-col gap-1 mt-2">
            {upcoming.map((i) => (
              <div key={i.key} className="flex justify-between text-[13px]">
                <span className="text-text-secondary truncate min-w-0">{i.nextExpected}</span>
                <span className="text-text-primary truncate mx-2 min-w-0">{i.description}</span>
                <span className="text-text-secondary whitespace-nowrap">{formatMoney(i.avgAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ignored.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowIgnored(!showIgnored)}
            className="text-[12px] text-text-secondary hover:text-text-primary"
          >
            Ignored ({ignored.length})
          </button>
          {showIgnored && (
            <div className="flex flex-col gap-1 mt-2">
              {ignored.map((i) => (
                <div key={i.key} className="flex justify-between items-center text-[13px]">
                  <span className="text-text-secondary truncate min-w-0">{i.description}</span>
                  <button
                    onClick={() => unignore(i.key)}
                    className="text-[12px] text-accent hover:underline shrink-0 ml-2"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  )
}
