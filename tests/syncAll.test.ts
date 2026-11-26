import { afterEach, describe, expect, it, vi } from 'vitest';
import { APPS } from '../src/apps';
import { syncAll, syncInFrame } from '../src/syncAll';

describe('sync all', () => {
  it('syncs each app one after another and reports each', async () => {
    const order: string[] = [];
    let running = 0, most = 0;
    const results = await syncAll(APPS, async (app) => {
      running++; most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 2));
      running--;
      if (app.id === 'ledger') return { ok: false, detail: 'Open Ledger to choose which copy to keep.' };
      if (app.id === 'lift') throw new Error('boom');
      return { ok: true, detail: 'Synced' };
    }, (app, state) => order.push(`${app.id}:${state === 'syncing' ? 'start' : state.ok ? 'ok' : 'fail'}`));
    expect(most).toBe(1);
    expect(order).toEqual(APPS.flatMap((a) => [`${a.id}:start`, `${a.id}:${a.id === 'ledger' || a.id === 'lift' ? 'fail' : 'ok'}`]));
    expect(results.get('lift')).toEqual({ ok: false, detail: 'Could not sync. Open Lift to sync it.' });
    expect(results.get('pantry')).toEqual({ ok: true, detail: 'Synced' });
  });
});

describe('syncing an app in a hidden frame', () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });
  const pantry = APPS.find((a) => a.id === 'pantry')!;

  it('opens the app in sync-only mode and takes the result from that frame only', async () => {
    const pending = syncInFrame(pantry, '/H-U-B/');
    const frame = document.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('/H-U-B/pantry/?hubsync=1');
    // Messages from elsewhere, or about another app, are ignored.
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', source: frame.contentWindow, data: { type: 'hub-sync-result', app: 'pantry', ok: true, detail: 'x' } }));
    window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: window, data: { type: 'hub-sync-result', app: 'pantry', ok: true, detail: 'x' } }));
    window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: frame.contentWindow, data: { type: 'hub-sync-result', app: 'lift', ok: true, detail: 'x' } }));
    expect(document.querySelector('iframe')).not.toBeNull();
    window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: frame.contentWindow, data: { type: 'hub-sync-result', app: 'pantry', ok: true, detail: 'Synced' } }));
    expect(await pending).toEqual({ ok: true, detail: 'Synced' });
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('gives up on an app that never answers', async () => {
    vi.useFakeTimers();
    const pending = syncInFrame(pantry, '/H-U-B/', 1000);
    vi.advanceTimersByTime(1001);
    expect(await pending).toEqual({ ok: false, detail: 'Pantry did not answer. Open it to sync.' });
    expect(document.querySelector('iframe')).toBeNull();
  });
});
