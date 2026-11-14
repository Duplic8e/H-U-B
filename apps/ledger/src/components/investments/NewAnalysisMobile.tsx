import React, { useEffect, useRef, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useHistoricalPrice } from '../../services/marketData'
import { useAnalysisStore } from '../../store/useAnalysisStore'
import { formatMoney } from '../planner/format'
import { NumberInput } from '../ui/NumberInput'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import type { DraftRow } from './TickerRowEditor'

const FIELD = 'bg-bg-primary/50 border border-border rounded-lg px-3 text-text-primary text-[14px] outline-none focus:border-accent w-full'

const newRow = (): DraftRow => ({ key: crypto.randomUUID(), ticker: '', exchange: '', allocationPct: 0, manualPrice: null })

const Label: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <label className="flex flex-col gap-1 min-w-0">
    <span className="text-[13px] text-text-secondary truncate">{text}</span>
    {children}
  </label>
)

interface RowProps {
  index: number
  row: DraftRow
  date: string
  budget: number
  onChange: (row: DraftRow) => void
  onRemove: () => void
  onPrice: (key: string, price: number) => void
}

/** One planned position: ticker and percentage on top, a slider with one-point
 *  nudges, and Amount, Start Price and Shares underneath. The price is looked up
 *  for the analysis date; tap it to type one in when the lookup finds nothing. */
const TickerRow: React.FC<RowProps> = ({ index, row, date, budget, onChange, onRemove, onPrice }) => {
  const hist = useHistoricalPrice(row.ticker, row.exchange || undefined, date)
  const fetched = hist.data?.value.close
  const price = row.manualPrice ?? fetched ?? 0
  const [editingPrice, setEditingPrice] = useState(false)
  const priceRef = useRef<HTMLDivElement>(null)

  useEffect(() => { onPrice(row.key, price) }, [row.key, price, onPrice])
  useEffect(() => {
    if (editingPrice) priceRef.current?.querySelector('input')?.focus()
  }, [editingPrice])

  const hasTicker = row.ticker.trim() !== ''
  const amount = (budget * row.allocationPct) / 100
  const shares = price > 0 ? amount / price : 0
  const source = row.manualPrice !== null ? 'Manual' : fetched !== undefined ? 'Auto' : hist.status === 'loading' ? 'Fetching' : ''
  const nudge = (by: number) => onChange({ ...row, allocationPct: Math.min(100, Math.max(0, row.allocationPct + by)) })

  return (
    <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          aria-label={`Ticker ${index + 1}`}
          value={row.ticker}
          onChange={(e) => onChange({ ...row, ticker: e.target.value, manualPrice: null })}
          placeholder="AAPL"
          className={`${FIELD} h-11 flex-1`}
        />
        <span className="w-12 text-right text-[15px] font-semibold tabular-nums shrink-0">{row.allocationPct}%</span>
        <button type="button" onClick={onRemove} aria-label={`Remove ticker ${index + 1}`} className="tap-exempt h-11 w-9 shrink-0 flex items-center justify-center text-text-secondary">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Less" onClick={() => nudge(-1)} className="tap-exempt h-9 w-9 rounded-full bg-bg-primary/50 flex items-center justify-center text-text-secondary"><Minus className="w-4 h-4" /></button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={row.allocationPct}
          aria-label={`Allocation % ${index + 1}`}
          onChange={(e) => onChange({ ...row, allocationPct: Number(e.target.value) })}
          className="tap-exempt min-h-0 flex-1 accent-[var(--color-accent)]"
        />
        <button type="button" aria-label="More" onClick={() => nudge(1)} className="tap-exempt h-9 w-9 rounded-full bg-bg-primary/50 flex items-center justify-center text-text-secondary"><Plus className="w-4 h-4" /></button>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-[13px]">
        <div className="rounded-md bg-bg-primary/50 px-2 py-1.5 min-w-0">
          <dt className="text-meta text-text-secondary truncate">Amount</dt>
          <dd className="tabular-nums text-text-primary truncate">{formatMoney(amount)}</dd>
        </div>
        <div ref={priceRef} onBlur={() => setEditingPrice(false)} className="rounded-md bg-bg-primary/50 px-2 py-1.5 min-w-0">
          <dt className="text-meta text-text-secondary truncate">Start Price{source ? ` · ${source}` : ''}</dt>
          <dd>
            {editingPrice ? (
              <NumberInput
                ariaLabel={`Start price ${index + 1}`}
                value={price}
                onCommit={(n) => onChange({ ...row, manualPrice: n })}
                className="tap-exempt block w-full min-h-0 h-5 bg-transparent p-0 m-0 border-0 leading-5 text-accent tabular-nums outline-none"
              />
            ) : (
              <button
                type="button"
                disabled={!hasTicker}
                onClick={() => setEditingPrice(true)}
                aria-label={`Start price ${index + 1}, tap to edit`}
                className={`tap-exempt block w-full min-h-0 p-0 text-left tabular-nums truncate ${price > 0 ? 'text-text-primary' : hasTicker ? 'text-accent' : 'text-text-secondary'}`}
              >
                {price > 0 ? price.toFixed(2) : hasTicker ? 'Set Price' : '-'}
              </button>
            )}
          </dd>
        </div>
        <div className="rounded-md bg-bg-primary/50 px-2 py-1.5 min-w-0">
          <dt className="text-meta text-text-secondary truncate">Shares</dt>
          <dd className="tabular-nums text-text-primary truncate">{hasTicker && shares > 0 ? shares.toFixed(2) : '-'}</dd>
        </div>
      </dl>
    </div>
  )
}

const isField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && (t as HTMLInputElement).type !== 'range'

/** The phone New Analysis form. Replaces the five-column ticker grid, which was
 *  too narrow to type in, with stacked rows and a slider. */
export const NewAnalysisMobile: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const addAnalysis = useAnalysisStore((s) => s.addAnalysis)
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [thesis, setThesis] = useState('')
  const [budget, setBudget] = useState(10000)
  const [rows, setRows] = useState<DraftRow[]>([newRow()])
  const [typing, setTyping] = useState(false)
  const prices = useRef<Record<string, number>>({})

  const update = (key: string, row: DraftRow) => setRows((rs) => rs.map((r) => (r.key === key ? row : r)))
  const remove = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))
  const setPrice = React.useCallback((key: string, price: number) => { prices.current[key] = price }, [])
  const splitEvenly = () => setRows((rs) => {
    const named = rs.filter((r) => r.ticker.trim() !== '')
    if (named.length === 0) return rs
    const each = Math.floor((100 / named.length) * 10) / 10
    return rs.map((r) => (r.ticker.trim() !== '' ? { ...r, allocationPct: each } : r))
  })

  const valid = rows.filter((r) => r.ticker.trim() !== '' && r.allocationPct > 0)
  const sum = valid.reduce((s, r) => s + r.allocationPct, 0)
  const left = 100 - sum
  const canSave = budget > 0 && valid.length > 0

  const save = () => {
    addAnalysis({
      id: `an-${Date.now()}`,
      name: name.trim() || valid[0]?.ticker.trim().toUpperCase() || 'Analysis',
      thesis: thesis.trim() || undefined,
      analysisDate: date,
      plannedBudget: budget,
      positions: valid.map((r, i) => ({
        id: `pos-${Date.now()}-${i}`,
        ticker: r.ticker.trim().toUpperCase(),
        exchange: r.exchange.trim() || undefined,
        allocationPct: r.allocationPct,
        plannedAmount: (budget * r.allocationPct) / 100,
        startPrice: prices.current[r.key] ?? 0,
        startPriceSource: r.manualPrice !== null ? 'manual' : 'auto',
        acted: false,
        lots: [],
      })),
      swaps: [],
    })
    onClose()
  }

  // The on-screen keyboard covers the lower half of the popup. While a text
  // field has focus the pinned Save bar lets go of the bottom edge, so it
  // cannot sit over the ticker being typed, and the field scrolls to centre.
  return (
    <div
      className="flex flex-col gap-4"
      onFocusCapture={(e) => {
        if (!isField(e.target)) return
        setTyping(true)
        const el = e.target as HTMLElement
        setTimeout(() => el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 150)
      }}
      onBlurCapture={(e) => { if (!isField(e.relatedTarget)) setTyping(false) }}
    >
      <div className="flex flex-col gap-3">
        <Label text="New Analysis Name (Defaults to Ticker)">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Big Tech 2026" className={`${FIELD} h-11`} />
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Analysis Date"><ThemedDatePicker value={date} onChange={setDate} /></Label>
          <Label text="Planned Budget ($)">
            <NumberInput ariaLabel="Planned Budget ($)" value={budget} onCommit={setBudget} className={`${FIELD} h-11`} />
          </Label>
        </div>
        <details className="rounded-lg border border-border">
          <summary className="min-h-[48px] px-3 flex items-center justify-between gap-3 cursor-pointer text-[14px] text-text-primary">
            <span>Thesis <span className="text-text-secondary">(Optional)</span></span>
            {thesis && <span className="text-meta text-text-secondary truncate max-w-[50%]">{thesis}</span>}
          </summary>
          <div className="px-3 pb-3">
            <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Why this investment?" className={`${FIELD} py-2 min-h-[70px]`} />
          </div>
        </details>
      </div>

      <div className="flex flex-col gap-2 scroll-mb-32">
        {rows.map((r, i) => (
          <TickerRow key={r.key} index={i} row={r} date={date} budget={budget} onChange={(next) => update(r.key, next)} onRemove={() => remove(r.key)} onPrice={setPrice} />
        ))}
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setRows((rs) => [...rs, newRow()])} className="h-10 px-3 rounded-full bg-bg-primary/50 text-[13px] font-medium text-text-primary flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Ticker
          </button>
          <button type="button" onClick={splitEvenly} className="h-10 px-3 text-[13px] font-medium text-accent">Split Evenly</button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-text-secondary">Allocated <span className={`tabular-nums font-medium ${sum === 100 ? 'text-accent' : sum > 100 ? 'text-error' : 'text-text-primary'}`}>{sum}%</span></span>
          <span className={`tabular-nums ${left === 0 ? 'text-accent' : left < 0 ? 'text-error' : 'text-text-secondary'}`}>
            {left === 0 ? 'Fully Allocated' : left > 0 ? `${left}% Left` : `${-left}% Over`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden" aria-hidden="true">
          <div className={`h-full ${sum > 100 ? 'bg-error' : 'bg-accent'}`} style={{ width: `${Math.min(sum, 100)}%` }} />
        </div>
      </div>

      <div className={`${typing ? '' : 'sticky bottom-0'} -mx-1 px-1 pt-2 pb-1 bg-bg-secondary`}>
        <button type="button" onClick={save} disabled={!canSave} className="w-full h-11 rounded-lg bg-accent text-bg-primary text-[14px] font-semibold disabled:opacity-40">
          Save Analysis
        </button>
      </div>
    </div>
  )
}
