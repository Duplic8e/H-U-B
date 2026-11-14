import React from 'react'
import { NumberInput } from '../ui/NumberInput'
import { formatMoney } from './format'
import type { RaiseInflationState, VerdictTone } from './useRaiseInflation'

const lab = 'text-[13px] font-medium text-text-secondary'
const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'

const TONE: Record<VerdictTone, { card: string; text: string }> = {
  raise: { card: 'border-accent/50 bg-accent/10', text: 'text-accent' },
  lost: { card: 'border-error/50 bg-error/10', text: 'text-error' },
  wash: { card: 'border-border bg-bg-secondary', text: 'text-text-secondary' },
}

interface FieldProps { id: string; label: string; prefix?: string; suffix?: string; value: number; onChange: (v: number) => void }
const Field: React.FC<FieldProps> = (f) => (
  <div className="flex flex-col gap-1 min-w-0">
    <label htmlFor={f.id} className={lab}>{f.label}</label>
    <div className={box}>
      {f.prefix && <span className="text-[14px] text-text-secondary shrink-0">{f.prefix}</span>}
      <NumberInput id={f.id} className="w-full min-w-0 bg-transparent text-text-primary text-[16px] font-medium" value={f.value} min={0} onCommit={f.onChange} />
      {f.suffix && <span className="text-[14px] text-text-secondary shrink-0">{f.suffix}</span>}
    </div>
  </div>
)

/** Phone layout of Raise vs Inflation: the short form first, then one result card holding the verdict. */
export const RaiseInflationMobile: React.FC<{ s: RaiseInflationState }> = ({ s }) => {
  const { inputs, set, nominal, real, realDollars, tone, verdict } = s
  const t = TONE[tone]
  return (
    <div data-testid="raise-inflation-mobile" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field id="raise-old" label="Old Salary" prefix="$" value={inputs.oldSalary} onChange={set('oldSalary')} />
        <Field id="raise-new" label="New Salary" prefix="$" value={inputs.newSalary} onChange={set('newSalary')} />
      </div>
      <Field id="raise-inflation" label="Inflation" suffix="%" value={inputs.inflationPct} onChange={set('inflationPct')} />
      <div role="status" className={`rounded-2xl border p-4 flex flex-col gap-3 ${t.card}`}>
        <div>
          <p className="text-[13px] text-text-secondary">Real Raise</p>
          <p className={`text-[30px] font-semibold leading-tight ${t.text}`}>{real.toFixed(2)}%</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-[12px] text-text-secondary">Nominal Raise</p><p className="text-[16px] font-semibold tabular-nums">{nominal.toFixed(2)}%</p></div>
          <div><p className="text-[12px] text-text-secondary">Real Change</p><p className="text-[16px] font-semibold tabular-nums">{formatMoney(realDollars)}</p></div>
        </div>
        <p className="text-[13px] text-text-primary">{verdict}</p>
      </div>
    </div>
  )
}
