# Audit Remediation to Ten (Non-Security) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the four non-security audit dimensions from their post-0.9.2 scores (Performance 8, UX 9.5, Accessibility 8.5, Engagement 9) to 10 each, moving the overall audit score from 80/100 to 90/100. Security stays at 5 and is out of scope, as before.

**Architecture:** The single largest item is a genuine discovery made while researching this plan, not a guess: recharts is still eagerly loaded because the always-mounted Command Palette imports the planner tool registry, which couples tool metadata to tool component references. Splitting that coupling removes roughly 408 kB from the first-load graph and retires the "rolldown limitation" conclusion recorded during v0.9.2. Everything else is a set of narrow, well-evidenced fixes: five measured contrast failures, one keyboard gap on mobile, one off-by-a-day reminder bug, and auto-sync restricted to the sync decisions that are already provably unambiguous.

**Tech Stack:** React 19, TypeScript 6, Vite 8 (rolldown), Tailwind 4, Zustand 5, Vitest 4, Testing Library, Playwright, axe-core. No new dependencies.

## Global Constraints

- No em dashes anywhere: source, comments, tests, UI copy, commit messages. Standing project rule.
- `src/store/storageKeys.ts` is append-only. Never edit an existing value.
- No app version series hardcoded into test assertions.
- Every task must pass all four gates before its commit: `npx eslint .` (0 problems), `npx tsc -b` (0 errors), `npx vitest run`, and where the task touches build output or the DOM, `npm run e2e`. The `tsc` gate is not optional: during v0.9.2 a real type error shipped past a task review because only vitest and eslint were run.
- Stage explicit file paths. Never `git add -A`; this checkout carries untracked scratch directories.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Baseline at plan start: 1119 tests / 177 files, eslint 0, tsc 0, entry chunk 233.4 kB, e2e 11/11 with 5/5 routes at zero serious or critical axe violations.

## Research Findings This Plan Is Built On

These were measured during planning. Implementers should not re-derive them, but the guards added here will keep them true.

1. **Recharts is eagerly reachable, and it is not a bundler defect.** A static import-graph trace from `src/main.tsx` (following `import ... from` only, never `import()`) finds 131 eagerly reachable files, six of which import `recharts`, all via one chain: `main.tsx -> App.tsx -> Layout.tsx -> CommandPalette.tsx -> commandActions.ts -> planner/toolRegistry.tsx -> {RentVsBuyCalculator, MortgageCalculator, DebtPayoffCalculator, CompoundInterestCalculator, forecaster/MonteCarloSection, forecaster/ForecastChart} -> recharts`. The v0.9.2 investigation concluded this was a rolldown limitation after checking only the Dashboard's widgets; it never traced Layout's always-mounted Command Palette. `commandActions.ts` uses only `t.id`, `t.name` and `t.description`.
2. **`PlannerTool.tsx` is the only consumer of `tool.component`.** `Planner.tsx` and `ToolSwitcher.tsx` read `group`, `name`, `description` and `icon`; `ToolInfoButton.tsx` reads `info`. `PlannerTool` is already `React.lazy` in `App.tsx`.
3. **Five contrast failures remain, all using the `/50` opacity modifier**, and all fail in every theme. Computed by compositing the token over its background: luxury 2.65, tactical 2.70, aurora 2.71, glass 3.94, geometric 2.34, against a 4.5:1 requirement. Two of them (`AccountCategoryWidget`'s edit and delete icon buttons) are UI components that fail even the relaxed 3:1 threshold. The sites are `TransactionListWidget.tsx` (search placeholder), `AccountCategoryWidget.tsx` (two icon buttons), `AddAccountModal.tsx` (two input placeholders). The `/80` sites all pass (4.53 to 8.66) and are deliberately left alone.
4. **The axe gate cannot see those five.** It scans five routes at desktop width only, so modal placeholders and hover-revealed icon buttons are never rendered during the scan.
5. **The mobile transaction card is a plain `<div>` with `onClick`**, no `role`, no `tabIndex`, no key handler (`TransactionListWidget.tsx`, the `md:hidden` branch). It is a real WCAG 2.1.1 failure on a primary flow. The card list also maps the full unwindowed `txList`.
6. **`TriageInboxWidget` and `CategoryManagerWidget` use real `<button>` elements** with zero clickable divs. They are already keyboard operable and satisfy 2.1.1. Adding arrow-key navigation would be a convenience, not a conformance fix, so it is explicitly out of scope for this plan.
7. **Sync decisions already separate safe from unsafe outcomes.** `src/utils/syncDecision.ts` defines `PushDecision` as `nothing-to-push | clean | diverged` and `PullDecision` as `nothing-remote | up-to-date | clean | would-lose-local | collision`. Auto-sync can act on `clean` alone and defer everything else to the existing manual flow.
8. **Precaching and eager loading are independent.** A chunk can be precached (background, after install, good for offline) without being statically imported by the entry (blocking, bad for first paint). The goal is to leave the entry's static graph while staying precached.

## File Structure

**New files**
- `scripts/check-eager-graph.mjs`: permanent guard asserting no eagerly reachable module imports `recharts`. This is the regression guard for Finding 1.
- `src/components/planner/toolComponents.tsx`: maps tool id to component, imported only by `PlannerTool.tsx`.
- `src/utils/reminders.dueDate.test.ts` is not needed; due-date cases go into the existing `src/utils/reminders.test.ts`.
- `src/utils/autoSync.ts` and `src/utils/autoSync.test.ts`: pure decision layer for automatic syncing.
- `e2e/a11y-mobile.spec.ts`: axe scan at a mobile viewport.

**Modified files**
- `src/components/planner/toolRegistry.tsx`: drops the `component` field and its twelve component imports.
- `src/pages/PlannerTool.tsx`: resolves the component from the new map.
- `scripts/check-bundle.mjs`: gains an initial-load-graph budget.
- `src/components/budget/TransactionListWidget.tsx`: mobile card virtualization, keyboard operability, `ROW_HEIGHT` honesty, placeholder contrast.
- `src/components/dashboard/AccountCategoryWidget.tsx`, `src/components/dashboard/AddAccountModal.tsx`: contrast.
- `src/utils/contrast.ts` and `src/utils/contrast.test.ts`: alpha-aware contrast, low-alpha token guard.
- `src/utils/reminders.ts` and `src/utils/reminders.test.ts`: calendar-day comparison.
- `src/components/settings/DriveSyncControls.tsx`: auto-sync opt-in control.
- `src/components/Layout.tsx`: auto-sync trigger on visibility change, and a demo banner that subscribes to the demo flag instead of reading it during render.
- `src/utils/demoData.ts` and `src/utils/demoData.test.ts`: an observable demo flag.
- `src/components/settings/BackupControls.tsx`: demo flag writes routed through the observable setter.
- `src/components/dashboard/FirstRunChecklist.tsx` and its test: a persisted dismiss control.
- `src/utils/backup.test.ts`: expectation list updated for the two new non-backup keys.
- `package.json`, `CHANGELOG.md`, `docs/superpowers/plans/PROGRESS.md`.

---

### Task 1: Prove the eager-graph guard fails, then split the tool registry

This is the highest-value task in the plan. It removes about 408 kB from what every visitor downloads before first paint, on every route, including routes with no charts.

**Files:**
- Create: `scripts/check-eager-graph.mjs`
- Create: `src/components/planner/toolComponents.tsx`
- Modify: `src/components/planner/toolRegistry.tsx`
- Modify: `src/pages/PlannerTool.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `npm run check:eager` exits non-zero when any eagerly reachable module imports `recharts`. `PLANNER_TOOL_COMPONENTS: Record<string, React.ComponentType>` exported from `src/components/planner/toolComponents.tsx`. The `PlannerTool` interface in `toolRegistry.tsx` loses its `component` field; every other field stays.

- [ ] **Step 1: Write the guard**

Create `scripts/check-eager-graph.mjs`:

```js
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, extname, relative } from 'node:path'

// Modules that must never be reachable from the entry through static imports.
// A static import is blocking: the browser must fetch and evaluate it before
// first paint. A dynamic import() is a split point and is deliberately not
// followed here.
const FORBIDDEN = ['recharts']

function resolveImp(from, spec) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(from), spec)
  const cands = [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx']
  for (const c of cands) if (existsSync(c) && extname(c)) return c
  return null
}

function staticImports(file) {
  const src = readFileSync(file, 'utf8')
  const out = []
  let m
  const re = /^[ \t]*import\s+[\s\S]*?\s*from\s*['"]([^'"]+)['"]/gm
  while ((m = re.exec(src))) out.push(m[1])
  const re2 = /^[ \t]*import\s*['"]([^'"]+)['"]/gm
  while ((m = re2.exec(src))) out.push(m[1])
  return out
}

const cwd = process.cwd()
const rel = (p) => relative(cwd, p).split('\\').join('/')
const entry = resolve('src/main.tsx')
const seen = new Set()
const parents = new Map()
const stack = [entry]
const offenders = []

while (stack.length) {
  const f = stack.pop()
  if (seen.has(f)) continue
  seen.add(f)
  let imps
  try { imps = staticImports(f) } catch { continue }
  for (const bad of FORBIDDEN) {
    if (imps.includes(bad)) offenders.push({ file: f, pkg: bad })
  }
  for (const spec of imps) {
    const r = resolveImp(f, spec)
    if (r && !seen.has(r)) { parents.set(r, f); stack.push(r) }
  }
}

console.log(`Eager static graph from src/main.tsx: ${seen.size} files.`)

if (offenders.length > 0) {
  console.error('\nForbidden packages are reachable without a dynamic import:')
  for (const o of offenders) {
    console.error(`\n  ${o.pkg} <- ${rel(o.file)}`)
    let p = parents.get(o.file)
    let depth = 0
    while (p && depth++ < 10) {
      console.error(`    imported by ${rel(p)}`)
      p = parents.get(p)
    }
  }
  console.error('\nBreak one link in each chain with React.lazy or a dynamic import.')
  process.exit(1)
}

console.log('No forbidden package is eagerly reachable.')
```

- [ ] **Step 2: Add the script and run it to watch it fail**

In `package.json` add to `"scripts"`:

```json
"check:eager": "node scripts/check-eager-graph.mjs"
```

Run:

```bash
npm run check:eager
```

Expected: FAIL, exit 1, listing six offenders, each chain ending `imported by src/components/planner/toolRegistry.tsx` then `commandActions.ts`, `CommandPalette.tsx`, `Layout.tsx`, `App.tsx`, `main.tsx`. If you see anything different, stop and report it, because the plan's central premise has changed.

- [ ] **Step 3: Create the component map**

Create `src/components/planner/toolComponents.tsx`. Move the twelve component imports here verbatim from `toolRegistry.tsx`:

```tsx
import React from 'react'
import { ForecasterTool } from './forecaster/ForecasterTool'
import { CompoundInterestCalculator } from './CompoundInterestCalculator'
import { DebtPayoffCalculator } from './DebtPayoffCalculator'
import { EmergencyFundCalculator } from './EmergencyFundCalculator'
import { SavingsGoalCalculator } from './SavingsGoalCalculator'
import { CurrencyConverter } from './CurrencyConverter'
import { RaiseInflationCalculator } from './RaiseInflationCalculator'
import { MortgageCalculator } from './MortgageCalculator'
import { RentVsBuyCalculator } from './RentVsBuyCalculator'
import { SalaryTaxTool } from './SalaryTaxTool'
import { InflationAdjusterCalculator } from './InflationAdjusterCalculator'
import { RateConverterCalculator } from './RateConverterCalculator'

/** Tool id to component. Kept out of toolRegistry.tsx on purpose: the registry
 *  is imported by the always-mounted Command Palette, so anything the registry
 *  imports is downloaded and evaluated before first paint on every route. Six
 *  of these calculators pull in recharts, which is why they live behind the
 *  lazily loaded PlannerTool page instead. scripts/check-eager-graph.mjs
 *  fails the build if that separation is ever undone. */
export const PLANNER_TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  forecaster: ForecasterTool,
  'compound-interest': CompoundInterestCalculator,
  'debt-payoff': DebtPayoffCalculator,
  'emergency-fund': EmergencyFundCalculator,
  'savings-goal': SavingsGoalCalculator,
  'currency-converter': CurrencyConverter,
  'raise-inflation': RaiseInflationCalculator,
  mortgage: MortgageCalculator,
  'rent-vs-buy': RentVsBuyCalculator,
  'salary-tax': SalaryTaxTool,
  'inflation-adjuster': InflationAdjusterCalculator,
  'rate-converter': RateConverterCalculator,
}
```

The keys above must match the `id` of each entry in `PLANNER_TOOLS` exactly. Read `toolRegistry.tsx` and copy each `id` verbatim rather than trusting this list; if any id differs, use the real one and note the correction in your report.

- [ ] **Step 4: Strip components out of the registry**

In `src/components/planner/toolRegistry.tsx`:

1. Delete all twelve component import lines (the `import { ForecasterTool } ...` block).
2. Delete `component: React.ComponentType` from the `PlannerTool` interface.
3. Delete the `component: X,` line from every entry in `PLANNER_TOOLS`.
4. Keep the `React` import only if the file still needs it; if TypeScript reports it unused, remove it.

Everything else in the file, including `PLANNER_GROUPS`, `ToolInfo`, `getTool` and all metadata, stays unchanged.

- [ ] **Step 5: Resolve the component at the page**

In `src/pages/PlannerTool.tsx`, add the import:

```tsx
import { PLANNER_TOOL_COMPONENTS } from '../components/planner/toolComponents'
```

Replace:

```tsx
  const Component = tool.component
```

with:

```tsx
  const Component = PLANNER_TOOL_COMPONENTS[tool.id]
  if (!Component) return <Navigate to="/planner" replace />
```

The extra guard keeps a metadata entry with no matching component from crashing the route.

- [ ] **Step 6: Verify the guard now passes**

```bash
npm run check:eager
```

Expected: PASS, "No forbidden package is eagerly reachable."

- [ ] **Step 7: Verify the build actually moved the bytes**

```bash
npm run build && npm run check:bundle
```

Then confirm the entry chunk no longer statically imports a charts chunk:

```bash
node -e "const fs=require('fs');const f=fs.readdirSync('dist/assets').find(n=>n.startsWith('index-')&&n.endsWith('.js'));const s=fs.readFileSync('dist/assets/'+f,'utf8');const m=s.match(/import\s*\{[^}]*\}\s*from\s*[\"']\.\/charts-/g);console.log(f, m?('STILL IMPORTS '+[...new Set(m)].join(', ')):'no charts import')"
```

Expected: "no charts import". If it still imports charts, run `npm run check:eager` again; if that passes but the build still links charts eagerly, then and only then is there a genuine bundler issue, and you should report BLOCKED with both outputs rather than working around it.

- [ ] **Step 8: Verify the app still works**

```bash
npx tsc -b && npx eslint . && npx vitest run && npm run e2e
```

Expected: tsc 0, eslint 0, full unit suite green, e2e all green. Pay attention to any Planner test: `Planner.test.tsx`, `ToolSwitcher.test.tsx` and `ToolInfoButton.test.tsx` all import the registry, and a test asserting on `tool.component` must be updated to use `PLANNER_TOOL_COMPONENTS` instead. Do not delete such a test; rewrite its lookup.

Then confirm every planner tool still renders, since this task rewires how components are found:

```bash
npm run e2e -- e2e/smoke.spec.ts
```

- [ ] **Step 9: Commit**

```bash
git add scripts/check-eager-graph.mjs src/components/planner/toolComponents.tsx src/components/planner/toolRegistry.tsx src/pages/PlannerTool.tsx package.json
git commit -m "perf: keep recharts out of the first-load graph"
```

---

### Task 2: Budget the initial-load graph, not just single chunks

`scripts/check-bundle.mjs` measures per-chunk size, so it reports green when one oversized eager chunk is split into several smaller eager chunks even though the user downloads exactly as much. The v0.9.2 final review flagged this blind spot explicitly.

**Files:**
- Modify: `scripts/check-bundle.mjs`

**Interfaces:**
- Consumes: Task 1's smaller eager graph.
- Produces: `npm run check:bundle` additionally fails when the entry chunk plus its transitive static imports exceeds a byte budget.

- [ ] **Step 1: Add the initial-load walk**

In `scripts/check-bundle.mjs`, add this budget next to the existing ones:

```js
// Total raw bytes the browser must fetch and evaluate before first paint:
// the entry chunk plus everything it statically imports, transitively. The
// per-chunk budgets above cannot see this, so splitting one eager chunk into
// three eager chunks used to pass while changing nothing for the user.
const MAX_INITIAL_LOAD_KB = 620
```

and this walk, after `sized` is computed and before the failure report:

```js
function staticDeps(file) {
  const src = readFileSync(join(ASSETS, file), 'utf8')
  const out = new Set()
  const re = /from\s*["']\.\/([A-Za-z0-9_.-]+\.js)["']/g
  let m
  while ((m = re.exec(src))) out.add(m[1])
  const re2 = /import\s*["']\.\/([A-Za-z0-9_.-]+\.js)["']/g
  while ((m = re2.exec(src))) out.add(m[1])
  return [...out]
}

const initial = new Set()
if (entry) {
  const walk = [entry.name]
  while (walk.length) {
    const f = walk.pop()
    if (initial.has(f)) continue
    initial.add(f)
    for (const d of staticDeps(f)) if (!initial.has(d)) walk.push(d)
  }
}
const initialKb = [...initial].reduce(
  (sum, n) => sum + (sized.find((f) => f.name === n)?.kb ?? 0),
  0,
)
console.log(`\nInitial load graph: ${initial.size} chunks, ${initialKb.toFixed(1)} kB raw`)
for (const n of [...initial].sort()) console.log(`    ${n}`)
if (initialKb > MAX_INITIAL_LOAD_KB) {
  failures.push(
    `initial load graph is ${initialKb.toFixed(1)} kB, budget ${MAX_INITIAL_LOAD_KB} kB`,
  )
}
```

This uses only regex matching on emitted chunk text, which is sufficient because rolldown emits relative `./name.js` specifiers between chunks.

- [ ] **Step 2: Run it**

```bash
npm run build && npm run check:bundle
```

Expected: PASS, and the printed initial-load graph should now be roughly `index` + `vendor-react` + `vendor-router` + `motion`, around 580 kB, comfortably under 620. The `charts` and `charts-vendor` chunks must NOT appear in that list.

If the printed total is above 620 kB, do not raise the budget. Report the chunk list and stop: either Task 1 did not fully land, or something else became eager.

- [ ] **Step 3: Prove the budget can fail**

Temporarily lower `MAX_INITIAL_LOAD_KB` to `100`, run `npm run check:bundle`, confirm it exits non-zero with the initial-load failure line, then restore it to `620`. This proves the check is wired into `failures` and not silently dead. Describe the result in your report.

- [ ] **Step 4: Verify and commit**

```bash
npx eslint . && npm run build && npm run check:bundle
git add scripts/check-bundle.mjs
git commit -m "build: budget the initial load graph, not just single chunks"
```

---

### Task 3: Fix the five measured contrast failures

All five use the `/50` opacity modifier on `--text-secondary` and fail AA in every theme. Two are icon buttons that fail even the 3:1 UI-component threshold.

**Files:**
- Modify: `src/components/budget/TransactionListWidget.tsx`
- Modify: `src/components/dashboard/AccountCategoryWidget.tsx`
- Modify: `src/components/dashboard/AddAccountModal.tsx`

**Interfaces:** none produced or consumed.

- [ ] **Step 1: Replace every `/50` on a text token**

Change `text-text-secondary/50` to `text-text-secondary` at all five sites:

- `src/components/budget/TransactionListWidget.tsx`: the search input's `placeholder:text-text-secondary/50`.
- `src/components/dashboard/AccountCategoryWidget.tsx`: two icon buttons, each `text-text-secondary/50 hover:...`. Keep the `sm:opacity-0 sm:group-hover:opacity-100` classes exactly as they are; those control reveal-on-hover and are a separate concern from colour.
- `src/components/dashboard/AddAccountModal.tsx`: two `placeholder:text-text-secondary/50`.

Do not touch any `/80` site. Those measure 4.53 to 8.66 and pass.

- [ ] **Step 2: Verify no `/50` on a text token remains**

```bash
grep -rn "text-text-secondary/50" src/
```

Expected: no matches.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc -b && npx eslint . && npx vitest run && npm run e2e -- e2e/a11y.spec.ts
git add src/components/budget/TransactionListWidget.tsx src/components/dashboard/AccountCategoryWidget.tsx src/components/dashboard/AddAccountModal.tsx
git commit -m "fix(a11y): raise five sub-AA opacity-modified labels to full opacity"
```

---

### Task 4: Guard the contrast class that token math cannot see

Two guards. First, teach `contrast.ts` about alpha so a test can evaluate an opacity-modified colour. Second, scan a mobile viewport with axe, which is where the modal placeholders and the card list actually render.

**Files:**
- Modify: `src/utils/contrast.ts`
- Modify: `src/utils/contrast.test.ts`
- Create: `e2e/a11y-mobile.spec.ts`

**Interfaces:**
- Produces: `compositeOver(fg: string, bg: string, alpha: number): string` exported from `src/utils/contrast.ts`, returning a `#rrggbb` string.

- [ ] **Step 1: Write the failing test**

Append to `src/utils/contrast.test.ts`:

```ts
import { compositeOver } from './contrast'

describe('opacity-modified text', () => {
  it('composites a colour over a background at an alpha', () => {
    expect(compositeOver('#ffffff', '#000000', 0.5)).toBe('#808080')
    expect(compositeOver('#ffffff', '#000000', 1)).toBe('#ffffff')
    expect(compositeOver('#ffffff', '#000000', 0)).toBe('#000000')
  })

  // Tailwind's /50 modifier on a text token fell below AA in every theme.
  // Anything reintroducing it should fail here rather than reaching users.
  it.each(themeBlocks().map((b) => [b.name, b] as const))(
    '%s secondary text at 50 percent opacity is below AA, so the modifier must not be used',
    (_name, block) => {
      const faded = compositeOver(block.tokens['text-secondary'], block.tokens['bg-primary'], 0.5)
      expect(contrastRatio(faded, block.tokens['bg-primary'])).toBeLessThan(4.5)
    },
  )
})
```

This second case documents the measurement rather than asserting a passing state: it records that `/50` is unusable on this palette, so a future engineer who tries it has a test explaining why. Pair it with the grep guard in Step 4.

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run src/utils/contrast.test.ts
```

Expected: FAIL, `compositeOver` is not exported.

- [ ] **Step 3: Implement `compositeOver`**

Append to `src/utils/contrast.ts`:

```ts
/** Flattens a partly transparent foreground onto an opaque background, which
 *  is what a Tailwind opacity modifier such as text-white/50 actually renders.
 *  Contrast math needs the flattened colour, not the token's own value. */
export function compositeOver(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg)
  const b = parseHex(bg)
  if (!f || !b) return fg
  const mix = (i: number) => Math.round(f[i] * alpha + b[i] * (1 - alpha))
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(mix(0))}${hex(mix(1))}${hex(mix(2))}`
}
```

- [ ] **Step 4: Add the source guard**

Append to `src/utils/contrast.test.ts`:

```ts
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return p.endsWith('.tsx') || p.endsWith('.ts') ? [p] : []
  })
}

describe('opacity modifiers on text tokens', () => {
  it('never uses an alpha low enough to break AA', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(resolve(__dirname, '..'))) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/text-text-secondary\/(\d+)/g)) {
        if (Number(m[1]) < 80) offenders.push(`${file}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
```

The threshold is 80 because `/80` measures 4.53 in the tightest theme and passes, while `/50` measures 2.34 and fails. If a future palette change moves those numbers, this test and the theme test above should be revisited together.

- [ ] **Step 5: Run both**

```bash
npx vitest run src/utils/contrast.test.ts
```

Expected: PASS. If the source guard fails, Task 3 missed a site; fix the site rather than the threshold.

- [ ] **Step 6: Add the mobile axe scan**

Create `e2e/a11y-mobile.spec.ts`:

```ts
import { test, expect, devices } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const DISCLAIMER_ACK_KEY = 'ledger-disclaimer-ack'

// The desktop scan cannot see the mobile card list, the bottom tab bar, or
// anything a narrow viewport reveals, so those routes are scanned again here.
test.use({ ...devices['Pixel 5'] })

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString())
  }, DISCLAIMER_ACK_KEY)
})

const routes = [
  ['dashboard', ''],
  ['budgeting', '#/budget'],
  ['investments', '#/investments'],
  ['planner', '#/planner'],
  ['compensation', '#/compensation'],
] as const

for (const [name, hash] of routes) {
  test(`${name} has no serious or critical accessibility violations on mobile`, async ({ page }) => {
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
}
```

- [ ] **Step 7: Run it and record what it finds**

```bash
npm run e2e -- e2e/a11y-mobile.spec.ts
```

Record the result in your report. If it reports violations, note their rule ids: Task 6 addresses the mobile card keyboard gap, and any violation that Task 6 will not fix must be reported so it can be triaged before the plan closes. Do not weaken the assertion. If violations remain that no later task covers, report DONE_WITH_CONCERNS naming them.

- [ ] **Step 8: Commit**

```bash
git add src/utils/contrast.ts src/utils/contrast.test.ts e2e/a11y-mobile.spec.ts
git commit -m "test(a11y): guard opacity-modified contrast and scan a mobile viewport"
```

---

### Task 5: Virtualize the mobile transaction card list

The desktop table windows its rows; the card list still mounts every transaction.

**Files:**
- Modify: `src/components/budget/TransactionListWidget.tsx`
- Modify: `e2e/transactions.spec.ts`

**Interfaces:**
- Consumes: `computeWindow` from `src/utils/virtualWindow.ts`, and the existing `selectedSet`.

- [ ] **Step 1: Add a second window for the cards**

Cards are taller than table rows and are laid out in a `flex flex-col gap-3` column. Add next to the existing table windowing state in `TransactionListWidget.tsx`:

```tsx
  // Cards are taller than table rows and carry a 12px gap. This is an
  // estimate, which is why the overscan below is generous: computeWindow
  // degrades to rendering everything when the container is unmeasured, so a
  // wrong estimate costs scroll smoothness, never correctness.
  const CARD_HEIGHT = 116;
  const cardScrollRef = useRef<HTMLDivElement>(null);
  const [cardScrollTop, setCardScrollTop] = useState(0);
  const [cardViewportHeight, setCardViewportHeight] = useState(0);

  useEffect(() => {
    const el = cardScrollRef.current;
    if (el && el.clientHeight !== cardViewportHeight) setCardViewportHeight(el.clientHeight);
  }, [cardViewportHeight]);

  const cardWindow = computeWindow({
    scrollTop: cardScrollTop,
    viewportHeight: cardViewportHeight,
    rowHeight: CARD_HEIGHT,
    totalRows: txList.length,
    overscan: 6,
  });
  const visibleCards = txList.slice(cardWindow.startIndex, cardWindow.endIndex);
```

- [ ] **Step 2: Wire the card container**

Replace the card list container opening tag:

```tsx
          <div data-testid="transactions-cards" className="md:hidden flex flex-col gap-3">
```

with:

```tsx
          <div
            data-testid="transactions-cards"
            ref={cardScrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              setCardScrollTop(el.scrollTop);
              if (el.clientHeight !== cardViewportHeight) setCardViewportHeight(el.clientHeight);
            }}
            className="md:hidden flex flex-col gap-3 max-h-[70dvh] overflow-y-auto"
          >
```

Change `{txList.map(tx => {` in the card branch to `{visibleCards.map(tx => {`, and bracket it with spacers. Immediately before the map:

```tsx
            {cardWindow.padTop > 0 && (
              <div aria-hidden="true" style={{ height: cardWindow.padTop }} />
            )}
```

and immediately after the map's closing `})}`:

```tsx
            {cardWindow.padBottom > 0 && (
              <div aria-hidden="true" style={{ height: cardWindow.padBottom }} />
            )}
```

Take care to change only the `md:hidden` card branch. The desktop table branch above it already has its own windowing and must not be touched.

- [ ] **Step 3: Extend the e2e proof to mobile**

Append to `e2e/transactions.spec.ts`, reusing the seeding approach already in that file (read it first and copy its exact `ledger-budget` seed shape, which was verified against the store's persist config):

```ts
test('renders a long transaction list on mobile without mounting every card', async ({ page }) => {
  // Seed exactly as the desktop test above does, then narrow the viewport.
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/#/budget')
  await page.getByRole('button', { name: 'Transactions' }).click()

  const cards = page.locator('[data-testid="transactions-cards"] [data-testid^="transaction-card-"]')
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeLessThan(60)
})
```

Copy the seeding `addInitScript` block from the existing desktop test in this file so both tests use identical data. Do not invent a different shape.

- [ ] **Step 4: Verify**

```bash
npx tsc -b && npx eslint . && npx vitest run && npm run e2e -- e2e/transactions.spec.ts
```

Expected: all green, and fewer than 60 cards mounted out of 1200. Note that in jsdom `clientHeight` is 0, so `computeWindow` renders everything and existing unit tests keep passing unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/TransactionListWidget.tsx e2e/transactions.spec.ts
git commit -m "perf(budget): virtualize the mobile transaction card list"
```

---

### Task 6: Make the mobile transaction card keyboard operable

A real WCAG 2.1.1 failure: the card is a `<div>` with `onClick` only. This mirrors what Task 9 of the previous plan did for the desktop row.

**Files:**
- Modify: `src/components/budget/TransactionListWidget.tsx`
- Modify: `src/components/budget/TransactionListWidget.test.tsx`

**Interfaces:**
- Consumes: the card markup from Task 5.

- [ ] **Step 1: Write the failing test**

Append to `src/components/budget/TransactionListWidget.test.tsx`, matching the range shape already used in that file (`{ from, to }`):

```ts
describe('TransactionListWidget mobile card keyboard access', () => {
  it('exposes each card as a button and opens it with Enter', () => {
    useBudgetStore.setState({
      transactions: {
        m1: { id: 'm1', date: '2026-08-04', amount: 20, description: 'CARD ROW', type: 'expense' },
      },
      categories: {},
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)

    const cards = screen.getAllByRole('button', { name: /Edit CARD ROW/ })
    expect(cards.length).toBeGreaterThan(0)
    fireEvent.keyDown(cards[0], { key: 'Enter' })
    expect(screen.getByTestId('sheet-panel')).toBeInTheDocument()
  })
})
```

Both the desktop row and the mobile card render in jsdom, so `getAllByRole` is used rather than `getByRole`.

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run src/components/budget/TransactionListWidget.test.tsx
```

Expected: FAIL, only the desktop row matches that accessible name.

- [ ] **Step 3: Make the card operable**

In the `md:hidden` card branch, replace the card's opening `<div>`:

```tsx
              <div
                key={tx.id}
                data-testid={`transaction-card-${tx.id}`}
                onClick={() => setEditingTransaction(tx)}
                className="themed-card rounded-lg p-3 flex flex-col gap-2 cursor-pointer"
              >
```

with:

```tsx
              <div
                key={tx.id}
                data-testid={`transaction-card-${tx.id}`}
                role="button"
                tabIndex={0}
                aria-label={`Edit ${tx.description}`}
                onClick={() => setEditingTransaction(tx)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  // Space would otherwise scroll the card list out from under
                  // the focused card.
                  e.preventDefault()
                  setEditingTransaction(tx)
                }}
                className="themed-card rounded-lg p-3 flex flex-col gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
```

The checkbox and delete button inside already call `e.stopPropagation()`, so they keep working independently.

- [ ] **Step 4: Verify**

```bash
npx tsc -b && npx eslint . && npx vitest run && npm run e2e -- e2e/a11y-mobile.spec.ts
```

Expected: all green, and the mobile axe scan should now be clean. If axe reports a nested-interactive violation because the card carries `role="button"` while containing a checkbox and a delete button, move the role, tabIndex, aria-label and key handler onto the card's description element instead of the outer div, re-run, and describe the change in your report.

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/TransactionListWidget.tsx src/components/budget/TransactionListWidget.test.tsx
git commit -m "fix(a11y): make mobile transaction cards keyboard operable"
```

---

### Task 7: Make the row-height assumption honest

`ROW_HEIGHT = 48` is asserted, never measured. Rows carrying several tag chips can wrap and exceed it, which desynchronises the spacer heights from real scroll offset.

**Files:**
- Modify: `src/components/budget/TransactionListWidget.tsx`

**Interfaces:** none.

- [ ] **Step 1: Measure the first rendered row**

Replace the `const ROW_HEIGHT = 48;` declaration with a measured value that falls back to the constant:

```tsx
  // Measured from the first rendered row rather than assumed: a row carrying
  // several tag chips wraps and exceeds the nominal height, which would
  // desynchronise the spacer rows from the real scroll offset. The constant is
  // only the pre-measurement fallback.
  const NOMINAL_ROW_HEIGHT = 48;
  const [rowHeight, setRowHeight] = useState(NOMINAL_ROW_HEIGHT);
  const firstRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const h = firstRowRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - rowHeight) > 1) setRowHeight(h);
  });
```

Pass `rowHeight` to `computeWindow` in place of `ROW_HEIGHT`, and attach the ref to the first rendered row by adding `ref={i === 0 ? firstRowRef : undefined}` to the `<tr>` inside `visibleRows.map((tx, i) => {`. Change the map signature to take the index if it does not already.

The effect intentionally has no dependency array: it re-measures after every render, and the `> 1` guard stops it looping. If eslint's exhaustive-deps rule objects, add a comment explaining the deliberate omission rather than silencing the rule globally.

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npx eslint . && npx vitest run && npm run e2e -- e2e/transactions.spec.ts
```

Expected: all green, and the desktop virtualization e2e still mounts fewer than 60 rows.

- [ ] **Step 3: Commit**

```bash
git add src/components/budget/TransactionListWidget.tsx
git commit -m "fix(budget): measure the transaction row height instead of assuming it"
```

---

### Task 8: Fire reminders on the due date itself

`dueReminders` compares a date-only string parsed as UTC midnight against the current instant, so a bill due today is already in the past and never notifies. Users get 3, 2 and 1 day of warning, then silence on the day it is due.

**Files:**
- Modify: `src/utils/reminders.ts`
- Modify: `src/utils/reminders.test.ts`

**Interfaces:**
- `dueReminders` keeps its exact signature. Only the comparison changes.

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/reminders.test.ts`:

```ts
describe('dueReminders on the due date', () => {
  it('includes a bill due today', () => {
    const due = dueReminders([{ key: 'rent', label: 'Rent', nextDate: '2026-08-16' }], {
      now: new Date('2026-08-16T09:00:00Z'),
      leadDays: 3,
      ignoredKeys: [],
    })
    expect(due.map((d) => d.key)).toEqual(['rent'])
  })

  it('includes a bill due today even late in the local day', () => {
    const due = dueReminders([{ key: 'rent', label: 'Rent', nextDate: '2026-08-16' }], {
      now: new Date('2026-08-16T23:30:00Z'),
      leadDays: 3,
      ignoredKeys: [],
    })
    expect(due.map((d) => d.key)).toEqual(['rent'])
  })

  it('still excludes a bill that was due yesterday', () => {
    const due = dueReminders([{ key: 'old', label: 'Old', nextDate: '2026-08-15' }], {
      now: new Date('2026-08-16T09:00:00Z'),
      leadDays: 3,
      ignoredKeys: [],
    })
    expect(due).toEqual([])
  })

  it('includes the last day of the lead window and excludes the day after', () => {
    const opts = { now: new Date('2026-08-16T09:00:00Z'), leadDays: 3, ignoredKeys: [] }
    expect(
      dueReminders([{ key: 'edge', label: 'Edge', nextDate: '2026-08-19' }], opts).map((d) => d.key),
    ).toEqual(['edge'])
    expect(dueReminders([{ key: 'past', label: 'Past', nextDate: '2026-08-20' }], opts)).toEqual([])
  })
})
```

- [ ] **Step 2: Run and watch the first two fail**

```bash
npx vitest run src/utils/reminders.test.ts
```

Expected: the two "due today" cases FAIL; the yesterday case passes already.

- [ ] **Step 3: Compare calendar days, not instants**

In `src/utils/reminders.ts`, replace the date filter inside `dueReminders`:

```ts
  const start = opts.now.getTime()
  const end = start + lead * 86_400_000

  return items
    .filter((i) => !ignored.has(i.key))
    .filter((i) => {
      const t = new Date(i.nextDate).getTime()
      if (Number.isNaN(t)) return false
      return t >= start && t <= end
    })
    .map((i) => ({ key: i.key, label: i.label }))
```

with:

```ts
  // Compare whole days, not instants. A nextDate of "2026-08-16" parses to UTC
  // midnight, which is already in the past by the time anyone opens the app on
  // the 16th, so an instant comparison silently skipped the due date itself.
  const dayIndex = (d: Date) => Math.floor(d.getTime() / 86_400_000)
  const today = dayIndex(opts.now)

  return items
    .filter((i) => !ignored.has(i.key))
    .filter((i) => {
      const t = new Date(i.nextDate).getTime()
      if (Number.isNaN(t)) return false
      const offset = dayIndex(new Date(t)) - today
      return offset >= 0 && offset <= lead
    })
    .map((i) => ({ key: i.key, label: i.label }))
```

- [ ] **Step 4: Verify all reminder tests pass**

```bash
npx vitest run src/utils/reminders.test.ts
```

Expected: PASS, including the four pre-existing cases. The original "skips items already in the past" case must still pass unchanged.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc -b && npx eslint . && npx vitest run
git add src/utils/reminders.ts src/utils/reminders.test.ts
git commit -m "fix(recurring): remind on the due date itself, not only before it"
```

---

### Task 9: Automatic Drive sync, restricted to unambiguous outcomes

The last open UX item. The sync chip made status visible; syncing is still manual. The decision layer already separates safe outcomes from unsafe ones, so automation can be genuinely conservative: act only on `clean`, never resolve a conflict without the user.

Risk note: this is the highest-risk task in the plan. It writes to Drive without an explicit user click. The containment is that it acts on exactly one decision kind, is opt-in, and never runs while a conflict is pending.

**Files:**
- Create: `src/utils/autoSync.ts`
- Create: `src/utils/autoSync.test.ts`
- Modify: `src/store/storageKeys.ts`
- Modify: `src/components/settings/DriveSyncControls.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: `PushDecision` and `PullDecision` from `src/utils/syncDecision.ts`.
- Produces:

```ts
export type AutoSyncAction = 'skip' | 'push' | 'pull' | 'needs-user'
export function autoSyncAction(input: {
  enabled: boolean
  connected: boolean
  push: PushDecision
  pull: PullDecision
}): AutoSyncAction
export const AUTO_SYNC_KEY: string
export function isAutoSyncEnabled(): boolean
export function setAutoSyncEnabled(on: boolean): void
```

- [ ] **Step 1: Register the preference key**

In `src/store/storageKeys.ts`, append to `STORAGE_KEYS` (append-only):

```ts
  autoSync: 'ledger-auto-sync',
```

and add `'autoSync'` to `NON_BACKUP_KEY_NAMES`, since this is a per-device preference like `sync` and `reminders`.

Then update the literal expectation list in `src/utils/backup.test.ts`. That test deliberately hardcodes the backed-up key names so it can catch a key being wrongly excluded; adding a non-backup key means the literal list is unchanged, but the total count assertion (if present) needs updating. Read the test before editing and keep its independence from `NON_BACKUP_KEY_NAMES` intact.

- [ ] **Step 2: Write the failing decision tests**

Create `src/utils/autoSync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { autoSyncAction } from './autoSync'
import type { SnapshotMeta } from './syncDecision'

const remote: SnapshotMeta = { id: 'r1', name: 'snap', revision: 2, createdTime: '2026-08-17T00:00:00Z' } as SnapshotMeta
const base = { enabled: true, connected: true }

describe('autoSyncAction', () => {
  it('does nothing when disabled', () => {
    expect(
      autoSyncAction({ ...base, enabled: false, push: { kind: 'clean', nextRevision: 2, baseRevision: 1 }, pull: { kind: 'up-to-date' } }),
    ).toBe('skip')
  })

  it('does nothing when Drive is not connected', () => {
    expect(
      autoSyncAction({ ...base, connected: false, push: { kind: 'clean', nextRevision: 2, baseRevision: 1 }, pull: { kind: 'up-to-date' } }),
    ).toBe('skip')
  })

  it('pulls a clean remote before pushing', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'clean', nextRevision: 2, baseRevision: 1 }, pull: { kind: 'clean', remote } }),
    ).toBe('pull')
  })

  it('pushes local changes when the remote has nothing new', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'clean', nextRevision: 2, baseRevision: 1 }, pull: { kind: 'up-to-date' } }),
    ).toBe('push')
  })

  it('skips when there is nothing to do', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'nothing-to-push' }, pull: { kind: 'up-to-date' } }),
    ).toBe('skip')
  })

  it('defers a diverged push to the user', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'diverged', remote, nextRevision: 2, baseRevision: 1 }, pull: { kind: 'up-to-date' } }),
    ).toBe('needs-user')
  })

  it('defers a pull that would lose local work to the user', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'nothing-to-push' }, pull: { kind: 'would-lose-local', remote } }),
    ).toBe('needs-user')
  })

  it('defers a collision to the user', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'nothing-to-push' }, pull: { kind: 'collision', remote } }),
    ).toBe('needs-user')
  })
})
```

Read `src/utils/syncDecision.ts` first and construct `SnapshotMeta` with its real required fields rather than the `as SnapshotMeta` cast above; remove the cast once the shape is known.

- [ ] **Step 3: Run and watch it fail**

```bash
npx vitest run src/utils/autoSync.test.ts
```

Expected: FAIL, unresolved import.

- [ ] **Step 4: Implement the decision layer**

Create `src/utils/autoSync.ts`:

```ts
import { STORAGE_KEYS } from '../store/storageKeys'
import type { PullDecision, PushDecision } from './syncDecision'

export const AUTO_SYNC_KEY = STORAGE_KEYS.autoSync

export function isAutoSyncEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(AUTO_SYNC_KEY) === 'on'
}

export function setAutoSyncEnabled(on: boolean): void {
  if (typeof localStorage === 'undefined') return
  if (on) localStorage.setItem(AUTO_SYNC_KEY, 'on')
  else localStorage.removeItem(AUTO_SYNC_KEY)
}

export type AutoSyncAction = 'skip' | 'push' | 'pull' | 'needs-user'

/** Automatic syncing acts only where the decision layer is unambiguous.
 *  Anything that could overwrite work someone did on another device is handed
 *  back to the manual flow, which already has the conflict UI. Pulling wins
 *  over pushing so this device is current before it publishes anything. */
export function autoSyncAction(input: {
  enabled: boolean
  connected: boolean
  push: PushDecision
  pull: PullDecision
}): AutoSyncAction {
  if (!input.enabled || !input.connected) return 'skip'

  if (input.pull.kind === 'would-lose-local' || input.pull.kind === 'collision') return 'needs-user'
  if (input.push.kind === 'diverged') return 'needs-user'

  if (input.pull.kind === 'clean') return 'pull'
  if (input.push.kind === 'clean') return 'push'
  return 'skip'
}
```

- [ ] **Step 5: Verify the decision layer**

```bash
npx vitest run src/utils/autoSync.test.ts
```

Expected: PASS, all eight cases.

- [ ] **Step 6: Add the opt-in control**

In `src/components/settings/DriveSyncControls.tsx`, add a checkbox bound to `isAutoSyncEnabled()` / `setAutoSyncEnabled()`, following the section's existing control markup. Label it so the behaviour is not overstated, for example: "Sync automatically when this device has no conflicts. Conflicts still wait for you here." Only render it when Drive is connected.

- [ ] **Step 7: Trigger it on return to the app**

In `src/components/Layout.tsx`, add an effect that runs when the document becomes visible, calls `previewPush` and `previewPull` from `src/utils/syncService.ts`, passes both to `autoSyncAction`, and calls `performPush` or `performPull` only for `push` or `pull`. On `needs-user`, do nothing beyond leaving the sync chip to show `stale`.

Requirements for this effect, all of which matter:

- It must be a no-op when `isAutoSyncEnabled()` is false, so nobody gets background network activity they did not ask for.
- It must not run concurrently with itself. Guard with a ref so a rapid tab switch cannot start two syncs.
- It must swallow and log errors rather than surfacing a toast on every failed background attempt; a failed automatic sync should leave the chip stale, which is already the honest signal.
- It must not fire on first mount before the user has interacted, only on `visibilitychange` transitions to visible.

- [ ] **Step 8: Verify**

```bash
npx tsc -b && npx eslint . && npx vitest run && npm run e2e
```

Expected: all green. The e2e suite runs without Drive credentials, so the effect must be inert there; if any spec fails because the effect throws when unconfigured, fix the guard rather than the spec.

- [ ] **Step 9: Commit**

```bash
git add src/utils/autoSync.ts src/utils/autoSync.test.ts src/store/storageKeys.ts src/utils/backup.test.ts src/components/settings/DriveSyncControls.tsx src/components/Layout.tsx
git commit -m "feat(sync): sync automatically when the outcome is unambiguous"
```

---

### Task 10: Make the demo banner appear and disappear with the demo flag

Reported from real use: after clearing demo data the banner stays on screen. Confirmed in source. `src/components/Layout.tsx` calls `isDemoActive()` during render, which is a plain `localStorage` read with no subscription, so nothing re-renders Layout when the flag changes. The banner currently only updates when some unrelated state change happens to re-render Layout, which is why loading demo data appears to work (closing the Settings sheet re-renders) while clearing it appears to do nothing.

This was recorded as a deferred Minor during v0.9.2. It is a correctness bug, not cosmetics: the banner is the only on-screen signal that the figures being shown are fake, so it must be exactly as accurate in disappearing as in appearing.

**Files:**
- Modify: `src/utils/demoData.ts`
- Modify: `src/utils/demoData.test.ts`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/settings/BackupControls.tsx`

**Interfaces:**
- Produces, from `src/utils/demoData.ts`:

```ts
export function subscribeDemoActive(onChange: () => void): () => void
export function setDemoActive(on: boolean): void
```

`isDemoActive()` keeps its existing signature and becomes the snapshot function for `useSyncExternalStore`.

- [ ] **Step 1: Write the failing test**

Append to `src/utils/demoData.test.ts`:

```ts
import { subscribeDemoActive, setDemoActive } from './demoData'

describe('demo flag subscription', () => {
  it('notifies subscribers when the flag is set and cleared', () => {
    let calls = 0
    const unsubscribe = subscribeDemoActive(() => { calls++ })

    setDemoActive(true)
    expect(isDemoActive()).toBe(true)
    expect(calls).toBe(1)

    setDemoActive(false)
    expect(isDemoActive()).toBe(false)
    expect(calls).toBe(2)

    unsubscribe()
    setDemoActive(true)
    expect(calls).toBe(2)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run src/utils/demoData.test.ts
```

Expected: FAIL, `subscribeDemoActive` is not exported.

- [ ] **Step 3: Make the flag observable**

In `src/utils/demoData.ts`, add below `isDemoActive`:

```ts
const listeners = new Set<() => void>()

/** The banner in Layout is the only on-screen signal that the figures shown
 *  are sample data, so it has to track the flag exactly. A plain localStorage
 *  read cannot do that: nothing re-renders when the value changes, which left
 *  the banner on screen after the data behind it was cleared. */
export function subscribeDemoActive(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

export function setDemoActive(on: boolean): void {
  if (typeof localStorage === 'undefined') return
  if (on) localStorage.setItem(DEMO_FLAG_KEY, new Date().toISOString())
  else localStorage.removeItem(DEMO_FLAG_KEY)
  for (const l of listeners) l()
}
```

Match the stored value to whatever `BackupControls.tsx` currently writes when enabling demo mode. Read that file first and reuse its exact value rather than assuming the timestamp above.

- [ ] **Step 4: Route both writes through it**

In `src/components/settings/BackupControls.tsx`, replace the direct `localStorage.setItem(DEMO_FLAG_KEY, ...)` and `localStorage.removeItem(DEMO_FLAG_KEY)` calls with `setDemoActive(true)` and `setDemoActive(false)`. Check the undo callback registered by `applyDemoData` too: it removes the demo flag on undo, and must also go through `setDemoActive(false)` or the banner will survive an undo.

- [ ] **Step 5: Subscribe in Layout**

In `src/components/Layout.tsx`, add `useSyncExternalStore` to the React import, change the import from `demoData` to bring in the subscription, and replace the bare call:

```tsx
  const demoActive = useSyncExternalStore(subscribeDemoActive, isDemoActive, () => false)
```

Then use `{demoActive && (` in place of `{isDemoActive() && (`. The third argument is the server snapshot and returns `false` so the banner never renders during any non-browser render.

- [ ] **Step 6: Add a component-level regression test**

Append to `src/components/Layout.test.tsx`:

```ts
describe('Layout demo banner', () => {
  it('shows and hides with the demo flag without a reload', async () => {
    setDemoActive(false)
    render(<MemoryRouter><Layout /></MemoryRouter>)
    expect(screen.queryByText(/Demo data is loaded/i)).not.toBeInTheDocument()

    await act(async () => { setDemoActive(true) })
    expect(screen.getByText(/Demo data is loaded/i)).toBeInTheDocument()

    await act(async () => { setDemoActive(false) })
    expect(screen.queryByText(/Demo data is loaded/i)).not.toBeInTheDocument()
  })
})
```

Import `act` from `@testing-library/react` and `setDemoActive` from `../utils/demoData`. The second assertion is the one that fails against the current code.

- [ ] **Step 7: Verify**

```bash
npx tsc -b && npx eslint . && npx vitest run
```

Expected: all green, including the pre-existing demo tests and the `BackupControls` tests.

- [ ] **Step 8: Commit**

```bash
git add src/utils/demoData.ts src/utils/demoData.test.ts src/components/Layout.tsx src/components/Layout.test.tsx src/components/settings/BackupControls.tsx
git commit -m "fix(demo): keep the banner in step with the demo flag"
```

---

### Task 11: Let the user dismiss the Getting started checklist

Requested. Today the checklist only leaves once both steps are done, so someone who does not want it has no way to remove it from their dashboard. The dismissal must persist, otherwise it returns on the next load and is worse than no button at all.

**Files:**
- Modify: `src/store/storageKeys.ts`
- Modify: `src/utils/backup.test.ts`
- Modify: `src/components/dashboard/FirstRunChecklist.tsx`
- Modify: `src/components/dashboard/FirstRunChecklist.test.tsx`

**Interfaces:**
- `FirstRunChecklist` keeps its `accountCount` and `transactionCount` props and gains no required prop. Dismissal state is owned internally and persisted.

- [ ] **Step 1: Register the key**

In `src/store/storageKeys.ts`, append to `STORAGE_KEYS`:

```ts
  checklistDismissed: 'ledger-checklist-dismissed',
```

and add `'checklistDismissed'` to `NON_BACKUP_KEY_NAMES`. This is a per-device UI preference: restoring a backup onto a new device should not carry over a dismissal made somewhere else, and the checklist is only relevant on a device that has no data yet.

Then update `src/utils/backup.test.ts` the same way Task 9 does. Read it first; its expected list is deliberately independent of `NON_BACKUP_KEY_NAMES`, so keep that independence.

- [ ] **Step 2: Write the failing tests**

Append to `src/components/dashboard/FirstRunChecklist.test.tsx`:

```tsx
describe('FirstRunChecklist dismissal', () => {
  beforeEach(() => localStorage.clear())

  it('offers a dismiss control and hides the checklist when used', () => {
    wrap(<FirstRunChecklist accountCount={0} transactionCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss getting started/i }))
    expect(screen.queryByText('Add your first account')).not.toBeInTheDocument()
  })

  it('stays dismissed on a later render', () => {
    const first = wrap(<FirstRunChecklist accountCount={0} transactionCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss getting started/i }))
    first.unmount()

    const { container } = wrap(<FirstRunChecklist accountCount={0} transactionCount={0} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

Import `fireEvent` from `@testing-library/react` if the file does not already.

- [ ] **Step 3: Run and watch both fail**

```bash
npx vitest run src/components/dashboard/FirstRunChecklist.test.tsx
```

Expected: FAIL, no dismiss button.

- [ ] **Step 4: Implement dismissal**

In `src/components/dashboard/FirstRunChecklist.tsx`, add the imports:

```tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { STORAGE_KEYS } from '../../store/storageKeys'
```

Merge `useState` into the existing `import React from 'react'` line rather than adding a second React import.

Add above the existing `steps` declaration:

```tsx
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.checklistDismissed) !== null,
  )

  const dismiss = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.checklistDismissed, new Date().toISOString())
    }
    setDismissed(true)
  }
```

Change the early return so a dismissal also hides it:

```tsx
  if (dismissed || doneCount === steps.length) return null
```

Add the button to the header row, beside the progress count:

```tsx
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-text-primary">Getting started</h2>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-secondary">
            {doneCount} of {steps.length} done
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss Getting started"
            className="p-1 rounded text-text-secondary hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
```

Note that `dismissed` is read once via the `useState` initialiser rather than on every render, so dismissing does not depend on a storage subscription: the same component instance sets its own state, and a later mount reads the persisted value.

- [ ] **Step 5: Verify**

```bash
npx vitest run src/components/dashboard/FirstRunChecklist.test.tsx
```

Expected: PASS, including the three pre-existing cases. The "renders nothing once every step is done" case must still pass unchanged.

- [ ] **Step 6: Verify the whole suite and the mobile scan**

```bash
npx tsc -b && npx eslint . && npx vitest run && npm run e2e -- e2e/a11y-mobile.spec.ts
```

Expected: all green. The new icon button must carry its `aria-label`, which the axe scan will check.

- [ ] **Step 7: Commit**

```bash
git add src/store/storageKeys.ts src/utils/backup.test.ts src/components/dashboard/FirstRunChecklist.tsx src/components/dashboard/FirstRunChecklist.test.tsx
git commit -m "feat(onboarding): let the Getting started checklist be dismissed"
```

---

### Task 12: Close every gate, update the changelog, record the score

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/plans/PROGRESS.md`

- [ ] **Step 1: Fold the new guards into `verify`**

In `package.json`, extend the `verify` script so the two new guards run with everything else:

```json
"verify": "npm run lint && npm test -- --run && npm run build && npm run check:bundle && npm run check:eager && npm run e2e"
```

- [ ] **Step 2: Run every gate**

```bash
npm run verify
```

Then separately, because `verify` does not include it:

```bash
npx tsc -b
```

Expected: eslint 0, full unit suite green, build clean, bundle budgets met including the new initial-load budget, eager guard clean, all e2e specs green including `a11y-mobile.spec.ts`, tsc 0.

- [ ] **Step 3: Run the unit suite three times to check for flakes**

```bash
npx vitest run && npx vitest run && npx vitest run
```

Nothing else running concurrently. Expected: three identical clean runs. The previous plan found a genuine flake this way. If one appears, fix its root cause rather than adding a retry, and report what you found.

- [ ] **Step 4: Add the changelog entry**

Add a `## [0.9.3-beta] - <today>` section to `CHANGELOG.md` above the previous entry, following the existing `### Added` / `### Changed` / `### Fixed` structure and the house style: user-facing prose, area prefixes such as "Budgeting:", no em dashes.

Every claim must be verifiable against what shipped, and must be scoped accurately. Specifically:

- The first-load improvement is now real, so it may be stated as a first-load improvement, unlike the 0.9.2 entry which deliberately avoided that claim. State it in user terms (the app starts faster, especially on a phone or a slow connection) rather than in kilobytes.
- Virtualization and keyboard operability now cover phones as well as desktop, so the 0.9.2 entry's "on desktop" qualifiers no longer apply to the new state. Do not edit the historical 0.9.2 entry; describe the phone improvements as new in this release.
- Automatic sync must be described with its limits: it syncs only when there is no conflict, and conflicts still wait for the user in Settings.
- The reminder fix should say plainly that a bill due today now notifies.

Then bump `"version"` in `package.json` to `0.9.3-beta`.

- [ ] **Step 5: Verify the changelog parses and carries no em dashes**

```bash
npx vitest run src/components/ui/WhatsNewModal.test.tsx
node -e "const t=require('fs').readFileSync('CHANGELOG.md','utf8');const s=t.split('## [0.9.3-beta]')[1].split('## [')[0];console.log('em dashes in new section:',[...s.matchAll(/\u2014/g)].length)"
```

Expected: tests pass, zero em dashes.

- [ ] **Step 6: Record the outcome**

Append a dated section to `docs/superpowers/plans/PROGRESS.md` recording the final test count, the initial-load graph size, and the dimensions closed.

- [ ] **Step 7: Commit**

```bash
git add package.json CHANGELOG.md docs/superpowers/plans/PROGRESS.md
git commit -m "chore: release 0.9.3-beta"
```

---

## Risk Register

| Task | Risk | Why | Containment |
|---|---|---|---|
| 1 | Medium | Rewires how every planner tool is resolved; a wrong id in the map breaks a route | `check:eager` proves the goal; the `!Component` guard prevents a crash; e2e visits every route; Step 7 verifies the built entry chunk directly |
| 2 | Low | A regex-based chunk walk could miscount | Step 3 deliberately proves the budget can fail before trusting it |
| 3 | Low | Pure colour change | Contrast is already measured; axe re-run |
| 4 | Low | New guards may surface pre-existing mobile violations | Step 7 explicitly allows reporting them rather than weakening the gate |
| 5 | Medium | Card height is an estimate, and cards vary in height more than rows | `computeWindow` renders everything when unmeasured, so a bad estimate costs smoothness not correctness; generous overscan |
| 6 | Low to medium | `role="button"` on a container holding a checkbox and a button may trip nested-interactive | Documented fallback in Step 4 |
| 7 | Medium | An effect with no dependency array can loop | The `> 1` guard stops it; e2e re-verified |
| 8 | Low | Day-index arithmetic uses UTC day boundaries | Tests cover the due date early and late in the day, plus both window edges |
| 9 | **High** | Writes to Drive with no user click | Opt-in, off by default; acts only on `clean`; every ambiguous decision returns `needs-user`; reentrancy guard; errors stay silent and leave the chip stale |
| 10 | Low to medium | Changes how the only fake-data warning is driven; a broken subscription could hide the banner while demo data is loaded, which is worse than the reported bug | The component test asserts both directions (appear and disappear); every write path including undo routes through the one setter |
| 11 | Low | A persisted dismissal that cannot be undone would strand a user who dismissed by accident | Scoped to one device and to a panel that only appears on an empty install; the checklist still returns for a genuinely fresh profile |
| 12 | Low | Changelog can overstate | Claims must be scoped; the 0.9.2 review caught two overstatements this way |

## Expected Score Movement

| Dimension | Now | After | Closed by |
|---|---|---|---|
| Performance | 8 | 10 | Tasks 1, 2, 5, 7 |
| UX & Usability | 9.5 | 10 | Tasks 9, 10, 11 |
| Accessibility | 8.5 | 10 | Tasks 3, 4, 6 |
| Engagement | 9 | 10 | Task 8 |
| Security | 5 | 5 | Out of scope |
| **Overall** | **80** | **90** | |

The remaining 10 points are the security workstream: the Alpha Vantage API key still ships inside every backup and Drive snapshot, there is no CSP, and data is stored unencrypted.

## Deliberately Out of Scope

- **Arrow-key navigation for `TriageInboxWidget` and `CategoryManagerWidget`.** Research found both use real `<button>` elements, so they already satisfy WCAG 2.1.1. My earlier audit described them as mouse-first, which was wrong. Roving-tabindex navigation would be a convenience improvement, not a conformance fix, and padding this plan with it would misrepresent what closing Accessibility at 10 requires.
- **Restoring the chart chunk's precache exclusion.** After Task 1 the chunk is no longer blocking, and precaching it costs nothing at first paint while keeping charts available offline. Excluding it again would reintroduce the 0.9.2 offline bug for no benefit.
- **Everything in the security dimension.**

## Self-Review

**Spec coverage.** Performance: Task 1 removes the eager chart bytes, Task 2 guards the class of regression, Task 5 finishes virtualization on mobile, Task 7 removes the row-height assumption. Accessibility: Task 3 fixes the five measured failures, Task 4 guards both the opacity class and the mobile viewport, Task 6 closes the 2.1.1 gap. UX: Task 9 closes auto-sync, Task 10 fixes the stuck demo banner, Task 11 makes the checklist dismissible. Engagement: Task 8 fixes the due-date bug. Task 12 closes the gates and ships.

**Placeholders.** Six steps direct the implementer to read source before writing: the tool ids in Task 1 Step 3, the seeding block in Task 5 Step 3, the `backup.test.ts` expectation in Task 9 Step 1 and again in Task 11 Step 1, the `SnapshotMeta` shape in Task 9 Step 2, and the stored demo flag value in Task 10 Step 3. Each names the exact file and what to confirm; the design is fully specified in every case.

**Type consistency.** `PLANNER_TOOL_COMPONENTS` is `Record<string, React.ComponentType>` in Task 1 and indexed by `tool.id` in the same task. `compositeOver(fg, bg, alpha): string` is defined and used in Task 4. `computeWindow`'s `WindowInput` fields (`scrollTop`, `viewportHeight`, `rowHeight`, `totalRows`, `overscan`) are used as defined in Tasks 5 and 7. `autoSyncAction` returns `'skip' | 'push' | 'pull' | 'needs-user'` in Task 9 and all four are handled at the call site in Step 7. `subscribeDemoActive(onChange): () => void` and `setDemoActive(on: boolean): void` are defined in Task 10 Step 3 and consumed in Steps 4, 5 and 6 of the same task.

**Storage key ordering.** Tasks 9 and 11 both append to `STORAGE_KEYS` and both touch `src/utils/backup.test.ts`. They are sequential, so the second must read the file as the first left it rather than assuming the pre-plan state. Neither edits an existing value.
