# Ledger

A private, offline-first personal finance dashboard: budgeting, investments,
planning and compensation. Everything is stored in your own browser. There is
no backend, no account, and no telemetry. Optional Google Drive sync moves a
snapshot between your own devices using your own OAuth client, with the
narrow `drive.file` scope.

Live at https://miishat.github.io/ledger/

## Running it

```bash
npm ci
npm run dev
```

The app is served under the `/ledger/` base path with hash routing, so the dev
URL is http://localhost:5173/ledger/#/budget.

## Verifying it

```bash
npm run verify
```

That runs, in order: eslint, the unit suite (vitest), a production build, and
three guard scripts, then the end-to-end suite (Playwright, five viewport
projects). CI runs exactly this on every push and pull request. All of it must
be green before a change lands.

Individual pieces:

| Command | What it checks |
|---|---|
| `npm run lint` | eslint over the whole repo |
| `npm test` | unit and component tests, watch mode |
| `npm test -- --run` | unit and component tests, once |
| `npm run build` | `tsc -b` then a production vite build |
| `npm run check:bundle` | no chunk over budget, entry graph within budget |
| `npm run check:eager` | recharts stays out of the eager entry graph |
| `npm run check:type-scale` | no raw `text-[10px]` / `text-[11px]` |
| `npm run e2e` | Playwright, five viewport projects |

## Layout

| Path | Responsibility |
|---|---|
| `src/utils/finance` | Pure financial maths: tax, amortization, forecasting, Monte Carlo. No React. |
| `src/utils/budget` | Pure budget maths: periods, splits, recurrence, dedupe, category stats. |
| `src/utils/investments` | Pure portfolio maths: valuation, allocation, realized gains, the wheel. |
| `src/store` | zustand stores, all persisted to localStorage. `storageKeys.ts` is the registry. |
| `src/services/marketData` | Quote, historical and FX fetching, with caching and in-flight dedup. |
| `src/components` | Presentation, grouped by feature area. |
| `src/pages` | One per route. |
| `e2e` | Playwright guards, including per-theme accessibility. |
| `scripts` | The three bespoke build guards. |
| `docs/superpowers/plans` | Implementation plans, one per project. |

The maths layer is pure and fully unit-tested; components read through it and
never re-derive a number themselves.

## Data and storage

Every persisted store is registered in `src/store/storageKeys.ts`. Adding a
store there is all it takes for it to be included in backups and Drive
snapshots. **Never change a value in that registry**: it is the on-disk
contract with existing installs.

`src/utils/backup.ts` builds and restores the backup envelope. Snapshots carry
the writing app's version, and a pull only prunes stores the writing build
actually knew about, so syncing from a device on an older release cannot
destroy data that release predates.

A snapshot carries every registered store not explicitly excluded, including
the market data API key in plain text if one has been set. Treat backup files
and your Drive folder as you would the key itself: do not share them with
someone you would not give the credential to.

## Themes

Six themes, defined as CSS custom properties in `src/index.css` under
`[data-theme='...']`. Adding a seventh means touching every block in that file
plus `useThemeStore.ts` (`AppTheme`, `THEME_CYCLE`, `LIGHT_THEMES`,
`THEME_BACKGROUNDS`), `themeSwatches.ts`, and the per-theme e2e guards.

## Disclaimer

Ledger's calculators produce estimates for planning purposes only. They are
not financial, investment, tax, or legal advice.
