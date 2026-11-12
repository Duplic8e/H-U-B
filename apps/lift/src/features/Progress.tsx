import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { exerciseSeries, muscleSets, recordsOf, weeklySeries } from '../data/stats';
import { MUSCLES } from '../data/types';
import { formatVolume, formatWeight, fromKg } from '../data/units';
import { BarChart, LineChart, RankBars } from '../ui/charts';
import { ExerciseDemo, ExerciseGuide, hasDemo } from '../ui/ExerciseDemo';
import { Header, Icon, Segmented, shortDate, useLive } from '../ui/kit';
import { ExercisePicker } from './ExercisePicker';

export function ProgressList() {
  const { repo, settings } = useApp();
  const exercises = useLive(() => repo.listExercises()) ?? [];
  const best = useLive(async () => {
    const out: Record<string, { e1rm: number; sessions: number; last: string }> = {};
    for (const e of await repo.listExercises()) {
      const sessions = await repo.sessionsFor(e.id);
      if (sessions.length) out[e.id] = { e1rm: recordsOf(sessions).bestE1rmKg, sessions: sessions.length, last: sessions[sessions.length - 1]!.workout.finishedAt! };
    }
    return out;
  }) ?? {};
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState<'12' | '26' | '52'>('12');
  const workouts = useLive(() => repo.finishedWorkouts()) ?? [];
  const allSets = useLive(async () => (await repo.db.sets.toArray()).filter((s) => !s.deletedAt && s.done)) ?? [];
  const weeks = weeklySeries(workouts, allSets, Number(range));
  const tick = (week: string, i: number) => (i % Math.ceil(weeks.length / 6) === 0 ? new Date(`${week}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined);
  const muscles = muscleSets(workouts, allSets, exercises, 28);
  const trained = exercises.filter((e) => best[e.id]).sort((a, b) => best[b.id]!.last.localeCompare(best[a.id]!.last));
  const rest = exercises.filter((e) => !best[e.id]);

  return (
    <>
      <Header title="Progress" actions={<button type="button" class="icon-btn" aria-label="New exercise" onClick={() => setAdding(true)}><Icon name="plus" /></button>} />
      <div class="page">
        {trained.length === 0 && <div class="card empty">Records and charts show up once you finish a workout.</div>}
        {workouts.length > 0 && (
          <>
            <div style={{ marginTop: 8 }}>
              <Segmented label="Time range" value={range} options={[{ value: '12', label: '3 months' }, { value: '26', label: '6 months' }, { value: '52', label: '1 year' }]} onChange={setRange} />
            </div>
            <section class="card" aria-label="Workouts per week">
              <div class="card-head"><h2>Workouts per week</h2><span>{workouts.length} in total</span></div>
              <BarChart label="Workouts per week" bars={weeks.map((w, i) => ({ key: w.week, value: w.workouts, tick: tick(w.week, i) }))} />
            </section>
            <section class="card" aria-label="Volume per week">
              <div class="card-head"><h2>Volume per week</h2><span>{settings.unit}</span></div>
              <BarChart label={`Volume per week in ${settings.unit}`} bars={weeks.map((w, i) => ({ key: w.week, value: fromKg(w.volumeKg, settings.unit), tick: tick(w.week, i) }))} format={(n) => Math.round(n).toLocaleString()} />
            </section>
            {muscles.length > 0 && (
              <section class="card" aria-label="Sets per muscle">
                <div class="card-head"><h2>Sets per muscle</h2><span>Last 4 weeks</span></div>
                <RankBars rows={muscles.map((m) => ({ name: m.muscle, value: m.sets }))} unit="sets" />
              </section>
            )}
          </>
        )}
        {trained.length > 0 && <p class="section-label">Trained</p>}
        <ul class="list">
          {trained.map((e) => (
            <li key={e.id}><a class="row" href={`#/progress/${e.id}`}>
              <ExerciseDemo exerciseId={e.id} name={e.name} size="thumb" />
              <span class="row-main"><span class="row-title">{e.name}</span><span class="row-sub">{best[e.id]!.sessions} session{best[e.id]!.sessions === 1 ? '' : 's'} · last {shortDate(best[e.id]!.last)}</span></span>
              <span class="muted">{formatWeight(best[e.id]!.e1rm, settings.unit)} {settings.unit}</span>
              <Icon name="chevron" class="chev" />
            </a></li>
          ))}
        </ul>
        {MUSCLES.map((m) => {
          const list = rest.filter((e) => e.muscle === m);
          if (!list.length) return null;
          return (
            <div key={m}>
              <p class="section-label">{m}</p>
              <ul class="list">{list.map((e) => (
                <li key={e.id}><a class="row" href={`#/progress/${e.id}`}><ExerciseDemo exerciseId={e.id} name={e.name} size="thumb" /><span class="row-main"><span class="row-title">{e.name}</span><span class="row-sub">{e.equipment}</span></span><Icon name="chevron" class="chev" /></a></li>
              ))}</ul>
            </div>
          );
        })}
      </div>
      <ExercisePicker open={adding} onClose={() => setAdding(false)} onPick={(id) => { location.hash = `#/progress/${id}`; }} />
    </>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const { repo, settings } = useApp();
  const unit = settings.unit;
  const exercise = useLive(async () => (await repo.listExercises()).find((e) => e.id === id), [id]);
  const sessions = useLive(() => repo.sessionsFor(id), [id]) ?? [];
  const [metric, setMetric] = useState<'e1rm' | 'top' | 'volume'>('e1rm');
  if (!exercise) return <><Header title="Exercise" back={{ href: '#/progress', label: 'Progress' }} /><div class="page"><p class="empty">Not found.</p></div></>;
  const r = recordsOf(sessions);
  const series = exerciseSeries(sessions);
  const pick = { e1rm: (p: (typeof series)[number]) => p.e1rmKg, top: (p: (typeof series)[number]) => p.topKg, volume: (p: (typeof series)[number]) => p.volumeKg }[metric];
  return (
    <>
      <Header title={exercise.name} back={{ href: '#/progress', label: 'Progress' }} />
      <div class="page">
        <p class="muted" style={{ margin: '0 4px' }}>{exercise.muscle} · {exercise.equipment}</p>
        {hasDemo(id) && (
          <section class="card" aria-label="How to do it">
            <h2 style={{ marginBottom: 10 }}>How to do it</h2>
            <ExerciseGuide exerciseId={id} name={exercise.name} />
          </section>
        )}
        <section class="card" aria-label="Records">
          <h2>Records</h2>
          {sessions.length === 0 ? <p class="muted">No sessions yet.</p> : (
            <div class="stat-grid">
              <div><b>{formatWeight(r.heaviestKg, unit)}</b><span>Heaviest ({unit}) × {r.mostRepsAtHeaviest}</span></div>
              <div><b>{formatWeight(r.bestE1rmKg, unit)}</b><span>Best est. 1RM</span></div>
              <div><b>{formatVolume(r.bestSessionVolumeKg, unit)}</b><span>Best session</span></div>
            </div>
          )}
        </section>
        <section class="card" aria-label="Progress chart">
          <h2>Over time</h2>
          <Segmented label="Chart shows" value={metric} options={[{ value: 'e1rm', label: 'Est. 1RM' }, { value: 'top', label: 'Top weight' }, { value: 'volume', label: 'Volume' }]} onChange={setMetric} />
          <LineChart values={series.map((p) => fromKg(pick(p), unit))} dates={series.map((p) => p.date)} unit={unit} label={metric === 'e1rm' ? 'Estimated one-rep max' : metric === 'top' ? 'Top weight' : 'Session volume'} />
        </section>
        {sessions.length > 0 && <p class="section-label">Sessions</p>}
        <ul class="list">
          {[...sessions].reverse().map(({ workout, sets }) => (
            <li key={workout.id}><a class="row" href={`#/history/${workout.id}`}>
              <span class="row-main"><span class="row-title">{shortDate(workout.finishedAt!)}</span><span class="row-sub">{sets.map((s) => `${formatWeight(s.weightKg, unit)}×${s.reps}`).join(', ')}</span></span>
              <Icon name="chevron" class="chev" />
            </a></li>
          ))}
        </ul>
        <button type="button" class="btn danger block" style={{ marginTop: 24 }} onClick={async () => {
          if (!confirm(`Remove ${exercise.name} from your exercise list? Past workouts keep their sets.`)) return;
          await repo.deleteExercise(id);
          location.hash = '#/progress';
        }}>Remove exercise</button>
      </div>
    </>
  );
}
