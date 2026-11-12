import { useSyncExternalStore } from 'preact/compat';
import { useApp } from '../context';
import { HUB_URL } from '../sync/sync';
import { Header, NumField, Segmented } from '../ui/kit';

export function Settings() {
  const { repo, sync, settings } = useApp();
  const status = useSyncExternalStore(sync.subscribe, sync.getStatus);
  return (
    <>
      <Header title="Settings" back={{ href: '#/today', label: 'French' }} />
      <div class="page">
        <section class="card">
          <h2>Study</h2>
          <label class="field"><span>New words per day</span>
            <NumField class="input" label="New words per day" decimals={0} value={settings.newPerDay} onCommit={(n) => void repo.updateSettings({ newPerDay: Math.min(100, Math.max(0, Math.round(n))) })} />
          </label>
          <p class="muted small" style={{ marginTop: -6 }}>Each new word adds reviews on later days. 10 to 20 a day is sustainable; reviews are never limited.</p>
          <p class="section-label" style={{ margin: '12px 0 6px' }}>Show first</p>
          <Segmented label="Show first" value={settings.direction} options={[{ value: 'fr-en', label: 'French' }, { value: 'en-fr', label: 'English' }]} onChange={(direction) => void repo.updateSettings({ direction })} />
          <p class="muted small">French first trains understanding. English first trains recall, which is harder.</p>
          <p class="section-label" style={{ margin: '12px 0 6px' }}>Read French aloud</p>
          <Segmented label="Read French aloud" value={settings.autoSpeak ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => void repo.updateSettings({ autoSpeak: v === 'on' })} />
        </section>
        <section class="card">
          <h2>Cloud backup</h2>
          {status.state === 'off' ? (
            <>
              <p class="muted" style={{ marginTop: 0 }}>Connect your private data repo in the Hub, and your progress backs itself up there.</p>
              {HUB_URL && <a class="btn block" href={`${HUB_URL}#settings`}>Open Hub settings</a>}
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }} role="status">{status.state === 'syncing' ? 'Syncing…' : status.state === 'pending' ? 'Changes waiting to sync' : status.state === 'error' ? status.message : 'Backed up'}</p>
              <p class="muted small">Managed by the Hub. Saved as french/data.json in your data repo.</p>
              <button type="button" class="btn block" onClick={() => void sync.syncNow()}>Sync now</button>
            </>
          )}
        </section>
        <section class="card">
          <h2>About the words</h2>
          <p class="muted small" style={{ margin: 0 }}>Translations come from the FreeDict French–English dictionary (GPL 2 or later), ordered by how common each word is using the FrequencyWords list built from film and TV subtitles (CC BY-SA 4.0). Some entries are rough: use “I already know this word” to skip any you do not want.</p>
        </section>
        <p class="muted small" style={{ textAlign: 'center', marginTop: 24 }}>French {__APP_VERSION__}</p>
      </div>
    </>
  );
}
