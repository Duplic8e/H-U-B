import type { CompensationPackage } from '../../store/useCompensationStore'
import { compLumpSums } from './compFeed'

const basePkg: CompensationPackage = {
  id: 'p', name: 'Test', companyCurrentPrice: 100, baseSalary: 120_000,
  pastSalaryChanges: [], cashBonusPercent: 10, cashBonusMonth: 12,
  esppContributionPercent: 0, esppDiscountPercent: 15, esppLockedInPrice: 0,
  rrspMatchPercent: 0, rrspMatchCap: 0, rsuGrants: [],
}

const now = new Date('2026-07-02T00:00:00')

describe('compLumpSums', () => {
  it('places the annual bonus at the configured month, repeating yearly', () => {
    const lumps = compLumpSums(basePkg, 100, 24, now)
    const bonuses = lumps.filter((l) => l.label === 'Bonus')
    // Dec 2026 = month offset 5, Dec 2027 = 17
    expect(bonuses.map((b) => b.month)).toEqual([5, 17])
    expect(bonuses[0].amount).toBeCloseTo(12_000, 6)
  })

  it('maps RSU vest events with future dates into month offsets', () => {
    const pkg: CompensationPackage = {
      ...basePkg,
      cashBonusPercent: 0,
      rsuGrants: [{
        id: 'g1', grantName: 'G1', grantShares: 480, grantPrice: 50,
        grantStartDate: '2026-01-02',
        vestingSchedule: { preset: 'custom', totalVestMonths: 48, cliffMonths: 12, frequency: 'monthly' },
      }],
    }
    const lumps = compLumpSums(pkg, 100, 12, now)
    const rsu = lumps.filter((l) => l.label?.startsWith('RSU'))
    expect(rsu.length).toBeGreaterThan(0)
    expect(rsu.every((l) => l.month >= 1 && l.month <= 12)).toBe(true)
    expect(rsu.every((l) => l.amount > 0)).toBe(true)
  })

  it('drops zero-amount lumps and respects the horizon', () => {
    const lumps = compLumpSums({ ...basePkg, cashBonusPercent: 0 }, 100, 24, now)
    expect(lumps.filter((l) => l.amount === 0)).toHaveLength(0)
  })

  it('places an RSU vest later in the same calendar month as now at month 1, not dropped', () => {
    // now = 2026-07-02. Cliff of 6 months from a 2026-01-15 start lands on
    // 2026-07-15 - strictly after `now` but in the same calendar month, so
    // monthOffset(now, vestDate) truncates to 0. Previously offset >= 1
    // filtered this out entirely; it should now surface at month 1.
    const pkg: CompensationPackage = {
      ...basePkg,
      cashBonusPercent: 0,
      rsuGrants: [{
        id: 'g1', grantName: 'G1', grantShares: 480, grantPrice: 50,
        grantStartDate: '2026-01-15',
        vestingSchedule: { preset: 'custom', totalVestMonths: 48, cliffMonths: 6, frequency: 'monthly' },
      }],
    }
    const lumps = compLumpSums(pkg, 100, 12, now)
    const cliffVest = lumps.find((l) => l.label === 'RSU G1' && l.amount === 480 * (6 / 48) * 100)
    expect(cliffVest).toBeDefined()
    expect(cliffVest?.month).toBe(1)
  })

  it('places a current-month bonus (day >= now) at month 1, next occurrence at 13', () => {
    // now = 2026-07-02 (month 7, day 2). cashBonusMonth = 7 means the bonus
    // lands in the current calendar month. bonusDate is built as 2026-07-01,
    // so monthOffset(now, bonusDate) = 0. The end of the bonus month
    // (2026-07-31) is still >= now, so this is a genuinely future occurrence
    // that monthOffset alone would have truncated to 0 and (under the old
    // code) bumped all the way to next year. It should surface at month 1,
    // then repeat yearly at 13, 25, ...
    const pkg: CompensationPackage = { ...basePkg, cashBonusMonth: 7 }
    const lumps = compLumpSums(pkg, 100, 24, now)
    const bonuses = lumps.filter((l) => l.label === 'Bonus')
    expect(bonuses.map((b) => b.month)).toEqual([1, 13])
    expect(bonuses[0].amount).toBeCloseTo(12_000, 6)
  })
})
