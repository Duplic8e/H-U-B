import { useApp } from '../context';
import { nextRoutine } from '../data/rotation';
import { durationMinutes, volume } from '../data/stats';
import type { Routine } from '../data/types';
import { formatVolume } from '../data/units';
import { go } from '../router';
import { HUB_URL } from '../sync/sync';
import { Header, Icon, shortDate, useLive } from '../ui/kit';

function weekStart(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x.toISOString();
}

export function Today() {
  const { repo, settings } = useApp();
  const routines = useLive(() => repo.listRoutines()) ?? [];
  const finished = useLive(() => repo.finishedWorkouts()) ?? [];
  const exercises = useLive(() => repo.listExercises()) ?? [];
  const active = useLive(() => repo.activeWorkout());
  const last = finished[0];
  const lastSets = useLive(async () => (last ? repo.workoutSets(last.id) : []), [last?.id]) ?? [];
  const next = nextRoutine(routines, finished);
  const thisWeek = finished.filter((w) => (w.finishedAt ?? '') >= weekStart()).length;
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercise';

  const start = async (r?: Routine) => {
    await repo.startWorkout(r?.id);
    go('#/workout');
  };

  return (
    <>
      <Header
        title="Today"
        actions={<>
          {HUB_URL && <a class="icon-btn" href={HUB_URL} aria-label="Back to Hub"><Icon name="hub" /></a>}
          <a class="icon-btn" href="#/settings" aria-label="Settings"><Icon name="gear" /></a>
        </>}
      />
      <div class="page">
        <p class="muted" style={{ margin: '0 4px' }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {thisWeek} workout{thisWeek === 1 ? '' : 's'} this week</p>

        {active ? (
          <section class="card">
            <p class="section-label" style={{ margin: '0 0 4px' }}>In progress</p>
            <h2>{active.name}</h2>
            <p class="muted" style={{ marginTop: 0 }}>Started {new Date(active.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
            <a class="btn primary block" href="#/workout">Resume workout</a>
          </section>
        ) : next ? (
          <section class="card" aria-label="Next workout">
            <p class="section-label" style={{ margin: '0 0 4px' }}>Up next</p>
            <h2>{next.name}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 16px' }}>
              {next.items.map((i) => (
                <li key={i.exerciseId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: '0.5px solid var(--separator)' }}>
                  <span>{name(i.exerciseId)}</span>
                  <span class="muted">{i.sets} × {i.repsMin === i.repsMax ? i.repsMin : `${i.repsMin}–${i.repsMax}`}</span>
                </li>
              ))}
            </ul>
            <button type="button" class="btn primary block" onClick={() => void start(next)}>Start {next.name}</button>
          </section>
        ) : (
          <section class="card">
            <h2>No routines yet</h2>
            <p class="muted">Set up your weekly routines, or just start an empty workout.</p>
            <a class="btn block" href="#/routines">Set up routines</a>
          </section>
        )}

        {!active && (
          <>
            {routines.length > 1 && <p class="section-label">Or start another</p>}
            <ul class="list" style={{ marginTop: routines.length > 1 ? 0 : 16 }}>
              {routines.filter((r) => r.id !== next?.id).map((r) => (
                <li key={r.id}><button type="button" class="row" onClick={() => void start(r)}>
                  <span class="row-main"><span class="row-title">{r.name}</span><span class="row-sub">{r.items.length} exercises</span></span>
                  <Icon name="chevron" class="chev" />
                </button></li>
              ))}
              <li><button type="button" class="row" onClick={() => void start()}>
                <span class="row-main"><span class="row-title">Empty workout</span><span class="row-sub">Pick exercises as you go</span></span>
                <Icon name="chevron" class="chev" />
              </button></li>
            </ul>
          </>
        )}

        {last && (
          <>
            <p class="section-label">Last workout</p>
            <a class="list" href={`#/history/${last.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <span class="row">
                <span class="row-main">
                  <span class="row-title">{last.name}</span>
                  <span class="row-sub">{shortDate(last.finishedAt!)} · {durationMinutes(last)} min · {formatVolume(volume(lastSets), settings.unit)}</span>
                </span>
                <Icon name="chevron" class="chev" />
              </span>
            </a>
          </>
        )}
      </div>
    </>
  );
}
