import { usePlannerStore, useToolInputs } from '../../../store/usePlannerStore'
import { useAccountValuation } from '../../../hooks/useAccountValuation'
import { useBudgetStore } from '../../../store/useBudgetStore'
import { useCompensationStore } from '../../../store/useCompensationStore'
import { averageMonthlyNetSavings } from '../../../store/budgetSelectors'
import { compLumpSums } from '../../../utils/finance/compFeed'
import { minPaymentFor, simulatePayoff, type Debt, type PayoffStrategy } from '../../../utils/finance/debtPayoff'
import type { LumpSum } from '../../../utils/finance/forecast'
import { applyLumpTax, resolveCompTaxRate } from '../../../utils/finance/compTax'
import { PROVINCIAL_TAX, type Province } from '../../../utils/finance/canadaTax'

export const TOOL_ID = 'forecaster'

export interface LifeEvent {
  id: string
  label: string
  yearsFromNow: number
  amount: number // negative = cost (house down payment), positive = windfall
}

export interface Goal {
  id: string
  label: string
  amount: number
}

export const FORECASTER_DEFAULTS = {
  years: 25,
  annualReturnPct: 7,
  inflationPct: 2.5,
  stepUpPct: 2,
  spreadPct: 2,
  withdrawalRatePct: 4,
  annualSpending: 48000,
  showReal: false,
  view: 'line' as string,
  autoStart: true,
  autoSavings: true,
  autoComp: true,
  includeDebtDrag: false,
  compTaxEnabled: true,
  compTaxAuto: true,
  compTaxManualPct: 50,
  manualStart: 0,
  manualSavings: 2000,
  mcStdDevPct: 15,
  eventsJson: '[]',
  goalsJson: '[]',
}

function parseJson<T>(json: string, fallback: T): T {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

export function useForecasterSettings() {
  const settings = useToolInputs(TOOL_ID, FORECASTER_DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const debtInputs = usePlannerStore((s) => s.inputs['debt-payoff'])
  const transactions = useBudgetStore((s) => s.transactions)
  const { netWorth } = useAccountValuation()
  const primaryPackage = useCompensationStore((s) => s.primaryPackage)
  const salaryTaxInputs = usePlannerStore((s) => s.inputs['salary-tax'])
  const provRaw = String(salaryTaxInputs?.province ?? 'ON')
  const taxProvince = (provRaw in PROVINCIAL_TAX ? provRaw : 'ON') as Province
  const taxIncome = Number(salaryTaxInputs?.income ?? 0) || primaryPackage.baseSalary || 0

  const horizonMonths = Math.max(12, Math.round(settings.years * 12))

  const compTaxRate = resolveCompTaxRate({
    enabled: settings.compTaxEnabled as boolean,
    auto: settings.compTaxAuto as boolean,
    manualPct: settings.compTaxManualPct as number,
    income: taxIncome,
    province: taxProvince,
  })

  const budgetAvg = averageMonthlyNetSavings(transactions, 3)
  const autoFeed = {
    startBalance: netWorth,
    monthlySavings: budgetAvg,
    compLumps: settings.autoComp
      ? applyLumpTax(compLumpSums(primaryPackage, primaryPackage.companyCurrentPrice, horizonMonths), compTaxRate)
      : ([] as LumpSum[]),
    debtDrag: null as { amount: number; untilMonth: number } | null,
  }

  if (settings.includeDebtDrag && debtInputs) {
    const debts = parseJson<Debt[]>(String(debtInputs.debtsJson ?? '[]'), [])
    if (debts.length > 0) {
      const extra = Number(debtInputs.extraMonthly ?? 0)
      const strategy = (debtInputs.strategy as PayoffStrategy) ?? 'avalanche'
      const result = simulatePayoff(debts, extra, strategy)
      const totalMin = debts.reduce((s, d) => s + minPaymentFor(d, d.balance), 0)
      autoFeed.debtDrag = { amount: totalMin + extra, untilMonth: result.months ?? horizonMonths }
    }
  }

  const resolved = {
    startBalance: settings.autoStart ? autoFeed.startBalance : settings.manualStart,
    monthlySavings: settings.autoSavings
      ? (budgetAvg !== 0 ? budgetAvg : settings.manualSavings)
      : settings.manualSavings,
  }

  return {
    settings,
    setSetting: (field: string, value: number | string | boolean) => setInput(TOOL_ID, field, value),
    events: parseJson<LifeEvent[]>(settings.eventsJson as string, []),
    saveEvents: (next: LifeEvent[]) => setInput(TOOL_ID, 'eventsJson', JSON.stringify(next)),
    goals: parseJson<Goal[]>(settings.goalsJson as string, []),
    saveGoals: (next: Goal[]) => setInput(TOOL_ID, 'goalsJson', JSON.stringify(next)),
    autoFeed,
    resolved,
    compTax: { ratePct: compTaxRate * 100, province: taxProvince },
  }
}
