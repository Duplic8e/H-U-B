import { beforeEach, describe, expect, it } from 'vitest';
import { HUB_CLOUD_KEY, clearCloud, lastBackup, readCloud, saveCloud, testCloud, timeAgo } from '../src/cloud';

const cfg = { owner: 'me', repo: 'data', token: 'tok' };
const reply = (status: number, body: unknown = {}) => async () => new Response(JSON.stringify(body), { status });

beforeEach(() => localStorage.clear());

describe('the shared cloud connection', () => {
  it('round-trips under the key every helper reads', () => {
    saveCloud({ owner: ' me ', repo: 'data ', token: ' tok' });
    expect(JSON.parse(localStorage.getItem(HUB_CLOUD_KEY)!)).toEqual(cfg);
    expect(readCloud()).toEqual(cfg);
    clearCloud();
    expect(readCloud()).toBeNull();
  });

  it('treats damaged or partial entries as not connected', () => {
    localStorage.setItem(HUB_CLOUD_KEY, '{oops');
    expect(readCloud()).toBeNull();
    localStorage.setItem(HUB_CLOUD_KEY, JSON.stringify({ owner: 'me', repo: 'data' }));
    expect(readCloud()).toBeNull();
  });
});

describe('testing the connection', () => {
  it('accepts a private repo the token can see', async () => {
    await expect(testCloud(cfg, reply(200, { private: true }) as typeof fetch)).resolves.toBeUndefined();
  });

  it('refuses a public repo', async () => {
    await expect(testCloud(cfg, reply(200, { private: false }) as typeof fetch)).rejects.toThrow(/public/);
  });

  it('explains a bad token and a missing repo', async () => {
    await expect(testCloud(cfg, reply(401) as typeof fetch)).rejects.toThrow(/rejected the token/);
    await expect(testCloud(cfg, reply(404) as typeof fetch)).rejects.toThrow(/not found/);
  });

  it('needs every field', async () => {
    await expect(testCloud({ ...cfg, token: ' ' })).rejects.toThrow(/all three/);
  });

  it('sends the token only to api.github.com, in the Authorization header', async () => {
    const seen: Array<{ url: string; auth: string | null }> = [];
    const spy = (async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: new Headers(init?.headers).get('Authorization') });
      return new Response(JSON.stringify({ private: true }), { status: 200 });
    }) as typeof fetch;
    await testCloud(cfg, spy);
    expect(seen).toEqual([{ url: 'https://api.github.com/repos/me/data', auth: 'Bearer tok' }]);
  });
});

describe('last backup', () => {
  it('reads the latest commit touching the app file', async () => {
    const when = await lastBackup(cfg, 'ledger/data.json', reply(200, [{ commit: { committer: { date: '2026-11-11T10:00:00Z' } } }]) as typeof fetch);
    expect(when?.toISOString()).toBe('2026-11-11T10:00:00.000Z');
  });

  it('is null for an app that never synced, and for an empty repo', async () => {
    expect(await lastBackup(cfg, 'torque/data.json', reply(200, []) as typeof fetch)).toBeNull();
    expect(await lastBackup(cfg, 'torque/data.json', reply(409) as typeof fetch)).toBeNull();
  });

  it('reads as a person would say it', () => {
    const now = new Date('2026-11-11T12:00:00Z');
    expect(timeAgo(new Date('2026-11-11T11:59:50Z'), now)).toBe('just now');
    expect(timeAgo(new Date('2026-11-11T11:45:00Z'), now)).toBe('15 min ago');
    expect(timeAgo(new Date('2026-11-11T09:00:00Z'), now)).toBe('3 h ago');
    expect(timeAgo(new Date('2026-11-01T12:00:00Z'), now)).toBe('10 days ago');
  });
});
