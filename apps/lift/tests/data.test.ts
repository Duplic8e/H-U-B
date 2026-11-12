import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LiftDB } from '../src/data/db';
import { createRepo } from '../src/data/repo';
import { nextRoutine } from '../src/data/rotation';
import { e1rm, newRecords, recordsOf, suggestedWeightKg, e1rmSeries } from '../src/data/stats';
import { formatWeight, fromKg, toKg } from '../src/data/units';
import type { SetEntry } from '../src/data/types';

let n = 0;
function setup(start = new Date('2026-11-01T10:00:00Z')) {
  let clock = start.getTime();
  const now = () => new Date(clock);
  const tick = (min = 1) => { clock += min * 60_000; };
  const repo = createRepo(new LiftDB(`lift-test-${++n}`), now);
  return { repo, tick };
}

const set = (weightKg: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry =>
  ({ id: crypto.randomUUID(), updatedAt: '', workoutId: 'w', exerciseId: 'e', setNo: 1, weightKg, reps, done: true, ...extra });

describe('units', () => {
  it('stores kilograms and shows either unit, stable both ways', () => {
    expect(formatWeight(toKg(135, 'lb'), 'lb')).toBe('135');
    expect(formatWeight(toKg(102.5, 'kg'), 'kg')).toBe('102.5');
    expect(formatWeight(100, 'lb')).toBe('220.5');
    expect(fromKg(toKg(225, 'lb'), 'lb')).toBeCloseTo(225, 9);
  });
});

describe('stats', () => {
  it('estimates a one-rep max', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 2);
    expect(e1rm(0, 5)).toBe(0);
  });

  it('finds records and which ones a session beat', () => {
    const before = [{ workout: { id: 'a', updatedAt: '', name: '', startedAt: '2026-10-01', finishedAt: '2026-10-01', exerciseIds: [] }, sets: [set(100, 5), set(100, 4)] }];
    expect(recordsOf(before)).toMatchObject({ heaviestKg: 100, mostRepsAtHeaviest: 5, bestSessionVolumeKg: 900 });
    const heavier = { workout: { ...before[0]!.workout, id: 'b' }, sets: [set(105, 3)] };
    expect(newRecords(before, heavier)).toEqual(['heaviest']);
    const more = { workout: { ...before[0]!.workout, id: 'c' }, sets: [set(100, 8), set(100, 8)] };
    expect(newRecords(before, more)).toEqual(['e1rm', 'volume']);
    // The very first session is not a "record", just a start.
    expect(newRecords([], heavier)).toEqual([]);
  });

  it('suggests one plate jump only when every set hit the top of the range', () => {
    const item = { exerciseId: 'e', sets: 3, repsMin: 6, repsMax: 8, restSec: 90 };
    expect(suggestedWeightKg([set(60, 8), set(60, 8), set(60, 8)], item, 'kg')).toBe(62.5);
    expect(suggestedWeightKg([set(60, 8), set(60, 8), set(60, 7)], item, 'kg')).toBeNull();
    expect(suggestedWeightKg([set(60, 8), set(60, 8)], item, 'kg')).toBeNull();
    const lb = suggestedWeightKg([set(toKg(135, 'lb'), 8), set(toKg(135, 'lb'), 8), set(toKg(135, 'lb'), 8)], item, 'lb')!;
    expect(formatWeight(lb, 'lb')).toBe('140');
  });

  it('charts the best estimate per session in date order', () => {
    const w = (id: string, date: string) => ({ id, updatedAt: '', name: '', startedAt: date, finishedAt: date, exerciseIds: [] });
    expect(e1rmSeries([{ workout: w('b', '2026-10-08'), sets: [set(100, 1)] }, { workout: w('a', '2026-10-01'), sets: [set(90, 1)] }]))
      .toEqual([{ date: '2026-10-01', kg: 90 }, { date: '2026-10-08', kg: 100 }]);
  });
});

describe('workouts', () => {
  it('sets up a template, starts its first routine and prefills from last time', async () => {
    const { repo, tick } = setup();
    await repo.setUp('ppl');
    const routines = await repo.listRoutines();
    expect(routines.map((r) => r.name)).toEqual(['Push', 'Pull', 'Legs']);
    expect(nextRoutine(routines, [])?.name).toBe('Push');

    const first = await repo.startWorkout(routines[0]!.id);
    let sets = await repo.workoutSets(first);
    const bench = sets.filter((s) => s.exerciseId === 'ex-bench');
    expect(bench).toHaveLength(4);
    expect(bench[0]).toMatchObject({ weightKg: 0, reps: 6, done: false });
    for (const s of bench) await repo.updateSet(s.id, { weightKg: 80, reps: 8, done: true });
    tick(60);
    expect(await repo.finishWorkout(first)).toBe(true);

    // Unticked sets are dropped, and the workout only lists what was done.
    expect((await repo.workoutSets(first)).every((s) => s.done)).toBe(true);
    expect((await repo.getWorkout(first))?.exerciseIds).toEqual(['ex-bench']);

    // The rotation moves on, and next Push starts from last time's numbers.
    expect(nextRoutine(routines, await repo.finishedWorkouts())?.name).toBe('Pull');
    tick(60 * 48);
    const second = await repo.startWorkout(routines[0]!.id);
    sets = await repo.workoutSets(second);
    expect(sets.filter((s) => s.exerciseId === 'ex-bench').map((s) => [s.weightKg, s.reps])).toEqual([[80, 8], [80, 8], [80, 8], [80, 8]]);
  });

  it('keeps one workout in progress and discards an empty one on finish', async () => {
    const { repo } = setup();
    await repo.setUp(null);
    const a = await repo.startWorkout();
    expect(await repo.startWorkout()).toBe(a);
    await repo.addExercise(a, 'ex-squat');
    expect(await repo.finishWorkout(a)).toBe(false);
    expect(await repo.activeWorkout()).toBeUndefined();
    expect(await repo.finishedWorkouts()).toEqual([]);
  });

  it('adds and removes sets and exercises during a workout', async () => {
    const { repo } = setup();
    await repo.setUp(null);
    const w = await repo.startWorkout();
    await repo.addExercise(w, 'ex-curl');
    expect((await repo.workoutSets(w)).length).toBe(3);
    await repo.addSet(w, 'ex-curl');
    expect((await repo.workoutSets(w)).map((s) => s.setNo)).toEqual([1, 2, 3, 4]);
    await repo.removeSet((await repo.workoutSets(w))[0]!.id);
    expect((await repo.workoutSets(w)).length).toBe(3);
    await repo.removeExercise(w, 'ex-curl');
    expect(await repo.workoutSets(w)).toEqual([]);
    expect((await repo.getWorkout(w))?.exerciseIds).toEqual([]);
  });

  it('reorders routines and remembers the unit', async () => {
    const { repo } = setup();
    await repo.setUp('upper-lower');
    const [a, b] = await repo.listRoutines();
    await repo.moveRoutine(b!.id, -1);
    expect((await repo.listRoutines()).slice(0, 2).map((r) => r.id)).toEqual([b!.id, a!.id]);
    await repo.setUnit('lb');
    expect((await repo.getSettings()).unit).toBe('lb');
  });
});

describe('merging two devices', () => {
  it('keeps the newer edit of each row and carries deletions', async () => {
    const one = setup(new Date('2026-11-01T10:00:00Z'));
    await one.repo.setUp('full-body');
    const dump = await one.repo.dumpAll();

    const two = setup(new Date('2026-11-02T10:00:00Z'));
    await two.repo.mergeAll(dump);
    expect((await two.repo.listRoutines()).length).toBe(3);
    const r = (await two.repo.listRoutines())[0]!;
    await two.repo.saveRoutine({ ...r, name: 'Monday' });
    await two.repo.deleteExercise('ex-kb-swing');

    await one.repo.mergeAll(await two.repo.dumpAll());
    expect((await one.repo.listRoutines())[0]!.name).toBe('Monday');
    expect((await one.repo.listExercises()).some((e) => e.id === 'ex-kb-swing')).toBe(false);
  });

  it('does not report a merge as a local change', async () => {
    const one = setup();
    await one.repo.setUp('ppl');
    const two = setup();
    let changes = 0;
    two.repo.onLocalChange(() => changes++);
    await two.repo.mergeAll(await one.repo.dumpAll());
    expect(changes).toBe(0);
  });
});
