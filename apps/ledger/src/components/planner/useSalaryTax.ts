import { useEffect } from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import {
  marginalRateBreakdown,
  ontarioHealthPremium,
  salaryMarginalRate,
  takeHomeWithDeductions,
  type Province,
} from '../../utils/finance/canadaTax'

export const SALARY_TAX_TOOL_ID = 'salary-tax'
const DEFAULTS = { income: 100000, province: 'ON' as string, rrsp: 0, fhsa: 0, rrspRoom: 0 }

/** Everything the Salary and Tax screens show, derived once from the saved inputs so the
 *  desktop and phone layouts cannot disagree. */
export function useSalaryTax() {
  const inputs = useToolInputs(SALARY_TAX_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const province = inputs.province as Province
  const income = inputs.income

  // One-time seed from the legacy income-tax / take-home-pay saved inputs so
  // nobody loses their numbers. Legacy entries are read, never deleted.
  useEffect(() => {
    const { inputs: all, setInput: set } = usePlannerStore.getState()
    if (all[SALARY_TAX_TOOL_ID] !== undefined) return
    const oldTax = all['income-tax']
    const oldPay = all['take-home-pay']
    if (oldTax) {
      if (typeof oldTax.income === 'number') set(SALARY_TAX_TOOL_ID, 'income', oldTax.income)
      if (typeof oldTax.province === 'string') set(SALARY_TAX_TOOL_ID, 'province', oldTax.province)
    } else if (oldPay) {
      if (typeof oldPay.gross === 'number') set(SALARY_TAX_TOOL_ID, 'income', oldPay.gross)
      if (typeof oldPay.province === 'string') set(SALARY_TAX_TOOL_ID, 'province', oldPay.province)
    }
  }, [])

  const set = (key: keyof typeof DEFAULTS) => (v: number | string) => setInput(SALARY_TAX_TOOL_ID, key, v)
  const enteredRoom = inputs.rrspRoom > 0 ? inputs.rrspRoom : null
  const deductibleRrsp = enteredRoom === null ? inputs.rrsp : Math.min(inputs.rrsp, enteredRoom)
  const t = takeHomeWithDeductions(income, province, deductibleRrsp, inputs.fhsa)
  const breakdown = marginalRateBreakdown(income, province, deductibleRrsp, inputs.fhsa)
  const incomeTax = t.federal + t.provincial
  const room = enteredRoom === null ? null : Math.max(0, enteredRoom - inputs.rrsp)
  const annualOntarioPremium = province === 'ON' ? ontarioHealthPremium(t.provincialTaxableIncome) : 0
  const annualOntarioReduction = province === 'ON' ? Math.max(0, annualOntarioPremium - t.provincialAdjustments) : 0
  const annualReductionLabel = province === 'BC' ? 'Annual BC tax reduction'
    : province === 'AB' ? 'Annual Alberta supplemental credit' : null

  return {
    inputs, setInput, set, province, income, t, breakdown, incomeTax,
    marginal: salaryMarginalRate(income, province, deductibleRrsp, inputs.fhsa),
    effective: income > 0 ? (incomeTax / income) * 100 : 0,
    enteredRoom, deductibleRrsp, room, annualOntarioPremium, annualOntarioReduction, annualReductionLabel,
    adjustmentPercent: Math.abs(breakdown.adjustments).toFixed(2),
  }
}

export type SalaryTaxState = ReturnType<typeof useSalaryTax>
