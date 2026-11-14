import React, { useState } from 'react'
import { Bell, Database, LineChart, Palette, RefreshCw, Settings, X } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { AppearancePicker } from '../theme/AppearancePicker'
import { MarketDataSection, MarketDataStatusBadge } from './MarketDataSettings'
import { BackupControls } from './BackupControls'
import { DriveSyncControls } from './DriveSyncControls'
import { HubSyncControls } from './HubSyncControls'
import { reminderSupport, remindersEnabled, setRemindersEnabled, type ReminderSupport } from '../../utils/reminders'
import { Checkbox } from '../ui/Checkbox'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { PHONE_SECONDARY_ACTION } from './actionStyles'
import { SettingsMobile } from './SettingsMobile'
import { useBudgetStore } from '../../store/useBudgetStore'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  onOpenWhatsNew: () => void
  onOpenDisclaimer: () => void
}

// Phone anatomy, identical for every section: heading row (icon + title), one muted
// description line, then the control. All sections share this card padding. Desktop keeps
// its original markup, so the description is only rendered on a phone.
const SectionCard: React.FC<{
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  description?: string
  children: React.ReactNode
}> = ({ icon, title, badge, description, children }) => {
  const isDesktop = useIsDesktop()
  return (
    <section className="border border-border rounded-lg p-3">
      <div className={`flex items-center justify-between gap-2 ${isDesktop ? 'mb-2.5' : 'mb-1.5'}`}>
        <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
          <span className="text-text-secondary" aria-hidden="true">{icon}</span>
          {title}
        </h3>
        {badge}
      </div>
      {!isDesktop && description && <p className="text-[12px] text-text-secondary mb-2.5">{description}</p>}
      {children}
    </section>
  )
}

/** Opt-in control for recurring-bill reminders. Notification.requestPermission()
 *  is only ever called from this button's click handler, never on mount or in
 *  an effect: some browsers auto-deny (and remember the denial) a permission
 *  prompt that fires without a direct user gesture. */
const ReminderSettings: React.FC = () => {
  const [support, setSupport] = useState<ReminderSupport>(() => reminderSupport())
  const [enabled, setEnabled] = useState(() => remindersEnabled())
  const isDesktop = useIsDesktop()

  const handleEnable = () => {
    void Notification.requestPermission().then((result) => {
      setSupport(result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'default')
      if (result === 'granted') {
        setRemindersEnabled(true)
        setEnabled(true)
      }
    })
  }

  if (support === 'unsupported') {
    return <p className={`${isDesktop ? 'text-[13px]' : 'text-[12px]'} text-text-secondary`}>Notifications aren't supported in this browser.</p>
  }

  if (support === 'denied') {
    return (
      <p className={`${isDesktop ? 'text-[13px]' : 'text-[12px]'} text-text-secondary`}>
        Notifications are blocked for this site. Allow them in your browser's site settings to get bill reminders.
      </p>
    )
  }

  if (support === 'granted') {
    return (
      <label className="flex items-center gap-2 text-[13px] text-text-primary">
        <Checkbox
          checked={enabled}
          ariaLabel="Remind me before upcoming recurring bills"
          onChange={(next) => {
            setRemindersEnabled(next)
            setEnabled(next)
          }}
        />
        Remind me before upcoming recurring bills
      </label>
    )
  }

  // Phone: text block left, one real button right, centered on the whole block. The
  // action used to be a bare 12px link that the tap-target floor stretched to 44px, which
  // left it floating off the text's centre line.
  if (!isDesktop) {
    return (
      <div data-testid="reminders-row" className="flex items-center gap-3">
        <p className="flex-1 min-w-0 text-[12px] text-text-secondary">Get a reminder a few days before recurring bills are due.</p>
        <button onClick={handleEnable} className={`shrink-0 whitespace-nowrap ${PHONE_SECONDARY_ACTION}`}>
          Enable reminders
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[13px] text-text-secondary">Get a reminder a few days before recurring bills are due.</p>
      <button
        onClick={handleEnable}
        className="text-[12px] font-medium text-accent hover:underline whitespace-nowrap"
      >
        Enable reminders
      </button>
    </div>
  )
}

/** Single settings hub: Appearance, Market data, Backup as section cards,
 *  About as a footer row. Modal on desktop, bottom sheet on mobile. */
export const SettingsSheet: React.FC<SettingsSheetProps> = ({ open, onClose, onOpenWhatsNew, onOpenDisclaimer }) => {
  const isDesktop = useIsDesktop()
  const refundsAndPaymentsEnabled = useBudgetStore(state => state.refundsAndPaymentsEnabled)
  const setRefundsAndPaymentsEnabled = useBudgetStore(state => state.setRefundsAndPaymentsEnabled)
  const footer = (
        <div className={isDesktop ? 'flex items-center justify-between pt-2 border-t border-border' : 'flex flex-wrap items-center justify-between gap-x-4 pt-2 border-t border-border'}>
      <button
        onClick={() => { onClose(); onOpenWhatsNew() }}
        className="text-[12px] text-text-secondary hover:text-accent transition-colors"
      >
        v{__APP_VERSION__} · What's New
      </button>
      <button
        onClick={() => { onClose(); onOpenDisclaimer() }}
        className="text-[12px] text-text-secondary/80 hover:text-accent transition-colors"
      >
        Not financial advice
      </button>
    </div>
  )
  return (
  <Sheet
    open={open}
    onClose={onClose}
    desktop="modal"
    ariaLabel="Settings"
    panelClassName="themed-menu desktop:rounded-lg w-full max-w-md desktop:p-5 desktop:max-h-[85dvh] desktop:overflow-y-auto"
    contentClassName="flex flex-col gap-3"
  >
    <div className="hidden desktop:flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[18px] font-semibold text-text-primary">
        <Settings className="w-5 h-5 text-accent" /> Settings
      </h2>
      <button
        onClick={onClose}
        aria-label="Close"
        className="text-text-secondary hover:text-accent rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    {isDesktop ? (<>
    <SectionCard icon={<Palette className="w-4 h-4" />} title="Appearance" description="Follow your device, or pick Light or Dark.">
      <AppearancePicker />
    </SectionCard>

    <SectionCard icon={<LineChart className="w-4 h-4" />} title="Market Data" badge={<MarketDataStatusBadge />} description="Your key is stored only on this device.">
      <MarketDataSection />
    </SectionCard>

    <SectionCard icon={<RefreshCw className="w-4 h-4" />} title="Transactions">
      <label className="flex items-center gap-2 text-[13px] text-text-primary">
        <Checkbox checked={refundsAndPaymentsEnabled} onChange={setRefundsAndPaymentsEnabled} ariaLabel="Refunds & Payments" />
        Refunds &amp; Payments
      </label>
      <p className="mt-2 text-[12px] text-text-secondary">Let money received reduce spending in an expense category. Turning this off hides the option for new transactions; saved payments still count.</p>
    </SectionCard>

    <SectionCard icon={<Database className="w-4 h-4" />} title="Backup" description="Save, restore or try sample data.">
      <BackupControls />
    </SectionCard>

    <SectionCard icon={<RefreshCw className="w-4 h-4" />} title="Sync">
      <HubSyncControls />
      <DriveSyncControls />
    </SectionCard>

    <SectionCard icon={<Bell className="w-4 h-4" />} title="Reminders">
      <ReminderSettings />
    </SectionCard>

    {footer}
    </>) : (
      <SettingsMobile
        marketBadge={<MarketDataStatusBadge />}
        market={<MarketDataSection />}
        refundsOn={refundsAndPaymentsEnabled}
        onRefundsChange={setRefundsAndPaymentsEnabled}
        backup={<BackupControls />}
        sync={<><HubSyncControls /><DriveSyncControls /></>}
        reminders={<ReminderSettings />}
        footer={footer}
      />
    )}
  </Sheet>
  )
}
