import { describe, expect, it } from 'vitest'
import { dueReminders } from './reminders'

const now = new Date('2026-08-16T09:00:00Z')

describe('dueReminders', () => {
  const items = [
    { key: 'rent', label: 'Rent', nextDate: '2026-08-18' },
    { key: 'gym', label: 'Gym', nextDate: '2026-09-30' },
    { key: 'phone', label: 'Phone', nextDate: '2026-08-17' },
  ]

  it('returns only items inside the lead window', () => {
    const due = dueReminders(items, { now, leadDays: 3, ignoredKeys: [] })
    expect(due.map((d) => d.key).sort()).toEqual(['phone', 'rent'])
  })

  it('respects the ignore list', () => {
    const due = dueReminders(items, { now, leadDays: 3, ignoredKeys: ['rent'] })
    expect(due.map((d) => d.key)).toEqual(['phone'])
  })

  it('skips items already in the past', () => {
    const due = dueReminders([{ key: 'old', label: 'Old', nextDate: '2026-08-01' }], {
      now,
      leadDays: 3,
      ignoredKeys: [],
    })
    expect(due).toEqual([])
  })

  it('ignores unparseable dates instead of throwing', () => {
    const due = dueReminders([{ key: 'bad', label: 'Bad', nextDate: 'nope' }], {
      now,
      leadDays: 3,
      ignoredKeys: [],
    })
    expect(due).toEqual([])
  })
})

describe('dueReminders on the due date', () => {
  it('includes a bill due today', () => {
    const due = dueReminders([{ key: 'rent', label: 'Rent', nextDate: '2026-08-16' }], {
      now: new Date('2026-08-16T09:00:00Z'),
      leadDays: 3,
      ignoredKeys: [],
    })
    expect(due.map((d) => d.key)).toEqual(['rent'])
  })

  it('includes a bill due today even late in the local day', () => {
    const due = dueReminders([{ key: 'rent', label: 'Rent', nextDate: '2026-08-16' }], {
      now: new Date('2026-08-16T23:30:00Z'),
      leadDays: 3,
      ignoredKeys: [],
    })
    expect(due.map((d) => d.key)).toEqual(['rent'])
  })

  it('still excludes a bill that was due yesterday', () => {
    const due = dueReminders([{ key: 'old', label: 'Old', nextDate: '2026-08-15' }], {
      now: new Date('2026-08-16T09:00:00Z'),
      leadDays: 3,
      ignoredKeys: [],
    })
    expect(due).toEqual([])
  })

  it('includes the last day of the lead window and excludes the day after', () => {
    const opts = { now: new Date('2026-08-16T09:00:00Z'), leadDays: 3, ignoredKeys: [] }
    expect(
      dueReminders([{ key: 'edge', label: 'Edge', nextDate: '2026-08-19' }], opts).map((d) => d.key),
    ).toEqual(['edge'])
    expect(dueReminders([{ key: 'past', label: 'Past', nextDate: '2026-08-20' }], opts)).toEqual([])
  })
})
