// Multi-debt payoff simulation. Each month: interest accrues (apr/12), every
// live debt gets its CURRENT minimum payment (credit cards and LOCs recompute
// theirs from the live balance; loans are fixed), and the rest of the fixed
// monthly budget - extraMonthly plus month-1 minimums - goes to the focus
// debt: snowball = lowest balance first, avalanche = highest APR first.

import { monthlyPayment } from './amortization'

export type DebtType = 'creditCard' | 'lineOfCredit' | 'loan'
export type LoanMode = 'payment' | 'term'

export interface Debt {
  id: string
  name: string
  balance: number
  aprPct: number
  type: DebtType
  /** Loan only: whether the user entered a payment or a term. */
  loanMode?: LoanMode
  /** Loan, payment mode: fixed monthly payment. */
  minPayment?: number
  /** Loan, term mode: amortization years - payment derived via monthlyPayment(). */
  termYears?: number
}

const CC_MIN_RATE = 0.03
const CC_MIN_FLOOR = 10

/** This month's minimum for a debt at the given balance. Credit cards pay
 *  max($10, 3% of balance); LOCs pay interest only; loans pay a fixed P&I
 *  amount (entered directly, or derived from the starting balance + term). */
export function minPaymentFor(debt: Debt, currentBalance: number): number {
  if (currentBalance <= 0) return 0
  switch (debt.type) {
    case 'creditCard':
      return Math.min(currentBalance, Math.max(CC_MIN_FLOOR, currentBalance * CC_MIN_RATE))
    case 'lineOfCredit':
      return (currentBalance * debt.aprPct) / 100 / 12
    case 'loan':
      return debt.loanMode === 'term'
        ? monthlyPayment(debt.balance, debt.aprPct, debt.termYears ?? 1)
        : (debt.minPayment ?? 0)
  }
}

export type PayoffStrategy = 'snowball' | 'avalanche'

export interface PayoffResult {
  /** Months to debt-free, or null if not reached within maxMonths. */
  months: number | null
  totalInterest: number
  series: { month: number; total: number }[]
  /** Debt ids in the order they were fully paid. */
  payoffOrder: string[]
}

export function simulatePayoff(
  debts: Debt[],
  extraMonthly: number,
  strategy: PayoffStrategy,
  maxMonths = 600,
): PayoffResult {
  const live = debts.map((d) => ({ ...d }))
  // Loan payments are fixed from the ORIGINAL starting balances (term mode
  // derives P&I from them); the budget is locked to month-1 totals so
  // shrinking CC/LOC minimums roll into the focus debt.
  const fixedLoanMin = new Map(
    debts.map((d) => [d.id, d.type === 'loan' ? minPaymentFor(d, d.balance) : 0]),
  )
  const currentMin = (d: Debt) =>
    d.type === 'loan' ? fixedLoanMin.get(d.id)! : minPaymentFor(d, d.balance)
  const totalMin = debts.reduce((s, d) => s + minPaymentFor(d, d.balance), 0)
  const series = [{ month: 0, total: live.reduce((s, d) => s + d.balance, 0) }]
  const payoffOrder: string[] = []
  let totalInterest = 0

  for (let month = 1; month <= maxMonths; month++) {
    // 1. Accrue interest.
    for (const d of live) {
      if (d.balance <= 0) continue
      const interest = (d.balance * d.aprPct) / 100 / 12
      d.balance += interest
      totalInterest += interest
    }
    // 2. Minimum payments - every live debt gets its CURRENT minimum first.
    let budget = extraMonthly + totalMin
    for (const d of live) {
      if (d.balance <= 0) continue
      const pay = Math.min(currentMin(d), d.balance, budget)
      d.balance -= pay
      budget -= pay
    }
    // 3. Remaining budget goes to the focus debt in strategy order.
    const order = [...live]
      .filter((d) => d.balance > 0)
      .sort((a, b) => (strategy === 'snowball' ? a.balance - b.balance : b.aprPct - a.aprPct))
    for (const d of order) {
      if (budget <= 0) break
      const pay = Math.min(budget, d.balance)
      d.balance -= pay
      budget -= pay
    }
    // 4. Record clears + series point.
    for (const d of live) {
      if (d.balance <= 1e-6 && !payoffOrder.includes(d.id)) {
        d.balance = 0
        payoffOrder.push(d.id)
      }
    }
    const total = live.reduce((s, d) => s + d.balance, 0)
    series.push({ month, total })
    if (total <= 0) return { months: month, totalInterest, series, payoffOrder }
  }
  return { months: null, totalInterest, series, payoffOrder }
}
