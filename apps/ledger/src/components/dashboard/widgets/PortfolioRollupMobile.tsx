import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { usePortfolioRollup } from './usePortfolioRollup'
import type { PortfolioLine } from './usePortfolioRollup'
import { formatMoney } from '../../planner/format'
import { InfoButton } from '../../ui/InfoButton'
import { isStale } from '../../../services/marketData/marketDataService'
import { timeAgoLong } from '../../../utils/timeAgo'

const signed = (n: number) => `${n >= 0 ? '+' : '-'}${formatMoney(Math.abs(n))}`
const pct = (n: number | null) => (n === null ? '' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`)

const Mover: React.FC<{ title: string; line?: PortfolioLine }> = ({ title, line }) => line && (
  <div className="rounded-xl border border-border bg-bg-secondary/60 p-3 min-w-0">
    <div className="text-[13px] text-text-secondary">{title}</div>
    <div className="text-[16px] font-semibold text-text-primary truncate">{line.holding.ticker}</div>
    <div className={`text-[15px] font-medium tabular-nums ${(line.plPct ?? 0) >= 0 ? 'text-accent' : 'text-error'}`}>{pct(line.plPct)}</div>
  </div>
)

/** Phone Portfolio card: value and all-time gain, the best and weakest holding, and a count line. How
 *  fresh the prices are lives behind an info button after the title rather than under the card. */
export const PortfolioRollupMobile: React.FC = () => {
  const { holdings, importedAt, totals, lines, newestFetchedAt, accounts } = usePortfolioRollup()
  const up = totals.plCad >= 0
  const ranked = lines.filter((l) => l.plPct !== null).sort((a, b) => (b.plPct ?? 0) - (a.plPct ?? 0))
  const best = ranked[0]
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : undefined
  const freshness = newestFetchedAt
    ? `${isStale(newestFetchedAt) ? 'Stale Market Data' : 'Market Data'} (Last Updated: ${timeAgoLong(newestFetchedAt)})`
    : importedAt ? `Imported ${timeAgoLong(importedAt)}` : null

  return (
    <section className="themed-card rounded-2xl p-4" aria-label="Portfolio">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          <h2 className="text-[18px] font-semibold text-text-primary">Portfolio</h2>
          {freshness && <InfoButton label="About Portfolio Data" inline><p>{freshness}</p></InfoButton>}
        </div>
        <Link to="/investments" className="inline-flex items-center gap-0.5 min-h-11 pl-2 -mr-1 text-[14px] font-medium text-text-secondary">
          View All<ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-1 text-[30px] font-bold leading-[1.1] tabular-nums text-text-primary">{formatMoney(totals.valueCad)}</div>
      <div className="mt-1">
        <span className={`inline-flex items-center gap-1 text-[14px] font-medium ${up ? 'text-accent' : 'text-error'}`}>
          {up ? <TrendingUp size={16} aria-hidden="true" /> : <TrendingDown size={16} aria-hidden="true" />}
          {signed(totals.plCad)}{totals.plPct !== null && ` (${pct(totals.plPct)})`}
          <span className="font-normal text-text-secondary">All-Time</span>
        </span>
      </div>
      {(best || weakest) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Mover title="Best Holding" line={best} />
          <Mover title="Weakest Holding" line={weakest} />
        </div>
      )}
      <div className="mt-3 text-[13px] text-text-secondary">
        {holdings.length} Holding{holdings.length === 1 ? '' : 's'} · {accounts.length} Account{accounts.length === 1 ? '' : 's'} · CAD
      </div>
      {totals.excludedCount > 0 && (
        <span className="mt-3 block text-[13px] text-error">
          {totals.excludedCount} holding{totals.excludedCount === 1 ? '' : 's'} left out of these totals: no exchange rate for {totals.excludedCount === 1 ? 'its' : 'their'} currency.
        </span>
      )}
    </section>
  )
}
