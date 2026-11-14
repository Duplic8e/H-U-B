import React from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { InflationAdjusterMobile } from './InflationAdjusterMobile'
import { INFLATION_TOOL_ID, useInflationAdjuster } from './useInflationAdjuster'
import { CalculatorField } from './CalculatorField'
import { SelectField } from './SelectField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

export const InflationAdjusterCalculator: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const state = useInflationAdjuster()
  if (isPhone) return <InflationAdjusterMobile s={state} />
  const { inputs, setInput, set, toFuture, converted, powerChange } = state
  const TOOL_ID = INFLATION_TOOL_ID

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <SelectField
          label="Direction"
          value={inputs.direction as string}
          onChange={(v) => setInput(TOOL_ID, 'direction', v)}
          options={[
            { value: 'future', label: "Today's $ → Future Cost" },
            { value: 'present', label: "Future $ → Today's Value" },
          ]}
        />
        <CalculatorField label={toFuture ? 'Amount Today' : 'Future Amount'} prefix="$" step={100} value={inputs.amount} onChange={set('amount')} />
        <CalculatorField label="Years" min={0} max={80} value={inputs.years} onChange={set('years')} />
        <CalculatorField label="Annual Inflation" suffix="%" step={0.1} value={inputs.inflationPct} onChange={set('inflationPct')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResultCard
          label={toFuture ? `Cost in ${inputs.years} Years` : "Worth in Today's Dollars"}
          value={formatMoney(converted)}
          highlight
        />
        <ResultCard
          label={`Purchasing Power Change Over ${inputs.years} Years`}
          value={`${powerChange.toFixed(1)}%`}
        />
      </div>
    </div>
  )
}
