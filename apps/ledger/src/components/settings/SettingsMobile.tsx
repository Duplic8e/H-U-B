import React from 'react'
import { Bell, ChevronRight, Database, LineChart, Palette, RefreshCw } from 'lucide-react'
import { AppearancePicker } from '../theme/AppearancePicker'
import { THEME_PREFERENCES, useThemeStore } from '../../store/useThemeStore'
import { InfoButton } from '../ui/InfoButton'

interface SettingsMobileProps {
  marketBadge: React.ReactNode
  market: React.ReactNode
  refundsOn: boolean
  onRefundsChange: (on: boolean) => void
  backup: React.ReactNode
  sync: React.ReactNode
  reminders: React.ReactNode
  footer: React.ReactNode
}

const REFUNDS_NOTE = 'Let money received reduce spending in an expense category. Turning this off hides the option for new transactions; saved payments still count.'

const Switch: React.FC<{ on: boolean; label: string; onChange: (on: boolean) => void }> = ({ on, label, onChange }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={`shrink-0 h-7 w-12 rounded-full border border-border p-0.5 transition-colors ${on ? 'bg-accent' : 'bg-bg-primary'}`}>
    <span className={`block h-[22px] w-[22px] rounded-full bg-text-primary transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
)

const Fold: React.FC<{ icon: React.ReactNode; title: string; summary?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }> = ({ icon, title, summary, defaultOpen, children }) => (
  <details open={defaultOpen} className="themed-card rounded-2xl group">
    <summary className="flex items-center gap-3 px-4 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <span className="text-text-secondary" aria-hidden="true">{icon}</span>
      <span className="flex-1 text-[15px] font-semibold text-text-primary">{title}</span>
      {summary && <span className="text-[13px] text-text-secondary">{summary}</span>}
      <ChevronRight className="w-4 h-4 text-text-secondary transition-transform group-open:rotate-90" aria-hidden="true" />
    </summary>
    <div className="px-4 pt-3 pb-4 flex flex-col gap-3">{children}</div>
  </details>
)

/** Phone Settings: one fold per section with its current state on the right, Appearance
 *  open first, so the whole sheet fits one screen until you open something. */
export const SettingsMobile: React.FC<SettingsMobileProps> = (p) => {
  const preference = useThemeStore((s) => s.preference)
  const themeName = THEME_PREFERENCES.find((t) => t.value === preference)?.label ?? 'System'
  return (
    <>
      <Fold icon={<Palette className="w-5 h-5" />} title="Appearance" summary={themeName} defaultOpen><AppearancePicker /></Fold>
      <Fold icon={<LineChart className="w-5 h-5" />} title="Market Data" summary={p.marketBadge}>{p.market}</Fold>
      <Fold icon={<RefreshCw className="w-5 h-5" />} title="Transactions" summary={p.refundsOn ? 'Refunds Enabled' : 'Refunds Disabled'}>
        <div className="flex items-center gap-1 min-h-11">
          <span className="text-[15px] font-medium text-text-primary">Refunds &amp; Payments</span>
          <span className="flex-1"><InfoButton label="About Refunds & Payments" inline><p>{REFUNDS_NOTE}</p></InfoButton></span>
          <Switch on={p.refundsOn} label="Refunds & Payments" onChange={p.onRefundsChange} />
        </div>
      </Fold>
      <Fold icon={<Database className="w-5 h-5" />} title="Backup">{p.backup}</Fold>
      <Fold icon={<RefreshCw className="w-5 h-5" />} title="Sync">{p.sync}</Fold>
      <Fold icon={<Bell className="w-5 h-5" />} title="Reminders">{p.reminders}</Fold>
      {p.footer}
    </>
  )
}
