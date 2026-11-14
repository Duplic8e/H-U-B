import React, { useState } from 'react'
import { LineChart } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WidgetWrapper } from '../WidgetWrapper'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { formatMoney, formatMoneyCompact } from '../../planner/format'
import { chartTooltipStyles } from '../../../utils/chartTheme'
import { trendDomain } from './trendDomain'
import { NetWorthHistorySheet } from './NetWorthHistorySheet'
import { ChartFigure } from '../../ui/ChartFigure'
import { EmptyState } from '../../ui/EmptyState'

export const NetWorthTrendWidget: React.FC = () => {
  const history = useAccountsStore((s) => s.history)
  const [historyOpen, setHistoryOpen] = useState(false)

  const editHistoryAction = (
    <button
      type="button"
      onClick={() => setHistoryOpen(true)}
      className="text-[12px] text-text-secondary hover:text-accent transition-colors"
    >
      Edit History
    </button>
  )

  if (history.length < 2) {
    return (
      <WidgetWrapper title="Net Worth Over Time" className="desktop:col-span-2" action={editHistoryAction}>
        <EmptyState
          icon={LineChart}
          message="Not Enough History Yet"
          action={{ label: 'Add History', onClick: () => setHistoryOpen(true) }}
        />
        <NetWorthHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
      </WidgetWrapper>
    )
  }
  const domain = trendDomain(history.map((h) => h.value))
  return (
    <WidgetWrapper title="Net Worth Over Time" className="desktop:col-span-2" action={editHistoryAction}>
      <ChartFigure
        label={`Net worth over time from ${history[0]?.date ?? ''} to ${history[history.length - 1]?.date ?? ''}, from ${formatMoneyCompact(history[0]?.value ?? 0)} to ${formatMoneyCompact(history[history.length - 1]?.value ?? 0)}`}
        className="h-[220px] mt-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          {/* The right margin exists so the final date label has somewhere to
              go. The last tick sits on the plot's right edge and its label is
              anchored middle, so with the default 5px margin the label is
              wider than the space left for it. Recharts then shoves it left
              until its right edge lands exactly on the SVG boundary: measured
              at 1800px, the tick was at 1240 but the label's centre was 1212,
              28px off its own tick, ending flush at 1245 with a zero pixel
              gutter. Flush against the card edge is what reads as a cut off
              date. 40px clears half of the widest label (66px in the mono
              theme), so the clamp never fires and the label sits centred on
              its own tick again. Measured gutters: 7px in tactical (JetBrains
              Mono) and 8px in geometric (Inter).

              Note for anyone re-measuring this: nothing here ever overflows
              the SVG, so a guard that looks for text escaping its container
              cannot see this. The symptom is a zero gutter, not an overflow. */}
          <AreaChart data={history} accessibilityLayer={false} margin={{ top: 5, right: 40, bottom: 5, left: 5 }}>
            {/* The axes meet at the corner, so a full-precision y label like
                $316,621 sits directly against the first date and the two read as
                one string. Compact labels keep the corner legible, and match the
                axis formatting every other chart in the app uses. */}
            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} minTickGap={40} tickMargin={14} />
            <YAxis width={48} domain={domain} allowDataOverflow={false} tickFormatter={(v: number) => formatMoneyCompact(v)} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickMargin={6} />
            <Tooltip
              formatter={(value) => [formatMoney(Number(value)), 'Net worth']}
              {...chartTooltipStyles}
            />
            <Area type="monotone" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFigure>
      <NetWorthHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </WidgetWrapper>
  )
}
