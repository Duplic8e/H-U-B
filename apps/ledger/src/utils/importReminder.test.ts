import { beforeEach, describe, expect, it } from 'vitest'
import { dismissImportReminder, importReminderDue, importReminderIcs } from './importReminder'

beforeEach(() => localStorage.clear())
const nov5 = new Date(2026, 10, 5)

describe('monthly import reminder', () => {
  it('is due in a new month until something is imported that month', () => {
    expect(importReminderDue({ now: nov5, lastImportAt: '2026-10-02', hasData: true })).toBe(true)
    expect(importReminderDue({ now: nov5, lastImportAt: '2026-11-01', hasData: true })).toBe(false)
    expect(importReminderDue({ now: nov5, hasData: true })).toBe(true)
  })

  it('stays away from a brand new install', () => {
    expect(importReminderDue({ now: nov5, hasData: false })).toBe(false)
  })

  it('stays dismissed for the month and returns the next', () => {
    dismissImportReminder(nov5)
    expect(importReminderDue({ now: nov5, lastImportAt: '2026-10-02', hasData: true })).toBe(false)
    expect(importReminderDue({ now: new Date(2026, 11, 1), lastImportAt: '2026-10-02', hasData: true })).toBe(true)
  })

  it('builds a calendar event repeating on the 1st with an alert', () => {
    const ics = importReminderIcs(nov5)
    expect(ics).toContain('DTSTART:20261201T090000')
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=1')
    expect(ics).toContain('BEGIN:VALARM')
  })
})
