import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LiftDB } from '../src/data/db';
import { createRepo } from '../src/data/repo';
import { GitHub } from '../src/sync/github';
import { LiftSync } from '../src/sync/sync';

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
    if (path === '/contents/lift') return this.file ? new Response(JSON.stringify([{ name: 'data.json', sha: this.file.sha }]), { status: 200 }) : new Response('{}', { status: 404 });
    if (path === '/contents/lift/data.json') return this.file ? new Response(this.file.text, { status: 200 }) : new Response('{}', { status: 404 });
    return new Response('{}', { status: 404 });
  };
}

let n = 0;
function device(gh: FakeGitHub, connected = true) {
  const repo = createRepo(new LiftDB(`lift-sync-${++n}`));
  const sync = new LiftSync(repo, { config: () => (connected ? { owner: 'me', repo: 'data', token: TOKEN } : null), makeGitHub: (c) => new GitHub(c, gh.fetch), debounceMs: 5 });
  return { repo, sync };
}

describe('Lift sync through the Hub connection', () => {
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
    await phone.repo.setUp('ppl');
    const w = await phone.repo.startWorkout((await phone.repo.listRoutines())[0]!.id);
    const s = (await phone.repo.workoutSets(w))[0]!;
    await phone.repo.updateSet(s.id, { weightKg: 80, reps: 8, done: true });
    await phone.repo.finishWorkout(w);
    await phone.sync.syncNow();
    expect(phone.sync.getStatus().state).toBe('idle');
    expect(JSON.parse(gh.file!.text)).toMatchObject({ app: 'lift' });
    expect(gh.file!.text).not.toContain(TOKEN);

    // The app was deleted and installed again.
    const fresh = device(gh);
    await fresh.sync.syncNow();
    expect((await fresh.repo.listRoutines()).map((r) => r.name)).toEqual(['Push', 'Pull', 'Legs']);
    expect((await fresh.repo.finishedWorkouts()).length).toBe(1);

    // Both edit, both sync: nothing is lost.
    await fresh.repo.setUnit('lb');
    await phone.repo.saveExercise({ name: 'Cable Lateral Raise', muscle: 'Shoulders', equipment: 'Cable' });
    await fresh.sync.syncNow();
    await phone.sync.syncNow();
    await fresh.sync.syncNow();
    expect((await phone.repo.getSettings()).unit).toBe('lb');
    expect((await fresh.repo.listExercises()).some((e) => e.name === 'Cable Lateral Raise')).toBe(true);
  });

  it('skips the write when nothing changed', async () => {
    const gh = new FakeGitHub();
    const d = device(gh);
    await d.repo.setUp(null);
    await d.sync.syncNow();
    const writes = gh.writes;
    await d.sync.syncNow();
    expect(gh.writes).toBe(writes);
  });

  it('retries when another device writes in between', async () => {
    const gh = new FakeGitHub();
    const d = device(gh);
    await d.repo.setUp(null);
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

    const bad = createRepo(new LiftDB(`lift-sync-${++n}`));
    const s = new LiftSync(bad, { config: () => ({ owner: 'me', repo: 'data', token: 'wrong' }), makeGitHub: (c) => new GitHub(c, new FakeGitHub().fetch) });
    await s.syncNow();
    expect(s.getStatus()).toMatchObject({ state: 'error', message: expect.stringMatching(/token/) });
  });
});
