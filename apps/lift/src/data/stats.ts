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

// ---- trends over time ----

/** Monday of the week containing `d`, as a local YYYY-MM-DD. */
export function weekKey(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export interface WeekPoint { week: string; workouts: number; volumeKg: number; sets: number }

/** One point per week for the last `weeks` weeks, oldest first, empty weeks included. */
export function weeklySeries(workouts: Workout[], sets: SetEntry[], weeks: number, now: Date = new Date()): WeekPoint[] {
  const byWorkout = new Map<string, SetEntry[]>();
  for (const s of sets) if (s.done) byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s]);
  const points = new Map<string, WeekPoint>();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
    const week = weekKey(d);
    points.set(week, { week, workouts: 0, volumeKg: 0, sets: 0 });
  }
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const p = points.get(weekKey(new Date(w.finishedAt)));
    if (!p) continue;
    const own = byWorkout.get(w.id) ?? [];
    p.workouts += 1;
    p.sets += own.length;
    p.volumeKg += volume(own);
  }
  return [...points.values()];
}

/** Sets per muscle over the last `days` days, most trained first. */
export function muscleSets(workouts: Workout[], sets: SetEntry[], exercises: Exercise[], days: number, now: Date = new Date()): Array<{ muscle: string; sets: number }> {
  const since = now.getTime() - days * 86_400_000;
  const recent = new Set(workouts.filter((w) => w.finishedAt && Date.parse(w.finishedAt) >= since).map((w) => w.id));
  const muscleOf = new Map(exercises.map((e) => [e.id, e.muscle]));
  const count = new Map<string, number>();
  for (const s of sets) {
    if (!s.done || !recent.has(s.workoutId)) continue;
    const m = muscleOf.get(s.exerciseId) ?? 'Other';
    count.set(m, (count.get(m) ?? 0) + 1);
  }
  return [...count].map(([muscle, n]) => ({ muscle, sets: n })).sort((a, b) => b.sets - a.sets);
}

/** Which weekdays (0 = Monday) of the current week have a finished workout. */
export function daysTrainedThisWeek(workouts: Workout[], now: Date = new Date()): boolean[] {
  const week = weekKey(now);
  const out = Array<boolean>(7).fill(false);
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const d = new Date(w.finishedAt);
    if (weekKey(d) === week) out[(d.getDay() + 6) % 7] = true;
  }
  return out;
}

/** Consecutive weeks, ending this week or last, with at least one workout. */
export function weekStreak(workouts: Workout[], now: Date = new Date()): number {
  const weeks = new Set(workouts.filter((w) => w.finishedAt).map((w) => weekKey(new Date(w.finishedAt!))));
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!weeks.has(weekKey(cursor))) cursor.setDate(cursor.getDate() - 7);
  while (weeks.has(weekKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 7); }
  return streak;
}

/** Per-session series for one exercise, oldest first. */
export function exerciseSeries(sessions: Session[]): Array<{ date: string; e1rmKg: number; topKg: number; volumeKg: number }> {
  return sessions
    .map(({ workout, sets }) => {
      const done = sets.filter((s) => s.done);
      return {
        date: (workout.finishedAt ?? workout.startedAt).slice(0, 10),
        e1rmKg: Math.max(0, ...done.map((s) => e1rm(s.weightKg, s.reps))),
        topKg: Math.max(0, ...done.map((s) => s.weightKg)),
        volumeKg: volume(done),
      };
    })
    .filter((p) => p.volumeKg > 0 || p.topKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
