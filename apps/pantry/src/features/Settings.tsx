import { useSyncExternalStore } from 'preact/compat';
import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { SOURCES, USDA_KEY_STORAGE } from '../data/lookup';
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

  const [key, setKey] = useState(() => { try { return localStorage.getItem(USDA_KEY_STORAGE) ?? ''; } catch { return ''; } });
  const saveKey = (value: string) => {
    setKey(value);
    try { if (value.trim()) localStorage.setItem(USDA_KEY_STORAGE, value.trim()); else localStorage.removeItem(USDA_KEY_STORAGE); } catch { /* private mode: the key lasts for this visit only */ }
  };

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
            {SOURCES.map((source) => <li key={source.name}>{source.name}</li>)}
          </ul>
          <label class="field" style={{ marginBottom: 0 }}><span>USDA key (optional)</span>
            <input class="input" value={key} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck={false} placeholder="Using the shared demo key" onInput={(e) => saveKey(e.currentTarget.value)} />
          </label>
          <p class="muted small" style={{ marginBottom: 0 }}>The shared demo key allows only a few USDA lookups an hour. A free key of your own from <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">fdc.nal.usda.gov</a> allows 1,000. It stays on this phone.</p>
        </section>
        <p class="muted small" style={{ textAlign: 'center', marginTop: 24 }}>Pantry {__APP_VERSION__}</p>
      </div>
    </>
  );
}
