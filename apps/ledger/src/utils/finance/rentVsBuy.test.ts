import { rentVsBuy } from './rentVsBuy'

const base = {
  monthlyRent: 2000, rentIncreasePct: 0,
  price: 400_000, downPct: 20, ratePct: 0, amortYears: 25,
  propertyTaxPct: 1, maintenancePct: 1, opportunityPct: 0,
  horizonYears: 5,
}

describe('rentVsBuy', () => {
  it('zero-rate case is hand-computable: buying is cheap, break-even year 1', () => {
    const r = rentVsBuy(base)
    // Rent: 24,000/yr. Buy: no interest, tax+maint = 400k × 2% = 8,000/yr.
    expect(r.series[0]).toEqual({ year: 1, rentCost: 24_000, buyCost: 8_000 })
    expect(r.breakEvenYear).toBe(1)
  })

  it('returns null break-even when renting stays cheaper', () => {
    const r = rentVsBuy({ ...base, monthlyRent: 500, ratePct: 6, opportunityPct: 7 })
    expect(r.breakEvenYear).toBeNull()
  })

  it('rent increases compound annually', () => {
    const r = rentVsBuy({ ...base, rentIncreasePct: 10, horizonYears: 2 })
    // year1 24,000; year2 24,000×1.1 = 26,400 → cumulative 50,400
    expect(r.series[1].rentCost).toBeCloseTo(50_400, 6)
  })

  it('series length matches the horizon', () => {
    expect(rentVsBuy(base).series).toHaveLength(5)
  })
})
