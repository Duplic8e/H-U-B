import { useMemo } from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import {
  acceleratedBiweeklySchedule, amortizationSchedule, amortizationScheduleWithExtras, monthlyPayment, principalFromPayment,
  scheduleTotalInterest, type ExtraPayment,
} from '../../utils/finance/amortization'

export const MORTGAGE_TOOL_ID = 'mortgage'
const DEFAULTS = {
  mode: 'payment' as string,
  frequency: 'monthly' as string,
  price: 600000,
  downPct: 20,
  ratePct: 4.5,
  years: 25,
  // affordability mode
  income: 120000,
  gdsPct: 39,
  propertyTaxMonthly: 350,
  extras: '[]' as string,
}
export const HEATING_MONTHLY = 150 // CMHC GDS convention

/** Inputs and every derived figure shared by the desktop and phone mortgage layouts. */
export function useMortgageCalculator() {
  const inputs = useToolInputs(MORTGAGE_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(MORTGAGE_TOOL_ID, field, v)
  const mode = inputs.mode as 'payment' | 'affordability'

  const extras: ExtraPayment[] = useMemo(() => {
    try { return JSON.parse((inputs.extras as unknown as string) || '[]') } catch { return [] }
  }, [inputs.extras])
  const setExtras = (next: ExtraPayment[]) => setInput(MORTGAGE_TOOL_ID, 'extras', JSON.stringify(next))

  const downPayment = inputs.price * (inputs.downPct / 100)
  const principal = inputs.price - downPayment
  const payment = monthlyPayment(principal, inputs.ratePct, inputs.years)
  const schedule = amortizationSchedule(principal, inputs.ratePct, inputs.years)
  const scheduleWithExtras = amortizationScheduleWithExtras(principal, inputs.ratePct, inputs.years, extras)
  const interestSaved = scheduleTotalInterest(schedule) - scheduleTotalInterest(scheduleWithExtras)
  const monthsSaved = schedule.length - scheduleWithExtras.length

  const frequency = inputs.frequency as 'monthly' | 'biweekly'
  const biweeklySchedule = frequency === 'biweekly'
    ? acceleratedBiweeklySchedule(principal, inputs.ratePct, inputs.years)
    : null
  const biweeklyMonths = biweeklySchedule ? Math.round((biweeklySchedule.length / 26) * 12) : 0
  const biweeklyInterestSaved = biweeklySchedule
    ? scheduleTotalInterest(schedule) - scheduleTotalInterest(biweeklySchedule)
    : 0

  const chartData = schedule
    .filter((p) => p.month % 12 === 0)
    .map((p) => {
      const year = p.month / 12
      return {
        year,
        baseline: Math.round(p.balance),
        ...(frequency === 'monthly'
          ? { withExtras: Math.round(scheduleWithExtras.find((q) => q.month === p.month)?.balance ?? 0) }
          : { biweekly: Math.round(biweeklySchedule!.find((q) => q.period === year * 26)?.balance ?? 0) }),
      }
    })

  const housingBudget = (inputs.income * (inputs.gdsPct / 100)) / 12 - inputs.propertyTaxMonthly - HEATING_MONTHLY
  const affordablePrincipal = Math.max(0, principalFromPayment(housingBudget, inputs.ratePct, inputs.years))
  const affordablePrice = affordablePrincipal + downPayment

  return {
    inputs, set, setInput: (field: string, value: string | number) => setInput(MORTGAGE_TOOL_ID, field, value),
    mode, frequency, extras, setExtras,
    downPayment, payment, schedule, scheduleWithExtras, interestSaved, monthsSaved,
    biweeklyMonths, biweeklyInterestSaved, chartData,
    housingBudget, affordablePrincipal, affordablePrice,
    totalInterest: scheduleTotalInterest(schedule),
  }
}

export type MortgageState = ReturnType<typeof useMortgageCalculator>
