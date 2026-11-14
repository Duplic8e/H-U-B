import React from 'react'
import { NumberInput } from '../ui/NumberInput'
import { formatMoney } from './format'
import { EMERGENCY_TOOL_ID, PRESET_MONTHS, type EmergencyFundState } from './useEmergencyFund'

const lab = 'text-[13px] font-medium text-text-secondary'
const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'

interface FieldProps { id: string; label: string; prefix?: string; suffix?: string; value: number; onChange: (v: number) => void; min?: number; max?: number }
const Field: React.FC<FieldProps> = (f) => (
  <div className="flex flex-col gap-1 min-w-0">
    <label htmlFor={f.id} className={lab}>{f.label}</label>
    <div className={box}>
      {f.prefix && <span className="text-[14px] text-text-secondary shrink-0">{f.prefix}</span>}
      <NumberInput id={f.id} className="w-full min-w-0 bg-transparent text-text-primary text-[16px] font-medium" value={f.value} min={f.min ?? 0} max={f.max} onCommit={f.onChange} />
      {f.suffix && <span className="text-[14px] text-text-secondary shrink-0">{f.suffix}</span>}
    </div>
  </div>
)

/** Phone layout of the emergency fund tool: progress first, then target and gap, then the inputs. */
export const EmergencyFundMobile: React.FC<{ s: EmergencyFundState }> = ({ s }) => {
  const { inputs, set, setInput, budgetAvg, target, gap, progress } = s
  const pct = Math.round(progress * 100)
  return (
    <div data-testid="emergency-fund-mobile" className="flex flex-col gap-4">
      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 flex flex-col gap-3" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] leading-none text-text-secondary">Funded</p>
          <p className="text-[13px] leading-none text-text-secondary tabular-nums">{formatMoney(inputs.currentSavings)} of {formatMoney(target)}</p>
        </div>
        <p className="text-[30px] font-semibold text-accent leading-none">{pct}%</p>
        <div className="h-3 w-full rounded-full bg-bg-primary/60 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Emergency fund progress">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-bg-secondary grid grid-cols-2 divide-x divide-border">
        <div className="p-3 min-w-0 text-center"><p className="text-[12px] text-text-secondary">Target Fund</p><p className="text-[16px] font-semibold tabular-nums break-words">{formatMoney(target)}</p></div>
        <div className="p-3 min-w-0 text-center"><p className="text-[12px] text-text-secondary">Gap to Close</p><p className="text-[16px] font-semibold tabular-nums break-words">{formatMoney(gap)}</p></div>
      </div>
      <div role="group" aria-label="Months of cover" className="flex bg-bg-secondary border border-border rounded-xl p-1">
        {PRESET_MONTHS.map((m) => (
          <button key={m} aria-pressed={inputs.targetMonths === m} onClick={() => setInput(EMERGENCY_TOOL_ID, 'targetMonths', m)}
            className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium ${inputs.targetMonths === m ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{m} months</button>
        ))}
      </div>
      <Field id="ef-expenses" label="Monthly Essential Expenses" prefix="$" value={inputs.monthlyExpenses} onChange={set('monthlyExpenses')} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="ef-months" label="Months of Cover" suffix="mo" min={1} max={24} value={inputs.targetMonths} onChange={set('targetMonths')} />
        <Field id="ef-savings" label="Current Savings" prefix="$" value={inputs.currentSavings} onChange={set('currentSavings')} />
      </div>
      {budgetAvg > 0 && (
        <button
          onClick={() => setInput(EMERGENCY_TOOL_ID, 'monthlyExpenses', Math.round(budgetAvg))}
          aria-pressed={inputs.monthlyExpenses === Math.round(budgetAvg)}
          className={`min-h-11 rounded-xl border text-[13px] font-medium px-3 text-left ${inputs.monthlyExpenses === Math.round(budgetAvg) ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-primary bg-bg-secondary'}`}
        >
          Use My Budget Average ({formatMoney(budgetAvg)}/mo)
        </button>
      )}
    </div>
  )
}
