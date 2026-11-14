import type { Transaction } from '../../types/budget'
import { detectRecurring, normalizeDescription, upcomingWithin, type RecurringItem } from './recurring'

let id = 0
const tx = (date: string, amount: number, description: string, type: 'expense' | 'income' = 'expense'): Transaction =>
  ({ id: `t${id++}`, date, amount, description, type })

const asRecord = (list: Transaction[]) => Object.fromEntries(list.map((t) => [t.id, t]))

describe('normalizeDescription', () => {
  it('strips reference numbers and case', () => {
    expect(normalizeDescription('NETFLIX.COM #12345')).toBe(normalizeDescription('netflix.com #99999'))
    expect(normalizeDescription('  Spotify   P2B4C ')).toContain('SPOTIFY')
  })
})

describe('detectRecurring', () => {
  it('finds a monthly subscription with jittered dates and amounts', () => {
    const txs = asRecord([
      tx('2026-03-01', 16.99, 'NETFLIX.COM #111'),
      tx('2026-04-02', 16.99, 'NETFLIX.COM #222'),
      tx('2026-05-01', 17.99, 'NETFLIX.COM #333'),
      tx('2026-06-01', 17.99, 'NETFLIX.COM #444'),
    ])
    const items = detectRecurring(txs)
    expect(items).toHaveLength(1)
    expect(items[0].occurrences).toBe(4)
    expect(items[0].intervalDays).toBeGreaterThanOrEqual(28)
    expect(items[0].intervalDays).toBeLessThanOrEqual(32)
    expect(items[0].nextExpected > '2026-06-01').toBe(true)
    expect(items[0].monthlyEstimate).toBeCloseTo(items[0].avgAmount * (30 / items[0].intervalDays), 6)
  })

  it('computes nextExpected as the correct local calendar date for a simple monthly series', () => {
    // Note: this test passes both before and after the local-date-parts fix
    // on a machine running at a negative UTC offset, where the old
    // toISOString-based read happened to agree with the local calendar date.
    // It is here to lock in the expected calendar date going forward, not to
    // demonstrate a red-to-green fix.
    const txs = asRecord([
      tx('2026-01-01', 10, 'MONTHLY THING'),
      tx('2026-02-01', 10, 'MONTHLY THING'),
      tx('2026-03-01', 10, 'MONTHLY THING'),
    ])
    const items = detectRecurring(txs)
    expect(items).toHaveLength(1)
    expect(items[0].lastDate).toBe('2026-03-01')
    expect(items[0].intervalDays).toBe(30)
    expect(items[0].nextExpected).toBe('2026-03-31')
  })

  it('detects biweekly income (paycheque)', () => {
    const txs = asRecord([
      tx('2026-05-01', 2500, 'ACME PAYROLL', 'income'),
      tx('2026-05-15', 2500, 'ACME PAYROLL', 'income'),
      tx('2026-05-29', 2500, 'ACME PAYROLL', 'income'),
      tx('2026-06-12', 2500, 'ACME PAYROLL', 'income'),
    ])
    const items = detectRecurring(txs)
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('income')
    expect(items[0].intervalDays).toBe(14)
  })

  it('rejects fewer than 3 occurrences, irregular gaps, and swinging amounts', () => {
    const txs = asRecord([
      tx('2026-05-01', 50, 'ONE OFF STORE'),
      tx('2026-05-02', 50, 'ONE OFF STORE'),
      // irregular
      tx('2026-01-01', 40, 'RANDOM SHOP'),
      tx('2026-01-05', 40, 'RANDOM SHOP'),
      tx('2026-06-01', 40, 'RANDOM SHOP'),
      // amount swings
      tx('2026-03-01', 10, 'GROCERY MART'),
      tx('2026-04-01', 300, 'GROCERY MART'),
      tx('2026-05-01', 80, 'GROCERY MART'),
    ])
    expect(detectRecurring(txs)).toHaveLength(0)
  })
})

const item = (key: string, nextExpected: string): RecurringItem => ({
  key,
  description: key,
  type: 'expense',
  avgAmount: 10,
  intervalDays: 30,
  occurrences: 3,
  lastDate: '2026-07-15',
  nextExpected,
  monthlyEstimate: 10,
})

describe('upcomingWithin', () => {
  it('keeps only charges due inside the window', () => {
    const items = [item('a', '2026-08-20'), item('b', '2026-09-30')]
    expect(upcomingWithin(items, '2026-08-14', 30).map((i) => i.key)).toEqual(['a'])
  })

  it('includes a charge due today and one due on the last day of the window', () => {
    const items = [item('today', '2026-08-14'), item('edge', '2026-09-13')]
    expect(upcomingWithin(items, '2026-08-14', 30).map((i) => i.key)).toEqual(['today', 'edge'])
  })

  it('drops a charge whose expected date has already passed', () => {
    expect(upcomingWithin([item('stale', '2026-08-01')], '2026-08-14', 30)).toEqual([])
  })

  it('orders soonest first', () => {
    const items = [item('later', '2026-09-01'), item('sooner', '2026-08-16')]
    expect(upcomingWithin(items, '2026-08-14', 30).map((i) => i.key)).toEqual(['sooner', 'later'])
  })

  it('includes a charge due on the final day of a window that crosses a month boundary', () => {
    const items = [item('edge', '2026-09-13')]
    expect(upcomingWithin(items, '2026-08-14', 30).map((i) => i.key)).toEqual(['edge'])
  })

  it('normalises a window end across a year boundary', () => {
    const items = [item('ny', '2027-01-19')]
    expect(upcomingWithin(items, '2026-12-20', 30).map((i) => i.key)).toEqual(['ny'])
  })
})
