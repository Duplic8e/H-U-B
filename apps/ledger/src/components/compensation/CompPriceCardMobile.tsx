import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useCompensationStore } from '../../store/useCompensationStore'
import { useCompensationDisplay } from '../../hooks/useCompensationDisplay'
import { fxKey, todayKey } from '../../services/marketData'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { NumberInput } from '../ui/NumberInput'

const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'

const Switch: React.FC<{ on: boolean; label: string; onChange: () => void }> = ({ on, label, onChange }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
    className={`shrink-0 h-7 w-12 rounded-full border border-border p-0.5 transition-colors ${on ? 'bg-accent' : 'bg-bg-primary'}`}>
    <span className={`block h-[22px] w-[22px] rounded-full bg-text-primary transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
)

/** Phone stock price and currency card: the price with Refresh, a manual price, then the CAD switch and its manual rate. */
export const CompPriceCardMobile: React.FC = () => {
  const { useCadConversion, toggleCadConversion } = useCompensationStore()
  const d = useCompensationDisplay()
  const [draft, setDraft] = useState(0)
  const key = fxKey('USD', 'CAD', todayKey())
  const override = useMarketDataStore((s) => s.overrides[key])
  const setOverride = useMarketDataStore((s) => s.setOverride)
  const clearOverride = useMarketDataStore((s) => s.clearOverride)
  const src = d.priceSource ? `${d.priceSource}${d.priceStale ? ', stale' : ''}` : ''
  const rateNote = !d.fxAvailable ? 'Rate unavailable, set a manual rate' : `1 USD = ${d.fxRate.toFixed(4)} CAD${d.fxSource === 'override' ? ', manual' : d.fxStale && d.fxDate ? `, as of ${d.fxDate}` : ''}`
  return (
    <div className="themed-card rounded-2xl divide-y divide-border">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-text-secondary">Stock Price (USD){src && <span className="ml-1 uppercase">· {src}</span>}</p>
            <p className="text-[22px] font-semibold text-text-primary tabular-nums">${d.rawPrice.toFixed(2)}</p>
          </div>
          <button type="button" aria-label="Refresh price" onClick={() => (d.priceSource === 'override' ? d.clearManualPrice() : d.refreshPrice(true))}
            className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-border text-[14px] text-text-primary">
            <RefreshCw size={16} className={d.priceStatus === 'loading' ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
        {d.priceStatus === 'error' && <p role="alert" className="text-[13px] text-error">Live price unavailable. Try again or enter a manual price.</p>}
        <form onSubmit={(e) => { e.preventDefault(); if (draft > 0) { d.setManualPrice(draft); setDraft(0) } }} className="flex gap-2">
          <label className={`${box} flex-1`}>
            <span className="sr-only">Set stock price manually, in USD</span>
            <span className="text-text-secondary">$</span>
            <NumberInput value={draft} onCommit={setDraft} placeholder="Manual price" className="flex-1 min-w-0 bg-transparent text-[15px] text-text-primary" />
          </label>
          <button type="submit" className="min-h-12 px-5 rounded-xl border border-border text-[14px] font-medium text-text-primary">Set</button>
        </form>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 min-h-11">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-text-primary">Convert to CAD</p>
            {useCadConversion && <p className="text-[12px] text-text-secondary">{rateNote}{d.fxStatus === 'loading' ? ', updating' : ''}</p>}
          </div>
          <Switch on={useCadConversion} label="Convert to CAD" onChange={toggleCadConversion} />
        </div>
        {useCadConversion && (
          <div className="flex gap-2">
            <label className={`${box} flex-1`}>
              <span className="text-[13px] text-text-secondary shrink-0">Manual Rate</span>
              <NumberInput value={override ?? 0} placeholder={d.fxAvailable ? d.fxRate.toFixed(4) : '1.3700'}
                onCommit={(v) => { if (v > 0) setOverride(key, v) }} className="flex-1 min-w-0 bg-transparent text-[15px] text-right text-text-primary" />
            </label>
            {override !== undefined && <button type="button" onClick={() => clearOverride(key)} className="min-h-12 px-4 rounded-xl border border-border text-[14px] text-accent">Use Live</button>}
          </div>
        )}
      </div>
    </div>
  )
}
