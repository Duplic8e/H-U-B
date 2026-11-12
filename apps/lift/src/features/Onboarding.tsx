import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { TEMPLATES } from '../data/library';
import type { Unit } from '../data/types';
import { Segmented } from '../ui/kit';

/** First run: pick a weight unit and a program (or start blank). */
export function Onboarding({ restoring }: { restoring: boolean }) {
  const { repo } = useApp();
  const [unit, setUnit] = useState<Unit>('kg');
  const [template, setTemplate] = useState<string | null>('ppl');
  if (restoring) return <div class="page"><p class="empty" style={{ marginTop: '40vh' }}>Restoring from cloud…</p></div>;
  return (
    <div class="page" style={{ paddingTop: 'calc(var(--safe-top) + 32px)' }}>
      <h1 style={{ fontSize: 34, margin: '0 0 4px', letterSpacing: '-0.025em' }}>Lift</h1>
      <p class="muted" style={{ marginTop: 0 }}>Log your workouts, see your records, and get a nudge when it is time to add weight.</p>
      <p class="section-label">Weights in</p>
      <Segmented<Unit> label="Weight unit" value={unit} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} onChange={setUnit} />
      <p class="section-label">Start with</p>
      <ul class="list" role="radiogroup" aria-label="Program">
        {[...TEMPLATES.map((t) => ({ id: t.id, name: t.name, sub: t.description })), { id: null, name: 'My own routines', sub: 'Start blank and build them yourself.' }].map((t) => (
          <li key={t.id ?? 'blank'}>
            <button type="button" class="row" role="radio" aria-checked={template === t.id} onClick={() => setTemplate(t.id)}>
              <span class="row-main"><span class="row-title">{t.name}</span><span class="row-sub">{t.sub}</span></span>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 11, border: '2px solid var(--separator)', background: template === t.id ? 'var(--accent)' : 'none', borderColor: template === t.id ? 'var(--accent)' : 'var(--separator)' }} />
            </button>
          </li>
        ))}
      </ul>
      <p class="muted small">You can change routines, sets, reps and rest any time.</p>
      <button type="button" class="btn primary block" style={{ marginTop: 16 }} onClick={async () => { await repo.setUp(template); await repo.setUnit(unit); }}>Get started</button>
    </div>
  );
}
