import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createRepo } from '../../src/data/repo';
import { TorqueDB } from '../../src/data/schema';
import { GitHubProvider } from '../../src/sync/github';
import { sameConfig } from '../../src/sync/hub';
import { SyncManager } from '../../src/sync/manager';
import type { SyncConfig } from '../../src/sync/types';
import { FakeGitHub } from './fake-github';

let n = 0;
const devices: SyncManager[] = [];
afterEach(() => devices.splice(0).forEach((m) => m.dispose()));

const vehicleInput = { nickname: 'CX-5', year: 2023, units: 'mi' as const, drivingStyle: 'normal' as const };

function device(gh: FakeGitHub, hub: () => SyncConfig | null) {
  const db = new TorqueDB(`torque-hub-${++n}`);
  const repo = createRepo(db);
  const mgr = new SyncManager({ db, repo, makeProvider: (c) => new GitHubProvider(c, gh.fetch), isOnline: () => gh.online, hubConfig: hub });
  devices.push(mgr);
  return { db, repo, mgr };
}

describe('running inside the Hub', () => {
  it('adopts the Hub connection on a fresh install and restores the car from the cloud', async () => {
    const gh = new FakeGitHub();
    const hub = { owner: 'me', repo: 'torque-data', token: gh.token };

    const phone = device(gh, () => hub);
    await phone.repo.createVehicle(vehicleInput);
    await phone.mgr.start();
    await phone.mgr.syncNow();
    expect(phone.mgr.isHubManaged()).toBe(true);

    // The app was removed from the home screen and installed again: empty database, same Hub connection.
    const reinstalled = device(gh, () => hub);
    expect(await reinstalled.repo.getVehicle()).toBeUndefined();
    await reinstalled.mgr.start();
    await reinstalled.mgr.syncNow();
    expect((await reinstalled.repo.getVehicle())?.nickname).toBe('CX-5');
    expect(reinstalled.mgr.getSnapshot().state.lastSyncedAt).toBeDefined();
  });

  it('takes a replaced token from the Hub', async () => {
    const gh = new FakeGitHub();
    let hub: SyncConfig = { owner: 'me', repo: 'torque-data', token: 'old-token' };
    const d = device(gh, () => hub);
    await d.mgr.start();
    expect(d.mgr.getConfig()).toBeNull(); // the old token is rejected, so nothing is adopted
    expect(d.mgr.getSnapshot().state.lastError?.kind).toBe('auth');

    hub = { ...hub, token: gh.token };
    await d.mgr.start();
    expect(d.mgr.getConfig()?.token).toBe(gh.token);
  });

  it('refuses a public Hub repository', async () => {
    const gh = new FakeGitHub();
    gh.isPrivate = false;
    const d = device(gh, () => ({ owner: 'me', repo: 'torque-data', token: gh.token }));
    await d.mgr.start();
    expect(d.mgr.getConfig()).toBeNull();
    expect(d.mgr.getSnapshot().state.lastError?.kind).toBe('public_repo');
  });

  it('leaves a standalone install alone when there is no Hub', async () => {
    const gh = new FakeGitHub();
    const d = device(gh, () => null);
    await d.mgr.start();
    expect(d.mgr.getConfig()).toBeNull();
    expect(d.mgr.isHubManaged()).toBe(false);
  });

  it('compares owner and repo case-insensitively but the token exactly', () => {
    const a = { owner: 'Me', repo: 'Data', token: 't' };
    expect(sameConfig(a, { owner: 'me', repo: 'data', token: 't' })).toBe(true);
    expect(sameConfig(a, { owner: 'me', repo: 'data', token: 'T' })).toBe(false);
    expect(sameConfig(null, null)).toBe(true);
  });
});
