import { useSyncExternalStore } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { catalogMeta, type CatalogMeta } from '../data/catalog';
import { clearGeminiKey, GeminiError, getGeminiKey, setGeminiKey, testGeminiKey } from '../ai/gemini';
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
  const [geminiKey, setKey] = useState(getGeminiKey);
  const [typed, setTyped] = useState('');
  const [checking, setChecking] = useState(false);
  const [keyError, setKeyError] = useState<string>();
  const saveKey = async (e: Event) => {
    e.preventDefault();
    const key = typed.trim();
    if (!key) return;
    setChecking(true);
    setKeyError(undefined);
    try {
      await testGeminiKey(key);
      setGeminiKey(key);
      setKey(key);
      setTyped('');
      toast({ message: 'Gemini key saved on this phone' });
    } catch (err) {
      setKeyError(err instanceof GeminiError ? err.message : 'Could not check the key.');
    } finally {
      setChecking(false);
    }
  };
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
          <h2>Recipe ideas (Gemini)</h2>
          {geminiKey ? (
            <>
              <p style={{ marginTop: 0 }} role="status">Key saved on this phone (ends in …{geminiKey.slice(-4)}).</p>
              <button type="button" class="btn danger block" onClick={() => { clearGeminiKey(); setKey(null); toast({ message: 'Gemini key removed from this phone' }); }}>Remove key</button>
            </>
          ) : (
            <form onSubmit={(e) => void saveKey(e)}>
              <p class="muted" style={{ marginTop: 0 }}>Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com</a> (sign in with Google, then "Create API key"), and paste it here.</p>
              <div class="key-row">
                <input class="input" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck={false} aria-label="Gemini API key" placeholder="Paste your key" value={typed} onInput={(e) => setTyped(e.currentTarget.value)} />
                <button type="submit" class="btn primary small" style={{ minHeight: 44 }} disabled={!typed.trim() || checking}>{checking ? 'Checking…' : 'Save'}</button>
              </div>
              {keyError && <p class="note" role="alert" style={{ margin: '12px 0 0' }}>{keyError}</p>}
            </form>
          )}
          <p class="muted small" style={{ marginBottom: 0 }}>The key stays on this phone only: it is not backed up, synced or exported, and is sent only to Google when you ask for recipes. Recipe requests send your pantry's product names, counts and expiry dates; Google may use free-tier requests to improve its products.</p>
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
