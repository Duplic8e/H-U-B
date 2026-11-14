import { toDateKey, todayKey } from './dateKey'

describe('toDateKey', () => {
  it('formats a Date as YYYY-MM-DD (UTC)', () => {
    expect(toDateKey(new Date('2026-03-05T23:30:00Z'))).toBe('2026-03-05')
  })

  it('normalizes an ISO string', () => {
    expect(toDateKey('2026-01-09T12:00:00.000Z')).toBe('2026-01-09')
  })

  it('passes through an already-normalized date string', () => {
    expect(toDateKey('2026-12-31')).toBe('2026-12-31')
  })

  it('todayKey matches toDateKey(now)', () => {
    expect(todayKey()).toBe(toDateKey(new Date()))
  })
})
