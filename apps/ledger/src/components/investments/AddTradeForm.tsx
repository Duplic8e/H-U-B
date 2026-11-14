import React, { useState } from 'react'
import { useAnalysisStore, type InvestmentAnalysis } from '../../store/useAnalysisStore'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { NumberInput } from '../ui/NumberInput'

const inputCls =
  'bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[14px] focus:border-accent w-28'

/** "Add Trade" entry point for the Actual tab: pick a planned ticker,
 *  enter date / shares / price; saved as a buy lot on that position. */
export const AddTradeForm: React.FC<{
  analysis: InvestmentAnalysis
  open: boolean
  onOpenChange: (open: boolean) => void
}> = ({ analysis, open, onOpenChange }) => {
  const addLot = useAnalysisStore((s) => s.addLot)
  const [positionId, setPositionId] = useState(analysis.positions[0]?.id ?? '')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shares, setShares] = useState(0)
  const [price, setPrice] = useState(0)

  if (analysis.positions.length === 0 || !open) return null

  const save = () => {
    if (!positionId || shares <= 0 || price <= 0) return
    addLot(analysis.id, positionId, {
      id: `lot-${Date.now()}`,
      date,
      amountInvested: shares * price,
      price,
    })
    setShares(0)
    onOpenChange(false)
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border border-border rounded-lg p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Ticker</span>
        <ThemedSelect
          value={positionId}
          onChange={setPositionId}
          options={analysis.positions.map((p) => ({ value: p.id, label: p.ticker }))}
          className="w-32"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Date</span>
        <ThemedDatePicker value={date} onChange={setDate} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Shares</span>
        <NumberInput aria-label="Shares" className={inputCls} value={shares} onCommit={setShares} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-text-secondary">Price</span>
        <NumberInput aria-label="Price" className={inputCls} value={price} onCommit={setPrice} />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={shares <= 0 || price <= 0}
        className="px-3 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[13px] font-medium disabled:opacity-40"
      >
        Save Trade
      </button>
      <button type="button" onClick={() => onOpenChange(false)} className="px-2 py-2 text-[13px] text-text-secondary hover:text-text-primary">
        Cancel
      </button>
    </div>
  )
}
