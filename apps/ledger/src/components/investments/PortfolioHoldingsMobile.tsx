import React, { useRef, useState } from 'react'
import type { Holding } from '../../store/usePortfolioStore'
import { bookValue, holdingPlDollars, holdingPlPct, marketValue, type FxRates } from '../../utils/investments/portfolioMetrics'
import { formatMoney } from '../planner/format'
import { DataFreshness } from '../ui/DataFreshness'
import { pct, share } from './holdingMetrics'

export interface PortfolioHoldingsMobileProps {
  accounts: { account: string; holdings: Holding[] }[]
  /** Already the safe price: live when it converts, average cost otherwise. */
  priceFor: (h: Holding) => number
  valueCadOf: (h: Holding) => number
  plCadOf: (h: Holding) => number
  totalValueCad: number
  importedAt: string | number | null
  rates: FxRates
  fx: { source: 'override' | 'live' | 'cache'; asOf?: string; stale: boolean; refresh: () => void }
  clearHoldings: () => void
}

type SortKey = 'value' | 'pl' | 'name'
type Filter = 'all' | 'up' | 'down'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'value', label: 'Value' },
  { key: 'pl', label: 'P/L' },
  { key: 'name', label: 'A to Z' },
]

const tone = (n: number) => (n >= 0 ? 'text-accent' : 'text-error')

const Row: React.FC<{ holding: Holding; p: PortfolioHoldingsMobileProps }> = ({ holding: h, p }) => {
  const [open, setOpen] = useState(false)
  const price = p.priceFor(h)
  const pl = holdingPlDollars(h, price)
  const plPct = holdingPlPct(h, price)
  const weight = p.totalValueCad > 0 ? (p.valueCadOf(h) / p.totalValueCad) * 100 : null
  const detailId = `holding-detail-${h.id}`
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        aria-label={`Details for ${h.ticker}`}
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[56px] py-2 flex items-center gap-3 text-left rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-text-primary">{h.ticker}</span>
          <span className="block text-meta text-text-secondary tabular-nums">
            {h.quantity} {h.quantity === 1 ? 'Share' : 'Shares'} · {share(weight)}
            {h.currency === null && <span className="text-error"> · Set currency</span>}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[14px] font-medium text-text-primary tabular-nums">{formatMoney(marketValue(h, price))}</span>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-meta font-semibold tabular-nums ${pl >= 0 ? 'bg-accent/15 text-accent' : 'bg-error/15 text-error'}`}
          >
            {pct(plPct)}
          </span>
        </span>
      </button>
      {open && (
        <dl id={detailId} className="grid grid-cols-2 gap-2 pb-3 text-[13px]">
          {[
            ['Price', price.toFixed(2)],
            ['Avg cost', h.avgCost.toFixed(2)],
            ['Book', formatMoney(bookValue(h))],
            ['P/L', `${pl >= 0 ? '+' : ''}${formatMoney(pl)}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-bg-primary/50 px-2 py-1.5">
              <dt className="text-meta uppercase tracking-wide text-text-secondary">{label}</dt>
              <dd className={`tabular-nums ${label === 'P/L' ? tone(pl) : 'text-text-primary'}`}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Two taps, so a stray touch cannot wipe the portfolio. */
const ClearButton: React.FC<{ count: number; onClear: () => void }> = ({ count, onClear }) => {
  const [armed, setArmed] = useState(false)
  return armed ? (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onClear} className="h-10 px-4 rounded-lg bg-error text-bg-primary text-[14px] font-semibold">
        Clear all {count} holdings
      </button>
      <button type="button" onClick={() => setArmed(false)} className="h-10 px-3 text-[14px] text-text-secondary">Cancel</button>
    </div>
  ) : (
    <button type="button" onClick={() => setArmed(true)} className="h-10 px-4 rounded-lg border border-error/50 text-error text-[14px] font-medium">
      Clear Portfolio
    </button>
  )
}

/** The phone holdings list: a filter and a sort, one card per account of
 *  one-line rows, and a closed fold for the import time, exchange rates and the
 *  clear action. Replaces HoldingCardList and the footer line below the desktop
 *  breakpoint. */
export const PortfolioHoldingsMobile: React.FC<PortfolioHoldingsMobileProps> = (p) => {
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [filter, setFilter] = useState<Filter>('all')
  // Narrowing the filter shortens the list, and the page would shrink under
  // the selectors and drag them up the screen. The list keeps the height it had
  // before the first narrowing until the filter returns to All.
  const listRef = useRef<HTMLDivElement>(null)
  const [heldHeight, setHeldHeight] = useState<number | undefined>(undefined)

  const all = p.accounts.flatMap((a) => a.holdings)
  const gaining = all.filter((h) => p.plCadOf(h) >= 0).length
  const counts: Record<Filter, number> = { all: all.length, up: gaining, down: all.length - gaining }
  const keep = (h: Holding) => filter === 'all' || (filter === 'up' ? p.plCadOf(h) >= 0 : p.plCadOf(h) < 0)
  const sorted = (list: Holding[]) =>
    [...list].filter(keep).sort((a, b) =>
      sortKey === 'name' ? a.ticker.localeCompare(b.ticker)
        : sortKey === 'pl' ? p.plCadOf(b) - p.plCadOf(a)
          : p.valueCadOf(b) - p.valueCadOf(a))

  const chooseFilter = (next: Filter) => {
    if (filter === 'all' && next !== 'all' && listRef.current) setHeldHeight(listRef.current.offsetHeight)
    setFilter(next)
  }
  const sortLabel = SORTS.find((s) => s.key === sortKey)?.label
  const nextSort = () => setSortKey(SORTS[(SORTS.findIndex((s) => s.key === sortKey) + 1) % SORTS.length].key)
  const imported = p.importedAt
    ? new Date(p.importedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never'
  const rates = Object.entries(p.rates).map(([c, r]) => `${c} ${r.toFixed(4)}`).join(' · ')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Filter holdings" className="flex flex-1 min-w-0 rounded-full bg-bg-primary/50 p-0.5">
          {([['all', 'All'], ['up', 'Gainers'], ['down', 'Losers']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => chooseFilter(key)}
              className={`flex-1 basis-0 min-w-0 h-8 rounded-full text-[13px] font-medium ${filter === key ? 'bg-accent text-bg-primary' : 'text-text-secondary'}`}
            >
              {label} <span className="tabular-nums opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={nextSort}
          aria-label={`Sorted by ${sortLabel}, tap to change`}
          className="h-9 w-[84px] shrink-0 rounded-full bg-bg-primary/50 text-[13px] font-medium text-text-primary whitespace-nowrap text-center"
        >
          ↕ {sortLabel}
        </button>
      </div>

      <div ref={listRef} style={{ minHeight: filter === 'all' ? undefined : heldHeight }} className="flex flex-col gap-3">
        {p.accounts.map((a) => {
          const value = a.holdings.reduce((s, h) => s + p.valueCadOf(h), 0)
          const pl = a.holdings.reduce((s, h) => s + p.plCadOf(h), 0)
          const list = sorted(a.holdings)
          return (
            <div key={a.account} data-testid={`portfolio-mobile-${a.account}`} className="themed-card rounded-lg p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-text-primary">
                  {a.account} <span className="text-text-secondary font-normal text-[13px]">{a.holdings.length}</span>
                </h3>
                <p className="text-[13px] tabular-nums text-text-secondary">
                  {formatMoney(value)} <span className={tone(pl)}>{pl >= 0 ? '+' : ''}{formatMoney(pl)}</span>
                </p>
              </div>
              {list.length === 0 ? (
                <p className="text-[13px] text-text-secondary py-2">No {filter === 'up' ? 'gainers' : 'losers'} in this account.</p>
              ) : (
                <div>{list.map((h) => <Row key={h.id} holding={h} p={p} />)}</div>
              )}
            </div>
          )
        })}
      </div>

      <details className="themed-card rounded-lg">
        <summary className="min-h-[48px] px-4 flex items-center justify-between gap-3 cursor-pointer text-[13px] text-text-secondary">
          <span>Imported {imported}</span>
          <span className="text-text-primary font-medium">Details</span>
        </summary>
        <div className="px-4 pb-4 flex flex-col gap-2">
          <dl className="flex flex-col text-[13px]">
            <div className="flex justify-between gap-3 py-2 border-b border-border">
              <dt className="text-text-secondary">Imported</dt>
              <dd className="text-text-primary tabular-nums">{imported}</dd>
            </div>
            <div className="flex justify-between gap-3 py-2 border-b border-border">
              <dt className="text-text-secondary">Rates into CAD</dt>
              <dd className="text-text-primary tabular-nums text-right">{rates || 'None needed'}</dd>
            </div>
            {p.fx.asOf && (
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-text-secondary">Rate Freshness</dt>
                {/* The refresh button is a 44px touch target; the negative margins pull its box back so the row is no taller than its neighbours and the icon lines up with their right edge. */}
                <dd className="flex items-center justify-end -my-3 -mr-[15px]">
                  <DataFreshness source={p.fx.source} asOf={p.fx.asOf} stale={p.fx.stale} onRefresh={p.fx.refresh} label="exchange rate" />
                </dd>
              </div>
            )}
          </dl>
          <div className="self-start">
            <ClearButton count={all.length} onClear={p.clearHoldings} />
          </div>
        </div>
      </details>
    </div>
  )
}
