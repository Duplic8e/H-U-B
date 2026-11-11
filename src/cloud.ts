/**
 * The one cloud connection every helper shares.
 *
 * All helpers are served from the same origin as the Hub, so they can all read this localStorage entry. Each app
 * writes its own folder in the private data repo (`ledger/`, `torque/`, ...). The token never leaves this device
 * except in the Authorization header of requests to api.github.com, and it is never written to any repository.
 */
export const HUB_CLOUD_KEY = 'hub-cloud';
const API = 'https://api.github.com';

export interface CloudConfig {
  owner: string;
  repo: string;
  token: string;
}

export const DEFAULT_OWNER = 'Duplic8e';
export const DEFAULT_REPO = 'H-U-B-helper';

export function readCloud(storage: Storage = localStorage): CloudConfig | null {
  try {
    const raw = storage.getItem(HUB_CLOUD_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CloudConfig>;
    if (typeof p.owner !== 'string' || typeof p.repo !== 'string' || typeof p.token !== 'string') return null;
    if (!p.owner || !p.repo || !p.token) return null;
    return { owner: p.owner, repo: p.repo, token: p.token };
  } catch {
    return null;
  }
}

export function saveCloud(config: CloudConfig, storage: Storage = localStorage): void {
  storage.setItem(HUB_CLOUD_KEY, JSON.stringify({ owner: config.owner.trim(), repo: config.repo.trim(), token: config.token.trim() }));
}

export function clearCloud(storage: Storage = localStorage): void {
  storage.removeItem(HUB_CLOUD_KEY);
}

type Fetch = typeof fetch;

async function gh(config: CloudConfig, path: string, doFetch: Fetch): Promise<Response> {
  const url = `${API}/repos/${encodeURIComponent(config.owner.trim())}/${encodeURIComponent(config.repo.trim())}${path}`;
  try {
    return await doFetch(url, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${config.token.trim()}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
  } catch {
    throw new Error('Could not reach GitHub. Check your connection.');
  }
}

/** Checks the token can see the repo and that the repo is private. Throws a message fit for a person. */
export async function testCloud(config: CloudConfig, doFetch: Fetch = fetch): Promise<void> {
  if (!config.owner.trim() || !config.repo.trim() || !config.token.trim()) throw new Error('Fill in all three fields.');
  const res = await gh(config, '', doFetch);
  if (res.status === 401) throw new Error('GitHub rejected the token. It may be mistyped, expired or revoked.');
  if (res.status === 403) throw new Error('GitHub refused access. Give the token Contents: read and write on this repo.');
  if (res.status === 404) throw new Error('Repository not found, or the token is not allowed to see it.');
  if (!res.ok) throw new Error(`GitHub returned an error (${res.status}).`);
  const body = (await res.json()) as { private?: boolean };
  if (body.private !== true) throw new Error('That repository is public. Use a private repository so your data stays private.');
}

/** When this app last wrote its data file, or null if it never has. */
export async function lastBackup(config: CloudConfig, dataFile: string, doFetch: Fetch = fetch): Promise<Date | null> {
  const res = await gh(config, `/commits?path=${encodeURIComponent(dataFile)}&per_page=1`, doFetch);
  // An empty repository answers 409 to a commit listing.
  if (res.status === 404 || res.status === 409) return null;
  if (!res.ok) throw new Error(`GitHub returned an error (${res.status}).`);
  const commits = (await res.json()) as Array<{ commit?: { committer?: { date?: string } } }>;
  const date = commits[0]?.commit?.committer?.date;
  return date ? new Date(date) : null;
}

export function timeAgo(date: Date, now: Date = new Date()): string {
  const m = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
