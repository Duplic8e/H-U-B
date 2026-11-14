import { resultsByTicker, totalRealized } from './realized'
import type { Trade } from '../../types/trades'

const t = (over: Partial<Trade>): Trade => ({
  id: Math.random().toString(36).slice(2),
  date: '2026-01-05',
  ticker: 'VFV',
  account: 'RRSP',
  side: 'buy',
  quantity: 10,
  price: 100,
  fees: 0,
  currency: 'CAD',
  ...over,
})

describe('resultsByTicker', () => {
  it('averages the cost of two buys', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-01-05', quantity: 10, price: 100 }),
      t({ date: '2026-02-05', quantity: 10, price: 120 }),
    ])
    expect(r.quantity).toBe(20)
    expect(r.avgCost).toBe(110)
    expect(r.realized).toBe(0)
  })

  it('adds buy fees to the cost base', () => {
    const [r] = resultsByTicker([t({ quantity: 10, price: 100, fees: 10 })])
    expect(r.avgCost).toBe(101)
  })

  it('realises the gain on a sell using the average cost at that moment', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-01-05', quantity: 10, price: 100 }),
      t({ date: '2026-02-05', quantity: 10, price: 120 }),
      t({ date: '2026-03-05', side: 'sell', quantity: 5, price: 150 }),
    ])
    expect(r.quantity).toBe(15)
    expect(r.avgCost).toBe(110)
    expect(r.proceeds).toBe(750)
    expect(r.costOfSold).toBe(550)
    expect(r.realized).toBe(200)
  })

  it('subtracts sell fees from proceeds', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-01-05', quantity: 10, price: 100 }),
      t({ date: '2026-02-05', side: 'sell', quantity: 10, price: 110, fees: 5 }),
    ])
    expect(r.proceeds).toBe(1095)
    expect(r.realized).toBe(95)
  })

  it('processes trades in date order regardless of entry order', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-03-05', side: 'sell', quantity: 5, price: 150 }),
      t({ date: '2026-01-05', quantity: 10, price: 100 }),
    ])
    expect(r.realized).toBe(250)
    expect(r.quantity).toBe(5)
  })

  it('keeps each ticker separate', () => {
    const rows = resultsByTicker([
      t({ ticker: 'VFV', quantity: 10, price: 100 }),
      t({ ticker: 'XEQT', quantity: 5, price: 30 }),
    ])
    expect(rows.map((r) => r.ticker).sort()).toEqual(['VFV', 'XEQT'])
  })

  it('ignores a sell of more than is held rather than producing a negative position', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-01-05', quantity: 5, price: 100 }),
      t({ date: '2026-02-05', side: 'sell', quantity: 10, price: 120 }),
    ])
    expect(r.quantity).toBe(0)
    expect(r.realized).toBe(100)
  })

  it('resets the average cost to zero when the position is fully closed', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-01-05', quantity: 10, price: 100 }),
      t({ date: '2026-02-05', side: 'sell', quantity: 10, price: 120 }),
    ])
    expect(r.quantity).toBe(0)
    expect(r.avgCost).toBe(0)
  })

  it('realises nothing for a sell with a fee against a ticker with no prior buys', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-01-05', side: 'sell', quantity: 10, price: 120, fees: 5 }),
    ])
    expect(r.quantity).toBe(0)
    expect(r.realized).toBe(0)
    expect(r.proceeds).toBe(0)
    expect(r.costOfSold).toBe(0)
  })

  it('applies the fee once when a sell oversells a held position', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-01-05', quantity: 5, price: 100 }),
      t({ date: '2026-02-05', side: 'sell', quantity: 10, price: 120, fees: 5 }),
    ])
    expect(r.quantity).toBe(0)
    expect(r.proceeds).toBe(595)
    expect(r.costOfSold).toBe(500)
    expect(r.realized).toBe(95)
  })

  it('adds nothing further for a sell with a fee after the position is already closed', () => {
    const [r] = resultsByTicker([
      t({ date: '2026-01-05', quantity: 5, price: 100 }),
      t({ date: '2026-02-05', side: 'sell', quantity: 5, price: 120 }),
      t({ date: '2026-03-05', side: 'sell', quantity: 5, price: 130, fees: 5 }),
    ])
    expect(r.quantity).toBe(0)
    expect(r.realized).toBe(100)
  })
})

describe('totalRealized', () => {
  const trades = [
    t({ date: '2025-01-05', quantity: 10, price: 100 }),
    t({ date: '2025-06-05', side: 'sell', quantity: 5, price: 120 }),
    t({ date: '2026-06-05', side: 'sell', quantity: 5, price: 140 }),
  ]

  it('sums every realised gain when no year is given', () => {
    expect(totalRealized(trades)).toBe(300)
  })

  it('counts only sells settled in the given year', () => {
    expect(totalRealized(trades, 2025)).toBe(100)
    expect(totalRealized(trades, 2026)).toBe(200)
  })
})
