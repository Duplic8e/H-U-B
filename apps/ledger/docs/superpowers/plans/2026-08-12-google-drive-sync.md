# Google Drive Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user move their entire Ledger dataset between devices through timestamped JSON snapshots in their own Google Drive, with an explicit warning whenever pushing or pulling would discard work done on the other device.

**Architecture:** The app already serialises all persisted state into a single versioned JSON envelope (`src/utils/backup.ts`). This plan wraps that envelope in a transport (Google Drive REST v3, called directly from the browser with a Google Identity Services access token) plus a divergence guard. The guard works by giving every pushed snapshot a monotonic `revision` number and recording, on each device, the revision it last synced with and a hash of the data at that moment. Comparing the local hash and revision against the newest snapshot in Drive tells us whether a push or pull is safe. Deliberately **no store files are modified**: the hash approach means we never instrument individual mutations.

**Tech Stack:** TypeScript, React 19, Zustand 5 (`persist` middleware), Vitest + Testing Library, Google Identity Services (`accounts.google.com/gsi/client`), Google Drive REST API v3.

## Global Constraints

- **No merge.** Restore is whole-state replacement, exactly as `restoreBackup` works today. The guard warns; it never merges two divergent datasets. Do not attempt per-record reconciliation anywhere in this plan.
- **No store files change.** Nothing under `src/store/` is modified except the new `useSyncStore.ts`. If a task seems to require editing an existing store, stop and flag it.
- **No new npm dependencies.** GIS is loaded as a script tag at runtime; Drive is called with `fetch`.
- **No em dashes** in any user-facing copy, comment, or commit message.
- **Drive scope is exactly** `https://www.googleapis.com/auth/drive.file`. Never request broader scope.
- **Access tokens live in memory only.** Never write a token to localStorage, a store, or a log.
- **Snapshot retention cap:** `SNAPSHOT_CAP = 100`, defined once in `src/utils/driveSync.ts`.
- **Pruning trashes, never permanently deletes.** Use `PATCH files/<id>` with `{trashed:true}`.
- **Every network operation is all-or-nothing.** Local sync metadata is written only after a fully successful operation.
- **Tests never call Google.** Mock `globalThis.fetch` and `window.google`.
- **Existing Export/Import stays untouched** as the manual fallback.
- Follow existing file conventions: no semicolons in `src/utils/*` and `src/components/settings/*` (match `backup.ts` and `BackupControls.tsx`), Tailwind utility classes with the project's `text-text-secondary` / `border-border` / `text-accent` tokens.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/utils/backup.ts` | Modify | Envelope v2 fields; validate-before-write in `restoreBackup`. |
| `src/utils/syncHash.ts` | Create | Deterministic hash of backup payload; `hasLocalData` check. |
| `src/store/useSyncStore.ts` | Create | Persisted per-device sync metadata. Excluded from `BACKUP_KEYS`. |
| `src/utils/syncDecision.ts` | Create | Pure push/pull decision functions. No I/O. |
| `src/utils/driveAuth.ts` | Create | GIS script loading and access token acquisition. |
| `src/utils/driveSync.ts` | Create | Drive REST v3: folder, list, upload, download, prune. |
| `src/utils/syncService.ts` | Create | Orchestrates decision + Drive + backup + store for push and pull. |
| `src/components/settings/DriveSyncControls.tsx` | Create | Settings UI, connect flow, conflict dialog. |
| `src/components/settings/SettingsSheet.tsx` | Modify | Render the new section card. |
| `CHANGELOG.md` | Modify | Record the feature. |

---

### Task 1: Envelope v2 and safer restore

The backup envelope gains four optional fields so snapshots carry their origin device and revision. They are optional so that v1 files exported before this feature still import. `restoreBackup` is also hardened: today it writes keys as it iterates, so a malformed value halfway through leaves localStorage half-updated. Validate everything first, then write.

**Files:**
- Modify: `src/utils/backup.ts`
- Test: `src/utils/backup.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BACKUP_VERSION = 2`; `interface BackupEnvelope` with optional `deviceId?: string`, `deviceName?: string`, `revision?: number`, `baseRevision?: number`; `buildBackup(meta?: BackupMeta): BackupEnvelope` where `interface BackupMeta { deviceId: string; deviceName: string; revision: number; baseRevision: number }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/backup.test.ts`:

```ts
describe('backup v2 envelope', () => {
  beforeEach(() => localStorage.clear())

  it('is version 2', () => {
    expect(BACKUP_VERSION).toBe(2)
  })

  it('omits sync metadata when no meta is supplied', () => {
    const env = buildBackup()
    expect(env.deviceId).toBeUndefined()
    expect(env.revision).toBeUndefined()
  })

  it('carries sync metadata when meta is supplied', () => {
    const env = buildBackup({ deviceId: 'dev-1', deviceName: 'Desktop', revision: 7, baseRevision: 6 })
    expect(env.deviceId).toBe('dev-1')
    expect(env.deviceName).toBe('Desktop')
    expect(env.revision).toBe(7)
    expect(env.baseRevision).toBe(6)
  })

  it('still accepts a version 1 envelope', () => {
    const v1 = JSON.stringify({ app: 'ledger', version: 1, exportedAt: '', data: { 'ledger-budget': { x: 1 } } })
    const env = parseBackupText(v1)
    expect(env.version).toBe(1)
    restoreBackup(env)
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ x: 1 })
  })

  it('writes nothing when the envelope is invalid', () => {
    localStorage.setItem('ledger-budget', JSON.stringify({ keep: true }))
    expect(() => restoreBackup({ app: 'ledger', version: 99, exportedAt: '', data: { 'ledger-budget': { x: 9 } } }))
      .toThrow('Invalid Ledger backup file')
    expect(JSON.parse(localStorage.getItem('ledger-budget')!)).toEqual({ keep: true })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/utils/backup.test.ts
```

Expected: FAIL. `expect(BACKUP_VERSION).toBe(2)` reports received `1`, and the metadata tests fail because `buildBackup` takes no argument.

- [ ] **Step 3: Implement the changes**

In `src/utils/backup.ts`, change the version constant and the envelope interface:

```ts
export const BACKUP_VERSION = 2
```

```ts
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
}
```

Replace `buildBackup` and `restoreBackup`:

```ts
export function buildBackup(meta?: BackupMeta): BackupEnvelope {
  const data: Record<string, unknown> = {}
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      data[key] = raw
    }
  }
  const env: BackupEnvelope = { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), app: 'ledger', data }
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
    .map(([key, value]) => [key, JSON.stringify(value)] as [string, string])
  for (const [key, serialised] of writes) {
    localStorage.setItem(key, serialised)
  }
}
```

- [ ] **Step 4: Run the whole suite to verify nothing regressed**

```bash
npx vitest run
```

Expected: PASS. Note that `backup.test.ts` already asserts `env.version === BACKUP_VERSION`, so it follows the bump automatically.

- [ ] **Step 5: Commit**

```bash
git add src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat(backup): v2 envelope with device and revision metadata"
```

---

### Task 2: Backup payload hash

This is how we detect unpushed local edits without instrumenting a single store. Hash the serialised backup payload; if it differs from the hash recorded at last sync, there are local changes.

A note on determinism the implementer should understand: key order in `data` is fixed by `BACKUP_KEYS`, and each value's key order comes from the string Zustand's `persist` wrote. That is stable in practice but not guaranteed by spec. A false positive here costs one extra confirmation prompt and never loses data, which is the right direction to be wrong in. Do not build a canonicalising serialiser for this.

**Files:**
- Create: `src/utils/syncHash.ts`
- Test: `src/utils/syncHash.test.ts`

**Interfaces:**
- Consumes: `buildBackup` from Task 1.
- Produces: `hashBackupData(data: Record<string, unknown>): string`, `currentBackupHash(): string`, `hasLocalData(): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/syncHash.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/utils/syncHash.test.ts
```

Expected: FAIL with a module resolution error, `Failed to resolve import "./syncHash"`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/syncHash.ts`:

```ts
import { buildBackup } from './backup'

/** FNV-1a 32-bit. Not cryptographic. We only need change detection. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function hashBackupData(data: Record<string, unknown>): string {
  return fnv1a(JSON.stringify(data))
}

export function currentBackupHash(): string {
  return hashBackupData(buildBackup().data)
}

/** True when at least one registered key is present, i.e. this is not a fresh device. */
export function hasLocalData(): boolean {
  return Object.keys(buildBackup().data).length > 0
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/utils/syncHash.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/syncHash.ts src/utils/syncHash.test.ts
git commit -m "feat(sync): hash backup payload to detect unpushed local edits"
```

---

### Task 3: Per-device sync store

Holds this device's identity and its last-sync bookmark. Its localStorage key `ledger-sync` is deliberately **not** added to `BACKUP_KEYS`: if it were, pulling a snapshot would overwrite this device's identity and bookmark with the other device's, and the divergence guard would immediately start lying.

The Google OAuth client ID is user-supplied and lives here too, matching the precedent set by the market data API key in `useMarketDataStore` (`setApiKey` at `src/store/useMarketDataStore.ts:65`).

**Files:**
- Create: `src/store/useSyncStore.ts`
- Test: `src/store/useSyncStore.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useSyncStore` with state `{ deviceId: string; deviceName: string; clientId?: string; folderId?: string; lastSyncedRevision: number; lastSyncedAt?: string; lastSyncedHash: string }` and actions `setDeviceName(name: string)`, `setClientId(id: string)`, `clearClientId()`, `setFolderId(id: string)`, `recordSync(revision: number, hash: string)`.

- [ ] **Step 1: Write the failing test**

Create `src/store/useSyncStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSyncStore } from './useSyncStore'
import { BACKUP_KEYS } from '../utils/backup'

describe('useSyncStore', () => {
  beforeEach(() => {
    useSyncStore.setState({ lastSyncedRevision: 0, lastSyncedHash: '', lastSyncedAt: undefined })
  })

  it('generates a non-empty device id', () => {
    expect(useSyncStore.getState().deviceId.length).toBeGreaterThan(0)
  })

  it('starts unsynced', () => {
    expect(useSyncStore.getState().lastSyncedRevision).toBe(0)
    expect(useSyncStore.getState().lastSyncedHash).toBe('')
  })

  it('recordSync stores revision, hash and a timestamp', () => {
    useSyncStore.getState().recordSync(4, 'abc12345')
    const state = useSyncStore.getState()
    expect(state.lastSyncedRevision).toBe(4)
    expect(state.lastSyncedHash).toBe('abc12345')
    expect(state.lastSyncedAt).toBeTruthy()
  })

  it('trims and clears the client id', () => {
    useSyncStore.getState().setClientId('  abc.apps.googleusercontent.com  ')
    expect(useSyncStore.getState().clientId).toBe('abc.apps.googleusercontent.com')
    useSyncStore.getState().clearClientId()
    expect(useSyncStore.getState().clientId).toBeUndefined()
  })

  it('is excluded from backups so a pull cannot overwrite device identity', () => {
    expect(BACKUP_KEYS).not.toContain('ledger-sync')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/store/useSyncStore.test.ts
```

Expected: FAIL with `Failed to resolve import "./useSyncStore"`.

- [ ] **Step 3: Write the implementation**

Create `src/store/useSyncStore.ts`. Note this file uses semicolons to match the surrounding `src/store/` files:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

/** A readable default label so the conflict dialog can name the other device. */
function defaultDeviceName(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android device';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS device';
  if (/Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return 'This device';
}

interface SyncState {
  deviceId: string;
  deviceName: string;
  clientId?: string;
  folderId?: string;
  lastSyncedRevision: number;
  lastSyncedAt?: string;
  lastSyncedHash: string;

  setDeviceName: (name: string) => void;
  setClientId: (id: string) => void;
  clearClientId: () => void;
  setFolderId: (id: string) => void;
  recordSync: (revision: number, hash: string) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      deviceId: uuidv4(),
      deviceName: defaultDeviceName(),
      clientId: undefined,
      folderId: undefined,
      lastSyncedRevision: 0,
      lastSyncedAt: undefined,
      lastSyncedHash: '',

      setDeviceName: (name) => set({ deviceName: name.trim() || defaultDeviceName() }),
      setClientId: (id) => set({ clientId: id.trim() || undefined }),
      clearClientId: () => set({ clientId: undefined }),
      setFolderId: (id) => set({ folderId: id }),
      recordSync: (revision, hash) =>
        set({ lastSyncedRevision: revision, lastSyncedHash: hash, lastSyncedAt: new Date().toISOString() }),
    }),
    {
      // Intentionally absent from BACKUP_KEYS: this metadata is per-device and
      // must not travel inside a snapshot.
      name: 'ledger-sync',
    }
  )
);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/store/useSyncStore.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/store/useSyncStore.ts src/store/useSyncStore.test.ts
git commit -m "feat(sync): per-device sync metadata store"
```

---

### Task 4: Pure push and pull decisions

This is the divergence guard, and it is deliberately pure so it can be exhaustively tested without any network or DOM. Everything that decides whether the user is about to lose work lives in this one file.

**Files:**
- Create: `src/utils/syncDecision.ts`
- Test: `src/utils/syncDecision.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface SnapshotMeta { fileId: string; name: string; createdTime: string; revision: number; deviceId: string; deviceName: string }`
  - `interface LocalSyncFacts { lastSyncedRevision: number; lastSyncedHash: string; currentHash: string; hasLocalData: boolean }`
  - `type PushDecision = { kind: 'nothing-to-push' } | { kind: 'clean'; nextRevision: number; baseRevision: number } | { kind: 'diverged'; remote: SnapshotMeta; nextRevision: number; baseRevision: number }`
  - `type PullDecision = { kind: 'nothing-remote' } | { kind: 'up-to-date' } | { kind: 'clean'; remote: SnapshotMeta } | { kind: 'would-lose-local'; remote: SnapshotMeta }`
  - `latestSnapshot(snapshots: SnapshotMeta[]): SnapshotMeta | undefined`
  - `decidePush(facts: LocalSyncFacts, snapshots: SnapshotMeta[]): PushDecision`
  - `decidePull(facts: LocalSyncFacts, snapshots: SnapshotMeta[]): PullDecision`

- [ ] **Step 1: Write the failing test**

Create `src/utils/syncDecision.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { decidePush, decidePull, latestSnapshot, type SnapshotMeta, type LocalSyncFacts } from './syncDecision'

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
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/utils/syncDecision.test.ts
```

Expected: FAIL with `Failed to resolve import "./syncDecision"`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/syncDecision.ts`:

```ts
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

/** Highest revision wins; a tie is broken by the newer createdTime. */
export function latestSnapshot(snapshots: SnapshotMeta[]): SnapshotMeta | undefined {
  return snapshots.reduce<SnapshotMeta | undefined>((best, s) => {
    if (!best) return s
    if (s.revision !== best.revision) return s.revision > best.revision ? s : best
    return s.createdTime > best.createdTime ? s : best
  }, undefined)
}

function isDirty(facts: LocalSyncFacts): boolean {
  return facts.currentHash !== facts.lastSyncedHash
}

export function decidePush(facts: LocalSyncFacts, snapshots: SnapshotMeta[]): PushDecision {
  const remote = latestSnapshot(snapshots)
  const remoteRevision = remote?.revision ?? 0
  const baseRevision = facts.lastSyncedRevision
  const nextRevision = remoteRevision + 1

  if (remoteRevision > baseRevision) {
    return { kind: 'diverged', remote: remote!, nextRevision, baseRevision }
  }
  if (!isDirty(facts)) return { kind: 'nothing-to-push' }
  return { kind: 'clean', nextRevision, baseRevision }
}

export function decidePull(facts: LocalSyncFacts, snapshots: SnapshotMeta[]): PullDecision {
  const remote = latestSnapshot(snapshots)
  if (!remote) return { kind: 'nothing-remote' }
  if (remote.revision <= facts.lastSyncedRevision) return { kind: 'up-to-date' }
  if (facts.hasLocalData && isDirty(facts)) return { kind: 'would-lose-local', remote }
  return { kind: 'clean', remote }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/utils/syncDecision.test.ts
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/syncDecision.ts src/utils/syncDecision.test.ts
git commit -m "feat(sync): pure push and pull divergence decisions"
```

---

### Task 5: Google Identity Services token acquisition

The only file that knows Google exists as an identity provider. It loads the GIS script on demand and exchanges a user gesture for an access token held in a module-level variable. There is no refresh token in this flow, so the token dies with the page. That is a deliberate safety trade: the user clicks Connect roughly once per app session.

We declare a minimal `google` global rather than adding a types package, to honour the no-new-dependencies constraint.

**Files:**
- Create: `src/utils/driveAuth.ts`
- Test: `src/utils/driveAuth.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DRIVE_SCOPE`, `loadGis(): Promise<void>`, `requestAccessToken(clientId: string): Promise<string>`, `getCachedToken(): string | undefined`, `clearCachedToken(): void`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/driveAuth.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { requestAccessToken, getCachedToken, clearCachedToken, DRIVE_SCOPE } from './driveAuth'

interface FakeTokenConfig {
  client_id: string
  scope: string
  callback: (r: { access_token?: string; error?: string }) => void
  error_callback?: (e: { type: string }) => void
}

function installGoogle(behaviour: (config: FakeTokenConfig) => void) {
  ;(window as unknown as { google: unknown }).google = {
    accounts: {
      oauth2: {
        initTokenClient: (config: FakeTokenConfig) => ({
          requestAccessToken: () => behaviour(config),
        }),
      },
    },
  }
}

describe('driveAuth', () => {
  beforeEach(() => {
    clearCachedToken()
    document.querySelectorAll('script').forEach((s) => s.remove())
    delete (window as unknown as { google?: unknown }).google
  })

  it('requests the narrow drive.file scope', async () => {
    let seen = ''
    installGoogle((config) => {
      seen = config.scope
      config.callback({ access_token: 'tok-1' })
    })
    await requestAccessToken('client-1')
    expect(seen).toBe(DRIVE_SCOPE)
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file')
  })

  it('resolves with the access token and caches it', async () => {
    installGoogle((config) => config.callback({ access_token: 'tok-2' }))
    await expect(requestAccessToken('client-1')).resolves.toBe('tok-2')
    expect(getCachedToken()).toBe('tok-2')
  })

  it('rejects when consent is denied', async () => {
    installGoogle((config) => config.error_callback?.({ type: 'popup_closed' }))
    await expect(requestAccessToken('client-1')).rejects.toThrow(/Google sign-in was cancelled/i)
  })

  it('rejects when the callback carries no token', async () => {
    installGoogle((config) => config.callback({ error: 'access_denied' }))
    await expect(requestAccessToken('client-1')).rejects.toThrow(/access_denied/)
  })

  it('clearCachedToken forgets the token', async () => {
    installGoogle((config) => config.callback({ access_token: 'tok-3' }))
    await requestAccessToken('client-1')
    clearCachedToken()
    expect(getCachedToken()).toBeUndefined()
  })

  it('rejects when the GIS script fails to load', async () => {
    const promise = requestAccessToken('client-1')
    const script = document.querySelector('script[src*="gsi/client"]') as HTMLScriptElement
    expect(script).toBeTruthy()
    script.onerror?.(new Event('error'))
    await expect(promise).rejects.toThrow(/Could not reach Google/i)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/utils/driveAuth.test.ts
```

Expected: FAIL with `Failed to resolve import "./driveAuth"`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/driveAuth.ts`:

```ts
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface TokenResponse {
  access_token?: string
  error?: string
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
  error_callback?: (error: { type: string }) => void
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient: (config: TokenClientConfig) => { requestAccessToken: () => void }
    }
  }
}

function googleGlobal(): GoogleGlobal | undefined {
  return (window as unknown as { google?: GoogleGlobal }).google
}

let cachedToken: string | undefined
let gisPromise: Promise<void> | undefined

export function getCachedToken(): string | undefined {
  return cachedToken
}

export function clearCachedToken(): void {
  cachedToken = undefined
}

/** Injects the GIS script once. Resolves immediately if google is already present. */
export function loadGis(): Promise<void> {
  if (googleGlobal()) return Promise.resolve()
  if (gisPromise) return gisPromise
  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisPromise = undefined
      reject(new Error('Could not reach Google. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return gisPromise
}

/** Prompts for consent and resolves with an in-memory access token. */
export async function requestAccessToken(clientId: string): Promise<string> {
  await loadGis()
  const google = googleGlobal()
  if (!google) throw new Error('Could not reach Google. Check your connection and try again.')

  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.access_token) {
          cachedToken = response.access_token
          resolve(response.access_token)
          return
        }
        reject(new Error(response.error ?? 'Google did not return an access token.'))
      },
      error_callback: () => reject(new Error('Google sign-in was cancelled.')),
    })
    client.requestAccessToken()
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/utils/driveAuth.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/driveAuth.ts src/utils/driveAuth.test.ts
git commit -m "feat(sync): Google Identity Services token acquisition"
```

---

### Task 6: Drive folder discovery and snapshot listing

First half of the REST layer. With `drive.file` scope, `files.list` only ever returns files this app created, so the folder must be created by us and its id remembered.

**Files:**
- Create: `src/utils/driveSync.ts`
- Test: `src/utils/driveSync.test.ts`

**Interfaces:**
- Consumes: `SnapshotMeta` from Task 4.
- Produces: `SYNC_FOLDER_NAME`, `SNAPSHOT_CAP`, `findOrCreateFolder(token: string): Promise<string>`, `listSnapshots(token: string, folderId: string): Promise<SnapshotMeta[]>`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/driveSync.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { findOrCreateFolder, listSnapshots, SYNC_FOLDER_NAME, SNAPSHOT_CAP } from './driveSync'

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response)
}

describe('driveSync folder', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => vi.restoreAllMocks())

  it('returns the existing folder id when one is found', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ files: [{ id: 'folder-1', name: SYNC_FOLDER_NAME }] }))
    await expect(findOrCreateFolder('tok')).resolves.toBe('folder-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('creates the folder when none exists', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ files: [] }))
    fetchMock.mockReturnValueOnce(jsonResponse({ id: 'folder-new' }))
    await expect(findOrCreateFolder('tok')).resolves.toBe('folder-new')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://www.googleapis.com/drive/v3/files')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      name: SYNC_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    })
  })

  it('sends the bearer token', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ files: [{ id: 'folder-1' }] }))
    await findOrCreateFolder('tok-abc')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-abc')
  })

  it('raises a friendly error when the token is rejected', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ error: { message: 'Invalid Credentials' } }, 401))
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/Google Drive access expired/i)
  })

  it('raises a friendly error on other Drive failures', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ error: { message: 'Rate Limit Exceeded' } }, 429))
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/Rate Limit Exceeded/)
  })
})

describe('driveSync listSnapshots', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it('maps Drive files into snapshot metadata', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({
        files: [
          {
            id: 'f1',
            name: 'ledger-2026-08-12T10-00-00Z-r2.json',
            createdTime: '2026-08-12T10:00:00.000Z',
            appProperties: { revision: '2', deviceId: 'dev-a', deviceName: 'Phone' },
          },
        ],
      })
    )
    const snaps = await listSnapshots('tok', 'folder-1')
    expect(snaps).toEqual([
      {
        fileId: 'f1',
        name: 'ledger-2026-08-12T10-00-00Z-r2.json',
        createdTime: '2026-08-12T10:00:00.000Z',
        revision: 2,
        deviceId: 'dev-a',
        deviceName: 'Phone',
      },
    ])
  })

  it('ignores files without ledger revision metadata', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ files: [{ id: 'f1', name: 'notes.txt', createdTime: '2026-08-12T10:00:00.000Z' }] })
    )
    await expect(listSnapshots('tok', 'folder-1')).resolves.toEqual([])
  })

  it('falls back to a readable device name when metadata is partial', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({
        files: [
          { id: 'f1', name: 'x.json', createdTime: '2026-08-12T10:00:00.000Z', appProperties: { revision: '3' } },
        ],
      })
    )
    const snaps = await listSnapshots('tok', 'folder-1')
    expect(snaps[0].deviceName).toBe('another device')
    expect(snaps[0].deviceId).toBe('')
  })

  it('caps retention at 100 snapshots', () => {
    expect(SNAPSHOT_CAP).toBe(100)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/utils/driveSync.test.ts
```

Expected: FAIL with `Failed to resolve import "./driveSync"`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/driveSync.ts`:

```ts
import type { SnapshotMeta } from './syncDecision'

export const SYNC_FOLDER_NAME = 'Ledger'
export const SNAPSHOT_CAP = 100

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

/** Turns a Drive error response into a message worth showing a human. */
async function driveError(response: Response): Promise<Error> {
  if (response.status === 401 || response.status === 403) {
    return new Error('Google Drive access expired. Connect again and retry.')
  }
  let detail = `Drive request failed (${response.status})`
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    if (body?.error?.message) detail = body.error.message
  } catch {
    // Keep the status-based message.
  }
  return new Error(detail)
}

async function driveFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders(token), ...(init.headers as Record<string, string> | undefined) },
  })
  if (!response.ok) throw await driveError(response)
  return response
}

export async function findOrCreateFolder(token: string): Promise<string> {
  const query = `name='${SYNC_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const listUrl = `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name)')}`
  const listed = (await (await driveFetch(listUrl, token)).json()) as { files?: Array<{ id: string }> }
  const existing = listed.files?.[0]
  if (existing) return existing.id

  const created = (await (
    await driveFetch(DRIVE_FILES, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: SYNC_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    })
  ).json()) as { id: string }
  return created.id
}

export async function listSnapshots(token: string, folderId: string): Promise<SnapshotMeta[]> {
  const query = `'${folderId}' in parents and trashed=false`
  const fields = 'files(id,name,createdTime,appProperties)'
  const url =
    `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}` +
    `&orderBy=createdTime%20desc&pageSize=200`
  const body = (await (await driveFetch(url, token)).json()) as {
    files?: Array<{
      id: string
      name: string
      createdTime: string
      appProperties?: Record<string, string>
    }>
  }
  return (body.files ?? [])
    .filter((file) => file.appProperties?.revision !== undefined)
    .map((file) => ({
      fileId: file.id,
      name: file.name,
      createdTime: file.createdTime,
      revision: Number(file.appProperties!.revision),
      deviceId: file.appProperties!.deviceId ?? '',
      deviceName: file.appProperties!.deviceName ?? 'another device',
    }))
    .filter((snapshot) => Number.isFinite(snapshot.revision))
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/utils/driveSync.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/driveSync.ts src/utils/driveSync.test.ts
git commit -m "feat(sync): Drive folder discovery and snapshot listing"
```

---

### Task 7: Drive upload, download and pruning

Second half of the REST layer. Uploads use a multipart request so metadata and content go in one call. The boundary is a fixed constant rather than a random string purely so tests can assert on the body; the payload is JSON with escaped quotes, so a collision is not a practical concern.

Pruning trashes rather than deletes, so a mistake is recoverable from the Drive bin.

**Files:**
- Modify: `src/utils/driveSync.ts`
- Test: `src/utils/driveSync.test.ts`

**Interfaces:**
- Consumes: `SnapshotMeta` from Task 4; `BackupEnvelope` from Task 1.
- Produces:
  - `snapshotFilename(date: Date, revision: number): string`
  - `uploadSnapshot(token: string, folderId: string, envelope: BackupEnvelope): Promise<SnapshotMeta>`
  - `downloadSnapshot(token: string, fileId: string): Promise<string>`
  - `pruneSnapshots(token: string, snapshots: SnapshotMeta[]): Promise<number>`

- [ ] **Step 1: Write the failing test**

Append to `src/utils/driveSync.test.ts`:

```ts
import { snapshotFilename, uploadSnapshot, downloadSnapshot, pruneSnapshots } from './driveSync'
import { BACKUP_VERSION, type BackupEnvelope } from './backup'

function envelope(revision: number): BackupEnvelope {
  return {
    version: BACKUP_VERSION,
    exportedAt: '2026-08-12T10:00:00.000Z',
    app: 'ledger',
    data: { 'ledger-budget': { x: 1 } },
    deviceId: 'dev-a',
    deviceName: 'Desktop',
    revision,
    baseRevision: revision - 1,
  }
}

describe('driveSync upload and download', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it('names snapshots by timestamp and revision', () => {
    expect(snapshotFilename(new Date('2026-08-12T14:30:05.123Z'), 14))
      .toBe('ledger-2026-08-12T14-30-05Z-r14.json')
  })

  it('uploads with revision metadata in appProperties', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ id: 'new-file', name: 'x.json', createdTime: '2026-08-12T10:00:00.000Z' })
    )
    const meta = await uploadSnapshot('tok', 'folder-1', envelope(4))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('uploadType=multipart')
    expect(init.headers['Content-Type']).toContain('multipart/related; boundary=')
    expect(init.body).toContain('"revision":"4"')
    expect(init.body).toContain('"deviceName":"Desktop"')
    expect(init.body).toContain('"folder-1"')
    expect(meta.revision).toBe(4)
    expect(meta.fileId).toBe('new-file')
  })

  it('downloads raw file text', async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{"app":"ledger"}') } as Response)
    )
    await expect(downloadSnapshot('tok', 'f1')).resolves.toBe('{"app":"ledger"}')
    expect(fetchMock.mock.calls[0][0]).toBe('https://www.googleapis.com/drive/v3/files/f1?alt=media')
  })

  it('prunes nothing when under the cap', async () => {
    const few = Array.from({ length: 3 }, (_, i) => ({
      fileId: `f${i}`, name: '', createdTime: `2026-08-0${i + 1}T00:00:00.000Z`,
      revision: i + 1, deviceId: 'd', deviceName: 'Desktop',
    }))
    await expect(pruneSnapshots('tok', few)).resolves.toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('trashes the oldest snapshots beyond the cap', async () => {
    const many = Array.from({ length: SNAPSHOT_CAP + 2 }, (_, i) => ({
      fileId: `f${i}`, name: '', createdTime: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      revision: i + 1, deviceId: 'd', deviceName: 'Desktop',
    }))
    fetchMock.mockReturnValue(jsonResponse({ id: 'x' }))
    await expect(pruneSnapshots('tok', many)).resolves.toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/drive/v3/files/f0')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ trashed: true })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/utils/driveSync.test.ts
```

Expected: FAIL. The new imports are not exported yet, so the suite errors with `does not provide an export named 'snapshotFilename'`.

- [ ] **Step 3: Write the implementation**

Append to `src/utils/driveSync.ts`, and add `import type { BackupEnvelope } from './backup'` to the imports at the top:

```ts
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const UPLOAD_BOUNDARY = 'ledger-sync-boundary'

/** e.g. ledger-2026-08-12T14-30-05Z-r14.json */
export function snapshotFilename(date: Date, revision: number): string {
  const stamp = date.toISOString().slice(0, 19).replace(/:/g, '-')
  return `ledger-${stamp}Z-r${revision}.json`
}

export async function uploadSnapshot(
  token: string,
  folderId: string,
  envelope: BackupEnvelope
): Promise<SnapshotMeta> {
  const revision = envelope.revision ?? 1
  const metadata = {
    name: snapshotFilename(new Date(), revision),
    parents: [folderId],
    mimeType: 'application/json',
    appProperties: {
      revision: String(revision),
      deviceId: envelope.deviceId ?? '',
      deviceName: envelope.deviceName ?? 'another device',
    },
  }
  const content = JSON.stringify(envelope, null, 2)
  const body =
    `--${UPLOAD_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${UPLOAD_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n` +
    `--${UPLOAD_BOUNDARY}--`

  const url = `${DRIVE_UPLOAD}?uploadType=multipart&fields=${encodeURIComponent('id,name,createdTime')}`
  const created = (await (
    await driveFetch(url, token, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${UPLOAD_BOUNDARY}` },
      body,
    })
  ).json()) as { id: string; name: string; createdTime: string }

  return {
    fileId: created.id,
    name: created.name,
    createdTime: created.createdTime,
    revision,
    deviceId: envelope.deviceId ?? '',
    deviceName: envelope.deviceName ?? 'another device',
  }
}

export async function downloadSnapshot(token: string, fileId: string): Promise<string> {
  const response = await driveFetch(`${DRIVE_FILES}/${fileId}?alt=media`, token)
  return response.text()
}

/** Trashes the oldest snapshots beyond SNAPSHOT_CAP. Returns how many were trashed. */
export async function pruneSnapshots(token: string, snapshots: SnapshotMeta[]): Promise<number> {
  if (snapshots.length <= SNAPSHOT_CAP) return 0
  const oldestFirst = [...snapshots].sort((a, b) => a.createdTime.localeCompare(b.createdTime))
  const doomed = oldestFirst.slice(0, snapshots.length - SNAPSHOT_CAP)
  for (const snapshot of doomed) {
    await driveFetch(`${DRIVE_FILES}/${snapshot.fileId}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }
  return doomed.length
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/utils/driveSync.test.ts
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/driveSync.ts src/utils/driveSync.test.ts
git commit -m "feat(sync): Drive snapshot upload, download and pruning"
```

---

### Task 8: Push and pull orchestration

Ties the pieces together. Every function here is all-or-nothing: `recordSync` is called only after Drive has confirmed the operation.

Note the ordering in `pullSnapshot`: download and parse **before** restoring, so a corrupt remote file cannot leave localStorage half-written. And note that after a restore the hash is recomputed from what actually landed, not assumed.

**Files:**
- Create: `src/utils/syncService.ts`
- Test: `src/utils/syncService.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 through 7.
- Produces:
  - `collectFacts(): LocalSyncFacts`
  - `prepare(token: string): Promise<{ folderId: string; snapshots: SnapshotMeta[] }>`
  - `previewPush(token: string): Promise<PushDecision>`
  - `previewPull(token: string): Promise<PullDecision>`
  - `performPush(token: string, folderId: string, nextRevision: number, baseRevision: number): Promise<SnapshotMeta>`
  - `performPull(token: string, remote: SnapshotMeta): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/utils/syncService.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { collectFacts, performPush, performPull } from './syncService'
import { useSyncStore } from '../store/useSyncStore'
import { BACKUP_VERSION, type BackupEnvelope } from './backup'
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
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/utils/syncService.test.ts
```

Expected: FAIL with `Failed to resolve import "./syncService"`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/syncService.ts`:

```ts
import { buildBackup, parseBackupText, restoreBackup } from './backup'
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

export async function performPull(token: string, remote: SnapshotMeta): Promise<void> {
  const text = await downloadSnapshot(token, remote.fileId)
  // Parse and validate before any write, so a corrupt file cannot damage local data.
  const envelope = parseBackupText(text)
  restoreBackup(envelope)
  useSyncStore.getState().recordSync(remote.revision, currentBackupHash())
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/utils/syncService.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/syncService.ts src/utils/syncService.test.ts
git commit -m "feat(sync): push and pull orchestration with all-or-nothing bookmarks"
```

---

### Task 9: Settings UI with conflict dialog

The user-facing surface. Three states: no client id configured, configured but not connected, connected. The conflict dialog is the whole point of the feature, so its copy must be unambiguous about what is lost.

**Files:**
- Create: `src/components/settings/DriveSyncControls.tsx`
- Test: `src/components/settings/DriveSyncControls.test.tsx`

**Interfaces:**
- Consumes: `requestAccessToken`, `getCachedToken` (Task 5); `previewPush`, `previewPull`, `performPush`, `performPull` (Task 8); `useSyncStore` (Task 3).
- Produces: `DriveSyncControls: React.FC`.

- [ ] **Step 1: Write the failing test**

Create `src/components/settings/DriveSyncControls.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DriveSyncControls } from './DriveSyncControls'
import { useSyncStore } from '../../store/useSyncStore'

vi.mock('../../utils/driveAuth', () => ({
  requestAccessToken: vi.fn(() => Promise.resolve('tok')),
  getCachedToken: vi.fn(() => 'tok'),
  clearCachedToken: vi.fn(),
  DRIVE_SCOPE: 'https://www.googleapis.com/auth/drive.file',
}))

vi.mock('../../utils/syncService', () => ({
  previewPush: vi.fn(),
  previewPull: vi.fn(),
  performPush: vi.fn(() => Promise.resolve()),
  performPull: vi.fn(() => Promise.resolve()),
}))

const service = await import('../../utils/syncService')

const remote = {
  fileId: 'f5', name: 'r5.json', createdTime: '2026-08-12T10:00:00.000Z',
  revision: 5, deviceId: 'dev-b', deviceName: 'Phone',
}

describe('DriveSyncControls', () => {
  beforeEach(() => {
    vi.mocked(service.previewPush).mockReset()
    vi.mocked(service.previewPull).mockReset()
    vi.mocked(service.performPush).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(service.performPull).mockReset().mockResolvedValue(undefined)
    useSyncStore.setState({ clientId: 'client-1', folderId: 'folder-1', lastSyncedRevision: 3, lastSyncedHash: 'h' })
  })

  it('asks for a client id when none is configured', () => {
    useSyncStore.setState({ clientId: undefined })
    render(<DriveSyncControls />)
    expect(screen.getByLabelText(/google client id/i)).toBeInTheDocument()
  })

  it('shows push and pull once a client id is configured', () => {
    render(<DriveSyncControls />)
    expect(screen.getByRole('button', { name: /push to drive/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pull from drive/i })).toBeInTheDocument()
  })

  it('lets the user rename this device so conflict warnings are recognisable', () => {
    render(<DriveSyncControls />)
    const input = screen.getByLabelText(/this device/i)
    fireEvent.change(input, { target: { value: 'Work laptop' } })
    fireEvent.blur(input)
    expect(useSyncStore.getState().deviceName).toBe('Work laptop')
  })

  it('pushes without a dialog when there is no divergence', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'clean', nextRevision: 4, baseRevision: 3 })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(service.performPush).toHaveBeenCalledWith('tok', 'folder-1', 4, 3))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reports when there is nothing to push', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'nothing-to-push' })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByText(/already up to date/i)).toBeInTheDocument())
    expect(service.performPush).not.toHaveBeenCalled()
  })

  it('warns before overwriting a newer snapshot from another device', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'diverged', remote, nextRevision: 6, baseRevision: 3 })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/Phone/)).toBeInTheDocument()
    expect(service.performPush).not.toHaveBeenCalled()
  })

  it('pushes anyway when the user confirms the overwrite', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'diverged', remote, nextRevision: 6, baseRevision: 3 })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /overwrite/i }))
    await waitFor(() => expect(service.performPush).toHaveBeenCalledWith('tok', 'folder-1', 6, 3))
  })

  it('cancels the push when the user backs out', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'diverged', remote, nextRevision: 6, baseRevision: 3 })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(service.performPush).not.toHaveBeenCalled()
  })

  it('warns before a pull would discard unpushed local edits', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'would-lose-local', remote })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/unpushed changes/i)).toBeInTheDocument()
    expect(service.performPull).not.toHaveBeenCalled()
  })

  it('warns when two devices pushed the same revision', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'collision', remote })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/at the same time/i)).toBeInTheDocument()
    expect(service.performPull).not.toHaveBeenCalled()
  })

  it('surfaces Drive errors', async () => {
    vi.mocked(service.previewPull).mockRejectedValue(new Error('Google Drive access expired. Connect again and retry.'))
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByText(/access expired/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/components/settings/DriveSyncControls.test.tsx
```

Expected: FAIL with `Failed to resolve import "./DriveSyncControls"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/settings/DriveSyncControls.tsx`:

```tsx
import React, { useState } from 'react'
import { CloudUpload, CloudDownload, AlertTriangle } from 'lucide-react'
import { useSyncStore } from '../../store/useSyncStore'
import { requestAccessToken, getCachedToken } from '../../utils/driveAuth'
import { previewPush, previewPull, performPush, performPull } from '../../utils/syncService'
import type { SnapshotMeta } from '../../utils/syncDecision'

type Pending =
  | { kind: 'overwrite'; remote: SnapshotMeta; nextRevision: number; baseRevision: number }
  | { kind: 'discard-local'; remote: SnapshotMeta }
  | { kind: 'collision'; remote: SnapshotMeta }

function whenText(iso: string): string {
  return new Date(iso).toLocaleString()
}

export const DriveSyncControls: React.FC = () => {
  const clientId = useSyncStore((s) => s.clientId)
  const setClientId = useSyncStore((s) => s.setClientId)
  const folderId = useSyncStore((s) => s.folderId)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const lastSyncedRevision = useSyncStore((s) => s.lastSyncedRevision)
  const deviceName = useSyncStore((s) => s.deviceName)
  const setDeviceName = useSyncStore((s) => s.setDeviceName)

  const [nameDraft, setNameDraft] = useState(deviceName)
  const [clientIdDraft, setClientIdDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const token = async (): Promise<string> => getCachedToken() ?? (await requestAccessToken(clientId!))

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.')
    } finally {
      setBusy(false)
    }
  }

  const handlePush = () =>
    run(async () => {
      const accessToken = await token()
      const decision = await previewPush(accessToken)
      if (decision.kind === 'nothing-to-push') {
        setStatus('Drive is already up to date.')
        return
      }
      if (decision.kind === 'diverged') {
        setPending({
          kind: 'overwrite',
          remote: decision.remote,
          nextRevision: decision.nextRevision,
          baseRevision: decision.baseRevision,
        })
        return
      }
      await performPush(accessToken, useSyncStore.getState().folderId!, decision.nextRevision, decision.baseRevision)
      setStatus(`Pushed revision ${decision.nextRevision}.`)
    })

  const handlePull = () =>
    run(async () => {
      const accessToken = await token()
      const decision = await previewPull(accessToken)
      if (decision.kind === 'nothing-remote') {
        setStatus('No snapshots in Drive yet. Push from one device first.')
        return
      }
      if (decision.kind === 'up-to-date') {
        setStatus('This device is already up to date.')
        return
      }
      if (decision.kind === 'would-lose-local') {
        setPending({ kind: 'discard-local', remote: decision.remote })
        return
      }
      if (decision.kind === 'collision') {
        setPending({ kind: 'collision', remote: decision.remote })
        return
      }
      await performPull(accessToken, decision.remote)
      setStatus(`Pulled revision ${decision.remote.revision}. Reloading.`)
      window.location.reload()
    })

  const confirmPending = () =>
    run(async () => {
      const accessToken = await token()
      const current = pending!
      setPending(null)
      if (current.kind === 'overwrite') {
        await performPush(accessToken, folderId!, current.nextRevision, current.baseRevision)
        setStatus(`Pushed revision ${current.nextRevision}, overwriting the newer snapshot.`)
        return
      }
      await performPull(accessToken, current.remote)
      window.location.reload()
    })

  if (!clientId) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <p className="text-[12px] text-text-secondary">
          Sync through your own Google Drive. Create an OAuth client ID in Google Cloud Console, add this
          site to its authorised JavaScript origins, then paste the ID here.
        </p>
        <label className="flex flex-col gap-1 text-[12px] text-text-secondary">
          Google client ID
          <input
            value={clientIdDraft}
            onChange={(e) => setClientIdDraft(e.target.value)}
            placeholder="xxxxx.apps.googleusercontent.com"
            className="px-2 py-1.5 rounded-md border border-border bg-transparent text-[13px] text-text-primary"
          />
        </label>
        <button
          onClick={() => setClientId(clientIdDraft)}
          disabled={!clientIdDraft.trim()}
          className="px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
        >
          Save client ID
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-2">
        <button
          onClick={handlePush}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
        >
          <CloudUpload className="w-4 h-4" /> Push to Drive
        </button>
        <button
          onClick={handlePull}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
        >
          <CloudDownload className="w-4 h-4" /> Pull from Drive
        </button>
      </div>

      <label className="flex items-center gap-2 text-[12px] text-text-secondary">
        This device
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => setDeviceName(nameDraft)}
          className="flex-1 px-2 py-1 rounded-md border border-border bg-transparent text-[12px] text-text-primary"
        />
      </label>

      <p className="text-[11px] text-text-secondary/80">
        {lastSyncedAt
          ? `Last synced ${whenText(lastSyncedAt)} at revision ${lastSyncedRevision}.`
          : 'Never synced on this device.'}
      </p>

      {status && <p className="text-[12px] text-text-secondary">{status}</p>}
      {error && <p className="text-xs text-error">{error}</p>}

      {pending && (
        <div role="dialog" aria-label="Sync conflict" className="border border-error/60 rounded-md p-3 flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
            <AlertTriangle className="w-4 h-4 text-error" aria-hidden="true" /> This will discard data
          </p>
          {pending.kind === 'overwrite' && (
            <p className="text-[12px] text-text-secondary">
              {pending.remote.deviceName} pushed revision {pending.remote.revision} on{' '}
              {whenText(pending.remote.createdTime)}, after this device last synced. Pushing now makes your
              copy the newest one. Nothing is deleted from Drive, but the other device's changes will not be
              in your data.
            </p>
          )}
          {pending.kind === 'discard-local' && (
            <p className="text-[12px] text-text-secondary">
              You have unpushed changes on this device. Pulling revision {pending.remote.revision} from{' '}
              {pending.remote.deviceName} replaces everything here, and those local changes are gone.
            </p>
          )}
          {pending.kind === 'collision' && (
            <p className="text-[12px] text-text-secondary">
              Two devices pushed revision {pending.remote.revision} at the same time, so Drive holds two
              different snapshots with that number. Pulling takes the one from {pending.remote.deviceName},
              saved {whenText(pending.remote.createdTime)}. The other snapshot stays in your Drive folder,
              but this app will not offer it again, so recover it by hand if you need it.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={confirmPending}
              disabled={busy}
              className="flex-1 px-3 py-2 rounded-md border border-error text-[13px] text-error hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              {pending.kind === 'overwrite' && 'Overwrite anyway'}
              {pending.kind === 'discard-local' && 'Discard local and pull'}
              {pending.kind === 'collision' && 'Pull this one'}
            </button>
            <button
              onClick={() => setPending(null)}
              className="flex-1 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/components/settings/DriveSyncControls.test.tsx
```

Expected: PASS, 11 tests. If `window.location.reload` throws under jsdom, add `vi.stubGlobal('location', { ...window.location, reload: vi.fn() })` in `beforeEach` rather than changing the component.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/DriveSyncControls.tsx src/components/settings/DriveSyncControls.test.tsx
git commit -m "feat(sync): Drive sync settings controls with conflict dialog"
```

---

### Task 10: Wire into Settings and document

**Files:**
- Modify: `src/components/settings/SettingsSheet.tsx:6`, `src/components/settings/SettingsSheet.tsx:66-68`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `DriveSyncControls` from Task 9.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/components/settings/SettingsSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SettingsSheet } from './SettingsSheet'

describe('SettingsSheet', () => {
  it('renders a Sync section alongside Backup', () => {
    render(<SettingsSheet open onClose={() => {}} onOpenWhatsNew={() => {}} onOpenDisclaimer={() => {}} />)
    expect(screen.getByText('Backup')).toBeInTheDocument()
    expect(screen.getByText('Sync')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/components/settings/SettingsSheet.test.tsx
```

Expected: FAIL, `Unable to find an element with the text: Sync`.

- [ ] **Step 3: Wire it in**

In `src/components/settings/SettingsSheet.tsx`, add to the imports:

```tsx
import { RefreshCw } from 'lucide-react'
import { DriveSyncControls } from './DriveSyncControls'
```

and add a section card immediately after the existing Backup card:

```tsx
        <SectionCard icon={<RefreshCw className="w-4 h-4" />} title="Sync">
          <DriveSyncControls />
        </SectionCard>
```

- [ ] **Step 4: Run the full suite**

```bash
npx vitest run && npx tsc -b && npx eslint src/utils/syncHash.ts src/utils/syncDecision.ts src/utils/driveAuth.ts src/utils/driveSync.ts src/utils/syncService.ts src/store/useSyncStore.ts src/components/settings/DriveSyncControls.tsx
```

Expected: all tests PASS, no TypeScript errors, no new lint errors. The baseline before this work was 627 tests plus 29 pre-existing lint issues elsewhere in the repo; do not attempt to fix those here.

- [ ] **Step 5: Document and commit**

Add to `CHANGELOG.md` under a new `## 0.8.0-beta` heading:

```markdown
### Added
- Google Drive sync. Push and pull your whole dataset as timestamped JSON snapshots in a `Ledger` folder in your own Drive, using an OAuth client ID you supply in Settings. Snapshots carry a revision number, and the app warns before a push overwrites a newer snapshot from another device or a pull discards unpushed local edits. Retention keeps the most recent 100 snapshots and moves older ones to the Drive bin.

### Changed
- Backup envelope is now version 2, carrying device and revision metadata. Version 1 backup files still import.
- Restoring a backup now validates the whole file before writing anything, so a corrupt file cannot leave data half-restored.
```

```bash
git add src/components/settings/SettingsSheet.tsx src/components/settings/SettingsSheet.test.tsx CHANGELOG.md
git commit -m "feat(sync): surface Drive sync in Settings and document the feature"
```

---

## Manual verification

Automated tests never touch Google, so one manual pass is required before this is trustworthy. This needs two devices, or two browser profiles.

- [ ] In Google Cloud Console, create a project, enable the Google Drive API, configure the OAuth consent screen as External in Testing mode, and add your own Google account as a test user.
- [ ] Create an OAuth 2.0 Client ID of type Web application. Add authorised JavaScript origins for both `http://localhost:5173` and your GitHub Pages origin. Do not add a client secret anywhere in this app.
- [ ] Paste the client ID into Settings, Sync.
- [ ] On device A, push. Confirm a `Ledger` folder appears in Drive containing `ledger-<timestamp>-r1.json`.
- [ ] On device B, pull. Confirm device A's data appears after the reload.
- [ ] On device B, make an edit and push. Confirm `r2` appears.
- [ ] On device A without pulling first, make an edit and push. Confirm the conflict dialog names device B and revision 2, and that cancelling leaves Drive unchanged.
- [ ] On device A, choose Overwrite anyway. Confirm `r3` is written and that `r2` still exists in the folder, so device B's data is recoverable.
- [ ] On device B, make an unpushed edit, then pull. Confirm the dialog warns about unpushed changes.
- [ ] Confirm the OAuth consent prompt reappears after roughly 7 days, which is the documented Testing-mode limit.

## Known limitations to record, not fix

- **No merge.** Divergence is surfaced and the user picks a winner. Per-record merge needs `updatedAt` timestamps and delete tombstones on every record, which no store currently has. The v2 envelope's `deviceId`, `revision` and `baseRevision` fields are the groundwork for that later project.
- **Testing-mode consent expires every 7 days.** Avoiding this requires submitting the app for Google verification, which is disproportionate for a personal tool.
- **Token is memory-only**, so Connect is needed roughly once per app session. This is deliberate.
- **Hash-based dirty detection can report a false positive** if Zustand serialises the same state with different key order. The cost is one extra confirmation prompt and never data loss.
- **Simultaneous pushes from two devices** can produce two snapshots with the same revision. This is now detected rather than silently resolved: `hasRevisionCollision` reports the tie, `decidePush` returns `diverged`, and `decidePull` returns a `collision` decision that warns the user. The losing snapshot is not deleted, but the app will not offer it again, so recovering it means fetching the file from the Drive folder by hand. Amendment approved by the project owner after the Task 4 review; the original plan accepted the silent tie-break.
- **`decidePush` refuses to push from a device with no local data**, returning `nothing-to-push` even when the hash looks dirty. This stops a freshly installed device uploading an empty snapshot as revision 1. Also a Task 4 review amendment.
