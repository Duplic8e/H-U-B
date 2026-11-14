import React, { useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useHistoricalPrice } from '../../services/marketData'
import { useAnalysisStore, type Position } from '../../store/useAnalysisStore'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { NumberInput } from '../ui/NumberInput'
import { TickerRowEditor, type DraftRow } from './TickerRowEditor'
import { Sheet } from '../ui/Sheet'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { NewAnalysisMobile } from './NewAnalysisMobile'

interface AnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  /** When set, adds a position to this analysis instead of creating a new analysis. */
  analysisId?: string
}

const inputCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent w-full'

const newRow = (): DraftRow => ({
  key: crypto.randomUUID(),
  ticker: '',
  exchange: '',
  allocationPct: 0,
  manualPrice: null,
})

/** Add-position flow: adds a single position to an existing analysis, priced
 *  against that analysis's fixed analysisDate. Behavior kept as-is. */
const AddPositionModal: React.FC<{ analysisId: string; onClose: () => void }> = ({ analysisId, onClose }) => {
  const addPosition = useAnalysisStore((s) => s.addPosition)
  const existing = useAnalysisStore((s) => s.analyses.find((a) => a.id === analysisId))
  const [ticker, setTicker] = useState('')
  const [exchange, setExchange] = useState('')
  const [plannedAmount, setPlannedAmount] = useState(10000)
  const [manualPrice, setManualPrice] = useState<number | null>(null)

  const effectiveDate = existing ? existing.analysisDate : ''
  const hist = useHistoricalPrice(ticker, exchange || undefined, effectiveDate)
  const fetchedPrice = hist.data?.value.close
  const effectivePrice = manualPrice ?? fetchedPrice ?? 0

  const canSave = ticker.trim() !== '' && plannedAmount > 0 && effectiveDate !== '' && effectivePrice > 0

  const save = () => {
    const position: Position = {
      id: `pos-${Date.now()}`,
      ticker: ticker.trim().toUpperCase(),
      exchange: exchange.trim() || undefined,
      plannedAmount,
      startPrice: effectivePrice,
      startPriceSource: manualPrice !== null ? 'manual' : 'auto',
      acted: false,
      lots: [],
    }
    addPosition(analysisId, position)
    onClose()
  }

  return (
    <div className="themed-card desktop:rounded-lg desktop:p-6 flex flex-col gap-4">
      <div className="hidden desktop:flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-text-primary">Add Position: {existing?.name ?? ''}</h2>
        <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Ticker</span>
          <input className={inputCls} value={ticker} onChange={(e) => { setTicker(e.target.value); setManualPrice(null) }} placeholder="AAPL" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Exchange (Optional)</span>
          <input className={inputCls} value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="TSX" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Planned Amount ($)</span>
          <NumberInput className={inputCls} value={plannedAmount} onCommit={setPlannedAmount} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[13px] text-text-secondary block truncate whitespace-nowrap">
          Start Price {manualPrice !== null
            ? '(manual)'
            : fetchedPrice !== undefined
              ? `(auto: ${hist.data?.source}${hist.data?.stale ? ', stale' : ''})`
              : hist.status === 'loading'
                ? '(fetching…)'
                : '(enter manually or pick ticker + date)'}
        </span>
        <div className="flex gap-2 items-center">
          <NumberInput className={inputCls} value={effectivePrice} onCommit={setManualPrice} />
          <button
            onClick={() => setManualPrice(null)}
            className={`text-[12px] text-text-secondary hover:text-accent whitespace-nowrap ${manualPrice !== null && fetchedPrice !== undefined ? '' : 'invisible'}`}
          >
            Use Fetched ({(fetchedPrice ?? 0).toFixed(2)})
          </button>
        </div>
      </label>

      <button
        onClick={save}
        disabled={!canSave}
        className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        Add Position
      </button>
    </div>
  )
}

/** Create flow: mirrors the Plan table - a planned budget plus a repeatable
 *  list of ticker rows, each with its own allocation % and start price. */
const NewAnalysisModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const addAnalysis = useAnalysisStore((s) => s.addAnalysis)
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [thesis, setThesis] = useState('')
  const [plannedBudget, setPlannedBudget] = useState(10000)
  const [rows, setRows] = useState<DraftRow[]>([newRow()])
  const pricesRef = useRef<Record<string, number>>({})

  const updateRow = (key: string, row: DraftRow) => setRows((rs) => rs.map((r) => (r.key === key ? row : r)))
  const removeRow = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))
  const addRow = () => setRows((rs) => [...rs, newRow()])
  const setPrice = (key: string, price: number) => {
    pricesRef.current[key] = price
  }

  const validRows = rows.filter((r) => r.ticker.trim() !== '' && r.allocationPct > 0)
  const allocationSum = validRows.reduce((sum, r) => sum + r.allocationPct, 0)
  const canSave = plannedBudget > 0 && validRows.length > 0

  const saveNew = () => {
    const valid = rows.filter((r) => r.ticker.trim() !== '' && r.allocationPct > 0)
    addAnalysis({
      id: `an-${Date.now()}`,
      name: name.trim() || valid[0]?.ticker.trim().toUpperCase() || 'Analysis',
      thesis: thesis.trim() || undefined,
      analysisDate: date,
      plannedBudget,
      positions: valid.map((r, i) => ({
        id: `pos-${Date.now()}-${i}`,
        ticker: r.ticker.trim().toUpperCase(),
        exchange: r.exchange.trim() || undefined,
        allocationPct: r.allocationPct,
        plannedAmount: (plannedBudget * r.allocationPct) / 100,
        startPrice: pricesRef.current[r.key] ?? 0,
        startPriceSource: r.manualPrice !== null ? 'manual' : 'auto',
        acted: false,
        lots: [],
      })),
      swaps: [],
    })
    onClose()
  }

  return (
    <div className="themed-card desktop:rounded-lg desktop:p-6 flex flex-col gap-4">
      <div className="hidden desktop:flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-text-primary">New Analysis</h2>
        <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[13px] text-text-secondary">New Analysis Name (Defaults to Ticker)</span>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Big Tech 2026" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Analysis Date</span>
          <ThemedDatePicker value={date} onChange={setDate} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Planned Budget ($)</span>
          <NumberInput
            aria-label="Planned Budget ($)"
            className={inputCls}
            value={plannedBudget}
            onCommit={setPlannedBudget}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <TickerRowEditor
            key={row.key}
            index={i}
            row={row}
            date={date}
            onChange={(r) => updateRow(row.key, r)}
            onRemove={() => removeRow(row.key)}
            onPrice={setPrice}
          />
        ))}
        <button
          type="button"
          onClick={addRow}
          className="self-start flex items-center gap-1 text-[13px] text-text-secondary hover:text-accent"
        >
          <Plus className="w-4 h-4" /> Add Ticker
        </button>
        <p className={`text-[12px] text-text-secondary ${validRows.length > 0 && allocationSum !== 100 ? '' : 'invisible'}`}>
          Allocations sum to {allocationSum}%
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[13px] text-text-secondary">Thesis (Optional)</span>
        <textarea className={`${inputCls} min-h-[70px]`} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Why this investment?" />
      </label>

      <button
        onClick={saveNew}
        disabled={!canSave}
        className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        Save Analysis
      </button>
    </div>
  )
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, analysisId }) => {
  const phone = !useIsDesktop()
  const existingName = useAnalysisStore((s) => (analysisId ? s.analyses.find((a) => a.id === analysisId)?.name : undefined))

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      desktop="modal"
      ariaLabel={analysisId ? 'Add position' : 'New analysis'}
      title={analysisId ? <>Add Position: {existingName ?? ''}</> : phone ? undefined : 'New Analysis'}
      panelClassName="w-full max-w-lg"
    >
      {analysisId ? (
        <AddPositionModal analysisId={analysisId} onClose={onClose} />
      ) : (
        phone ? <NewAnalysisMobile onClose={onClose} /> : <NewAnalysisModal onClose={onClose} />
      )}
    </Sheet>
  )
}
