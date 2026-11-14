import { shiftMonthKey, type Period, type PeriodPreset } from '../../utils/budget/period'

export interface PeriodChoice { value: string; label: string }

const PRESET_LABELS: Record<PeriodPreset, string> = {
  last3: 'Last 3 Months',
  last6: 'Last 6 Months',
  last12: 'Last 12 Months',
  ytd: 'Year to Date',
}

/** The choices for the period control. A month picked with the arrows is listed first so the control can show it. */
export function periodChoices(period: Period, currentMonth: string, monthLabel: string): PeriodChoice[] {
  return [
    ...(period.kind === 'month' && period.month !== currentMonth ? [{ value: 'pickedMonth', label: monthLabel }] : []),
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    ...(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => ({ value: p, label: PRESET_LABELS[p] })),
  ]
}

export const periodChoiceValue = (period: Period, currentMonth: string): string =>
  period.kind === 'month' ? (period.month === currentMonth ? 'thisMonth' : 'pickedMonth') : period.preset

/** The period a choice stands for, or null when the choice is the month that is already picked. */
export function periodFromChoice(value: string, currentMonth: string): Period | null {
  if (value === 'thisMonth') return { kind: 'month', month: currentMonth }
  if (value === 'lastMonth') return { kind: 'month', month: shiftMonthKey(currentMonth, -1) }
  if (value === 'pickedMonth') return null
  return { kind: 'preset', preset: value as PeriodPreset }
}

export const presetLabel = (preset: PeriodPreset): string => PRESET_LABELS[preset]
