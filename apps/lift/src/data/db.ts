import Dexie, { type Table } from 'dexie';
import type { Exercise, Routine, SetEntry, Settings, Workout } from './types';

/** Device-local values (sync bookkeeping). Never synced or exported. */
export interface KvRow {
  key: string;
  value: unknown;
}

export class LiftDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  workouts!: Table<Workout, string>;
  sets!: Table<SetEntry, string>;
  settings!: Table<Settings, string>;
  kv!: Table<KvRow, string>;

  constructor(name = 'lift') {
    super(name);
    this.version(1).stores({
      exercises: 'id, name',
      routines: 'id, order',
      workouts: 'id, startedAt, finishedAt, routineId',
      sets: 'id, workoutId, exerciseId, [workoutId+exerciseId]',
      settings: 'id',
      kv: 'key',
    });
  }
}
