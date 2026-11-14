import { describe, expect, it } from 'vitest'
import { planRow, planFundSummary, actualFundSummary } from './planMetrics'
import type { Position, BuyLot } from '../../store/useAnalysisStore'

const pos = (over: Partial<Position>): Position => ({
  id: 'p1', ticker: 'AAPL', plannedAmount: 0, startPrice: 100,
  startPriceSource: 'manual', acted: false, lots: [], ...over,
})

describe('planRow with plannedBudget', () => {
  it('computes planned dollars from budget x allocation', () => {
    const r = planRow(pos({ allocationPct: 25 }), 10000, 120)
    expect(r.plannedDollars).toBe(2500)
    expect(r.shares).toBeCloseTo(25) // 2500 / 100
    expect(r.currentValue).toBeCloseTo(3000)
    expect(r.returnDollars).toBeCloseTo(500)
  })
})

describe('planFundSummary', () => {
  it('uses plannedBudget as the fund basis', () => {
    const rows = [planRow(pos({ allocationPct: 100 }), 10000, 110)]
    const s = planFundSummary(rows, 10000)
    expect(s.totalInvested).toBe(10000)
    expect(s.currentValue).toBeCloseTo(11000)
    expect(s.totalReturnPct).toBeCloseTo(10)
  })
})

describe('actualFundSummary initial vs extra', () => {
  const posWithLots = (lots: BuyLot[]): Position => ({
    id: 'p1', ticker: 'AAPL', plannedAmount: 0, startPrice: 100,
    startPriceSource: 'manual', acted: true, lots,
  })

  it('splits initial (earliest trade date) from extra (later dates)', () => {
    const s = actualFundSummary(
      [posWithLots([
        { id: 'l1', date: '2026-01-10', amountInvested: 1000, price: 100 },
        { id: 'l2', date: '2026-01-10', amountInvested: 500, price: 100 },
        { id: 'l3', date: '2026-03-01', amountInvested: 700, price: 140 },
      ])],
      () => 150,
    )
    expect(s.initialInvested).toBe(1500)
    expect(s.extraInvested).toBe(700)
    expect(s.totalInvested).toBe(2200)
  })

  it('earliest date is computed across all positions', () => {
    const s = actualFundSummary(
      [
        posWithLots([{ id: 'a', date: '2026-02-01', amountInvested: 300, price: 100 }]),
        { ...posWithLots([{ id: 'b', date: '2026-01-15', amountInvested: 200, price: 100 }]), id: 'p2', ticker: 'MSFT' },
      ],
      () => 100,
    )
    expect(s.initialInvested).toBe(200)
    expect(s.extraInvested).toBe(300)
  })

  it('reports return in dollars', () => {
    const s = actualFundSummary(
      [posWithLots([{ id: 'l1', date: '2026-01-10', amountInvested: 1000, price: 100 }])],
      () => 110, // 10 shares * 110 = 1100
    )
    expect(s.totalReturnDollars).toBeCloseTo(100)
    expect(s.totalReturnPct).toBeCloseTo(10)
  })
})

describe('planFundSummary dollars', () => {
  it('exposes return dollars alongside pct', () => {
    // one row: planned 1000, current value 1100
    const row = { positionId: 'p', ticker: 'T', allocationPct: 100, plannedDollars: 1000,
      startPrice: 100, shares: 10, currentPrice: 110, currentValue: 1100,
      returnDollars: 100, returnPct: 10 }
    const s = planFundSummary([row], 1000)
    expect(s.totalReturnDollars).toBeCloseTo(100)
    expect(s.initialInvested).toBe(1000)
    expect(s.extraInvested).toBe(0)
  })
})
