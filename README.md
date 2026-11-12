# Hub

One home for all my helpers. Live at **https://duplic8e.github.io/H-U-B/**.

| Path | Helper | Source |
|---|---|---|
| `/H-U-B/` | The Hub: tiles, and the one cloud connection | this repo |
| `/H-U-B/ledger/` | Ledger: budget, investments, planning | [Duplic8e/Financial](https://github.com/Duplic8e/Financial) |
| `/H-U-B/torque/` | Torque: car maintenance | [Duplic8e/Torque](https://github.com/Duplic8e/Torque) |
| `/H-U-B/lift/` | Lift: gym workouts, records, progress | `apps/lift` in this repo |

Ledger and Torque keep their own repos and are developed there. Lift lives in `apps/lift` here
(`cd apps/lift && npm ci && npm test && npm run dev`). This repo builds all of them and serves
them as one site (`.github/workflows/deploy.yml`).

## Your data lives online

On iPhone, deleting a home-screen app deletes everything it stored. So every helper also keeps its data in
one **private** GitHub repo you own, [Duplic8e/H-U-B-helper](https://github.com/Duplic8e/H-U-B-helper):

```
H-U-B-helper/
  ledger/data.json      Ledger's full backup
  torque/data.json      Torque's records (photos in torque/attachments/)
  lift/data.json        Lift's routines, workouts and sets
```

Every sync is a commit, so the repo's history is also a full undo history.

### One-time setup

1. Create a fine-grained token at GitHub → Settings → Developer settings → Fine-grained tokens:
   **Only select repositories → H-U-B-helper**, **Repository permissions → Contents: Read and write**, nothing else.
   Save it in your password manager.
2. Open the Hub → ⚙ Settings → paste the token → **Connect**.
3. Open Ledger and Torque once each. They pick up the connection by themselves and upload.

### After deleting the app or getting a new phone

Open the Hub in Safari → Share → Add to Home Screen → ⚙ Settings → same token → Connect. Then open each
helper: Ledger and Torque restore their own data from the cloud.

### How the sync behaves

- **Torque** merges record by record (newest edit wins), so two devices never conflict.
- **Ledger** syncs whole snapshots. If this device and another both changed since the last sync, Ledger
  asks which copy to keep (Settings → Sync). The other copy stays in the repo history.
- The token stays on the device (browser storage on the Hub's origin). It is sent only to `api.github.com`
  and is never written to any repository.

## Deploying

One-time: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The site rebuilds on every push to `main` here, once a day (to pick up changes merged into the helpers), and
on demand from **Actions → Build and deploy the Hub → Run workflow**, which can also build a branch of a
helper for testing.

## Adding a helper

1. Make its Vite build read `BASE_PATH` for `base`, and show a link to `VITE_HUB_URL` when it is set.
2. Have it read the `hub-cloud` localStorage entry (`{ owner, repo, token }`) and keep its data under
   `<id>/` in the data repo.
3. Add it to `src/apps.ts` and add a build step to the workflow.

## Develop

```sh
npm ci
npm run dev
npm test
npm run build
```

`tests/e2e/lift.mjs` drives Lift the same way: set up, two workouts, records, a unit switch,
sync, and a fresh-install restore.

`tests/e2e/hub.mjs` drives the assembled site against a simulated GitHub: connect, use both helpers, wipe
the browser, and check both restore. See the comment at its top for how to run it.
