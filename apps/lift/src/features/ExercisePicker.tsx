import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { EQUIPMENT, MUSCLES, type Equipment, type Muscle } from '../data/types';
import { Icon, Sheet, useLive } from '../ui/kit';
import { ExerciseDemo } from '../ui/ExerciseDemo';

/** Search the exercise list, or create a new exercise on the spot. */
export function ExercisePicker({ open, onClose, onPick, exclude = [] }: { open: boolean; onClose: () => void; onPick: (id: string) => void; exclude?: string[] }) {
  const { repo } = useApp();
  const exercises = useLive(() => repo.listExercises()) ?? [];
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<Muscle>('Chest');
  const [equipment, setEquipment] = useState<Equipment>('Barbell');

  const close = () => { setQ(''); setCreating(false); setName(''); onClose(); };
  const term = q.trim().toLowerCase();
  const shown = exercises.filter((e) => !exclude.includes(e.id) && (!term || e.name.toLowerCase().includes(term) || e.muscle.toLowerCase().includes(term)));
  const groups = MUSCLES.map((m) => ({ m, list: shown.filter((e) => e.muscle === m) })).filter((g) => g.list.length);

  return (
    <Sheet open={open} title={creating ? 'New exercise' : 'Add exercise'} onClose={close}>
      {creating ? (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = await repo.saveExercise({ name, muscle, equipment });
          close();
          onPick(id);
        }}>
          <label class="field"><span>Name</span><input class="input" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} placeholder="e.g. Pec Deck" /></label>
          <label class="field"><span>Muscle</span>
            <select class="input" value={muscle} onChange={(e) => setMuscle((e.currentTarget as HTMLSelectElement).value as Muscle)}>{MUSCLES.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label class="field"><span>Equipment</span>
            <select class="input" value={equipment} onChange={(e) => setEquipment((e.currentTarget as HTMLSelectElement).value as Equipment)}>{EQUIPMENT.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <button type="submit" class="btn primary block" disabled={!name.trim()}>Create and add</button>
        </form>
      ) : (
        <>
          <input class="input" type="search" aria-label="Search exercises" placeholder="Search" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
          <button type="button" class="link-btn" onClick={() => { setCreating(true); setName(q); }}><Icon name="plus" /> New exercise{q.trim() ? ` “${q.trim()}”` : ''}</button>
          {groups.map(({ m, list }) => (
            <div key={m}>
              <p class="section-label" style={{ marginTop: 12 }}>{m}</p>
              <ul class="list">
                {list.map((e) => (
                  <li key={e.id}><button type="button" class="row" onClick={() => { close(); onPick(e.id); }}>
                    <ExerciseDemo exerciseId={e.id} name={e.name} size="thumb" />
                    <span class="row-main"><span class="row-title">{e.name}</span><span class="row-sub">{e.equipment}</span></span>
                  </button></li>
                ))}
              </ul>
            </div>
          ))}
          {!groups.length && <p class="empty">No match. Create it with “New exercise”.</p>}
        </>
      )}
    </Sheet>
  );
}
