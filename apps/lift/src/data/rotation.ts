import type { Routine, Workout } from './types';

/** The routine after the one last finished, wrapping round; the first one when nothing is finished yet. */
export function nextRoutine(routines: Routine[], finished: Workout[]): Routine | undefined {
  const ordered = [...routines].sort((a, b) => a.order - b.order);
  if (!ordered.length) return undefined;
  const last = [...finished]
    .filter((w) => w.finishedAt && w.routineId && ordered.some((r) => r.id === w.routineId))
    .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0];
  if (!last) return ordered[0];
  const i = ordered.findIndex((r) => r.id === last.routineId);
  return ordered[(i + 1) % ordered.length];
}
