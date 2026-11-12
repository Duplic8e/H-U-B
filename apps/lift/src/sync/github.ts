import type { Dump } from '../data/types';

export interface CloudConfig { owner: string; repo: string; token: string }

export class SyncError extends Error {
  readonly kind: 'auth' | 'not_found' | 'conflict' | 'network' | 'public_repo' | 'other';
  constructor(kind: SyncError['kind'], message: string) {
    super(message);
    this.kind = kind;
    this.name = 'SyncError';
  }
}

/** What `lift/data.json` holds. */
export interface Payload extends Dump {
  app: 'lift';
  version: 1;
  syncedAt: string;
}

const API = 'https://api.github.com';
const FILE = 'lift/data.json';
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function parsePayload(raw: unknown): Payload {
  const p = raw as Partial<Payload> | null;
  const lists = ['exercises', 'routines', 'workouts', 'sets', 'settings'] as const;
  if (!p || p.app !== 'lift' || !lists.every((k) => Array.isArray(p[k]))) throw new SyncError('other', 'The cloud data is damaged or not Lift data.');
  if ((p.version ?? 1) > 1) throw new SyncError('other', 'The cloud data was written by a newer Lift. Refresh the app.');
  return p as Payload;
}

/** GitHub contents API. The token only ever goes in the Authorization header. */
export class GitHub {
  constructor(private readonly config: CloudConfig, private readonly doFetch: Fetch = (i, init) => fetch(i, init)) {}

  private async request(path: string, init: RequestInit & { accept?: string } = {}): Promise<Response> {
    const { accept = 'application/vnd.github+json', ...rest } = init;
    const url = `${API}/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}${path}`;
    try {
      return await this.doFetch(url, { ...rest, cache: 'no-store', headers: { Authorization: `Bearer ${this.config.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' } });
    } catch {
      throw new SyncError('network', 'Could not reach GitHub.');
    }
  }

  private fail(res: Response): never {
    if (res.status === 401 || res.status === 403) throw new SyncError('auth', 'GitHub refused the Hub token. Update it in Hub settings.');
    if (res.status === 404) throw new SyncError('not_found', 'The data repo was not found.');
    if (res.status === 409 || res.status === 422) throw new SyncError('conflict', 'The cloud copy changed during sync.');
    throw new SyncError('other', `GitHub returned an error (${res.status}).`);
  }

  async isPrivate(): Promise<boolean> {
    const res = await this.request('');
    if (!res.ok) this.fail(res);
    return ((await res.json()) as { private?: boolean }).private === true;
  }

  async pull(): Promise<{ sha: string | null; payload: Payload | null }> {
    // The sha first, so a write based on this read is rejected if the file changes meanwhile.
    const listing = await this.request('/contents/lift');
    if (listing.status === 404) return { sha: null, payload: null };
    if (!listing.ok) this.fail(listing);
    const entries = (await listing.json()) as Array<{ name: string; sha: string }>;
    const sha = Array.isArray(entries) ? (entries.find((e) => e.name === 'data.json')?.sha ?? null) : null;
    if (!sha) return { sha: null, payload: null };
    const res = await this.request(`/contents/${FILE}`, { accept: 'application/vnd.github.raw+json' });
    if (res.status === 404) return { sha: null, payload: null };
    if (!res.ok) this.fail(res);
    let raw: unknown;
    try { raw = JSON.parse(await res.text()); } catch { throw new SyncError('other', 'The cloud data is damaged.'); }
    return { sha, payload: parsePayload(raw) };
  }

  async push(payload: Payload, sha: string | null, message: string): Promise<void> {
    const res = await this.request(`/contents/${FILE}`, { method: 'PUT', body: JSON.stringify({ message, content: utf8ToBase64(JSON.stringify(payload)), ...(sha ? { sha } : {}) }) });
    if (!res.ok) this.fail(res);
  }
}
