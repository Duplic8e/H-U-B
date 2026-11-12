import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { e1rmSeries, recordsOf } from '../data/stats';
import { MUSCLES } from '../data/types';
import { formatVolume, formatWeight, fromKg } from '../data/units';
import { Header, Icon, shortDate, useLive } from '../ui/kit';
import { ExercisePicker } from './ExercisePicker';

function Chart({ points, unit }: { points: Array<{ date: string; kg: number }>; unit: 'kg' | 'lb' }) {
  if (points.length < 2) return <p class="muted small">The chart appears after two sessions.</p>;
  const W = 320, H = 160, P = 24;
  const values = points.map((p) => fromKg(p.kg, unit));
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Estimated one-rep max from ${Math.round(values[0]!)} to ${Math.round(values[values.length - 1]!)} ${unit} over ${points.length} sessions`}>
      <path class="area" d={area} />
      <path class="line" d={line} />
      {values.map((v, i) => <circle key={i} class="dot" cx={x(i)} cy={y(v)} r={3} />)}
      <text x={P} y={14}>{Math.round(max)} {unit}</text>
      <text x={P} y={H - 6}>{shortDate(points[0]!.date)}</text>
      <text x={W - P} y={H - 6} text-anchor="end">{shortDate(points[points.length - 1]!.date)}</text>
    </svg>
  );
}

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
  const trained = exercises.filter((e) => best[e.id]).sort((a, b) => best[b.id]!.last.localeCompare(best[a.id]!.last));
  const rest = exercises.filter((e) => !best[e.id]);

  return (
    <>
      <Header title="Progress" actions={<button type="button" class="icon-btn" aria-label="New exercise" onClick={() => setAdding(true)}><Icon name="plus" /></button>} />
      <div class="page">
        {trained.length === 0 && <div class="card empty">Records and charts show up once you finish a workout.</div>}
        {trained.length > 0 && <p class="section-label">Trained</p>}
        <ul class="list">
          {trained.map((e) => (
            <li key={e.id}><a class="row" href={`#/progress/${e.id}`}>
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
                <li key={e.id}><a class="row" href={`#/progress/${e.id}`}><span class="row-main"><span class="row-title">{e.name}</span><span class="row-sub">{e.equipment}</span></span><Icon name="chevron" class="chev" /></a></li>
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
  if (!exercise) return <><Header title="Exercise" back={{ href: '#/progress', label: 'Progress' }} /><div class="page"><p class="empty">Not found.</p></div></>;
  const r = recordsOf(sessions);
  return (
    <>
      <Header title={exercise.name} back={{ href: '#/progress', label: 'Progress' }} />
      <div class="page">
        <p class="muted" style={{ margin: '0 4px' }}>{exercise.muscle} · {exercise.equipment}</p>
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
          <h2>Estimated 1RM</h2>
          <Chart points={e1rmSeries(sessions)} unit={unit} />
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
