import React, { useState } from 'react'
import { Trash2, NotebookText } from 'lucide-react'
import { useTradesStore } from '../../store/useTradesStore'
import { usePortfolioStore } from '../../store/usePortfolioStore'
import { useUndoStore } from '../../store/useUndoStore'
import { resultsByTicker, totalRealized } from '../../utils/investments/realized'
import { formatMoney } from '../planner/format'
import { EmptyState } from '../ui/EmptyState'
import { NumberInput } from '../ui/NumberInput'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { TradesMobile } from './TradesMobile'

/** Phones get TradesMobile; this is the desktop layout. */
const TradesDesktop: React.FC = () => {
  const trades = useTradesStore((s) => s.trades)
  const addTrade = useTradesStore((s) => s.addTrade)
  const removeTrade = useTradesStore((s) => s.removeTrade)
  const holdings = usePortfolioStore((s) => s.holdings)
  const offerUndo = useUndoStore((s) => s.offerUndo)

  const [ticker, setTicker] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState(0)
  const [price, setPrice] = useState(0)
  const [fees, setFees] = useState(0)
  const [account, setAccount] = useState('Default')

  const results = resultsByTicker(trades)
  const thisYear = new Date().getFullYear()

  /** A holding with no trades at all is the most severe reconciliation gap:
   *  the user forgot to enter any trade for it, so the trade-derived list
   *  above stays silent. Add a zero row for every such ticker so the
   *  "holding says N" badge can still fire. */
  const tradeTickers = new Set(results.map((r) => r.ticker.toUpperCase()))
  const untradedHoldingTickers = Array.from(
    new Set(
      holdings
        .map((h) => h.ticker.toUpperCase())
        .filter((t) => !tradeTickers.has(t))
    )
  )
  const positions =
    trades.length === 0
      ? results
      : [
          ...results,
          ...untradedHoldingTickers.map((ticker) => ({ ticker, quantity: 0, avgCost: 0, realized: 0 })),
        ]

  const submit = () => {
    if (!ticker.trim() || quantity <= 0 || price <= 0) return
    addTrade({ date, ticker, account, side, quantity, price, fees, currency: 'CAD', exchange: undefined })
    setTicker('')
    setQuantity(0)
    setPrice(0)
    setFees(0)
  }

  /** Imported holdings are a snapshot from the broker; the trade log is what you
   *  told this app. A mismatch usually means a trade was never entered. */
  const holdingQuantity = (t: string) =>
    holdings.filter((h) => h.ticker.toUpperCase() === t).reduce((s, h) => s + h.quantity, 0)

  return (
    <div className="flex flex-col gap-6">
      <div data-testid="realized-summary" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="themed-card rounded-lg p-4">
          <p className="text-[12px] text-text-secondary">Realized, all time</p>
          <p className="text-[20px] font-semibold text-text-primary">{formatMoney(totalRealized(trades))}</p>
        </div>
        <div className="themed-card rounded-lg p-4">
          <p className="text-[12px] text-text-secondary">Realized in {thisYear}</p>
          <p className="text-[20px] font-semibold text-text-primary">{formatMoney(totalRealized(trades, thisYear))}</p>
        </div>
        <div className="themed-card rounded-lg p-4">
          <p className="text-[12px] text-text-secondary">Trades recorded</p>
          <p className="text-[20px] font-semibold text-text-primary">{trades.length}</p>
        </div>
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold text-text-primary">Record a trade</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="text"
            aria-label="Ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="VFV"
            className="bg-bg-secondary border border-border rounded-md p-2 text-[14px] text-text-primary focus:border-accent focus:outline-none"
          />
          <ThemedDatePicker
            ariaLabel="Trade date"
            value={date}
            onChange={setDate}
            className="bg-bg-secondary border-border rounded-md text-[14px]"
          />
          <ThemedSelect
            ariaLabel="Side"
            value={side}
            onChange={(v) => setSide(v as 'buy' | 'sell')}
            options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]}
          />
          <input
            type="text"
            aria-label="Account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="bg-bg-secondary border border-border rounded-md p-2 text-[14px] text-text-primary focus:border-accent focus:outline-none"
          />
          <NumberInput value={quantity} onCommit={setQuantity} ariaLabel="Quantity" placeholder="Quantity"
            className="bg-bg-secondary border border-border rounded-md p-2 text-[14px] text-text-primary focus:border-accent focus:outline-none" />
          <NumberInput value={price} onCommit={setPrice} ariaLabel="Price per unit" placeholder="Price"
            className="bg-bg-secondary border border-border rounded-md p-2 text-[14px] text-text-primary focus:border-accent focus:outline-none" />
          <NumberInput value={fees} onCommit={setFees} ariaLabel="Fees" placeholder="Fees"
            className="bg-bg-secondary border border-border rounded-md p-2 text-[14px] text-text-primary focus:border-accent focus:outline-none" />
          <button
            type="button"
            onClick={submit}
            className="px-4 py-2 rounded-md bg-accent text-[var(--color-bg-primary)] text-[14px] font-medium"
          >
            Add trade
          </button>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="themed-card rounded-lg p-10">
          <EmptyState
            icon={NotebookText}
            message="No trades yet"
            hint="Record your buys and sells to see realized gains and your adjusted cost base."
          />
        </div>
      ) : (
        <>
          <div className="themed-card rounded-lg p-4">
            <h2 className="text-[16px] font-semibold text-text-primary mb-3">Positions from your trades</h2>
            <div className="flex flex-col gap-2">
              {positions.map((r) => {
                const imported = holdingQuantity(r.ticker)
                const mismatch = imported > 0 && Math.abs(imported - r.quantity) > 0.001
                return (
                  <div key={r.ticker} data-testid={`position-${r.ticker}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 border-b border-border/50">
                    <span className="text-[14px] font-medium text-text-primary w-16">{r.ticker}</span>
                    <span className="text-[13px] text-text-secondary">{r.quantity} units</span>
                    <span className="text-[13px] text-text-secondary">avg cost {formatMoney(r.avgCost)}</span>
                    <span className={`text-[13px] ${r.realized >= 0 ? 'text-accent' : 'text-error'}`}>
                      realized {formatMoney(r.realized)}
                    </span>
                    {mismatch && (
                      <span className="text-[12px] px-2 py-0.5 rounded-md bg-error/10 text-error">
                        holding says {imported}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="themed-card rounded-lg p-4">
            <h2 className="text-[16px] font-semibold text-text-primary mb-3">Trade log</h2>
            <div className="flex flex-col gap-1">
              {[...trades].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/50 text-[13px]">
                  <span className="text-text-secondary tabular-nums w-24">{t.date}</span>
                  <span className="text-text-primary font-medium w-16">{t.ticker}</span>
                  <span className={t.side === 'buy' ? 'text-text-secondary' : 'text-accent'}>{t.side}</span>
                  <span className="text-text-secondary">{t.quantity} @ {formatMoney(t.price)}</span>
                  <span className="text-text-secondary truncate">{t.account}</span>
                  <button
                    type="button"
                    aria-label={`Delete ${t.side} of ${t.ticker} on ${t.date}`}
                    onClick={() => {
                      removeTrade(t.id)
                      offerUndo(`Deleted ${t.side} of ${t.ticker}`, () => {
                        const rest = { ...t } as Partial<typeof t>
                        delete rest.id
                        addTrade(rest as Omit<typeof t, 'id'>)
                      })
                    }}
                    className="ml-auto p-2 text-text-secondary hover:text-error rounded-md"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export const TradesView: React.FC = () => (useIsDesktop() ? <TradesDesktop /> : <TradesMobile />)
