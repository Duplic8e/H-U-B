import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { futureCost, presentValue, purchasingPowerChangePct } from '../../utils/finance/inflation'

export const INFLATION_TOOL_ID = 'inflation-adjuster'
const DEFAULTS = {
  direction: 'future' as string, // 'future' = today's $ -> future cost; 'present' = future $ -> today's value
  amount: 10000,
  years: 10,
  inflationPct: 2.5,
}

/** State shared by the desktop and phone Inflation Adjuster layouts. */
export function useInflationAdjuster() {
  const inputs = useToolInputs(INFLATION_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(INFLATION_TOOL_ID, field, v)
  const toFuture = inputs.direction !== 'present'

  const converted = toFuture
    ? futureCost(inputs.amount, inputs.inflationPct, inputs.years)
    : presentValue(inputs.amount, inputs.inflationPct, inputs.years)
  const powerChange = purchasingPowerChangePct(inputs.inflationPct, inputs.years)
  return { inputs, setInput, set, toFuture, converted, powerChange }
}

export type InflationAdjusterState = ReturnType<typeof useInflationAdjuster>
