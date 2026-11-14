import { generateVestEvents } from '../../../store/useCompensationStore'
import { useCompensationDisplay } from '../../../hooks/useCompensationDisplay'

export interface VestDay { day: string; iso: string; total: number; grants: number }

/** Upcoming vest dates, soonest first, with every grant that lands on the same day folded into one entry. */
export function useUpcomingVestDays(): VestDay[] {
  // The display package carries the live or cached price for the ticker; the stored price is only a
  // manual fallback and is 0 when the price comes from market data.
  const { pkg } = useCompensationDisplay()
  const now = new Date()
  const days: VestDay[] = []
  const events = pkg.rsuGrants
    .flatMap((g) => generateVestEvents(g, pkg.companyCurrentPrice))
    .filter((e) => e.date !== undefined && new Date(e.date) > now)
    .sort((a, b) => a.date!.localeCompare(b.date!))
  for (const e of events) {
    const day = e.date!.slice(0, 10)
    const found = days.find((d) => d.day === day)
    if (found) { found.total += e.vestValue; found.grants += 1 } else days.push({ day, iso: e.date!, total: e.vestValue, grants: 1 })
  }
  return days
}
