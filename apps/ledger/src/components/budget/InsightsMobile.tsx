import React, { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, EyeOff } from 'lucide-react'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useRecurringStore } from '../../store/useRecurringStore'
import { detectRecurring, upcomingWithin, type RecurringItem } from '../../utils/budget/recurring'
import { detectAnomalies } from '../../utils/budget/categoryStats'
import { isSingleMonth, monthKeysInRange, type MonthRange } from '../../utils/budget/period'
import { dispatchReminders } from '../../utils/reminders'
import { formatMoney } from '../planner/format'
import { SpendingHeatmapWidget } from './SpendingHeatmapWidget'
import { CategoryTrendsWidget } from './CategoryTrendsWidget'

const UPCOMING_DAYS = 30
const DAY_MS = 86400000

// Local calendar date, not UTC: toISOString rolls over to tomorrow late in the day for users west of UTC.
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysUntil = (date: string) =>
  Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${isoOf(new Date())}T12:00:00`).getTime()) / DAY_MS)
const fmtDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const inDays = (n: number) => (n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} Days`)
const weekLabel = (n: number) => (n <= 7 ? 'This Week' : n <= 14 ? 'Next Week' : n <= 21 ? 'In 2 Weeks' : 'Later')
const cadence = (d: number) =>
  d >= 26 && d <= 35 ? 'Monthly' : d >= 6 && d <= 8 ? 'Weekly' : d >= 13 && d <= 15 ? 'Every 2 Weeks' : d >= 85 ? 'Quarterly' : `Every ${d} Days`

function useInsights(range: MonthRange) {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const ignoredKeys = useRecurringStore((s) => s.ignoredKeys)
  const detected = detectRecurring(transactions).filter((i) => i.type === 'expense')
  const items = detected.filter((i) => !ignoredKeys.includes(i.key))
  const ignored = detected.filter((i) => ignoredKeys.includes(i.key))
  const monthly = items.reduce((s, i) => s + i.monthlyEstimate, 0)
  const upcoming = upcomingWithin(items, isoOf(new Date()), UPCOMING_DAYS)
  const upcomingTotal = upcoming.reduce((s, i) => s + i.avgAmount, 0)
  const months = isSingleMonth(range) ? [range.to] : monthKeysInRange(range)
  const alerts = months.flatMap((month) =>
    detectAnomalies(transactions, categories, month, new Date(`${month}-15T12:00:00`)).map((a) => ({
      ...a, month, name: categories[a.categoryId]?.name ?? a.categoryId,
    })))

  // Reminders are opt-in (Settings > Reminders) and dispatchReminders() is a no-op unless Notification permission
  // was granted, so this runs unconditionally, as it does in the desktop widget.
  useEffect(() => {
    dispatchReminders(detected.map((i) => ({ key: i.key, label: i.description, nextDate: i.nextExpected })), { ignoredKeys })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, ignoredKeys])

  return { items, ignored, monthly, upcoming, upcomingTotal, alerts, single: isSingleMonth(range) }
}
type Insights = ReturnType<typeof useInsights>
type Alert = Insights['alerts'][number]

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="themed-card rounded-2xl p-4 flex flex-col gap-3">
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-[18px] font-semibold text-text-primary">{title}</h2>
      {hint && <span className="text-[13px] text-text-secondary">{hint}</span>}
    </div>
    {children}
  </section>
)

const Empty: React.FC<{ children: string }> = ({ children }) => <p className="text-[13px] text-text-secondary">{children}</p>

/** One card per fold, so the widget inside keeps its content but not a second card and title of its own. */
const Fold: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="themed-card rounded-2xl">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-[16px] font-semibold text-text-primary">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {hint && <span className="text-[13px] font-normal text-text-secondary">{hint}</span>}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 [&_.themed-card]:!border-0 [&_.themed-card]:!bg-none [&_.themed-card]:!bg-transparent [&_.themed-card]:!p-0 [&_.themed-card]:!shadow-none [&_h2]:hidden">
          {children}
        </div>
      )}
    </div>
  )
}

const IgnoreButton: React.FC<{ item: RecurringItem }> = ({ item }) => {
  const ignore = useRecurringStore((s) => s.ignore)
  return (
    <button type="button" onClick={() => ignore(item.key)} aria-label={`Ignore ${item.description}`} title="Not a Subscription"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary">
      <EyeOff size={16} />
    </button>
  )
}

const RecurringRow: React.FC<{ item: RecurringItem }> = ({ item }) => (
  <div className="flex items-center gap-2 border-b border-border last:border-b-0">
    <div className="min-w-0 flex-1 py-2">
      <p className="truncate text-[15px] font-medium text-text-primary">{item.description}</p>
      <p className="text-[13px] text-text-secondary">{cadence(item.intervalDays)} · Next {fmtDate(item.nextExpected)}</p>
    </div>
    <p className="shrink-0 text-[15px] font-semibold text-text-primary">{formatMoney(item.avgAmount)}</p>
    <IgnoreButton item={item} />
  </div>
)

const IgnoredList: React.FC<{ items: RecurringItem[] }> = ({ items }) => {
  const unignore = useRecurringStore((s) => s.unignore)
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="mt-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-11 text-[13px] text-text-secondary">
        Ignored ({items.length})
      </button>
      {open && items.map((i) => (
        <div key={i.key} className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[13px] text-text-secondary">{i.description}</span>
          <button type="button" onClick={() => unignore(i.key)} aria-label={`Restore ${i.description}`} className="min-h-11 shrink-0 px-2 text-[13px] text-accent">
            Restore
          </button>
        </div>
      ))}
    </div>
  )
}

const AlertCard: React.FC<{ a: Alert; showMonth: boolean }> = ({ a, showMonth }) => {
  const max = Math.max(a.monthSpend, a.rollingAvg)
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-error" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text-primary">{a.name}{showMonth && ` · ${a.month}`}</p>
        <span className="rounded-full bg-error/15 px-2 py-0.5 text-[13px] font-semibold text-error">{a.ratio.toFixed(1)}×</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[13px] text-text-secondary">
          <span className="w-20 shrink-0">Usual</span>
          <span className="h-2 rounded-full bg-text-secondary/50" style={{ width: `${(a.rollingAvg / max) * 60}%` }} aria-hidden="true" />
          <span className="ml-auto">{formatMoney(a.rollingAvg)}</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-text-primary">
          <span className="w-20 shrink-0">This Month</span>
          <span className="h-2 rounded-full bg-error" style={{ width: `${(a.monthSpend / max) * 60}%` }} aria-hidden="true" />
          <span className="ml-auto font-semibold">{formatMoney(a.monthSpend)}</span>
        </div>
      </div>
    </div>
  )
}

const AlertBanner: React.FC<{ d: Insights }> = ({ d }) => {
  const [open, setOpen] = useState(false)
  if (d.alerts.length === 0) return null
  return (
    <div className="themed-card rounded-2xl">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-12 w-full items-center gap-2 px-4 text-left">
        <AlertTriangle className="h-4 w-4 text-error" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold text-text-primary">
          {d.alerts.length} Spending {d.alerts.length === 1 ? 'Alert' : 'Alerts'}
        </span>
        <ChevronDown className={`h-4 w-4 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {d.alerts.map((a) => <AlertCard key={`${a.month}-${a.categoryId}`} a={a} showMonth={!d.single} />)}
        </div>
      )}
    </div>
  )
}

/** The phone Insights tab: an alert banner, what is coming up by week, then the detail folded away. */
export const InsightsMobile: React.FC<{ range: MonthRange }> = ({ range }) => {
  const d = useInsights(range)
  const weeks = new Map<string, RecurringItem[]>()
  for (const i of d.upcoming) {
    const k = weekLabel(Math.max(0, daysUntil(i.nextExpected)))
    weeks.set(k, [...(weeks.get(k) ?? []), i])
  }
  return (
    <>
      <AlertBanner d={d} />
      <Card title="Coming Up" hint={`${formatMoney(d.upcomingTotal)} in ${UPCOMING_DAYS} Days`}>
        {d.items.length === 0 ? (
          <Empty>No repeating charges detected yet. Import more history.</Empty>
        ) : weeks.size === 0 ? (
          <Empty>Nothing due in the next 30 days.</Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {[...weeks].map(([label, list]) => (
              <div key={label} role="group" aria-label={label}>
                <p className="mb-1 flex items-center justify-between text-[13px] font-semibold uppercase tracking-wide text-text-secondary">
                  <span>{label}</span><span>{formatMoney(list.reduce((s, i) => s + i.avgAmount, 0))}</span>
                </p>
                <ul className="relative flex flex-col border-l-2 border-accent/40 pl-4">
                  {list.map((i) => (
                    <li key={i.key} className="relative flex items-center gap-2 py-2">
                      <span className="absolute -left-[21px] h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-text-primary">{i.description}</p>
                        <p className="text-[13px] text-text-secondary">{fmtDate(i.nextExpected)} · {inDays(daysUntil(i.nextExpected))}</p>
                      </div>
                      <span className="text-[15px] font-semibold text-text-primary">{formatMoney(i.avgAmount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Fold title="All Recurring Charges" hint={`${formatMoney(d.monthly)}/mo`}>
        {d.items.length === 0 ? <Empty>No repeating charges detected yet. Import more history.</Empty> : (
          <div data-testid="recurring-list" className="flex flex-col">
            {d.items.map((i) => <RecurringRow key={i.key} item={i} />)}
          </div>
        )}
        <IgnoredList items={d.ignored} />
      </Fold>
      <Fold title="Spending Calendar"><SpendingHeatmapWidget range={range} /></Fold>
      <Fold title="Category Trends"><CategoryTrendsWidget range={range} /></Fold>
    </>
  )
}
