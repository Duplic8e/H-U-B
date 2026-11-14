import { BACKUP_KEYS, buildBackup, parseBackupText, restoreBackup, type BackupEnvelope } from './backup'
import { currentBackupHash, hasLocalData, hashBackupData } from './syncHash'
import { decidePull, decidePush, type LocalSyncFacts, type SnapshotMeta } from './syncDecision'
import { autoSyncAction } from './autoSync'
import { keysToPruneOnPull } from './syncService'
import { STORAGE_KEYS } from '../store/storageKeys'
import { useSyncStore } from '../store/useSyncStore'

/** Hub cloud sync.
 *
 *  When Ledger runs inside the Hub, the Hub's settings page saves one GitHub
 *  connection (owner, private repo, fine-grained token) under HUB_CLOUD_KEY.
 *  Every app on the Hub shares the same origin, so Ledger reads that same
 *  localStorage entry and keeps its data at `ledger/data.json` in that repo.
 *  Git history is the snapshot history, so there is no pruning to do.
 *
 *  The decision layer is the one Drive sync already uses: the file holds one
 *  BackupEnvelope with a revision, and the blob sha guards every write, so two
 *  devices pushing at once get a 409 instead of silently overwriting. */

export const HUB_CLOUD_KEY = 'hub-cloud'
export const HUB_SYNC_KEY = STORAGE_KEYS.hubSync
const DATA_DIR = 'ledger'
const DATA_FILE = 'data.json'
const API = 'https://api.github.com'

export interface HubCloudConfig {
  owner: string
  repo: string
  token: string
}

/** The Hub's home page, set only when this build is served from the Hub. */
export const HUB_URL: string | undefined = import.meta.env.VITE_HUB_URL || undefined

export function readHubConfig(): HubCloudConfig | null {
  try {
    const raw = localStorage.getItem(HUB_CLOUD_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<HubCloudConfig>
    if (typeof parsed.owner !== 'string' || typeof parsed.repo !== 'string' || typeof parsed.token !== 'string') return null
    if (!parsed.owner || !parsed.repo || !parsed.token) return null
    return { owner: parsed.owner, repo: parsed.repo, token: parsed.token }
  } catch {
    return null
  }
}

// ---- per-device bookkeeping (never backed up) ----

interface HubSyncMeta {
  lastSyncedRevision: number
  lastSyncedHash: string
  lastSyncedAt?: string
  /** The repo this bookkeeping describes. A different repo starts from zero. */
  target?: string
}

const EMPTY_META: HubSyncMeta = { lastSyncedRevision: 0, lastSyncedHash: '' }

function targetOf(config: HubCloudConfig): string {
  return `${config.owner}/${config.repo}`.toLowerCase()
}

export function readHubMeta(config?: HubCloudConfig | null): HubSyncMeta {
  try {
    const raw = localStorage.getItem(HUB_SYNC_KEY)
    const meta = raw ? ({ ...EMPTY_META, ...JSON.parse(raw) } as HubSyncMeta) : EMPTY_META
    if (config && meta.target && meta.target !== targetOf(config)) return EMPTY_META
    return meta
  } catch {
    return EMPTY_META
  }
}

function writeHubMeta(config: HubCloudConfig, revision: number, hash: string): void {
  const meta: HubSyncMeta = {
    lastSyncedRevision: revision,
    lastSyncedHash: hash,
    lastSyncedAt: new Date().toISOString(),
    target: targetOf(config),
  }
  localStorage.setItem(HUB_SYNC_KEY, JSON.stringify(meta))
}

// ---- observable status for the UI ----

export type HubSyncStatus =
  | { state: 'off' }
  | { state: 'idle'; lastSyncedAt?: string }
  | { state: 'syncing' }
  | { state: 'conflict'; remoteDevice: string; remoteAt: string }
  | { state: 'error'; message: string; lastSyncedAt?: string }

let status: HubSyncStatus = readHubConfig() ? { state: 'idle', lastSyncedAt: readHubMeta().lastSyncedAt } : { state: 'off' }
const listeners = new Set<() => void>()

export function getHubSyncStatus(): HubSyncStatus {
  return status
}

export function subscribeHubSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setStatus(next: HubSyncStatus): void {
  status = next
  listeners.forEach((l) => l())
}

// ---- GitHub contents API ----

export type HubSyncErrorKind = 'auth' | 'not_found' | 'conflict' | 'network' | 'other'

export class HubSyncError extends Error {
  readonly kind: HubSyncErrorKind
  constructor(kind: HubSyncErrorKind, message: string) {
    super(message)
    this.kind = kind
    this.name = 'HubSyncError'
  }
}

type Fetch = typeof fetch

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

async function gh(config: HubCloudConfig, path: string, init: RequestInit & { accept?: string } = {}, doFetch: Fetch = fetch): Promise<Response> {
  const { accept = 'application/vnd.github+json', ...rest } = init
  const url = `${API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}${path}`
  try {
    // The token only ever travels in this header. It is never logged.
    return await doFetch(url, {
      ...rest,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${config.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' },
    })
  } catch {
    throw new HubSyncError('network', 'Could not reach GitHub. Check your connection.')
  }
}

function fail(res: Response): never {
  if (res.status === 401) throw new HubSyncError('auth', 'The Hub token was rejected (expired or revoked). Update it in the Hub settings.')
  if (res.status === 403) throw new HubSyncError('auth', 'GitHub refused access. The token needs Contents: read and write on the data repo.')
  if (res.status === 404) throw new HubSyncError('not_found', 'The data repo was not found, or the token cannot see it.')
  if (res.status === 409 || res.status === 422) throw new HubSyncError('conflict', 'The cloud copy changed during sync.')
  throw new HubSyncError('other', `GitHub returned an error (${res.status}).`)
}

export interface RemoteLedger {
  sha: string | null
  envelope: BackupEnvelope | null
}

export async function fetchRemote(config: HubCloudConfig, doFetch: Fetch = fetch): Promise<RemoteLedger> {
  // Read the sha first. If the file changes before the content read, the
  // later write is rejected with a 409 instead of overwriting newer data.
  const listing = await gh(config, `/contents/${DATA_DIR}`, {}, doFetch)
  if (listing.status === 404) return { sha: null, envelope: null }
  if (!listing.ok) fail(listing)
  const entries = (await listing.json()) as Array<{ name: string; sha: string }>
  const sha = Array.isArray(entries) ? (entries.find((e) => e.name === DATA_FILE)?.sha ?? null) : null
  if (!sha) return { sha: null, envelope: null }

  // The raw media type returns the body directly, so files over 1 MB still load.
  const res = await gh(config, `/contents/${DATA_DIR}/${DATA_FILE}`, { accept: 'application/vnd.github.raw+json' }, doFetch)
  if (res.status === 404) return { sha: null, envelope: null }
  if (!res.ok) fail(res)
  return { sha, envelope: parseBackupText(await res.text()) }
}

async function putRemote(config: HubCloudConfig, envelope: BackupEnvelope, sha: string | null, doFetch: Fetch): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const res = await gh(
    config,
    `/contents/${DATA_DIR}/${DATA_FILE}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: `Ledger sync from ${envelope.deviceName ?? 'a device'} · ${stamp} UTC`,
        content: utf8ToBase64(JSON.stringify(envelope, null, 2)),
        ...(sha ? { sha } : {}),
      }),
    },
    doFetch
  )
  if (!res.ok) fail(res)
}

function snapshotOf(envelope: BackupEnvelope): SnapshotMeta {
  return {
    fileId: `${DATA_DIR}/${DATA_FILE}`,
    name: DATA_FILE,
    createdTime: envelope.exportedAt,
    revision: envelope.revision ?? 1,
    deviceId: envelope.deviceId ?? '',
    deviceName: envelope.deviceName ?? 'another device',
  }
}

// ---- the sync cycle ----

export type HubSyncResult = 'off' | 'pulled' | 'pushed' | 'up-to-date' | 'conflict'

/** How to settle a conflict the user was asked about. */
export type HubResolution = 'keep-this-device' | 'use-cloud'

function applyRemote(config: HubCloudConfig, envelope: BackupEnvelope): void {
  restoreBackup(envelope)
  // A whole-state replacement may only delete keys the writing build knew about.
  for (const key of keysToPruneOnPull(envelope, BACKUP_KEYS)) localStorage.removeItem(key)
  writeHubMeta(config, envelope.revision ?? 1, currentBackupHash())
}

async function push(config: HubCloudConfig, remote: RemoteLedger, doFetch: Fetch): Promise<void> {
  const { deviceId, deviceName } = useSyncStore.getState()
  const remoteRevision = remote.envelope?.revision ?? 0
  const baseRevision = readHubMeta(config).lastSyncedRevision
  const revision = remoteRevision + 1
  const envelope = buildBackup({ deviceId, deviceName, revision, baseRevision })
  await putRemote(config, envelope, remote.sha, doFetch)
  // Bookmark what the cloud now holds, not whatever local storage says after
  // the round trip, so edits made during the upload still count as unsynced.
  writeHubMeta(config, revision, hashBackupData(envelope.data))
}

let inFlight: Promise<HubSyncResult> | null = null

/** One sync pass. Pulls when only the cloud changed, pushes when only this
 *  device changed, and stops at a conflict for the user to settle. Concurrent
 *  calls share one pass. A 'pulled' result means local storage was replaced
 *  and the page must reload so the stores pick it up. */
export function runHubSync(options: { resolve?: HubResolution; fetch?: Fetch } = {}): Promise<HubSyncResult> {
  if (inFlight && !options.resolve) return inFlight
  const run = syncOnce(options).finally(() => {
    if (inFlight === run) inFlight = null
  })
  inFlight = run
  return run
}

async function syncOnce({ resolve, fetch: doFetch = fetch }: { resolve?: HubResolution; fetch?: Fetch }): Promise<HubSyncResult> {
  const config = readHubConfig()
  if (!config) {
    setStatus({ state: 'off' })
    return 'off'
  }
  setStatus({ state: 'syncing' })
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await cycle(config, resolve, doFetch)
        if (result === 'conflict') return result
        setStatus({ state: 'idle', lastSyncedAt: readHubMeta(config).lastSyncedAt })
        return result
      } catch (err) {
        // Another device wrote between our read and our write: read again.
        if (err instanceof HubSyncError && err.kind === 'conflict' && attempt < 2) continue
        throw err
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed unexpectedly.'
    setStatus({ state: 'error', message, lastSyncedAt: readHubMeta(config).lastSyncedAt })
    throw err
  }
}

async function cycle(config: HubCloudConfig, resolve: HubResolution | undefined, doFetch: Fetch): Promise<HubSyncResult> {
  const remote = await fetchRemote(config, doFetch)

  if (resolve === 'use-cloud') {
    if (!remote.envelope) return 'up-to-date'
    applyRemote(config, remote.envelope)
    return 'pulled'
  }
  if (resolve === 'keep-this-device') {
    await push(config, remote, doFetch)
    return 'pushed'
  }

  const meta = readHubMeta(config)
  const facts: LocalSyncFacts = {
    lastSyncedRevision: meta.lastSyncedRevision,
    lastSyncedHash: meta.lastSyncedHash,
    currentHash: currentBackupHash(),
    hasLocalData: hasLocalData(),
  }
  const snapshots = remote.envelope ? [snapshotOf(remote.envelope)] : []
  const pullDecision = decidePull(facts, snapshots)
  const pushDecision = decidePush(facts, snapshots)

  // Same file on both sides already: just record the bookmark.
  if (remote.envelope && hashBackupData(remote.envelope.data) === facts.currentHash) {
    if (meta.lastSyncedRevision !== (remote.envelope.revision ?? 1) || meta.lastSyncedHash !== facts.currentHash) {
      writeHubMeta(config, remote.envelope.revision ?? 1, facts.currentHash)
    }
    return 'up-to-date'
  }

  const action = autoSyncAction({ enabled: true, connected: true, push: pushDecision, pull: pullDecision })
  if (action === 'pull' && remote.envelope) {
    applyRemote(config, remote.envelope)
    return 'pulled'
  }
  if (action === 'push') {
    await push(config, remote, doFetch)
    return 'pushed'
  }
  if (action === 'needs-user' && remote.envelope) {
    setStatus({
      state: 'conflict',
      remoteDevice: remote.envelope.deviceName ?? 'another device',
      remoteAt: remote.envelope.exportedAt,
    })
    return 'conflict'
  }
  return 'up-to-date'
}

/** True when local data differs from what was last synced, without any network. */
export function hasUnsyncedChanges(): boolean {
  const config = readHubConfig()
  if (!config) return false
  return currentBackupHash() !== readHubMeta(config).lastSyncedHash
}
