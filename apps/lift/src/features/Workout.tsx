import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { suggestedWeightKg } from '../data/stats';
import type { Exercise, RoutineItem, SetEntry, Workout as WorkoutRow } from '../data/types';
import { formatWeight, fromKg, toKg } from '../data/units';
import { go } from '../router';
import { Header, Icon, NumField, Sheet, clock, useLive, useTick } from '../ui/kit';
import { addRest, startRest, stopRest, useRest } from '../ui/restTimer';
import { ExercisePicker } from './ExercisePicker';

function ExerciseCard({ workout, exercise, sets, item }: { workout: WorkoutRow; exercise: Exercise; sets: SetEntry[]; item?: RoutineItem }) {
  const { repo, settings } = useApp();
  const unit = settings.unit;
  const last = useLive(() => repo.lastSession(exercise.id, workout.id), [exercise.id, workout.id]) ?? [];
  const suggestion = suggestedWeightKg(last, item, unit);
  const working = Math.max(0, ...sets.map((s) => s.weightKg));
  const showSuggestion = suggestion !== null && working < suggestion - 1e-6;
  const [menu, setMenu] = useState(false);

  const tick = async (s: SetEntry) => {
    const done = !s.done;
    await repo.updateSet(s.id, { done });
    if (done) startRest(item?.restSec ?? settings.defaultRestSec);
  };

  return (
    <section class="exercise-card" aria-label={exercise.name}>
      <div class="exercise-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{exercise.name}</h3>
          <p class="muted small" style={{ margin: '2px 0 0' }}>
            {item ? `${item.sets} × ${item.repsMin === item.repsMax ? item.repsMin : `${item.repsMin}–${item.repsMax}`}` : 'Extra'}
            {last.length > 0 && ` · Last: ${last.map((s) => `${formatWeight(s.weightKg, unit)}×${s.reps}`).join(', ')}`}
          </p>
        </div>
        <button type="button" class="icon-btn" aria-label={`${exercise.name} options`} onClick={() => setMenu(true)} style={{ color: 'var(--muted)' }}>⋯</button>
      </div>
      {showSuggestion && (
        <div style={{ padding: '8px 4px 0' }}>
          <button type="button" class="chip" onClick={async () => { for (const s of sets.filter((x) => !x.done)) await repo.updateSet(s.id, { weightKg: suggestion! }); }}>
            <Icon name="up" class="ico" /> You hit every rep last time. Try {formatWeight(suggestion!, unit)} {unit}
          </button>
        </div>
      )}
      <table class="sets">
        <thead><tr><th>Set</th><th>{unit}</th><th>Reps</th><th><span class="sr-only">Done</span></th><th /></tr></thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id} class={s.done ? 'done' : ''}>
              <td class="set-no">{s.setNo}</td>
              <td><NumField label={`Set ${s.setNo} weight in ${unit}`} value={fromKg(s.weightKg, unit)} onCommit={(n) => void repo.updateSet(s.id, { weightKg: toKg(n, unit) })} /></td>
              <td><NumField label={`Set ${s.setNo} reps`} value={s.reps} decimals={0} onCommit={(n) => void repo.updateSet(s.id, { reps: Math.round(n) })} /></td>
              <td style={{ width: 52 }}>
                <button type="button" class="tick" aria-pressed={s.done} aria-label={`Set ${s.setNo} done`} onClick={() => void tick(s)}><Icon name="check" class="" /></button>
              </td>
              <td style={{ width: 32 }}><button type="button" class="del" aria-label={`Remove set ${s.setNo}`} onClick={() => void repo.removeSet(s.id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" class="link-btn" style={{ padding: '0 4px' }} onClick={() => void repo.addSet(workout.id, exercise.id)}><Icon name="plus" /> Add set</button>
      <Sheet open={menu} title={exercise.name} onClose={() => setMenu(false)}>
        <button type="button" class="btn danger block" onClick={() => { setMenu(false); void repo.removeExercise(workout.id, exercise.id); }}>Remove from this workout</button>
      </Sheet>
    </section>
  );
}

function RestBar() {
  const rest = useRest();
  if (!rest) return null;
  const left = Math.max(0, rest.endsAt - Date.now());
  return (
    <div class="floating" role="timer" aria-label="Rest timer">
      <span class="time">{clock(left)}</span>
      <div class="timer-track" aria-hidden="true"><div style={{ width: `${(left / (rest.total * 1000)) * 100}%` }} /></div>
      <button type="button" class="btn small" onClick={() => addRest(15)}>+15s</button>
      <button type="button" class="btn small" onClick={stopRest}>Skip</button>
    </div>
  );
}

/** The workout in progress: one card per exercise with last time's numbers filled in, a tick per set that starts the rest timer. */
export function Workout() {
  const { repo, toast } = useApp();
  const workout = useLive(() => repo.activeWorkout());
  const sets = useLive(async () => (workout ? repo.workoutSets(workout.id) : []), [workout?.id]) ?? [];
  const exercises = useLive(() => repo.listExercises()) ?? [];
  const routine = useLive(async () => (workout?.routineId ? (await repo.listRoutines()).find((r) => r.id === workout.routineId) : undefined), [workout?.routineId]);
  const now = useTick();
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState('');

  if (workout === undefined) {
    return (
      <>
        <Header title="Workout" back={{ href: '#/today', label: 'Today' }} />
        <div class="page"><div class="empty">No workout in progress.<p><a class="btn primary" href="#/today">Start one</a></p></div></div>
      </>
    );
  }

  const doneCount = sets.filter((s) => s.done).length;
  const finish = async () => {
    stopRest();
    const kept = await repo.finishWorkout(workout.id, notes);
    setFinishing(false);
    if (kept) go(`#/history/${workout.id}?done=1`);
    else { toast('Nothing was ticked, so the workout was discarded.'); go('#/today'); }
  };

  return (
    <>
      <Header
        title={workout.name}
        back={{ href: '#/today', label: 'Today' }}
        actions={<button type="button" class="btn primary small" onClick={() => setFinishing(true)}>Finish</button>}
      />
      {/* Extra room at the bottom so the rest timer never covers the last set. */}
      <div class="page" style={{ paddingBottom: 96 }}>
        <p class="muted" style={{ margin: '0 4px' }}>{clock(now - Date.parse(workout.startedAt))} · {doneCount} set{doneCount === 1 ? '' : 's'} done</p>
        {workout.exerciseIds.map((id) => {
          const ex = exercises.find((e) => e.id === id);
          if (!ex) return null;
          return <ExerciseCard key={id} workout={workout} exercise={ex} sets={sets.filter((s) => s.exerciseId === id)} item={routine?.items.find((i) => i.exerciseId === id)} />;
        })}
        {workout.exerciseIds.length === 0 && <div class="card empty">Add an exercise to begin.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <button type="button" class="btn block" onClick={() => setPicking(true)}><Icon name="plus" /> Add exercise</button>
          <button type="button" class="btn danger block" onClick={async () => { if (confirm('Discard this workout? Nothing from it is saved.')) { stopRest(); await repo.discardWorkout(workout.id); go('#/today'); } }}>Discard workout</button>
        </div>
      </div>
      <RestBar />
      <ExercisePicker open={picking} onClose={() => setPicking(false)} exclude={workout.exerciseIds} onPick={(id) => { setPicking(false); void repo.addExercise(workout.id, id); }} />
      <Sheet open={finishing} title="Finish workout?" onClose={() => setFinishing(false)}>
        <p class="muted" style={{ marginTop: 0 }}>{doneCount ? `${doneCount} set${doneCount === 1 ? '' : 's'} ticked. Sets you did not tick are left out.` : 'Nothing is ticked yet, so finishing will discard this workout.'}</p>
        <label class="field"><span>Notes (optional)</span><textarea class="input" rows={3} value={notes} onInput={(e) => setNotes((e.currentTarget as HTMLTextAreaElement).value)} placeholder="How did it feel?" /></label>
        <button type="button" class="btn primary block" onClick={() => void finish()}>{doneCount ? 'Finish and save' : 'Discard'}</button>
      </Sheet>
    </>
  );
}
