import { mapPortfolioRows, parsePortfolioText } from './portfolioCsv'
import type { Holding } from '../store/usePortfolioStore'

const ibkrCsv = `Symbol,Description,Quantity,Cost Basis,Currency
AAPL,APPLE INC,10,1800,USD
VFV,VANGUARD SP500,100,12000,CAD`

const wsCsv = `Symbol,Name,Quantity,Book Value,Currency
XEQT,iShares All-Equity,50,1500,CAD`

const unknownCsv = `Ticker,Units,Total Paid
SHOP,5,600`

describe('parsePortfolioText', () => {
  it('parses the IBKR format', () => {
    const r = parsePortfolioText(ibkrCsv)
    expect(Array.isArray(r)).toBe(true)
    const holdings = r as Exclude<typeof r, { unrecognized: true }>
    expect(holdings).toHaveLength(2)
    expect(holdings[0]).toMatchObject({ ticker: 'AAPL', quantity: 10, avgCost: 180, currency: 'USD' })
    expect(holdings[1]).toMatchObject({ ticker: 'VFV', avgCost: 120, currency: 'CAD' })
  })

  it('parses the Wealthsimple format', () => {
    const r = parsePortfolioText(wsCsv)
    const holdings = r as Exclude<typeof r, { unrecognized: true }>
    expect(holdings[0]).toMatchObject({ ticker: 'XEQT', name: 'iShares All-Equity', quantity: 50, avgCost: 30, currency: 'CAD' })
  })

  it('returns unrecognized with headers + rows for unknown formats', () => {
    const r = parsePortfolioText(unknownCsv)
    expect(r).toMatchObject({ unrecognized: true, headers: ['Ticker', 'Units', 'Total Paid'] })
  })
})

describe('mapPortfolioRows', () => {
  it('maps arbitrary columns and derives avgCost', () => {
    const r = parsePortfolioText(unknownCsv)
    if (!('unrecognized' in r)) throw new Error('expected unrecognized')
    const mapped = mapPortfolioRows(r.rows, { ticker: 'Ticker', quantity: 'Units', totalCost: 'Total Paid' })
    expect(mapped).toHaveLength(1)
    expect(mapped[0]).toMatchObject({ ticker: 'SHOP', quantity: 5, avgCost: 120, currency: null })
  })

  it('skips unparseable rows', () => {
    const mapped = mapPortfolioRows(
      [{ Ticker: 'X', Units: 'abc', 'Total Paid': '10' }],
      { ticker: 'Ticker', quantity: 'Units', totalCost: 'Total Paid' },
    )
    expect(mapped).toHaveLength(0)
  })
})

describe('header normalization', () => {
  it('detects IBKR despite BOM, padding, and lowercase headers', () => {
    const csv = '﻿ symbol , Quantity , cost basis ,Currency\nAAPL,10,1500,USD\n'
    const result = parsePortfolioText(csv)
    expect(Array.isArray(result)).toBe(true)
    const holdings = result as Array<{ ticker: string; quantity: number; avgCost: number }>
    expect(holdings).toHaveLength(1)
    expect(holdings[0].ticker).toBe('AAPL')
    expect(holdings[0].quantity).toBe(10)
    expect(holdings[0].avgCost).toBeCloseTo(150)
  })

  it('detects Wealthsimple with trailing header whitespace', () => {
    const csv = 'Symbol ,Quantity,Book Value \nVFV,5,600\n'
    const result = parsePortfolioText(csv)
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(1)
  })

  it('still falls through to the mapper for genuinely unknown headers', () => {
    const csv = 'Ticker,Shares,Total\nAAPL,10,1500\n'
    const result = parsePortfolioText(csv)
    expect('unrecognized' in (result as object)).toBe(true)
  })
})

describe('currency parsing', () => {
  it('keeps the real currency code from an IBKR row', () => {
    const csv = [
      'Symbol,Description,Quantity,Cost Basis,Currency',
      'ASML,ASML Holding,10,6000,EUR',
      'SHEL,Shell plc,20,5000,GBP',
      'AAPL,Apple,5,1000,USD',
      'ENB,Enbridge,50,2500,CAD',
    ].join('\n')
    const result = parsePortfolioText(csv)
    expect(Array.isArray(result)).toBe(true)
    const holdings = result as Omit<Holding, 'id' | 'account'>[]
    expect(holdings.map((h) => h.currency)).toEqual(['EUR', 'GBP', 'USD', 'CAD'])
  })

  it('is case insensitive and tolerates whitespace', () => {
    const csv = 'Symbol,Quantity,Cost Basis,Currency\nASML,10,6000, eur '
    const holdings = parsePortfolioText(csv) as Omit<Holding, 'id' | 'account'>[]
    expect(holdings[0].currency).toBe('EUR')
  })

  it('returns null for an unsupported or blank code rather than guessing CAD', () => {
    const csv = 'Symbol,Quantity,Cost Basis,Currency\nXXX,10,6000,ZWL\nYYY,10,6000,'
    const holdings = parsePortfolioText(csv) as Omit<Holding, 'id' | 'account'>[]
    expect(holdings[0].currency).toBeNull()
    expect(holdings[1].currency).toBeNull()
  })
})
