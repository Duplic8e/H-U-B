import React, { useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { InfoButton } from '../ui/InfoButton'
import type { BudgetCadence, Category } from '../../types/budget'
import { billSettingOf, type BillSetting } from '../../utils/budget/bills'
import { cadenceOf } from '../../utils/budget/cadence'

const PAYMENTS: { id: BillSetting; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'bill', label: 'Bill' },
  { id: 'everyday', label: 'Everyday' },
]
const COVERS: { id: BudgetCadence; label: string; aria: string }[] = [
  { id: 'monthly', label: 'One Month', aria: 'monthly' },
  { id: 'annual', label: 'One Year', aria: 'annually' },
]

const Segmented: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div role="group" aria-label={label} className="flex bg-bg-secondary border border-border rounded-xl p-1">{children}</div>
)
const segment = (on: boolean) => `flex-1 min-h-11 rounded-lg text-[14px] font-medium ${on ? 'bg-accent/15 text-accent' : 'text-text-secondary'}`

/** Phone Setup: a 44px "..." button that opens a category's options. Target Covers says whether the target is for a
 *  month or a year; Payment says whether the spending is a Bill (one payment, judged Due, Paid or Over Budget) or
 *  Everyday (spread out, judged by pace). What each choice means sits behind the info button after Payment. */
export const CategoryOptionsButton: React.FC<{
  category: Category
  /** Whether Auto currently finds this category to be a bill. */
  detected: boolean
  onPayment: (setting: BillSetting) => void
  onCadence: (cadence: BudgetCadence) => void
}> = ({ category, detected, onPayment, onCadence }) => {
  const [open, setOpen] = useState(false)
  const payment = billSettingOf(category)
  const cadence = cadenceOf(category)
  return (
    <>
      <button type="button" aria-label={`${category.name} options`} onClick={() => setOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary">
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} desktop="modal" ariaLabel={`${category.name} options`} title={`${category.name} Options`} panelClassName="w-full">
        <div className="flex flex-col gap-5 p-4">
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-text-secondary">Target Covers</div>
            <Segmented label="Target covers">
              {COVERS.map((c) => (
                <button key={c.id} type="button" aria-label={`Budget ${category.name} ${c.aria}`} aria-pressed={cadence === c.id} onClick={() => onCadence(c.id)} className={segment(cadence === c.id)}>{c.label}</button>
              ))}
            </Segmented>
          </div>
          <div>
            <div className="mb-1.5 flex items-center text-[13px] font-medium text-text-secondary">
              Payment
              <InfoButton label="About Payment" inline>
                <p><strong>Auto</strong> becomes a Bill when nearly all of it is monthly recurring payments. Right now it is {detected ? 'a Bill' : 'Everyday'}.</p>
                <p className="mt-2"><strong>Bill</strong> is one payment, shown as Due, Paid or Over Budget instead of Over Pace.</p>
                <p className="mt-2"><strong>Everyday</strong> is spread across the month and judged by pace.</p>
              </InfoButton>
            </div>
            <Segmented label={`${category.name} payment type`}>
              {PAYMENTS.map((o) => (
                <button key={o.id} type="button" aria-label={`${category.name} payment ${o.label}`} aria-pressed={payment === o.id} onClick={() => onPayment(o.id)} className={segment(payment === o.id)}>{o.label}</button>
              ))}
            </Segmented>
          </div>
        </div>
      </Sheet>
    </>
  )
}
