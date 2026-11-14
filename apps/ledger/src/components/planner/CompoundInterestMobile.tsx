import React from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NumberInput } from '../ui/NumberInput'
import { ChartFigure } from '../ui/ChartFigure'
import { ChartLegend } from '../ui/ChartLegend'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { formatMoney, formatMoneyCompact } from './format'
import { COMPOUND_TOOL_ID, type CompoundInterestState } from './useCompoundInterest'
import { PHONE_CHART_MARGIN, PHONE_Y_AXIS } from './phoneChart'

const YEAR_PRESETS = [10, 20, 30, 40]
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

/** Phone layout of Compound Interest: future value with its contributed/growth split, year presets, inputs, chart. */
export const CompoundInterestMobile: React.FC<{ s: CompoundInterestState }> = ({ s }) => {
  const { inputs, setInput, set, fv, contributed, chartData } = s
  const growth = fv - contributed
  const growthPct = fv > 0 ? Math.round((growth / fv) * 100) : 0

  return (
    <div data-testid="compound-interest-mobile" className="flex flex-col gap-4">
      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 flex flex-col gap-3" role="status" aria-live="polite">
        <div>
          <p className="text-[13px] text-text-secondary">Future Value</p>
          <p className="text-[30px] font-semibold text-accent leading-tight">{formatMoney(fv)}</p>
        </div>
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-bg-primary/60" aria-hidden="true">
          <div className="bg-text-secondary/60" style={{ width: `${100 - growthPct}%` }} />
          <div className="bg-accent" style={{ width: `${growthPct}%` }} />
        </div>
        <div className="flex justify-between gap-2 text-[12px] text-text-secondary">
          <span>Contributed {formatMoney(contributed)}</span>
          <span>Growth {formatMoney(growth)} ({growthPct}%)</span>
        </div>
      </div>

      <div role="group" aria-label="Years presets" className="flex bg-bg-secondary border border-border rounded-xl p-1">
        {YEAR_PRESETS.map((y) => (
          <button key={y} aria-pressed={inputs.years === y} onClick={() => setInput(COMPOUND_TOOL_ID, 'years', y)}
            className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium ${inputs.years === y ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{y} yrs</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id="compound-start" label="Starting Amount" prefix="$" value={inputs.principal} onChange={set('principal')} />
        <Field id="compound-monthly" label="Monthly Contribution" prefix="$" value={inputs.monthlyContribution} onChange={set('monthlyContribution')} />
        <Field id="compound-rate" label="Annual Return" suffix="%" value={inputs.annualRatePct} onChange={set('annualRatePct')} />
        <Field id="compound-years" label="Years" suffix="yrs" min={1} max={60} value={inputs.years} onChange={set('years')} />
      </div>

      <div className="themed-card rounded-lg p-3 h-[280px] flex flex-col">
        <ChartFigure
          label={`Compound growth from year 0 to year ${chartData[chartData.length - 1]?.year ?? 0}: ${formatMoney(fv)} future value, ${formatMoney(contributed)} contributed, ${formatMoney(growth)} growth`}
          className="w-full flex-1 min-h-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={PHONE_CHART_MARGIN} accessibilityLayer={false}>
              <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
              <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis stroke="var(--text-secondary)" {...PHONE_Y_AXIS} tickFormatter={(v: number) => formatMoneyCompact(v)} />
              <Tooltip formatter={(value, name) => [formatMoney(Number(value)), String(name)]} {...chartTooltipStyles} />
              <Area type="monotone" dataKey="contributed" name="Contributed" stackId="1" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.25} />
              <Area type="monotone" dataKey="growth" name="Growth" stackId="1" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFigure>
        <ChartLegend centered items={[
          { name: 'Contributed', color: 'var(--text-secondary)', value: formatMoney(contributed) },
          { name: 'Growth', color: 'var(--accent)', value: formatMoney(growth) },
        ]} />
      </div>
    </div>
  )
}
