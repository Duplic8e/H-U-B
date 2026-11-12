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
