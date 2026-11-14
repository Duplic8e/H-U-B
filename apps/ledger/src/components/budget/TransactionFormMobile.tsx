import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { NumberInput } from '../ui/NumberInput'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { formatMoney, formatMoneyWithCents } from '../planner/format'
import type { TransactionEntryKind } from '../../utils/budget/transactionKinds'
import type { TransactionSplit } from '../../types/budget'

/** Everything the phone form shows and changes. TransactionForm owns the state and the
 *  save logic, so this layout and the desktop one cannot disagree about either. */
export interface TransactionFormMobileProps {
  editing: boolean
  type: TransactionEntryKind
  onTypeChange: (kind: TransactionEntryKind) => void
  showRefundOption: boolean
  validationError: string | null
  /** The Refunds & Payments explanation and settlement checkbox, or null. */
  notice: React.ReactNode
  amount: number
  onAmountCommit: (value: number) => void
  onAmountText: (text: string) => void
  amountError: string | null
  /** The "use Refunds & Payments for money received" line, or null. */
  amountHint: React.ReactNode
  isShared: boolean
  onSharedChange: (on: boolean) => void
  totalPaid: number
  onTotalPaidChange: (value: number) => void
  onSharePreset: (fraction: number) => void
  sharedWith: string
  onSharedWithChange: (value: string) => void
  sharedError: string | null
  isReimbursement: boolean
  onReimbursementChange: (on: boolean) => void
  reimbursementFrom: string
  onReimbursementFromChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  categoryOptions: { value: string; label: string }[]
  isSplit: boolean
  onSplitChange: (on: boolean) => void
  splits: TransactionSplit[]
  onSplitsChange: (update: (current: TransactionSplit[]) => TransactionSplit[]) => void
  remaining: number
  allocationInvalid: boolean
  tagsText: string
  onTagsChange: (value: string) => void
  note: string
  onNoteChange: (value: string) => void
  date: string
  onDateChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  /** The <datalist> of people already used on shared bills. */
  peopleList: React.ReactNode
  onSubmit: (e: React.FormEvent) => void
  onDelete: () => void
}

const lab = 'text-[13px] font-medium text-text-secondary'
const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'
const inputCls = 'w-full min-w-0 bg-transparent text-text-primary text-[16px] font-medium'
const ctl = '!min-h-12 !rounded-xl'

const Lab: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div className="flex flex-col gap-1 min-w-0"><label htmlFor={htmlFor} className={lab}>{label}</label>{children}</div>
)

const Switch: React.FC<{ on: boolean; label: string; onChange: (on: boolean) => void }> = ({ on, label, onChange }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={`shrink-0 h-7 w-12 rounded-full border border-border p-0.5 transition-colors ${on ? 'bg-accent' : 'bg-bg-primary'}`}>
    <span className={`block h-[22px] w-[22px] rounded-full bg-text-primary transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
)

const SwitchRow: React.FC<{ label: string; on: boolean; onChange: (on: boolean) => void }> = ({ label, on, onChange }) => (
  <div className="flex items-center gap-3 min-h-11"><span className="flex-1 text-[15px] font-medium text-text-primary">{label}</span><Switch on={on} label={label} onChange={onChange} /></div>
)

const Tint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-[13px] text-accent text-center">{children}</p>
)

const TypeSeg: React.FC<TransactionFormMobileProps> = ({ type, onTypeChange, showRefundOption }) => (
  <div className="flex flex-col gap-2">
    <div role="group" aria-label="Type" className="flex bg-bg-secondary border border-border rounded-xl p-1">
      {([['expense', 'Expense'], ['income', 'Income']] as const).map(([kind, label]) => (
        <button key={kind} type="button" aria-pressed={type === kind} onClick={() => onTypeChange(kind)}
          className={`flex-1 min-h-[44px] rounded-lg text-[14px] font-medium ${type === kind ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{label}</button>
      ))}
    </div>
    {showRefundOption && (
      <button type="button" aria-pressed={type === 'refund-payment'} onClick={() => onTypeChange('refund-payment')}
        className={`min-h-[44px] rounded-xl border border-border text-[14px] font-medium ${type === 'refund-payment' ? 'bg-bg-primary text-accent' : 'bg-bg-secondary text-text-secondary'}`}>Refunds &amp; Payments</button>
    )}
  </div>
)

const SharedCard: React.FC<TransactionFormMobileProps> = (p) => {
  if (p.type === 'income') {
    return (
      <div className="flex flex-col gap-3">
        <SwitchRow label="Reimbursement for a shared bill (not income)" on={p.isReimbursement} onChange={p.onReimbursementChange} />
        {p.isReimbursement && (
          <div className={box}>
            <input type="text" list="shared-people" aria-label="Who paid you back?" value={p.reimbursementFrom} onChange={(e) => p.onReimbursementFromChange(e.target.value)}
              placeholder="Who paid you back?" className={inputCls} />
          </div>
        )}
      </div>
    )
  }
  const owed = Math.max(0, p.totalPaid - p.amount)
  return (
    <div className="flex flex-col gap-3">
      <SwitchRow label="Paid for Others" on={p.isShared} onChange={p.onSharedChange} />
      {p.isShared && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Lab label="Total Paid" htmlFor="tx-total-paid">
              <div className={box}>
                <span className="text-[14px] text-text-secondary">$</span>
                <NumberInput id="tx-total-paid" value={p.totalPaid} onCommit={p.onTotalPaidChange} min={0} className={inputCls} />
              </div>
            </Lab>
            <Lab label="Shared With" htmlFor="tx-shared-with">
              <div className={box}>
                <input id="tx-shared-with" type="text" list="shared-people" value={p.sharedWith} onChange={(e) => p.onSharedWithChange(e.target.value)}
                  placeholder="e.g. Alex" className={inputCls} />
              </div>
            </Lab>
          </div>
          <div className="flex flex-col gap-1">
            <span className={lab}>My Share</span>
            <div role="group" aria-label="My share" className="flex bg-bg-secondary border border-border rounded-xl p-1">
              {([['50%', 0.5], ['33%', 1 / 3], ['25%', 0.25]] as const).map(([label, fraction]) => (
                <button key={label} type="button" disabled={p.totalPaid <= 0} onClick={() => p.onSharePreset(fraction)}
                  className="flex-1 min-h-[44px] rounded-lg text-[13px] font-medium text-text-secondary disabled:opacity-40">{label}</button>
              ))}
            </div>
          </div>
          <Tint>{formatMoney(owed)} Owed to You</Tint>
          {p.sharedError && <p id="tx-shared-error" role="alert" className="text-[12px] text-error">{p.sharedError}</p>}
        </>
      )}
    </div>
  )
}

const SplitCard: React.FC<TransactionFormMobileProps> = (p) => {
  const update = (i: number, patch: Partial<TransactionSplit>) => p.onSplitsChange((cur) => cur.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const category = p.categoryOptions.find((o) => o.value === p.category)?.label ?? 'the Category'
  return (
    <div className="flex flex-col gap-3">
      <SwitchRow label="Split Across Categories" on={p.isSplit} onChange={p.onSplitChange} />
      {p.isSplit && (
        <>
          {p.splits.map((s, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <ThemedSelect ariaLabel="Slice category" value={s.categoryId ?? ''} className={ctl} options={p.categoryOptions}
                  onChange={(v) => update(i, { categoryId: v })} />
              </div>
              <div className={`${box} w-28`}>
                <NumberInput id={`tx-split-amount-${i}`} value={s.amount} ariaLabel="Slice amount" placeholder="0.00" className={inputCls}
                  onTextChange={(text) => { if (Number.isNaN(parseFloat(text))) update(i, { amount: 0 }) }}
                  onCommit={(v) => update(i, { amount: v })} />
              </div>
              <button type="button" aria-label="Remove slice" onClick={() => p.onSplitsChange((cur) => cur.filter((_, j) => j !== i))}
                className="h-12 w-11 shrink-0 flex items-center justify-center text-text-secondary"><X className="w-4 h-4" aria-hidden="true" /></button>
            </div>
          ))}
          <button type="button" onClick={() => p.onSplitsChange((cur) => [...cur, { categoryId: '', amount: 0 }])}
            className="self-start min-h-11 px-3 rounded-xl border border-border text-[13px] text-accent flex items-center gap-1"><Plus className="w-4 h-4" aria-hidden="true" />Add a Slice</button>
          {p.allocationInvalid
            ? <p className="text-[12px] text-text-secondary text-center">Enter valid amounts to see the allocation remainder.</p>
            : p.remaining < 0
              ? <p className="text-[13px] text-error text-center">Slices exceed the amount by {formatMoney(Math.abs(p.remaining))}.</p>
              : p.remaining > 0
                ? <Tint>{formatMoneyWithCents(p.remaining)} left to allocate, which stays on {category}.</Tint>
                : <Tint>Fully allocated.</Tint>}
        </>
      )}
    </div>
  )
}

const TagsNoteCard: React.FC<TransactionFormMobileProps> = (p) => (
  <div className="flex flex-col gap-3">
    <Lab label="Tags" htmlFor="tx-tags">
      <div className={box}>
        <input id="tx-tags" type="text" value={p.tagsText} onChange={(e) => p.onTagsChange(e.target.value)} placeholder="trip, reimbursable" className={inputCls} />
      </div>
    </Lab>
    <Lab label="Note" htmlFor="tx-note">
      <textarea id="tx-note" rows={2} value={p.note} onChange={(e) => p.onNoteChange(e.target.value)} placeholder="Anything to remember"
        className="w-full bg-bg-primary/50 border border-border rounded-xl px-3 py-3 text-[16px] text-text-primary focus:border-accent" />
    </Lab>
  </div>
)

type DetailsTab = 'shared' | 'split' | 'tags'

/** Phone Add or Edit Transaction: the type, then Amount and Date, Category and Description,
 *  then a Details switch that opens one extra card at a time, with the save button pinned
 *  at the bottom. */
export const TransactionFormMobile: React.FC<TransactionFormMobileProps> = (p) => {
  const [tab, setTab] = useState<DetailsTab | null>(null)
  const tabs: [DetailsTab, string][] = [
    ...(p.type === 'refund-payment' ? [] : [['shared', p.type === 'income' ? 'Reimbursement' : 'Shared Bill'] as [DetailsTab, string]]),
    ['split', 'Split'],
    ['tags', 'Tags & Note'],
  ]
  // Switching to Refunds & Payments removes the Shared Bill tab, so a stale selection shows nothing.
  const shown = tabs.some(([k]) => k === tab) ? tab : null
  return (
    <form onSubmit={p.onSubmit} className="p-4 flex flex-col gap-4">
      <TypeSeg {...p} />
      {p.validationError && <p role="alert" className="text-[12px] text-error">{p.validationError}</p>}
      {p.notice}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor="tx-amount" className={lab}>{p.type === 'expense' && p.isShared ? 'Your share' : 'Amount'}</label>
          <div className={`${box} ${p.amountError ? '!border-error' : ''}`}>
            <span className="text-[14px] text-text-secondary">$</span>
            <NumberInput id="tx-amount" value={p.amount} onTextChange={p.onAmountText} onCommit={p.onAmountCommit}
              aria-invalid={p.amountError ? 'true' : 'false'} aria-describedby={p.amountError ? 'tx-amount-error' : undefined}
              placeholder="0.00" className={inputCls} />
          </div>
        </div>
        <Lab label="Date"><ThemedDatePicker value={p.date} onChange={p.onDateChange} className={`${ctl} bg-bg-primary/50 border-border`} /></Lab>
      </div>
      {p.amountHint}
      {p.amountError && <p id="tx-amount-error" role="alert" className="text-[12px] text-error -mt-2">{p.amountError}</p>}
      <Lab label="Category"><ThemedSelect ariaLabel="Category" value={p.category} onChange={p.onCategoryChange} className={ctl} options={p.categoryOptions} /></Lab>
      <Lab label="Description (Optional)" htmlFor="tx-description">
        <div className={box}>
          <input id="tx-description" type="text" value={p.description} onChange={(e) => p.onDescriptionChange(e.target.value)} placeholder="e.g. Groceries" className={inputCls} />
        </div>
      </Lab>

      <div className="flex flex-col gap-2">
        <p className={lab}>Details</p>
        <div role="group" aria-label="Details" className="flex bg-bg-secondary border border-border rounded-xl p-1">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={shown === key} onClick={() => setTab(shown === key ? null : key)}
              className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium px-1 ${shown === key ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{label}</button>
          ))}
        </div>
        {shown === 'shared' && <div className="themed-card rounded-2xl p-4"><SharedCard {...p} /></div>}
        {shown === 'split' && <div className="themed-card rounded-2xl p-4"><SplitCard {...p} /></div>}
        {shown === 'tags' && <div className="themed-card rounded-2xl p-4"><TagsNoteCard {...p} /></div>}
      </div>
      {p.peopleList}

      <div className="sticky bottom-3 flex gap-2">
        {p.editing && (
          <button type="button" onClick={p.onDelete}
            className="min-h-12 px-4 rounded-xl bg-bg-secondary border border-error/40 text-error text-[15px] font-medium shadow-lg shadow-black/40">Delete</button>
        )}
        <button type="submit" className="flex-1 min-h-12 rounded-xl bg-accent text-bg-primary text-[15px] font-semibold shadow-lg shadow-black/40">
          {p.editing ? 'Save Changes' : 'Add Transaction'}
        </button>
      </div>
    </form>
  )
}
