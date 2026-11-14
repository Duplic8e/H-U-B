import { describe, expect, it } from 'vitest'
import { mergeActivityRows, processIBKR, type RawRow } from './ibkrActivityParser'

const optionTrade: RawRow = ['Trades', 'Data', 'Order', 'Equity and Index Options', '', 'AAPL 19JAN26 150 P', '2026-01-02', -1, 2.5, '', 250, -1.05]
const stockBuy: RawRow = ['Trades', 'Data', 'Order', 'Stocks', '', 'AAPL', '2026-01-05', 100, 150, '', -15000, -1]
const openStock: RawRow = ['Open Positions', 'Data', 'Summary', 'Stocks', '', 'AAPL', 100, '', '', 15001, 155, 15500]
const openPut: RawRow = ['Open Positions', 'Data', 'Summary', 'Equity and Index Options', '', 'AAPL 19JAN26 150 P', -1, '', '', '', '', '']

describe('processIBKR', () => {
  it('builds ticker state from trades and open positions', () => {
    const map = processIBKR([optionTrade, stockBuy, openStock, openPut])
    const aapl = map['AAPL']
    expect(aapl).toBeDefined()
    expect(aapl.opSharesHeld).toBe(100)
    // Trade reconstruction matches held shares, so raw equity cost wins:
    expect(aapl.displayCost).toBeCloseTo(15001, 2)
    expect(aapl.premiumCollected).toBeCloseTo(248.95, 2)
    expect(aapl.currentPrice).toBe(155)
    expect(aapl.openPutContracts).toBe(1)
    expect(aapl.openPutStrikeSum).toBe(150)
    expect(aapl.hasOpenPosition).toBe(true)
    expect(aapl.history).toHaveLength(2)
  })
})

describe('processIBKR currency', () => {
  it('reads each tickers currency from the Currency column', () => {
    const krw: RawRow = ['Open Positions', 'Data', 'Summary', 'Stocks', 'KRW', '005930', 25, '', '', 7141000, 261500, 6537500]
    const usd: RawRow = ['Open Positions', 'Data', 'Summary', 'Stocks', 'USD', 'AAPL', 100, '', '', 15001, 155, 15500]
    const map = processIBKR([krw, usd])
    expect(map['005930'].currency).toBe('KRW')
    expect(map['AAPL'].currency).toBe('USD')
  })

  it('leaves currency unset when the column is blank', () => {
    expect(processIBKR([stockBuy])['AAPL'].currency).toBeUndefined()
  })
})

describe('mergeActivityRows', () => {
  it('dedupes identical trade rows across uploads', () => {
    const merged = mergeActivityRows([optionTrade, stockBuy], [optionTrade, stockBuy])
    expect(merged.filter((r) => r[0] === 'Trades')).toHaveLength(2)
  })

  it('keeps open positions from the NEW upload only', () => {
    const staleOpen: RawRow = ['Open Positions', 'Data', 'Summary', 'Stocks', '', 'AAPL', 999, '', '', 1, 1, 999]
    const merged = mergeActivityRows([optionTrade, staleOpen], [openStock])
    const openRows = merged.filter((r) => r[0] === 'Open Positions')
    expect(openRows).toHaveLength(1)
    expect(openRows[0][6]).toBe(100)
  })

  it('drops non-trade, non-open-position noise rows', () => {
    const noise: RawRow = ['Statement', 'Data', 'Title', 'Activity Statement', '', '', '', '', '', '', '', '']
    const merged = mergeActivityRows([], [noise, stockBuy])
    expect(merged).toHaveLength(1)
  })
})
