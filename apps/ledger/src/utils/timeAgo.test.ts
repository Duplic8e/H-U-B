import { timeAgo, timeAgoLong } from './timeAgo'

const now = new Date('2026-08-14T12:00:00Z')

describe('timeAgo', () => {
  it('reads as just now under a minute', () => {
    expect(timeAgo('2026-08-14T11:59:30Z', now)).toBe('just now')
  })

  it('counts whole minutes', () => {
    expect(timeAgo('2026-08-14T11:55:00Z', now)).toBe('5 min ago')
  })

  it('counts hours', () => {
    expect(timeAgo('2026-08-14T09:00:00Z', now)).toBe('3 hours ago')
    expect(timeAgo('2026-08-14T11:00:00Z', now)).toBe('1 hour ago')
  })

  it('counts days', () => {
    expect(timeAgo('2026-08-12T12:00:00Z', now)).toBe('2 days ago')
    expect(timeAgo('2026-08-13T12:00:00Z', now)).toBe('1 day ago')
  })

  it('falls back to the date beyond a month', () => {
    expect(timeAgo('2026-05-01T12:00:00Z', now)).toBe('2026-05-01')
  })

  it('returns an empty string for an unparseable timestamp', () => {
    expect(timeAgo('not a date', now)).toBe('')
  })
})

describe('timeAgoLong', () => {
  it('writes the age out in Title Case', () => {
    expect(timeAgoLong('2026-08-14T11:59:30Z', now)).toBe('Just Now')
    expect(timeAgoLong('2026-08-14T11:39:00Z', now)).toBe('21 Minutes Ago')
    expect(timeAgoLong('2026-08-14T11:59:00Z', now)).toBe('1 Minute Ago')
    expect(timeAgoLong('2026-08-14T11:00:00Z', now)).toBe('1 Hour Ago')
    expect(timeAgoLong('2026-08-12T12:00:00Z', now)).toBe('2 Days Ago')
  })

  it('falls back to the date beyond a month and to nothing when unparseable', () => {
    expect(timeAgoLong('2026-05-01T12:00:00Z', now)).toBe('2026-05-01')
    expect(timeAgoLong('nope', now)).toBe('')
  })
})
