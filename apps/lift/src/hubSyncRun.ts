/** "Sync all" in the Hub opens this app in a hidden frame with ?hubsync. The app then only syncs
 *  and reports back to the Hub, without drawing anything. */
export const isHubSyncRun = () => typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(location.search).has('hubsync');

export interface HubSyncReport { type: 'hub-sync-result'; app: string; ok: boolean; detail: string }

export async function runForHub(): Promise<void> {
  const report = (ok: boolean, detail: string) => window.parent.postMessage({ type: 'hub-sync-result', app: 'lift', ok, detail } satisfies HubSyncReport, location.origin);
  try {
    const [{ getRepo }, { LiftSync, readHubConfig }] = await Promise.all([import('./data/repo'), import('./sync/sync')]);
    if (!readHubConfig()) { report(false, 'Not connected to the cloud.'); return; }
    const sync = new LiftSync(getRepo());
    await sync.syncNow();
    const status = sync.getStatus();
    report(status.state === 'idle', status.state === 'idle' ? 'Synced' : status.message ?? 'Sync failed.');
  } catch (e) {
    report(false, e instanceof Error ? e.message : 'Sync failed.');
  }
}
