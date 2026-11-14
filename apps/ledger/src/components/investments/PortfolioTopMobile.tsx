import React, { useState } from 'react'
import type { Holding } from '../../store/usePortfolioStore'
import { allocationBreakdown, type AllocationBy, type FxRates } from '../../utils/investments/portfolioMetrics'
import { portfolioHighlights } from '../../utils/investments/portfolioHighlights'
import { sliceColor } from '../../utils/chartTheme'
import { formatMoney } from '../planner/format'
import { pct } from './holdingMetrics'
import { PHONE_LIST_LIMIT, useShowMore } from '../../hooks/useShowMore'
import { ShowMoreButton } from '../ui/ShowMoreButton'

interface PortfolioTopMobileProps {
  rows: { holding: Holding; price: number }[]
  rates: FxRates
  /** Retries the exchange rate fetch when holdings were left out of the totals. */
  onRetryRates: () => void
}

/** The by-holding cut folds everything past eight slices into "Other"; account
 *  and currency are uncapped, as in AllocationBars. */
const CUTS: { by: AllocationBy; label: string; noun: string; max?: number }[] = [
  { by: 'holding', label: 'Holding', noun: 'holdings', max: 8 },
  { by: 'account', label: 'Account', noun: 'accounts' },
  { by: 'currency', label: 'Currency', noun: 'currencies' },
]

const Chip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex-1 min-w-0 rounded-lg bg-bg-primary/50 px-3 py-2">
    <p className="text-meta uppercase tracking-wide text-text-secondary">{label}</p>
    <p className="text-[14px] font-semibold tabular-nums truncate text-text-primary">{value}</p>
  </div>
)

/** The phone Portfolio band: value and return, invested and count, then one
 *  allocation bar that switches between holding, account and currency. It
 *  replaces PortfolioSummary and AllocationBars below the desktop breakpoint. */
export const PortfolioTopMobile: React.FC<PortfolioTopMobileProps> = ({ rows, rates, onRetryRates }) => {
  const h = portfolioHighlights(rows, rates)
  const [by, setBy] = useState<AllocationBy>('holding')
  const cut = CUTS.find((c) => c.by === by)
  const slices = allocationBreakdown(rows, rates, by, cut?.max)
  const list = useShowMore(slices, PHONE_LIST_LIMIT)
  const { totals } = h
  const up = totals.plCad >= 0

  return (
    <div className="themed-card rounded-lg p-4 flex flex-col gap-4">
      <div>
        <p className="text-[12px] uppercase text-text-secondary">Holdings Value (CAD)</p>
        <p data-key-figure className="text-[34px] font-semibold text-text-primary tabular-nums leading-none mt-2">
          {formatMoney(totals.valueCad)}
        </p>
        <p className={`text-[14px] font-medium tabular-nums mt-2 ${up ? 'text-accent' : 'text-error'}`}>
          <span aria-hidden="true">{up ? '▲' : '▼'}</span> {up ? '+' : ''}{formatMoney(totals.plCad)}
          {totals.plPct !== null ? ` · ${pct(totals.plPct)} all-time` : ''}
        </p>
        {totals.excludedCount > 0 && (
          <p className="text-[13px] text-error mt-2">
            {totals.excludedCount} holding{totals.excludedCount === 1 ? '' : 's'} left out of these totals: no exchange rate for {totals.excludedCount === 1 ? 'its' : 'their'} currency.{' '}
            <button
              type="button"
              onClick={onRetryRates}
              className="border control-border rounded px-1.5 py-0.5 text-[12px] hover:text-error/80 hover:border-error/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Retry exchange rates
            </button>
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Chip label="Invested" value={formatMoney(totals.investedCad)} />
        <Chip label="Holdings" value={`${h.holdingCount} in ${h.accountCount}`} />
      </div>
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Allocation by" className="flex rounded-full bg-bg-primary/50 p-0.5">
          {CUTS.map((c) => (
            <button
              key={c.by}
              type="button"
              aria-pressed={by === c.by}
              onClick={() => setBy(c.by)}
              className={`flex-1 basis-0 h-8 rounded-full text-[13px] font-medium ${by === c.by ? 'bg-accent text-bg-primary' : 'text-text-secondary'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div
          role="img"
          aria-label={`Allocation by ${by}: ${slices.map((s) => `${s.name} ${s.pct.toFixed(1)}%`).join(', ')}`}
          className="flex h-5 w-full gap-px overflow-hidden rounded"
        >
          {slices.map((s, i) => <span key={s.name} className="h-full" style={{ width: `${s.pct}%`, backgroundColor: sliceColor(i) }} />)}
        </div>
        <ul id="allocation-legend" className="flex flex-col">
          {list.visible.map((s, i) => (
            <li key={s.name} className="flex items-center gap-2 py-1.5 border-b border-border last:border-b-0 text-[13px]">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: sliceColor(i) }} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-text-primary">{s.name}</span>
              <span className="tabular-nums text-text-secondary">{s.pct.toFixed(1)}%</span>
              <span className="tabular-nums text-text-primary w-20 text-right">{formatMoney(s.valueCad)}</span>
            </li>
          ))}
        </ul>
        {list.truncates && (
          <ShowMoreButton total={slices.length} noun={cut?.noun ?? 'items'} labels={{ more: `Show All ${slices.length} ${(cut?.noun ?? 'items').replace(/^./, (c) => c.toUpperCase())}`, less: 'Show Fewer' }} expanded={list.expanded} onToggle={list.toggle} controls="allocation-legend" />
        )}
      </div>
    </div>
  )
}
