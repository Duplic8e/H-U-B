// Extracts future compensation cash events as forecast lump sums.
// RSU: real vest dates from generateVestEvents. Bonus: yearly at
// pkg.cashBonusMonth. ESPP: SIMPLIFICATION - the store has no per-purchase
// dates, so the annual ESPP gain lands every 12 months from now.

import {
  calcAnnualBonus,
  calcAnnualESPP,
  generateVestEvents,
  type CompensationPackage,
} from '../../store/useCompensationStore'
import type { LumpSum } from './forecast'

function monthOffset(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

export function compLumpSums(
  pkg: CompensationPackage,
  currentPrice: number,
  horizonMonths: number,
  now: Date = new Date(),
): LumpSum[] {
  const lumps: LumpSum[] = []

  // RSU vest events on their real dates.
  for (const grant of pkg.rsuGrants) {
    for (const event of generateVestEvents(grant, currentPrice)) {
      if (!event.date || event.vestValue <= 0) continue
      const vestDate = new Date(event.date)
      if (vestDate <= now) continue
      // monthOffset truncates to whole calendar months, so a vest later this
      // same month yields 0. It is still genuinely future, and buildForecast's
      // first consulted step is month 1, so route same-month lumps there
      // instead of dropping them.
      const offset = Math.max(1, monthOffset(now, vestDate))
      if (offset <= horizonMonths) {
        lumps.push({ month: offset, amount: event.vestValue, label: `RSU ${grant.grantName}` })
      }
    }
  }

  // Annual cash bonus at its configured month.
  const bonus = calcAnnualBonus(pkg)
  if (bonus > 0) {
    // Use the *end* of the bonus month as the "is it still ahead of now"
    // probe: the store only tracks a bonus month, not an exact day, so any
    // day within the current calendar month counts as still-future.
    const bonusMonthEnd = new Date(now.getFullYear(), pkg.cashBonusMonth, 0, 23, 59, 59, 999)
    let bonusDate = new Date(now.getFullYear(), pkg.cashBonusMonth - 1, 1)
    let firstOffset = monthOffset(now, bonusDate)
    if (firstOffset < 0 || (firstOffset === 0 && bonusMonthEnd < now)) {
      // Current year's bonus month has already passed - bump to next year.
      bonusDate = new Date(now.getFullYear() + 1, pkg.cashBonusMonth - 1, 1)
      firstOffset = monthOffset(now, bonusDate)
    } else if (firstOffset === 0) {
      // Bonus month is the current calendar month and still ahead of (or on)
      // now - genuinely future, but monthOffset truncates to 0. Route it to
      // month 1, the forecaster's first consulted step, instead of dropping
      // it or skipping straight to next year.
      firstOffset = 1
    }
    for (let offset = firstOffset; offset <= horizonMonths; offset += 12) {
      lumps.push({ month: offset, amount: bonus, label: 'Bonus' })
    }
  }

  // ESPP annual gain - simplified to every 12 months (no purchase dates in store).
  const espp = calcAnnualESPP(pkg)
  if (espp > 0) {
    for (let offset = 12; offset <= horizonMonths; offset += 12) {
      lumps.push({ month: offset, amount: espp, label: 'ESPP' })
    }
  }

  return lumps.sort((a, b) => a.month - b.month)
}
