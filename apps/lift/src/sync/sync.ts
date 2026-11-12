import type { Repo } from '../data/repo';
import type { Dump } from '../data/types';
import { GitHub, SyncError, type CloudConfig, type Payload } from './github';

export const HUB_CLOUD_KEY = 'hub-cloud';
/** The Hub home page, set by the Hub build. */
export const HUB_URL: string | undefined = import.meta.env.VITE_HUB_URL || undefined;

export function readHubConfig(): CloudConfig | null {
  try {
    const p = JSON.parse(globalThis.localStorage?.getItem(HUB_CLOUD_KEY) ?? 'null') as Partial<CloudConfig> | null;
    if (!p || typeof p.owner !== 'string' || typeof p.repo !== 'string' || typeof p.token !== 'string' || !p.owner || !p.repo || !p.token) return null;
    return { owner: p.owner, repo: p.repo, token: p.token };
  } catch {
    return null;
  }
}

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'pending' | 'error';
  lastSyncedAt?: string;
  message?: string;
}

/** Sorted, sync-time-free text for comparing two dumps. */
function canonical(d: Dump): string {
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify([byId(d.exercises), byId(d.routines), byId(d.workouts), byId(d.sets), byId(d.settings)]);
}

const KEY_LAST = 'sync.lastSyncedAt';

/** Keeps this device and `lift/data.json` in the Hub's data repo in step:
 *  pull, merge by id (newest edit wins), push the result. Runs on launch, on
 *  returning to the app, when the network returns, and a few seconds after
 *  local edits. Does nothing until the Hub has a cloud connection. */
export class LiftSync {
  private status: SyncStatus = { state: 'off' };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly repo: Repo,
    private readonly deps: { config?: () => CloudConfig | null; makeGitHub?: (c: CloudConfig) => GitHub; debounceMs?: number; now?: () => Date } = {},
  ) {}

  private config() { return (this.deps.config ?? readHubConfig)(); }
  private now() { return this.deps.now?.() ?? new Date(); }

  getStatus = (): SyncStatus => this.status;
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private set(next: SyncStatus) { this.status = next; this.listeners.forEach((l) => l()); }

  async start(): Promise<() => void> {
    const last = (await this.repo.db.kv.get(KEY_LAST))?.value as string | undefined;
    this.set(this.config() ? { state: 'idle', lastSyncedAt: last } : { state: 'off' });
    const offChange = this.repo.onLocalChange(() => this.schedule());
    const onVisible = () => { if (document.visibilityState === 'visible') void this.syncNow(); else void this.flush(); };
    const onOnline = () => void this.syncNow();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    void this.syncNow();
    return () => {
      offChange();
      clearTimeout(this.timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }

  private schedule() {
    if (!this.config()) return;
    if (this.status.state !== 'syncing') this.set({ ...this.status, state: 'pending' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), this.deps.debounceMs ?? 3000);
  }

  /** Pushes pending edits right away, for when the app goes to the background. */
  private async flush() {
    if (this.status.state === 'pending') await this.syncNow();
  }

  syncNow(): Promise<void> {
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      try {
        do { this.again = false; await this.run(); } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async run() {
    const config = this.config();
    if (!config) { this.set({ state: 'off' }); return; }
    clearTimeout(this.timer);
    this.set({ ...this.status, state: 'syncing' });
    const gh = this.deps.makeGitHub?.(config) ?? new GitHub(config);
    try {
      if (!(await gh.isPrivate())) throw new SyncError('public_repo', 'The Hub data repo is public. Use a private repo.');
      for (let attempt = 0; ; attempt++) {
        const remote = await gh.pull();
        if (remote.payload) await this.repo.mergeAll(remote.payload);
        const merged = await this.repo.dumpAll();
        if (!remote.payload || canonical(remote.payload) !== canonical(merged)) {
          const payload: Payload = { app: 'lift', version: 1, syncedAt: this.now().toISOString(), ...merged };
          try {
            await gh.push(payload, remote.sha, `Lift sync · ${this.now().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
          } catch (e) {
            if (e instanceof SyncError && e.kind === 'conflict' && attempt < 2) continue;
            throw e;
          }
        }
        break;
      }
      const at = this.now().toISOString();
      await this.repo.db.kv.put({ key: KEY_LAST, value: at });
      this.set({ state: 'idle', lastSyncedAt: at });
    } catch (e) {
      const err = e instanceof SyncError ? e : new SyncError('other', 'Sync failed.');
      this.set({ state: 'error', message: err.message, lastSyncedAt: this.status.lastSyncedAt });
    }
  }
}
