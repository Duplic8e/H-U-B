import { useApp } from '../context';
import { durationMinutes, newRecords, volume, type RecordKind, type Session } from '../data/stats';
import type { SetEntry } from '../data/types';
import { formatVolume, formatWeight } from '../data/units';
import { go } from '../router';
import { Header, Icon, shortDate, useLive } from '../ui/kit';

const RECORD_LABEL: Record<RecordKind, string> = { heaviest: 'Heaviest', e1rm: 'Best est. 1RM', volume: 'Most volume' };

export function HistoryList() {
  const { repo, settings } = useApp();
  const workouts = useLive(() => repo.finishedWorkouts()) ?? [];
  const sets = useLive(async () => (await repo.db.sets.toArray()).filter((s) => !s.deletedAt && s.done)) ?? [];
  const byMonth = new Map<string, typeof workouts>();
  for (const w of workouts) {
    const key = new Date(w.finishedAt!).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    byMonth.set(key, [...(byMonth.get(key) ?? []), w]);
  }
  return (
    <>
      <Header title="History" />
      <div class="page">
        {workouts.length === 0 && <div class="card empty">Finished workouts show up here.</div>}
        {[...byMonth].map(([month, list]) => (
          <div key={month}>
            <p class="section-label">{month} · {list.length} workout{list.length === 1 ? '' : 's'}</p>
            <ul class="list">
              {list.map((w) => {
                const own = sets.filter((s) => s.workoutId === w.id);
                return (
                  <li key={w.id}><a class="row" href={`#/history/${w.id}`}>
                    <span class="row-main">
                      <span class="row-title">{w.name}</span>
                      <span class="row-sub">{shortDate(w.finishedAt!)} · {durationMinutes(w)} min · {own.length} sets · {formatVolume(volume(own), settings.unit)}</span>
                    </span>
                    <Icon name="chevron" class="chev" />
                  </a></li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

/** One finished workout. Right after finishing (?done=1) it leads with a summary and any records. */
export function WorkoutDetail({ id, justFinished }: { id: string; justFinished: boolean }) {
  const { repo, settings, toast } = useApp();
  const unit = settings.unit;
  const workout = useLive(() => repo.getWorkout(id), [id]);
  const sets = useLive(() => repo.workoutSets(id), [id]) ?? [];
  // Including removed exercises, so an old workout still names them.
  const exercises = useLive(() => repo.db.exercises.toArray()) ?? [];
  const records = useLive(async () => {
    const out: Record<string, RecordKind[]> = {};
    const w = await repo.getWorkout(id);
    if (!w) return out;
    for (const exId of w.exerciseIds) {
      const sessions = await repo.sessionsFor(exId);
      const i = sessions.findIndex((s) => s.workout.id === id);
      if (i >= 0) out[exId] = newRecords(sessions.slice(0, i), sessions[i] as Session);
    }
    return out;
  }, [id]) ?? {};

  if (workout === undefined) return <><Header title="Workout" back={{ href: '#/history', label: 'History' }} /><div class="page"><p class="empty">Not found.</p></div></>;
  const prCount = Object.values(records).reduce((n, r) => n + (r.length ? 1 : 0), 0);
  const name = (exId: string) => exercises.find((e) => e.id === exId)?.name ?? 'Exercise';
  const byExercise = (exId: string): SetEntry[] => sets.filter((s) => s.exerciseId === exId);

  return (
    <>
      <Header title={justFinished ? 'Nice work' : workout.name} back={{ href: justFinished ? '#/today' : '#/history', label: justFinished ? 'Today' : 'History' }} />
      <div class="page">
        <section class="card">
          {justFinished && <h2>{workout.name} done</h2>}
          <p class="muted" style={{ marginTop: 0 }}>{shortDate(workout.finishedAt!)}</p>
          <div class="stat-grid">
            <div><b>{durationMinutes(workout)} min</b><span>Duration</span></div>
            <div><b>{sets.length}</b><span>Sets</span></div>
            <div><b>{formatVolume(volume(sets), unit)}</b><span>Volume</span></div>
          </div>
          {prCount > 0 && <p style={{ margin: '12px 0 0' }}><span class="badge">🏆 {prCount} new record{prCount === 1 ? '' : 's'}</span></p>}
          {workout.notes && <p style={{ marginBottom: 0 }}>{workout.notes}</p>}
        </section>
        {workout.exerciseIds.map((exId) => (
          <section key={exId} class="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <a href={`#/progress/${exId}`} style={{ color: 'inherit', textDecoration: 'none', flex: 1 }}><h2 style={{ margin: 0 }}>{name(exId)}</h2></a>
              {(records[exId] ?? []).map((r) => <span key={r} class="badge">{RECORD_LABEL[r]}</span>)}
            </div>
            <ol style={{ margin: '8px 0 0', paddingLeft: 22 }}>
              {byExercise(exId).map((s) => <li key={s.id} style={{ padding: '3px 0' }}>{formatWeight(s.weightKg, unit)} {unit} × {s.reps}</li>)}
            </ol>
          </section>
        ))}
        {!justFinished && (
          <button type="button" class="btn danger block" style={{ marginTop: 24 }} onClick={async () => {
            if (!confirm('Delete this workout? Its sets and records go with it.')) return;
            await repo.discardWorkout(id);
            toast('Workout deleted');
            go('#/history');
          }}>Delete workout</button>
        )}
      </div>
    </>
  );
}
