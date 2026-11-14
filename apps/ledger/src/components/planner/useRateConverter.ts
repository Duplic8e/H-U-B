import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { aprToApy, apyToApr, periodicRatePct, cagrPct, totalReturnPct } from '../../utils/finance/rates'

export const RATE_TOOL_ID = 'rate-converter'
const DEFAULTS = {
  mode: 'apr-apy' as string, // 'apr-apy' | 'cagr'
  direction: 'apr-to-apy' as string,
  ratePct: 6,
  periodsPerYear: 12,
  startValue: 10000,
  endValue: 14000,
  years: 3,
}

export const RATE_FREQUENCIES = [
  { value: '1', label: 'Annually' },
  { value: '2', label: 'Semi-Annually' },
  { value: '4', label: 'Quarterly' },
  { value: '12', label: 'Monthly' },
  { value: '365', label: 'Daily' },
]

/** State shared by the desktop and phone Rate & Return Converter layouts. */
export function useRateConverter() {
  const inputs = useToolInputs(RATE_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(RATE_TOOL_ID, field, v)
  const isCagr = inputs.mode === 'cagr'
  const aprToApyDir = inputs.direction !== 'apy-to-apr'
  const n = Number(inputs.periodsPerYear) || 1

  const converted = aprToApyDir ? aprToApy(inputs.ratePct, n) : apyToApr(inputs.ratePct, n)
  const periodic = periodicRatePct(aprToApyDir ? inputs.ratePct : converted, n)
  const cagr = cagrPct(inputs.startValue, inputs.endValue, inputs.years)
  const total = totalReturnPct(inputs.startValue, inputs.endValue)
  return { inputs, setInput, set, isCagr, aprToApyDir, n, converted, periodic, cagr, total }
}

export type RateConverterState = ReturnType<typeof useRateConverter>
