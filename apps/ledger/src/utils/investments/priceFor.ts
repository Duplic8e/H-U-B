import type { Position } from '../../store/useAnalysisStore'
import { quoteKey } from '../../services/marketData'
import { useMarketDataStore } from '../../store/useMarketDataStore'

/**
 * Resolves the "current" price for a position using override > cached quote > start price,
 * matching the fallback used across Investments.tsx and PositionCard.
 */
export function priceForPosition(position: Position, overrides: Record<string, number>, quotes: Record<string, { value: { price: number } }>): number {
  const key = quoteKey(position.ticker, position.exchange)
  return overrides[key] ?? quotes[key]?.value.price ?? position.startPrice
}

/** Hook form: reads the market data store directly and returns a stable priceFor callback. */
export function useResolvedPriceFor(): (p: Position) => number {
  const quotes = useMarketDataStore((s) => s.quotes)
  const overrides = useMarketDataStore((s) => s.overrides)
  return (p: Position) => priceForPosition(p, overrides, quotes)
}
