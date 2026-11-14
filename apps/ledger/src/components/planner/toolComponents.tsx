import React from 'react'
import { ForecasterTool } from './forecaster/ForecasterTool'
import { CompoundInterestCalculator } from './CompoundInterestCalculator'
import { DebtPayoffCalculator } from './DebtPayoffCalculator'
import { EmergencyFundCalculator } from './EmergencyFundCalculator'
import { SavingsGoalCalculator } from './SavingsGoalCalculator'
import { CurrencyConverter } from './CurrencyConverter'
import { RaiseInflationCalculator } from './RaiseInflationCalculator'
import { MortgageCalculator } from './MortgageCalculator'
import { RentVsBuyCalculator } from './RentVsBuyCalculator'
import { SalaryTaxTool } from './SalaryTaxTool'
import { InflationAdjusterCalculator } from './InflationAdjusterCalculator'
import { RateConverterCalculator } from './RateConverterCalculator'

/** Tool id to component. Kept out of toolRegistry.tsx on purpose: the registry
 *  is imported by the always-mounted Command Palette, so anything the registry
 *  imports is downloaded and evaluated before first paint on every route. Six
 *  of these calculators pull in recharts, which is why they live behind the
 *  lazily loaded PlannerTool page instead. scripts/check-eager-graph.mjs
 *  fails the build if that separation is ever undone. */
export const PLANNER_TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  forecaster: ForecasterTool,
  'compound-interest': CompoundInterestCalculator,
  'debt-payoff': DebtPayoffCalculator,
  'emergency-fund': EmergencyFundCalculator,
  'savings-goal': SavingsGoalCalculator,
  'currency-converter': CurrencyConverter,
  'raise-inflation': RaiseInflationCalculator,
  mortgage: MortgageCalculator,
  'rent-vs-buy': RentVsBuyCalculator,
  'salary-tax': SalaryTaxTool,
  'inflation-adjuster': InflationAdjusterCalculator,
  'rate-converter': RateConverterCalculator,
}
