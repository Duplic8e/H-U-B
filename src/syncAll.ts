import type { HubApp } from './apps';

/** What one app reported after syncing. */
export interface SyncResult { ok: boolean; detail: string }

/** Syncs each app in turn (one at a time, since every sync is a commit to the same repo) and
 *  reports each one as it starts and finishes. */
export async function syncAll(
  apps: HubApp[],
  syncOne: (app: HubApp) => Promise<SyncResult>,
  onUpdate: (app: HubApp, state: 'syncing' | SyncResult) => void,
): Promise<Map<string, SyncResult>> {
  const results = new Map<string, SyncResult>();
  for (const app of apps) {
    onUpdate(app, 'syncing');
    let result: SyncResult;
    try { result = await syncOne(app); } catch { result = { ok: false, detail: `Could not sync. Open ${app.name} to sync it.` }; }
    results.set(app.id, result);
    onUpdate(app, result);
  }
  return results;
}

/** Opens an app in a hidden frame with ?hubsync, where it only syncs and posts its result back. */
export function syncInFrame(app: HubApp, base: string, timeoutMs = 60_000): Promise<SyncResult> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.title = `Syncing ${app.name}`;
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.className = 'sync-frame';
    const done = (result: SyncResult) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      frame.remove();
      resolve(result);
    };
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: unknown; app?: unknown; ok?: unknown; detail?: unknown } | null;
      // Only this app's own frame, on this site, is listened to.
      if (e.origin !== location.origin || e.source !== frame.contentWindow || d?.type !== 'hub-sync-result' || d.app !== app.id) return;
      done({ ok: d.ok === true, detail: typeof d.detail === 'string' ? d.detail : '' });
    };
    const timer = setTimeout(() => done({ ok: false, detail: `${app.name} did not answer. Open it to sync.` }), timeoutMs);
    window.addEventListener('message', onMessage);
    frame.src = `${base}${app.id}/?hubsync=1`;
    document.body.appendChild(frame);
  });
}
