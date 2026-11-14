import { describe, expect, it } from 'vitest'
import { portfolioHighlights } from './portfolioHighlights'
import type { Holding } from '../../store/usePortfolioStore'

const h = (over: Partial<Holding>): Holding => ({
  id: 'h1', ticker: 'AAA', quantity: 10, avgCost: 100, currency: 'CAD', account: 'TFSA', ...over,
})

// VFV:  10 at 100 CAD cost, priced 150, so +50% and +500 CAD.
// CNQ:  10 at 100 CAD cost, priced 90,  so -10% and -100 CAD.
// AAPL: 100 at 100 USD cost, priced 120 USD at a rate of 2, so +20% but
//       +4000 CAD. The sizes are deliberate: AAPL wins on dollars while
//       VFV wins on percent, so a test that says "strongest is VFV" would
//       pass under a dollar ranking too if the numbers were not set up
//       this way.
const rows = [
  { holding: h({ id: '1', ticker: 'VFV' }), price: 150 },
  { holding: h({ id: '2', ticker: 'CNQ', account: 'RRSP' }), price: 90 },
  { holding: h({ id: '3', ticker: 'AAPL', quantity: 100, currency: 'USD' as const, account: 'RRSP' }), price: 120 },
]
const rates = { USD: 2 }

describe('portfolioHighlights', () => {
  it('ranks strongest and weakest on percentage return, not dollars', () => {
    const r = portfolioHighlights(rows, rates)
    // AAPL gained the most dollars (+4000 CAD against VFV's +500) but VFV
    // returned the most percent. Percent wins.
    expect(r.strongest).toEqual({ ticker: 'VFV', plPct: 50 })
    expect(r.weakest).toEqual({ ticker: 'CNQ', plPct: -10 })
  })

  it('names the largest weight', () => {
    const r = portfolioHighlights(rows, rates)
    // AAPL is 24000 CAD against VFV 1500 and CNQ 900.
    expect(r.largestWeight?.name).toBe('AAPL')
  })

  it('splits by currency, summing to 100', () => {
    const r = portfolioHighlights(rows, rates)
    const total = r.currencySplit.reduce((s, c) => s + c.pct, 0)
    expect(Math.round(total)).toBe(100)
    expect(r.currencySplit.map((c) => c.name).sort()).toEqual(['CAD', 'USD'])
  })

  it('counts holdings and distinct accounts', () => {
    const r = portfolioHighlights(rows, rates)
    expect(r.holdingCount).toBe(3)
    expect(r.accountCount).toBe(2)
  })

  it('returns nulls and zero counts for an empty portfolio', () => {
    const r = portfolioHighlights([], {})
    expect(r.strongest).toBeNull()
    expect(r.weakest).toBeNull()
    expect(r.largestWeight).toBeNull()
    expect(r.currencySplit).toEqual([])
    expect(r.holdingCount).toBe(0)
    expect(r.accountCount).toBe(0)
  })

  it('ignores holdings with no computable return when ranking', () => {
    // A zero cost basis makes holdingPlPct null, which must not become 0
    // and win the weakest slot. Only CNQ ends up ranked, so weakest is
    // null rather than a duplicate of strongest.
    const zeroCost = [
      { holding: h({ id: '1', ticker: 'FREE', avgCost: 0 }), price: 10 },
      { holding: h({ id: '2', ticker: 'CNQ' }), price: 90 },
    ]
    const r = portfolioHighlights(zeroCost, {})
    expect(r.strongest).toEqual({ ticker: 'CNQ', plPct: -10 })
    expect(r.weakest).toBeNull()
  })

  it('returns weakest as null when only one holding has a computable return', () => {
    // A single ranked holding is both the best and worst return there is,
    // which is not a meaningful "weakest" to show next to "strongest" with
    // the same ticker and number in contradictory colours.
    const single = [{ holding: h({ id: '1', ticker: 'VFV' }), price: 150 }]
    const r = portfolioHighlights(single, {})
    expect(r.strongest).toEqual({ ticker: 'VFV', plPct: 50 })
    expect(r.weakest).toBeNull()
  })

  it('still populates weakest once two holdings have a computable return', () => {
    const two = [
      { holding: h({ id: '1', ticker: 'VFV' }), price: 150 },
      { holding: h({ id: '2', ticker: 'CNQ', account: 'RRSP' }), price: 90 },
    ]
    const r = portfolioHighlights(two, {})
    expect(r.strongest).toEqual({ ticker: 'VFV', plPct: 50 })
    expect(r.weakest).toEqual({ ticker: 'CNQ', plPct: -10 })
  })
})
