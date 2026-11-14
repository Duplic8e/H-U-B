# Phase 4e — Net-Worth / FIRE Forecaster (flagship)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the interim `ProjectionWidget` with a full FIRE forecaster: actual-history→future net-worth chart with scenario bands, nominal/real toggle, contributions-vs-growth view, auto-fed inputs from Dashboard/Budgeting/Compensation, comp lump sums on real dates, goals with projected dates, FIRE engine (FI number, years-to-FI, Coast-FI), life-event timeline, what-if sliders, Monte Carlo fan, and a debt-payoff drag wired to the 4c Debt Payoff tool's data.

**Architecture:** Three pure math modules (`forecast.ts` deterministic engine, `fire.ts` FIRE arithmetic, `monteCarlo.ts` seeded simulation) plus a pure comp-feed extractor (`compFeed.ts`). Components live in `src/components/planner/forecaster/` and compose the 4a primitives. All forecaster settings persist in `usePlannerStore` under tool id `forecaster` (scalars as fields; events/goals as JSON strings). `useProjectionStore` and `ProjectionWidget` are deleted at the end.

**Tech Stack:** React 19, Zustand v5, Recharts v3 (ComposedChart/Area/Line/ReferenceLine), lucide-react, Tailwind v4, Vitest (globals: true).

**Umbrella plan:** `2026-07-02-phase-4-planner.md` (see "Cross-module auto-feed interfaces"). **Prerequisites:** 4a (registry/store/primitives), 4b Task 1 (`src/store/budgetSelectors.ts` — if 4b is not done yet, execute its Task 1 first verbatim), 4c Tasks 1–2 (`amortization.ts`, `debtPayoff.ts` for the debt drag).

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **Local-first persistence.** All settings via `usePlannerStore` — **no new store keys**.
- **Recharts only**; theme via CSS variables as stroke/fill.
- **No hardcoded colors — theme CSS variables only.** ALL 5 themes.
- **Live data always has a manual fallback.** Every auto-fed input has a visible manual override; the forecaster works with zero data in other modules.
- **Mobile + all 5 themes are acceptance gates** (final task, which is also the PHASE 4 gate).
- **Testing is minimal by direction of the user (2026-07-02):** the four math modules get focused tests (that's where the risk is); forecaster components get NO dedicated test files — covered by `Planner.test.tsx` + the manual gate.
- **Commit after every task.** Lint enforces `react-hooks/set-state-in-effect` — store writes from event handlers only; derive everything else during render.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

## Cross-module interfaces used (verified against the codebase 2026-07-02)

- `useAccountsStore` (`src/store/useAccountsStore.ts`): `getNetWorth(): number`; `history: NetWorthSnapshot[]` (`{ date: 'YYYY-MM-DD'; value: number }`, sorted ascending).
- `budgetSelectors` (4b T1): `averageMonthlyNetSavings(transactions, monthsBack, refDate?)`.
- `useCompensationStore` (`src/store/useCompensationStore.ts`): `primaryPackage: CompensationPackage`; `generateVestEvents(grant, currentPrice): VestEvent[]` (each has ISO `date?` and `vestValue`); `calcAnnualBonus(pkg)`; `calcAnnualESPP(pkg)`; `pkg.cashBonusMonth` (1–12); `pkg.companyCurrentPrice`.
- 4c: `Debt`, `simulatePayoff` from `src/utils/finance/debtPayoff.ts`; the Debt Payoff tool persists `debtsJson` + `extraMonthly` under tool id `debt-payoff` in `usePlannerStore`.
- `futureValue` from `src/utils/finance/compound.ts` (4a).

---

### Task 1: Deterministic forecast engine (`src/utils/finance/forecast.ts`)

**Files:**
- Create: `src/utils/finance/forecast.ts`
- Create: `src/utils/finance/forecast.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 2, 5–8):
  - `interface LumpSum { month: number; amount: number; label?: string }` (month = offset from now, 1-based)
  - `interface ForecastConfig { startBalance: number; monthlySavings: number; annualReturnPct: number; annualInflationPct: number; contributionStepUpPct: number; years: number; lumpSums?: LumpSum[]; scenarioSpreadPct?: number; monthlyDrag?: { amount: number; untilMonth: number } }`
  - `interface ForecastPoint { month: number; base: number; conservative: number; optimistic: number; real: number; contributed: number; growth: number }`
  - `buildForecast(config: ForecastConfig): ForecastPoint[]` (index 0 = now)

Semantics (file-top comment): monthly compounding at `annualReturnPct/12/100`; contributions at end of month, stepping up `contributionStepUpPct` every 12 months; lump sums land in their month (all three scenarios); `conservative`/`optimistic` = base return ∓ `scenarioSpreadPct` (default 2); `real` = base deflated by inflation; `monthlyDrag` subtracts from the contribution until `untilMonth` (debt service), floor −∞ (negative savings allowed); `contributed = startBalance + Σ contributions + Σ lump sums`, `growth = base − contributed`.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/forecast.test.ts`:

```ts
import { buildForecast } from './forecast'

const base = {
  startBalance: 10_000,
  monthlySavings: 1_000,
  annualReturnPct: 0,
  annualInflationPct: 0,
  contributionStepUpPct: 0,
  years: 2,
}

describe('buildForecast', () => {
  it('zero-rate accumulation is hand-computable', () => {
    const f = buildForecast(base)
    expect(f).toHaveLength(25)
    expect(f[0].base).toBe(10_000)
    expect(f[24].base).toBe(10_000 + 24 * 1_000)
    expect(f[24].growth).toBeCloseTo(0, 10)
  })

  it('lump sums land in their month', () => {
    const f = buildForecast({ ...base, lumpSums: [{ month: 3, amount: 5_000 }] })
    expect(f[2].base).toBe(12_000)
    expect(f[3].base).toBe(18_000) // 13,000 + 5,000
    expect(f[3].contributed).toBe(18_000)
  })

  it('step-up raises contributions after each 12 months', () => {
    const f = buildForecast({ ...base, contributionStepUpPct: 10 })
    // months 1-12: 1,000/mo; months 13+: 1,100/mo
    expect(f[12].base).toBe(22_000)
    expect(f[13].base).toBe(23_100)
  })

  it('real values deflate by inflation', () => {
    const f = buildForecast({ ...base, annualInflationPct: 100 }) // halves each year
    expect(f[12].real).toBeCloseTo(f[12].base / 2, 6)
    expect(f[24].real).toBeCloseTo(f[24].base / 4, 6)
  })

  it('scenario bands straddle base', () => {
    const f = buildForecast({ ...base, annualReturnPct: 7, scenarioSpreadPct: 2 })
    const last = f[24]
    expect(last.conservative).toBeLessThan(last.base)
    expect(last.optimistic).toBeGreaterThan(last.base)
  })

  it('monthlyDrag reduces contributions until its month, then stops', () => {
    const f = buildForecast({ ...base, monthlyDrag: { amount: 400, untilMonth: 12 } })
    expect(f[12].base).toBe(10_000 + 12 * 600)
    expect(f[24].base).toBe(10_000 + 12 * 600 + 12 * 1_000)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/forecast.test.ts`
Expected: FAIL — cannot resolve `./forecast`.

- [x] **Step 3: Implement**

Create `src/utils/finance/forecast.ts`:

```ts
// Deterministic net-worth forecast. Monthly compounding (rate/12), end-of-
// month contributions stepping up annually, lump sums on real month offsets,
// conservative/base/optimistic = return ∓/+ scenarioSpreadPct, real = base
// deflated by inflation. monthlyDrag models debt service ending at a month.

export interface LumpSum {
  month: number // offset from now, 1-based
  amount: number
  label?: string
}

export interface ForecastConfig {
  startBalance: number
  monthlySavings: number
  annualReturnPct: number
  annualInflationPct: number
  contributionStepUpPct: number
  years: number
  lumpSums?: LumpSum[]
  scenarioSpreadPct?: number
  monthlyDrag?: { amount: number; untilMonth: number }
}

export interface ForecastPoint {
  month: number
  base: number
  conservative: number
  optimistic: number
  real: number
  contributed: number
  growth: number
}

export function buildForecast(config: ForecastConfig): ForecastPoint[] {
  const spread = config.scenarioSpreadPct ?? 2
  const months = Math.max(1, Math.round(config.years * 12))
  const rates = {
    base: config.annualReturnPct / 100 / 12,
    conservative: (config.annualReturnPct - spread) / 100 / 12,
    optimistic: (config.annualReturnPct + spread) / 100 / 12,
  }
  const lumpsByMonth = new Map<number, number>()
  for (const l of config.lumpSums ?? []) {
    lumpsByMonth.set(l.month, (lumpsByMonth.get(l.month) ?? 0) + l.amount)
  }

  const points: ForecastPoint[] = [{
    month: 0,
    base: config.startBalance,
    conservative: config.startBalance,
    optimistic: config.startBalance,
    real: config.startBalance,
    contributed: config.startBalance,
    growth: 0,
  }]

  let balBase = config.startBalance
  let balCons = config.startBalance
  let balOpt = config.startBalance
  let contributed = config.startBalance

  for (let m = 1; m <= months; m++) {
    const yearsElapsed = Math.floor((m - 1) / 12)
    let contribution = config.monthlySavings * Math.pow(1 + config.contributionStepUpPct / 100, yearsElapsed)
    if (config.monthlyDrag && m <= config.monthlyDrag.untilMonth) {
      contribution -= config.monthlyDrag.amount
    }
    const lump = lumpsByMonth.get(m) ?? 0

    balBase = balBase * (1 + rates.base) + contribution + lump
    balCons = balCons * (1 + rates.conservative) + contribution + lump
    balOpt = balOpt * (1 + rates.optimistic) + contribution + lump
    contributed += contribution + lump

    const deflator = Math.pow(1 + config.annualInflationPct / 100, m / 12)
    points.push({
      month: m,
      base: balBase,
      conservative: balCons,
      optimistic: balOpt,
      real: balBase / deflator,
      contributed,
      growth: balBase - contributed,
    })
  }
  return points
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/forecast.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/forecast.ts src/utils/finance/forecast.test.ts
git commit -m "feat: deterministic forecast engine (bands, step-up, lump sums, real values, drag)"
```

---

### Task 2: FIRE math (`src/utils/finance/fire.ts`)

**Files:**
- Create: `src/utils/finance/fire.ts`
- Create: `src/utils/finance/fire.test.ts`

**Interfaces:**
- Consumes: `ForecastPoint` type (Task 1).
- Produces (used by Tasks 6–7):
  - `fiNumber(annualSpending: number, withdrawalRatePct: number): number`
  - `monthsToReach(points: ForecastPoint[], target: number, key?: 'base' | 'real'): number | null` (first month ≥ target; also used for goal projected dates)
  - `coastFiNumber(fi: number, annualReturnPct: number, yearsRemaining: number): number` (balance today that grows to FI with zero contributions)

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/fire.test.ts`:

```ts
import { buildForecast } from './forecast'
import { coastFiNumber, fiNumber, monthsToReach } from './fire'

describe('fiNumber', () => {
  it('is annual spending over the withdrawal rate', () => {
    expect(fiNumber(40_000, 4)).toBe(1_000_000)
    expect(fiNumber(60_000, 3)).toBeCloseTo(2_000_000, 6)
  })
  it('returns Infinity for a zero rate', () => {
    expect(fiNumber(40_000, 0)).toBe(Infinity)
  })
})

describe('monthsToReach', () => {
  const points = buildForecast({
    startBalance: 0, monthlySavings: 1_000, annualReturnPct: 0,
    annualInflationPct: 0, contributionStepUpPct: 0, years: 3,
  })
  it('finds the first month at/above the target', () => {
    expect(monthsToReach(points, 12_000)).toBe(12)
    expect(monthsToReach(points, 0)).toBe(0)
  })
  it('returns null when never reached', () => {
    expect(monthsToReach(points, 1e9)).toBeNull()
  })
})

describe('coastFiNumber', () => {
  it('discounts FI back by the return rate', () => {
    // 1,000,000 at 7.0% (monthly compounding) over 10y ≈ /2.00966
    expect(coastFiNumber(1_000_000, 7, 10)).toBeCloseTo(1_000_000 / Math.pow(1 + 0.07 / 12, 120), 4)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/fire.test.ts`
Expected: FAIL — cannot resolve `./fire`.

- [x] **Step 3: Implement**

Create `src/utils/finance/fire.ts`:

```ts
// FIRE arithmetic. FI number = annual spending / withdrawal rate. Coast-FI =
// the balance that reaches FI with no further contributions (monthly
// compounding, consistent with ./forecast.ts and ./compound.ts).

import type { ForecastPoint } from './forecast'

export function fiNumber(annualSpending: number, withdrawalRatePct: number): number {
  if (withdrawalRatePct <= 0) return Infinity
  return annualSpending / (withdrawalRatePct / 100)
}

export function monthsToReach(
  points: ForecastPoint[],
  target: number,
  key: 'base' | 'real' = 'base',
): number | null {
  for (const p of points) {
    if (p[key] >= target) return p.month
  }
  return null
}

export function coastFiNumber(fi: number, annualReturnPct: number, yearsRemaining: number): number {
  const months = Math.round(yearsRemaining * 12)
  return fi / Math.pow(1 + annualReturnPct / 100 / 12, months)
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/fire.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/fire.ts src/utils/finance/fire.test.ts
git commit -m "feat: FIRE math (FI number, months-to-target, Coast-FI)"
```

---

### Task 3: Monte Carlo simulation (`src/utils/finance/monteCarlo.ts`)

**Files:**
- Create: `src/utils/finance/monteCarlo.ts`
- Create: `src/utils/finance/monteCarlo.test.ts`

**Interfaces:**
- Consumes: `LumpSum` type (Task 1).
- Produces (used by Task 8):
  - `mulberry32(seed: number): () => number` (deterministic PRNG for testability)
  - `interface MonteCarloConfig { startBalance: number; monthlySavings: number; years: number; meanReturnPct: number; stdDevPct: number; contributionStepUpPct?: number; lumpSums?: LumpSum[]; runs?: number; seed?: number }`
  - `interface PercentileBand { year: number; p10: number; p25: number; p50: number; p75: number; p90: number }`
  - `interface MonteCarloResult { bands: PercentileBand[]; finalBalances: number[] }`
  - `runMonteCarlo(config: MonteCarloConfig): MonteCarloResult`
  - `probabilityOfSuccess(finalBalances: number[], target: number): number` (0–1)

Model (comment): monthly returns drawn Normal(mean/12, stdDev/√12) via Box–Muller on mulberry32; default 500 runs, seed 42; bands are per-year percentiles across runs.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/monteCarlo.test.ts`:

```ts
import { futureValue } from './compound'
import { mulberry32, probabilityOfSuccess, runMonteCarlo } from './monteCarlo'

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seq = [a(), a(), a()]
    expect(seq).toEqual([b(), b(), b()])
    expect(seq.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})

describe('runMonteCarlo', () => {
  const base = { startBalance: 10_000, monthlySavings: 500, years: 10, meanReturnPct: 7, stdDevPct: 15 }

  it('is reproducible for a fixed seed', () => {
    const r1 = runMonteCarlo({ ...base, seed: 1, runs: 50 })
    const r2 = runMonteCarlo({ ...base, seed: 1, runs: 50 })
    expect(r1.bands).toEqual(r2.bands)
  })

  it('collapses to the deterministic path at zero volatility', () => {
    const r = runMonteCarlo({ ...base, stdDevPct: 0, runs: 10 })
    const last = r.bands[r.bands.length - 1]
    const expected = futureValue(10_000, 7, 120, 500)
    expect(last.p10).toBeCloseTo(last.p90, 6)
    expect(last.p50).toBeCloseTo(expected, 0)
  })

  it('orders percentiles', () => {
    const r = runMonteCarlo({ ...base, seed: 7, runs: 200 })
    for (const b of r.bands) {
      expect(b.p10).toBeLessThanOrEqual(b.p25)
      expect(b.p25).toBeLessThanOrEqual(b.p50)
      expect(b.p50).toBeLessThanOrEqual(b.p75)
      expect(b.p75).toBeLessThanOrEqual(b.p90)
    }
  })
})

describe('probabilityOfSuccess', () => {
  it('is the fraction of runs at/above target', () => {
    expect(probabilityOfSuccess([1, 2, 3, 4], 3)).toBe(0.5)
    expect(probabilityOfSuccess([], 1)).toBe(0)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/monteCarlo.test.ts`
Expected: FAIL — cannot resolve `./monteCarlo`.

- [x] **Step 3: Implement**

Create `src/utils/finance/monteCarlo.ts`:

```ts
// Monte Carlo net-worth simulation. Monthly returns ~ Normal(mean/12,
// stdDev/sqrt(12)) via Box-Muller over a mulberry32 seeded PRNG so tests
// (and reloads) are reproducible. Percentile bands are computed per year.

import type { LumpSum } from './forecast'

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MonteCarloConfig {
  startBalance: number
  monthlySavings: number
  years: number
  meanReturnPct: number
  stdDevPct: number
  contributionStepUpPct?: number
  lumpSums?: LumpSum[]
  runs?: number
  seed?: number
}

export interface PercentileBand {
  year: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface MonteCarloResult {
  bands: PercentileBand[]
  finalBalances: number[]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]
}

export function runMonteCarlo(config: MonteCarloConfig): MonteCarloResult {
  const runs = config.runs ?? 500
  const rand = mulberry32(config.seed ?? 42)
  const months = Math.max(1, Math.round(config.years * 12))
  const meanMonthly = config.meanReturnPct / 100 / 12
  const sdMonthly = config.stdDevPct / 100 / Math.sqrt(12)
  const stepUp = config.contributionStepUpPct ?? 0
  const lumpsByMonth = new Map<number, number>()
  for (const l of config.lumpSums ?? []) {
    lumpsByMonth.set(l.month, (lumpsByMonth.get(l.month) ?? 0) + l.amount)
  }

  // Box-Muller pair; cache the spare value.
  let spare: number | null = null
  const gaussian = (): number => {
    if (spare !== null) {
      const v = spare
      spare = null
      return v
    }
    let u = 0
    let v = 0
    while (u === 0) u = rand()
    while (v === 0) v = rand()
    const mag = Math.sqrt(-2 * Math.log(u))
    spare = mag * Math.sin(2 * Math.PI * v)
    return mag * Math.cos(2 * Math.PI * v)
  }

  const years = Math.ceil(months / 12)
  const yearly: number[][] = Array.from({ length: years }, () => [])
  const finalBalances: number[] = []

  for (let run = 0; run < runs; run++) {
    let balance = config.startBalance
    for (let m = 1; m <= months; m++) {
      const yearsElapsed = Math.floor((m - 1) / 12)
      const contribution = config.monthlySavings * Math.pow(1 + stepUp / 100, yearsElapsed)
      const monthlyReturn = sdMonthly === 0 ? meanMonthly : meanMonthly + sdMonthly * gaussian()
      balance = balance * (1 + monthlyReturn) + contribution + (lumpsByMonth.get(m) ?? 0)
      if (m % 12 === 0) yearly[m / 12 - 1].push(balance)
    }
    finalBalances.push(balance)
  }

  const bands: PercentileBand[] = yearly.map((balances, i) => {
    const sorted = [...balances].sort((a, b) => a - b)
    return {
      year: i + 1,
      p10: percentile(sorted, 10),
      p25: percentile(sorted, 25),
      p50: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p90: percentile(sorted, 90),
    }
  })
  return { bands, finalBalances }
}

export function probabilityOfSuccess(finalBalances: number[], target: number): number {
  if (finalBalances.length === 0) return 0
  return finalBalances.filter((b) => b >= target).length / finalBalances.length
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/monteCarlo.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/monteCarlo.ts src/utils/finance/monteCarlo.test.ts
git commit -m "feat: seeded Monte Carlo simulation with percentile bands"
```

---

### Task 4: Compensation lump-sum feed (`src/utils/finance/compFeed.ts`)

**Files:**
- Create: `src/utils/finance/compFeed.ts`
- Create: `src/utils/finance/compFeed.test.ts`

**Interfaces:**
- Consumes: `CompensationPackage`, `generateVestEvents`, `calcAnnualBonus`, `calcAnnualESPP` from `src/store/useCompensationStore.ts`; `LumpSum` (Task 1).
- Produces (used by Task 6): `compLumpSums(pkg: CompensationPackage, currentPrice: number, horizonMonths: number, now?: Date): LumpSum[]`

Rules (comment): **RSU** — every `generateVestEvents` event with a `date` strictly after `now` and within the horizon becomes a lump at `monthOffset = whole months between now and the event date`, amount `vestValue`. **Bonus** — `calcAnnualBonus(pkg)` lands every year at `pkg.cashBonusMonth`, first occurrence after `now`. **ESPP** — documented simplification (no per-purchase dates exist in the store): `calcAnnualESPP(pkg)` lands every 12 months from now. Zero-amount lumps are dropped.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/compFeed.test.ts`:

```ts
import type { CompensationPackage } from '../../store/useCompensationStore'
import { compLumpSums } from './compFeed'

const basePkg: CompensationPackage = {
  id: 'p', name: 'Test', companyCurrentPrice: 100, baseSalary: 120_000,
  pastSalaryChanges: [], cashBonusPercent: 10, cashBonusMonth: 12,
  esppContributionPercent: 0, esppDiscountPercent: 15, esppLockedInPrice: 0,
  rrspMatchPercent: 0, rrspMatchCap: 0, rsuGrants: [],
}

const now = new Date('2026-07-02T00:00:00')

describe('compLumpSums', () => {
  it('places the annual bonus at the configured month, repeating yearly', () => {
    const lumps = compLumpSums(basePkg, 100, 24, now)
    const bonuses = lumps.filter((l) => l.label === 'Bonus')
    // Dec 2026 = month offset 5, Dec 2027 = 17
    expect(bonuses.map((b) => b.month)).toEqual([5, 17])
    expect(bonuses[0].amount).toBeCloseTo(12_000, 6)
  })

  it('maps RSU vest events with future dates into month offsets', () => {
    const pkg: CompensationPackage = {
      ...basePkg,
      cashBonusPercent: 0,
      rsuGrants: [{
        id: 'g1', grantName: 'G1', grantShares: 480, grantPrice: 50,
        grantStartDate: '2026-01-02',
        vestingSchedule: { preset: 'custom', totalVestMonths: 48, cliffMonths: 12, frequency: 'monthly' },
      }],
    }
    const lumps = compLumpSums(pkg, 100, 12, now)
    const rsu = lumps.filter((l) => l.label?.startsWith('RSU'))
    expect(rsu.length).toBeGreaterThan(0)
    expect(rsu.every((l) => l.month >= 1 && l.month <= 12)).toBe(true)
    expect(rsu.every((l) => l.amount > 0)).toBe(true)
  })

  it('drops zero-amount lumps and respects the horizon', () => {
    const lumps = compLumpSums({ ...basePkg, cashBonusPercent: 0 }, 100, 24, now)
    expect(lumps.filter((l) => l.amount === 0)).toHaveLength(0)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/compFeed.test.ts`
Expected: FAIL — cannot resolve `./compFeed`.

- [x] **Step 3: Implement**

Create `src/utils/finance/compFeed.ts`:

```ts
// Extracts future compensation cash events as forecast lump sums.
// RSU: real vest dates from generateVestEvents. Bonus: yearly at
// pkg.cashBonusMonth. ESPP: SIMPLIFICATION — the store has no per-purchase
// dates, so the annual ESPP gain lands every 12 months from now.

import {
  calcAnnualBonus,
  calcAnnualESPP,
  generateVestEvents,
  type CompensationPackage,
} from '../../store/useCompensationStore'
import type { LumpSum } from './forecast'

function monthOffset(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

export function compLumpSums(
  pkg: CompensationPackage,
  currentPrice: number,
  horizonMonths: number,
  now: Date = new Date(),
): LumpSum[] {
  const lumps: LumpSum[] = []

  // RSU vest events on their real dates.
  for (const grant of pkg.rsuGrants) {
    for (const event of generateVestEvents(grant, currentPrice)) {
      if (!event.date || event.vestValue <= 0) continue
      const offset = monthOffset(now, new Date(event.date))
      if (offset >= 1 && offset <= horizonMonths) {
        lumps.push({ month: offset, amount: event.vestValue, label: `RSU ${grant.grantName}` })
      }
    }
  }

  // Annual cash bonus at its configured month.
  const bonus = calcAnnualBonus(pkg)
  if (bonus > 0) {
    let bonusDate = new Date(now.getFullYear(), pkg.cashBonusMonth - 1, 1)
    if (monthOffset(now, bonusDate) < 1) {
      bonusDate = new Date(now.getFullYear() + 1, pkg.cashBonusMonth - 1, 1)
    }
    for (let offset = monthOffset(now, bonusDate); offset <= horizonMonths; offset += 12) {
      lumps.push({ month: offset, amount: bonus, label: 'Bonus' })
    }
  }

  // ESPP annual gain — simplified to every 12 months (no purchase dates in store).
  const espp = calcAnnualESPP(pkg)
  if (espp > 0) {
    for (let offset = 12; offset <= horizonMonths; offset += 12) {
      lumps.push({ month: offset, amount: espp, label: 'ESPP' })
    }
  }

  return lumps.sort((a, b) => a.month - b.month)
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/compFeed.test.ts`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/compFeed.ts src/utils/finance/compFeed.test.ts
git commit -m "feat: compensation lump-sum feed (RSU dates, bonus month, ESPP annual)"
```

---

### Task 5: Forecaster settings, auto-feed resolution, and editors

**Files:**
- Create: `src/components/planner/forecaster/useForecasterSettings.ts`
- Create: `src/components/planner/forecaster/ListEditor.tsx`

**Interfaces:**
- Consumes: `useToolInputs`/`usePlannerStore` (4a), `useAccountsStore`, `useBudgetStore`, `averageMonthlyNetSavings` (4b T1), `compLumpSums` (Task 4), `useCompensationStore`, `Debt`/`simulatePayoff` (4c), `LumpSum` (Task 1).
- Produces (used by Tasks 6–8):
  - `TOOL_ID = 'forecaster'`
  - `interface LifeEvent { id: string; label: string; yearsFromNow: number; amount: number }` (negative = cost, positive = windfall)
  - `interface Goal { id: string; label: string; amount: number }`
  - `useForecasterSettings(): { settings; setSetting(field, value); events: LifeEvent[]; saveEvents(next): void; goals: Goal[]; saveGoals(next): void; autoFeed: { startBalance: number; monthlySavings: number; compLumps: LumpSum[]; debtDrag: { amount: number; untilMonth: number } | null }; resolved: { startBalance: number; monthlySavings: number } }`
  - `ListEditor` — generic add/remove/edit rows component used by both the events and goals editors in Task 7.

Settings fields (all in `usePlannerStore` under `forecaster`): `years` (25), `annualReturnPct` (7), `inflationPct` (2.5), `stepUpPct` (2), `spreadPct` (2), `withdrawalRatePct` (4), `annualSpending` (48000), `showReal` (false), `view` ('line' | 'stacked'), `autoStart` (true), `autoSavings` (true), `autoComp` (true), `includeDebtDrag` (false), `manualStart` (0), `manualSavings` (2000), `mcStdDevPct` (15), `eventsJson` ('[]'), `goalsJson` ('[]').

Resolution rules: `resolved.startBalance` = `getNetWorth()` when `autoStart` else `manualStart`; `resolved.monthlySavings` = `averageMonthlyNetSavings(transactions, 3)` when `autoSavings` (falling back to `manualSavings` when the average is 0 — no budget data) else `manualSavings`; `compLumps` = `compLumpSums(primaryPackage, primaryPackage.companyCurrentPrice, years*12)` when `autoComp` else `[]`; `debtDrag` (when `includeDebtDrag`) = read tool `debt-payoff` inputs (`debtsJson`, `extraMonthly`, `strategy` defaulting to `avalanche`), run `simulatePayoff`, and produce `{ amount: totalMinPayments + extraMonthly, untilMonth: result.months ?? years*12 }`; null when disabled or no debts.

- [x] **Step 1: Implement the settings hook**

Create `src/components/planner/forecaster/useForecasterSettings.ts`:

```ts
import { usePlannerStore, useToolInputs } from '../../../store/usePlannerStore'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { useBudgetStore } from '../../../store/useBudgetStore'
import { useCompensationStore } from '../../../store/useCompensationStore'
import { averageMonthlyNetSavings } from '../../../store/budgetSelectors'
import { compLumpSums } from '../../../utils/finance/compFeed'
import { simulatePayoff, type Debt, type PayoffStrategy } from '../../../utils/finance/debtPayoff'
import type { LumpSum } from '../../../utils/finance/forecast'

export const TOOL_ID = 'forecaster'

export interface LifeEvent {
  id: string
  label: string
  yearsFromNow: number
  amount: number // negative = cost (house down payment), positive = windfall
}

export interface Goal {
  id: string
  label: string
  amount: number
}

export const FORECASTER_DEFAULTS = {
  years: 25,
  annualReturnPct: 7,
  inflationPct: 2.5,
  stepUpPct: 2,
  spreadPct: 2,
  withdrawalRatePct: 4,
  annualSpending: 48000,
  showReal: false,
  view: 'line' as string,
  autoStart: true,
  autoSavings: true,
  autoComp: true,
  includeDebtDrag: false,
  manualStart: 0,
  manualSavings: 2000,
  mcStdDevPct: 15,
  eventsJson: '[]',
  goalsJson: '[]',
}

function parseJson<T>(json: string, fallback: T): T {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

export function useForecasterSettings() {
  const settings = useToolInputs(TOOL_ID, FORECASTER_DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const debtInputs = usePlannerStore((s) => s.inputs['debt-payoff'])
  const transactions = useBudgetStore((s) => s.transactions)
  const getNetWorth = useAccountsStore((s) => s.getNetWorth)
  const primaryPackage = useCompensationStore((s) => s.primaryPackage)

  const horizonMonths = Math.max(12, Math.round(settings.years * 12))

  const budgetAvg = averageMonthlyNetSavings(transactions, 3)
  const autoFeed = {
    startBalance: getNetWorth(),
    monthlySavings: budgetAvg,
    compLumps: settings.autoComp
      ? compLumpSums(primaryPackage, primaryPackage.companyCurrentPrice, horizonMonths)
      : ([] as LumpSum[]),
    debtDrag: null as { amount: number; untilMonth: number } | null,
  }

  if (settings.includeDebtDrag && debtInputs) {
    const debts = parseJson<Debt[]>(String(debtInputs.debtsJson ?? '[]'), [])
    if (debts.length > 0) {
      const extra = Number(debtInputs.extraMonthly ?? 0)
      const strategy = (debtInputs.strategy as PayoffStrategy) ?? 'avalanche'
      const result = simulatePayoff(debts, extra, strategy)
      const totalMin = debts.reduce((s, d) => s + d.minPayment, 0)
      autoFeed.debtDrag = { amount: totalMin + extra, untilMonth: result.months ?? horizonMonths }
    }
  }

  const resolved = {
    startBalance: settings.autoStart ? autoFeed.startBalance : settings.manualStart,
    monthlySavings: settings.autoSavings
      ? (budgetAvg !== 0 ? budgetAvg : settings.manualSavings)
      : settings.manualSavings,
  }

  return {
    settings,
    setSetting: (field: string, value: number | string | boolean) => setInput(TOOL_ID, field, value),
    events: parseJson<LifeEvent[]>(settings.eventsJson as string, []),
    saveEvents: (next: LifeEvent[]) => setInput(TOOL_ID, 'eventsJson', JSON.stringify(next)),
    goals: parseJson<Goal[]>(settings.goalsJson as string, []),
    saveGoals: (next: Goal[]) => setInput(TOOL_ID, 'goalsJson', JSON.stringify(next)),
    autoFeed,
    resolved,
  }
}
```

- [x] **Step 2: Implement the generic list editor**

Create `src/components/planner/forecaster/ListEditor.tsx`:

```tsx
import React from 'react'
import { Plus, Trash2 } from 'lucide-react'

export interface ListEditorColumn<T> {
  key: keyof T & string
  label: string
  type: 'text' | 'number'
  step?: number
}

interface ListEditorProps<T extends { id: string }> {
  title: string
  items: T[]
  columns: ListEditorColumn<T>[]
  makeNew: () => T
  onChange: (next: T[]) => void
}

export function ListEditor<T extends { id: string }>({ title, items, columns, makeNew, onChange }: ListEditorProps<T>) {
  const update = (id: string, key: string, value: string | number) =>
    onChange(items.map((it) => (it.id === id ? { ...it, [key]: value } : it)))
  return (
    <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] uppercase tracking-wide text-text-secondary">{title}</p>
        <button
          onClick={() => onChange([...items, makeNew()])}
          className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-accent transition-colors"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      {items.length === 0 && <p className="text-[13px] text-text-secondary">Nothing yet.</p>}
      {items.map((it) => (
        <div key={it.id} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end border-b border-border pb-3 last:border-b-0">
          {columns.map((c) => (
            <label key={c.key} className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-text-secondary">{c.label}</span>
              <input
                type={c.type}
                step={c.step}
                className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
                value={String(it[c.key] ?? '')}
                onChange={(e) => update(it.id, c.key, c.type === 'number' ? Number(e.target.value) : e.target.value)}
              />
            </label>
          ))}
          <button
            onClick={() => onChange(items.filter((x) => x.id !== it.id))}
            className="justify-self-start p-2 rounded-lg text-text-secondary hover:text-error transition-colors"
            aria-label="Remove row"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [x] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit && npx vitest run src/utils/finance`
Expected: no type errors; finance tests still pass.

- [x] **Step 4: Commit**

```bash
git add src/components/planner/forecaster/useForecasterSettings.ts src/components/planner/forecaster/ListEditor.tsx
git commit -m "feat: forecaster settings hook with auto-feed resolution + generic list editor"
```

---

### Task 6: Forecast chart component

**Files:**
- Create: `src/components/planner/forecaster/ForecastChart.tsx`

**Interfaces:**
- Consumes: `ForecastPoint`/`LumpSum` (Task 1), `NetWorthSnapshot` from `useAccountsStore`, `formatMoney` (4a), Recharts.
- Produces: `ForecastChart: React.FC<{ points: ForecastPoint[]; history: NetWorthSnapshot[]; showReal: boolean; view: 'line' | 'stacked'; goalMarkers: { label: string; month: number | null; amount: number }[] }>` — used by Task 7.

Chart data: history snapshots become points at negative month offsets (whole months before now, actual value in every band key so the past renders as one line); forecast points from month 0. `view === 'line'` → conservative/optimistic Areas (band) + base (or real) Line + actual history line; `view === 'stacked'` → contributed + growth stacked Areas. Goal markers: `ReferenceLine` at each goal's reached month with its label; ReferenceLine at x=0 labelled "today".

- [x] **Step 1: Implement**

Create `src/components/planner/forecaster/ForecastChart.tsx`:

```tsx
import React from 'react'
import {
  Area, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { NetWorthSnapshot } from '../../../store/useAccountsStore'
import type { ForecastPoint } from '../../../utils/finance/forecast'
import { formatMoney } from '../format'

interface GoalMarker {
  label: string
  month: number | null
  amount: number
}

interface ForecastChartProps {
  points: ForecastPoint[]
  history: NetWorthSnapshot[]
  showReal: boolean
  view: 'line' | 'stacked'
  goalMarkers: GoalMarker[]
}

function monthsAgo(date: string): number {
  const d = new Date(`${date}T00:00:00`)
  const now = new Date()
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ points, history, showReal, view, goalMarkers }) => {
  const past = history
    .map((h) => ({ month: monthsAgo(h.date), actual: h.value }))
    .filter((p) => p.month < 0)
  // Downsample forecast to quarterly points to keep the chart light.
  const future = points
    .filter((p) => p.month % 3 === 0)
    .map((p) => ({
      month: p.month,
      projected: Math.round(showReal ? p.real : p.base),
      conservative: Math.round(p.conservative),
      optimistic: Math.round(p.optimistic),
      contributed: Math.round(p.contributed),
      growth: Math.round(Math.max(0, p.growth)),
    }))
  const data = [...past, ...future]

  const axisProps = {
    stroke: 'var(--text-secondary)',
    tick: { fill: 'var(--text-secondary)', fontSize: 12 },
  }

  return (
    <div className="themed-card rounded-lg p-4 h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(m: number) => `${(m / 12).toFixed(0)}y`}
            {...axisProps}
          />
          <YAxis width={72} tickFormatter={(v: number) => formatMoney(v)} {...axisProps} />
          <Tooltip
            labelFormatter={(m: number) => (m < 0 ? `${-m}mo ago` : `+${(m / 12).toFixed(1)}y`)}
            formatter={(value: number, name: string) => [formatMoney(value), name]}
            contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
          <ReferenceLine x={0} stroke="var(--text-secondary)" strokeDasharray="4 4" label={{ value: 'today', fill: 'var(--text-secondary)', fontSize: 11 }} />
          {view === 'line' ? (
            <>
              <Area type="monotone" dataKey="optimistic" stroke="none" fill="var(--accent)" fillOpacity={0.12} name="Optimistic" />
              <Area type="monotone" dataKey="conservative" stroke="none" fill="var(--bg-primary)" fillOpacity={0.9} name="Conservative" />
              <Line type="monotone" dataKey="projected" stroke="var(--accent)" strokeWidth={2} dot={false} name={showReal ? 'Projected (real)' : 'Projected'} />
            </>
          ) : (
            <>
              <Area type="monotone" dataKey="contributed" stackId="s" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.25} name="Contributed" />
              <Area type="monotone" dataKey="growth" stackId="s" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} name="Growth" />
            </>
          )}
          <Line type="monotone" dataKey="actual" stroke="var(--text-primary)" strokeWidth={2} dot={false} name="Actual" />
          {goalMarkers
            .filter((g) => g.month !== null)
            .map((g) => (
              <ReferenceLine
                key={g.label}
                x={g.month as number}
                stroke="var(--accent)"
                strokeDasharray="2 4"
                label={{ value: g.label, fill: 'var(--accent)', fontSize: 11, position: 'top' }}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [x] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [x] **Step 3: Commit**

```bash
git add src/components/planner/forecaster/ForecastChart.tsx
git commit -m "feat: forecaster chart — history + bands + stacked view + goal markers"
```

---

### Task 7: Forecaster tool page (core + smart tiers) and registry swap

**Files:**
- Create: `src/components/planner/forecaster/ForecasterTool.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (replace the `forecaster` entry's component + description)
- Delete: `src/components/investments/ProjectionWidget.tsx`
- Delete: `src/store/useProjectionStore.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6 plus `CalculatorField`/`ResultCard`/`formatMoney` (4a).
- Produces: `ForecasterTool: React.FC` registered as tool `forecaster` (same id — the hub tile and route don't change).

Assembly (all derivation during render, no effects):

```
lumps = autoFeed.compLumps + events mapped to { month: yearsFromNow*12, amount, label }
config = { startBalance: resolved.startBalance, monthlySavings: resolved.monthlySavings,
           annualReturnPct, inflationPct, stepUpPct, years, lumpSums: lumps,
           scenarioSpreadPct: spreadPct, monthlyDrag: autoFeed.debtDrag ?? undefined }
points = buildForecast(config)
fi = fiNumber(annualSpending, withdrawalRatePct)
fiMonth = monthsToReach(points, fi)
coast = coastFiNumber(fi, annualReturnPct, years)
goalMarkers = goals.map(g => ({ label: g.label, month: monthsToReach(points, g.amount), amount: g.amount }))
```

- [x] **Step 1: Implement the page**

Create `src/components/planner/forecaster/ForecasterTool.tsx`:

```tsx
import React from 'react'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { buildForecast, type LumpSum } from '../../../utils/finance/forecast'
import { coastFiNumber, fiNumber, monthsToReach } from '../../../utils/finance/fire'
import { CalculatorField } from '../CalculatorField'
import { ResultCard } from '../ResultCard'
import { formatMoney } from '../format'
import { ForecastChart } from './ForecastChart'
import { ListEditor } from './ListEditor'
import { MonteCarloSection } from './MonteCarloSection'
import { useForecasterSettings, type Goal, type LifeEvent } from './useForecasterSettings'

function formatMonthsOut(m: number | null): string {
  if (m === null) return 'Beyond horizon'
  if (m === 0) return 'Reached'
  const d = new Date()
  d.setMonth(d.getMonth() + m)
  return `${d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })} (${Math.floor(m / 12)}y ${m % 12}m)`
}

/** Toggle between an auto-fed value and a manual field. */
const AutoField: React.FC<{
  label: string
  auto: boolean
  autoValue: number
  autoHint: string
  manualValue: number
  onToggle: (auto: boolean) => void
  onManual: (v: number) => void
}> = ({ label, auto, autoValue, autoHint, manualValue, onToggle, onManual }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      <button
        onClick={() => onToggle(!auto)}
        className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
          auto ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
        }`}
      >
        {auto ? `auto: ${autoHint}` : 'manual'}
      </button>
    </div>
    {auto ? (
      <div className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px]">
        {formatMoney(autoValue)}
      </div>
    ) : (
      <CalculatorField label="" value={manualValue} onChange={onManual} step={100} prefix="$" />
    )}
  </div>
)

export const ForecasterTool: React.FC = () => {
  const { settings, setSetting, events, saveEvents, goals, saveGoals, autoFeed, resolved } = useForecasterSettings()
  const history = useAccountsStore((s) => s.history)

  const eventLumps: LumpSum[] = events.map((e) => ({
    month: Math.max(1, Math.round(e.yearsFromNow * 12)),
    amount: e.amount,
    label: e.label,
  }))
  const lumps = [...autoFeed.compLumps, ...eventLumps]

  const points = buildForecast({
    startBalance: resolved.startBalance,
    monthlySavings: resolved.monthlySavings,
    annualReturnPct: settings.annualReturnPct,
    annualInflationPct: settings.inflationPct,
    contributionStepUpPct: settings.stepUpPct,
    years: settings.years,
    lumpSums: lumps,
    scenarioSpreadPct: settings.spreadPct,
    monthlyDrag: autoFeed.debtDrag ?? undefined,
  })

  const fi = fiNumber(settings.annualSpending, settings.withdrawalRatePct)
  const fiMonth = monthsToReach(points, fi)
  const coast = coastFiNumber(fi, settings.annualReturnPct, settings.years)
  const goalMarkers = goals.map((g) => ({ label: g.label, month: monthsToReach(points, g.amount), amount: g.amount }))

  return (
    <div className="flex flex-col gap-6">
      {/* Auto-fed inputs with manual overrides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AutoField
          label="Starting balance"
          auto={settings.autoStart as boolean}
          autoValue={autoFeed.startBalance}
          autoHint="Dashboard net worth"
          manualValue={settings.manualStart}
          onToggle={(v) => setSetting('autoStart', v)}
          onManual={(v) => setSetting('manualStart', v)}
        />
        <AutoField
          label="Monthly savings"
          auto={settings.autoSavings as boolean}
          autoValue={resolved.monthlySavings}
          autoHint="Budget avg (3mo)"
          manualValue={settings.manualSavings}
          onToggle={(v) => setSetting('autoSavings', v)}
          onManual={(v) => setSetting('manualSavings', v)}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Comp events / debt drag</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSetting('autoComp', !settings.autoComp)}
              className={`flex-1 text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.autoComp ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              {settings.autoComp ? `${autoFeed.compLumps.length} comp events on` : 'comp events off'}
            </button>
            <button
              onClick={() => setSetting('includeDebtDrag', !settings.includeDebtDrag)}
              className={`flex-1 text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.includeDebtDrag ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              {autoFeed.debtDrag ? `debt drag ${formatMoney(autoFeed.debtDrag.amount)}/mo` : 'debt drag off'}
            </button>
          </div>
        </div>
      </div>

      {/* What-if sliders */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <CalculatorField label="Years" min={1} max={50} value={settings.years} onChange={(v) => setSetting('years', v)} />
        <CalculatorField label="Return" suffix="%" step={0.1} value={settings.annualReturnPct} onChange={(v) => setSetting('annualReturnPct', v)} />
        <CalculatorField label="Inflation" suffix="%" step={0.1} value={settings.inflationPct} onChange={(v) => setSetting('inflationPct', v)} />
        <CalculatorField label="Contribution step-up" suffix="%/yr" step={0.5} value={settings.stepUpPct} onChange={(v) => setSetting('stepUpPct', v)} />
        <CalculatorField label="Scenario spread" suffix="±%" step={0.5} value={settings.spreadPct} onChange={(v) => setSetting('spreadPct', v)} />
      </div>

      {/* View toggles */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSetting('showReal', !settings.showReal)}
          className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
            settings.showReal ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
          }`}
        >
          {settings.showReal ? "Real (today's dollars)" : 'Nominal'}
        </button>
        <button
          onClick={() => setSetting('view', settings.view === 'line' ? 'stacked' : 'line')}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          {settings.view === 'line' ? 'Show contributions vs growth' : 'Show scenario bands'}
        </button>
      </div>

      <ForecastChart
        points={points}
        history={history}
        showReal={settings.showReal as boolean}
        view={settings.view as 'line' | 'stacked'}
        goalMarkers={goalMarkers}
      />

      {/* FIRE engine */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CalculatorField label="Annual spending in retirement" prefix="$" step={1000} value={settings.annualSpending} onChange={(v) => setSetting('annualSpending', v)} />
        <CalculatorField label="Withdrawal rate" suffix="%" step={0.1} value={settings.withdrawalRatePct} onChange={(v) => setSetting('withdrawalRatePct', v)} />
        <ResultCard label="FI number" value={formatMoney(fi)} highlight />
        <ResultCard label="Projected FI date" value={formatMonthsOut(fiMonth)} />
      </div>
      <ResultCard
        label={`Coast-FI (needed today to coast for ${settings.years}y)`}
        value={`${formatMoney(coast)} — you have ${formatMoney(resolved.startBalance)} (${resolved.startBalance >= coast ? 'coasting ✓' : 'not yet'})`}
      />

      {/* Goals + life events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <ListEditor<Goal>
            title="Goals (net-worth targets)"
            items={goals}
            columns={[
              { key: 'label', label: 'Goal', type: 'text' },
              { key: 'amount', label: 'Amount ($)', type: 'number', step: 1000 },
            ]}
            makeNew={() => ({ id: `g${Date.now()}`, label: 'New goal', amount: 100000 })}
            onChange={saveGoals}
          />
          {goalMarkers.map((g) => (
            <p key={g.label} className="text-[13px] text-text-secondary">
              {g.label} ({formatMoney(g.amount)}): <span className="text-text-primary">{formatMonthsOut(g.month)}</span>
            </p>
          ))}
        </div>
        <ListEditor<LifeEvent>
          title="Life events (negative = cost, positive = windfall)"
          items={events}
          columns={[
            { key: 'label', label: 'Event', type: 'text' },
            { key: 'yearsFromNow', label: 'Years from now', type: 'number', step: 0.5 },
            { key: 'amount', label: 'Amount ($)', type: 'number', step: 1000 },
          ]}
          makeNew={() => ({ id: `e${Date.now()}`, label: 'House down payment', yearsFromNow: 3, amount: -100000 })}
          onChange={saveEvents}
        />
      </div>

      <MonteCarloSection
        startBalance={resolved.startBalance}
        monthlySavings={resolved.monthlySavings}
        years={settings.years}
        meanReturnPct={settings.annualReturnPct}
        stdDevPct={settings.mcStdDevPct}
        stepUpPct={settings.stepUpPct}
        lumpSums={lumps}
        target={fi}
        onStdDevChange={(v) => setSetting('mcStdDevPct', v)}
      />
    </div>
  )
}
```

(`MonteCarloSection` is created in Task 8 — implement Tasks 7 and 8 in the same working session, or temporarily stub the import if committing separately. Preferred: build Task 8's file first, then this one compiles immediately; the task split here is for review granularity.)

- [x] **Step 2: Swap the registry entry and delete the old projection code**

In `src/components/planner/toolRegistry.tsx`: remove the `ProjectionWidget` import, import `ForecasterTool` from `./forecaster/ForecasterTool`, and update the existing `forecaster` entry:

```tsx
import { ForecasterTool } from './forecaster/ForecasterTool'
```

```tsx
  {
    id: 'forecaster',
    name: 'Net-Worth / FIRE Forecaster',
    description: 'Your history projected forward — scenarios, FIRE date, goals, Monte Carlo.',
    icon: TrendingUp,
    component: ForecasterTool,
  },
```

Then:

```bash
git rm src/components/investments/ProjectionWidget.tsx src/store/useProjectionStore.ts
```

(Verify first with `rg -l "ProjectionWidget|useProjectionStore" src` that the registry was the only remaining importer.)

- [x] **Step 3: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: ALL PASS, no dangling imports.

- [x] **Step 4: Commit**

```bash
git add -A src/components/planner src/components/investments src/store
git commit -m "feat: full FIRE forecaster replaces ProjectionWidget (auto-feed, FIRE, goals, events)"
```

---

### Task 8: Monte Carlo section component

**Files:**
- Create: `src/components/planner/forecaster/MonteCarloSection.tsx`

**Interfaces:**
- Consumes: `runMonteCarlo`, `probabilityOfSuccess` (Task 3), `LumpSum` (Task 1), Recharts, 4a primitives.
- Produces: `MonteCarloSection: React.FC<{ startBalance: number; monthlySavings: number; years: number; meanReturnPct: number; stdDevPct: number; stepUpPct: number; lumpSums: LumpSum[]; target: number; onStdDevChange: (v: number) => void }>` — consumed by Task 7.

- [x] **Step 1: Implement**

Create `src/components/planner/forecaster/MonteCarloSection.tsx`:

```tsx
import React, { useMemo } from 'react'
import {
  Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { probabilityOfSuccess, runMonteCarlo } from '../../../utils/finance/monteCarlo'
import type { LumpSum } from '../../../utils/finance/forecast'
import { CalculatorField } from '../CalculatorField'
import { ResultCard } from '../ResultCard'
import { formatMoney } from '../format'

interface MonteCarloSectionProps {
  startBalance: number
  monthlySavings: number
  years: number
  meanReturnPct: number
  stdDevPct: number
  stepUpPct: number
  lumpSums: LumpSum[]
  target: number
  onStdDevChange: (v: number) => void
}

export const MonteCarloSection: React.FC<MonteCarloSectionProps> = (props) => {
  const { bands, finalBalances } = useMemo(
    () =>
      runMonteCarlo({
        startBalance: props.startBalance,
        monthlySavings: props.monthlySavings,
        years: props.years,
        meanReturnPct: props.meanReturnPct,
        stdDevPct: props.stdDevPct,
        contributionStepUpPct: props.stepUpPct,
        lumpSums: props.lumpSums,
      }),
    [props.startBalance, props.monthlySavings, props.years, props.meanReturnPct, props.stdDevPct, props.stepUpPct, props.lumpSums],
  )
  const success = probabilityOfSuccess(finalBalances, props.target)
  // Stacked-fan encoding: base (transparent) + widths between percentiles.
  const data = bands.map((b) => ({
    year: b.year,
    p10: Math.round(b.p10),
    w1090: Math.round(b.p90 - b.p10),
    p50: Math.round(b.p50),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
        <CalculatorField label="Volatility (std dev)" suffix="%" step={1} value={props.stdDevPct} onChange={props.onStdDevChange} />
        <ResultCard label={`Chance of reaching ${formatMoney(props.target)}`} value={`${Math.round(success * 100)}%`} highlight />
        <ResultCard label="Median outcome" value={formatMoney(bands[bands.length - 1]?.p50 ?? 0)} />
      </div>
      <div className="themed-card rounded-lg p-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis width={72} tickFormatter={(v: number) => formatMoney(v)} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, name: string) => [formatMoney(value), name === 'w1090' ? 'P10–P90 width' : name.toUpperCase()]}
              contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <Area type="monotone" dataKey="p10" stackId="fan" stroke="none" fill="transparent" name="p10" />
            <Area type="monotone" dataKey="w1090" stackId="fan" stroke="none" fill="var(--accent)" fillOpacity={0.18} name="w1090" />
            <Line type="monotone" dataKey="p50" stroke="var(--accent)" strokeWidth={2} dot={false} name="p50" />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-[12px] text-text-secondary mt-2">
          500 seeded simulations — shaded band spans the 10th to 90th percentile.
        </p>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + all pass.

- [x] **Step 3: Commit**

```bash
git add src/components/planner/forecaster/MonteCarloSection.tsx
git commit -m "feat: Monte Carlo percentile fan + probability-of-success readout"
```

---

### Task 9: PHASE 4 gate — spec "Done when" end-to-end, mobile + 5 themes, PROGRESS.md

**Files:**
- Modify: `docs/superpowers/plans/PROGRESS.md` (mark Phase 4 complete)
- Modify: `docs/superpowers/plans/2026-07-02-phase-4e-fire-forecaster.md` and `2026-07-02-phase-4-planner.md` (check off / mark done)

- [x] **Step 1: Full automated gate**

```bash
npx vitest run
npm run lint
npm run build
```

Expected: all pass; changed files lint clean.

- [x] **Step 2: Manual acceptance — the spec's Phase 4 "Done when"**

`npm run dev`, then verify the full spec criterion — *"Planner shows a Bento grid of tools; the forecaster pulls live from other modules and renders all listed views; each calculator is functional and persisted"*:

1. Hub lists all 12 tools (forecaster + 11 calculators from 4a–4d).
2. Forecaster auto-feed: change an account value on Dashboard → forecaster starting balance follows; add budget transactions → monthly savings follows; set up an RSU grant + bonus in Compensation → comp events appear as lumps (count shown on the toggle chip).
3. All views: bands ↔ stacked toggle, nominal ↔ real, goals show projected dates + chart markers, life events bend the curve, debt drag (with 4c debts entered) lowers early growth, Monte Carlo band + probability update with volatility.
4. Every calculator input on every tool survives a reload (persistence).
5. Cycle all 5 themes on the forecaster + spot-check 3 calculators; 375px viewport across the forecaster (charts stay in cards, controls wrap, no horizontal scroll).
6. Offline (DevTools): forecaster still renders (no market data dependency); currency converter degrades to cache/override.

- [x] **Step 3: Update PROGRESS.md and commit**

Mark Phase 4 complete in the phase checklist, log 4e, set next = "Plan Phase 5a JIT".

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-4e-fire-forecaster.md docs/superpowers/plans/2026-07-02-phase-4-planner.md
git commit -m "chore: complete Phase 4 — Planner hub with 12 tools and FIRE forecaster verified"
```
