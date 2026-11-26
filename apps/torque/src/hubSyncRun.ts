/** "Sync all" in the Hub opens this app in a hidden frame with ?hubsync. The app then only syncs
 *  and reports back to the Hub, without drawing anything. */
export const isHubSyncRun = () => typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(location.search).has('hubsync');

export interface HubSyncReport { type: 'hub-sync-result'; app: string; ok: boolean; detail: string }

export async function runForHub(): Promise<void> {
  const report = (ok: boolean, detail: string) => window.parent.postMessage({ type: 'hub-sync-result', app: 'torque', ok, detail } satisfies HubSyncReport, location.origin);
  try {
    const { getSync } = await import('./sync');
    const sync = getSync();
    await sync.start();
    await sync.syncNow();
    const snap = sync.getSnapshot();
    if (!snap.configured) { report(false, 'Not connected to the cloud.'); return; }
    const error = snap.state.lastError;
    report(!error, error ? error.message : 'Synced');
  } catch (e) {
    report(false, e instanceof Error ? e.message : 'Sync failed.');
  }
}
