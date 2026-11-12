import { useApp } from '../context';
import { nextRoutine } from '../data/rotation';
import { daysTrainedThisWeek, durationMinutes, volume, weekKey, weekStreak } from '../data/stats';
import type { Routine } from '../data/types';
import { formatVolume } from '../data/units';
import { go } from '../router';
import { HUB_URL } from '../sync/sync';
import { ExerciseDemo } from '../ui/ExerciseDemo';
import { Header, Icon, clock, shortDate, useLive, useTick } from '../ui/kit';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function Today() {
  const { repo, settings } = useApp();
  const routines = useLive(() => repo.listRoutines()) ?? [];
  const finished = useLive(() => repo.finishedWorkouts()) ?? [];
  const exercises = useLive(() => repo.listExercises()) ?? [];
  const active = useLive(() => repo.activeWorkout());
  const sets = useLive(async () => (await repo.db.sets.toArray()).filter((s) => !s.deletedAt && s.done)) ?? [];
  const now = useTick(active ? 1000 : 60_000);
  const last = finished[0];
  const next = nextRoutine(routines, finished);
  const trained = daysTrainedThisWeek(finished);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const week = weekKey(new Date());
  const weekIds = new Set(finished.filter((w) => weekKey(new Date(w.finishedAt!)) === week).map((w) => w.id));
  const weekVolume = volume(sets.filter((s) => weekIds.has(s.workoutId)));
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
        <p class="muted" style={{ margin: '0 4px' }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>

        {active ? (
          <section class="hero-card" aria-label="Workout in progress">
            <p class="eyebrow">In progress · {clock(now - Date.parse(active.startedAt))}</p>
            <h2>{active.name}</h2>
            <p>Pick up where you left off.</p>
            <a class="btn block" href="#/workout">Resume workout</a>
          </section>
        ) : next ? (
          <section class="hero-card" aria-label="Next workout">
            <p class="eyebrow">Up next</p>
            <h2>{next.name}</h2>
            <p>{next.items.length} exercises · {next.items.reduce((n, i) => n + i.sets, 0)} sets</p>
            <div class="hero-thumbs" aria-hidden="true">
              {next.items.slice(0, 5).map((i) => <ExerciseDemo key={i.exerciseId} exerciseId={i.exerciseId} name={name(i.exerciseId)} size="thumb" />)}
              {next.items.length > 5 && <span class="hero-more">+{next.items.length - 5}</span>}
            </div>
            <button type="button" class="btn block" onClick={() => void start(next)}>Start {next.name}</button>
          </section>
        ) : (
          <section class="card">
            <h2>No routines yet</h2>
            <p class="muted">Set up your weekly routines, or just start an empty workout.</p>
            <a class="btn block" href="#/routines">Set up routines</a>
          </section>
        )}

        <div class="week" role="img" aria-label={`${trained.filter(Boolean).length} workout days this week`}>
          {DAYS.map((d, i) => (
            <div key={i} class={`${trained[i] ? 'on' : ''} ${i === todayIndex ? 'today' : ''}`}>
              {d}<i><Icon name="check" class="" /></i>
            </div>
          ))}
        </div>
        <div class="tiles">
          <div class="tile"><b>{weekIds.size}</b><span>This week</span></div>
          <div class="tile"><b>{weekStreak(finished)}</b><span>Week streak</span></div>
          <div class="tile"><b>{formatVolume(weekVolume, settings.unit).replace(` ${settings.unit}`, '')}</b><span>{settings.unit} lifted</span></div>
        </div>

        {next && !active && (
          <>
            <p class="section-label">In {next.name}</p>
            <ul class="list">
              {next.items.map((i) => (
                <li key={i.exerciseId}><a class="row" href={`#/progress/${i.exerciseId}`}>
                  <ExerciseDemo exerciseId={i.exerciseId} name={name(i.exerciseId)} size="thumb" />
                  <span class="row-main"><span class="row-title">{name(i.exerciseId)}</span><span class="row-sub">{i.sets} × {i.repsMin === i.repsMax ? i.repsMin : `${i.repsMin}–${i.repsMax}`}</span></span>
                  <Icon name="chevron" class="chev" />
                </a></li>
              ))}
            </ul>
          </>
        )}

        {!active && (
          <>
            <p class="section-label">Or start another</p>
            <ul class="list">
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
                  <span class="row-sub">{shortDate(last.finishedAt!)} · {durationMinutes(last)} min · {formatVolume(volume(sets.filter((s) => s.workoutId === last.id)), settings.unit)}</span>
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
