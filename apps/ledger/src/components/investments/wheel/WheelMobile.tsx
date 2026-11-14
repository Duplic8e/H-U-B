import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, FileUp } from 'lucide-react'
import type { TickerState } from '../../../utils/investments/wheel/types'
import { calculateBreakeven, calculateNetPL, formatWheelMoney } from '../../../utils/investments/wheel/calculations'
import { useCurrentPrice } from '../../../services/marketData'
import { CURRENCIES, type Currency } from '../../../services/marketData/types'
import { useFxRates } from '../../../hooks/useFxRates'
import { toCad } from '../../../utils/investments/portfolioMetrics'
import { PHONE_HOLDINGS_LIMIT, useShowMore } from '../../../hooks/useShowMore'
import { ShowMoreButton } from '../../ui/ShowMoreButton'
import { NumberInput } from '../../ui/NumberInput'
import { formatMoney } from '../../planner/format'

export interface WheelMobileProps {
  tickers: TickerState[]
  fileCount: number
  status: string | null
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  onViewDetails: (ticker: string) => void
}

type Group = 'stock' | 'put' | 'closed'
type SortKey = 'az' | 'high' | 'low'

const isStock = (t: TickerState) => t.opSharesHeld > 0
const isPut = (t: TickerState) => t.opSharesHeld === 0 && t.hasOpenPosition
const isClosed = (t: TickerState) => t.opSharesHeld === 0 && !t.hasOpenPosition

const GROUPS: { key: Group; label: string; test: (t: TickerState) => boolean }[] = [
  { key: 'stock', label: 'Stock Wheels', test: isStock },
  { key: 'put', label: 'Puts', test: isPut },
  { key: 'closed', label: 'Closed', test: isClosed },
]
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'az', label: 'A to Z' },
  { key: 'high', label: 'Best P/L' },
  { key: 'low', label: 'Worst P/L' },
]

const tone = (n: number) => (n >= 0 ? 'text-accent' : 'text-error')
const asCurrency = (c?: string): Currency | null => (CURRENCIES as readonly string[]).includes(c ?? '') ? (c as Currency) : null
const signed = (n: number, currency?: string) => `${n >= 0 ? '+' : ''}${formatWheelMoney(n, currency)}`
const signedCad = (n: number) => `${n > 0 ? '+' : ''}${formatMoney(n)}`

/** Statement price for the net figure used in sorting and the totals. Live
 *  quotes are fetched per row, so this deliberately uses the statement's own
 *  price, which every ticker has. */
const statementNet = (t: TickerState) => calculateNetPL(t, t.currentPrice)

const Chip: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone: t }) => (
  <div className="flex-1 min-w-0 rounded-lg bg-bg-primary/50 px-3 py-2">
    <p className="text-meta uppercase tracking-wide text-text-secondary">{label}</p>
    <p className={`text-[14px] font-semibold tabular-nums truncate ${t ?? 'text-text-primary'}`}>{value}</p>
  </div>
)

const Detail: React.FC<{ t: TickerState; spot: number; setManual: (v: number) => void; onViewDetails: (ticker: string) => void }> = ({ t, spot, setManual, onViewDetails }) => {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const priceRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (editing) priceRef.current?.querySelector('input')?.focus()
  }, [editing])
  const be = calculateBreakeven(t)
  const money = (v: number) => formatWheelMoney(v, t.currency)
  const copy = () => {
    const text =
      `${t.ticker} Wheel Strategy Summary\n` +
      `• Shares Held: ${isStock(t) ? t.opSharesHeld : '0'}\n` +
      `• Cost of Shares: ${isStock(t) ? money(t.displayCost) : 'N/A'}\n` +
      `• Premium Collected: ${money(t.premiumCollected)}\n` +
      `• True Breakeven: ${Number.isNaN(be) ? 'N/A' : money(be)}\n` +
      `• Current Spot Price: ${money(spot)}\n` +
      `• Net P/L: ${money(calculateNetPL(t, spot))}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const cells: [string, string][] = [
    ['Cost of Shares', isStock(t) ? money(t.displayCost) : 'N/A'],
    ['Premium', money(t.premiumCollected)],
    ['Breakeven', Number.isNaN(be) ? 'N/A' : money(be)],
  ]
  return (
    <div className="pb-3 flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2 text-[13px]">
        {cells.map(([label, value]) => (
          <div key={label} className="rounded-md bg-bg-primary/50 px-2 py-1.5">
            <dt className="text-meta uppercase tracking-wide text-text-secondary">{label}</dt>
            <dd className="tabular-nums text-text-primary">{value}</dd>
          </div>
        ))}
        <div className="rounded-md bg-bg-primary/50 px-2 py-1.5">
          <dt className="text-meta uppercase tracking-wide text-text-secondary">Stock Price{t.currency ? ` (${t.currency})` : ''}</dt>
          <dd ref={priceRef} onBlur={() => setEditing(false)}>
            {/* The page-wide 44px, 16px input rule would make this cell taller and
                larger than its neighbours, so it reads as text and becomes the
                input only while it is being edited. */}
            {editing ? (
              <NumberInput
                value={spot}
                ariaLabel={`Stock price for ${t.ticker}`}
                onCommit={(v) => { if (v > 0) setManual(v) }}
                className="tap-exempt block w-full min-h-0 h-5 bg-transparent p-0 m-0 border-0 leading-5 text-left tabular-nums outline-none text-accent"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Stock price for ${t.ticker}, tap to edit`}
                className="tap-exempt block w-full min-h-0 p-0 text-left tabular-nums text-text-primary"
              >
                {money(spot)}
              </button>
            )}
          </dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <button type="button" onClick={() => onViewDetails(t.ticker)} className="flex-1 h-10 rounded-lg border border-border text-[14px] font-medium text-text-primary">
          View Details
        </button>
        <button type="button" onClick={copy} aria-label="Copy summary" className="h-10 w-12 rounded-lg border border-border text-text-secondary flex items-center justify-center">
          {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

const Row: React.FC<{ t: TickerState; onViewDetails: (ticker: string) => void }> = ({ t, onViewDetails }) => {
  const price = useCurrentPrice(t.ticker)
  // override/live/cached quote wins; the statement price is the fallback
  const spot = price.data?.value.price ?? t.currentPrice
  const [open, setOpen] = useState(false)
  const pl = calculateNetPL(t, spot)
  const yieldPct = isStock(t) && t.displayCost > 0 ? (t.premiumCollected / t.displayCost) * 100 : null
  const detailId = `wheel-detail-${t.ticker}`
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        aria-label={`Details for ${t.ticker}`}
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[56px] py-2 flex items-center gap-3 text-left rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-text-primary">{t.ticker}</span>
          <span className="block text-meta text-text-secondary tabular-nums">
            {isStock(t) ? `${t.opSharesHeld.toLocaleString()} ${t.opSharesHeld === 1 ? 'Share' : 'Shares'}` : isPut(t) ? 'Puts Only' : 'Closed'}
            {t.currency ? ` · ${t.currency}` : ''}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[14px] font-medium text-text-primary tabular-nums">{signed(pl, t.currency)}</span>
          {yieldPct !== null && (
            <span className={`inline-block rounded-full px-2 py-0.5 text-meta font-semibold tabular-nums ${yieldPct >= 0 ? 'bg-accent/15 text-accent' : 'bg-error/15 text-error'}`}>
              {yieldPct.toFixed(1)}% Yield
            </span>
          )}
        </span>
      </button>
      {open && (
        <div id={detailId}>
          <Detail t={t} spot={spot} setManual={price.setManual} onViewDetails={onViewDetails} />
        </div>
      )}
    </div>
  )
}

/** The phone Options tab: net P/L and premium across open wheels in CAD, the
 *  three biggest premium earners, then a segmented, searchable, sortable list
 *  of one-line rows. Importing and clearing statements live in a closed fold at
 *  the bottom. Each ticker is shown in its own statement currency. */
export const WheelMobile: React.FC<WheelMobileProps> = (p) => {
  const [group, setGroup] = useState<Group>('stock')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('az')

  const fx = useFxRates(useMemo(() => p.tickers.map((t) => asCurrency(t.currency)), [p.tickers]))
  // A ticker whose statement carried no currency is taken as CAD, so it counts at face value.
  const cad = (t: TickerState, amount: number) => (t.currency ? toCad(amount, asCurrency(t.currency), fx.rates) : amount)

  const open = p.tickers.filter((t) => !isClosed(t))
  const sumCad = (pick: (t: TickerState) => number) => open.reduce((s, t) => s + (cad(t, pick(t)) ?? 0), 0)
  const netTotal = sumCad(statementNet)
  const premiumTotal = sumCad((t) => t.premiumCollected)
  const top = [...open]
    .map((t) => ({ t, v: cad(t, t.premiumCollected) ?? 0 }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)

  const list = [...p.tickers.filter(GROUPS.find((g) => g.key === group)!.test)]
    .filter((t) => t.ticker.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === 'az' ? a.ticker.localeCompare(b.ticker)
      : sort === 'high' ? (cad(b, statementNet(b)) ?? 0) - (cad(a, statementNet(a)) ?? 0)
        : (cad(a, statementNet(a)) ?? 0) - (cad(b, statementNet(b)) ?? 0))
  const more = useShowMore(list, PHONE_HOLDINGS_LIMIT)
  const sortLabel = SORTS.find((s) => s.key === sort)?.label
  const nextSort = () => setSort(SORTS[(SORTS.findIndex((s) => s.key === sort) + 1) % SORTS.length].key)

  return (
    <div className="flex flex-col gap-3">
      <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <div>
          <p className="text-[12px] uppercase text-text-secondary">Net P/L, Open Wheels (CAD)</p>
          <p data-key-figure className={`text-[34px] font-semibold tabular-nums leading-none mt-2 ${tone(netTotal)}`}>{signedCad(netTotal)}</p>
        </div>
        <div className="flex gap-2">
          <Chip label="Premium" value={formatMoney(premiumTotal)} tone="text-accent" />
          <Chip label="Open" value={`${open.length} Tickers`} />
        </div>
      </div>

      {top.length > 0 && (
        <div role="group" aria-label="Top premium" className="grid grid-cols-3 gap-2">
          {top.map(({ t }) => (
            <div key={t.ticker} className="themed-card rounded-lg p-3 min-w-0">
              <p className="text-[14px] font-semibold text-text-primary truncate">{t.ticker}</p>
              <p className="text-[13px] tabular-nums text-accent truncate">{formatWheelMoney(t.premiumCollected, t.currency)}</p>
            </div>
          ))}
        </div>
      )}

      <div role="group" aria-label="Wheel status" className="flex rounded-full bg-bg-primary/50 p-0.5">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            aria-pressed={group === g.key}
            onClick={() => setGroup(g.key)}
            className={`flex-1 basis-0 min-w-0 h-8 rounded-full text-[13px] font-medium ${group === g.key ? 'bg-accent text-bg-primary' : 'text-text-secondary'}`}
          >
            {g.label} <span className="tabular-nums opacity-70">{p.tickers.filter(g.test).length}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Tickers"
          aria-label="Search Tickers"
          className="flex-1 min-w-0 h-9 rounded-full bg-bg-primary/50 border border-border px-4 text-[14px] text-text-primary outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={nextSort}
          aria-label={`Sorted by ${sortLabel}, tap to change`}
          className="h-9 w-[96px] shrink-0 rounded-full bg-bg-primary/50 text-[13px] font-medium text-text-primary text-center"
        >
          ↕ {sortLabel}
        </button>
      </div>

      <div className="themed-card rounded-lg p-4">
        {list.length === 0 ? (
          <p className="text-[13px] text-text-secondary text-center py-3">No matching tickers.</p>
        ) : (
          <>
            <div>{more.visible.map((t) => <Row key={t.ticker} t={t} onViewDetails={p.onViewDetails} />)}</div>
            {more.truncates && (
              <ShowMoreButton
                total={list.length}
                noun="tickers"
                expanded={more.expanded}
                onToggle={more.toggle}
                labels={{ more: `Show All ${list.length} Tickers`, less: 'Show Fewer' }}
              />
            )}
          </>
        )}
      </div>

      <details className="themed-card rounded-lg">
        <summary className="min-h-[48px] px-4 flex items-center justify-between gap-3 cursor-pointer text-[13px] text-text-secondary">
          <span>{p.fileCount} Statement{p.fileCount === 1 ? '' : 's'} · {p.tickers.length} Ticker{p.tickers.length === 1 ? '' : 's'}</span>
          <span className="text-text-primary font-medium">Manage</span>
        </summary>
        <div className="px-4 pb-4 flex flex-col gap-3">
          {p.status && <p className="text-[13px] text-text-secondary">{p.status}</p>}
          <div className="flex gap-2">
            <label className="h-10 px-4 rounded-lg border border-border text-[14px] font-medium text-text-primary flex items-center gap-2 cursor-pointer">
              <FileUp className="w-4 h-4" /> Add CSVs
              <input type="file" accept=".csv" multiple onChange={p.onUpload} className="sr-only" />
            </label>
            <button type="button" onClick={p.onClear} className="h-10 px-4 rounded-lg border border-error/50 text-error text-[14px] font-medium">
              Clear Data
            </button>
          </div>
        </div>
      </details>
    </div>
  )
}
