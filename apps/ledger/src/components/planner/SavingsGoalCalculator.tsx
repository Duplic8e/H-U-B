import React from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { SavingsGoalMobile } from './SavingsGoalMobile'
import { SAVINGS_TOOL_ID, useSavingsGoal } from './useSavingsGoal'
import { CalculatorField } from './CalculatorField'
import { SelectField } from './SelectField'
import { ResultCard } from './ResultCard'

export const SavingsGoalCalculator: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const state = useSavingsGoal()
  if (isPhone) return <SavingsGoalMobile s={state} />
  const { inputs, setInput, set, solveFor, result } = state
  const TOOL_ID = SAVINGS_TOOL_ID

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
        <SelectField
          label="Solve For"
          value={solveFor}
          onChange={(v) => setInput(TOOL_ID, 'solveFor', v)}
          options={[
            { value: 'monthly', label: 'Monthly Contribution' },
            { value: 'months', label: 'Time to Goal' },
            { value: 'rate', label: 'Required Return' },
            { value: 'target', label: 'Final Balance' },
          ]}
        />
        {solveFor !== 'target' && (
          <CalculatorField label="Goal Amount" prefix="$" step={1000} value={inputs.target} onChange={set('target')} />
        )}
        <CalculatorField label="Starting Amount" prefix="$" step={100} value={inputs.principal} onChange={set('principal')} />
        {solveFor !== 'monthly' && (
          <CalculatorField label="Monthly Contribution" prefix="$" step={50} value={inputs.monthlyContribution} onChange={set('monthlyContribution')} />
        )}
        {solveFor !== 'rate' && (
          <CalculatorField label="Annual Return" suffix="%" step={0.1} value={inputs.annualRatePct} onChange={set('annualRatePct')} />
        )}
        {solveFor !== 'months' && (
          <CalculatorField label="Years" min={1} max={60} value={inputs.years} onChange={set('years')} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <ResultCard label={result.label} value={result.value} highlight />
        </div>
      </div>
    </div>
  )
}
