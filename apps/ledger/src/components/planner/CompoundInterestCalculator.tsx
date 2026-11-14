import React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { CompoundInterestMobile } from './CompoundInterestMobile'
import { useCompoundInterest } from './useCompoundInterest'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney, formatMoneyCompact } from './format'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { ChartFigure } from '../ui/ChartFigure'
import { ChartLegend } from '../ui/ChartLegend'

export const CompoundInterestCalculator: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const state = useCompoundInterest()
  if (isPhone) return <CompoundInterestMobile s={state} />
  const { inputs, set, fv, contributed, chartData } = state

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CalculatorField label="Starting Amount" prefix="$" step={100} value={inputs.principal} onChange={set('principal')} />
        <CalculatorField label="Monthly Contribution" prefix="$" step={50} value={inputs.monthlyContribution} onChange={set('monthlyContribution')} />
        <CalculatorField label="Annual Return" suffix="%" step={0.1} value={inputs.annualRatePct} onChange={set('annualRatePct')} />
        <CalculatorField label="Years" min={1} max={60} value={inputs.years} onChange={set('years')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Future Value" value={formatMoney(fv)} highlight />
        <ResultCard label="Total Contributed" value={formatMoney(contributed)} />
        <ResultCard label="Growth" value={formatMoney(fv - contributed)} />
      </div>

      <ChartFigure
        label={`Compound growth from year 0 to year ${chartData[chartData.length - 1]?.year ?? 0}: ${formatMoney(fv)} future value, ${formatMoney(contributed)} contributed, ${formatMoney(fv - contributed)} growth`}
        className="themed-card rounded-lg p-4 h-[320px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} accessibilityLayer={false}>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={72} tickFormatter={(v: number) => formatMoneyCompact(v)} />
            <Tooltip
              formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
              {...chartTooltipStyles}
            />
            <Area type="monotone" dataKey="contributed" name="Contributed" stackId="1" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.25} />
            <Area type="monotone" dataKey="growth" name="Growth" stackId="1" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
      <ChartLegend items={[
        { name: 'Contributed', color: 'var(--text-secondary)', value: formatMoney(contributed) },
        { name: 'Growth', color: 'var(--accent)', value: formatMoney(fv - contributed) },
      ]} />
    </div>
  )
}
