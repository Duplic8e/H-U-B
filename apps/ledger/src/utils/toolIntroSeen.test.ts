import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasSeenToolIntro, markToolIntroSeen, resetToolIntroMemory } from './toolIntroSeen'
import { BACKUP_KEYS, buildBackup } from './backup'
import { STORAGE_KEYS } from '../store/storageKeys'

describe('toolIntroSeen', () => {
  beforeEach(() => {
    localStorage.clear()
    resetToolIntroMemory()
  })
  afterEach(() => vi.restoreAllMocks())

  it('records seen tools per id', () => {
    expect(hasSeenToolIntro('mortgage')).toBe(false)
    markToolIntroSeen('mortgage')
    expect(hasSeenToolIntro('mortgage')).toBe(true)
    expect(hasSeenToolIntro('fire')).toBe(false)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.toolIntroSeen)!)).toEqual(['mortgage'])
  })

  it('survives a reload (memory cleared, storage kept)', () => {
    markToolIntroSeen('mortgage')
    resetToolIntroMemory()
    expect(hasSeenToolIntro('mortgage')).toBe(true)
  })

  it('works when storage throws, within the session', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(hasSeenToolIntro('mortgage')).toBe(false)
    markToolIntroSeen('mortgage')
    expect(hasSeenToolIntro('mortgage')).toBe(true)
  })

  it('tolerates a corrupt record', () => {
    localStorage.setItem(STORAGE_KEYS.toolIntroSeen, '{not json')
    expect(hasSeenToolIntro('mortgage')).toBe(false)
    markToolIntroSeen('mortgage')
    expect(hasSeenToolIntro('mortgage')).toBe(true)
  })

  it('is never part of a backup or Drive snapshot', () => {
    markToolIntroSeen('mortgage')
    expect(BACKUP_KEYS).not.toContain(STORAGE_KEYS.toolIntroSeen)
    expect(JSON.stringify(buildBackup())).not.toContain('ledger-tool-intro-seen')
  })
})
