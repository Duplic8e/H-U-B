import React, { useState } from 'react'
import { ArrowLeftRight, ChevronDown, RefreshCw } from 'lucide-react'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { NumberInput } from '../ui/NumberInput'
import { CURRENCY_OPTIONS, formatAmount, type CurrencyConverterState } from './useCurrencyConverter'

const label = 'text-[13px] font-medium text-text-secondary'
const box = 'flex items-center bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'
const iconBtn = 'h-11 w-11 shrink-0 flex items-center justify-center rounded-full border border-border bg-bg-secondary text-text-secondary active:text-accent'

type C = CurrencyConverterState

const Pick: React.FC<{ c: C; which: 'from' | 'to' }> = ({ c, which }) => (
  <ThemedSelect
    value={which === 'from' ? c.from : c.to}
    options={CURRENCY_OPTIONS}
    onChange={(v) => c.set(which, v)}
    ariaLabel={which === 'from' ? 'From' : 'To'}
    className="!min-h-12 !rounded-xl"
  />
)

// The rate's source is a footnote, so it reads as one line next to the title: the
// time the rate was fetched, without seconds.
function sourceNote(c: C): string {
  if (c.override !== undefined) return 'manual override'
  if (!c.fx.data) return c.fx.status
  const stamp = new Date(c.fx.data.asOf).toLocaleString(undefined, {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  return `${c.fx.data.stale ? 'Stale' : 'Live'}, as of ${stamp}`
}

// Rate source and manual override sit behind one disclosure so the main screen stays short.
const RateDetails: React.FC<{ c: C }> = ({ c }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-bg-secondary">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full min-h-12 px-3 flex items-center gap-2 text-left">
        <span className="flex-1 min-w-0 text-[14px] font-medium truncate">
          Rate Details<span className="font-normal text-text-secondary"> ({sourceNote(c)})</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className={`text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border pt-3">
          <span className={label}>Manual Rate Override</span>
          <div className="flex items-center gap-2">
            <div className={`${box} flex-1 min-w-0`}>
              <NumberInput
                ariaLabel="Manual rate override"
                className="w-full bg-transparent text-[15px] text-text-primary"
                value={c.override ?? 0}
                placeholder={c.fx.data?.value.rate.toFixed(4) ?? ''}
                onCommit={(v) => { if (v > 0) c.setOverride(v) }}
              />
            </div>
            {c.override !== undefined && (
              <button onClick={c.clearOverride} className="min-h-12 px-3 rounded-xl border border-border text-[13px] text-accent">Use Live</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Phone layout of the converter: the answer first, then one card for the inputs. */
export const CurrencyConverterMobile: React.FC<{ c: C }> = ({ c }) => {
  const result = c.converted !== undefined
    ? formatAmount(c.converted, c.to)
    : c.fx.status === 'error' ? 'Unavailable, set a manual rate' : '…'
  return (
    <div data-testid="currency-converter-mobile" className="flex flex-col gap-4">
      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0" role="status" aria-live="polite">
          <p className="text-[13px] text-text-secondary">{c.inputs.amount} {c.from} is</p>
          <p className="text-[28px] font-semibold text-accent mt-1 break-words leading-tight">{result}</p>
          <p className="text-[13px] text-text-secondary mt-2 tabular-nums">
            1 {c.from} = {c.rate !== undefined ? c.rate.toFixed(4) : '…'} {c.to}
          </p>
        </div>
        <button onClick={() => c.fx.refresh()} aria-label="Refresh rate" className={iconBtn}>
          <RefreshCw size={16} className={c.fx.status === 'loading' ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-bg-secondary p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="converter-amount" className={label}>Amount</label>
          <div className={box}>
            <NumberInput
              id="converter-amount"
              className="w-full bg-transparent text-text-primary text-[18px] font-medium"
              value={c.inputs.amount}
              min={0}
              onCommit={(v) => c.set('amount', v)}
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <Pick c={c} which="from" />
          <button onClick={c.swap} aria-label="Swap currencies" className={iconBtn}><ArrowLeftRight size={16} /></button>
          <Pick c={c} which="to" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className={label}>Rate Date (Optional)</span>
          <ThemedDatePicker value={c.inputs.date as string} onChange={(v) => c.set('date', v)} />
          {!c.historicalSupported && !!c.inputs.date && (
            <span className="text-[12px] text-text-secondary">Historical rates are unavailable for BDT, so the latest rate is shown.</span>
          )}
        </div>
      </div>
      <RateDetails c={c} />
    </div>
  )
}
