import { describe, expect, it } from 'vitest';
import { daysTrainedThisWeek, exerciseSeries, muscleSets, weekKey, weekStreak, weeklySeries } from '../src/data/stats';
import type { Exercise, SetEntry, Workout } from '../src/data/types';
import { GUIDE } from '../src/ui/ExerciseDemo';
import { LIBRARY } from '../src/data/library';
import { existsSync } from 'node:fs';

const now = new Date(2026, 10, 12, 12); // Thursday 12 Nov 2026
const w = (id: string, y: number, m: number, d: number): Workout => ({ id, updatedAt: '', name: 'W', startedAt: new Date(y, m, d, 9).toISOString(), finishedAt: new Date(y, m, d, 10).toISOString(), exerciseIds: [] });
const s = (workoutId: string, exerciseId: string, weightKg: number, reps: number): SetEntry => ({ id: `${workoutId}-${Math.random()}`, updatedAt: '', workoutId, exerciseId, setNo: 1, weightKg, reps, done: true });

const workouts = [w('a', 2026, 10, 10), w('b', 2026, 10, 3), w('c', 2026, 9, 28), w('old', 2026, 8, 1)];
const sets = [s('a', 'bench', 100, 5), s('a', 'squat', 120, 5), s('b', 'bench', 95, 5), s('c', 'bench', 90, 5), s('old', 'bench', 60, 5)];

describe('trends', () => {
  it('keys weeks by their Monday', () => {
    expect(weekKey(now)).toBe('2026-11-09');
    expect(weekKey(new Date(2026, 10, 15))).toBe('2026-11-09'); // Sunday belongs to the same week
  });

  it('gives one point per week, empty weeks included, oldest first', () => {
    const series = weeklySeries(workouts, sets, 4, now);
    expect(series.map((p) => p.week)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
    expect(series.map((p) => p.workouts)).toEqual([0, 1, 1, 1]);
    expect(series[3]).toMatchObject({ sets: 2, volumeKg: 1100 });
  });

  it('counts sets per muscle over a window', () => {
    const exercises = [{ id: 'bench', muscle: 'Chest' }, { id: 'squat', muscle: 'Quads' }] as Exercise[];
    expect(muscleSets(workouts, sets, exercises, 28, now)).toEqual([{ muscle: 'Chest', sets: 3 }, { muscle: 'Quads', sets: 1 }]);
  });

  it('marks trained weekdays and counts the week streak', () => {
    expect(daysTrainedThisWeek(workouts, now)).toEqual([false, true, false, false, false, false, false]);
    expect(weekStreak(workouts, now)).toBe(3);
    expect(weekStreak([w('x', 2026, 10, 4)], now)).toBe(1); // last week still counts
    expect(weekStreak([w('x', 2026, 9, 1)], now)).toBe(0);
  });

  it('builds a per-session series for one exercise', () => {
    const sessions = [{ workout: workouts[1]!, sets: [sets[2]!] }, { workout: workouts[0]!, sets: [sets[0]!] }];
    expect(exerciseSeries(sessions).map((p) => [p.date.slice(5), p.topKg, p.volumeKg])).toEqual([['11-03', 95, 475], ['11-10', 100, 500]]);
  });
});

describe('exercise demos', () => {
  it('has photos and steps for every starter exercise', () => {
    for (const e of LIBRARY) {
      expect(GUIDE[e.id]?.steps.length, e.name).toBeGreaterThan(0);
      expect(existsSync(`public/exercises/${e.id}-0.jpg`) && existsSync(`public/exercises/${e.id}-1.jpg`), e.name).toBe(true);
    }
  });
});
