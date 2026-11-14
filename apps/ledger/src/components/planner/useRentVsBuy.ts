import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { rentVsBuy } from '../../utils/finance/rentVsBuy'

export const RENT_BUY_TOOL_ID = 'rent-vs-buy'
const DEFAULTS = {
  monthlyRent: 2200, rentIncreasePct: 3,
  price: 600000, downPct: 20, ratePct: 4.5, amortYears: 25,
  propertyTaxPct: 0.8, maintenancePct: 1, opportunityPct: 5,
  horizonYears: 15,
}

/** State shared by the desktop and phone Rent vs Buy layouts. */
export function useRentVsBuy() {
  const inputs = useToolInputs(RENT_BUY_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(RENT_BUY_TOOL_ID, field, v)

  const result = rentVsBuy(inputs)
  const chartData = result.series.map((p) => ({
    year: p.year, Renting: Math.round(p.rentCost), Buying: Math.round(p.buyCost),
  }))
  const last = result.series[result.series.length - 1]
  const rentCost = last?.rentCost ?? 0
  const buyCost = last?.buyCost ?? 0
  return { inputs, setInput, set, result, chartData, last, rentCost, buyCost, lastYear: last?.year ?? 0 }
}

export type RentVsBuyState = ReturnType<typeof useRentVsBuy>
