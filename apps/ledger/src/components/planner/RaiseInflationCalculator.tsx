import React from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { RaiseInflationMobile } from './RaiseInflationMobile'
import { useRaiseInflation, type VerdictTone } from './useRaiseInflation'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TONE_STYLES: Record<VerdictTone, { banner: string; icon: string }> = {
  raise: { banner: 'border-accent/50 bg-accent/10', icon: 'text-accent' },
  lost: { banner: 'border-error/50 bg-error/10', icon: 'text-error' },
  wash: { banner: 'border-border bg-bg-primary/40', icon: 'text-text-secondary' },
}

const TONE_ICONS: Record<VerdictTone, React.ElementType> = {
  raise: TrendingUp,
  lost: TrendingDown,
  wash: Minus,
}

export const RaiseInflationCalculator: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const state = useRaiseInflation()
  if (isPhone) return <RaiseInflationMobile s={state} />
  const { inputs, set, nominal, real, realDollars, tone, verdict } = state
  const ToneIcon = TONE_ICONS[tone]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <CalculatorField label="Old Salary" prefix="$" step={1000} value={inputs.oldSalary} onChange={set('oldSalary')} />
        <CalculatorField label="New Salary" prefix="$" step={1000} value={inputs.newSalary} onChange={set('newSalary')} />
        <CalculatorField label="Inflation" suffix="%" step={0.1} value={inputs.inflationPct} onChange={set('inflationPct')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Nominal Raise" value={`${nominal.toFixed(2)}%`} />
        <ResultCard label="Real Raise" value={`${real.toFixed(2)}%`} highlight />
        <ResultCard label="Real Change (Old-Salary Dollars)" value={formatMoney(realDollars)} />
      </div>

      <div role="status" className={`flex items-center gap-2 rounded-lg border p-4 ${TONE_STYLES[tone].banner}`}>
        <ToneIcon className={`w-5 h-5 shrink-0 ${TONE_STYLES[tone].icon}`} aria-hidden="true" />
        <p className="text-[14px] text-text-primary">{verdict}</p>
      </div>
    </div>
  )
}
