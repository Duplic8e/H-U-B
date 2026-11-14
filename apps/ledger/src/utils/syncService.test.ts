import { describe, it, expect, beforeEach, vi } from 'vitest'
import { collectFacts, performPush, performPull, keysToPruneOnPull } from './syncService'
import { useSyncStore } from '../store/useSyncStore'
import { BACKUP_VERSION, BACKUP_KEYS, restoreBackup, type BackupEnvelope } from './backup'
import { hashBackupData } from './syncHash'
import type { SnapshotMeta } from './syncDecision'

vi.mock('./driveSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./driveSync')>()
  return {
    ...actual,
    uploadSnapshot: vi.fn(),
    downloadSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    pruneSnapshots: vi.fn(() => Promise.resolve(0)),
  }
})

const drive = await import('./driveSync')

function remoteMeta(revision: number): SnapshotMeta {
  return {
    fileId: `f-${revision}`, name: `r${revision}.json`, createdTime: '2026-08-12T10:00:00.000Z',
    revision, deviceId: 'dev-b', deviceName: 'Phone',
  }
}

describe('syncService', () => {
  beforeEach(() => {
    localStorage.removeItem('ledger-budget')
    useSyncStore.setState({ lastSyncedRevision: 0, lastSyncedHash: '', lastSyncedAt: undefined })
    vi.mocked(drive.uploadSnapshot).mockReset()
    vi.mocked(drive.downloadSnapshot).mockReset()
    vi.mocked(drive.pruneSnapshots).mockReset().mockResolvedValue(0)
  })

  it('collectFacts reports a fresh device', () => {
    const facts = collectFacts()
    expect(facts.lastSyncedRevision).toBe(0)
    expect(facts.hasLocalData).toBe(false)
  })

  it('collectFacts reports local data once a key exists', () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ x: 1 }))
    expect(collectFacts().hasLocalData).toBe(true)
  })

  it('performPush uploads an envelope stamped with device and revision', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ x: 1 }))
    useSyncStore.setState({ deviceId: 'dev-a', deviceName: 'Desktop' })
    vi.mocked(drive.uploadSnapshot).mockResolvedValue(remoteMeta(4))

    await performPush('tok', 'folder-1', 4, 3)

    const envelope = vi.mocked(drive.uploadSnapshot).mock.calls[0][2]
    expect(envelope.revision).toBe(4)
    expect(envelope.baseRevision).toBe(3)
    expect(envelope.deviceId).toBe('dev-a')
    expect(envelope.deviceName).toBe('Desktop')
    expect(envelope.data['ledger-budget']).toEqual({ x: 1 })
  })

  it('passes exclusion metadata through the persisted triage payload', async () => {
    const payload = { version: 3, state: {
      exclusionRules: { rule: { id: 'rule', enabled: false, revision: 2 } },
      importRecords: { ignored: { decision: 'ignored', ignoreReason: 'rule', exclusionMatches: [{ ruleId: 'rule', revision: 1, name: 'Original' }] },
        included: { decision: 'pending', exclusionOverride: 'include' } },
    } }
    localStorage.setItem('ledger-triage', JSON.stringify(payload))
    vi.mocked(drive.uploadSnapshot).mockResolvedValue(remoteMeta(4))
    await performPush('tok', 'folder-1', 4, 3)
    expect(vi.mocked(drive.uploadSnapshot).mock.calls[0][2].data['ledger-triage']).toEqual(payload)
    localStorage.removeItem('ledger-triage')
  })

  it('performPush records the sync bookmark only after a successful upload', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ x: 1 }))
    vi.mocked(drive.uploadSnapshot).mockRejectedValue(new Error('network down'))

    await expect(performPush('tok', 'folder-1', 4, 3)).rejects.toThrow('network down')
    expect(useSyncStore.getState().lastSyncedRevision).toBe(0)

    vi.mocked(drive.uploadSnapshot).mockResolvedValue(remoteMeta(4))
    await performPush('tok', 'folder-1', 4, 3)
    expect(useSyncStore.getState().lastSyncedRevision).toBe(4)
    expect(useSyncStore.getState().lastSyncedHash).not.toBe('')
  })

  it('bookmarks the uploaded payload\'s hash, not localStorage after the upload', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ x: 1 }))
    const originalHash = hashBackupData({ 'ledger-budget': { x: 1 } })

    vi.mocked(drive.uploadSnapshot).mockImplementation(async () => {
      // Simulate a local edit landing during the network round trip.
      localStorage.setItem('ledger-budget', JSON.stringify({ x: 2 }))
      return remoteMeta(4)
    })

    await performPush('tok', 'folder-1', 4, 3)

    expect(useSyncStore.getState().lastSyncedHash).toBe(originalHash)
    expect(useSyncStore.getState().lastSyncedHash).not.toBe(hashBackupData({ 'ledger-budget': { x: 2 } }))

    const facts = collectFacts()
    expect(facts.currentHash).not.toBe(facts.lastSyncedHash)
  })

  it('performPull restores the downloaded snapshot', async () => {
    const envelope: BackupEnvelope = {
      version: BACKUP_VERSION, exportedAt: '', app: 'ledger',
      data: { 'ledger-budget': { pulled: true } }, revision: 5,
    }
    vi.mocked(drive.downloadSnapshot).mockResolvedValue(JSON.stringify(envelope))

    await performPull('tok', remoteMeta(5))

    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ pulled: true })
    expect(useSyncStore.getState().lastSyncedRevision).toBe(5)
  })

  it('performPull leaves local data untouched when the remote file is corrupt', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ keep: true }))
    vi.mocked(drive.downloadSnapshot).mockResolvedValue('{not json')

    await expect(performPull('tok', remoteMeta(5))).rejects.toThrow('Invalid Ledger backup file')
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ keep: true })
    expect(useSyncStore.getState().lastSyncedRevision).toBe(0)
  })

  it('performPull removes a registered key the snapshot does not carry, and reports clean afterwards', async () => {
    // Device has portfolio data the remote snapshot never had (it was pushed
    // from a device that never used Investments).
    localStorage.setItem('ledger-portfolio', JSON.stringify({ holdings: [1, 2, 3] }))
    const envelope: BackupEnvelope = {
      version: BACKUP_VERSION, exportedAt: '', app: 'ledger',
      // Stamped with this build's own version: the writer knew about every
      // store this build has, so an absent key is a real deletion.
      appVersion: __APP_VERSION__,
      data: { 'ledger-budget': { pulled: true } }, revision: 5,
    }
    vi.mocked(drive.downloadSnapshot).mockResolvedValue(JSON.stringify(envelope))

    await performPull('tok', remoteMeta(5))

    expect(localStorage.getItem('ledger-portfolio')).toBeNull()
    const facts = collectFacts()
    expect(facts.currentHash).toBe(facts.lastSyncedHash)
  })

  it('performPull overwrites a key present in both local storage and the snapshot', async () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ old: true }))
    const envelope: BackupEnvelope = {
      version: BACKUP_VERSION, exportedAt: '', app: 'ledger',
      data: { 'ledger-budget': { fresh: true } }, revision: 5,
    }
    vi.mocked(drive.downloadSnapshot).mockResolvedValue(JSON.stringify(envelope))

    await performPull('tok', remoteMeta(5))

    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ fresh: true })
  })

  it('performPull leaves a registered key alone when the snapshot has no app version', async () => {
    // This guards performPull's wiring to keysToPruneOnPull. If a future edit
    // breaks the call, or adds a second unguarded sweep, nothing else would
    // catch the data loss: keysToPruneOnPull's unit tests pass, and the
    // snapshot-with-version case passes too. This end-to-end test catches it.
    localStorage.setItem('ledger-portfolio', JSON.stringify({ holdings: [1, 2, 3] }))
    const envelope: BackupEnvelope = {
      version: BACKUP_VERSION, exportedAt: '', app: 'ledger',
      // No appVersion field: every snapshot written before 0.9.8. The writer
      // may predate any registered store, so an absent key proves nothing.
      data: { 'ledger-budget': { pulled: true } }, revision: 5,
    }
    vi.mocked(drive.downloadSnapshot).mockResolvedValue(JSON.stringify(envelope))

    await performPull('tok', remoteMeta(5))

    expect(localStorage.getItem('ledger-portfolio')).not.toBeNull()
    const facts = collectFacts()
    expect(facts.currentHash).toBe(facts.lastSyncedHash)
  })
})

const envelope = (data: Record<string, unknown>, appVersion?: string): BackupEnvelope => ({
  version: 2,
  exportedAt: '2026-08-28T00:00:00.000Z',
  app: 'ledger',
  appVersion,
  data,
})

const REGISTERED = ['ledger-budget', 'ledger-trades', 'ledger-wheel']

describe('keysToPruneOnPull', () => {
  it('prunes a key the writer knew about and deliberately dropped', () => {
    // Same version on both sides: an absent key really was deleted.
    const env = envelope({ 'ledger-budget': {}, 'ledger-wheel': {} }, __APP_VERSION__)
    expect(keysToPruneOnPull(env, REGISTERED)).toEqual(['ledger-trades'])
  })

  it('prunes nothing when the snapshot carries no app version at all', () => {
    // Every snapshot written before 0.9.8. The writer may predate any of
    // these stores, so an absent key proves nothing.
    const env = envelope({ 'ledger-budget': {} }, undefined)
    expect(keysToPruneOnPull(env, REGISTERED)).toEqual([])
  })

  it('prunes nothing when the snapshot came from an older build', () => {
    const env = envelope({ 'ledger-budget': {} }, '0.8.1-beta')
    expect(keysToPruneOnPull(env, REGISTERED)).toEqual([])
  })

  it('prunes normally when the snapshot came from a newer build', () => {
    // A newer build knows about every store this build has, so an absent
    // key is a real deletion.
    const env = envelope({ 'ledger-budget': {} }, '99.0.0')
    expect(keysToPruneOnPull(env, REGISTERED)).toEqual(['ledger-trades', 'ledger-wheel'])
  })

  it('treats an unparseable version as older, which is the safe direction', () => {
    const env = envelope({ 'ledger-budget': {} }, 'not-a-version')
    expect(keysToPruneOnPull(env, REGISTERED)).toEqual([])
  })
})

describe('a pull from an older build does not destroy newer stores', () => {
  it('leaves the trade log alone', () => {
    localStorage.clear()
    localStorage.setItem('ledger-trades', JSON.stringify({ state: { trades: [{ id: 'tr1' }] } }))
    localStorage.setItem('ledger-budget', JSON.stringify({ state: { transactions: {} } }))

    const fromOldDevice = envelope({ 'ledger-budget': { state: { transactions: {} } } }, '0.8.1-beta')
    restoreBackup(fromOldDevice)
    for (const key of keysToPruneOnPull(fromOldDevice, BACKUP_KEYS)) localStorage.removeItem(key)

    expect(localStorage.getItem('ledger-trades')).not.toBeNull()
  })
})
