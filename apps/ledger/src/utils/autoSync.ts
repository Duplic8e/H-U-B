import { STORAGE_KEYS } from '../store/storageKeys'
import type { PullDecision, PushDecision } from './syncDecision'

export const AUTO_SYNC_KEY = STORAGE_KEYS.autoSync

export function isAutoSyncEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(AUTO_SYNC_KEY) === 'on'
}

export function setAutoSyncEnabled(on: boolean): void {
  if (typeof localStorage === 'undefined') return
  if (on) localStorage.setItem(AUTO_SYNC_KEY, 'on')
  else localStorage.removeItem(AUTO_SYNC_KEY)
}

export type AutoSyncAction = 'skip' | 'push' | 'pull' | 'needs-user'

/** Automatic syncing acts only where the decision layer is unambiguous.
 *  Anything that could overwrite work someone did on another device is handed
 *  back to the manual flow, which already has the conflict UI. Pulling wins
 *  over pushing so this device is current before it publishes anything. */
export function autoSyncAction(input: {
  enabled: boolean
  connected: boolean
  push: PushDecision
  pull: PullDecision
}): AutoSyncAction {
  if (!input.enabled || !input.connected) return 'skip'

  if (input.pull.kind === 'would-lose-local' || input.pull.kind === 'collision') return 'needs-user'
  if (input.push.kind === 'diverged') return 'needs-user'

  if (input.pull.kind === 'clean') return 'pull'
  if (input.push.kind === 'clean') return 'push'
  return 'skip'
}
