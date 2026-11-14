import React, { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import type { PastSalary, RSUGrant, VestingFrequency, VestingPreset } from '../../store/useCompensationStore'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { NumberInput } from '../ui/NumberInput'

/** Everything the phone form shows and changes. CompensationModal owns the state and the save
 *  logic, so this layout and the desktop one cannot disagree about either. */
export interface CompensationFormMobileProps {
  ticker: string; setTicker: (v: string) => void
  price: number; setPrice: (v: number) => void; priceHint: boolean
  base: number; setBase: (v: number) => void
  changes: PastSalary[]; addChange: () => void; removeChange: (id: string) => void
  setChange: (id: string, f: 'salary' | 'changeMonth', v: number) => void
  bonusPct: number; setBonusPct: (v: number) => void
  bonusMonth: string; setBonusMonth: (v: string) => void
  grants: RSUGrant[]; removeGrant: (id: string) => void; editGrant: (g: RSUGrant) => void; editId: string | null
  gName: string; setGName: (v: string) => void
  gShares: number; setGShares: (v: number) => void
  gPrice: number; setGPrice: (v: number) => void
  gStart: string; setGStart: (v: string) => void
  preset: VestingPreset; setPreset: (v: VestingPreset) => void
  freq: VestingFrequency; setFreq: (v: VestingFrequency) => void
  totalM: number; setTotalM: (v: number) => void
  cliffM: number; setCliffM: (v: number) => void
  saveGrant: () => void; cancelGrant: () => void
  esppPct: number; setEsppPct: (v: number) => void
  esppDisc: number; setEsppDisc: (v: number) => void
  esppLock: number; setEsppLock: (v: number) => void
  esppLockEnd: string; setEsppLockEnd: (v: string) => void
  rrspPct: number; setRrspPct: (v: number) => void
  rrspCap: number; setRrspCap: (v: number) => void
  onSubmit: (e: React.FormEvent) => void
  total: number
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))
const cad = (v: number) => `$${Math.round(v).toLocaleString('en-CA')}`

/* ---------- one field grammar: label above, 48px box, two columns ---------- */
const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'
const inputCls = 'w-full min-w-0 bg-transparent text-text-primary text-[16px] font-medium'
const ctl = '!min-h-12 !rounded-xl'
const lab = 'text-[13px] font-medium text-text-secondary'

const Lab: React.FC<{ label: string; htmlFor?: string; hideLabel?: boolean; children: React.ReactNode }> = ({ label, htmlFor, hideLabel, children }) => (
  <div className="flex flex-col gap-1 min-w-0"><label htmlFor={htmlFor} className={hideLabel ? 'sr-only' : lab}>{label}</label>{children}</div>
)
const Num: React.FC<{ id: string; label: string; hideLabel?: boolean; value: number; onCommit: (v: number) => void; unit?: string; maxDecimals?: number; placeholder?: string }> = ({ id, label, hideLabel, value, onCommit, unit, maxDecimals, placeholder }) => (
  <Lab label={label} hideLabel={hideLabel} htmlFor={id}>
    <div className={box}>
      <NumberInput id={id} value={value} onCommit={onCommit} maxDecimals={maxDecimals} placeholder={placeholder} className={inputCls} />
      {unit && <span className="text-text-secondary shrink-0">{unit}</span>}
    </div>
  </Lab>
)
const Pair: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="grid grid-cols-2 gap-x-2 gap-y-3">{children}</div>

const Panel: React.FC<{ title?: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="themed-card rounded-2xl p-3 flex flex-col gap-3">
    {title && (
      <div className="flex items-center justify-between min-h-6">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">{title}</h3>{action}
      </div>
    )}
    {children}
  </section>
)

/* ---------- content blocks (shared by every layout) ---------- */
const StockFields: React.FC<{ s: CompensationFormMobileProps }> = ({ s }) => (
  <>
    <Pair>
      <Lab label="Ticker (Optional)" htmlFor="company-ticker-input">
        <div className={box}><input id="company-ticker-input" type="text" value={s.ticker} onChange={(e) => s.setTicker(e.target.value)} placeholder="e.g. AAPL" className={inputCls} /></div>
      </Lab>
      <Num id="company-price-input" label="Stock Price (USD)" value={s.price} onCommit={s.setPrice} unit="$" maxDecimals={3} />
    </Pair>
    {s.priceHint && <p className="text-[12px] text-text-secondary -mt-1">Pre-filled from the live {s.ticker.trim().toUpperCase() || 'ticker'} price, edit to override.</p>}
  </>
)

const SalaryPanel: React.FC<{ s: CompensationFormMobileProps }> = ({ s }) => (
  <Panel title="Salary & Bonus">
    <Pair>
      <Num id="base-salary-input" label="Current Base Salary ($)" value={s.base} onCommit={s.setBase} unit="$" />
      <Num id="cash-bonus-percent-input" label="Cash Bonus (%)" value={s.bonusPct} onCommit={s.setBonusPct} unit="%" />
    </Pair>
    <Lab label="Bonus Payout Month" htmlFor="cash-bonus-month-select">
      <ThemedSelect id="cash-bonus-month-select" className={ctl} value={s.bonusMonth} onChange={s.setBonusMonth} options={MONTH_OPTIONS} />
    </Lab>
  </Panel>
)

const ChangesPanel: React.FC<{ s: CompensationFormMobileProps }> = ({ s }) => (
  <Panel title="Past Salary Changes" action={<button type="button" onClick={s.addChange} className="flex items-center gap-1 min-h-9 pl-3 text-[14px] text-accent"><Plus size={14} />Add</button>}>
    {s.changes.length === 0 && <p className="text-[14px] text-text-secondary">None added.</p>}
    {s.changes.map((c, i) => (
      <div key={c.id} className="grid grid-cols-[1fr_1fr_44px] gap-x-2 items-end">
        <Num id={`past-salary-amount-${c.id}`} label="Previous Salary ($)" hideLabel={i > 0} value={c.salary} onCommit={(n) => s.setChange(c.id, 'salary', n)} unit="$" placeholder="Optional" />
        <Lab label="Change Month" hideLabel={i > 0} htmlFor={`past-salary-month-${c.id}`}>
          <ThemedSelect id={`past-salary-month-${c.id}`} ariaLabel="Change Month" className={ctl} value={String(c.changeMonth ?? '')} onChange={(v) => s.setChange(c.id, 'changeMonth', Number(v) || 0)} options={[{ value: '', label: 'None' }, ...MONTH_OPTIONS]} />
        </Lab>
        <button type="button" aria-label="Remove salary change" onClick={() => s.removeChange(c.id)} className="h-12 w-11 flex items-center justify-center rounded-xl border border-border text-text-secondary"><X size={16} /></button>
      </div>
    ))}
  </Panel>
)

const PRESETS: { id: VestingPreset; label: string }[] = [
  { id: '4yr-1yr-cliff', label: '4-Year, 1-Year Cliff' }, { id: '3yr-no-cliff', label: '3-Year, No Cliff' }, { id: 'custom', label: 'Custom' },
]
const GrantForm: React.FC<{ s: CompensationFormMobileProps }> = ({ s }) => (
  <div className="flex flex-col gap-3">
    <Pair>
      <Lab label="RSU Grant Name" htmlFor="rsu-grant-name-input">
        <div className={box}><input id="rsu-grant-name-input" type="text" value={s.gName} onChange={(e) => s.setGName(e.target.value)} className={inputCls} /></div>
      </Lab>
      <Num id="rsu-grant-shares-input" label="Number of Shares" value={s.gShares} onCommit={s.setGShares} />
      <Num id="rsu-grant-price-input" label="Grant Price (USD)" value={s.gPrice} onCommit={s.setGPrice} unit="$" maxDecimals={3} />
      <Lab label="Grant Start Date" htmlFor="rsu-grant-start-date"><ThemedDatePicker id="rsu-grant-start-date" value={s.gStart} onChange={s.setGStart} className={`${ctl} bg-bg-primary/50 border-border`} /></Lab>
    </Pair>
    <div role="group" aria-label="Vesting schedule" className="flex bg-bg-secondary border border-border rounded-xl p-1">
      {PRESETS.map((p) => (
        <button key={p.id} type="button" aria-pressed={s.preset === p.id} onClick={() => s.setPreset(p.id)}
          className={`flex-1 min-h-[44px] px-1 rounded-lg text-[12px] font-medium ${s.preset === p.id ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{p.label}</button>
      ))}
    </div>
    <Pair>
      {s.preset === 'custom' && (<>
        <Num id="rsu-total-months-input" label="Total Vest (Months)" value={s.totalM} onCommit={s.setTotalM} />
        <Num id="rsu-cliff-months-input" label="Cliff (Months)" value={s.cliffM} onCommit={s.setCliffM} />
      </>)}
      <Lab label="Frequency" htmlFor="rsu-frequency-select">
        <ThemedSelect id="rsu-frequency-select" className={ctl} value={s.freq} onChange={(v) => s.setFreq(v as VestingFrequency)} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }]} />
      </Lab>
      <div className="flex flex-col justify-end">
        <button type="button" onClick={s.saveGrant} className="h-12 rounded-xl border border-accent/40 bg-accent/10 text-[15px] font-medium text-accent">{s.editId ? 'Update Grant' : 'Add Grant'}</button>
      </div>
    </Pair>
    {s.editId && <button type="button" onClick={s.cancelGrant} className="min-h-11 rounded-xl border border-error/40 text-[14px] font-medium text-error">Cancel Edit</button>}
  </div>
)

const GrantsPanel: React.FC<{ s: CompensationFormMobileProps }> = ({ s }) => (
  <Panel title="Current Grants">
    {s.grants.length === 0 && <p className="text-[14px] text-text-secondary">No RSU grants yet.</p>}
    {s.grants.length > 0 && (
      <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {s.grants.map((g) => (
          <li key={g.id} className="flex items-center gap-1 pl-3 min-h-14 bg-bg-secondary">
            <span className="flex-1 min-w-0"><span className="block text-[15px] text-text-primary truncate">{g.grantName}</span><span className="block text-[12px] text-text-secondary">{g.grantShares.toLocaleString()} shares</span></span>
            <button type="button" aria-label={`Edit ${g.grantName}`} onClick={() => s.editGrant(g)} className="h-11 w-11 flex items-center justify-center text-accent"><Pencil size={16} /></button>
            <button type="button" aria-label={`Remove ${g.grantName}`} onClick={() => s.removeGrant(g.id)} className="h-11 w-11 flex items-center justify-center text-error"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    )}
  </Panel>
)

const BenefitPanels: React.FC<{ s: CompensationFormMobileProps }> = ({ s }) => (
  <>
    <Panel title="ESPP">
      <Pair>
        <Num id="espp-contribution-input" label="Contribution (%)" value={s.esppPct} onCommit={s.setEsppPct} unit="%" />
        <Num id="espp-discount-input" label="Discount (%)" value={s.esppDisc} onCommit={s.setEsppDisc} unit="%" />
        <Num id="espp-lockin-price-input" label="Lock-In Price (USD)" value={s.esppLock} onCommit={s.setEsppLock} unit="$" maxDecimals={3} />
        <Lab label="Lock-In End Date" htmlFor="espp-lockin-end-date"><ThemedDatePicker id="espp-lockin-end-date" value={s.esppLockEnd} onChange={s.setEsppLockEnd} className={`${ctl} bg-bg-primary/50 border-border`} /></Lab>
      </Pair>
    </Panel>
    <Panel title="RRSP Match">
      <Pair>
        <Num id="rrsp-match-percent-input" label="Match (%)" value={s.rrspPct} onCommit={s.setRrspPct} unit="%" />
        <Num id="rrsp-match-cap-input" label="Match Cap ($)" value={s.rrspCap} onCommit={s.setRrspCap} unit="$" />
      </Pair>
    </Panel>
  </>
)

type Tab = 'base' | 'equity' | 'benefits'
const TAB_LABEL: Record<Tab, string> = { base: 'Base & Cash', equity: 'Equity', benefits: 'Benefits' }
const TAB_IDS: Tab[] = ['base', 'equity', 'benefits']

/** Equity tab: the grants list, then the add/edit form, each in its own card. */
const EquityBody: React.FC<{ s: CompensationFormMobileProps }> = ({ s }) => (
  <>
    <GrantsPanel s={s} />
    <Panel title={s.editId ? 'Edit RSU Grant' : 'Add RSU Grant'}><GrantForm s={s} /></Panel>
  </>
)
const TabBody: React.FC<{ s: CompensationFormMobileProps; tab: Tab }> = ({ s, tab }) => (
  tab === 'base' ? <><SalaryPanel s={s} /><ChangesPanel s={s} /></> : tab === 'equity' ? <EquityBody s={s} /> : <BenefitPanels s={s} />
)

const SaveBtn: React.FC = () => (
  <button type="submit" className="w-full h-12 rounded-xl bg-accent text-bg-primary text-[15px] font-semibold shadow-lg shadow-black/40">Save Compensation Package</button>
)
const SaveBar: React.FC = () => <div className="sticky bottom-3 pt-2"><SaveBtn /></div>

const SegTabs: React.FC<{ value: Tab; onChange: (t: Tab) => void }> = ({ value, onChange }) => (
  <div role="group" aria-label="Package sections" className="flex bg-bg-secondary border border-border rounded-xl p-1">
    {TAB_IDS.map((id) => (
      <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}
        className={`flex-1 min-h-[44px] rounded-lg text-[14px] font-medium ${value === id ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{TAB_LABEL[id]}</button>
    ))}
  </div>
)

/** Phone Edit Compensation Package: one package card with the live total and the stock fields, then
 *  Base & Cash, Equity and Benefits as segmented tabs, each topic in its own card, Save always pinned. */
export const CompensationFormMobile: React.FC<CompensationFormMobileProps> = (s) => {
  const [tab, setTab] = useState<Tab>('base')
  return (
    <form onSubmit={s.onSubmit} className="flex flex-col gap-3">
      <section className="rounded-2xl border border-accent/50 bg-accent/10 p-3 flex flex-col gap-3">
        <div>
          <p className="text-[12px] text-text-secondary">Total Annual Compensation</p>
          <p data-key-figure className="text-[28px] leading-tight font-semibold text-text-primary tabular-nums">{cad(s.total)}</p>
        </div>
        <StockFields s={s} />
      </section>
      <SegTabs value={tab} onChange={setTab} />
      <TabBody s={s} tab={tab} />
      <SaveBar />
    </form>
  )
}
