/** Every synced row carries these, so two devices merge by id with the newest edit winning. */
export interface Synced {
  id: string;
  updatedAt: string;
  /** Set instead of deleting, so the deletion reaches other devices. */
  deletedAt?: string;
}

export type Unit = 'kg' | 'lb';

export type Muscle = 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core' | 'Full body';
export const MUSCLES: readonly Muscle[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full body'];

export type Equipment = 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Kettlebell' | 'Other';
export const EQUIPMENT: readonly Equipment[] = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Other'];

export interface Exercise extends Synced {
  name: string;
  muscle: Muscle;
  equipment: Equipment;
}

/** One exercise in a routine, with its target. */
export interface RoutineItem {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
}

export interface Routine extends Synced {
  name: string;
  /** Position in the weekly rotation. */
  order: number;
  items: RoutineItem[];
}

export interface Workout extends Synced {
  routineId?: string;
  name: string;
  startedAt: string;
  /** Absent while the workout is in progress. */
  finishedAt?: string;
  /** Exercise order as shown during the workout. */
  exerciseIds: string[];
  notes?: string;
}

export interface SetEntry extends Synced {
  workoutId: string;
  exerciseId: string;
  /** 1-based position within this exercise. */
  setNo: number;
  /** Always stored in kilograms; shown in the user's unit. */
  weightKg: number;
  reps: number;
  done: boolean;
}

export interface Settings extends Synced {
  unit: Unit;
  defaultRestSec: number;
}

export const SETTINGS_ID = 'settings';

/** Everything that syncs, as one document. */
export interface Dump {
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  sets: SetEntry[];
  settings: Settings[];
}
