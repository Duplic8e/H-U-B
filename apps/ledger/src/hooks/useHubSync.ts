import { useEffect, useSyncExternalStore } from 'react'
import { getHubSyncStatus, hasUnsyncedChanges, readHubConfig, runHubSync, subscribeHubSync, type HubSyncStatus } from '../utils/hubSync'

/** How often a visible tab checks for unsynced local edits. The check is a
 *  local hash comparison; the network is touched only when something changed. */
const CHANGE_CHECK_MS = 15_000

export function useHubSyncStatus(): HubSyncStatus {
  return useSyncExternalStore(subscribeHubSync, getHubSyncStatus, getHubSyncStatus)
}

async function syncAndReloadIfPulled(): Promise<void> {
  try {
    const result = await runHubSync()
    // A pull replaced local storage underneath the in-memory stores.
    if (result === 'pulled') window.location.reload()
  } catch {
    // Shown by the status; a failed background pass retries on the next trigger.
  }
}

/** Keeps Ledger and the Hub's data repo in step: on launch, on returning to
 *  the app, on leaving it, when the network comes back, and shortly after
 *  local edits. Does nothing when the Hub has no cloud connection. */
export function useHubAutoSync(): void {
  useEffect(() => {
    if (!readHubConfig()) return
    void syncAndReloadIfPulled()

    const onVisibility = () => {
      // Leaving the app pushes pending edits; returning pulls other devices'.
      if (document.visibilityState === 'hidden' && !hasUnsyncedChanges()) return
      void syncAndReloadIfPulled()
    }
    const onOnline = () => void syncAndReloadIfPulled()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && hasUnsyncedChanges()) void syncAndReloadIfPulled()
    }, CHANGE_CHECK_MS)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [])
}
