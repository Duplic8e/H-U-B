import type { Transaction } from '../../types/budget'
import { matchesRule } from './merchant'

/** How often a number is shown: per pay, per month, per year. */
export type PlanPeriod = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export const PLAN_PERIODS: ReadonlyArray<{ value: PlanPeriod; label: string; perYear: number }> = [
  { value: 'weekly', label: 'Weekly', perYear: 52 },
  { value: 'biweekly', label: 'Biweekly', perYear: 26 },
  { value: 'monthly', label: 'Monthly', perYear: 12 },
  { value: 'yearly', label: 'Yearly', perYear: 1 },
]

export function perYear(period: PlanPeriod): number {
  return PLAN_PERIODS.find((p) => p.value === period)!.perYear
}

/** A bill the user entered by hand: rent, a phone plan, insurance. */
export interface PlannedBill {
  id: string
  name: string
  /** What is paid each time, in the cadence below. */
  amount: number
  cadence: PlanPeriod
  /** Day of the month it is due (1 to 31), for monthly bills. */
  dueDay?: number
  /** Budget category it belongs to, so it is not counted twice against that category's target. */
  categoryId?: string
}

export function annualBillAmount(bill: PlannedBill): number {
  return bill.amount * perYear(bill.cadence)
}

export interface CashPlanInput {
  /** Annual base salary before tax. */
  grossSalary: number
  /** Annual base salary after income tax, CPP and EI. */
  netSalary: number
  /** ESPP contribution as a percent of gross base salary. */
  esppPercent: number
  bills: PlannedBill[]
  /** Monthly-equivalent target per expense category id. */
  monthlyTargets: Record<string, number>
}

/** Every figure is annual; scale with `inPeriod`. */
export interface CashPlan {
  gross: number
  taxes: number
  espp: number
  takeHome: number
  bills: number
  /** Budget targets beyond what the bills already cover. */
  otherBudget: number
  leftover: number
}

/** Salary flows into the budget: gross pay, less tax, less ESPP, is what
 *  reaches the bank; bills and the rest of the budget come out of that. */
export function buildCashPlan(input: CashPlanInput): CashPlan {
  const gross = Math.max(0, input.grossSalary)
  const net = Math.max(0, Math.min(gross, input.netSalary))
  const espp = Math.min(net, gross * (Math.max(0, input.esppPercent) / 100))
  const takeHome = net - espp
  const bills = input.bills.reduce((sum, bill) => sum + annualBillAmount(bill), 0)

  // A bill filed under a category is already part of that category's target.
  // Count the target only for what it holds beyond its bills.
  const billsByCategory = new Map<string, number>()
  for (const bill of input.bills) {
    if (bill.categoryId) billsByCategory.set(bill.categoryId, (billsByCategory.get(bill.categoryId) ?? 0) + annualBillAmount(bill))
  }
  let otherBudget = 0
  for (const [categoryId, monthly] of Object.entries(input.monthlyTargets)) {
    otherBudget += Math.max(0, monthly * 12 - (billsByCategory.get(categoryId) ?? 0))
  }

  return { gross, taxes: gross - net, espp, takeHome, bills, otherBudget, leftover: takeHome - bills - otherBudget }
}

export function inPeriod(annual: number, period: PlanPeriod): number {
  return annual / perYear(period)
}

/** Monthly bills that have not shown up in this month's transactions yet, for
 *  the month-end forecast. A bill counts as paid when a transaction this month
 *  names it, or sits in its category for about its amount. `alreadyExpected`
 *  holds descriptions the forecast already projects from detected recurring
 *  payments, so the same bill is not forecast twice. */
export function unpaidBillsThisMonth(
  bills: PlannedBill[],
  transactions: Record<string, Transaction>,
  month: string,
  alreadyExpected: string[] = [],
): Array<{ description: string; amount: number; type: 'expense'; expectedDate: string }> {
  const thisMonth = Object.values(transactions).filter((t) => t.type === 'expense' && t.date.startsWith(month))
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const out: Array<{ description: string; amount: number; type: 'expense'; expectedDate: string }> = []
  for (const bill of bills) {
    if (bill.cadence !== 'monthly' || bill.amount <= 0 || !bill.name.trim()) continue
    const paid = thisMonth.some((t) =>
      matchesRule(t.description, bill.name) ||
      (!!bill.categoryId && t.categoryId === bill.categoryId && Math.abs(t.amount - bill.amount) <= bill.amount * 0.25))
    if (paid) continue
    if (alreadyExpected.some((description) => matchesRule(description, bill.name))) continue
    const day = Math.min(lastDay, Math.max(1, bill.dueDay ?? lastDay))
    out.push({ description: bill.name, amount: bill.amount, type: 'expense', expectedDate: `${month}-${String(day).padStart(2, '0')}` })
  }
  return out
}
