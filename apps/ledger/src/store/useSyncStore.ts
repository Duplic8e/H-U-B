import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from './storageKeys'
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
  /** How many automatic syncs have failed in a row. Auto-sync deliberately
   *  swallows errors, since a transient failure should not raise a toast on
   *  every app focus. A run of them is different: it means sync has been
   *  quietly not happening, and only the stale chip said so. */
  consecutiveAutoFailures: number;

  setDeviceName: (name: string) => void;
  setClientId: (id: string) => void;
  clearClientId: () => void;
  setFolderId: (id: string) => void;
  recordSync: (revision: number, hash: string) => void;
  disconnect: () => void;
  recordAutoFailure: () => void;
  clearAutoFailures: () => void;
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
      consecutiveAutoFailures: 0,

      setDeviceName: (name) => set({ deviceName: name.trim() || defaultDeviceName() }),
      setClientId: (id) => set({ clientId: id.trim() || undefined }),
      clearClientId: () => set({ clientId: undefined }),
      setFolderId: (id) => set({ folderId: id }),
      recordSync: (revision, hash) =>
        set({ lastSyncedRevision: revision, lastSyncedHash: hash, lastSyncedAt: new Date().toISOString() }),
      // Forgets the whole Drive relationship, not just the client id. A reconnect
      // may point at a different Drive account or project, and a stale
      // lastSyncedRevision/lastSyncedHash would make decidePush believe an empty
      // remote is already up to date, silently hiding local data from a fresh Drive.
      // Device identity is independent of which Drive is connected, so deviceId and
      // deviceName survive.
      disconnect: () =>
        set({
          clientId: undefined,
          folderId: undefined,
          lastSyncedAt: undefined,
          lastSyncedRevision: 0,
          lastSyncedHash: '',
        }),
      recordAutoFailure: () => set((s) => ({ consecutiveAutoFailures: s.consecutiveAutoFailures + 1 })),
      clearAutoFailures: () => set({ consecutiveAutoFailures: 0 }),
    }),
    {
      // Intentionally absent from BACKUP_KEYS: this metadata is per-device and
      // must not travel inside a snapshot.
      name: STORAGE_KEYS.sync,
      version: 1,
      // Existing installs wrote version 0 with this exact shape, so v0 to v1
      // is an identity migration. It exists so the next schema change has a
      // hook instead of a silent reinterpretation of whatever is on disk.
      migrate: (persisted: unknown) => persisted,
    }
  )
);
