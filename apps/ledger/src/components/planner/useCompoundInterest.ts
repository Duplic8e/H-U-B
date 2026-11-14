import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { futureValue, growthSeries } from '../../utils/finance/compound'

export const COMPOUND_TOOL_ID = 'compound-interest'
const DEFAULTS: Record<string, number> = { principal: 10000, monthlyContribution: 500, annualRatePct: 7, years: 20 }

/** State shared by the desktop and phone Compound Interest layouts. */
export function useCompoundInterest() {
  const inputs = useToolInputs(COMPOUND_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(COMPOUND_TOOL_ID, field, v)

  const months = Math.max(1, Math.round(inputs.years * 12))
  const fv = futureValue(inputs.principal, inputs.annualRatePct, months, inputs.monthlyContribution)
  const contributed = inputs.principal + inputs.monthlyContribution * months
  const chartData = growthSeries(inputs.principal, inputs.annualRatePct, inputs.monthlyContribution, months)
    .filter((p) => p.month % 12 === 0)
    .map((p) => ({
      year: p.month / 12,
      contributed: Math.round(p.contributed),
      growth: Math.round(Math.max(0, p.growth)),
    }))
  return { inputs, setInput, set, fv, contributed, chartData }
}

export type CompoundInterestState = ReturnType<typeof useCompoundInterest>
