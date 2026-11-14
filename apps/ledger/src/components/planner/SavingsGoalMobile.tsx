import React from 'react'
import { NumberInput } from '../ui/NumberInput'
import { SAVINGS_TOOL_ID, type SavingsGoalState, type SolveFor } from './useSavingsGoal'

const SOLVE: { value: SolveFor; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'months', label: 'Time' },
  { value: 'rate', label: 'Return' },
  { value: 'target', label: 'Balance' },
]
const SOLVE_NAME: Record<SolveFor, string> = { monthly: 'Monthly Contribution', months: 'Time to Goal', rate: 'Required Return', target: 'Final Balance' }

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

/** Phone layout of Savings Goal: what to solve for, then the inputs that apply, then the result. */
export const SavingsGoalMobile: React.FC<{ s: SavingsGoalState }> = ({ s }) => {
  const { inputs, setInput, set, solveFor, result } = s
  return (
    <div data-testid="savings-goal-mobile" className="flex flex-col gap-4">
      <div role="group" aria-label="Solve for" className="grid grid-cols-4 gap-1 bg-bg-secondary border border-border rounded-xl p-1">
        {SOLVE.map((o) => (
          <button key={o.value} aria-pressed={solveFor === o.value} aria-label={SOLVE_NAME[o.value]} onClick={() => setInput(SAVINGS_TOOL_ID, 'solveFor', o.value)}
            className={`min-h-[44px] rounded-lg text-[13px] font-medium px-1 ${solveFor === o.value ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{o.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {solveFor !== 'target' && <Field id="savings-goal-amount" label="Goal Amount" prefix="$" value={inputs.target} onChange={set('target')} />}
        <Field id="savings-start" label="Starting Amount" prefix="$" value={inputs.principal} onChange={set('principal')} />
        {solveFor !== 'monthly' && <Field id="savings-monthly" label="Monthly Contribution" prefix="$" value={inputs.monthlyContribution} onChange={set('monthlyContribution')} />}
        {solveFor !== 'rate' && <Field id="savings-rate" label="Annual Return" suffix="%" value={inputs.annualRatePct} onChange={set('annualRatePct')} />}
        {solveFor !== 'months' && <Field id="savings-years" label="Years" suffix="yrs" min={1} max={60} value={inputs.years} onChange={set('years')} />}
      </div>

      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4" role="status" aria-live="polite">
        <p className="text-[13px] text-text-secondary">{result.label}</p>
        <p className="text-[30px] font-semibold text-accent leading-tight">{result.value}</p>
      </div>
    </div>
  )
}
