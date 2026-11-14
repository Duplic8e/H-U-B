import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { useBudgetStore } from '../../store/useBudgetStore'
import { averageMonthlyExpenses } from '../../store/budgetSelectors'

export const EMERGENCY_TOOL_ID = 'emergency-fund'
const DEFAULTS = { monthlyExpenses: 3000, targetMonths: 6, currentSavings: 5000 }
export const PRESET_MONTHS = [3, 6, 12]

/** State shared by the desktop and phone Emergency Fund layouts. */
export function useEmergencyFund() {
  const inputs = useToolInputs(EMERGENCY_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(EMERGENCY_TOOL_ID, field, v)
  const transactions = useBudgetStore((s) => s.transactions)

  const budgetAvg = averageMonthlyExpenses(transactions, 3)
  const target = inputs.monthlyExpenses * inputs.targetMonths
  const gap = Math.max(0, target - inputs.currentSavings)
  const progress = target > 0 ? Math.min(1, inputs.currentSavings / target) : 0
  return { inputs, setInput, set, budgetAvg, target, gap, progress }
}

export type EmergencyFundState = ReturnType<typeof useEmergencyFund>
