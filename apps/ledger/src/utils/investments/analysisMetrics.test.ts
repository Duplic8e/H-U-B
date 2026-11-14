import type { BuyLot } from '../../store/useAnalysisStore'
import {
  allocationPct, avgCostBasis, counterfactualValue, currentValue,
  plDollars, plPct, sharesFromLots, thesisChangePct, totalInvested, variance,
} from './analysisMetrics'

const lots: BuyLot[] = [
  { id: 'l1', date: '2026-01-20', amountInvested: 5_000, price: 100 }, // 50 shares
  { id: 'l2', date: '2026-02-20', amountInvested: 3_000, price: 150 }, // 20 shares
]

describe('lot math', () => {
  it('computes shares, invested, and average cost', () => {
    expect(sharesFromLots(lots)).toBeCloseTo(70, 10)
    expect(totalInvested(lots)).toBe(8_000)
    expect(avgCostBasis(lots)).toBeCloseTo(8_000 / 70, 10)
    expect(avgCostBasis([])).toBeNull()
  })

  it('values the position and P/L at a live price', () => {
    expect(currentValue(lots, 200)).toBeCloseTo(14_000, 10)
    expect(plDollars(lots, 200)).toBeCloseTo(6_000, 10)
    expect(plPct(lots, 200)).toBeCloseTo(75, 10)
    expect(plPct([], 200)).toBeNull()
  })
})

describe('plan-vs-actual', () => {
  it('thesis change since analysis', () => {
    expect(thesisChangePct(100, 130)).toBeCloseTo(30, 10)
    expect(thesisChangePct(0, 130)).toBeNull()
  })

  it('counterfactual full-plan value', () => {
    expect(counterfactualValue(10_000, 100, 130)).toBeCloseTo(13_000, 10)
  })

  it('variance is invested minus planned', () => {
    expect(variance(10_000, lots)).toBe(-2_000)
  })

  it('allocation percentage guards zero totals', () => {
    expect(allocationPct(2_500, 10_000)).toBe(25)
    expect(allocationPct(2_500, 0)).toBeNull()
  })
})
