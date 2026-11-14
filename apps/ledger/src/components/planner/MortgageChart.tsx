import React, { useRef } from 'react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { formatMoney, formatMoneyCompact } from './format'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { ChartFigure } from '../ui/ChartFigure'
import { ChartLegend } from '../ui/ChartLegend'
import type { MortgageState } from './useMortgageCalculator'
import { PHONE_CHART_MARGIN, PHONE_Y_AXIS } from './phoneChart'

/** Balance-over-time chart card, shared by the desktop and phone mortgage layouts. */
export const MortgageChart: React.FC<{ m: Pick<MortgageState, 'chartData' | 'frequency' | 'extras'> }> = ({ m }) => {
  const isDesktop = useIsDesktop()
  const { chartData, frequency, extras } = m
  const emphasizeBaseline = frequency === 'monthly' && extras.length === 0

  // Only monthly-with-extras and biweekly draw a second area; the default
  // (monthly, no extras) chart has one series and names it in the axis and
  // heading alone, matching every other single-series chart in the app.
  const secondSeriesLegend =
    frequency === 'monthly' && extras.length > 0
      ? [
          { name: 'Original Schedule', color: 'var(--text-secondary)' },
          { name: 'With Extra Payments', color: 'var(--accent)' },
        ]
      : frequency === 'biweekly'
        ? [
            { name: 'Monthly Schedule', color: 'var(--text-secondary)' },
            { name: 'Biweekly Accelerated', color: 'var(--accent)' },
          ]
        : []

  // Recharts' Tooltip trigger="click" listens for a native click event, but a
  // tap on a phone does not reliably synthesize one on the SVG surface. This
  // bridges touch to click on touchend (when a tap is known to have
  // completed, not touchstart, which fires before it's known whether the
  // gesture is a tap or the start of a scroll), and calls preventDefault to
  // suppress the browser's own trailing synthetic click, so a single tap
  // fires exactly one click rather than two (ours plus the browser's ghost
  // click), which would otherwise open then immediately re-toggle the
  // tooltip on every tap.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const TAP_MOVE_THRESHOLD_PX = 10

  const handleChartTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleChartTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    const touch = e.changedTouches[0]
    if (!start || !touch) return
    const movedX = Math.abs(touch.clientX - start.x)
    const movedY = Math.abs(touch.clientY - start.y)
    if (movedX > TAP_MOVE_THRESHOLD_PX || movedY > TAP_MOVE_THRESHOLD_PX) return
    e.preventDefault()
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
    target?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: touch.clientX,
      clientY: touch.clientY,
    }))
  }

  return (
    <div
      className="themed-card rounded-lg p-3 desktop:p-4 h-[240px] desktop:h-[300px] flex flex-col"
      onTouchStart={handleChartTouchStart}
      onTouchEnd={handleChartTouchEnd}
    >
      <ChartFigure
        label={`Mortgage balance from year 1 to year ${chartData.length}, starting at ${formatMoneyCompact(chartData[0]?.baseline ?? 0)} and ending at ${formatMoneyCompact(chartData[chartData.length - 1]?.baseline ?? 0)}`}
        className="w-full flex-1 min-h-0"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={isDesktop ? { top: 8, right: 8, bottom: 0, left: 8 } : PHONE_CHART_MARGIN} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="year"
              stroke="var(--text-secondary)"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              // 25 ticks crammed the axis at every width. Keep the ends
              // and let Recharts drop what will not fit between them.
              interval="preserveStartEnd"
              minTickGap={24}
              tickFormatter={(v) => `${v}y`}
            />
            <YAxis
              stroke="var(--text-secondary)"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              {...(isDesktop ? { width: 72 } : PHONE_Y_AXIS)}
              // Raw "600000" was the only unformatted axis in the app.
              tickFormatter={(v) => formatMoneyCompact(Number(v))}
            />
            <Tooltip
              trigger={isDesktop ? 'hover' : 'click'}
              formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
              {...chartTooltipStyles}
            />
            <Area type="monotone" dataKey="baseline" stroke={emphasizeBaseline ? 'var(--accent)' : 'var(--text-secondary)'}
              fill={emphasizeBaseline ? 'var(--accent)' : 'var(--text-secondary)'} fillOpacity={emphasizeBaseline ? 0.25 : 0.12} />
            {frequency === 'monthly' && extras.length > 0 && (
              <Area type="monotone" dataKey="withExtras" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
            )}
            {frequency === 'biweekly' && (
              <Area type="monotone" dataKey="biweekly" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
      {secondSeriesLegend.length > 0 && <ChartLegend items={secondSeriesLegend} centered={!isDesktop} />}
    </div>
  )
}
