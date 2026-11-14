import React, { useMemo } from 'react'
import {
  Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { probabilityOfSuccess, runMonteCarlo } from '../../../utils/finance/monteCarlo'
import type { LumpSum } from '../../../utils/finance/forecast'
import { CalculatorField } from '../CalculatorField'
import { ResultCard } from '../ResultCard'
import { formatMoney, formatMoneyCompact } from '../format'
import { chartTooltipStyles } from '../../../utils/chartTheme'
import { ChartFigure } from '../../ui/ChartFigure'
import { ChartLegend } from '../../ui/ChartLegend'
import { PHONE_CHART_MARGIN, PHONE_Y_AXIS } from '../phoneChart'

interface MonteCarloSectionProps {
  startBalance: number
  monthlySavings: number
  years: number
  meanReturnPct: number
  stdDevPct: number
  stepUpPct: number
  lumpSums: LumpSum[]
  target: number
  onStdDevChange: (v: number) => void
  /** Phone layout: Median Outcome card with an info button, the chart, then the volatility field; centred legend without amounts, and no chance card (the phone headline shows it). */
  phone?: boolean
  /** Phone only: an info button shown beside the Median Outcome label. */
  medianInfo?: React.ReactNode
}

export const MonteCarloSection: React.FC<MonteCarloSectionProps> = (props) => {
  const { bands, finalBalances } = useMemo(
    () =>
      runMonteCarlo({
        startBalance: props.startBalance,
        monthlySavings: props.monthlySavings,
        years: props.years,
        meanReturnPct: props.meanReturnPct,
        stdDevPct: props.stdDevPct,
        contributionStepUpPct: props.stepUpPct,
        lumpSums: props.lumpSums,
      }),
    [props.startBalance, props.monthlySavings, props.years, props.meanReturnPct, props.stdDevPct, props.stepUpPct, props.lumpSums],
  )
  const success = probabilityOfSuccess(finalBalances, props.target)
  // Stacked-fan encoding: base (transparent) + widths between percentiles.
  const data = bands.map((b) => ({
    year: b.year,
    p10: Math.round(b.p10),
    w1090: Math.round(b.p90 - b.p10),
    p50: Math.round(b.p50),
  }))

  return (
    <div className="flex flex-col gap-4">
      {props.phone ? (
        <CalculatorField label="Volatility (Std Dev)" suffix="%" step={1} value={props.stdDevPct} onChange={props.onStdDevChange} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-end">
          <CalculatorField label="Volatility (Std Dev)" suffix="%" step={1} value={props.stdDevPct} onChange={props.onStdDevChange} />
          <ResultCard label={`Chance of Reaching ${formatMoney(props.target)}`} value={`${Math.round(success * 100)}%`} highlight />
          <ResultCard label="Median Outcome" value={formatMoney(bands[bands.length - 1]?.p50 ?? 0)} />
        </div>
      )}
      <div className={`themed-card rounded-lg ${props.phone ? 'p-3' : 'p-4'}`}>
        <ChartFigure
          label={`Monte Carlo outcome fan over ${data.length} years, median outcome ${formatMoneyCompact(data[data.length - 1]?.p50 ?? 0)}, ${Math.round(success * 100)} percent chance of reaching ${formatMoneyCompact(props.target)}`}
          className="h-[240px] desktop:h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={props.phone ? PHONE_CHART_MARGIN : undefined} accessibilityLayer={false}>
              <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
              <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis width={72} tickFormatter={(v: number) => formatMoneyCompact(v)} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} {...(props.phone ? PHONE_Y_AXIS : {})} />
              <Tooltip
                formatter={(value, name) => [formatMoney(Number(value)), String(name) === 'w1090' ? 'P10–P90 width' : String(name).toUpperCase()]}
                {...chartTooltipStyles}
              />
              <Area type="monotone" dataKey="p10" stackId="fan" stroke="none" fill="transparent" name="p10" />
              <Area type="monotone" dataKey="w1090" stackId="fan" stroke="none" fill="var(--accent)" fillOpacity={0.18} name="w1090" />
              <Line type="monotone" dataKey="p50" stroke="var(--accent)" strokeWidth={2} dot={false} name="p50" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFigure>
        <ChartLegend centered={props.phone} items={[
          { name: 'Median Outcome', color: 'var(--accent)', value: props.phone ? undefined : formatMoney(bands[bands.length - 1]?.p50 ?? 0) },
          { name: '10th-90th Percentile Range', color: 'var(--accent)', opacity: 0.3 },
        ]} />
        {!props.phone && (
          <p className="text-[12px] text-text-secondary mt-2">
            500 seeded simulations. Shaded band spans the 10th to 90th percentile.
          </p>
        )}
      </div>
      {props.phone && (
        <div className="rounded-lg border border-border bg-bg-primary/40 p-4">
          <div className="flex items-center">
            <p className="text-[12px] uppercase tracking-wide text-text-secondary">Median Outcome</p>
            {props.medianInfo ? <span className="-my-3">{props.medianInfo}</span> : null}
          </div>
          <p className="text-[18px] font-semibold mt-1 leading-snug text-text-primary">{formatMoney(bands[bands.length - 1]?.p50 ?? 0)}</p>
        </div>
      )}
    </div>
  )
}
