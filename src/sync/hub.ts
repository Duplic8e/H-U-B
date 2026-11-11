import type { SyncConfig } from './types';

/**
 * The Hub hosts Torque alongside the owner's other helpers on one origin. Its settings page saves a single GitHub
 * connection under this localStorage key, and every app on the Hub reads it, so the token is entered once.
 * Torque keeps its own copy in IndexedDB as before; the Hub's copy wins whenever it differs.
 */
export const HUB_CLOUD_KEY = 'hub-cloud';

/** The Hub's home page, set only when this build is served from the Hub. */
export const HUB_URL: string | undefined = import.meta.env.VITE_HUB_URL || undefined;

export function readHubConfig(): SyncConfig | null {
  try {
    const raw = globalThis.localStorage?.getItem(HUB_CLOUD_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SyncConfig>;
    if (typeof p.owner !== 'string' || typeof p.repo !== 'string' || typeof p.token !== 'string') return null;
    if (!p.owner || !p.repo || !p.token) return null;
    return { owner: p.owner, repo: p.repo, token: p.token };
  } catch {
    return null;
  }
}

export function sameConfig(a: SyncConfig | null, b: SyncConfig | null): boolean {
  if (!a || !b) return a === b;
  return a.owner.toLowerCase() === b.owner.toLowerCase() && a.repo.toLowerCase() === b.repo.toLowerCase() && a.token === b.token;
}
