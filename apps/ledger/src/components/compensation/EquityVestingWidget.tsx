import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useCompensationStore, generateVestEvents } from '../../store/useCompensationStore'
import type { VestEvent } from '../../store/useCompensationStore'
import { useCompensationDisplay } from '../../hooks/useCompensationDisplay'
import type { ChartTooltipProps, ChartTooltipPayloadItem } from '../../utils/chartTheme'
import { LEADING_LABEL, TRAILING_LABEL, isPaddingLabel } from './vestingPadding'
import { ChartLegend } from '../ui/ChartLegend'
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { ChartFigure } from '../ui/ChartFigure'
import { InfoButton } from '../ui/InfoButton'
import { useIsDesktop } from '../../hooks/useMediaQuery'

const cad = (v: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v)

// Module scope, not inside the component: a component created during render is
// a new type on every render, so React remounts the tooltip each time.
export const CustomEquityTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  if (isPaddingLabel(label)) return null;

  const barPayloads = payload.filter(
    (p: ChartTooltipPayloadItem) => p.dataKey !== 'unvestedRemaining' && p.dataKey !== 'vestValue',
  );
  const unvested = payload.find(
    (p: ChartTooltipPayloadItem) => p.dataKey === 'unvestedRemaining',
  )?.value;

  const vestingRows = barPayloads.filter((p) => (p.value ?? 0) > 0);
  const totalVest = barPayloads.reduce((sum, p) => sum + (p.value ?? 0), 0);

  return (
    <div className="themed-card rounded-lg p-3 min-w-[200px]" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <p className="font-semibold text-[var(--color-text-primary)] mb-2">{label}</p>

      {vestingRows.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {vestingRows.map((p, i) => (
            <div key={i} className="flex justify-between items-center gap-4 text-[13px]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
                <span className="text-[var(--color-text-secondary)]">{p.name}</span>
              </div>
              <span className="text-[var(--color-text-primary)] font-medium">
                {cad(p.value ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className={`flex justify-between items-center gap-4 text-[13px] ${
          vestingRows.length > 0 ? 'pt-2 border-t border-[var(--color-border)]' : ''
        }`}
      >
        <span className="text-[var(--color-text-secondary)]">Vesting this month</span>
        <span className="text-[var(--color-text-primary)] font-medium">{cad(totalVest)}</span>
      </div>

      {unvested !== undefined && (
        <div className="flex justify-between items-center gap-4 text-[13px] mt-1">
          <span className="text-[var(--color-text-secondary)]">Unvested Remaining</span>
          <span className="text-[var(--color-text-primary)] font-bold">{cad(unvested)}</span>
        </div>
      )}
    </div>
  );
};

export function EquityVestingWidget() {
  const { timeMode } = useCompensationStore()
  const isDesktop = useIsDesktop()
  const { pkg: primaryPackage } = useCompensationDisplay()

  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']

  if (primaryPackage.rsuGrants.length === 0) {
    return (
      <WidgetWrapper title="Equity Vesting Schedule">
        <div className="flex flex-col items-center justify-center h-[280px] themed-card rounded-md p-6">
          <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">No RSU Grants Added</p>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2 text-center">
            Add RSU details in the compensation modal to see your vesting timeline.
          </p>
        </div>
      </WidgetWrapper>
    )
  }

  const today = new Date()
  const targetYear = today.getFullYear()
  const currentMonth = today.getMonth()

  const displayMonths = Array.from({ length: 12 }).map((_, i) => {
    if (timeMode === 'current-year') {
      return {
        label: new Date(targetYear, i, 1).toLocaleString('default', { month: 'short' }),
        monthIndex: i,
        year: targetYear
      }
    } else {
      const date = new Date(targetYear, currentMonth + i, 1);
      return {
        label: date.toLocaleString('default', { month: 'short' }),
        monthIndex: date.getMonth(),
        year: date.getFullYear()
      }
    }
  });

  const allEvents: (VestEvent & { grantName: string, grantId: string })[] = []
  primaryPackage.rsuGrants.forEach(grant => {
    const events = generateVestEvents(grant, primaryPackage.companyCurrentPrice)
    const taggedEvents = events.map(e => ({ ...e, grantName: grant.grantName, grantId: grant.id }))
    allEvents.push(...taggedEvents)
  })

  // The whole schedule's value, taken from the generated events rather than
  // shares * price, so the unvested line lands exactly on zero at full vest
  // even when a schedule's length is not a whole number of vest periods.
  const totalScheduleValue = allEvents.reduce((sum, e) => sum + e.vestValue, 0)

  // Calculate cumulative vested before the window starts
  const windowStartDate = timeMode === 'current-year' ? new Date(targetYear, 0, 1) : new Date(targetYear, currentMonth, 1);
  const vestedBeforeWindow = allEvents.filter(e => e.date && new Date(e.date) < windowStartDate).reduce((sum, e) => sum + e.vestValue, 0);
  let cumulativeVested = vestedBeforeWindow;

  const chartData = displayMonths.map(dm => {
    const dataRow: Record<string, string | number> = { monthLabel: dm.label, vestValue: 0 }
    let totalVestThisMonth = 0

    primaryPackage.rsuGrants.forEach((grant) => {
      const grantKey = grant.id
      const eventsThisMonth = allEvents.filter(e => {
        if (!e.date || e.grantId !== grant.id) return false;
        const eventDate = new Date(e.date);
        return eventDate.getMonth() === dm.monthIndex && eventDate.getFullYear() === dm.year;
      })
      const vestValue = eventsThisMonth.reduce((sum, e) => sum + e.vestValue, 0)
      dataRow[grantKey] = vestValue
      totalVestThisMonth += vestValue
    })

    cumulativeVested += totalVestThisMonth;
    dataRow.vestValue = totalVestThisMonth;
    // What is still locked up. Clamped at zero because a schedule that has
    // fully vested must read as nothing outstanding, never as a small
    // negative from floating point drift.
    dataRow.unvestedRemaining = Math.max(0, totalScheduleValue - cumulativeVested);

    return dataRow;
  })

  // Padding rows that bracket the window. See vestingPadding.ts for why both
  // are needed and what each one carries.
  const emptyGrantValues = Object.fromEntries(primaryPackage.rsuGrants.map((g) => [g.id, 0]))
  const lastRow = chartData[chartData.length - 1]
  chartData.unshift({
    ...emptyGrantValues,
    monthLabel: LEADING_LABEL,
    vestValue: 0,
    unvestedRemaining: Math.max(0, totalScheduleValue - vestedBeforeWindow),
  })
  if (lastRow) {
    chartData.push({
      ...emptyGrantValues,
      monthLabel: TRAILING_LABEL,
      vestValue: 0,
      unvestedRemaining: lastRow.unvestedRemaining,
    })
  }

  return (
    <WidgetWrapper
      title="Equity Vesting Schedule"
      titleAdornment={!isDesktop && (
        <InfoButton label="About Share Valuation" inline><p>Valued at {cad(primaryPackage.companyCurrentPrice)} per share.</p></InfoButton>
      )}
    >
      <div className="flex flex-col gap-4">
        <ChartFigure
          label={`Equity vesting schedule across ${primaryPackage.rsuGrants.length} grants, totalling ${cad(totalScheduleValue)}, with ${cad(Math.max(0, totalScheduleValue - cumulativeVested))} still unvested`}
          className="w-full h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }} accessibilityLayer={false}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
              <XAxis 
                dataKey="monthLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                tickFormatter={(label: string) => (isPaddingLabel(label) ? '' : label)}
              />
              <YAxis
                yAxisId="left"
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} 
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              />
              <Tooltip 
                content={<CustomEquityTooltip />} 
                cursor={{ fill: 'var(--color-border)' }} 
              />
              {/* Recharts paints an Area in a lower z-layer than a Bar regardless
                  of declaration order, so the bars sit over this fill rather than
                  under it. `linear`, not `monotone`: the data points are monthly
                  and the value genuinely holds flat between vests, so the only
                  interpolation is the single month leading into each vest. A
                  monotone curve would instead bend through every flat month and
                  imply equity accrues continuously, which cliff vesting does not. */}
              <Area
                yAxisId="right"
                type="linear"
                dataKey="unvestedRemaining"
                name="Unvested Remaining"
                stroke="var(--unvested)"
                strokeWidth={2}
                fill="var(--unvested)"
                fillOpacity={0.09}
                dot={false}
                activeDot={false}
              />
              {primaryPackage.rsuGrants.map((grant, index) => (
                <Bar
                  key={grant.id}
                  yAxisId="left"
                  dataKey={grant.id}
                  name={grant.grantName}
                  stackId="a"
                  fill={COLORS[index % COLORS.length]}
                  opacity={0.8}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFigure>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <ChartLegend centered={!isDesktop} items={[
            ...primaryPackage.rsuGrants.map((grant, index) => ({
              name: grant.grantName,
              color: COLORS[index % COLORS.length],
            })),
            { name: 'Unvested Remaining', color: 'var(--unvested)' },
          ]} />
          {isDesktop && (
            <span className="text-meta text-[var(--color-text-secondary)]">
              Valued at {cad(primaryPackage.companyCurrentPrice)} per share
            </span>
          )}
        </div>
      </div>
    </WidgetWrapper>
  )
}
