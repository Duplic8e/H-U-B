import React from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { EmergencyFundMobile } from './EmergencyFundMobile'
import { EMERGENCY_TOOL_ID, PRESET_MONTHS, useEmergencyFund } from './useEmergencyFund'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

export const EmergencyFundCalculator: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const state = useEmergencyFund()
  if (isPhone) return <EmergencyFundMobile s={state} />
  const { inputs, setInput, set, budgetAvg, target, gap, progress } = state
  const TOOL_ID = EMERGENCY_TOOL_ID

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <CalculatorField label="Monthly Essential Expenses" prefix="$" step={100} value={inputs.monthlyExpenses} onChange={set('monthlyExpenses')} />
        <CalculatorField label="Months of Cover" min={1} max={24} value={inputs.targetMonths} onChange={set('targetMonths')} />
        <CalculatorField label="Current Savings" prefix="$" step={100} value={inputs.currentSavings} onChange={set('currentSavings')} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESET_MONTHS.map((m) => (
          <button
            key={m}
            onClick={() => setInput(TOOL_ID, 'targetMonths', m)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
              inputs.targetMonths === m
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {m} months
          </button>
        ))}
        {budgetAvg > 0 && (
          <button
            onClick={() => setInput(TOOL_ID, 'monthlyExpenses', Math.round(budgetAvg))}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          >
            Use my budget avg ({formatMoney(budgetAvg)}/mo)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Target Fund" value={formatMoney(target)} highlight />
        <ResultCard label="Gap to Close" value={formatMoney(gap)} />
        <ResultCard label="Funded" value={`${Math.round(progress * 100)}%`} />
      </div>

      <div className="themed-card rounded-lg p-4">
        <div className="h-3 w-full rounded bg-bg-primary/50 overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-[12px] text-text-secondary mt-2">
          {gap === 0
            ? 'Fully funded, nice.'
            : `Save ${formatMoney(gap)} more to reach ${inputs.targetMonths} months of cover.`}
        </p>
      </div>
    </div>
  )
}
