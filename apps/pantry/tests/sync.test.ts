import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { PantryDB } from '../src/data/db';
import { createRepo } from '../src/data/repo';
import { GitHub } from '../src/sync/github';
import { PantrySync } from '../src/sync/sync';

const TOKEN = 'github_pat_FAKE';
class FakeGitHub {
  file: { sha: string; text: string } | null = null;
  isPrivate = true;
  writes = 0;
  conflictNext = false;
  private n = 0;
  readonly fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const headers = init.headers as Record<string, string>;
    if (headers.Authorization !== `Bearer ${TOKEN}`) return new Response('{}', { status: 401 });
    const path = new URL(url).pathname.replace(/^\/repos\/me\/data/, '');
    if (path === '') return new Response(JSON.stringify({ private: this.isPrivate }), { status: 200 });
    if (init.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { content: string; sha?: string };
      if (this.conflictNext) { this.conflictNext = false; return new Response('{}', { status: 409 }); }
      if ((this.file?.sha ?? undefined) !== body.sha) return new Response('{}', { status: 409 });
      const text = new TextDecoder().decode(Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0)));
      this.file = { sha: `sha${++this.n}`, text };
      this.writes++;
      return new Response('{}', { status: 200 });
    }
    if (path === '/contents/pantry') return this.file ? new Response(JSON.stringify([{ name: 'data.json', sha: this.file.sha }]), { status: 200 }) : new Response('{}', { status: 404 });
    if (path === '/contents/pantry/data.json') return this.file ? new Response(this.file.text, { status: 200 }) : new Response('{}', { status: 404 });
    return new Response('{}', { status: 404 });
  };
}

let n = 0;
function device(gh: FakeGitHub, connected = true) {
  const repo = createRepo(new PantryDB(`pantry-sync-${++n}`));
  const sync = new PantrySync(repo, { config: () => (connected ? { owner: 'me', repo: 'data', token: TOKEN } : null), makeGitHub: (c) => new GitHub(c, gh.fetch), debounceMs: 5 });
  return { repo, sync };
}

describe('Pantry sync through the Hub connection', () => {
  it('does nothing without a Hub connection', async () => {
    const gh = new FakeGitHub();
    const d = device(gh, false);
    await d.sync.syncNow();
    expect(d.sync.getStatus().state).toBe('off');
    expect(gh.writes).toBe(0);
  });

  it('uploads, restores onto a fresh install, and merges edits from both sides', async () => {
    const gh = new FakeGitHub();
    const phone = device(gh);
    const nutella = await phone.repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 2, expiresOn: '2027-03-01' });
    await phone.repo.saveItem({ name: 'Bananas', quantity: 6 });
    await phone.sync.syncNow();
    expect(phone.sync.getStatus().state).toBe('idle');
    expect(JSON.parse(gh.file!.text)).toMatchObject({ app: 'pantry' });
    expect(gh.file!.text).not.toContain(TOKEN);

    // The app was deleted and installed again.
    const fresh = device(gh);
    await fresh.sync.syncNow();
    expect((await fresh.repo.listItems()).map((i) => i.name).sort()).toEqual(['Bananas', 'Nutella']);

    // Both edit, both sync: nothing is lost, and a removal travels.
    await fresh.repo.adjust(nutella, -1);
    await phone.repo.saveItem({ barcode: '8005110070013', name: 'Chopped tomatoes', quantity: 4 });
    const bananas = (await phone.repo.listItems()).find((i) => i.name === 'Bananas')!;
    await phone.repo.remove(bananas.id);
    await fresh.sync.syncNow();
    await phone.sync.syncNow();
    await fresh.sync.syncNow();
    for (const d of [phone, fresh]) {
      expect((await d.repo.listItems()).map((i) => [i.name, i.quantity]).sort()).toEqual([['Chopped tomatoes', 4], ['Nutella', 1]]);
    }
  });

  it('joins the same product scanned on two phones before either synced', async () => {
    const gh = new FakeGitHub();
    const a = device(gh);
    const b = device(gh);
    await a.repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 1 });
    await b.repo.saveItem({ barcode: '3017620422003', name: 'Nutella', quantity: 1 });
    await a.sync.syncNow();
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect(await a.repo.listItems()).toHaveLength(1);
    expect(await b.repo.listItems()).toHaveLength(1);
  });

  it('skips the write when nothing changed', async () => {
    const gh = new FakeGitHub();
    const d = device(gh);
    await d.repo.saveItem({ name: 'Rice', quantity: 1 });
    await d.sync.syncNow();
    const writes = gh.writes;
    await d.sync.syncNow();
    expect(gh.writes).toBe(writes);
  });

  it('retries when another device writes in between', async () => {
    const gh = new FakeGitHub();
    const d = device(gh);
    await d.repo.saveItem({ name: 'Rice', quantity: 1 });
    gh.conflictNext = true;
    await d.sync.syncNow();
    expect(d.sync.getStatus().state).toBe('idle');
    expect(gh.writes).toBe(1);
  });

  it('refuses a public repo and a bad token, with a reason', async () => {
    const gh = new FakeGitHub();
    gh.isPrivate = false;
    const d = device(gh);
    await d.sync.syncNow();
    expect(d.sync.getStatus()).toMatchObject({ state: 'error', message: expect.stringMatching(/public/) });

    const bad = createRepo(new PantryDB(`pantry-sync-${++n}`));
    const s = new PantrySync(bad, { config: () => ({ owner: 'me', repo: 'data', token: 'wrong' }), makeGitHub: (c) => new GitHub(c, new FakeGitHub().fetch) });
    await s.syncNow();
    expect(s.getStatus()).toMatchObject({ state: 'error', message: expect.stringMatching(/token/) });
  });
});
