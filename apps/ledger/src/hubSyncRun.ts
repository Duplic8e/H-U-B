/** "Sync all" in the Hub opens this app in a hidden frame with ?hubsync. The app then only syncs
 *  and reports back to the Hub, without drawing anything. */
export const isHubSyncRun = () => typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(location.search).has('hubsync')

export interface HubSyncReport { type: 'hub-sync-result'; app: string; ok: boolean; detail: string }

export async function runForHub(): Promise<void> {
  const report = (ok: boolean, detail: string) => window.parent.postMessage({ type: 'hub-sync-result', app: 'ledger', ok, detail } satisfies HubSyncReport, location.origin)
  try {
    const { runHubSync } = await import('./utils/hubSync')
    const result = await runHubSync()
    if (result === 'off') report(false, 'Not connected to the cloud.')
    else if (result === 'conflict') report(false, 'This phone and the cloud both changed. Open Ledger to choose which copy to keep.')
    else report(true, result === 'pulled' ? 'Updated from the cloud' : result === 'pushed' ? 'Uploaded' : 'Already up to date')
  } catch (e) {
    report(false, e instanceof Error ? e.message : 'Sync failed.')
  }
}
