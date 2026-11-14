// How a category's spending compares with its target, for Budget vs. Actual.

/** Spread spending is over, under or on pace; a bill is Due until it is paid, Paid, or Over Budget. */
export type RowPace = 'over' | 'under' | 'on' | 'due' | 'paid' | 'overBudget'

/** More than 110% of what is expected by now is over, under 90% is under. */
export function paceOf(spent: number, expected: number): RowPace {
  if (spent > expected * 1.1) return 'over'
  if (spent < expected * 0.9) return 'under'
  return 'on'
}

/** A bill is paid once about its whole target has gone out, whatever day of the month that is. */
export function billPace(spent: number, target: number): RowPace {
  if (spent > target * 1.1) return 'overBudget'
  if (spent < target * 0.9) return 'due'
  return 'paid'
}

export const isOverRow = (p: RowPace): boolean => p === 'over' || p === 'overBudget'

export const PACE_LABELS: Record<RowPace, string> = {
  over: 'over pace',
  under: 'under pace',
  on: 'on pace',
  due: 'due',
  paid: 'paid',
  overBudget: 'over budget',
}

/** What should have been spent by now. Bills count in full from the start of the month, since they are paid in one
 *  go; everything else is spread across the days. */
export function expectedByNow(rows: { target: number; bill: boolean }[], monthFraction: number): number {
  return rows.reduce((sum, r) => sum + (r.bill ? r.target : r.target * monthFraction), 0)
}
