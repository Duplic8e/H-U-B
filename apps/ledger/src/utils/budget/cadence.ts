// Budget cadence: a category's targetAmount covers either one month or one
// calendar year. Annual categories contribute their monthly equivalent to
// monthly totals (sinking-fund model) and are tracked against calendar-year
// spend in their own section.

import type { BudgetCadence, Category } from '../../types/budget'

export const MONTHS_PER_YEAR = 12

export function cadenceOf(cat: Category): BudgetCadence {
  return cat.cadence ?? 'monthly'
}

export function isAnnual(cat: Category): boolean {
  return cadenceOf(cat) === 'annual'
}

/** Contribution to a single month's budgeted total. */
export function monthlyEquivalent(cat: Category): number {
  return isAnnual(cat) ? cat.targetAmount / MONTHS_PER_YEAR : cat.targetAmount
}

/** Full calendar-year target. */
export function annualTarget(cat: Category): number {
  return isAnnual(cat) ? cat.targetAmount : cat.targetAmount * MONTHS_PER_YEAR
}

/** Months of `year` that have begun as of `now`: 1 in January, 12 in December,
 *  12 for any past year, 0 for a future one. */
export function elapsedMonthsInYear(year: number, now: Date = new Date()): number {
  if (year < now.getFullYear()) return MONTHS_PER_YEAR
  if (year > now.getFullYear()) return 0
  return now.getMonth() + 1
}

/** Amount that should have been set aside by now. */
export function setAsideExpected(annual: number, elapsedMonths: number): number {
  return (annual * elapsedMonths) / MONTHS_PER_YEAR
}
