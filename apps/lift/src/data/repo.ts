import { LiftDB } from './db';
import { LIBRARY, TEMPLATES } from './library';
import type { Session } from './stats';
import type { Dump, Exercise, Routine, RoutineItem, SetEntry, Settings, Synced, Unit, Workout } from './types';
import { SETTINGS_ID } from './types';

const uid = () => crypto.randomUUID();
const live = <T extends Synced>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export const DEFAULT_SETTINGS: Omit<Settings, 'updatedAt'> = { id: SETTINGS_ID, unit: 'kg', defaultRestSec: 90 };

export function createRepo(db: LiftDB, now: () => Date = () => new Date()) {
  const stamp = () => now().toISOString();
  const listeners = new Set<() => void>();
  let quiet = false;
  /** Every local write calls this, so sync knows to push. Merges from the cloud do not. */
  const changed = () => { if (!quiet) listeners.forEach((l) => l()); };

  async function lastSession(exerciseId: string, excludeWorkoutId?: string): Promise<SetEntry[]> {
    const sets = live(await db.sets.where('exerciseId').equals(exerciseId).toArray()).filter((s) => s.done && s.workoutId !== excludeWorkoutId);
    if (!sets.length) return [];
    const workouts = new Map(live(await db.workouts.bulkGet([...new Set(sets.map((s) => s.workoutId))]).then((w) => w.filter((x): x is Workout => !!x))).filter((w) => w.finishedAt).map((w) => [w.id, w]));
    const latest = [...workouts.values()].sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0];
    if (!latest) return [];
    return sets.filter((s) => s.workoutId === latest.id).sort((a, b) => a.setNo - b.setNo);
  }

  /** New set rows for an exercise, copying last time's weight and reps. */
  async function prefill(workoutId: string, exerciseId: string, item?: RoutineItem): Promise<SetEntry[]> {
    const last = await lastSession(exerciseId, workoutId);
    const count = item?.sets ?? Math.max(1, last.length || 3);
    const at = stamp();
    return Array.from({ length: count }, (_, i) => {
      const from = last[i] ?? last[last.length - 1];
      return { id: uid(), updatedAt: at, workoutId, exerciseId, setNo: i + 1, weightKg: from?.weightKg ?? 0, reps: from?.reps ?? item?.repsMin ?? 8, done: false };
    });
  }

  const repo = {
    db,
    onLocalChange(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // ---- settings ----
    async getSettings(): Promise<Settings> {
      return (await db.settings.get(SETTINGS_ID)) ?? { ...DEFAULT_SETTINGS, updatedAt: new Date(0).toISOString() };
    },
    async updateSettings(patch: Partial<Pick<Settings, 'unit' | 'defaultRestSec'>>) {
      const current = await repo.getSettings();
      await db.settings.put({ ...current, ...patch, updatedAt: stamp() });
      changed();
    },
    async setUnit(unit: Unit) { await repo.updateSettings({ unit }); },

    // ---- exercises ----
    async listExercises(): Promise<Exercise[]> {
      return live(await db.exercises.toArray()).sort((a, b) => a.name.localeCompare(b.name));
    },
    async saveExercise(input: Omit<Exercise, 'id' | 'updatedAt'> & { id?: string }): Promise<string> {
      const id = input.id ?? uid();
      await db.exercises.put({ ...input, id, name: input.name.trim(), updatedAt: stamp() });
      changed();
      return id;
    },
    async deleteExercise(id: string) {
      const row = await db.exercises.get(id);
      if (row) await db.exercises.put({ ...row, deletedAt: stamp(), updatedAt: stamp() });
      changed();
    },

    // ---- routines ----
    async listRoutines(): Promise<Routine[]> {
      return live(await db.routines.toArray()).sort((a, b) => a.order - b.order);
    },
    async saveRoutine(input: Omit<Routine, 'id' | 'updatedAt' | 'order'> & { id?: string; order?: number }): Promise<string> {
      const id = input.id ?? uid();
      const existing = input.id ? await db.routines.get(input.id) : undefined;
      const order = input.order ?? existing?.order ?? (await repo.listRoutines()).length;
      await db.routines.put({ ...existing, ...input, id, order, name: input.name.trim(), updatedAt: stamp() });
      changed();
      return id;
    },
    async deleteRoutine(id: string) {
      const row = await db.routines.get(id);
      if (row) await db.routines.put({ ...row, deletedAt: stamp(), updatedAt: stamp() });
      changed();
    },
    async moveRoutine(id: string, delta: -1 | 1) {
      const list = await repo.listRoutines();
      const i = list.findIndex((r) => r.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j]!, list[i]!];
      const at = stamp();
      await db.routines.bulkPut(list.map((r, order) => ({ ...r, order, updatedAt: at })));
      changed();
    },

    /** Adds the starter exercises (idempotent) and, optionally, a template's routines. */
    async setUp(templateId: string | null) {
      const at = stamp();
      const have = new Set((await db.exercises.toArray()).map((e) => e.id));
      await db.exercises.bulkPut(LIBRARY.filter((e) => !have.has(e.id)).map((e) => ({ ...e, updatedAt: at })));
      const template = TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        const start = (await repo.listRoutines()).length;
        await db.routines.bulkPut(template.routines.map((r, i) => ({
          id: uid(), updatedAt: at, name: r.name, order: start + i,
          items: r.items.map(([exerciseId, sets, repsMin, repsMax, restSec]) => ({ exerciseId, sets, repsMin, repsMax, restSec })),
        })));
      }
      if (!(await db.settings.get(SETTINGS_ID))) await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: at });
      changed();
    },

    // ---- workouts ----
    async activeWorkout(): Promise<Workout | undefined> {
      return live(await db.workouts.toArray()).filter((w) => !w.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    },
    async startWorkout(routineId?: string): Promise<string> {
      const active = await repo.activeWorkout();
      if (active) return active.id;
      const routine = routineId ? await db.routines.get(routineId) : undefined;
      const id = uid();
      const items = routine?.items ?? [];
      const sets = (await Promise.all(items.map((item) => prefill(id, item.exerciseId, item)))).flat();
      await db.transaction('rw', db.workouts, db.sets, async () => {
        await db.workouts.put({ id, updatedAt: stamp(), routineId: routine?.id, name: routine?.name ?? 'Workout', startedAt: stamp(), exerciseIds: items.map((i) => i.exerciseId) });
        await db.sets.bulkPut(sets);
      });
      changed();
      return id;
    },
    async addExercise(workoutId: string, exerciseId: string) {
      const w = await db.workouts.get(workoutId);
      if (!w || w.exerciseIds.includes(exerciseId)) return;
      const sets = await prefill(workoutId, exerciseId);
      await db.transaction('rw', db.workouts, db.sets, async () => {
        await db.workouts.put({ ...w, exerciseIds: [...w.exerciseIds, exerciseId], updatedAt: stamp() });
        await db.sets.bulkPut(sets);
      });
      changed();
    },
    async removeExercise(workoutId: string, exerciseId: string) {
      const w = await db.workouts.get(workoutId);
      if (!w) return;
      const at = stamp();
      const sets = live(await db.sets.where('[workoutId+exerciseId]').equals([workoutId, exerciseId]).toArray());
      await db.transaction('rw', db.workouts, db.sets, async () => {
        await db.workouts.put({ ...w, exerciseIds: w.exerciseIds.filter((e) => e !== exerciseId), updatedAt: at });
        await db.sets.bulkPut(sets.map((s) => ({ ...s, deletedAt: at, updatedAt: at })));
      });
      changed();
    },
    async workoutSets(workoutId: string): Promise<SetEntry[]> {
      return live(await db.sets.where('workoutId').equals(workoutId).toArray()).sort((a, b) => a.setNo - b.setNo);
    },
    async addSet(workoutId: string, exerciseId: string) {
      const sets = live(await db.sets.where('[workoutId+exerciseId]').equals([workoutId, exerciseId]).toArray()).sort((a, b) => a.setNo - b.setNo);
      const last = sets[sets.length - 1];
      await db.sets.put({ id: uid(), updatedAt: stamp(), workoutId, exerciseId, setNo: (last?.setNo ?? 0) + 1, weightKg: last?.weightKg ?? 0, reps: last?.reps ?? 8, done: false });
      changed();
    },
    async updateSet(id: string, patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'done'>>) {
      const row = await db.sets.get(id);
      if (!row) return;
      await db.sets.put({ ...row, ...patch, updatedAt: stamp() });
      changed();
    },
    async removeSet(id: string) {
      const row = await db.sets.get(id);
      if (row) await db.sets.put({ ...row, deletedAt: stamp(), updatedAt: stamp() });
      changed();
    },
    /** Ends the workout. Sets never ticked are dropped; a workout with none ticked is discarded. Returns whether it was kept. */
    async finishWorkout(id: string, notes?: string): Promise<boolean> {
      const w = await db.workouts.get(id);
      if (!w) return false;
      const sets = await repo.workoutSets(id);
      if (!sets.some((s) => s.done)) {
        await repo.discardWorkout(id);
        return false;
      }
      const at = stamp();
      await db.transaction('rw', db.workouts, db.sets, async () => {
        await db.sets.bulkPut(sets.filter((s) => !s.done).map((s) => ({ ...s, deletedAt: at, updatedAt: at })));
        const used = new Set(sets.filter((s) => s.done).map((s) => s.exerciseId));
        await db.workouts.put({ ...w, finishedAt: at, updatedAt: at, notes: notes?.trim() || w.notes, exerciseIds: w.exerciseIds.filter((e) => used.has(e)) });
      });
      changed();
      return true;
    },
    async discardWorkout(id: string) {
      const w = await db.workouts.get(id);
      const at = stamp();
      const sets = await repo.workoutSets(id);
      await db.transaction('rw', db.workouts, db.sets, async () => {
        if (w) await db.workouts.put({ ...w, deletedAt: at, updatedAt: at });
        await db.sets.bulkPut(sets.map((s) => ({ ...s, deletedAt: at, updatedAt: at })));
      });
      changed();
    },
    async finishedWorkouts(): Promise<Workout[]> {
      return live(await db.workouts.toArray()).filter((w) => w.finishedAt).sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
    },
    async getWorkout(id: string): Promise<Workout | undefined> {
      const w = await db.workouts.get(id);
      return w && !w.deletedAt ? w : undefined;
    },
    /** Finished sessions that include this exercise, oldest first. */
    async sessionsFor(exerciseId: string): Promise<Session[]> {
      const sets = live(await db.sets.where('exerciseId').equals(exerciseId).toArray()).filter((s) => s.done);
      const ids = [...new Set(sets.map((s) => s.workoutId))];
      const workouts = live((await db.workouts.bulkGet(ids)).filter((w): w is Workout => !!w)).filter((w) => w.finishedAt);
      return workouts
        .map((workout) => ({ workout, sets: sets.filter((s) => s.workoutId === workout.id).sort((a, b) => a.setNo - b.setNo) }))
        .sort((a, b) => (a.workout.finishedAt ?? '').localeCompare(b.workout.finishedAt ?? ''));
    },
    lastSession,

    // ---- sync and backup ----
    async dumpAll(): Promise<Dump> {
      const [exercises, routines, workouts, sets, settings] = await Promise.all([
        db.exercises.toArray(), db.routines.toArray(), db.workouts.toArray(), db.sets.toArray(), db.settings.toArray(),
      ]);
      return { exercises, routines, workouts, sets, settings };
    },
    /** Merges rows by id; the newer `updatedAt` wins, ties keep this device's row. */
    async mergeAll(remote: Dump) {
      quiet = true;
      try {
        await db.transaction('rw', [db.exercises, db.routines, db.workouts, db.sets, db.settings], async () => {
          const merge = async <T extends Synced>(table: import('dexie').Table<T, string>, rows: T[]) => {
            const local = new Map((await table.bulkGet(rows.map((r) => r.id))).filter((r): r is T => !!r).map((r) => [r.id, r]));
            const winners = rows.filter((r) => { const mine = local.get(r.id); return !mine || r.updatedAt > mine.updatedAt; });
            if (winners.length) await table.bulkPut(winners);
          };
          await merge(db.exercises, remote.exercises);
          await merge(db.routines, remote.routines);
          await merge(db.workouts, remote.workouts);
          await merge(db.sets, remote.sets);
          await merge(db.settings, remote.settings);
        });
      } finally {
        quiet = false;
      }
    },
    async isEmpty(): Promise<boolean> {
      return (await db.exercises.count()) === 0 && (await db.routines.count()) === 0;
    },
  };
  return repo;
}

export type Repo = ReturnType<typeof createRepo>;

let shared: Repo | undefined;
export function getRepo(): Repo {
  return (shared ??= createRepo(new LiftDB()));
}
