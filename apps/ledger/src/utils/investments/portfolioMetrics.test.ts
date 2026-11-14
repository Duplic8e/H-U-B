import type { Holding } from '../../store/usePortfolioStore'
import {
  allocationBreakdown, bookValue, convertAmount, holdingPlDollars, holdingPlPct, marketValue, portfolioTotals, quoteCurrencyForHolding, toCad, type FxRates,
} from './portfolioMetrics'

const h = (over: Partial<Holding>): Holding => ({
  id: 'h1', ticker: 'AAA', quantity: 10, avgCost: 100, currency: 'CAD', account: 'A', ...over,
})

const rates: FxRates = { USD: 1.37, EUR: 1.47 }

const cadHolding: Holding = { id: 'h1', account: 'Default', ticker: 'VFV', quantity: 100, avgCost: 120, currency: 'CAD' }
const usdHolding: Holding = { id: 'h2', account: 'Default', ticker: 'AAPL', quantity: 10, avgCost: 180, currency: 'USD' }

describe('per-holding math', () => {
  it('book and market value', () => {
    expect(bookValue(cadHolding)).toBe(12_000)
    expect(marketValue(cadHolding, 150)).toBe(15_000)
  })

  it('P/L in dollars and percent', () => {
    expect(holdingPlDollars(cadHolding, 150)).toBe(3_000)
    expect(holdingPlPct(cadHolding, 150)).toBeCloseTo(25, 10)
    expect(holdingPlPct({ ...cadHolding, quantity: 0 }, 150)).toBeNull()
  })
})

describe('toCad', () => {
  it('leaves CAD untouched without needing a rate', () => {
    expect(toCad(100, 'CAD', {})).toBe(100)
  })

  it('applies the currency rate', () => {
    expect(toCad(100, 'USD', rates)).toBeCloseTo(137, 5)
    expect(toCad(100, 'EUR', rates)).toBeCloseTo(147, 5)
  })

  it('returns null when the rate is missing', () => {
    expect(toCad(100, 'GBP', rates)).toBeNull()
  })
})

describe('convertAmount', () => {
  it('is identity for the same currency', () => {
    expect(convertAmount(100, 'USD', 'USD', rates)).toBe(100)
  })

  it('crosses two currencies through CAD', () => {
    // 100 USD -> 137 CAD -> 137/1.47 EUR
    expect(convertAmount(100, 'USD', 'EUR', rates)).toBeCloseTo(137 / 1.47, 5)
  })

  it('returns null when either leg is missing', () => {
    expect(convertAmount(100, 'USD', 'GBP', rates)).toBeNull()
    expect(convertAmount(100, 'GBP', 'USD', rates)).toBeNull()
  })
})

describe('portfolioTotals', () => {
  it('normalizes everything to CAD', () => {
    const t = portfolioTotals(
      [
        { holding: cadHolding, price: 150 }, // invested 12,000 -> 15,000
        { holding: usdHolding, price: 200 }, // invested 1,800 USD -> 2,430 CAD; value 2,000 USD -> 2,700 CAD
      ],
      { USD: 1.35 },
    )
    expect(t.investedCad).toBeCloseTo(12_000 + 2_430, 6)
    expect(t.valueCad).toBeCloseTo(15_000 + 2_700, 6)
    expect(t.plCad).toBeCloseTo(3_270, 6)
    expect(t.plPct).toBeCloseTo((3_270 / 14_430) * 100, 6)
    expect(t.excludedCount).toBe(0)
  })

  it('handles the empty portfolio', () => {
    const t = portfolioTotals([], { USD: 1.35 })
    expect(t).toEqual({ investedCad: 0, valueCad: 0, plCad: 0, plPct: null, excludedCount: 0 })
  })

  it('sums three currencies into CAD', () => {
    const totals = portfolioTotals(
      [
        { holding: h({ id: '1', currency: 'CAD', quantity: 1, avgCost: 100 }), price: 120 },
        { holding: h({ id: '2', currency: 'USD', quantity: 1, avgCost: 100 }), price: 100 },
        { holding: h({ id: '3', currency: 'EUR', quantity: 1, avgCost: 100 }), price: 100 },
      ],
      rates,
    )
    expect(totals.investedCad).toBeCloseTo(100 + 137 + 147, 5)
    expect(totals.valueCad).toBeCloseTo(120 + 137 + 147, 5)
    expect(totals.excludedCount).toBe(0)
  })

  it('excludes holdings with no rate and counts them', () => {
    const totals = portfolioTotals(
      [
        { holding: h({ id: '1', currency: 'CAD', quantity: 1, avgCost: 100 }), price: 120 },
        { holding: h({ id: '2', currency: 'GBP', quantity: 1, avgCost: 100 }), price: 100 },
      ],
      rates,
    )
    expect(totals.investedCad).toBe(100)
    expect(totals.valueCad).toBe(120)
    expect(totals.excludedCount).toBe(1)
  })
})

describe('allocationBreakdown', () => {
  const rows = [
    { holding: h({ id: '1', ticker: 'ENB', currency: 'CAD', account: 'RRSP', quantity: 1, avgCost: 1 }), price: 100 },
    { holding: h({ id: '2', ticker: 'AAPL', currency: 'USD', account: 'TFSA', quantity: 1, avgCost: 1 }), price: 100 },
    { holding: h({ id: '3', ticker: 'MSFT', currency: 'USD', account: 'TFSA', quantity: 1, avgCost: 1 }), price: 100 },
  ]

  it('groups by holding, largest first', () => {
    const slices = allocationBreakdown(rows, rates, 'holding')
    expect(slices.map((s) => s.name)).toEqual(['AAPL', 'MSFT', 'ENB'])
    expect(slices[0].valueCad).toBeCloseTo(137, 5)
  })

  it('groups by account and sums within each', () => {
    const slices = allocationBreakdown(rows, rates, 'account')
    expect(slices[0].name).toBe('TFSA')
    expect(slices[0].valueCad).toBeCloseTo(274, 5)
  })

  it('groups by currency', () => {
    const slices = allocationBreakdown(rows, rates, 'currency')
    expect(slices.map((s) => s.name)).toEqual(['USD', 'CAD'])
  })

  it('percentages sum to 100', () => {
    const total = allocationBreakdown(rows, rates, 'holding').reduce((s, x) => s + x.pct, 0)
    expect(total).toBeCloseTo(100, 5)
  })

  it('labels a null currency and drops it from the totals', () => {
    const withUnknown = [
      ...rows,
      { holding: h({ id: '4', ticker: 'XXX', currency: null, account: 'TFSA', quantity: 1, avgCost: 1 }), price: 100 },
    ]
    const slices = allocationBreakdown(withUnknown, rates, 'currency')
    expect(slices.map((s) => s.name)).not.toContain('Unknown')
    expect(slices.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 5)
  })
})

describe('allocationBreakdown slice cap', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    holding: { id: `h${i}`, ticker: `T${i}`, quantity: 1, avgCost: 1, currency: 'CAD', account: 'A' },
    price: 12 - i,
  })) as Parameters<typeof allocationBreakdown>[0]

  it('returns every slice when no cap is given', () => {
    expect(allocationBreakdown(rows, {}, 'holding')).toHaveLength(12)
  })

  it('folds the tail into Other when a cap is given', () => {
    const out = allocationBreakdown(rows, {}, 'holding', 8)
    expect(out).toHaveLength(8)
    expect(out[7].name).toBe('Other')
    // Nothing is lost: the percentages still sum to 100.
    expect(out.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 6)
  })

  it('does not add Other when the cap is not exceeded', () => {
    const out = allocationBreakdown(rows.slice(0, 5), {}, 'holding', 8)
    expect(out).toHaveLength(5)
    expect(out.some((x) => x.name === 'Other')).toBe(false)
  })

  it('does not add Other for exactly the cap', () => {
    const out = allocationBreakdown(rows.slice(0, 8), {}, 'holding', 8)
    expect(out).toHaveLength(8)
    expect(out.some((x) => x.name === 'Other')).toBe(false)
  })
})

describe('quoteCurrencyForHolding', () => {
  const cadHolding = {
    id: 'h1', ticker: 'VFV', quantity: 10, avgCost: 100,
    currency: 'CAD' as const, account: 'TFSA',
  }

  it('ignores the currency reported for a manual override and uses the holding currency', () => {
    // The service stamps a placeholder currency on overrides because it has
    // no holding context. Believing it converts a CAD price as though it
    // were USD, which is the defect this function exists to prevent.
    expect(quoteCurrencyForHolding(cadHolding, 'USD', 'override')).toBe('CAD')
  })

  it('believes the currency on a live quote', () => {
    expect(quoteCurrencyForHolding(cadHolding, 'USD', 'live')).toBe('USD')
  })

  it('believes the currency on a cached quote', () => {
    expect(quoteCurrencyForHolding(cadHolding, 'USD', 'cache')).toBe('USD')
  })

  it('falls back to the holding currency when there is no quote at all', () => {
    expect(quoteCurrencyForHolding(cadHolding, undefined, undefined)).toBe('CAD')
  })

  it('returns the unset holding currency for an override on a holding with no currency', () => {
    const unset = { ...cadHolding, currency: null }
    expect(quoteCurrencyForHolding(unset, 'USD', 'override')).toBeNull()
  })
})
