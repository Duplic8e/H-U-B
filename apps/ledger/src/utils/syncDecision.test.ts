import { describe, it, expect } from 'vitest'
import { decidePush, decidePull, latestSnapshot, hasRevisionCollision, type SnapshotMeta, type LocalSyncFacts } from './syncDecision'

function snap(revision: number, over: Partial<SnapshotMeta> = {}): SnapshotMeta {
  return {
    fileId: `file-${revision}`,
    name: `ledger-r${revision}.json`,
    createdTime: `2026-08-1${revision}T00:00:00.000Z`,
    revision,
    deviceId: 'other-device',
    deviceName: 'Phone',
    ...over,
  }
}

const synced: LocalSyncFacts = {
  lastSyncedRevision: 3,
  lastSyncedHash: 'hash-3',
  currentHash: 'hash-3',
  hasLocalData: true,
}

describe('latestSnapshot', () => {
  it('returns undefined for an empty list', () => {
    expect(latestSnapshot([])).toBeUndefined()
  })

  it('picks the highest revision regardless of order', () => {
    expect(latestSnapshot([snap(2), snap(5), snap(3)])!.revision).toBe(5)
  })

  it('breaks a revision tie with the newer createdTime', () => {
    const older = snap(5, { fileId: 'older', createdTime: '2026-08-01T00:00:00.000Z' })
    const newer = snap(5, { fileId: 'newer', createdTime: '2026-08-02T00:00:00.000Z' })
    expect(latestSnapshot([older, newer])!.fileId).toBe('newer')
  })
})

describe('decidePush', () => {
  it('has nothing to push when local is unchanged and remote has not moved', () => {
    expect(decidePush(synced, [snap(3)]).kind).toBe('nothing-to-push')
  })

  it('pushes cleanly when local changed and remote has not moved', () => {
    const d = decidePush({ ...synced, currentHash: 'hash-4' }, [snap(3)])
    expect(d).toEqual({ kind: 'clean', nextRevision: 4, baseRevision: 3 })
  })

  it('pushes cleanly as revision 1 when Drive is empty', () => {
    const facts = { lastSyncedRevision: 0, lastSyncedHash: '', currentHash: 'hash-1', hasLocalData: true }
    expect(decidePush(facts, [])).toEqual({ kind: 'clean', nextRevision: 1, baseRevision: 0 })
  })

  it('reports divergence when the other device pushed since our last sync', () => {
    const d = decidePush({ ...synced, currentHash: 'hash-4' }, [snap(3), snap(5)])
    expect(d.kind).toBe('diverged')
    if (d.kind === 'diverged') {
      expect(d.remote.deviceName).toBe('Phone')
      expect(d.nextRevision).toBe(6)
      expect(d.baseRevision).toBe(3)
    }
  })

  it('reports divergence even when local is unchanged but remote moved', () => {
    expect(decidePush(synced, [snap(5)]).kind).toBe('diverged')
  })

  it('has nothing to push from a fresh device with no local data even though the hash differs', () => {
    const fresh = { lastSyncedRevision: 0, lastSyncedHash: '', currentHash: 'hash-empty', hasLocalData: false }
    expect(decidePush(fresh, []).kind).toBe('nothing-to-push')
  })

  it('has nothing to push from a device with no local data even when Drive has newer snapshots', () => {
    const fresh = { lastSyncedRevision: 0, lastSyncedHash: '', currentHash: 'hash-empty', hasLocalData: false }
    expect(decidePush(fresh, [snap(3), snap(5)]).kind).toBe('nothing-to-push')
  })

  it('reports divergence when two snapshots tie at the highest revision, even at our own last synced revision', () => {
    const tieA = snap(3, { fileId: 'tie-a', deviceId: 'device-a' })
    const tieB = snap(3, { fileId: 'tie-b', deviceId: 'device-b' })
    const d = decidePush(synced, [tieA, tieB])
    expect(d.kind).toBe('diverged')
  })
})

describe('hasRevisionCollision', () => {
  it('is false for an empty list', () => {
    expect(hasRevisionCollision([])).toBe(false)
  })

  it('is false for a single snapshot', () => {
    expect(hasRevisionCollision([snap(3)])).toBe(false)
  })

  it('is false when all revisions are distinct', () => {
    expect(hasRevisionCollision([snap(2), snap(3), snap(5)])).toBe(false)
  })

  it('is true when two snapshots tie at the highest revision', () => {
    expect(hasRevisionCollision([snap(3), snap(5, { fileId: 'a' }), snap(5, { fileId: 'b' })])).toBe(true)
  })

  it('is false when a tie exists at a non-top revision', () => {
    expect(hasRevisionCollision([snap(3, { fileId: 'a' }), snap(3, { fileId: 'b' }), snap(5)])).toBe(false)
  })
})

describe('decidePull', () => {
  it('reports nothing to pull when Drive is empty', () => {
    expect(decidePull(synced, []).kind).toBe('nothing-remote')
  })

  it('is up to date when the newest snapshot is the one we synced with', () => {
    expect(decidePull(synced, [snap(3)]).kind).toBe('up-to-date')
  })

  it('pulls cleanly when remote is newer and local is unchanged', () => {
    const d = decidePull(synced, [snap(5)])
    expect(d.kind).toBe('clean')
  })

  it('warns when remote is newer and local has unpushed edits', () => {
    const d = decidePull({ ...synced, currentHash: 'hash-9' }, [snap(5)])
    expect(d.kind).toBe('would-lose-local')
  })

  it('pulls cleanly onto a fresh device with no local data', () => {
    const fresh = { lastSyncedRevision: 0, lastSyncedHash: '', currentHash: 'hash-empty', hasLocalData: false }
    expect(decidePull(fresh, [snap(5)]).kind).toBe('clean')
  })

  it('warns on a device that has data but has never synced', () => {
    const never = { lastSyncedRevision: 0, lastSyncedHash: '', currentHash: 'hash-x', hasLocalData: true }
    expect(decidePull(never, [snap(5)]).kind).toBe('would-lose-local')
  })

  it('reports a collision when two snapshots tie at the highest revision and local is clean', () => {
    const tieA = snap(5, { fileId: 'tie-a', deviceId: 'device-a' })
    const tieB = snap(5, { fileId: 'tie-b', deviceId: 'device-b' })
    expect(decidePull(synced, [tieA, tieB]).kind).toBe('collision')
  })

  it('reports a collision, not would-lose-local, when there is a tie and local is also dirty', () => {
    // Collision now takes precedence: the destructive would-lose-local dialog
    // would name only one of the two tied snapshots as "the" remote, which is
    // misleading when the real problem is that Drive itself is ambiguous.
    const tieA = snap(5, { fileId: 'tie-a', deviceId: 'device-a' })
    const tieB = snap(5, { fileId: 'tie-b', deviceId: 'device-b' })
    const dirty = { ...synced, currentHash: 'hash-9' }
    expect(decidePull(dirty, [tieA, tieB]).kind).toBe('collision')
  })

  it('reports a collision even with no local data, since Drive itself is ambiguous', () => {
    const tieA = snap(5, { fileId: 'tie-a', deviceId: 'device-a' })
    const tieB = snap(5, { fileId: 'tie-b', deviceId: 'device-b' })
    const fresh = { lastSyncedRevision: 0, lastSyncedHash: '', currentHash: 'hash-empty', hasLocalData: false }
    expect(decidePull(fresh, [tieA, tieB]).kind).toBe('collision')
  })

  it('is up to date when dirty locally but Drive has nothing newer', () => {
    const dirty = { ...synced, currentHash: 'hash-9' }
    expect(decidePull(dirty, [snap(3)]).kind).toBe('up-to-date')
  })

  it('is up to date once a collision has already been resolved by a previous pull', () => {
    const tieA = snap(3, { fileId: 'tie-a', deviceId: 'device-a' })
    const tieB = snap(3, { fileId: 'tie-b', deviceId: 'device-b' })
    expect(decidePull(synced, [tieA, tieB]).kind).toBe('up-to-date')
  })

  it('still reports a collision at a revision higher than the last resolved one', () => {
    const tieA = snap(5, { fileId: 'tie-a', deviceId: 'device-a' })
    const tieB = snap(5, { fileId: 'tie-b', deviceId: 'device-b' })
    expect(decidePull(synced, [tieA, tieB]).kind).toBe('collision')
  })
})
