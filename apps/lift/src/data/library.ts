import type { Equipment, Muscle } from './types';

/** Starter exercises. Ids are stable so templates can point at them and two
 *  devices that both seeded the library end up with the same rows. */
export const LIBRARY: ReadonlyArray<{ id: string; name: string; muscle: Muscle; equipment: Equipment }> = [
  { id: 'ex-bench', name: 'Bench Press', muscle: 'Chest', equipment: 'Barbell' },
  { id: 'ex-incline-db', name: 'Incline Dumbbell Press', muscle: 'Chest', equipment: 'Dumbbell' },
  { id: 'ex-db-bench', name: 'Dumbbell Bench Press', muscle: 'Chest', equipment: 'Dumbbell' },
  { id: 'ex-chest-fly', name: 'Cable Fly', muscle: 'Chest', equipment: 'Cable' },
  { id: 'ex-pushup', name: 'Push-up', muscle: 'Chest', equipment: 'Bodyweight' },
  { id: 'ex-dip', name: 'Dip', muscle: 'Triceps', equipment: 'Bodyweight' },
  { id: 'ex-ohp', name: 'Overhead Press', muscle: 'Shoulders', equipment: 'Barbell' },
  { id: 'ex-db-shoulder', name: 'Dumbbell Shoulder Press', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'ex-lateral', name: 'Lateral Raise', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'ex-face-pull', name: 'Face Pull', muscle: 'Shoulders', equipment: 'Cable' },
  { id: 'ex-rear-delt', name: 'Rear Delt Fly', muscle: 'Shoulders', equipment: 'Machine' },
  { id: 'ex-pushdown', name: 'Triceps Pushdown', muscle: 'Triceps', equipment: 'Cable' },
  { id: 'ex-skull', name: 'Skull Crusher', muscle: 'Triceps', equipment: 'Barbell' },
  { id: 'ex-oh-ext', name: 'Overhead Triceps Extension', muscle: 'Triceps', equipment: 'Cable' },
  { id: 'ex-deadlift', name: 'Deadlift', muscle: 'Back', equipment: 'Barbell' },
  { id: 'ex-row', name: 'Barbell Row', muscle: 'Back', equipment: 'Barbell' },
  { id: 'ex-db-row', name: 'Dumbbell Row', muscle: 'Back', equipment: 'Dumbbell' },
  { id: 'ex-pullup', name: 'Pull-up', muscle: 'Back', equipment: 'Bodyweight' },
  { id: 'ex-lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable' },
  { id: 'ex-cable-row', name: 'Seated Cable Row', muscle: 'Back', equipment: 'Cable' },
  { id: 'ex-curl', name: 'Barbell Curl', muscle: 'Biceps', equipment: 'Barbell' },
  { id: 'ex-db-curl', name: 'Dumbbell Curl', muscle: 'Biceps', equipment: 'Dumbbell' },
  { id: 'ex-hammer', name: 'Hammer Curl', muscle: 'Biceps', equipment: 'Dumbbell' },
  { id: 'ex-squat', name: 'Back Squat', muscle: 'Quads', equipment: 'Barbell' },
  { id: 'ex-front-squat', name: 'Front Squat', muscle: 'Quads', equipment: 'Barbell' },
  { id: 'ex-leg-press', name: 'Leg Press', muscle: 'Quads', equipment: 'Machine' },
  { id: 'ex-leg-ext', name: 'Leg Extension', muscle: 'Quads', equipment: 'Machine' },
  { id: 'ex-split-squat', name: 'Bulgarian Split Squat', muscle: 'Quads', equipment: 'Dumbbell' },
  { id: 'ex-lunge', name: 'Walking Lunge', muscle: 'Quads', equipment: 'Dumbbell' },
  { id: 'ex-rdl', name: 'Romanian Deadlift', muscle: 'Hamstrings', equipment: 'Barbell' },
  { id: 'ex-leg-curl', name: 'Leg Curl', muscle: 'Hamstrings', equipment: 'Machine' },
  { id: 'ex-hip-thrust', name: 'Hip Thrust', muscle: 'Glutes', equipment: 'Barbell' },
  { id: 'ex-calf', name: 'Standing Calf Raise', muscle: 'Calves', equipment: 'Machine' },
  { id: 'ex-plank', name: 'Plank', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'ex-hanging-raise', name: 'Hanging Leg Raise', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'ex-cable-crunch', name: 'Cable Crunch', muscle: 'Core', equipment: 'Cable' },
  { id: 'ex-kb-swing', name: 'Kettlebell Swing', muscle: 'Full body', equipment: 'Kettlebell' },
];

type Item = [exerciseId: string, sets: number, repsMin: number, repsMax: number, restSec: number];
export interface Template { id: string; name: string; description: string; routines: Array<{ name: string; items: Item[] }> }

export const TEMPLATES: readonly Template[] = [
  {
    id: 'ppl', name: 'Push / Pull / Legs', description: 'Three days that repeat. Run it 3 or 6 days a week.',
    routines: [
      { name: 'Push', items: [['ex-bench', 4, 6, 8, 150], ['ex-ohp', 3, 6, 10, 120], ['ex-incline-db', 3, 8, 12, 90], ['ex-lateral', 3, 12, 15, 60], ['ex-pushdown', 3, 10, 12, 60]] },
      { name: 'Pull', items: [['ex-deadlift', 3, 4, 6, 180], ['ex-pullup', 3, 6, 10, 120], ['ex-cable-row', 3, 8, 12, 90], ['ex-face-pull', 3, 12, 15, 60], ['ex-db-curl', 3, 10, 12, 60]] },
      { name: 'Legs', items: [['ex-squat', 4, 5, 8, 180], ['ex-rdl', 3, 8, 10, 120], ['ex-leg-press', 3, 10, 12, 90], ['ex-leg-curl', 3, 10, 12, 60], ['ex-calf', 4, 10, 15, 60]] },
    ],
  },
  {
    id: 'upper-lower', name: 'Upper / Lower', description: 'Four days a week, each half of the body twice.',
    routines: [
      { name: 'Upper A', items: [['ex-bench', 4, 5, 8, 150], ['ex-row', 4, 6, 10, 120], ['ex-ohp', 3, 8, 10, 90], ['ex-lat-pulldown', 3, 10, 12, 90], ['ex-db-curl', 2, 10, 12, 60], ['ex-pushdown', 2, 10, 12, 60]] },
      { name: 'Lower A', items: [['ex-squat', 4, 5, 8, 180], ['ex-rdl', 3, 8, 10, 120], ['ex-leg-ext', 3, 10, 15, 60], ['ex-calf', 4, 10, 15, 60], ['ex-plank', 3, 30, 60, 60]] },
      { name: 'Upper B', items: [['ex-incline-db', 4, 8, 10, 120], ['ex-pullup', 4, 6, 10, 120], ['ex-db-shoulder', 3, 8, 12, 90], ['ex-cable-row', 3, 10, 12, 90], ['ex-lateral', 3, 12, 15, 60]] },
      { name: 'Lower B', items: [['ex-deadlift', 3, 4, 6, 180], ['ex-split-squat', 3, 8, 10, 90], ['ex-leg-curl', 3, 10, 12, 60], ['ex-hip-thrust', 3, 8, 12, 90], ['ex-hanging-raise', 3, 10, 15, 60]] },
    ],
  },
  {
    id: 'full-body', name: 'Full Body', description: 'Three days a week, everything each time.',
    routines: [
      { name: 'Full Body A', items: [['ex-squat', 3, 5, 8, 180], ['ex-bench', 3, 5, 8, 150], ['ex-row', 3, 8, 10, 120], ['ex-lateral', 2, 12, 15, 60]] },
      { name: 'Full Body B', items: [['ex-deadlift', 3, 4, 6, 180], ['ex-ohp', 3, 6, 8, 120], ['ex-lat-pulldown', 3, 10, 12, 90], ['ex-hammer', 2, 10, 12, 60]] },
      { name: 'Full Body C', items: [['ex-front-squat', 3, 6, 8, 150], ['ex-incline-db', 3, 8, 12, 90], ['ex-cable-row', 3, 10, 12, 90], ['ex-cable-crunch', 3, 12, 15, 60]] },
    ],
  },
];
