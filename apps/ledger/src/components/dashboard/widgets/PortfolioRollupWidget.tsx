import React from 'react'
import { WidgetWrapper } from '../WidgetWrapper'
import { usePortfolioRollup } from './usePortfolioRollup'
import { PortfolioRollupMobile } from './PortfolioRollupMobile'
import { useIsDesktop } from '../../../hooks/useMediaQuery'
import { formatMoney } from '../../planner/format'
import { EmptyState } from '../../ui/EmptyState'
import { InfoButton } from '../../ui/InfoButton'
import { LineChart } from 'lucide-react'
import { DataFreshness } from '../../ui/DataFreshness'
import { timeAgo } from '../../../utils/timeAgo'
import { isStale } from '../../../services/marketData/marketDataService'

export const PortfolioRollupWidget: React.FC = () => {
  const { holdings, importedAt, totals: t, newestFetchedAt, accounts } = usePortfolioRollup()
  const isDesktop = useIsDesktop()

  if (holdings.length === 0) {
    return (
      <WidgetWrapper
        title="Portfolio"
        titleAdornment={<InfoButton label="About Portfolio" inline><p>Import a broker CSV to see your portfolio value here.</p></InfoButton>}
      >
        <EmptyState icon={LineChart} message="No Holdings Available" action={{ label: 'Import a Broker CSV', to: '/investments' }} />
      </WidgetWrapper>
    )
  }

  if (!isDesktop) return <PortfolioRollupMobile />

  return (
    <WidgetWrapper title="Portfolio">
      <div className="flex flex-col gap-1 mt-2">
        <span className="text-[28px] font-bold text-accent">{formatMoney(t.valueCad)}</span>
        <span className={`text-[13px] ${t.plCad >= 0 ? 'text-accent' : 'text-error'}`}>
          {t.plCad >= 0 ? '+' : ''}{formatMoney(t.plCad)}{t.plPct !== null ? ` (${t.plPct.toFixed(1)}%)` : ''} all-time
        </span>
        <span className="text-[13px] text-text-secondary">{holdings.length} holdings · {accounts.length} account{accounts.length === 1 ? '' : 's'} · CAD</span>
        {t.excludedCount > 0 && (
          <span className="text-[13px] text-error">
            {t.excludedCount} holding{t.excludedCount === 1 ? '' : 's'} left out of these totals: no exchange rate for {t.excludedCount === 1 ? 'its' : 'their'} currency.
          </span>
        )}
        {newestFetchedAt ? (
          <DataFreshness
            source="cache"
            asOf={newestFetchedAt}
            stale={isStale(newestFetchedAt)}
          />
        ) : importedAt ? (
          <span className="text-meta text-text-secondary">Imported {timeAgo(importedAt)}</span>
        ) : null}
      </div>
    </WidgetWrapper>
  )
}
