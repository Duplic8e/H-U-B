import { STORAGE_KEYS, NON_BACKUP_KEY_NAMES, type StorageKeyName } from '../store/storageKeys'

export const BACKUP_VERSION = 2

/** Every persisted key that travels in a backup or a Drive snapshot. Derived
 *  from the store registry, so adding a store to STORAGE_KEYS is all it takes
 *  to have it backed up. */
export const BACKUP_KEYS: string[] = (Object.keys(STORAGE_KEYS) as StorageKeyName[])
  .filter((name) => !NON_BACKUP_KEY_NAMES.includes(name))
  .map((name) => STORAGE_KEYS[name])

export interface BackupMeta {
  deviceId: string
  deviceName: string
  revision: number
  baseRevision: number
}

export interface BackupEnvelope {
  version: number
  exportedAt: string
  app: 'ledger'
  data: Record<string, unknown>
  // v2 sync metadata. Absent on manually exported files and on v1 backups.
  deviceId?: string
  deviceName?: string
  revision?: number
  baseRevision?: number
  /** The app version that wrote this snapshot, e.g. "0.9.8-beta". Absent on
   *  every snapshot written before 0.9.8, which is exactly the case
   *  performPull has to treat as "this writer may not have known about every
   *  store I have". Never used for gating features, only for deciding whether
   *  a missing key means "deleted" or "never existed over there". */
  appVersion?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Demo records share the budget store with real data, so excluding the demo
 *  flag key alone is not enough: a backup taken while demo mode is active
 *  would otherwise carry demo-cat and demo-tx rows along with the flag gone.
 *  Strip anything id-prefixed demo- out of the budget payload before it is
 *  written to a backup or Drive snapshot. */
function stripDemoRecords(parsed: unknown): unknown {
  if (!isPlainObject(parsed)) return parsed
  const state = parsed.state
  if (!isPlainObject(state)) return parsed
  const scrubMap = (value: unknown): unknown => {
    if (!isPlainObject(value)) return value
    return Object.fromEntries(Object.entries(value).filter(([id]) => !id.startsWith('demo-')))
  }
  const nextState: Record<string, unknown> = { ...state }
  for (const field of ['transactions', 'categories', 'categoryGroups']) {
    if (field in nextState) nextState[field] = scrubMap(nextState[field])
  }
  return { ...parsed, state: nextState }
}

function assertValidEnvelope(env: BackupEnvelope | null | undefined): asserts env is BackupEnvelope {
  if (!env || env.app !== 'ledger' || typeof env.version !== 'number' || env.version > BACKUP_VERSION) {
    throw new Error('Invalid Ledger backup file')
  }
  if (env.data !== undefined && !isPlainObject(env.data)) {
    throw new Error('Invalid Ledger backup file')
  }
}

export function buildBackup(meta?: BackupMeta): BackupEnvelope {
  const data: Record<string, unknown> = {}
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    try {
      const parsed = JSON.parse(raw)
      data[key] = key === STORAGE_KEYS.budget ? stripDemoRecords(parsed) : parsed
    } catch {
      data[key] = raw
    }
  }
  const env: BackupEnvelope = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'ledger',
    appVersion: __APP_VERSION__,
    data,
  }
  if (meta) {
    env.deviceId = meta.deviceId
    env.deviceName = meta.deviceName
    env.revision = meta.revision
    env.baseRevision = meta.baseRevision
  }
  return env
}

export function restoreBackup(envelope: BackupEnvelope): void {
  assertValidEnvelope(envelope)
  // Serialise every value before touching localStorage so a bad value cannot
  // leave storage half-written.
  const writes: Array<[string, string]> = Object.entries(envelope.data ?? {})
    .filter(([key]) => BACKUP_KEYS.includes(key))
    .map(([key, value]) => [key, JSON.stringify(value)] as [string, string])
  for (const [key, serialised] of writes) {
    localStorage.setItem(key, serialised)
  }
}

export function backupToBlob(): Blob {
  return new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' })
}

export function backupFilename(): string {
  return `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
}

export function parseBackupText(text: string): BackupEnvelope {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('Invalid Ledger backup file')
  }
  const env = obj as BackupEnvelope
  assertValidEnvelope(env)
  return env
}
