import { describe, it, expect, beforeEach } from 'vitest'
import { hashBackupData, currentBackupHash, hasLocalData } from './syncHash'

describe('syncHash', () => {
  beforeEach(() => localStorage.clear())

  it('is stable for the same input', () => {
    expect(hashBackupData({ a: 1 })).toBe(hashBackupData({ a: 1 }))
  })

  it('changes when the data changes', () => {
    expect(hashBackupData({ a: 1 })).not.toBe(hashBackupData({ a: 2 }))
  })

  it('returns a non-empty string for empty data', () => {
    expect(hashBackupData({})).not.toBe('')
  })

  it('currentBackupHash tracks localStorage', () => {
    const before = currentBackupHash()
    localStorage.setItem('ledger-budget', JSON.stringify({ x: 1 }))
    expect(currentBackupHash()).not.toBe(before)
  })

  it('hasLocalData is false on a fresh device and true once a key exists', () => {
    expect(hasLocalData()).toBe(false)
    localStorage.setItem('ledger-budget', JSON.stringify({ x: 1 }))
    expect(hasLocalData()).toBe(true)
  })
})
