import { BACKUP_KEYS, buildBackup, parseBackupText, restoreBackup, type BackupEnvelope } from './backup'
import { currentBackupHash, hasLocalData, hashBackupData } from './syncHash'
import { useSyncStore } from '../store/useSyncStore'
import { decidePull, decidePush, type LocalSyncFacts, type PullDecision, type PushDecision, type SnapshotMeta } from './syncDecision'
import { downloadSnapshot, findOrCreateFolder, listSnapshots, pruneSnapshots, uploadSnapshot } from './driveSync'

export function collectFacts(): LocalSyncFacts {
  const { lastSyncedRevision, lastSyncedHash } = useSyncStore.getState()
  return {
    lastSyncedRevision,
    lastSyncedHash,
    currentHash: currentBackupHash(),
    hasLocalData: hasLocalData(),
  }
}

/** Resolves the sync folder and its snapshots, caching the folder id. */
export async function prepare(token: string): Promise<{ folderId: string; snapshots: SnapshotMeta[] }> {
  const folderId = await findOrCreateFolder(token)
  useSyncStore.getState().setFolderId(folderId)
  const snapshots = await listSnapshots(token, folderId)
  return { folderId, snapshots }
}

export async function previewPush(token: string): Promise<PushDecision> {
  const { snapshots } = await prepare(token)
  return decidePush(collectFacts(), snapshots)
}

export async function previewPull(token: string): Promise<PullDecision> {
  const { snapshots } = await prepare(token)
  return decidePull(collectFacts(), snapshots)
}

export async function performPush(
  token: string,
  folderId: string,
  nextRevision: number,
  baseRevision: number
): Promise<SnapshotMeta> {
  const { deviceId, deviceName } = useSyncStore.getState()
  const envelope = buildBackup({ deviceId, deviceName, revision: nextRevision, baseRevision })
  const uploadedHash = hashBackupData(envelope.data)
  const uploaded = await uploadSnapshot(token, folderId, envelope)

  // Bookmark the payload Drive actually holds, not whatever localStorage says
  // now. Local data can change during the upload round trip, and hashing it
  // afterwards would mark those edits as already synced and hide them from
  // every future push.
  useSyncStore.getState().recordSync(nextRevision, uploadedHash)

  // Pruning is best-effort housekeeping and must never fail the push.
  try {
    const snapshots = await listSnapshots(token, folderId)
    await pruneSnapshots(token, snapshots)
  } catch {
    // Ignore: the snapshot is safely uploaded.
  }
  return uploaded
}

/** Compares two "1.2.3" cores, ignoring any prerelease suffix. Returns null
 *  when either side cannot be read as three numbers, which callers must treat
 *  as "do not know", not as "equal". */
function compareVersions(a: string, b: string): number | null {
  const parse = (v: string) => {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
  }
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}

/** Which registered keys a pull may safely delete.
 *
 *  A pull is a whole-state replacement, so a key the snapshot does not carry
 *  normally has to go: leaving it would fold it into the bookmark hash and
 *  silently ride it into the next push. That reasoning only holds when the
 *  writer actually knew about the key. It does not hold across versions.
 *
 *  A device on 0.8.1 has no `ledger-trades` in its STORAGE_KEYS at all, so
 *  its snapshot omits the key for a reason that has nothing to do with the
 *  user deleting anything. Pruning on that snapshot destroyed the entire
 *  trade log on every newer device that pulled it, automatically, from
 *  auto-sync on visibilitychange, with no prompt and no way back.
 *
 *  So: prune only when the snapshot came from a build at least as new as this
 *  one. Anything else, including a snapshot with no version at all (every
 *  snapshot written before 0.9.8), prunes nothing. The cost of not pruning is
 *  a stale key that rides into the next push. The cost of pruning wrongly is
 *  permanent data loss. They are not comparable. */
export function keysToPruneOnPull(envelope: BackupEnvelope, registeredKeys: string[]): string[] {
  const remote = envelope.appVersion
  if (!remote) return []
  const cmp = compareVersions(remote, __APP_VERSION__)
  if (cmp === null || cmp < 0) return []
  return registeredKeys.filter((key) => !(key in (envelope.data ?? {})))
}

export async function performPull(token: string, remote: SnapshotMeta): Promise<void> {
  const text = await downloadSnapshot(token, remote.fileId)
  // Parse and validate before any write, so a corrupt file cannot damage local data.
  const envelope = parseBackupText(text)
  restoreBackup(envelope)
  // See keysToPruneOnPull: a whole-state replacement may only delete keys the
  // writing build actually knew about.
  for (const key of keysToPruneOnPull(envelope, BACKUP_KEYS)) {
    localStorage.removeItem(key)
  }
  useSyncStore.getState().recordSync(remote.revision, currentBackupHash())
}
