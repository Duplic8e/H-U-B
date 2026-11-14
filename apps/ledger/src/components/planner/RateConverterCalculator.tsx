import React from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { RateConverterMobile } from './RateConverterMobile'
import { RATE_FREQUENCIES, RATE_TOOL_ID, useRateConverter } from './useRateConverter'
import { aprToApy, apyToApr, periodicRatePct, cagrPct, totalReturnPct } from '../../utils/finance/rates'
import { CalculatorField } from './CalculatorField'
import { SelectField } from './SelectField'
import { ResultCard } from './ResultCard'

export const RateConverterCalculator: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const state = useRateConverter()
  if (isPhone) return <RateConverterMobile s={state} />
  const { inputs, setInput, set, isCagr, aprToApyDir, n } = state
  const TOOL_ID = RATE_TOOL_ID
  const FREQUENCIES = RATE_FREQUENCIES

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <SelectField
          label="Mode"
          value={inputs.mode as string}
          onChange={(v) => setInput(TOOL_ID, 'mode', v)}
          options={[
            { value: 'apr-apy', label: 'APR ⇄ APY' },
            { value: 'cagr', label: 'Annualized Return (CAGR)' },
          ]}
        />
        {isCagr ? (
          <>
            <CalculatorField label="Starting Value" prefix="$" step={100} value={inputs.startValue} onChange={set('startValue')} />
            <CalculatorField label="Ending Value" prefix="$" step={100} value={inputs.endValue} onChange={set('endValue')} />
            <CalculatorField label="Years" min={0} max={80} step={0.5} value={inputs.years} onChange={set('years')} />
          </>
        ) : (
          <>
            <SelectField
              label="Direction"
              value={inputs.direction as string}
              onChange={(v) => setInput(TOOL_ID, 'direction', v)}
              options={[
                { value: 'apr-to-apy', label: 'APR → APY' },
                { value: 'apy-to-apr', label: 'APY → APR' },
              ]}
            />
            <CalculatorField label={aprToApyDir ? 'APR' : 'APY'} suffix="%" step={0.05} value={inputs.ratePct} onChange={set('ratePct')} />
            <SelectField
              label="Compounding"
              value={String(inputs.periodsPerYear)}
              onChange={(v) => setInput(TOOL_ID, 'periodsPerYear', Number(v))}
              options={FREQUENCIES}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isCagr ? (
          <>
            <ResultCard
              label="Annualized Return (CAGR)"
              value={(() => { const r = cagrPct(inputs.startValue, inputs.endValue, inputs.years); return r === null ? 'n/a' : `${r.toFixed(2)}%` })()}
              highlight
            />
            <ResultCard
              label="Total Return"
              value={(() => { const r = totalReturnPct(inputs.startValue, inputs.endValue); return r === null ? 'n/a' : `${r.toFixed(2)}%` })()}
            />
          </>
        ) : (
          <>
            <ResultCard
              label={aprToApyDir ? 'Effective Annual Rate (APY)' : 'Nominal Rate (APR)'}
              value={`${(aprToApyDir ? aprToApy(inputs.ratePct, n) : apyToApr(inputs.ratePct, n)).toFixed(4)}%`}
              highlight
            />
            <ResultCard
              label="Rate per Period"
              value={`${periodicRatePct(aprToApyDir ? inputs.ratePct : apyToApr(inputs.ratePct, n), n).toFixed(4)}%`}
            />
          </>
        )}
      </div>
    </div>
  )
}
