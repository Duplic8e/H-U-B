import { useEffect, useMemo, useState } from 'preact/hooks';
import { Ctx, type AppCtx } from './context';
import { DEFAULT_SETTINGS, getRepo, toWords } from './data/repo';
import { TABS, useRoute, type Tab } from './router';
import { FrenchSync } from './sync/sync';
import { Icon, useLive } from './ui/kit';
import { Add } from './features/Add';
import { Settings } from './features/Settings';
import { Study } from './features/Study';
import { Today } from './features/Today';
import { Words } from './features/Words';

const repo = getRepo();
const sync = new FrenchSync(repo);
type Bank = Array<[string, string, string, string, string]>;

const TAB_LABEL: Record<Tab, string> = { today: 'Today', words: 'Words', add: 'Add' };
const TAB_ICON = { today: 'cards', words: 'routines', add: 'plus' } as const;

export function App() {
  const route = useRoute();
  const [bank, setBank] = useState<Bank | null>(null);
  const [failed, setFailed] = useState(false);
  const stored = useLive(() => repo.getSettings());
  const cards = useLive(() => repo.cardMap());
  const custom = useLive(() => repo.listCustom());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}words.json`).then((r) => r.json()).then((d: { words: Bank }) => setBank(d.words)).catch(() => setFailed(true));
    let stop: (() => void) | undefined;
    void sync.start().then((s) => { stop = s; });
    void navigator.storage?.persist?.().catch(() => undefined);
    return () => stop?.();
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const words = useMemo(() => (bank ? toWords(bank, custom ?? []) : []), [bank, custom]);
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const ctx: AppCtx | null = useMemo(
    () => (bank && cards ? { repo, sync, settings: stored ?? { ...DEFAULT_SETTINGS, updatedAt: '' }, words, byId, cards, toast: setMessage } : null),
    [bank, cards, stored, words, byId],
  );

  if (failed) return <div class="page"><p class="empty" style={{ marginTop: '40vh' }}>Could not load the word list. Check your connection and reopen the app.</p></div>;
  if (!ctx) return <div class="page"><p class="empty" style={{ marginTop: '40vh' }}>Loading…</p></div>;

  const tab = route.name === 'study' || route.name === 'settings' ? 'today' : route.name;
  return (
    <Ctx.Provider value={ctx}>
      <div class="app">
        {route.name === 'study' ? <Study extra={route.query.get('extra') === '1'} />
          : route.name === 'settings' ? <Settings />
          : route.name === 'words' ? <Words />
          : route.name === 'add' ? <Add />
          : <Today />}
        {route.name !== 'study' && (
          <nav class="tabbar" aria-label="Main">
            {TABS.map((t) => <a key={t} href={`#/${t}`} aria-current={t === tab ? 'page' : undefined}><Icon name={TAB_ICON[t]} class="" />{TAB_LABEL[t]}</a>)}
          </nav>
        )}
        {message && <div class="toast" role="status">{message}</div>}
      </div>
    </Ctx.Provider>
  );
}
