import { useSyncExternalStore } from 'preact/compat';
import { useApp } from '../context';
import type { Unit } from '../data/types';
import { HUB_URL } from '../sync/sync';
import { Header, NumField, Segmented } from '../ui/kit';

function when(iso?: string) {
  if (!iso) return 'not yet';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function Settings() {
  const { repo, sync, settings, toast } = useApp();
  const status = useSyncExternalStore(sync.subscribe, sync.getStatus);

  const exportBackup = async () => {
    const blob = new Blob([JSON.stringify({ app: 'lift', version: 1, exportedAt: new Date().toISOString(), ...(await repo.dumpAll()) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lift-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <>
      <Header title="Settings" back={{ href: '#/today', label: 'Today' }} />
      <div class="page">
        <section class="card">
          <h2>Units</h2>
          <p class="muted small" style={{ marginTop: 0 }}>Everything already logged converts; nothing is lost switching back and forth.</p>
          <Segmented<Unit> label="Weight unit" value={settings.unit} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} onChange={(unit) => void repo.setUnit(unit)} />
          <label class="field" style={{ marginTop: 16, marginBottom: 0 }}><span>Rest for extra exercises (seconds)</span>
            <NumField class="input" label="Default rest in seconds" decimals={0} value={settings.defaultRestSec} onCommit={(n) => void repo.updateSettings({ defaultRestSec: Math.max(0, Math.round(n)) })} />
          </label>
          <p class="muted small" style={{ marginBottom: 0 }}>Routine exercises use the rest set in the routine.</p>
        </section>

        <section class="card">
          <h2>Cloud backup</h2>
          {status.state === 'off' ? (
            <>
              <p class="muted" style={{ marginTop: 0 }}>Connect your private data repo in the Hub, and Lift backs itself up there automatically.</p>
              {HUB_URL && <a class="btn block" href={`${HUB_URL}#settings`}>Open Hub settings</a>}
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }} role="status">
                {status.state === 'syncing' ? 'Syncing…' : status.state === 'pending' ? 'Changes waiting to sync' : status.state === 'error' ? status.message : `Backed up ${when(status.lastSyncedAt)}`}
              </p>
              <p class="muted small">Managed by the Hub. Saved as lift/data.json in your data repo.</p>
              <button type="button" class="btn block" onClick={() => void sync.syncNow()}>Sync now</button>
            </>
          )}
        </section>

        <section class="card">
          <h2>Backup file</h2>
          <p class="muted" style={{ marginTop: 0 }}>A copy of everything as one file, for safekeeping.</p>
          <button type="button" class="btn block" onClick={() => { void exportBackup(); toast('Backup saved'); }}>Export backup</button>
        </section>
        <p class="muted small" style={{ textAlign: 'center', marginTop: 24 }}>Lift {__APP_VERSION__}</p>
      </div>
    </>
  );
}
