import React, { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useCurrentPrice } from '../../services/marketData'
import { CURRENCIES, type Currency } from '../../services/marketData/types'
import { usePortfolioStore, type Holding } from '../../store/usePortfolioStore'
import {
  bookValue, convertedPrice, holdingPlDollars, holdingPlPct, marketValue, quoteCurrencyForHolding, toCad, type FxRates,
} from '../../utils/investments/portfolioMetrics'
import { allocationPct } from '../../utils/investments/analysisMetrics'
import { formatMoney } from '../planner/format'
import { pct, share } from './holdingMetrics'
import { Skeleton } from '../ui/Skeleton'
import { ThemedSelect } from '../ui/ThemedSelect'
import { DataFreshness } from '../ui/DataFreshness'

interface HoldingRowProps {
  holding: Holding
  rates: FxRates
  totalValueCad: number
  onPrice: (id: string, price: number, currency: Currency | null) => void
}

export const HoldingRow: React.FC<HoldingRowProps> = ({ holding, rates, totalValueCad, onPrice }) => {
  const setHoldingCurrency = usePortfolioStore((s) => s.setHoldingCurrency)
  const live = useCurrentPrice(holding.ticker, holding.exchange)
  // Not live.data.value.currency directly: an override's currency is a
  // placeholder the service cannot fill in correctly. See
  // quoteCurrencyForHolding.
  const quoteCurrency = quoteCurrencyForHolding(holding, live.data?.value.currency, live.data?.source)
  const nativePrice = live.data?.value.price ?? holding.avgCost

  // The quote's currency is authoritative for the price; convert it into the
  // holding's currency so value and P/L compare against the cost basis.
  const converted = convertedPrice(holding, nativePrice, quoteCurrency, rates)
  const priceUnconvertible = converted === null
  const price = converted ?? nativePrice

  useEffect(() => {
    // Report the raw native price and its currency, not the converted (or
    // unconvertible-fallback) price above: the parent recomputes safety
    // itself via safeHoldingPrice, the same rule the dashboard rollup uses,
    // so the two surfaces cannot silently disagree about it.
    onPrice(holding.id, nativePrice, quoteCurrency)
  }, [holding.id, nativePrice, quoteCurrency, onPrice])

  // A price that cannot be converted into the holding's own currency is not
  // usable for value/P&L/allocation, but the holding does not vanish from
  // the account: the parent (safeHoldingPrice) already values it at cost
  // basis in the subtotal and header totals. Mirror that here with
  // effectivePrice so this row's own numbers sum to the subtotal above it
  // instead of showing a dash the totals silently disagree with. The
  // "unconverted" marker above still tells the user the live price itself
  // could not be used.
  const effectivePrice = priceUnconvertible ? holding.avgCost : price
  const valueCad = toCad(marketValue(holding, effectivePrice), holding.currency, rates)
  const [open, setOpen] = useState(false)
  const detailId = `holding-detail-${holding.id}`

  return (
    <>
      <tr className={open ? '' : 'border-b border-border last:border-b-0'}>
        <td className="py-2 pr-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`Details for ${holding.ticker}`}
            className="inline-flex items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-text-secondary transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
            <span data-testid="holding-ticker" className="text-text-primary font-medium">{holding.ticker}</span>
          </button>
          <span className="block text-meta text-text-secondary pl-[18px]">
            <span className="inline-flex align-middle items-center">
              <ThemedSelect
                value={holding.currency ?? ''}
                onChange={(v) => setHoldingCurrency(holding.id, v ? (v as Currency) : null)}
                ariaLabel={`Currency for ${holding.ticker}`}
                className="!w-auto !px-1.5 !py-0 !text-meta !rounded"
                options={[
                  { value: '', label: 'Set currency' },
                  ...CURRENCIES.map((c) => ({ value: c, label: c })),
                ]}
              />
            </span>
            {priceUnconvertible && quoteCurrency ? (
              <span className="text-error" title={`Price quoted in ${quoteCurrency}, no rate into ${holding.currency ?? 'unset currency'}`}> · unconverted</span>
            ) : null}
            {live.data ? (
              <>
                {' · '}
                <DataFreshness
                  source={live.data.source}
                  asOf={live.data.asOf}
                  stale={live.data.stale}
                  onRefresh={() => live.refresh(true)}
                  label={`${holding.ticker} price`}
                />
              </>
            ) : (
              ' · no quote'
            )}
          </span>
        </td>
        <td className="py-2 pr-3 text-right text-text-secondary">{holding.quantity}</td>
        <td className="py-2 pr-3 text-right text-text-primary">
          {live.status === 'loading' && !live.data ? <Skeleton className="h-4 w-16 inline-block" /> : price.toFixed(2)}
        </td>
        <td data-testid="value-cell" className="py-2 pr-3 text-right text-text-primary">
          {formatMoney(marketValue(holding, effectivePrice))}
        </td>
        <td
          data-testid="pl-cell"
          className={`py-2 pr-3 text-right ${
            holdingPlDollars(holding, effectivePrice) >= 0 ? 'text-accent' : 'text-error'
          }`}
        >
          {formatMoney(holdingPlDollars(holding, effectivePrice))} ({pct(holdingPlPct(holding, effectivePrice))})
        </td>
        <td data-testid="allocation-cell" className="py-2 text-right text-text-secondary">
          {valueCad === null ? (
            '-'
          ) : (
            <>
              <span className="tabular-nums">{share(allocationPct(valueCad, totalValueCad))}</span>
              <span data-testid="allocation-bar" className="block h-1 mt-1 rounded bg-bg-primary/50 overflow-hidden">
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${Math.min(100, Math.max(0, allocationPct(valueCad, totalValueCad) ?? 0))}%` }}
                />
              </span>
            </>
          )}
        </td>
      </tr>
      {open && (
        <tr id={detailId} className="border-b border-border last:border-b-0">
          <td colSpan={6} className="pb-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-bg-primary/50 px-3 py-2 text-meta text-text-secondary">
              <span>Avg cost <span className="text-text-primary tabular-nums">{holding.avgCost.toFixed(2)}</span></span>
              <span>Book <span className="text-text-primary tabular-nums">{formatMoney(bookValue(holding))}</span></span>
              <span>Return <span className={`tabular-nums ${holdingPlDollars(holding, effectivePrice) >= 0 ? 'text-accent' : 'text-error'}`}>{pct(holdingPlPct(holding, effectivePrice))}</span></span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
