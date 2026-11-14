import React from 'react'
import type { Category } from '../../types/budget'
import { billSettingOf, type BillSetting } from '../../utils/budget/bills'

const OPTIONS: { id: BillSetting; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'bill', label: 'Bill' },
  { id: 'everyday', label: 'Everyday' },
]

/** Auto, Bill or Everyday for a category. A bill is one payment and is judged as Due, Paid or Over Budget; Everyday
 *  spending is judged by pace. Auto picks Bill when nearly all of the category is monthly recurring payments. */
export const BillToggle: React.FC<{
  category: Category
  /** Whether Auto currently resolves to Bill, shown on the Auto button so the choice is not a black box. */
  detected: boolean
  onChange: (setting: BillSetting) => void
  /** 44px buttons for a phone. */
  large?: boolean
}> = ({ category, detected, onChange, large }) => {
  const current = billSettingOf(category)
  return (
    <div
      role="group"
      aria-label={`${category.name} payment type`}
      title="Bill: judged as Due, Paid or Over Budget instead of by pace. Auto picks Bill when nearly all of the category is monthly recurring payments."
      className={`flex shrink-0 overflow-hidden border border-border ${large ? 'rounded-lg' : 'rounded'}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-label={`${category.name} payment ${o.label}`}
          aria-pressed={current === o.id}
          onClick={() => onChange(o.id)}
          className={`${large ? 'px-3 min-h-[44px] text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent' : 'px-1.5 py-0.5 text-meta transition-colors'} ${
            current === o.id ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {o.id === 'auto' && detected ? 'Auto · Bill' : o.label}
        </button>
      ))}
    </div>
  )
}
