import { useState } from 'preact/hooks';
import { getSync, useSyncStatus } from '../../sync';
import { HUB_URL } from '../../sync/hub';
import { SyncForm } from './SyncForm';

export function SyncSection() {
  const { configured, description } = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const sync = getSync();
  const config = sync.getConfig();
  const hubManaged = sync.isHubManaged();

  if (!configured || !description) {
    return (
      <section class="card" id="cloud-sync">
        <h2 class="section-title">Cloud sync</h2>
        <p class="muted">
          Keeps your data in a private GitHub repository you own, so losing the phone loses nothing. Create a private repo
          (for example <strong>torque-data</strong>) with a README, then a fine-grained token limited to that one repo with
          “Contents: read and write”. Keep the token in your password manager; you need it to restore on a new phone.
        </p>
        <SyncForm mode="settings" />
      </section>
    );
  }

  return (
    <section class="card" id="cloud-sync">
      <h2 class="section-title">Cloud sync</h2>
      <p class={`sync-line sync-${description.tone}`}><span class="sync-dot" aria-hidden="true" /> {description.label}</p>
      <p class="muted">Repository: {config?.owner}/{config?.repo}</p>
      {hubManaged && <p class="muted">Managed by the Hub. Change the repository or token in the Hub settings.</p>}
      {description.needsFix && (
        <p class="muted">{hubManaged ? 'Update the token in the Hub settings to fix this.' : 'Disconnect, then connect again with a new token to fix this.'}</p>
      )}
      <div class="row">
        <button type="button" class="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await sync.syncNow(); } finally { setBusy(false); } }}>Sync now</button>
        {hubManaged ? (
          HUB_URL && <a class="btn btn-secondary" href={`${HUB_URL}#settings`}>Hub settings</a>
        ) : (
          <button type="button" class="btn btn-secondary btn-danger" onClick={() => { if (window.confirm('Disconnect cloud sync? Your data stays on this phone and in the repository.')) void sync.disconnect(); }}>Disconnect</button>
        )}
      </div>
    </section>
  );
}
