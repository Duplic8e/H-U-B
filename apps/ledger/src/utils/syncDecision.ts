export interface SnapshotMeta {
  fileId: string
  name: string
  createdTime: string
  revision: number
  deviceId: string
  deviceName: string
}

export interface LocalSyncFacts {
  lastSyncedRevision: number
  lastSyncedHash: string
  currentHash: string
  hasLocalData: boolean
}

export type PushDecision =
  | { kind: 'nothing-to-push' }
  | { kind: 'clean'; nextRevision: number; baseRevision: number }
  | { kind: 'diverged'; remote: SnapshotMeta; nextRevision: number; baseRevision: number }

export type PullDecision =
  | { kind: 'nothing-remote' }
  | { kind: 'up-to-date' }
  | { kind: 'clean'; remote: SnapshotMeta }
  | { kind: 'would-lose-local'; remote: SnapshotMeta }
  | { kind: 'collision'; remote: SnapshotMeta }

/** Highest revision wins; a tie is broken by the newer createdTime. */
export function latestSnapshot(snapshots: SnapshotMeta[]): SnapshotMeta | undefined {
  return snapshots.reduce<SnapshotMeta | undefined>((best, s) => {
    if (!best) return s
    if (s.revision !== best.revision) return s.revision > best.revision ? s : best
    return s.createdTime > best.createdTime ? s : best
  }, undefined)
}

/** True when two or more snapshots claim the highest revision, which means
 *  two devices pushed concurrently and one would otherwise be superseded
 *  without anyone being told. */
export function hasRevisionCollision(snapshots: SnapshotMeta[]): boolean {
  if (snapshots.length === 0) return false
  const top = snapshots.reduce((max, s) => Math.max(max, s.revision), snapshots[0].revision)
  return snapshots.filter((s) => s.revision === top).length > 1
}

function isDirty(facts: LocalSyncFacts): boolean {
  return facts.currentHash !== facts.lastSyncedHash
}

export function decidePush(facts: LocalSyncFacts, snapshots: SnapshotMeta[]): PushDecision {
  if (!facts.hasLocalData) return { kind: 'nothing-to-push' }

  const remote = latestSnapshot(snapshots)
  const remoteRevision = remote?.revision ?? 0
  const baseRevision = facts.lastSyncedRevision
  const nextRevision = remoteRevision + 1

  if (remote && (remoteRevision > baseRevision || hasRevisionCollision(snapshots))) {
    return { kind: 'diverged', remote, nextRevision, baseRevision }
  }
  if (!isDirty(facts)) return { kind: 'nothing-to-push' }
  return { kind: 'clean', nextRevision, baseRevision }
}

export function decidePull(facts: LocalSyncFacts, snapshots: SnapshotMeta[]): PullDecision {
  const remote = latestSnapshot(snapshots)
  if (!remote) return { kind: 'nothing-remote' }
  if (remote.revision <= facts.lastSyncedRevision) return { kind: 'up-to-date' }
  if (hasRevisionCollision(snapshots)) return { kind: 'collision', remote }
  if (facts.hasLocalData && isDirty(facts)) return { kind: 'would-lose-local', remote }
  return { kind: 'clean', remote }
}
