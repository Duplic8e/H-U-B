import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { minPaymentFor, simulatePayoff, type Debt, type DebtType, type PayoffStrategy } from '../../utils/finance/debtPayoff'

export const DEBT_TOOL_ID = 'debt-payoff'
const DEFAULT_DEBTS: Debt[] = [
  { id: 'd1', name: 'Credit Card', balance: 5000, aprPct: 21.99, type: 'creditCard' },
  { id: 'd2', name: 'Car Loan', balance: 12000, aprPct: 7.5, type: 'loan', loanMode: 'term', termYears: 4 },
]
const DEFAULTS = { debtsJson: JSON.stringify(DEFAULT_DEBTS), extraMonthly: 200, strategy: 'avalanche' as string }

/** Debts stored before v0.4 have no type: treat them as loans with their
 *  saved payment, so nothing changes until the user edits them. */
function parseDebts(json: string): Debt[] {
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    return arr.map((d) => ({ type: 'loan', loanMode: 'payment', ...d }))
  } catch {
    return []
  }
}

export function formatMonths(m: number | null): string {
  if (m === null) return 'Never (payments too low)'
  return `${Math.floor(m / 12)}y ${m % 12}m`
}

/** State and simulation shared by the desktop and phone Debt Payoff layouts. */
export function useDebtPayoff() {
  const inputs = useToolInputs(DEBT_TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const debts = parseDebts(inputs.debtsJson as string)
  const strategy = inputs.strategy as PayoffStrategy
  const otherStrategy: PayoffStrategy = strategy === 'avalanche' ? 'snowball' : 'avalanche'
  const saveDebts = (next: Debt[]) => setInput(DEBT_TOOL_ID, 'debtsJson', JSON.stringify(next))
  const updateDebt = (id: string, patch: Partial<Debt>) =>
    saveDebts(debts.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  const changeType = (d: Debt, type: DebtType) => {
    if (type === 'loan') {
      updateDebt(d.id, {
        type,
        loanMode: d.loanMode ?? 'payment',
        minPayment: d.minPayment ?? Math.max(10, Math.round(minPaymentFor(d, d.balance))),
      })
    } else {
      updateDebt(d.id, { type })
    }
  }
  const addDebt = (): string => {
    const id = crypto.randomUUID()
    saveDebts([...debts, { id, name: 'New Debt', balance: 1000, aprPct: 10, type: 'creditCard' }])
    return id
  }
  const removeDebt = (id: string) => saveDebts(debts.filter((x) => x.id !== id))
  const setExtra = (v: number) => setInput(DEBT_TOOL_ID, 'extraMonthly', v)
  const setStrategy = (v: string) => setInput(DEBT_TOOL_ID, 'strategy', v)

  const chosen = simulatePayoff(debts, inputs.extraMonthly, strategy)
  const other = simulatePayoff(debts, inputs.extraMonthly, otherStrategy)
  const chartData = chosen.series.map((p, i) => ({
    month: p.month,
    [strategy]: Math.round(p.total),
    ...(other.series[i] ? { [otherStrategy]: Math.round(other.series[i].total) } : {}),
  }))

  return {
    debts, strategy, otherStrategy, extraMonthly: inputs.extraMonthly as number,
    saveDebts, updateDebt, changeType, addDebt, removeDebt, setExtra, setStrategy,
    chosen, other, chartData,
  }
}

export type DebtPayoffState = ReturnType<typeof useDebtPayoff>
