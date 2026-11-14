import React from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useDashboardLayoutStore } from '../../store/useDashboardLayoutStore'

/** What the phone Dashboard draws itself, in the order it draws it. Customize ids are the persisted widget
 *  ids; one card can stand for several of them (This Month is Income, Expenses and Monthly Summary). */
const TOP = [
  { key: 'net-worth-card', label: 'Net Worth', ids: ['trend'] },
  { key: 'month-card', label: 'This Month', ids: ['income', 'expense', 'monthly-summary'] },
]
const GROUPS = [
  { key: 'bank', label: 'Bank Accounts', ids: ['bank'] },
  { key: 'investment-accounts', label: 'Investment Accounts', ids: ['investment-accounts'] },
  { key: 'other', label: 'Others', ids: ['other'] },
  { key: 'receivable', label: 'Receivables', ids: ['receivable'] },
  { key: 'debt', label: 'Debts & Liabilities', ids: ['debt'] },
]
const MOVABLE_LABELS: Record<string, string> = {
  'budget-health': 'This Month’s Budget',
  'net-worth': 'Net Worth Over Time',
  portfolio: 'Portfolio',
  'top-goal': 'Top Goal',
  'upcoming-vests': 'Upcoming Vests',
}
/** Ids the phone Dashboard places itself, so only the other ids can be reordered. */
const FIXED_IDS = [...TOP.flatMap((t) => t.ids), ...GROUPS.flatMap((g) => g.ids)]

const Switch: React.FC<{ on: boolean; label: string; onChange: (on: boolean) => void }> = ({ on, label, onChange }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={`shrink-0 h-7 w-12 rounded-full border border-border p-0.5 transition-colors ${on ? 'bg-accent' : 'bg-bg-primary'}`}>
    <span className={`block h-[22px] w-[22px] rounded-full bg-text-primary transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
)

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="themed-card rounded-2xl px-4 py-2">
    <h3 className="pt-2 text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{title}</h3>
    <div className="divide-y divide-border">{children}</div>
  </section>
)

const Row: React.FC<{ label: string; on: boolean; onChange: (on: boolean) => void; extra?: React.ReactNode }> = ({ label, on, onChange, extra }) => (
  <div className="flex items-center gap-3 min-h-14">
    <span className="flex-1 min-w-0 truncate text-[15px] text-text-primary">{label}</span>
    {extra}
    <Switch on={on} label={`Show ${label}`} onChange={onChange} />
  </div>
)

/** Phone Customize Dashboard: the cards the phone page actually has. Net Worth and This Month come first and
 *  the account groups follow, all fixed in place and switched on or off; only the cards after them can be
 *  moved, so those are the only rows with arrows. */
export const CustomizeDashboardMobile: React.FC<{ orderedIds: string[] }> = ({ orderedIds }) => {
  const hidden = useDashboardLayoutStore((s) => s.hidden)
  const movable = orderedIds.filter((id) => !FIXED_IDS.includes(id))

  const isOn = (ids: string[]) => ids.some((id) => !hidden.includes(id))
  const setOn = (ids: string[], on: boolean) =>
    useDashboardLayoutStore.setState((s) => ({
      hidden: on ? s.hidden.filter((h) => !ids.includes(h)) : [...new Set([...s.hidden, ...ids])],
    }))
  // Swap with the neighbouring movable card and leave every other id where it was in the saved order, so
  // hidden and fixed ids keep their positions.
  const move = (id: string, dir: -1 | 1) => {
    const j = movable.indexOf(id) + dir
    if (j < 0 || j >= movable.length) return
    const next = [...orderedIds]
    const a = next.indexOf(id)
    const b = next.indexOf(movable[j])
    ;[next[a], next[b]] = [next[b], next[a]]
    useDashboardLayoutStore.setState({ order: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <Section title="Top of the Page">
        {TOP.map((t) => <Row key={t.key} label={t.label} on={isOn(t.ids)} onChange={(on) => setOn(t.ids, on)} />)}
      </Section>
      <Section title="Accounts">
        {GROUPS.map((g) => <Row key={g.key} label={g.label} on={isOn(g.ids)} onChange={(on) => setOn(g.ids, on)} />)}
      </Section>
      <Section title="More Cards">
        {movable.map((id, i) => {
          const label = MOVABLE_LABELS[id] ?? id
          return (
            <Row
              key={id}
              label={label}
              on={isOn([id])}
              onChange={(on) => setOn([id], on)}
              extra={
                <div className="flex shrink-0">
                  <button type="button" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => move(id, -1)} className="flex h-11 w-11 items-center justify-center text-text-secondary disabled:opacity-30"><ArrowUp size={16} aria-hidden="true" /></button>
                  <button type="button" aria-label={`Move ${label} down`} disabled={i === movable.length - 1} onClick={() => move(id, 1)} className="flex h-11 w-11 items-center justify-center text-text-secondary disabled:opacity-30"><ArrowDown size={16} aria-hidden="true" /></button>
                </div>
              }
            />
          )
        })}
      </Section>
    </div>
  )
}
