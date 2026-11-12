import type { Exercise, RoutineItem, SetEntry, Unit, Workout } from './types';
import { fromKg, toKg, weightStep } from './units';

/** Estimated one-rep max (Epley). A single rep is its own max. */
export function e1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export interface Session {
  workout: Workout;
  sets: SetEntry[];
}

export interface ExerciseRecords {
  heaviestKg: number;
  bestE1rmKg: number;
  mostRepsAtHeaviest: number;
  bestSessionVolumeKg: number;
}

export function volume(sets: SetEntry[]): number {
  return sets.reduce((sum, s) => sum + (s.done ? s.weightKg * s.reps : 0), 0);
}

export function recordsOf(sessions: Session[]): ExerciseRecords {
  let heaviestKg = 0, bestE1rmKg = 0, mostRepsAtHeaviest = 0, bestSessionVolumeKg = 0;
  for (const { sets } of sessions) {
    for (const s of sets) {
      if (!s.done) continue;
      if (s.weightKg > heaviestKg) { heaviestKg = s.weightKg; mostRepsAtHeaviest = s.reps; }
      else if (s.weightKg === heaviestKg && s.reps > mostRepsAtHeaviest) mostRepsAtHeaviest = s.reps;
      bestE1rmKg = Math.max(bestE1rmKg, e1rm(s.weightKg, s.reps));
    }
    bestSessionVolumeKg = Math.max(bestSessionVolumeKg, volume(sets));
  }
  return { heaviestKg, bestE1rmKg, mostRepsAtHeaviest, bestSessionVolumeKg };
}

export type RecordKind = 'heaviest' | 'e1rm' | 'volume';

/** Which records this session set, compared with every session before it. */
export function newRecords(before: Session[], session: Session): RecordKind[] {
  const done = session.sets.filter((s) => s.done && s.reps > 0);
  if (!done.length || !before.some((b) => b.sets.some((s) => s.done))) return [];
  const old = recordsOf(before);
  const now = recordsOf([session]);
  const out: RecordKind[] = [];
  if (now.heaviestKg > old.heaviestKg + 1e-9) out.push('heaviest');
  if (now.bestE1rmKg > old.bestE1rmKg + 1e-9) out.push('e1rm');
  if (now.bestSessionVolumeKg > old.bestSessionVolumeKg + 1e-9) out.push('volume');
  return out;
}

/** Fixed-routine progression: when every target set last time reached the
 *  top of the rep range, suggest one plate jump. Returns kg, or null. */
export function suggestedWeightKg(last: SetEntry[], item: RoutineItem | undefined, unit: Unit): number | null {
  if (!item) return null;
  const done = last.filter((s) => s.done && s.weightKg > 0);
  if (done.length < item.sets) return null;
  const working = Math.max(...done.map((s) => s.weightKg));
  const hitTop = done.filter((s) => s.weightKg >= working - 1e-9).every((s) => s.reps >= item.repsMax);
  if (!hitTop) return null;
  // Round in the user's unit so the suggestion is a weight they can load.
  const next = Math.round((fromKg(working, unit) + weightStep(unit)) / weightStep(unit)) * weightStep(unit);
  return toKg(next, unit);
}

/** Best estimated max per session, oldest first, for the progress chart. */
export function e1rmSeries(sessions: Session[]): Array<{ date: string; kg: number }> {
  return sessions
    .map(({ workout, sets }) => ({ date: (workout.finishedAt ?? workout.startedAt).slice(0, 10), kg: Math.max(0, ...sets.filter((s) => s.done).map((s) => e1rm(s.weightKg, s.reps))) }))
    .filter((p) => p.kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function durationMinutes(workout: Workout): number {
  if (!workout.finishedAt) return 0;
  return Math.max(1, Math.round((Date.parse(workout.finishedAt) - Date.parse(workout.startedAt)) / 60000));
}

export function exerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? 'Exercise';
}
