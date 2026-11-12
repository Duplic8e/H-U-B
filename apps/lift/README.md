# Lift

Gym workout log for the Hub, served at `/H-U-B/lift/`.

- **Routines** in a weekly rotation: Today offers the one after the routine you did last.
- **Workouts** pre-filled with last time's weight and reps, a tick per set that starts the rest timer, and a
  "Try +2.5 kg / +5 lb" hint when every set reached the top of its rep range last time.
- **Records** per exercise (heaviest, estimated 1RM, best session volume) and a progress chart.
- **kg or lb**, switchable at any time: weights are stored in kg and shown in your unit.
- **Offline first** (IndexedDB), backed up to `lift/data.json` in the Hub's private data repo through the
  Hub's one GitHub connection. Edits from two devices merge by row, newest edit winning.

```sh
npm ci
npm test         # data, stats, rotation, merge and sync against a simulated GitHub
npm run dev
```

## Exercise demos

Each starter exercise has a start and an end photo that alternate to show the movement, plus written steps.
The photos and steps come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), which is
released into the public domain (Unlicense). They live in `public/exercises/` and are cached on the phone
the first time each one is shown. Exercises you create yourself have no demo.
