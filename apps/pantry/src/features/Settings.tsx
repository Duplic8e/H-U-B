import { useSyncExternalStore } from 'preact/compat';
import { useApp } from '../context';
import { HUB_URL } from '../sync/sync';
import { Header } from '../ui/kit';

function when(iso?: string) {
  if (!iso) return 'not yet';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function Settings() {
  const { repo, sync, toast } = useApp();
  const status = useSyncExternalStore(sync.subscribe, sync.getStatus);

  const exportBackup = async () => {
    const blob = new Blob([JSON.stringify({ app: 'pantry', version: 1, exportedAt: new Date().toISOString(), ...(await repo.dumpAll()) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pantry-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <>
      <Header title="Settings" back={{ href: '#/', label: 'Pantry' }} />
      <div class="page">
        <section class="card">
          <h2>Cloud backup</h2>
          {status.state === 'off' ? (
            <>
              <p class="muted" style={{ marginTop: 0 }}>Connect your private data repo in the Hub, and Pantry backs itself up there automatically.</p>
              {HUB_URL && <a class="btn block" href={`${HUB_URL}#settings`}>Open Hub settings</a>}
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }} role="status">
                {status.state === 'syncing' ? 'Syncing…' : status.state === 'pending' ? 'Changes waiting to sync' : status.state === 'error' ? status.message : `Backed up ${when(status.lastSyncedAt)}`}
              </p>
              <p class="muted small">Managed by the Hub. Saved as pantry/data.json in your data repo.</p>
              <button type="button" class="btn block" onClick={() => void sync.syncNow()}>Sync now</button>
            </>
          )}
        </section>

        <section class="card">
          <h2>Backup file</h2>
          <p class="muted" style={{ marginTop: 0 }}>A copy of everything as one file, for safekeeping.</p>
          <button type="button" class="btn block" onClick={() => { void exportBackup(); toast({ message: 'Backup saved' }); }}>Export backup</button>
        </section>
        <section class="card">
          <h2>Product details</h2>
          <p class="muted" style={{ margin: 0 }}>Names and photos come from <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>, a free, open database. Only the barcode is sent. A product it does not know keeps the name you type.</p>
        </section>
        <p class="muted small" style={{ textAlign: 'center', marginTop: 24 }}>Pantry {__APP_VERSION__}</p>
      </div>
    </>
  );
}
