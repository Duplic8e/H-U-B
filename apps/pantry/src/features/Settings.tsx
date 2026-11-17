import { useSyncExternalStore } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { catalogMeta, type CatalogMeta } from '../data/catalog';
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

  const [meta, setMeta] = useState<CatalogMeta | null | undefined>();
  useEffect(() => { void catalogMeta().then(setMeta); }, []);

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
          <h2>Product databases</h2>
          <p class="muted" style={{ marginTop: 0 }}>A scanned barcode is looked up in all of these at once. Only the barcode is sent. A product none of them know keeps the name you type, and Pantry remembers it.</p>
          <ul class="muted small" style={{ margin: '0 0 14px', paddingLeft: 18 }}>
            <li>Open Food Facts</li>
            <li>Open Products Facts</li>
            <li>Open Beauty Facts</li>
            <li>Open Pet Food Facts</li>
            <li>USDA FoodData Central (US branded foods)</li>
          </ul>
          <p class="small" style={{ margin: 0 }} role="status">
            {meta === undefined ? 'Checking the built-in copy…'
              : meta ? `Built-in copy: ${meta.products.toLocaleString()} products, updated ${new Date(meta.builtAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Scans still find these when the databases are down.`
                : 'The built-in copy is not available, so scans need the databases to be online.'}
          </p>
        </section>
        <p class="muted small" style={{ textAlign: 'center', marginTop: 24 }}>Pantry {__APP_VERSION__}</p>
      </div>
    </>
  );
}
