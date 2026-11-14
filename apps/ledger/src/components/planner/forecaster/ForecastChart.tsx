import React from 'react'
import {
  Area, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { NetWorthSnapshot } from '../../../store/useAccountsStore'
import type { ForecastPoint } from '../../../utils/finance/forecast'
import { formatMoney, formatMoneyCompact } from '../format'
import { chartTooltipStyles } from '../../../utils/chartTheme'
import { ChartFigure } from '../../ui/ChartFigure'
import { ChartLegend } from '../../ui/ChartLegend'
import { PHONE_CHART_MARGIN, PHONE_Y_AXIS } from '../phoneChart'
import { goalChip } from './goalLabel'

interface GoalMarker {
  label: string
  month: number | null
  amount: number
}

interface ForecastChartProps {
  points: ForecastPoint[]
  history: NetWorthSnapshot[]
  showReal: boolean
  view: 'line' | 'stacked'
  goalMarkers: GoalMarker[]
  centered?: boolean
}

function monthsAgo(date: string): number {
  const d = new Date(`${date}T00:00:00`)
  const now = new Date()
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ points, history, showReal, view, goalMarkers, centered }) => {
  const past = history
    .map((h) => ({ month: monthsAgo(h.date), actual: h.value }))
    .filter((p) => p.month < 0)
  // Downsample forecast to quarterly points to keep the chart light.
  const future = points
    .filter((p) => p.month % 3 === 0)
    .map((p) => {
      const growthActual = Math.round(showReal ? p.growthReal : p.growth)
      return {
        month: p.month,
        projected: Math.round(showReal ? p.real : p.base),
        conservative: Math.round(showReal ? p.conservativeReal : p.conservative),
        optimistic: Math.round(showReal ? p.optimisticReal : p.optimistic),
        contributed: Math.round(showReal ? p.contributedReal : p.contributed),
        growthActual,
        growth: Math.max(0, growthActual),
      }
    })
  const data = [...past, ...future]

  const axisProps = {
    stroke: 'var(--text-secondary)',
    tick: { fill: 'var(--text-secondary)', fontSize: 12 },
  }

  const projectedLabel = showReal ? 'Projected (real)' : 'Projected'

  const legendItems = view === 'line'
    ? [
        { name: projectedLabel, color: 'var(--accent)' },
        // The band renders as a low-opacity accent area, so its swatch is faded
        // too: at full strength it would match the Projected line's swatch.
        { name: 'Conservative to Optimistic Band', color: 'var(--accent)', opacity: 0.3 },
        { name: 'Actual', color: 'var(--text-primary)' },
      ]
    : [
        { name: 'Contributed', color: 'var(--text-secondary)' },
        { name: 'Growth', color: 'var(--accent)' },
        { name: 'Actual', color: 'var(--text-primary)' },
      ]

  const reachable = goalMarkers.filter((g) => g.month !== null)
  const lastMonth = Math.max(...data.map((d) => d.month), 1)

  return (
    <div className={`themed-card rounded-lg ${centered ? 'p-3' : 'p-4'} h-[380px] flex flex-col`}>
      <ChartFigure
        label={`Net worth forecast, ${projectedLabel.toLowerCase()} to reach ${formatMoneyCompact(future[future.length - 1]?.projected ?? 0)} by ${(future[future.length - 1]?.month ?? 0) / 12} years out`}
        className="flex-1 min-h-0"
      >
        <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={centered ? PHONE_CHART_MARGIN : { top: 24, right: 5, bottom: 5, left: 5 }} accessibilityLayer={false}>
          <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(m: number) => `${(m / 12).toFixed(0)}y`}
            {...axisProps}
          />
          <YAxis width={72} tickFormatter={(v: number) => formatMoneyCompact(v)} {...axisProps} {...(centered ? PHONE_Y_AXIS : {})} />
          <Tooltip
            labelFormatter={(m) => {
              const month = Number(m)
              return month < 0 ? `${-month}mo ago` : `+${(month / 12).toFixed(1)}y`
            }}
            formatter={(value, name, item) => {
              if (String(name) === 'Growth') {
                const actual = (item?.payload as { growthActual?: number } | undefined)?.growthActual
                return [formatMoney(actual ?? Number(value)), 'Growth']
              }
              return [formatMoney(Number(value)), String(name)]
            }}
            {...chartTooltipStyles}
          />
          <ReferenceLine x={0} stroke="var(--text-secondary)" strokeDasharray="4 4" />
          {view === 'line' ? (
            <>
              <Area type="monotone" dataKey="optimistic" stroke="none" fill="var(--accent)" fillOpacity={0.12} name="Optimistic" />
              <Area type="monotone" dataKey="conservative" stroke="none" fill="var(--bg-primary)" fillOpacity={0.9} name="Conservative" />
              <Line type="monotone" dataKey="projected" stroke="var(--accent)" strokeWidth={2} dot={false} name={projectedLabel} />
            </>
          ) : (
            <>
              <Area type="monotone" dataKey="contributed" stackId="s" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.25} name="Contributed" />
              <Area type="monotone" dataKey="growth" stackId="s" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} name="Growth" />
            </>
          )}
          <Line type="monotone" dataKey="actual" stroke="var(--text-primary)" strokeWidth={2} dot={false} name="Actual" />
          {reachable.map((g) => (
            <ReferenceLine
              key={g.label}
              x={g.month as number}
              stroke="var(--accent)"
              strokeDasharray="2 4"
              label={centered
                ? goalChip(g.label, (g.month as number) / lastMonth > 0.55)
                : { value: g.label, fill: 'var(--accent)', fontSize: 12, position: 'top' }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      </ChartFigure>
      <ChartLegend centered={centered} items={legendItems} />
    </div>
  )
}
