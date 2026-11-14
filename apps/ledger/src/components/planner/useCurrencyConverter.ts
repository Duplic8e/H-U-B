import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { CURRENCIES, fxKey, todayKey, useFxRate, type Currency } from '../../services/marketData'
import { FRANKFURTER_CURRENCIES } from '../../services/marketData/providers/fxRouter'
import { useMarketDataStore } from '../../store/useMarketDataStore'

export const CONVERTER_TOOL_ID = 'currency-converter'
const DEFAULTS = { amount: 100, from: 'USD' as string, to: 'CAD' as string, date: '' as string }

export const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }))

export function formatAmount(n: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency, currencyDisplay: 'code',
  }).format(n)
}

/** State and rate lookup shared by the desktop and phone converter layouts. */
export function useCurrencyConverter() {
  const inputs = useToolInputs(CONVERTER_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)

  const from = inputs.from as Currency
  const to = inputs.to as Currency
  // er-api (BDT pairs) has no historical rates: drop the date for those pairs.
  const historicalSupported = FRANKFURTER_CURRENCIES.has(from) && FRANKFURTER_CURRENCIES.has(to)
  const date = historicalSupported ? inputs.date || undefined : undefined
  const fx = useFxRate(from, to, date)

  const overrideKey = fxKey(from, to, date ?? todayKey())
  const override = useMarketDataStore((s) => s.overrides[overrideKey])
  const setOverride = useMarketDataStore((s) => s.setOverride)
  const clearOverride = useMarketDataStore((s) => s.clearOverride)

  const rate = override ?? fx.data?.value.rate
  const converted = rate !== undefined ? inputs.amount * rate : undefined

  return {
    inputs,
    from,
    to,
    rate,
    converted,
    fx,
    override,
    historicalSupported,
    set: (key: string, value: string | number) => setInput(CONVERTER_TOOL_ID, key, value),
    swap: () => {
      setInput(CONVERTER_TOOL_ID, 'from', to)
      setInput(CONVERTER_TOOL_ID, 'to', from)
    },
    setOverride: (value: number) => setOverride(overrideKey, value),
    clearOverride: () => clearOverride(overrideKey),
  }
}

export type CurrencyConverterState = ReturnType<typeof useCurrencyConverter>
