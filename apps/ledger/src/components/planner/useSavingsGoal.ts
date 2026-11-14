import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { solveAnnualRate, solveMonthlyContribution, solveMonths, solveTarget } from '../../utils/finance/savingsGoal'
import { formatMoney } from './format'

export const SAVINGS_TOOL_ID = 'savings-goal'
export type SolveFor = 'target' | 'monthly' | 'months' | 'rate'
const DEFAULTS = {
  solveFor: 'monthly' as string,
  target: 100000,
  principal: 10000,
  monthlyContribution: 500,
  annualRatePct: 5,
  years: 10,
}

function formatMonths(m: number): string {
  return `${Math.floor(m / 12)}y ${m % 12}m`
}

/** State shared by the desktop and phone Savings Goal layouts. */
export function useSavingsGoal() {
  const inputs = useToolInputs(SAVINGS_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(SAVINGS_TOOL_ID, field, v)
  const solveFor = inputs.solveFor as SolveFor

  const months = Math.max(1, Math.round(inputs.years * 12))
  let result: { label: string; value: string }
  switch (solveFor) {
    case 'target': {
      const v = solveTarget(inputs.principal, inputs.annualRatePct, inputs.monthlyContribution, months)
      result = { label: 'Projected Balance', value: formatMoney(v) }
      break
    }
    case 'months': {
      const m = solveMonths(inputs.target, inputs.principal, inputs.annualRatePct, inputs.monthlyContribution)
      result = { label: 'Time to Goal', value: m === null ? 'Not reachable' : formatMonths(m) }
      break
    }
    case 'rate': {
      const r = solveAnnualRate(inputs.target, inputs.principal, inputs.monthlyContribution, months)
      result = { label: 'Annual Return Needed', value: r === null ? 'Not reachable' : `${r.toFixed(2)}%` }
      break
    }
    default: {
      const c = solveMonthlyContribution(inputs.target, inputs.principal, inputs.annualRatePct, months)
      result = { label: 'Monthly Contribution Needed', value: c === null ? 'Not reachable' : formatMoney(c) }
    }
  }
  return { inputs, setInput, set, solveFor, result }
}

export type SavingsGoalState = ReturnType<typeof useSavingsGoal>
