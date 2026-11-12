import { useEffect, useMemo, useState } from 'preact/hooks';
import { useSyncExternalStore } from 'preact/compat';
import { Ctx, type AppCtx } from './context';
import { getRepo, DEFAULT_SETTINGS } from './data/repo';
import { useRoute, TABS, type Tab } from './router';
import { LiftSync, readHubConfig } from './sync/sync';
import { Icon, clock, useLive, useTick } from './ui/kit';
import { ExerciseDetail, ProgressList } from './features/Progress';
import { HistoryList, WorkoutDetail } from './features/History';
import { Onboarding } from './features/Onboarding';
import { RoutineEditor, RoutineList } from './features/Routines';
import { Settings } from './features/Settings';
import { Today } from './features/Today';
import { Workout } from './features/Workout';

const repo = getRepo();
const sync = new LiftSync(repo);

const TAB_LABEL: Record<Tab, string> = { today: 'Today', history: 'History', progress: 'Progress', routines: 'Routines' };
const TAB_ICON = { today: 'today', history: 'history', progress: 'progress', routines: 'routines' } as const;

function TabBar({ current }: { current: string }) {
  return (
    <nav class="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <a key={t} href={`#/${t}`} aria-current={t === current ? 'page' : undefined}><Icon name={TAB_ICON[t]} class="" />{TAB_LABEL[t]}</a>
      ))}
    </nav>
  );
}

/** Shown on every screen but the workout itself while one is in progress. */
function ResumeBar() {
  const active = useLive(() => repo.activeWorkout());
  const now = useTick();
  if (!active) return null;
  return (
    <a class="floating" href="#/workout" style={{ textDecoration: 'none', color: 'inherit' }} aria-label={`Resume ${active.name}`}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{active.name} in progress</span>
        <span class="muted small">{clock(now - Date.parse(active.startedAt))}</span>
      </span>
      <span class="btn primary small">Resume</span>
    </a>
  );
}

export function App() {
  const route = useRoute();
  const empty = useLive(() => repo.isEmpty());
  const stored = useLive(() => repo.getSettings());
  const status = useSyncExternalStore(sync.subscribe, sync.getStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [firstSyncDone, setFirstSyncDone] = useState(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    void sync.start().then((s) => { stop = s; });
    void navigator.storage?.persist?.().catch(() => undefined);
    return () => stop?.();
  }, []);
  useEffect(() => {
    if (status.state === 'idle' || status.state === 'error' || status.state === 'off') setFirstSyncDone(true);
  }, [status.state]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const ctx: AppCtx = useMemo(() => ({ repo, sync, settings: stored ?? { ...DEFAULT_SETTINGS, updatedAt: '' }, toast: setMessage }), [stored]);

  if (empty === undefined) return null;
  // A fresh install connected to the Hub waits for the first pull before offering setup.
  const restoring = empty && !!readHubConfig() && !firstSyncDone;

  let screen;
  if (empty) screen = <Onboarding restoring={restoring} />;
  else if (route.name === 'workout') screen = <Workout />;
  else if (route.name === 'settings') screen = <Settings />;
  else if (route.name === 'history') screen = route.id ? <WorkoutDetail id={route.id} justFinished={route.query.get('done') === '1'} /> : <HistoryList />;
  else if (route.name === 'progress') screen = route.id ? <ExerciseDetail id={route.id} /> : <ProgressList />;
  else if (route.name === 'routines') screen = route.id ? <RoutineEditor id={route.id} /> : <RoutineList />;
  else screen = <Today />;

  const tab = route.name === 'workout' || route.name === 'settings' ? 'today' : route.name;
  return (
    <Ctx.Provider value={ctx}>
      <div class="app">
        {screen}
        {!empty && <>
          {route.name !== 'workout' && <ResumeBar />}
          <TabBar current={tab} />
        </>}
        {message && <div class="toast" role="status">{message}</div>}
      </div>
    </Ctx.Provider>
  );
}
