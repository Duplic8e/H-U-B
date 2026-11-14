import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCurrentPrice, useHistoricalPrice } from '../../services/marketData'
import { useAnalysisStore, type InvestmentAnalysis, type Position, type SwapScenario } from '../../store/useAnalysisStore'
import { simulateSwap } from '../../utils/investments/swapSim'
import { formatMoney } from '../planner/format'
import { ThemedSelect } from '../ui/ThemedSelect'
import { Skeleton } from '../ui/Skeleton'
import { CalculatorField } from '../planner/CalculatorField'
import { NumberInput } from '../ui/NumberInput'

interface SwapSimulatorProps {
  analysis: InvestmentAnalysis
  side: 'plan' | 'actual'
  priceFor: (p: Position) => number
  investedFor: (p: Position) => number
}

const inputCls =
  'bg-bg-primary/50 border control-border rounded-lg px-3 py-2 text-text-primary text-[13px] focus:border-accent w-full'

const SwapRow: React.FC<{
  analysis: InvestmentAnalysis
  swap: SwapScenario
  priceFor: (p: Position) => number
  investedFor: (p: Position) => number
}> = ({ analysis, swap, priceFor, investedFor }) => {
  const { updateSwap, removeSwap } = useAnalysisStore.getState()
  const positions = analysis.positions
  const out = positions.find((p) => p.id === swap.outPositionId)

  const hist = useHistoricalPrice(swap.inTicker, swap.inExchange, analysis.analysisDate)
  const fetchedStartPrice = hist.data?.value.close
  const inStartPrice = swap.inStartPriceSource === 'manual' ? swap.inStartPrice : (fetchedStartPrice ?? 0)

  const current = useCurrentPrice(swap.inTicker, swap.inExchange)
  const inCurrentPrice = current.data?.value.price
  const isCurrentOverridden = current.data?.source === 'override'
  const isLoadingCurrent = swap.inTicker.trim() !== '' && current.status === 'loading'
  const [manualCurrentDraft, setManualCurrentDraft] = useState(0)

  const handleManualCurrentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCurrentDraft > 0) {
      current.setManual(manualCurrentDraft)
      setManualCurrentDraft(0)
    }
  }

  const invested = out ? investedFor(out) : 0
  const result = out && inCurrentPrice !== undefined
    ? simulateSwap(invested, out.startPrice, priceFor(out), inStartPrice, inCurrentPrice)
    : null

  return (
    <div className="themed-card border border-border rounded-lg p-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-meta text-text-secondary">Swap Out</span>
          <ThemedSelect
            value={swap.outPositionId}
            onChange={(v) => updateSwap(analysis.id, swap.id, { outPositionId: v })}
            options={positions.map((p) => ({ value: p.id, label: p.ticker }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-meta text-text-secondary">Swap In Ticker</span>
          <input
            className={inputCls}
            value={swap.inTicker}
            onChange={(e) => updateSwap(analysis.id, swap.id, { inTicker: e.target.value.toUpperCase() })}
            placeholder="e.g. GFS"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-meta text-text-secondary">
            Swap In Start Price {swap.inStartPriceSource === 'manual' ? '(manual)' : fetchedStartPrice !== undefined ? '(auto)' : hist.status === 'loading' ? '(fetching…)' : ''}
          </span>
          <div className="flex gap-1 items-center">
            <CalculatorField
              label=""
              prefix="$"
              step={0.01}
              value={inStartPrice}
              onChange={(v) => updateSwap(analysis.id, swap.id, { inStartPrice: v, inStartPriceSource: 'manual' })}
            />
            {swap.inStartPriceSource === 'manual' && fetchedStartPrice !== undefined && (
              <button
                type="button"
                onClick={() => updateSwap(analysis.id, swap.id, { inStartPriceSource: 'auto' })}
                className="text-meta text-text-secondary hover:text-accent whitespace-nowrap"
              >
                Use fetched
              </button>
            )}
          </div>
        </label>
        <button
          onClick={() => removeSwap(analysis.id, swap.id)}
          aria-label="Remove swap"
          className="p-1.5 text-text-secondary hover:text-error justify-self-end"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {swap.inTicker.trim() !== '' && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-secondary">
          <span className="inline-flex items-center gap-1">
            Current price: {isLoadingCurrent ? <Skeleton className="h-4 w-16 inline-block" /> : (inCurrentPrice !== undefined ? inCurrentPrice.toFixed(2) : '-')}
            {isCurrentOverridden ? ' (manual)' : ''}
          </span>
          {current.status === 'error' && !isCurrentOverridden && (
            <span className="text-error">live price unavailable</span>
          )}
          <form onSubmit={handleManualCurrentSubmit} className="flex items-center gap-1">
            <NumberInput
              value={manualCurrentDraft}
              onCommit={setManualCurrentDraft}
              placeholder="Manual current price"
              className="w-32 bg-bg-primary/50 border control-border rounded px-2 py-1 text-[12px] text-text-primary focus:border-accent transition-colors"
            />
            <button type="submit" className="px-2 py-1 bg-bg-primary/50 border control-border rounded text-[12px] text-text-primary hover:text-accent transition-colors">
              Set
            </button>
          </form>
          {isCurrentOverridden && (
            <button type="button" onClick={() => current.clearManual()} className="text-text-secondary hover:text-accent underline decoration-dotted">
              Clear override
            </button>
          )}
        </div>
      )}

      {isLoadingCurrent ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[13px]">
          <div>
            <p className="text-text-secondary">Initial Inv</p>
            <p className="text-text-primary font-medium">{formatMoney(invested)}</p>
          </div>
          <div>
            <p className="text-text-secondary">Original Return</p>
            <p className="text-text-primary font-medium">{result ? formatMoney(result.originalReturn) : '-'}</p>
          </div>
          <div>
            <p className="text-text-secondary">New Return</p>
            <p className="text-text-primary font-medium">{result ? formatMoney(result.newReturn) : '-'}</p>
          </div>
          <div>
            <p className="text-text-secondary">Difference</p>
            <p className={`font-medium ${result ? (result.difference >= 0 ? 'text-accent' : 'text-error') : 'text-text-primary'}`}>
              {result ? formatMoney(result.difference) : '-'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export const SwapSimulator: React.FC<SwapSimulatorProps> = ({ analysis, side, priceFor, investedFor }) => {
  const addSwap = useAnalysisStore((s) => s.addSwap)
  const swaps = (analysis.swaps ?? []).filter((s) => s.side === side)

  const handleAdd = () => {
    const firstPosition = analysis.positions[0]
    if (!firstPosition) return
    addSwap(analysis.id, {
      id: crypto.randomUUID(),
      side,
      outPositionId: firstPosition.id,
      inTicker: '',
      inStartPrice: 0,
      inStartPriceSource: 'manual',
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-text-secondary">Swap what-if</h4>
        <button
          onClick={handleAdd}
          disabled={analysis.positions.length === 0}
          className="flex items-center gap-1 p-1.5 text-[13px] text-text-secondary hover:text-accent disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> Add swap
        </button>
      </div>
      {swaps.map((swap) => (
        <SwapRow key={swap.id} analysis={analysis} swap={swap} priceFor={priceFor} investedFor={investedFor} />
      ))}
    </div>
  )
}
