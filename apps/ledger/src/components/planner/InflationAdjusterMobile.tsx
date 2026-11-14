import React from 'react'
import { NumberInput } from '../ui/NumberInput'
import { formatMoney } from './format'
import { INFLATION_TOOL_ID, type InflationAdjusterState } from './useInflationAdjuster'

const YEAR_PRESETS = [5, 10, 20, 30]
const lab = 'text-[13px] font-medium text-text-secondary'
const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'

interface FieldProps { id: string; label: string; prefix?: string; suffix?: string; value: number; onChange: (v: number) => void; max?: number }
const Field: React.FC<FieldProps> = (f) => (
  <div className="flex flex-col gap-1 min-w-0">
    <label htmlFor={f.id} className={lab}>{f.label}</label>
    <div className={box}>
      {f.prefix && <span className="text-[14px] text-text-secondary shrink-0">{f.prefix}</span>}
      <NumberInput id={f.id} className="w-full min-w-0 bg-transparent text-text-primary text-[16px] font-medium" value={f.value} min={0} max={f.max} onCommit={f.onChange} />
      {f.suffix && <span className="text-[14px] text-text-secondary shrink-0">{f.suffix}</span>}
    </div>
  </div>
)

/** Phone layout of the inflation adjuster: the converted amount, a purchasing power bar, then year presets and inputs. */
export const InflationAdjusterMobile: React.FC<{ s: InflationAdjusterState }> = ({ s }) => {
  const { inputs, setInput, set, toFuture, converted, powerChange } = s
  const heroLabel = toFuture ? `Cost in ${inputs.years} Years` : "Worth in Today's Dollars"
  const powerLabel = `Purchasing Power Change Over ${inputs.years} Years`
  const left = Math.max(0, Math.min(100, 100 + powerChange))

  return (
    <div data-testid="inflation-adjuster-mobile" className="flex flex-col gap-4">
      <div role="group" aria-label="Direction" className="flex bg-bg-secondary border border-border rounded-xl p-1">
        {[{ value: 'future', label: "Today's $ → Future Cost" }, { value: 'present', label: "Future $ → Today's Value" }].map((o) => (
          <button key={o.value} aria-pressed={inputs.direction === o.value || (o.value === 'future' && toFuture)} onClick={() => setInput(INFLATION_TOOL_ID, 'direction', o.value)}
            className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium px-1 ${(o.value === 'future') === toFuture ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{o.label}</button>
        ))}
      </div>

      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4" role="status" aria-live="polite">
        <p className="text-[13px] text-text-secondary">{heroLabel}</p>
        <p className="text-[30px] font-semibold text-accent leading-tight">{formatMoney(converted)}</p>
      </div>

      <div className="rounded-2xl border border-border bg-bg-secondary p-3 flex flex-col gap-2">
        <div className="flex justify-between gap-2 text-[13px]"><span className="text-text-secondary">{powerLabel}</span><span className="font-semibold tabular-nums">{powerChange.toFixed(1)}%</span></div>
        <div className="h-3 rounded-full bg-bg-primary/60 overflow-hidden" role="progressbar" aria-valuenow={Math.round(left)} aria-valuemin={0} aria-valuemax={100} aria-label="Purchasing power remaining">
          <div className="h-full rounded-full bg-accent" style={{ width: `${left}%` }} />
        </div>
        <p className="text-[12px] text-text-secondary">A dollar buys about {(left / 100).toFixed(2)} of what it does today</p>
      </div>

      <Field id="inflation-amount" label={toFuture ? 'Amount Today' : 'Future Amount'} prefix="$" value={inputs.amount} onChange={set('amount')} />

      <div role="group" aria-label="Years presets" className="flex bg-bg-secondary border border-border rounded-xl p-1">
        {YEAR_PRESETS.map((y) => (
          <button key={y} aria-pressed={inputs.years === y} onClick={() => setInput(INFLATION_TOOL_ID, 'years', y)}
            className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium ${inputs.years === y ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{y} yrs</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="inflation-years" label="Years" suffix="yrs" max={80} value={inputs.years} onChange={set('years')} />
        <Field id="inflation-rate" label="Annual Inflation" suffix="%" value={inputs.inflationPct} onChange={set('inflationPct')} />
      </div>
    </div>
  )
}
