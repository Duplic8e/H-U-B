import React from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { NumberInput } from '../ui/NumberInput'
import { ThemedSelect } from '../ui/ThemedSelect'
import { RATE_FREQUENCIES, RATE_TOOL_ID, type RateConverterState } from './useRateConverter'

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

/** Phone layout of the rate converter: mode toggle, a From/To row with a swap button, the inputs, then the result. */
export const RateConverterMobile: React.FC<{ s: RateConverterState }> = ({ s }) => {
  const { inputs, setInput, set, isCagr, aprToApyDir: fwd, converted, periodic, cagr, total } = s
  const pct4 = (x: number) => `${x.toFixed(4)}%`
  const hero = isCagr
    ? { label: 'Annualized Return (CAGR)', value: cagr === null ? 'n/a' : `${cagr.toFixed(2)}%`, l2: 'Total Return', v2: total === null ? 'n/a' : `${total.toFixed(2)}%` }
    : { label: fwd ? 'Effective Annual Rate (APY)' : 'Nominal Rate (APR)', value: pct4(converted), l2: 'Rate per Period', v2: pct4(periodic) }

  return (
    <div data-testid="rate-converter-mobile" className="flex flex-col gap-4">
      <div role="group" aria-label="Mode" className="flex bg-bg-secondary border border-border rounded-xl p-1">
        {[{ value: 'apr-apy', label: 'APR ⇄ APY' }, { value: 'cagr', label: 'Annualized Return (CAGR)' }].map((o) => (
          <button key={o.value} aria-pressed={inputs.mode === o.value} onClick={() => setInput(RATE_TOOL_ID, 'mode', o.value)}
            className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium px-1 ${inputs.mode === o.value ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{o.label}</button>
        ))}
      </div>

      {!isCagr && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="flex flex-col gap-1"><span className={lab}>From</span><div className={`${box} text-[16px] font-medium`}>{fwd ? 'APR' : 'APY'}</div></div>
          <button aria-label="Swap direction" onClick={() => setInput(RATE_TOOL_ID, 'direction', fwd ? 'apy-to-apr' : 'apr-to-apy')}
            className="h-12 w-12 rounded-full border border-border flex items-center justify-center text-accent"><ArrowLeftRight className="w-4 h-4" aria-hidden="true" /></button>
          <div className="flex flex-col gap-1"><span className={lab}>To</span><div className={`${box} text-[16px] font-medium`}>{fwd ? 'APY' : 'APR'}</div></div>
        </div>
      )}

      {isCagr ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field id="rate-start" label="Starting Value" prefix="$" value={inputs.startValue} onChange={set('startValue')} />
            <Field id="rate-end" label="Ending Value" prefix="$" value={inputs.endValue} onChange={set('endValue')} />
          </div>
          <Field id="rate-years" label="Years" suffix="yrs" max={80} value={inputs.years} onChange={set('years')} />
        </>
      ) : (
        <>
          <Field id="rate-rate" label={fwd ? 'APR' : 'APY'} suffix="%" value={inputs.ratePct} onChange={set('ratePct')} />
          <div className="flex flex-col gap-1"><span className={lab}>Compounding</span>
            <ThemedSelect ariaLabel="Compounding" value={String(inputs.periodsPerYear)} className="!min-h-12 !rounded-xl" options={RATE_FREQUENCIES}
              onChange={(x) => setInput(RATE_TOOL_ID, 'periodsPerYear', Number(x))} /></div>
        </>
      )}

      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4" role="status" aria-live="polite">
        <p className="text-[13px] text-text-secondary">{hero.label}</p>
        <p className="text-[30px] font-semibold text-accent leading-tight">{hero.value}</p>
      </div>
      <div className="rounded-2xl border border-border bg-bg-secondary p-3">
        <p className="text-[12px] text-text-secondary">{hero.l2}</p>
        <p className="text-[16px] font-semibold tabular-nums">{hero.v2}</p>
      </div>
    </div>
  )
}
