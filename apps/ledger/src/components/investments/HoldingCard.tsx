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
import { ThemedSelect } from '../ui/ThemedSelect'
import { DataFreshness } from '../ui/DataFreshness'

interface HoldingCardProps {
  holding: Holding
  rates: FxRates
  totalValueCad: number
  onPrice: (id: string, price: number, currency: Currency | null) => void
}

/** The shared Skeleton is a div, and these placeholders sit inside the row's
 *  <button>, which only allows phrasing content. Same look, as a span. */
const InlineSkeleton: React.FC<{ className: string }> = ({ className }) => (
  <span aria-hidden="true" className={`inline-block animate-pulse rounded bg-bg-primary/60 ${className}`} />
)

export const HoldingCard: React.FC<HoldingCardProps> = ({ holding, rates, totalValueCad, onPrice }) => {
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
  // effectivePrice so this card's own numbers sum to the subtotal above it
  // instead of showing a dash the totals silently disagree with. The
  // "unconverted" marker above still tells the user the live price itself
  // could not be used.
  const effectivePrice = priceUnconvertible ? holding.avgCost : price
  const valueCad = toCad(marketValue(holding, effectivePrice), holding.currency, rates)
  const plDollars = holdingPlDollars(holding, effectivePrice)
  const isLoadingPrice = live.status === 'loading' && !live.data
  const [open, setOpen] = useState(false)
  const detailId = `holding-card-detail-${holding.id}`
  const summaryId = `holding-card-summary-${holding.id}`

  return (
    // Rule 7 of docs/mobile-layout-rules.md: one row per holding. Identity and
    // size on the left, value and P/L on the right; currency, quote freshness,
    // price and cost are one tap away. The old card stacked all of it at about
    // 220px a holding, so 17 holdings ran six phone screens.
    <div className="themed-card rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailId}
        aria-label={`Details for ${holding.ticker}`}
        aria-describedby={summaryId}
        className="w-full min-h-[56px] px-3 py-2 flex items-center gap-2 text-left rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
        <span id={summaryId} className="flex-1 min-w-0 flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-text-primary">{holding.ticker}</span>
            <span className="block text-meta text-text-secondary tabular-nums">
              {holding.quantity} sh ·{' '}
              <span data-testid="allocation-cell">
                {isLoadingPrice ? (
                  <InlineSkeleton className="h-3 w-10" />
                ) : valueCad === null ? (
                  '-'
                ) : (
                  share(allocationPct(valueCad, totalValueCad))
                )}
              </span>
              {holding.currency === null ? (
                <>
                  {' · '}
                  <span className="text-error">Set currency</span>
                </>
              ) : null}
              {priceUnconvertible && quoteCurrency ? (
                <span className="text-error" title={`Price quoted in ${quoteCurrency}, no rate into ${holding.currency ?? 'unset currency'}`}> · unconverted</span>
              ) : null}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span data-testid="value-cell" className="block text-[14px] font-medium text-text-primary tabular-nums">
              {isLoadingPrice ? <InlineSkeleton className="h-4 w-16" /> : formatMoney(marketValue(holding, effectivePrice))}
            </span>
            {isLoadingPrice ? (
              <InlineSkeleton className="h-3 w-20" />
            ) : (
              <span data-testid="pl-cell" className={`block text-meta font-medium tabular-nums ${plDollars >= 0 ? 'text-accent' : 'text-error'}`}>
                {formatMoney(plDollars)} ({pct(holdingPlPct(holding, effectivePrice))})
              </span>
            )}
          </span>
        </span>
      </button>
      {open && (
        <div id={detailId} className="px-3 pb-3 flex flex-col gap-2">
          <span className="text-meta text-text-secondary">
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] rounded-md bg-bg-primary/50 px-2 py-2">
            <span className="text-text-secondary">Price</span>
            <span className="text-right tabular-nums">
              {isLoadingPrice ? <InlineSkeleton className="h-4 w-16" /> : price.toFixed(2)}
            </span>
            <span className="text-text-secondary">Avg Cost</span>
            <span className="text-right tabular-nums">{holding.avgCost.toFixed(2)}</span>
            <span className="text-text-secondary">Book</span>
            <span className="text-right tabular-nums">{formatMoney(bookValue(holding))}</span>
          </div>
        </div>
      )}
    </div>
  )
}
