import { describe, expect, it } from 'vitest'
import type { Account } from '../../store/useAccountsStore'
import { netWorthTrend, valueAccounts } from './accountValuation'

describe('valueAccounts', () => {
  it('converts assets and subtracts converted debts', () => {
    const accounts: Account[] = [
      { id: 'cad', name: 'CAD', type: 'bank', value: 1000, currency: 'CAD' },
      { id: 'usd', name: 'USD', type: 'bank', value: 1000, currency: 'USD' },
      { id: 'debt', name: 'Card', type: 'debt', value: 100, currency: 'USD' },
    ]
    expect(valueAccounts(accounts, 1.35).totals.bank).toBe(2350)
    expect(valueAccounts(accounts, 1.35).netWorth).toBe(2215)
    expect(valueAccounts(accounts).totals.bank).toBeNull()
    expect(valueAccounts(accounts).totals.other).toBe(0)
    expect(valueAccounts(accounts).netWorth).toBeNull()
  })

  it('keeps CAD-only and empty totals available without a rate', () => {
    expect(valueAccounts([]).netWorth).toBe(0)
    expect(valueAccounts([{ id: 'a', name: 'CAD', type: 'bank', value: 42, currency: 'CAD' }]).netWorth).toBe(42)
  })

  it('preserves signed balances and full precision until formatting', () => {
    const accounts: Account[] = [
      { id: 'a', name: 'Asset', type: 'bank', value: -2.5, currency: 'USD' },
      { id: 'd', name: 'Debt', type: 'debt', value: -1.25, currency: 'USD' },
    ]
    expect(valueAccounts(accounts, 1.2345).cadById.a).toBe(-3.0862499999999997)
    expect(valueAccounts(accounts, 1.2345).netWorth).toBeCloseTo(-1.543125, 10)
  })

  it.each([undefined, 0, -1, NaN, Infinity, -Infinity])('rejects unusable USD rate %s', (rate) => {
    const accounts: Account[] = [{ id: 'a', name: 'USD', type: 'bank', value: 5, currency: 'USD' }]
    expect(valueAccounts(accounts, rate).cadById.a).toBeNull()
    expect(valueAccounts(accounts, rate).netWorth).toBeNull()
  })
})

describe('netWorthTrend', () => {
  it('uses the most recent snapshot at or before last month end', () => {
    expect(netWorthTrend(120, [
      { date: '2026-07-01', value: 50 },
      { date: '2026-08-31', value: 100 },
      { date: '2026-09-01', value: 999 },
    ], new Date('2026-09-15T12:00:00Z'))).toBe(20)
  })
  it('returns null for unavailable current value and zero without a usable comparison', () => {
    expect(netWorthTrend(null, [], new Date('2026-09-15T12:00:00Z'))).toBeNull()
    expect(netWorthTrend(100, [], new Date('2026-09-15T12:00:00Z'))).toBe(0)
    expect(netWorthTrend(100, [{ date: '2026-08-31', value: 0 }], new Date('2026-09-15T12:00:00Z'))).toBe(0)
  })
})
