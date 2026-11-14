import React, { useState } from 'react'
import { NotebookText, Plus, Trash2 } from 'lucide-react'
import { useTradesStore } from '../../store/useTradesStore'
import { usePortfolioStore } from '../../store/usePortfolioStore'
import { useUndoStore } from '../../store/useUndoStore'
import type { Trade } from '../../types/trades'
import { resultsByTicker, totalRealized } from '../../utils/investments/realized'
import { formatMoney } from '../planner/format'
import { PHONE_HOLDINGS_LIMIT, useShowMore } from '../../hooks/useShowMore'
import { EmptyState } from '../ui/EmptyState'
import { NumberInput } from '../ui/NumberInput'
import { ShowMoreButton } from '../ui/ShowMoreButton'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'

const tone = (n: number) => (n >= 0 ? 'text-accent' : 'text-error')
const FIELD = 'w-full bg-bg-secondary border border-border rounded-lg px-3 text-[14px] text-text-primary focus:border-accent focus:outline-none'

const Chip: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone: t }) => (
  <div className="flex-1 min-w-0 rounded-lg bg-bg-primary/50 px-3 py-2">
    <p className="text-meta uppercase tracking-wide text-text-secondary">{label}</p>
    <p className={`text-[14px] font-semibold tabular-nums truncate ${t ?? 'text-text-primary'}`}>{value}</p>
  </div>
)

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-meta uppercase tracking-wide text-text-secondary">{label}</span>
    {children}
  </label>
)

/** The record-a-trade form in one column, with Buy and Sell as a segmented control. */
const TradeForm: React.FC<{ onAdded: () => void }> = ({ onAdded }) => {
  const addTrade = useTradesStore((s) => s.addTrade)
  const [ticker, setTicker] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState(0)
  const [price, setPrice] = useState(0)
  const [fees, setFees] = useState(0)
  const [account, setAccount] = useState('Default')

  const submit = () => {
    if (!ticker.trim() || quantity <= 0 || price <= 0) return
    addTrade({ date, ticker, account, side, quantity, price, fees, currency: 'CAD', exchange: undefined })
    setTicker('')
    setQuantity(0)
    setPrice(0)
    setFees(0)
    onAdded()
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Side" className="flex rounded-full bg-bg-primary/50 p-0.5">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={side === s}
            onClick={() => setSide(s)}
            className={`flex-1 h-9 rounded-full text-[14px] font-medium ${side === s ? (s === 'buy' ? 'bg-accent text-bg-primary' : 'bg-error text-bg-primary') : 'text-text-secondary'}`}
          >
            {s === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ticker">
          <input type="text" aria-label="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="VFV" className={FIELD} />
        </Field>
        <Field label="Date">
          <ThemedDatePicker ariaLabel="Trade date" value={date} onChange={setDate} className="bg-bg-secondary border-border rounded-lg text-[14px]" />
        </Field>
        <Field label="Quantity">
          <NumberInput value={quantity} onCommit={setQuantity} ariaLabel="Quantity" placeholder="0" className={FIELD} />
        </Field>
        <Field label="Price">
          <NumberInput value={price} onCommit={setPrice} ariaLabel="Price per unit" placeholder="0" className={FIELD} />
        </Field>
        <Field label="Fees">
          <NumberInput value={fees} onCommit={setFees} ariaLabel="Fees" placeholder="0" className={FIELD} />
        </Field>
        <Field label="Account">
          <input type="text" aria-label="Account" value={account} onChange={(e) => setAccount(e.target.value)} className={FIELD} />
        </Field>
      </div>
      <button type="button" onClick={submit} className="h-11 rounded-lg bg-accent text-bg-primary text-[14px] font-semibold">
        Add Trade
      </button>
    </div>
  )
}

interface Position { ticker: string; quantity: number; avgCost: number; realized: number }

const PositionRow: React.FC<{ r: Position; imported: number }> = ({ r, imported }) => {
  const mismatch = imported > 0 && Math.abs(imported - r.quantity) > 0.001
  return (
    <div data-testid={`position-${r.ticker}`} className="flex items-center gap-3 py-2 min-h-[56px] border-b border-border last:border-b-0">
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-text-primary">{r.ticker}</span>
        <span className="block text-meta text-text-secondary tabular-nums">{r.quantity} Units · Avg {formatMoney(r.avgCost)}</span>
      </span>
      <span className="text-right shrink-0">
        <span className={`block text-[14px] font-medium tabular-nums ${tone(r.realized)}`}>{r.realized >= 0 ? '+' : ''}{formatMoney(r.realized)}</span>
        {mismatch ? (
          <span className="inline-block rounded-full px-2 py-0.5 text-meta font-semibold bg-error/15 text-error">Holding Says {imported}</span>
        ) : (
          <span className="block text-meta text-text-secondary">Realized</span>
        )}
      </span>
    </div>
  )
}

const LogRow: React.FC<{ t: Trade; onDelete: (t: Trade) => void }> = ({ t, onDelete }) => (
  <div className="flex items-center gap-3 py-2 min-h-[56px] border-b border-border last:border-b-0">
    <span className={`shrink-0 w-12 text-center rounded-full py-0.5 text-meta font-semibold ${t.side === 'buy' ? 'bg-bg-primary/60 text-text-secondary' : 'bg-accent/15 text-accent'}`}>
      {t.side === 'buy' ? 'Buy' : 'Sell'}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-[15px] font-semibold text-text-primary">{t.ticker}</span>
      <span className="block text-meta text-text-secondary truncate">{t.date} · {t.account}</span>
    </span>
    <span className="text-right shrink-0">
      <span className="block text-[14px] font-medium text-text-primary tabular-nums">{formatMoney(t.quantity * t.price)}</span>
      <span className="block text-meta text-text-secondary tabular-nums">{t.quantity} @ {formatMoney(t.price)}</span>
    </span>
    <button
      type="button"
      aria-label={`Delete ${t.side} of ${t.ticker} on ${t.date}`}
      onClick={() => onDelete(t)}
      className="tap-exempt h-11 w-9 shrink-0 flex items-center justify-center text-text-secondary"
    >
      <Trash2 size={14} />
    </button>
  </div>
)

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleString('en-CA', { month: 'long', year: 'numeric' })

/** The phone Trades tab: realized figures on top, the record-a-trade form in a
 *  closed fold, the positions the trades add up to, then the log grouped by
 *  month, newest first. Desktop keeps TradesView's own layout. */
export const TradesMobile: React.FC = () => {
  const trades = useTradesStore((s) => s.trades)
  const addTrade = useTradesStore((s) => s.addTrade)
  const removeTrade = useTradesStore((s) => s.removeTrade)
  const holdings = usePortfolioStore((s) => s.holdings)
  const offerUndo = useUndoStore((s) => s.offerUndo)
  const [formOpen, setFormOpen] = useState(false)

  const year = new Date().getFullYear()
  const results = resultsByTicker(trades)
  // A holding with no trades at all is the most severe reconciliation gap, so
  // it gets a zero row and can still show the "Holding Says" badge.
  const traded = new Set(results.map((r) => r.ticker.toUpperCase()))
  const untraded = Array.from(new Set(holdings.map((h) => h.ticker.toUpperCase()).filter((t) => !traded.has(t))))
  const positions: Position[] = trades.length === 0
    ? results
    : [...results, ...untraded.map((ticker) => ({ ticker, quantity: 0, avgCost: 0, realized: 0 }))]
  const heldQuantity = (t: string) => holdings.filter((h) => h.ticker.toUpperCase() === t).reduce((s, h) => s + h.quantity, 0)

  const log = [...trades].sort((a, b) => b.date.localeCompare(a.date))
  const more = useShowMore(log, PHONE_HOLDINGS_LIMIT)
  const months = [...new Set(more.visible.map((t) => t.date.slice(0, 7)))]

  const onDelete = (t: Trade) => {
    removeTrade(t.id)
    offerUndo(`Deleted ${t.side} of ${t.ticker}`, () => {
      const rest = { ...t } as Partial<Trade>
      delete rest.id
      addTrade(rest as Omit<Trade, 'id'>)
    })
  }

  const all = totalRealized(trades)
  const thisYear = totalRealized(trades, year)

  return (
    <div className="flex flex-col gap-3">
      <div data-testid="realized-summary" className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <div>
          <p className="text-[12px] uppercase text-text-secondary">Realized, All Time</p>
          <p data-key-figure className={`text-[34px] font-semibold tabular-nums leading-none mt-2 ${tone(all)}`}>{formatMoney(all)}</p>
        </div>
        <div className="flex gap-2">
          <Chip label={`Realized ${year}`} value={formatMoney(thisYear)} tone={tone(thisYear)} />
          <Chip label="Trades" value={String(trades.length)} />
        </div>
      </div>

      <details open={formOpen} onToggle={(e) => setFormOpen(e.currentTarget.open)} className="themed-card rounded-lg">
        <summary className="min-h-[48px] px-4 flex items-center justify-between cursor-pointer text-[14px] font-semibold text-text-primary">
          Record a Trade <Plus className="w-4 h-4 text-text-secondary" aria-hidden="true" />
        </summary>
        <div className="px-4 pb-4"><TradeForm onAdded={() => setFormOpen(false)} /></div>
      </details>

      {trades.length === 0 ? (
        <div className="themed-card rounded-lg p-6">
          <EmptyState
            icon={NotebookText}
            message="No trades yet"
            hint="Record your buys and sells to see realized gains and your adjusted cost base."
          />
        </div>
      ) : (
        <>
          <div className="themed-card rounded-lg p-4">
            <h2 className="text-[15px] font-semibold text-text-primary pb-1">Positions</h2>
            <div>{positions.map((r) => <PositionRow key={r.ticker} r={r} imported={heldQuantity(r.ticker.toUpperCase())} />)}</div>
          </div>

          <div className="themed-card rounded-lg p-4">
            <h2 className="text-[15px] font-semibold text-text-primary pb-1">Trade Log</h2>
            {months.map((m) => (
              <div key={m}>
                <p className="text-meta uppercase tracking-wide text-text-secondary pt-3 pb-1 border-b border-border">{monthLabel(m)}</p>
                {more.visible.filter((t) => t.date.startsWith(m)).map((t) => <LogRow key={t.id} t={t} onDelete={onDelete} />)}
              </div>
            ))}
            {more.truncates && (
              <ShowMoreButton
                total={log.length}
                noun="trades"
                expanded={more.expanded}
                onToggle={more.toggle}
                labels={{ more: `Show All ${log.length} Trades`, less: 'Show Fewer' }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
