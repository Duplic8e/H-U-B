import React from 'react'
import { Trash2 } from 'lucide-react'
import { useHistoricalPrice } from '../../services/marketData'
import { NumberInput } from '../ui/NumberInput'

export interface DraftRow {
  key: string
  ticker: string
  exchange: string
  allocationPct: number
  manualPrice: number | null
}

const inputCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[14px] outline-none focus:border-accent w-full'

/** One planned-position row in the New Analysis modal. Fetches the start
 *  price for its own ticker/date; parent reads it back via resolvedPrice. */
export const TickerRowEditor: React.FC<{
  index: number
  row: DraftRow
  date: string
  onChange: (row: DraftRow) => void
  onRemove: () => void
  onPrice: (key: string, price: number) => void
}> = ({ index, row, date, onChange, onRemove, onPrice }) => {
  const hist = useHistoricalPrice(row.ticker, row.exchange || undefined, date)
  const fetched = hist.data?.value.close
  const effective = row.manualPrice ?? fetched ?? 0

  React.useEffect(() => {
    onPrice(row.key, effective)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.key, effective])

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[12px] text-text-secondary truncate whitespace-nowrap">Ticker {index + 1}</span>
        <input aria-label={`Ticker ${index + 1}`} className={inputCls} value={row.ticker}
          onChange={(e) => onChange({ ...row, ticker: e.target.value, manualPrice: null })} placeholder="AAPL" />
      </label>
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[12px] text-text-secondary truncate whitespace-nowrap">Exchange</span>
        <input className={inputCls} value={row.exchange}
          onChange={(e) => onChange({ ...row, exchange: e.target.value })} placeholder="TSX" />
      </label>
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[12px] text-text-secondary truncate whitespace-nowrap">Allocation % {index + 1}</span>
        <NumberInput aria-label={`Allocation % ${index + 1}`} min={0} max={100} className={inputCls}
          value={row.allocationPct}
          onCommit={(n) => onChange({ ...row, allocationPct: n })} />
      </label>
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[12px] text-text-secondary truncate whitespace-nowrap">
          Start Price {row.manualPrice !== null ? '(manual)' : fetched !== undefined ? '(auto)' : hist.status === 'loading' ? '(fetching…)' : ''}
        </span>
        <NumberInput className={inputCls} value={effective}
          onCommit={(n) => onChange({ ...row, manualPrice: n })} />
      </label>
      <button type="button" onClick={onRemove} aria-label={`Remove ticker ${index + 1}`} className="p-2 text-text-secondary hover:text-error">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
