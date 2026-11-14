# Phase 4d — Canada Tax Calculators (Take-Home Pay, Income Tax Estimator, RRSP-vs-TFSA)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three Canada-specific calculators on the Planner hub — Take-home pay (gross→net by province), Income tax estimator (marginal + effective with bracket visualization), and RRSP-vs-TFSA optimizer — backed by one pure, table-driven `canadaTax.ts` module with sourced 2026 tax data.

**Architecture:** All tax math lives in `src/utils/finance/canadaTax.ts` as typed constant tables (federal + 13 provinces/territories + CPP/EI) and pure functions. The three calculators are thin composers of the 4a primitives (`CalculatorField`, `ResultCard`, `formatMoney`) reading/writing `usePlannerStore`. No new store keys, no market data.

**Tech Stack:** React 19, Zustand v5 `persist` (existing `ledger-planner` store), Tailwind v4, Vitest (globals: true). No charts needed — the bracket visualization is CSS bars.

**Umbrella plan:** `2026-07-02-phase-4-planner.md`. **Prerequisite:** Phase 4a complete (registry, store, primitives exist). 4b/4c are NOT prerequisites.

## Global Constraints

- **Zero backend / zero-infra.** Static SPA; everything client-side.
- **Local-first persistence.** All inputs via `usePlannerStore` (`useToolInputs`/`setInput`) — already registered in `BACKUP_KEYS`; **no new keys in this sub-plan**.
- **No hardcoded colors — theme CSS variables only.** Must work in ALL 5 themes: `geometric`, `tactical`, `luxury`, `aurora`, `glass`.
- **Mobile + all 5 themes are acceptance gates** (final task).
- **Testing is minimal by direction of the user (2026-07-02):** the tax math module gets table-driven tests against hand-computed values (that's where correctness risk lives); calculator components get NO dedicated test files — they are covered by the registry-driven `Planner.test.tsx` hub test plus the manual gate. Do not add component test files.
- **Commit after every task.** Lint enforces `react-hooks/set-state-in-effect` — write to the store only from event handlers.

**Run commands:** single test file `npx vitest run <path>`; all tests `npx vitest run`; lint `npm run lint`; build `npm run build`.

## Tax data provenance (retrieved 2026-07-02 — cite in code comments)

- **Federal brackets & rates 2026** (lowest rate 14% for 2026; indexation 2.0%): CRA via KPMG "Federal and Provincial/Territorial Income Tax Rates and Brackets for 2026" (current as of Dec 31, 2025), https://assets.kpmg.com/content/dam/kpmg/ca/pdf/2026/01/ca-federal-and-provincial-territorial-income-tax-rates-and-brackets-for-2026.pdf
- **Federal BPA 2026:** $16,452 (phases down for income above the 29% threshold; floor is the 2025 minimum $14,538 indexed 2.0% → $14,829). Source: CRA indexation announcement (reported by Yahoo Finance CA / Fazzari+Partners tax alert).
- **Provincial/territorial brackets 2026:** same KPMG PDF (all 13 jurisdictions, incl. Ontario surtax 20%/36% over $5,818/$7,446).
- **BC exception:** BC Budget 2026 raised the lowest BC rate from 5.06% to **5.6%** for 2026+ (TaxTips.ca BC page). Use 5.6%.
- **Provincial BPAs 2026:** TaxTips.ca "2026 Non-Refundable Personal Tax Credits", https://www.taxtips.ca/nrcredits/tax-credits-2026.htm
- **Quebec BPA 2026:** $18,952 (Finances Québec "Parameters of the Personal Income Tax System for 2026"). Quebec residents also get the 16.5% federal abatement.
- **CPP 2026:** rate 5.95%, basic exemption $3,500, YMPE $74,600 (max $4,230.45); **CPP2** 4.0% on YMPE→YAMPE $85,000 (max $416). Source: CRA (via UAPP/WealthNorth summaries of the CRA release).
- **EI 2026:** 1.63% (QC 1.30%) up to MIE $68,900 → max $1,123.07 ($895.70 QC).

**Documented simplifications** (put in the module doc comment): employee-side only; BPA is the only credit modelled (no employment amount, no CPP/EI credits); Quebec take-home approximates QPP/QPIP with CPP + QC EI rate; no Ontario Health Premium / QC HSF. This is an estimator, not a payroll engine.

---

### Task 1: `src/utils/finance/canadaTax.ts` — 2026 tables + pure tax functions

**Files:**
- Create: `src/utils/finance/canadaTax.ts`
- Create: `src/utils/finance/canadaTax.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 2–4):
  - `type Province = 'BC' | 'AB' | 'SK' | 'MB' | 'ON' | 'QC' | 'NB' | 'NS' | 'PE' | 'NL' | 'YT' | 'NT' | 'NU'`
  - `PROVINCES: { code: Province; name: string }[]` (for `<select>` options)
  - `interface Bracket { upTo: number; rate: number }` (rate as decimal; last bracket `upTo: Infinity`)
  - `federalTax(income: number, province: Province): number` (after BPA credit and QC abatement)
  - `provincialTax(income: number, province: Province): number` (after provincial BPA credit; includes ON surtax)
  - `cppContribution(income: number): number` (base + CPP2)
  - `eiPremium(income: number, province: Province): number`
  - `totalIncomeTax(income: number, province: Province): number` (federal + provincial)
  - `marginalRate(income: number, province: Province): number` (percent, income tax only)
  - `effectiveRate(income: number, province: Province): number` (percent, income tax only)
  - `takeHomePay(gross: number, province: Province): TakeHome` where `interface TakeHome { gross: number; federal: number; provincial: number; cpp: number; ei: number; net: number }`
  - `PROVINCIAL_TAX: Record<Province, { name: string; brackets: Bracket[]; bpa: number }>` and `FEDERAL_BRACKETS: Bracket[]` exported for the bracket visualization in Task 3.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/canadaTax.test.ts` (values hand-computed from the sourced tables; keep the derivations in comments so a reviewer can re-check):

```ts
import {
  cppContribution,
  effectiveRate,
  eiPremium,
  federalTax,
  marginalRate,
  provincialTax,
  takeHomePay,
} from './canadaTax'

describe('federalTax', () => {
  it('is zero at or below the BPA', () => {
    expect(federalTax(16452, 'ON')).toBe(0)
    expect(federalTax(10000, 'ON')).toBe(0)
  })

  it('taxes $100k in ON correctly', () => {
    // 58,523×0.14 + (100,000−58,523)×0.205 = 8,193.22 + 8,502.79 = 16,696.01
    // minus BPA credit 16,452×0.14 = 2,303.28 → 14,392.73
    expect(federalTax(100_000, 'ON')).toBeCloseTo(14_392.73, 0)
  })

  it('applies the 16.5% Quebec abatement', () => {
    expect(federalTax(100_000, 'QC')).toBeCloseTo(14_392.73 * 0.835, 0)
  })
})

describe('provincialTax', () => {
  it('taxes $100k in ON correctly including surtax', () => {
    // 53,891×0.0505 + (100,000−53,891)×0.0915 = 2,721.50 + 4,218.97 = 6,940.47
    // minus BPA credit 12,989×0.0505 = 655.94 → 6,284.52
    // surtax: (6,284.52 − 5,818)×0.20 = 93.30 → total 6,377.83
    expect(provincialTax(100_000, 'ON')).toBeCloseTo(6_377.83, 0)
  })

  it('taxes $100k in AB correctly', () => {
    // 61,200×0.08 + (100,000−61,200)×0.10 = 4,896 + 3,880 = 8,776
    // minus BPA credit 22,769×0.08 = 1,821.52 → 6,954.48
    expect(provincialTax(100_000, 'AB')).toBeCloseTo(6_954.48, 0)
  })

  it('never returns negative tax', () => {
    expect(provincialTax(5_000, 'NL')).toBe(0)
  })
})

describe('CPP and EI (2026)', () => {
  it('caps CPP base + CPP2 at the 2026 maxima', () => {
    // (74,600−3,500)×0.0595 = 4,230.45; CPP2 (85,000−74,600)×0.04 = 416
    expect(cppContribution(120_000)).toBeCloseTo(4_646.45, 2)
  })

  it('computes partial CPP below YMPE and zero below the exemption', () => {
    expect(cppContribution(53_500)).toBeCloseTo((53_500 - 3_500) * 0.0595, 2)
    expect(cppContribution(3_000)).toBe(0)
  })

  it('caps EI at the 2026 maximum, with the Quebec rate', () => {
    expect(eiPremium(80_000, 'ON')).toBeCloseTo(68_900 * 0.0163, 2) // 1,123.07
    expect(eiPremium(80_000, 'QC')).toBeCloseTo(68_900 * 0.013, 2) // 895.70
  })
})

describe('rates and take-home', () => {
  it('marginal rate at $100k ON is fed 20.5 + ON 9.15×1.20 surtax = 31.48', () => {
    expect(marginalRate(100_000, 'ON')).toBeCloseTo(31.48, 1)
  })

  it('effective rate is total tax over income', () => {
    expect(effectiveRate(100_000, 'ON')).toBeCloseTo(((14_392.73 + 6_377.83) / 100_000) * 100, 1)
  })

  it('take-home for $100k ON nets all components', () => {
    const t = takeHomePay(100_000, 'ON')
    expect(t.federal).toBeCloseTo(14_392.73, 0)
    expect(t.provincial).toBeCloseTo(6_377.83, 0)
    expect(t.cpp).toBeCloseTo(4_646.45, 2)
    expect(t.ei).toBeCloseTo(1_123.07, 2)
    expect(t.net).toBeCloseTo(100_000 - 14_392.73 - 6_377.83 - 4_646.45 - 1_123.07, 0)
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/canadaTax.test.ts`
Expected: FAIL — cannot resolve `./canadaTax`.

- [x] **Step 3: Implement**

Create `src/utils/finance/canadaTax.ts`:

```ts
// 2026 Canadian personal income tax estimator — employee side only.
//
// Sources (retrieved 2026-07-02):
// - Brackets (federal + all provinces/territories, ON surtax): KPMG
//   "Federal and Provincial/Territorial Income Tax Rates and Brackets for 2026"
//   (current as of 2025-12-31). BC lowest rate updated to 5.6% per BC Budget
//   2026 (TaxTips.ca). Federal lowest rate is 14% for 2026.
// - BPAs: TaxTips.ca 2026 non-refundable credits; QC BPA $18,952 from
//   Finances Québec "Parameters of the Personal Income Tax System for 2026".
// - CPP/CPP2/EI 2026: CRA release — YMPE $74,600, YAMPE $85,000, rates
//   5.95%/4.00%; EI 1.63% (QC 1.30%) on max insurable earnings $68,900.
//
// Simplifications (this is an estimator, not payroll): only the basic
// personal amount credit is modelled; Quebec uses the 16.5% federal
// abatement and approximates QPP/QPIP with CPP + the QC EI rate; no
// Ontario Health Premium or QC Health Services Fund.

export type Province =
  | 'BC' | 'AB' | 'SK' | 'MB' | 'ON' | 'QC' | 'NB'
  | 'NS' | 'PE' | 'NL' | 'YT' | 'NT' | 'NU'

export interface Bracket {
  upTo: number // upper bound of the bracket; Infinity for the top bracket
  rate: number // decimal, e.g. 0.14
}

export const FEDERAL_BRACKETS: Bracket[] = [
  { upTo: 58_523, rate: 0.14 },
  { upTo: 117_045, rate: 0.205 },
  { upTo: 181_440, rate: 0.26 },
  { upTo: 258_482, rate: 0.29 },
  { upTo: Infinity, rate: 0.33 },
]

// Federal BPA phases from the max down to the min across the 29% bracket.
const FEDERAL_BPA_MAX = 16_452
const FEDERAL_BPA_MIN = 14_829 // 2025 floor 14,538 × 1.02 indexation
const QC_ABATEMENT = 0.165

export const PROVINCIAL_TAX: Record<Province, { name: string; brackets: Bracket[]; bpa: number }> = {
  BC: {
    name: 'British Columbia',
    bpa: 13_216,
    brackets: [
      { upTo: 50_363, rate: 0.056 }, // 5.6% per BC Budget 2026 (was 5.06%)
      { upTo: 100_728, rate: 0.077 },
      { upTo: 115_648, rate: 0.105 },
      { upTo: 140_430, rate: 0.1229 },
      { upTo: 190_405, rate: 0.147 },
      { upTo: 265_545, rate: 0.168 },
      { upTo: Infinity, rate: 0.205 },
    ],
  },
  AB: {
    name: 'Alberta',
    bpa: 22_769,
    brackets: [
      { upTo: 61_200, rate: 0.08 },
      { upTo: 154_259, rate: 0.1 },
      { upTo: 185_111, rate: 0.12 },
      { upTo: 246_813, rate: 0.13 },
      { upTo: 370_220, rate: 0.14 },
      { upTo: Infinity, rate: 0.15 },
    ],
  },
  SK: {
    name: 'Saskatchewan',
    bpa: 20_381,
    brackets: [
      { upTo: 54_532, rate: 0.105 },
      { upTo: 155_805, rate: 0.125 },
      { upTo: Infinity, rate: 0.145 },
    ],
  },
  MB: {
    name: 'Manitoba',
    bpa: 15_780,
    brackets: [
      { upTo: 47_000, rate: 0.108 },
      { upTo: 100_000, rate: 0.1275 },
      { upTo: Infinity, rate: 0.174 },
    ],
  },
  ON: {
    name: 'Ontario',
    bpa: 12_989,
    brackets: [
      { upTo: 53_891, rate: 0.0505 },
      { upTo: 107_785, rate: 0.0915 },
      { upTo: 150_000, rate: 0.1116 },
      { upTo: 220_000, rate: 0.1216 },
      { upTo: Infinity, rate: 0.1316 },
    ],
  },
  QC: {
    name: 'Quebec',
    bpa: 18_952,
    brackets: [
      { upTo: 54_345, rate: 0.14 },
      { upTo: 108_680, rate: 0.19 },
      { upTo: 132_245, rate: 0.24 },
      { upTo: Infinity, rate: 0.2575 },
    ],
  },
  NB: {
    name: 'New Brunswick',
    bpa: 13_664,
    brackets: [
      { upTo: 52_333, rate: 0.094 },
      { upTo: 104_666, rate: 0.14 },
      { upTo: 193_861, rate: 0.16 },
      { upTo: Infinity, rate: 0.195 },
    ],
  },
  NS: {
    name: 'Nova Scotia',
    bpa: 11_932,
    brackets: [
      { upTo: 30_995, rate: 0.0879 },
      { upTo: 61_991, rate: 0.1495 },
      { upTo: 97_417, rate: 0.1667 },
      { upTo: 157_124, rate: 0.175 },
      { upTo: Infinity, rate: 0.21 },
    ],
  },
  PE: {
    name: 'Prince Edward Island',
    bpa: 15_000,
    brackets: [
      { upTo: 33_928, rate: 0.095 },
      { upTo: 65_820, rate: 0.1347 },
      { upTo: 106_890, rate: 0.166 },
      { upTo: 142_250, rate: 0.1762 },
      { upTo: Infinity, rate: 0.19 },
    ],
  },
  NL: {
    name: 'Newfoundland and Labrador',
    bpa: 11_188,
    brackets: [
      { upTo: 44_678, rate: 0.087 },
      { upTo: 89_354, rate: 0.145 },
      { upTo: 159_528, rate: 0.158 },
      { upTo: 223_340, rate: 0.178 },
      { upTo: 285_319, rate: 0.198 },
      { upTo: 570_638, rate: 0.208 },
      { upTo: 1_141_275, rate: 0.213 },
      { upTo: Infinity, rate: 0.218 },
    ],
  },
  YT: {
    name: 'Yukon',
    bpa: 16_452,
    brackets: [
      { upTo: 58_523, rate: 0.064 },
      { upTo: 117_045, rate: 0.09 },
      { upTo: 181_440, rate: 0.109 },
      { upTo: 500_000, rate: 0.128 },
      { upTo: Infinity, rate: 0.15 },
    ],
  },
  NT: {
    name: 'Northwest Territories',
    bpa: 18_198,
    brackets: [
      { upTo: 53_003, rate: 0.059 },
      { upTo: 106_009, rate: 0.086 },
      { upTo: 172_346, rate: 0.122 },
      { upTo: Infinity, rate: 0.1405 },
    ],
  },
  NU: {
    name: 'Nunavut',
    bpa: 19_659,
    brackets: [
      { upTo: 55_801, rate: 0.04 },
      { upTo: 111_602, rate: 0.07 },
      { upTo: 181_439, rate: 0.09 },
      { upTo: Infinity, rate: 0.115 },
    ],
  },
}

export const PROVINCES: { code: Province; name: string }[] = (
  Object.entries(PROVINCIAL_TAX) as [Province, { name: string }][]
).map(([code, v]) => ({ code, name: v.name }))

// 2026 CPP / EI parameters
const CPP_RATE = 0.0595
const CPP_EXEMPTION = 3_500
const YMPE = 74_600
const CPP2_RATE = 0.04
const YAMPE = 85_000
const EI_RATE = 0.0163
const EI_RATE_QC = 0.013
const EI_MAX_INSURABLE = 68_900

function bracketTax(income: number, brackets: Bracket[]): number {
  let tax = 0
  let lower = 0
  for (const b of brackets) {
    if (income <= lower) break
    tax += (Math.min(income, b.upTo) - lower) * b.rate
    lower = b.upTo
  }
  return tax
}

function federalBpa(income: number): number {
  const phaseStart = 181_440 // 29% bracket start
  const phaseEnd = 258_482 // 33% bracket start
  if (income <= phaseStart) return FEDERAL_BPA_MAX
  if (income >= phaseEnd) return FEDERAL_BPA_MIN
  const f = (income - phaseStart) / (phaseEnd - phaseStart)
  return FEDERAL_BPA_MAX - f * (FEDERAL_BPA_MAX - FEDERAL_BPA_MIN)
}

export function federalTax(income: number, province: Province): number {
  const gross = bracketTax(income, FEDERAL_BRACKETS)
  const credit = federalBpa(income) * FEDERAL_BRACKETS[0].rate
  const net = Math.max(0, gross - credit)
  return province === 'QC' ? net * (1 - QC_ABATEMENT) : net
}

export function provincialTax(income: number, province: Province): number {
  const { brackets, bpa } = PROVINCIAL_TAX[province]
  const gross = bracketTax(income, brackets)
  const credit = bpa * brackets[0].rate
  let tax = Math.max(0, gross - credit)
  if (province === 'ON') {
    // Ontario surtax: 20% of ON tax over $5,818 plus 36% of ON tax over $7,446.
    tax += Math.max(0, tax - 5_818) * 0.2 + Math.max(0, tax - 7_446) * 0.36
  }
  return tax
}

export function cppContribution(income: number): number {
  const base = Math.max(0, Math.min(income, YMPE) - CPP_EXEMPTION) * CPP_RATE
  const second = Math.max(0, Math.min(income, YAMPE) - YMPE) * CPP2_RATE
  return base + second
}

export function eiPremium(income: number, province: Province): number {
  const rate = province === 'QC' ? EI_RATE_QC : EI_RATE
  return Math.min(income, EI_MAX_INSURABLE) * rate
}

export function totalIncomeTax(income: number, province: Province): number {
  return federalTax(income, province) + provincialTax(income, province)
}

export function marginalRate(income: number, province: Province): number {
  const delta = 100
  return ((totalIncomeTax(income + delta, province) - totalIncomeTax(income, province)) / delta) * 100
}

export function effectiveRate(income: number, province: Province): number {
  if (income <= 0) return 0
  return (totalIncomeTax(income, province) / income) * 100
}

export interface TakeHome {
  gross: number
  federal: number
  provincial: number
  cpp: number
  ei: number
  net: number
}

export function takeHomePay(gross: number, province: Province): TakeHome {
  const federal = federalTax(gross, province)
  const provincial = provincialTax(gross, province)
  const cpp = cppContribution(gross)
  const ei = eiPremium(gross, province)
  return { gross, federal, provincial, cpp, ei, net: gross - federal - provincial - cpp - ei }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/canadaTax.test.ts`
Expected: ALL PASS. If a hand-computed expectation disagrees with the implementation, re-derive the arithmetic by hand before changing either side (the tables are the authority).

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/canadaTax.ts src/utils/finance/canadaTax.test.ts
git commit -m "feat: 2026 Canada tax module — sourced federal/provincial tables, CPP/CPP2/EI, take-home"
```

---

### Task 2: Take-Home Pay calculator

**Files:**
- Create: `src/components/planner/TakeHomePayCalculator.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `takeHomePay`, `PROVINCES`, `Province` (Task 1); `useToolInputs`/`usePlannerStore`, `CalculatorField`/`ResultCard`/`formatMoney` (4a). Tool id: `'take-home-pay'`.
- Produces: `TakeHomePayCalculator: React.FC` registered as tool `take-home-pay`.

- [x] **Step 1: Implement the component**

Create `src/components/planner/TakeHomePayCalculator.tsx`:

```tsx
import React from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { PROVINCES, takeHomePay, type Province } from '../../utils/finance/canadaTax'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'take-home-pay'
const DEFAULTS = { gross: 100000, province: 'ON' as string }

export const TakeHomePayCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const province = inputs.province as Province
  const t = takeHomePay(inputs.gross, province)

  const deductions = [
    { label: 'Federal tax', value: t.federal },
    { label: 'Provincial tax', value: t.provincial },
    { label: 'CPP (incl. CPP2)', value: t.cpp },
    { label: 'EI', value: t.ei },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CalculatorField label="Gross annual salary" prefix="$" step={1000} value={inputs.gross} onChange={(v) => setInput(TOOL_ID, 'gross', v)} />
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Province</span>
          <select
            className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
            value={province}
            onChange={(e) => setInput(TOOL_ID, 'province', e.target.value)}
          >
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Net annual" value={formatMoney(t.net)} highlight />
        <ResultCard label="Net monthly" value={formatMoney(t.net / 12)} />
        <ResultCard label="Net biweekly" value={formatMoney(t.net / 26)} />
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-wide text-text-secondary">Deductions</p>
        {deductions.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-[13px] text-text-secondary w-40 shrink-0">{d.label}</span>
            <div className="flex-1 h-2 rounded bg-bg-primary/50 overflow-hidden">
              <div className="h-full bg-accent/70" style={{ width: `${t.gross > 0 ? (d.value / t.gross) * 100 : 0}%` }} />
            </div>
            <span className="text-[13px] text-text-primary w-24 text-right">{formatMoney(d.value)}</span>
          </div>
        ))}
        <p className="text-[12px] text-text-secondary mt-2">
          2026 rates, employee side, basic personal amount only — an estimate, not payroll advice.
        </p>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Register the tool**

In `src/components/planner/toolRegistry.tsx`, extend the lucide import with `Landmark` and append after the existing entries:

```tsx
import { TakeHomePayCalculator } from './TakeHomePayCalculator'
```

```tsx
  {
    id: 'take-home-pay',
    name: 'Take-Home Pay',
    description: 'Gross to net for any province — 2026 federal/provincial tax, CPP and EI.',
    icon: Landmark,
    component: TakeHomePayCalculator,
  },
```

- [x] **Step 3: Verify**

Run: `npx vitest run src/pages/Planner.test.tsx` (registry-driven hub test covers the new tile)
Expected: PASS. Then `npm run dev`, open `#/planner/take-home-pay`, check $100k ON shows net ≈ $73,460 and edits persist across reload.

- [x] **Step 4: Commit**

```bash
git add src/components/planner/TakeHomePayCalculator.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: take-home pay calculator (2026, all provinces)"
```

---

### Task 3: Income Tax Estimator (marginal + effective + bracket bars)

**Files:**
- Create: `src/components/planner/IncomeTaxEstimator.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `totalIncomeTax`, `marginalRate`, `effectiveRate`, `FEDERAL_BRACKETS`, `PROVINCIAL_TAX`, `PROVINCES`, `Province`, `Bracket` (Task 1); 4a primitives + store. Tool id: `'income-tax'`.
- Produces: `IncomeTaxEstimator: React.FC` registered as tool `income-tax`.

- [x] **Step 1: Implement the component**

Create `src/components/planner/IncomeTaxEstimator.tsx`:

```tsx
import React from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import {
  effectiveRate,
  FEDERAL_BRACKETS,
  marginalRate,
  PROVINCES,
  PROVINCIAL_TAX,
  totalIncomeTax,
  type Bracket,
  type Province,
} from '../../utils/finance/canadaTax'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'income-tax'
const DEFAULTS = { income: 100000, province: 'ON' as string }

/** Horizontal stacked bar: one segment per bracket, filled up to `income`. */
const BracketBar: React.FC<{ title: string; brackets: Bracket[]; income: number }> = ({ title, brackets, income }) => {
  const cap = Math.max(income * 1.25, 1) // view window slightly past current income
  let lower = 0
  const segments = brackets
    .map((b) => {
      const start = lower
      const end = Math.min(b.upTo, cap)
      lower = b.upTo
      return { start, end, rate: b.rate }
    })
    .filter((s) => s.end > s.start)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] uppercase tracking-wide text-text-secondary">{title}</span>
      <div className="flex h-6 w-full rounded overflow-hidden border border-border">
        {segments.map((s) => {
          const width = ((s.end - s.start) / cap) * 100
          const filledTo = Math.min(Math.max(income - s.start, 0), s.end - s.start)
          const filledPct = ((s.end - s.start) > 0 ? filledTo / (s.end - s.start) : 0) * 100
          return (
            <div key={s.start} className="relative bg-bg-primary/40 border-r border-border last:border-r-0" style={{ width: `${width}%` }} title={`${(s.rate * 100).toFixed(2)}% from ${formatMoney(s.start)}`}>
              <div className="absolute inset-y-0 left-0 bg-accent/60" style={{ width: `${filledPct}%` }} />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-text-primary">
                {(s.rate * 100).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const IncomeTaxEstimator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const province = inputs.province as Province
  const income = inputs.income

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CalculatorField label="Taxable income" prefix="$" step={1000} value={income} onChange={(v) => setInput(TOOL_ID, 'income', v)} />
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Province</span>
          <select
            className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
            value={province}
            onChange={(e) => setInput(TOOL_ID, 'province', e.target.value)}
          >
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Total income tax" value={formatMoney(totalIncomeTax(income, province))} highlight />
        <ResultCard label="Marginal rate" value={`${marginalRate(income, province).toFixed(2)}%`} />
        <ResultCard label="Effective rate" value={`${effectiveRate(income, province).toFixed(2)}%`} />
      </div>

      <div className="themed-card rounded-lg p-4 flex flex-col gap-4">
        <BracketBar title="Federal brackets" brackets={FEDERAL_BRACKETS} income={income} />
        <BracketBar title={`${PROVINCIAL_TAX[province].name} brackets`} brackets={PROVINCIAL_TAX[province].brackets} income={income} />
        <p className="text-[12px] text-text-secondary">
          Filled portion = income inside each bracket. Marginal rate shown includes the Ontario surtax where it applies.
        </p>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Register the tool**

In `toolRegistry.tsx`, add `Percent` to the lucide import and append:

```tsx
import { IncomeTaxEstimator } from './IncomeTaxEstimator'
```

```tsx
  {
    id: 'income-tax',
    name: 'Income Tax Estimator',
    description: 'Marginal and effective 2026 tax rates by province, with bracket visualization.',
    icon: Percent,
    component: IncomeTaxEstimator,
  },
```

- [x] **Step 3: Verify**

Run: `npx vitest run src/pages/Planner.test.tsx`
Expected: PASS. In dev: `#/planner/income-tax`, $100k ON shows marginal 31.48%, bars fill proportionally, province switch updates the lower bar.

- [x] **Step 4: Commit**

```bash
git add src/components/planner/IncomeTaxEstimator.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: income tax estimator with bracket visualization"
```

---

### Task 4: RRSP-vs-TFSA optimizer

**Files:**
- Create: `src/utils/finance/rrspVsTfsa.ts`
- Create: `src/utils/finance/rrspVsTfsa.test.ts`
- Create: `src/components/planner/RrspVsTfsaCalculator.tsx`
- Modify: `src/components/planner/toolRegistry.tsx` (append entry)

**Interfaces:**
- Consumes: `marginalRate`, `PROVINCES`, `Province` (Task 1); `futureValue` from `src/utils/finance/compound.ts` (4a); 4a primitives + store. Tool id: `'rrsp-vs-tfsa'`.
- Produces: `compareRrspTfsa(amount, marginalNowPct, marginalRetirePct, annualReturnPct, years): { rrspNet: number; tfsaNet: number; recommendation: 'RRSP' | 'TFSA' | 'Either' }`.

The model (document in the module comment): a pre-tax dollar amount is available. RRSP: invest the full pre-tax amount (contribution is deductible), pay `marginalRetirePct` on withdrawal. TFSA: pay `marginalNowPct` first, invest the remainder, withdraw tax-free. With equal rates the two are identical — that's the classic result and the key test.

- [x] **Step 1: Write the failing tests**

Create `src/utils/finance/rrspVsTfsa.test.ts`:

```ts
import { compareRrspTfsa } from './rrspVsTfsa'

describe('compareRrspTfsa', () => {
  it('is a wash when marginal rates are equal', () => {
    const r = compareRrspTfsa(10_000, 30, 30, 6, 25)
    expect(r.rrspNet).toBeCloseTo(r.tfsaNet, 6)
    expect(r.recommendation).toBe('Either')
  })

  it('favours RRSP when the retirement rate is lower', () => {
    const r = compareRrspTfsa(10_000, 40, 25, 6, 25)
    expect(r.rrspNet).toBeGreaterThan(r.tfsaNet)
    expect(r.recommendation).toBe('RRSP')
  })

  it('favours TFSA when the retirement rate is higher', () => {
    const r = compareRrspTfsa(10_000, 25, 40, 6, 25)
    expect(r.recommendation).toBe('TFSA')
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/finance/rrspVsTfsa.test.ts`
Expected: FAIL — cannot resolve `./rrspVsTfsa`.

- [x] **Step 3: Implement module and component**

Create `src/utils/finance/rrspVsTfsa.ts`:

```ts
// RRSP vs TFSA for one pre-tax dollar amount. RRSP contributions are
// deductible (invest the full amount, taxed at withdrawal); TFSA is funded
// with after-tax dollars and withdrawn tax-free. Growth uses ./compound.ts
// monthly compounding with no ongoing contributions.

import { futureValue } from './compound'

export interface RrspTfsaComparison {
  rrspNet: number
  tfsaNet: number
  recommendation: 'RRSP' | 'TFSA' | 'Either'
}

export function compareRrspTfsa(
  preTaxAmount: number,
  marginalNowPct: number,
  marginalRetirePct: number,
  annualReturnPct: number,
  years: number,
): RrspTfsaComparison {
  const months = Math.round(years * 12)
  const rrspNet = futureValue(preTaxAmount, annualReturnPct, months) * (1 - marginalRetirePct / 100)
  const tfsaNet = futureValue(preTaxAmount * (1 - marginalNowPct / 100), annualReturnPct, months)
  const diff = rrspNet - tfsaNet
  const tolerance = Math.max(1, tfsaNet * 0.001)
  const recommendation = Math.abs(diff) <= tolerance ? 'Either' : diff > 0 ? 'RRSP' : 'TFSA'
  return { rrspNet, tfsaNet, recommendation }
}
```

Create `src/components/planner/RrspVsTfsaCalculator.tsx`:

```tsx
import React from 'react'
import { usePlannerStore, useToolInputs } from '../../store/usePlannerStore'
import { marginalRate, PROVINCES, type Province } from '../../utils/finance/canadaTax'
import { compareRrspTfsa } from '../../utils/finance/rrspVsTfsa'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'

const TOOL_ID = 'rrsp-vs-tfsa'
const DEFAULTS = {
  amount: 10000,
  income: 100000,
  province: 'ON' as string,
  retireIncome: 55000,
  annualReturnPct: 6,
  years: 25,
}

export const RrspVsTfsaCalculator: React.FC = () => {
  const inputs = useToolInputs(TOOL_ID, DEFAULTS)
  const setInput = usePlannerStore((s) => s.setInput)
  const set = (field: string) => (v: number) => setInput(TOOL_ID, field, v)
  const province = inputs.province as Province

  const nowRate = marginalRate(inputs.income, province)
  const retireRate = marginalRate(inputs.retireIncome, province)
  const r = compareRrspTfsa(inputs.amount, nowRate, retireRate, inputs.annualReturnPct, inputs.years)

  const verdict =
    r.recommendation === 'Either'
      ? 'At equal marginal rates RRSP and TFSA are equivalent — pick by flexibility.'
      : r.recommendation === 'RRSP'
        ? 'Your marginal rate today is higher than in retirement — the RRSP deduction wins.'
        : 'You expect a higher rate in retirement — pay the tax now and grow tax-free in the TFSA.'

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <CalculatorField label="Amount to invest (pre-tax)" prefix="$" step={500} value={inputs.amount} onChange={set('amount')} />
        <CalculatorField label="Current income" prefix="$" step={1000} value={inputs.income} onChange={set('income')} />
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Province</span>
          <select
            className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
            value={province}
            onChange={(e) => setInput(TOOL_ID, 'province', e.target.value)}
          >
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </label>
        <CalculatorField label="Expected retirement income" prefix="$" step={1000} value={inputs.retireIncome} onChange={set('retireIncome')} />
        <CalculatorField label="Annual return" suffix="%" step={0.1} value={inputs.annualReturnPct} onChange={set('annualReturnPct')} />
        <CalculatorField label="Years invested" min={1} max={60} value={inputs.years} onChange={set('years')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label="Recommendation" value={r.recommendation} highlight />
        <ResultCard label={`RRSP after tax (${retireRate.toFixed(1)}% at withdrawal)`} value={formatMoney(r.rrspNet)} />
        <ResultCard label={`TFSA after tax (${nowRate.toFixed(1)}% today)`} value={formatMoney(r.tfsaNet)} />
      </div>

      <p className="text-[13px] text-text-secondary">{verdict} Marginal rates come from the 2026 tax tables for your province.</p>
    </div>
  )
}
```

In `toolRegistry.tsx`, add `Scale` to the lucide import and append:

```tsx
import { RrspVsTfsaCalculator } from './RrspVsTfsaCalculator'
```

```tsx
  {
    id: 'rrsp-vs-tfsa',
    name: 'RRSP vs TFSA',
    description: 'Which account wins for your marginal rate now vs in retirement.',
    icon: Scale,
    component: RrspVsTfsaCalculator,
  },
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/finance/rrspVsTfsa.test.ts src/pages/Planner.test.tsx`
Expected: ALL PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/finance/rrspVsTfsa.ts src/utils/finance/rrspVsTfsa.test.ts src/components/planner/RrspVsTfsaCalculator.tsx src/components/planner/toolRegistry.tsx
git commit -m "feat: RRSP-vs-TFSA optimizer driven by 2026 marginal rates"
```

---

### Task 5: Sub-phase 4d gate — verification, mobile + 5 themes, PROGRESS.md

**Files:**
- Modify: `docs/superpowers/plans/PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-07-02-phase-4d-canada-tax.md` (check off boxes)

- [x] **Step 1: Full automated gate**

```bash
npx vitest run
npm run lint
npm run build
```

Expected: all pass; lint clean on changed files (287 pre-existing v1.0 errors excluded per PROGRESS.md note).

- [x] **Step 2: Manual acceptance — mobile + all 5 themes**

`npm run dev`, then:
1. Hub shows the three new tiles; each opens, back link works.
2. Take-home: $100k ON → net ≈ $73,460; province switch to QC changes federal (abatement), EI rate and provincial tax; reload restores inputs.
3. Income tax: bracket bars fill to income; ON at $100k marginal = 31.48%.
4. RRSP-vs-TFSA: equal incomes → "Either"; raising current income flips to RRSP.
5. Cycle all 5 themes on each calculator — bars and selects readable everywhere.
6. 375px viewport: field grids wrap, bracket bars don't overflow, no horizontal scroll.

- [x] **Step 3: Update PROGRESS.md and commit**

Mark 4d complete in PROGRESS.md (log line + next task pointer), check off this plan's boxes.

```bash
git add docs/superpowers/plans/PROGRESS.md docs/superpowers/plans/2026-07-02-phase-4d-canada-tax.md
git commit -m "chore: complete Phase 4d — Canada tax calculators verified"
```
