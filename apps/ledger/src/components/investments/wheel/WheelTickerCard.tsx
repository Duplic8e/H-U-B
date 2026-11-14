import React, { useState } from 'react'
import { Check, Copy, Eye } from 'lucide-react'
import type { TickerState } from '../../../utils/investments/wheel/types'
import { calculateBreakeven, calculateNetPL, formatCurr } from '../../../utils/investments/wheel/calculations'
import { useCurrentPrice } from '../../../services/marketData'
import { NumberInput } from '../../ui/NumberInput'

interface WheelTickerCardProps {
  data: TickerState
  onViewDetails: (ticker: string) => void
}

const MetricRow: React.FC<{ label: string; value: React.ReactNode; tone?: 'positive' | 'negative' }> = ({ label, value, tone }) => (
  <div className="flex justify-between items-center py-1.5">
    <span className="text-[13px] text-text-secondary">{label}</span>
    <span className={`text-[14px] font-medium ${tone === 'positive' ? 'text-accent' : tone === 'negative' ? 'text-error' : 'text-text-primary'}`}>
      {value}
    </span>
  </div>
)

export const WheelTickerCard: React.FC<WheelTickerCardProps> = ({ data, onViewDetails }) => {
  const price = useCurrentPrice(data.ticker)
  // override/live/cached quote wins; CSV-parsed statement price is the fallback
  const spot = price.data?.value.price ?? data.currentPrice
  const [copied, setCopied] = useState(false)

  const breakeven = calculateBreakeven(data)
  const netPL = calculateNetPL(data, spot)
  const isStockWheel = data.opSharesHeld > 0

  const handleCopy = () => {
    const text =
      `📈 ${data.ticker} Wheel Strategy Summary\n` +
      `• Shares Held: ${isStockWheel ? data.opSharesHeld : '0'}\n` +
      `• Cost of Shares: ${isStockWheel ? formatCurr(data.displayCost) : 'N/A'}\n` +
      `• Premium Collected: ${formatCurr(data.premiumCollected)}\n` +
      `• True Breakeven: ${Number.isNaN(breakeven) ? 'N/A' : formatCurr(breakeven)}\n` +
      `• Current Spot Price: ${formatCurr(spot)}\n` +
      `• Net P/L: ${formatCurr(netPL)}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="themed-card rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[16px] font-semibold text-text-primary">{data.ticker}</span>
        {price.data?.source && (
          <span className="text-micro uppercase text-text-secondary">{price.data.source}{price.data.stale ? ', stale' : ''}</span>
        )}
      </div>

      <MetricRow label="Shares" value={isStockWheel ? data.opSharesHeld.toLocaleString() : '0'} />
      <MetricRow label="Total Cost of Shares" value={isStockWheel ? formatCurr(data.displayCost) : 'N/A'} />
      <MetricRow
        label="Total Premium Collected"
        value={formatCurr(data.premiumCollected)}
        tone={data.premiumCollected >= 0 ? 'positive' : 'negative'}
      />

      <div className="flex justify-between items-center py-1.5">
        <span className="text-[13px] text-text-secondary">Current Stock Price</span>
        <NumberInput
          value={spot}
          onCommit={(v) => {
            if (v > 0) price.setManual(v)
          }}
          className="w-24 bg-bg-primary/50 border border-border rounded-md px-2 py-1 text-[14px] text-text-primary text-right focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      <div className="mt-2 pt-2 border-t border-border">
        <MetricRow label="True Breakeven Price" value={Number.isNaN(breakeven) ? 'N/A' : formatCurr(breakeven)} />
        <MetricRow label="Net Profit/Loss" value={formatCurr(netPL)} tone={netPL >= 0 ? 'positive' : 'negative'} />
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onViewDetails(data.ticker)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          <Eye className="w-4 h-4" /> View Details
        </button>
        <button
          onClick={handleCopy}
          aria-label="Copy summary"
          className="px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
