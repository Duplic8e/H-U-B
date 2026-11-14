import {
  acceleratedBiweeklySchedule,
  amortizationSchedule,
  amortizationScheduleWithExtras,
  monthlyPayment,
  principalFromPayment,
  scheduleTotalInterest,
} from './amortization'

describe('monthlyPayment', () => {
  it('matches the standard formula: $100k, 6%, 30y = $599.55', () => {
    expect(monthlyPayment(100_000, 6, 30)).toBeCloseTo(599.55, 2)
  })

  it('handles zero rate as simple division', () => {
    expect(monthlyPayment(120_000, 0, 10)).toBeCloseTo(1_000, 10)
  })
})

describe('principalFromPayment', () => {
  it('inverts monthlyPayment', () => {
    const p = principalFromPayment(599.55, 6, 30)
    expect(p).toBeCloseTo(100_000, 0)
  })

  it('handles zero rate', () => {
    expect(principalFromPayment(1_000, 0, 10)).toBeCloseTo(120_000, 6)
  })
})

describe('amortizationSchedule', () => {
  it('pays to zero exactly at the term with no extra payments', () => {
    const s = amortizationSchedule(100_000, 6, 30)
    expect(s).toHaveLength(360)
    expect(s[359].balance).toBeCloseTo(0, 6)
  })

  it('first month splits interest and principal correctly', () => {
    const s = amortizationSchedule(100_000, 6, 30)
    // interest = 100,000 × 0.005 = 500; principal = 599.55 − 500 = 99.55
    expect(s[0].interestPaid).toBeCloseTo(500, 2)
    expect(s[0].principalPaid).toBeCloseTo(99.55, 2)
  })

  it('extra payments shorten the schedule and cut interest', () => {
    const base = amortizationSchedule(100_000, 6, 30)
    const extra = amortizationSchedule(100_000, 6, 30, 200)
    expect(extra.length).toBeLessThan(base.length)
    expect(scheduleTotalInterest(extra)).toBeLessThan(scheduleTotalInterest(base))
  })

  it('final payment never overshoots below zero', () => {
    const s = amortizationSchedule(1_000, 12, 1, 500)
    expect(s[s.length - 1].balance).toBe(0)
    expect(s.every((p) => p.balance >= 0)).toBe(true)
  })
})

describe('amortizationScheduleWithExtras', () => {
  const P = 400000, R = 5, Y = 25

  it('no extras equals the base schedule', () => {
    const a = amortizationSchedule(P, R, Y)
    const b = amortizationScheduleWithExtras(P, R, Y, [])
    expect(b.length).toBe(a.length)
    expect(b[b.length - 1].balance).toBeCloseTo(a[a.length - 1].balance, 6)
  })

  it('recurring extra shortens the loan and cuts interest', () => {
    const base = amortizationSchedule(P, R, Y)
    const extra = amortizationScheduleWithExtras(P, R, Y, [
      { id: 'x', kind: 'recurring', amount: 500, fromYear: 1, toYear: 25 },
    ])
    expect(extra.length).toBeLessThan(base.length)
    expect(scheduleTotalInterest(extra)).toBeLessThan(scheduleTotalInterest(base))
  })

  it('recurring extra only applies within its year range', () => {
    const early = amortizationScheduleWithExtras(P, R, Y, [
      { id: 'x', kind: 'recurring', amount: 500, fromYear: 1, toYear: 5 },
    ])
    const late = amortizationScheduleWithExtras(P, R, Y, [
      { id: 'x', kind: 'recurring', amount: 500, fromYear: 21, toYear: 25 },
    ])
    // same total extra budget, but early prepayment saves more interest
    expect(scheduleTotalInterest(early)).toBeLessThan(scheduleTotalInterest(late))
  })

  it('one-time lump sum drops the balance in its month', () => {
    const s = amortizationScheduleWithExtras(P, R, Y, [
      { id: 'x', kind: 'oneTime', amount: 20000, fromYear: 2, toYear: 2 },
    ])
    const base = amortizationSchedule(P, R, Y)
    const month13 = s.find((p) => p.month === 13)!
    const base13 = base.find((p) => p.month === 13)!
    expect(base13.balance - month13.balance).toBeGreaterThan(19000)
  })

  it('never overpays: final balance is exactly zero', () => {
    const s = amortizationScheduleWithExtras(50000, R, 5, [
      { id: 'x', kind: 'oneTime', amount: 999999, fromYear: 1, toYear: 1 },
    ])
    expect(s[s.length - 1].balance).toBe(0)
  })
})

describe('acceleratedBiweeklySchedule', () => {
  it('pays off years sooner and saves interest vs monthly', () => {
    const monthly = amortizationSchedule(480_000, 4.5, 25)
    const biweekly = acceleratedBiweeklySchedule(480_000, 4.5, 25)
    // Accelerated biweekly (monthly/2 × 26 = ~13 monthly payments/yr)
    // should shave multiple years off a 25y amortization.
    expect(biweekly.length / 26).toBeLessThan(monthly.length / 12 - 2)
    expect(scheduleTotalInterest(biweekly)).toBeLessThan(scheduleTotalInterest(monthly))
    expect(biweekly[biweekly.length - 1].balance).toBe(0)
  })
})
