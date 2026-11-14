import React from 'react'
import { ArrowLeftRight, RefreshCw } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { CalculatorField } from './CalculatorField'
import { SelectField } from './SelectField'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { ResultCard } from './ResultCard'
import { NumberInput } from '../ui/NumberInput'
import { CurrencyConverterMobile } from './CurrencyConverterMobile'
import { CURRENCY_OPTIONS, formatAmount, useCurrencyConverter } from './useCurrencyConverter'

export const CurrencyConverter: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const c = useCurrencyConverter()
  if (isPhone) return <CurrencyConverterMobile c={c} />

  const { inputs, from, to, rate, converted, fx, override, historicalSupported, set, swap } = c
  const sourceLabel =
    override !== undefined
      ? 'manual override'
      : fx.data
        ? `${fx.data.source}${fx.data.stale ? ' (stale)' : ''}, as of ${new Date(fx.data.asOf).toLocaleString()}`
        : fx.status

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
        <CalculatorField label={`Amount (${from})`} step={10} value={inputs.amount} onChange={(v) => set('amount', v)} />
        <SelectField label="From" value={from} onChange={(v) => set('from', v)} options={CURRENCY_OPTIONS} />
        <button
          onClick={swap}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          aria-label="Swap currencies"
        >
          <ArrowLeftRight className="w-4 h-4" /> Swap
        </button>
        <SelectField label="To" value={to} onChange={(v) => set('to', v)} options={CURRENCY_OPTIONS} />
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Rate Date (Optional)</span>
          <ThemedDatePicker
            value={inputs.date as string}
            onChange={(v) => set('date', v)}
          />
        </label>
        <button
          onClick={() => fx.refresh()}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          aria-label="Refresh rate"
        >
          <RefreshCw className={`w-4 h-4 ${fx.status === 'loading' ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {!historicalSupported && (inputs.date as string) && (
        <p className="text-[12px] text-text-secondary">
          Historical rates are unavailable for BDT, showing the latest rate instead.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResultCard
          label={`Converted (${to})`}
          value={converted !== undefined ? formatAmount(converted, to) : fx.status === 'error' ? 'Unavailable, set a manual rate' : '…'}
          highlight
        />
        <ResultCard label={`Rate ${from}→${to}`} value={rate !== undefined ? rate.toFixed(4) : '…'} />
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <p className="text-[12px] uppercase tracking-wide text-text-secondary">Rate Source: {sourceLabel}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-text-secondary">Manual Rate Override</span>
            <NumberInput
              className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent w-40"
              value={override ?? 0}
              placeholder={fx.data?.value.rate.toFixed(4) ?? ''}
              onCommit={(v) => {
                if (v > 0) c.setOverride(v)
              }}
            />
          </label>
          {override !== undefined && (
            <button
              onClick={c.clearOverride}
              className="px-3 py-2 rounded-lg border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors"
            >
              Clear Override, Use Live
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
