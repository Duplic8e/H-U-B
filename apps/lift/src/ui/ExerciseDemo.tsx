import { useEffect, useState } from 'preact/hooks';
import guide from '../data/guide.json';

type Guide = Record<string, { steps: string[]; secondary: string[]; level: string }>;
export const GUIDE = guide as Guide;

const base = import.meta.env.BASE_URL;
export const hasDemo = (exerciseId: string) => exerciseId in GUIDE;
const frame = (exerciseId: string, i: 0 | 1) => `${base}exercises/${exerciseId}-${i}.jpg`;

/** The movement, shown by alternating its start and end photos. With reduced
 *  motion on, it holds the start position and switches only on tap. */
export function ExerciseDemo({ exerciseId, name, size = 'full' }: { exerciseId: string; name: string; size?: 'full' | 'thumb' }) {
  const [end, setEnd] = useState(false);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (still || size === 'thumb') return;
    const t = setInterval(() => setEnd((v) => !v), 1100);
    return () => clearInterval(t);
  }, [still, size]);
  if (!hasDemo(exerciseId)) {
    return size === 'thumb' ? <span class="demo thumb placeholder" aria-hidden="true">{name.slice(0, 1)}</span> : null;
  }
  if (size === 'thumb') return <img class="demo thumb" src={frame(exerciseId, 0)} alt="" loading="lazy" />;
  return (
    <div class="demo full" role="img" aria-label={`${name}: start and end position`} onClick={() => setEnd((v) => !v)}>
      <img src={frame(exerciseId, 0)} alt="" />
      <img src={frame(exerciseId, 1)} alt="" class={end ? 'on' : ''} />
      <span class="demo-tag">{end ? 'End' : 'Start'}</span>
    </div>
  );
}

/** Photo demo plus the written steps. */
export function ExerciseGuide({ exerciseId, name }: { exerciseId: string; name: string }) {
  const g = GUIDE[exerciseId];
  if (!g) return <p class="muted">No demo for this exercise. Custom exercises do not have one.</p>;
  return (
    <>
      <ExerciseDemo exerciseId={exerciseId} name={name} />
      {g.secondary.length > 0 && <p class="muted small" style={{ margin: '10px 0 0' }}>Also works: {g.secondary.join(', ')}</p>}
      <ol class="steps">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </>
  );
}
