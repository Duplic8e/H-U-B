import React, { useState } from 'react'
import { CalendarRange, Check } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import type { PeriodChoice } from './periodChoices'

/** Phone time period control: a 44px calendar button that opens a sheet listing the periods. */
export const TimePeriodButton: React.FC<{ choices: PeriodChoice[]; value: string; onChange: (value: string) => void }> = ({ choices, value, onChange }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="Time Period"
        aria-haspopup="listbox"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:text-accent transition-colors duration-200"
      >
        <CalendarRange size={20} aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} desktop="modal" ariaLabel="Time Period" title="Time Period" panelClassName="w-full">
        <div role="listbox" aria-label="Time Period" className="flex flex-col p-2">
          {choices.map((c) => (
            <button
              key={c.value}
              type="button"
              role="option"
              aria-selected={c.value === value}
              onClick={() => { onChange(c.value); setOpen(false) }}
              className={`flex min-h-12 items-center justify-between gap-2 rounded-lg px-3 text-left text-[15px] ${c.value === value ? 'text-accent' : 'text-text-primary'}`}
            >
              <span>{c.label}</span>
              {c.value === value && <Check className="h-4 w-4" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}
