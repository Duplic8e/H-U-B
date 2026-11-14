import React from 'react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { ChartFigure } from '../ui/ChartFigure'
import { ChartLegend } from '../ui/ChartLegend'
import { RentVsBuyMobile } from './RentVsBuyMobile'
import { useRentVsBuy } from './useRentVsBuy'

export const RentVsBuyCalculator: React.FC = () => {
  const state = useRentVsBuy()
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const { inputs, set, result: r, chartData, last } = state

  if (isPhone) return <RentVsBuyMobile s={state} />

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <CalculatorField label="Monthly Rent" prefix="$" step={50} value={inputs.monthlyRent} onChange={set('monthlyRent')} />
        <CalculatorField label="Rent Increase" suffix="%/yr" step={0.5} value={inputs.rentIncreasePct} onChange={set('rentIncreasePct')} />
        <CalculatorField label="Home Price" prefix="$" step={5000} value={inputs.price} onChange={set('price')} />
        <CalculatorField label="Down Payment" suffix="%" min={0} max={100} value={inputs.downPct} onChange={set('downPct')} />
        <CalculatorField label="Mortgage Rate" suffix="%" step={0.05} value={inputs.ratePct} onChange={set('ratePct')} />
        <CalculatorField label="Property Tax" suffix="%/yr" step={0.1} value={inputs.propertyTaxPct} onChange={set('propertyTaxPct')} />
        <CalculatorField label="Maintenance" suffix="%/yr" step={0.1} value={inputs.maintenancePct} onChange={set('maintenancePct')} />
        <CalculatorField label="Investment Return (Opportunity)" suffix="%" step={0.5} value={inputs.opportunityPct} onChange={set('opportunityPct')} />
        <CalculatorField label="Horizon (Years)" min={1} max={40} value={inputs.horizonYears} onChange={set('horizonYears')} />
        <CalculatorField label="Amortization (Years)" min={1} max={35} value={inputs.amortYears} onChange={set('amortYears')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard
          label="Break-even"
          value={r.breakEvenYear === null ? 'Renting wins in this horizon' : `Year ${r.breakEvenYear}`}
          highlight
        />
        <ResultCard label={`Renting cost by year ${last?.year ?? 0}`} value={formatMoney(last?.rentCost ?? 0)} />
        <ResultCard label={`Buying cost by year ${last?.year ?? 0}`} value={formatMoney(last?.buyCost ?? 0)} />
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col">
        <ChartFigure
          label={`Cumulative renting versus buying cost by year ${last?.year ?? 0}: ${formatMoney(last?.rentCost ?? 0)} renting, ${formatMoney(last?.buyCost ?? 0)} buying`}
          className="h-[288px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} accessibilityLayer={false}>
              <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
              <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={72} />
              <Tooltip
                formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
                {...chartTooltipStyles}
              />
              <Line type="monotone" dataKey="Renting" stroke="var(--text-secondary)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="Buying" stroke="var(--accent)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartFigure>
        <ChartLegend items={[
          { name: 'Renting', color: 'var(--text-secondary)', value: formatMoney(last?.rentCost ?? 0) },
          { name: 'Buying', color: 'var(--accent)', value: formatMoney(last?.buyCost ?? 0) },
        ]} />
        <p className="text-[12px] text-text-secondary mt-2">
          Cumulative unrecoverable costs only: rent vs interest, taxes, maintenance and the return your down payment could have earned.
        </p>
      </div>
    </div>
  )
}
