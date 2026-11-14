import React from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NumberInput } from '../ui/NumberInput'
import { ChartFigure } from '../ui/ChartFigure'
import { ChartLegend } from '../ui/ChartLegend'
import { InfoButton } from '../ui/InfoButton'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { formatMoney, formatMoneyCompact } from './format'
import { RENT_BUY_TOOL_ID, type RentVsBuyState } from './useRentVsBuy'
import { PHONE_CHART_MARGIN, PHONE_Y_AXIS } from './phoneChart'

const HORIZON_PRESETS = [5, 10, 15, 25]
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

const Fold: React.FC<{ title: string; summary: string; children: React.ReactNode }> = ({ title, summary, children }) => (
  <details className="themed-card rounded-2xl">
    <summary className="list-none cursor-pointer min-h-12 px-4 flex items-center justify-between gap-3">
      <span className="text-[15px] font-semibold">{title}</span>
      <span className="text-[13px] text-text-secondary">{summary}</span>
    </summary>
    <div className="px-4 pb-4">{children}</div>
  </details>
)

const CostBar: React.FC<{ name: string; value: number; max: number; lower: boolean }> = ({ name, value, max, lower }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-[13px]">
      <span className={lower ? 'text-accent font-semibold' : 'text-text-secondary'}>{name}{lower ? ' (Lower)' : ''}</span>
      <span className="tabular-nums font-semibold">{formatMoney(value)}</span>
    </div>
    <div className="h-3 rounded-full bg-bg-primary/60 overflow-hidden" aria-hidden="true">
      <div className={lower ? 'bg-accent h-full' : 'bg-text-secondary/60 h-full'} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
    </div>
  </div>
)

/** Phone layout of Rent vs Buy: the verdict with both costs side by side, horizon presets,
 *  the cumulative chart, then the inputs folded into Renting, Buying and Assumptions. */
export const RentVsBuyMobile: React.FC<{ s: RentVsBuyState }> = ({ s }) => {
  const { inputs, set, setInput, result, chartData, rentCost, buyCost, lastYear } = s
  const verdict = result.breakEvenYear === null ? 'Renting Wins' : `Buying Wins From Year ${result.breakEvenYear}`
  const max = Math.max(rentCost, buyCost, 1)

  return (
    <div data-testid="rent-vs-buy-mobile" className="flex flex-col gap-4">
      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 flex flex-col gap-3" role="status" aria-live="polite">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[13px] text-text-secondary">Break-even</p>
            <p className="text-[26px] font-semibold text-accent leading-tight">{verdict}</p>
          </div>
          <div className="-mt-2 -mr-2">
            <InfoButton label="How This Is Calculated">
              <p>Compares only the money you never get back.</p>
              <p><strong className="text-text-primary">Renting:</strong> the rent you pay.</p>
              <p><strong className="text-text-primary">Buying:</strong> mortgage interest, property tax, maintenance, and the return your down payment would have earned if invested.</p>
              <p>Principal you repay is left out because it builds equity.</p>
            </InfoButton>
          </div>
        </div>
        <CostBar name={`Renting by Year ${lastYear}`} value={rentCost} max={max} lower={rentCost <= buyCost} />
        <CostBar name={`Buying by Year ${lastYear}`} value={buyCost} max={max} lower={buyCost < rentCost} />
      </div>

      <div role="group" aria-label="Horizon presets" className="flex bg-bg-secondary border border-border rounded-xl p-1">
        {HORIZON_PRESETS.map((y) => (
          <button key={y} aria-pressed={inputs.horizonYears === y} onClick={() => setInput(RENT_BUY_TOOL_ID, 'horizonYears', y)}
            className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium ${inputs.horizonYears === y ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{y} yrs</button>
        ))}
      </div>

      <div className="themed-card rounded-lg p-3 h-[300px] flex flex-col">
        <ChartFigure
          label={`Cumulative renting versus buying cost by year ${lastYear}: ${formatMoney(rentCost)} renting, ${formatMoney(buyCost)} buying`}
          className="w-full flex-1 min-h-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={PHONE_CHART_MARGIN} accessibilityLayer={false}>
              <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
              <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis stroke="var(--text-secondary)" {...PHONE_Y_AXIS} tickFormatter={(v: number) => formatMoneyCompact(v)} />
              <Tooltip formatter={(value, name) => [formatMoney(Number(value)), String(name)]} {...chartTooltipStyles} />
              <Line type="monotone" dataKey="Renting" stroke="var(--text-secondary)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="Buying" stroke="var(--accent)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartFigure>
        <ChartLegend centered items={[
          { name: 'Renting', color: 'var(--text-secondary)', value: formatMoney(rentCost) },
          { name: 'Buying', color: 'var(--accent)', value: formatMoney(buyCost) },
        ]} />
      </div>

      <Fold title="Renting" summary={`${formatMoney(inputs.monthlyRent)}/mo`}>
        <div className="grid grid-cols-2 gap-3">
          <Field id="rb-rent" label="Monthly Rent" prefix="$" value={inputs.monthlyRent} onChange={set('monthlyRent')} />
          <Field id="rb-rent-inc" label="Rent Increase" suffix="%/yr" value={inputs.rentIncreasePct} onChange={set('rentIncreasePct')} />
        </div>
      </Fold>
      <Fold title="Buying" summary={formatMoney(inputs.price)}>
        <div className="grid grid-cols-2 gap-3">
          <Field id="rb-price" label="Home Price" prefix="$" value={inputs.price} onChange={set('price')} />
          <Field id="rb-down" label="Down Payment" suffix="%" max={100} value={inputs.downPct} onChange={set('downPct')} />
          <Field id="rb-rate" label="Mortgage Rate" suffix="%" value={inputs.ratePct} onChange={set('ratePct')} />
          <Field id="rb-amort" label="Amortization" suffix="yrs" min={1} max={35} value={inputs.amortYears} onChange={set('amortYears')} />
        </div>
      </Fold>
      <Fold title="Assumptions" summary={`${inputs.horizonYears} yrs`}>
        <div className="grid grid-cols-2 gap-3">
          <Field id="rb-tax" label="Property Tax" suffix="%/yr" value={inputs.propertyTaxPct} onChange={set('propertyTaxPct')} />
          <Field id="rb-maint" label="Maintenance" suffix="%/yr" value={inputs.maintenancePct} onChange={set('maintenancePct')} />
          <Field id="rb-opp" label="Investment Return" suffix="%" value={inputs.opportunityPct} onChange={set('opportunityPct')} />
          <Field id="rb-horizon" label="Horizon" suffix="yrs" min={1} max={40} value={inputs.horizonYears} onChange={set('horizonYears')} />
        </div>
      </Fold>
    </div>
  )
}
