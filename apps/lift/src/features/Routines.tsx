import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { TEMPLATES } from '../data/library';
import type { RoutineItem } from '../data/types';
import { go } from '../router';
import { Header, Icon, NumField, Sheet, useLive } from '../ui/kit';
import { ExercisePicker } from './ExercisePicker';
import { ExerciseDemo } from '../ui/ExerciseDemo';

export function RoutineList() {
  const { repo } = useApp();
  const routines = useLive(() => repo.listRoutines()) ?? [];
  const exercises = useLive(() => repo.listExercises()) ?? [];
  const [templates, setTemplates] = useState(false);
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercise';

  return (
    <>
      <Header title="Routines" actions={<button type="button" class="icon-btn" aria-label="New routine" onClick={async () => go(`#/routines/${await repo.saveRoutine({ name: `Day ${routines.length + 1}`, items: [] })}`)}><Icon name="plus" /></button>} />
      <div class="page">
        <p class="muted" style={{ margin: '0 4px' }}>Today offers them in this order, starting after the one you did last.</p>
        {routines.length === 0 && <div class="card empty">No routines yet.</div>}
        <ul class="list" style={{ marginTop: 16 }}>
          {routines.map((r, i) => (
            <li key={r.id} style={{ display: 'flex', alignItems: 'center' }}>
              <a class="row" href={`#/routines/${r.id}`}>
                <span class="row-main"><span class="row-title">{i + 1}. {r.name}</span><span class="row-sub">{r.items.map((it) => name(it.exerciseId)).join(', ') || 'No exercises'}</span></span>
              </a>
              <button type="button" class="icon-btn" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => void repo.moveRoutine(r.id, -1)} style={{ opacity: i === 0 ? 0.3 : 1 }}><Icon name="up" /></button>
              <button type="button" class="icon-btn" aria-label={`Move ${r.name} down`} disabled={i === routines.length - 1} onClick={() => void repo.moveRoutine(r.id, 1)} style={{ opacity: i === routines.length - 1 ? 0.3 : 1 }}><Icon name="down" /></button>
            </li>
          ))}
        </ul>
        <button type="button" class="btn block" style={{ marginTop: 16 }} onClick={() => setTemplates(true)}>Add a ready-made program</button>
      </div>
      <Sheet open={templates} title="Ready-made programs" onClose={() => setTemplates(false)}>
        <ul class="list">
          {TEMPLATES.map((t) => (
            <li key={t.id}><button type="button" class="row" onClick={async () => { await repo.setUp(t.id); setTemplates(false); }}>
              <span class="row-main"><span class="row-title">{t.name}</span><span class="row-sub">{t.description} Adds {t.routines.map((r) => r.name).join(', ')}.</span></span>
              <Icon name="plus" class="chev" />
            </button></li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

export function RoutineEditor({ id }: { id: string }) {
  const { repo } = useApp();
  const routine = useLive(async () => (await repo.listRoutines()).find((r) => r.id === id), [id]);
  const exercises = useLive(() => repo.listExercises()) ?? [];
  const [picking, setPicking] = useState(false);
  if (!routine) return <><Header title="Routine" back={{ href: '#/routines', label: 'Routines' }} /><div class="page"><p class="empty">Not found.</p></div></>;

  const save = (items: RoutineItem[], name = routine.name) => repo.saveRoutine({ ...routine, name, items });
  const patch = (i: number, p: Partial<RoutineItem>) => save(routine.items.map((it, j) => (j === i ? { ...it, ...p } : it)));
  const move = (i: number, d: -1 | 1) => {
    const items = [...routine.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j]!, items[i]!];
    void save(items);
  };

  return (
    <>
      <Header title={routine.name} back={{ href: '#/routines', label: 'Routines' }} />
      <div class="page">
        <label class="field" style={{ marginTop: 8 }}><span>Name</span>
          <input class="input" value={routine.name} onChange={(e) => void save(routine.items, (e.currentTarget as HTMLInputElement).value.trim() || routine.name)} />
        </label>
        {routine.items.map((it, i) => (
          <section key={`${it.exerciseId}-${i}`} class="card" aria-label={exercises.find((e) => e.id === it.exerciseId)?.name ?? 'Exercise'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ marginRight: 8 }}><ExerciseDemo exerciseId={it.exerciseId} name={exercises.find((e) => e.id === it.exerciseId)?.name ?? 'Exercise'} size="thumb" /></span>
              <h2 style={{ flex: 1, margin: 0, fontSize: 18 }}>{exercises.find((e) => e.id === it.exerciseId)?.name ?? 'Exercise'}</h2>
              <button type="button" class="icon-btn" aria-label="Move up" onClick={() => move(i, -1)}><Icon name="up" /></button>
              <button type="button" class="icon-btn" aria-label="Move down" onClick={() => move(i, 1)}><Icon name="down" /></button>
              <button type="button" class="icon-btn" aria-label="Remove" style={{ color: 'var(--error)' }} onClick={() => void save(routine.items.filter((_, j) => j !== i))}><Icon name="x" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
              <label class="field" style={{ margin: 0 }}><span>Sets</span><NumField class="input" label="Sets" decimals={0} value={it.sets} onCommit={(n) => void patch(i, { sets: Math.max(1, Math.round(n)) })} /></label>
              <label class="field" style={{ margin: 0 }}><span>Reps from</span><NumField class="input" label="Reps from" decimals={0} value={it.repsMin} onCommit={(n) => void patch(i, { repsMin: Math.max(1, Math.round(n)), repsMax: Math.max(Math.round(n), it.repsMax) })} /></label>
              <label class="field" style={{ margin: 0 }}><span>to</span><NumField class="input" label="Reps to" decimals={0} value={it.repsMax} onCommit={(n) => void patch(i, { repsMax: Math.max(it.repsMin, Math.round(n)) })} /></label>
              <label class="field" style={{ margin: 0 }}><span>Rest (s)</span><NumField class="input" label="Rest in seconds" decimals={0} value={it.restSec} onCommit={(n) => void patch(i, { restSec: Math.max(0, Math.round(n)) })} /></label>
            </div>
          </section>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <button type="button" class="btn block" onClick={() => setPicking(true)}><Icon name="plus" /> Add exercise</button>
          <button type="button" class="btn danger block" onClick={async () => { if (confirm(`Delete ${routine.name}? Past workouts stay in History.`)) { await repo.deleteRoutine(id); go('#/routines'); } }}>Delete routine</button>
        </div>
      </div>
      <ExercisePicker open={picking} onClose={() => setPicking(false)} exclude={routine.items.map((i) => i.exerciseId)}
        onPick={(exerciseId) => { setPicking(false); void save([...routine.items, { exerciseId, sets: 3, repsMin: 8, repsMax: 12, restSec: 90 }]); }} />
    </>
  );
}
