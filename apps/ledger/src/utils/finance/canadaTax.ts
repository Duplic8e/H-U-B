// 2026 Canadian personal income tax estimator - employee side only.
//
// Sources (retrieved 2026-07-02):
// - Brackets (federal + all provinces/territories, ON surtax): KPMG
//   "Federal and Provincial/Territorial Income Tax Rates and Brackets for 2026"
//   (current as of 2025-12-31). BC lowest rate updated to 5.6% per BC Budget
//   2026 (TaxTips.ca). Federal lowest rate is 14% for 2026.
// - BPAs: TaxTips.ca 2026 non-refundable credits; QC BPA $18,952 from
//   Finances Québec "Parameters of the Personal Income Tax System for 2026".
// - CPP/CPP2/EI 2026: CRA release - YMPE $74,600, YAMPE $85,000, rates
//   5.95%/4.00%; EI 1.63% (QC 1.30%) on max insurable earnings $68,900.
//
// This is an annual employee estimate, not payroll withholding. The new
// annualSalaryTax path includes standard employee credits, QPP/QPIP, and
// provincial salary adjustments. All public tax and take-home helpers use it.

/** The tax year every table in this file is for. Bump it in the same commit
 *  that updates the brackets, BPAs and CPP/EI maxima, never on its own. */
export const TAX_YEAR = 2026

/** True once the calendar has moved past the year these tables describe.
 *  The estimate is still arithmetically correct for TAX_YEAR, it is just no
 *  longer the current year, and the UI has to say so rather than present a
 *  stale number as this year's. Takes `now` so the test is not clock
 *  dependent. Compares by local year, not UTC year: the Canadian tax year
 *  is a local calendar year, so the reader's own clock is what decides
 *  whether it has turned. A UTC comparison would tell someone west of UTC
 *  their rates are stale while it is still the old year where they live,
 *  and it would disagree with the local year the warning text itself
 *  prints below. */
export function isTaxYearStale(now: Date = new Date()): boolean {
  return now.getFullYear() > TAX_YEAR
}

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

// Ontario surtax: 20% of ON tax over the first threshold plus 36% of ON tax
// over the second. Shared by provincialTaxParts (the tax itself) and
// marginalSlices (the slice cuts that measure it), so the two stay in sync.
const ON_SURTAX_THRESHOLDS: [number, number] = [5_818, 7_446]

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
      { upTo: 142_520, rate: 0.1762 },
      { upTo: 200_000, rate: 0.19 },
      { upTo: Infinity, rate: 0.20 },
    ],
  },
  NL: {
    name: 'Newfoundland and Labrador',
    bpa: 13_094,
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
const CPP_EXEMPTION = 3_500
const YMPE = 74_600
const CPP2_RATE = 0.04
const YAMPE = 85_000
const CPP_BASE_RATE = 0.0495
const QPP_BASE_RATE = 0.053
const PENSION_ADDITIONAL_RATE = 0.01
const EI_RATE = 0.0163
const EI_RATE_QC = 0.013
const EI_MAX_INSURABLE = 68_900
const QPIP_RATE = 0.0043
const QPIP_MAX_INSURABLE = 103_000

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

export function provincialBpa(province: Province, netIncome: number): number {
  if (province === 'MB') {
    if (netIncome <= 200_000) return 15_780
    if (netIncome >= 400_000) return 0
    return 15_780 - (netIncome - 200_000) * (15_780 / 200_000)
  }
  if (province === 'YT') return federalBpa(netIncome)
  return PROVINCIAL_TAX[province].bpa
}

export function federalTax(income: number, province: Province): number {
  return annualSalaryTax(income, province).federal
}

/** Provincial annual salary tax split into bracket tax, ON surtax, and signed adjustments. */
export function provincialTaxParts(
  income: number,
  province: Province,
): { base: number; surtax: number; adjustments: number } {
  const t = annualSalaryTax(income, province)
  return { base: t.provincialBase, surtax: t.surtax, adjustments: t.provincialAdjustments }
}

export function provincialTax(income: number, province: Province): number {
  return annualSalaryTax(income, province).provincial
}

export interface EmployeeContributions {
  plan: 'CPP' | 'QPP'
  pensionBase: number
  pensionAdditional: number
  pension: number
  ei: number
  qpip: number
}

export interface AnnualSalaryTax extends EmployeeContributions {
  gross: number
  taxableIncome: number
  provincialTaxableIncome: number
  federal: number
  provincialBase: number
  surtax: number
  provincialAdjustments: number
  provincial: number
  net: number
}

export function employeeContributions(gross: number, province: Province): EmployeeContributions {
  const pay = Math.max(0, gross)
  const firstTier = Math.max(0, Math.min(pay, YMPE) - CPP_EXEMPTION)
  const secondTier = Math.max(0, Math.min(pay, YAMPE) - YMPE)
  const quebec = province === 'QC'
  const pensionBase = firstTier * (quebec ? QPP_BASE_RATE : CPP_BASE_RATE)
  const pensionAdditional = firstTier * PENSION_ADDITIONAL_RATE + secondTier * CPP2_RATE
  const ei = Math.min(pay, EI_MAX_INSURABLE) * (quebec ? EI_RATE_QC : EI_RATE)
  const qpip = quebec ? Math.min(pay, QPIP_MAX_INSURABLE) * QPIP_RATE : 0
  return {
    plan: quebec ? 'QPP' : 'CPP', pensionBase, pensionAdditional,
    pension: pensionBase + pensionAdditional, ei, qpip,
  }
}

const CANADA_EMPLOYMENT_AMOUNT = 1_501

function annualFederalTax(taxable: number, gross: number, province: Province, c: EmployeeContributions): number {
  const employment = Math.min(Math.max(0, gross), CANADA_EMPLOYMENT_AMOUNT)
  const credits = 0.14 * (federalBpa(taxable) + c.pensionBase + c.ei + c.qpip + employment)
  const afterCredits = Math.max(0, bracketTax(taxable, FEDERAL_BRACKETS) - credits)
  return province === 'QC' ? afterCredits * (1 - QC_ABATEMENT) : afterCredits
}

function annualProvincialBase(taxable: number, gross: number, province: Province, c: EmployeeContributions): number {
  const { brackets } = PROVINCIAL_TAX[province]
  const bpa = provincialBpa(province, taxable)
  const baseContributions = province === 'QC' ? 0 : c.pensionBase + c.ei
  const employment = province === 'YT' ? Math.min(Math.max(0, gross), CANADA_EMPLOYMENT_AMOUNT) : 0
  const credit = brackets[0].rate * (bpa + baseContributions + employment)
  return Math.max(0, bracketTax(taxable, brackets) - credit)
}

export function ontarioHealthPremium(taxable: number): number {
  if (taxable <= 20_000) return 0
  if (taxable <= 36_000) return Math.min(300, (taxable - 20_000) * 0.06)
  if (taxable <= 48_000) return Math.min(450, 300 + (taxable - 36_000) * 0.06)
  if (taxable <= 72_000) return Math.min(600, 450 + (taxable - 48_000) * 0.25)
  if (taxable <= 200_000) return Math.min(750, 600 + (taxable - 72_000) * 0.25)
  return Math.min(900, 750 + (taxable - 200_000) * 0.25)
}

function ontarioTaxReduction(basicTax: number): number {
  return Math.max(0, Math.min(basicTax, 600 - basicTax))
}

function bcBasicReduction(taxable: number, base: number): number {
  if (taxable > 44_952) return 0
  return Math.min(base, Math.max(0, 690 - Math.max(0, taxable - 25_570) * 0.0356))
}

function albertaSupplementalCredit(c: EmployeeContributions): number {
  const bpa = PROVINCIAL_TAX.AB.bpa
  return Math.max(0, ((bpa + c.pensionBase + c.ei) * 0.08 - 4_896) * 0.25)
}

function quebecWorkerDeduction(gross: number): number {
  return Math.min(Math.max(0, gross) * 0.06, 1_450)
}

export function annualSalaryTax(
  gross: number, province: Province, rrsp = 0, fhsa = 0,
): AnnualSalaryTax {
  const c = employeeContributions(gross, province)
  const taxableIncome = Math.max(0, gross - Math.max(0, rrsp) - Math.max(0, fhsa) - c.pensionAdditional)
  const provincialTaxableIncome = province === 'QC'
    ? Math.max(0, taxableIncome - quebecWorkerDeduction(gross))
    : taxableIncome
  const federal = annualFederalTax(taxableIncome, gross, province, c)
  const provincialBase = annualProvincialBase(provincialTaxableIncome, gross, province, c)
  const [surtaxLow, surtaxHigh] = ON_SURTAX_THRESHOLDS
  const surtax = province === 'ON'
    ? Math.max(0, provincialBase - surtaxLow) * 0.2 + Math.max(0, provincialBase - surtaxHigh) * 0.36
    : 0
  const basicTax = provincialBase + surtax
  let provincialAdjustments = 0
  if (province === 'ON') {
    provincialAdjustments = ontarioHealthPremium(provincialTaxableIncome) - ontarioTaxReduction(basicTax)
  } else if (province === 'BC') {
    const reduction = bcBasicReduction(provincialTaxableIncome, provincialBase)
    provincialAdjustments = reduction === 0 ? 0 : -reduction
  } else if (province === 'AB') {
    provincialAdjustments = -Math.min(provincialBase, albertaSupplementalCredit(c))
  }
  const provincial = provincialBase + surtax + provincialAdjustments
  return {
    ...c, gross, taxableIncome, provincialTaxableIncome,
    federal, provincialBase, surtax, provincialAdjustments, provincial,
    net: gross - federal - provincial - c.pension - c.ei - c.qpip,
  }
}

export function cppContribution(income: number): number {
  return employeeContributions(income, 'ON').pension
}

export function eiPremium(income: number, province: Province): number {
  return employeeContributions(income, province).ei
}

export function totalIncomeTax(income: number, province: Province): number {
  const t = annualSalaryTax(income, province)
  return t.federal + t.provincial
}

export function salaryMarginalRate(gross: number, province: Province, rrsp = 0, fhsa = 0): number {
  const at = annualSalaryTax(gross, province, rrsp, fhsa)
  const next = annualSalaryTax(gross + 100, province, rrsp, fhsa)
  return next.federal + next.provincial - at.federal - at.provincial
}

export function marginalRate(income: number, province: Province): number {
  return salaryMarginalRate(income, province)
}

export interface MarginalBreakdown {
  federal: number // percentage points, e.g. 29.29
  provincialBase: number
  surtax: number
  adjustments: number // signed percentage points
  total: number // === federal + provincialBase + surtax + adjustments
}

/** Decomposes the same $100 gross salary change used by salaryMarginalRate. */
export function marginalRateBreakdown(
  gross: number, province: Province, rrsp = 0, fhsa = 0,
): MarginalBreakdown {
  const at = annualSalaryTax(gross, province, rrsp, fhsa)
  const next = annualSalaryTax(gross + 100, province, rrsp, fhsa)
  const federal = next.federal - at.federal
  const provincialBase = next.provincialBase - at.provincialBase
  const surtax = next.surtax - at.surtax
  const adjustments = next.provincialAdjustments - at.provincialAdjustments
  return { federal, provincialBase, surtax, adjustments, total: federal + provincialBase + surtax + adjustments }
}

/** Taxable-income point at which provincial bracket tax reaches a threshold. */
function incomeAtProvincialBase(
  target: number, gross: number, province: Province, rrsp: number, fhsa: number, currentTaxable: number,
): number {
  let lo = 0
  let hi = currentTaxable
  const baseAt = (taxable: number) => annualSalaryTax(
    gross, province, rrsp + currentTaxable - taxable, fhsa,
  ).provincialBase
  if (baseAt(hi) < target) return Infinity
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (baseAt(mid) < target) lo = mid
    else hi = mid
  }
  return hi
}

/** BC taxable income where bracket tax first exceeds the basic reduction. */
function incomeAtBcReductionCrossover(
  gross: number, rrsp: number, fhsa: number, currentTaxable: number,
): number {
  let lo = 0
  let hi = Math.min(currentTaxable, 44_952)
  const uncoveredBaseAt = (taxable: number) => {
    const base = annualSalaryTax(gross, 'BC', rrsp + currentTaxable - taxable, fhsa).provincialBase
    const reduction = 690 - Math.max(0, taxable - 25_570) * 0.0356
    return base - reduction
  }
  if (uncoveredBaseAt(hi) <= 0) return Infinity
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (uncoveredBaseAt(mid) <= 0) lo = mid
    else hi = mid
  }
  return hi
}

/** First taxable-income point where one annual tax component becomes positive. */
function incomeAtFirstPositiveTax(currentTaxable: number, taxAt: (taxable: number) => number): number {
  let lo = 0
  let hi = currentTaxable
  if (taxAt(hi) <= 0) return Infinity
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (taxAt(mid) <= 0) lo = mid
    else hi = mid
  }
  return hi
}

export interface MarginalSlice {
  from: number // lower bound of the slice
  to: number // upper bound
  amount: number // to - from
  rate: number // percentage points of combined tax on every dollar in the slice
  taxSaved: number // tax removed by deducting this whole slice
}

/** Income tax at fixed gross salary with a specified RRSP shelter amount. */
export function taxWithShelter(gross: number, province: Province, sheltered: number): number {
  const t = annualSalaryTax(gross, province, sheltered, 0)
  return t.federal + t.provincial
}

/** Split remaining shelterable income while gross salary and payroll contributions stay fixed. */
export function marginalSlices(gross: number, province: Province, rrsp = 0, fhsa = 0): MarginalSlice[] {
  const at = annualSalaryTax(gross, province, rrsp, fhsa)
  const taxableIncome = at.taxableIncome
  if (taxableIncome <= 0) return []
  const annualAt = (taxable: number) => annualSalaryTax(
    gross, province, rrsp + taxableIncome - taxable, fhsa,
  )
  const taxAt = (taxable: number) => {
    const t = annualAt(taxable)
    return t.federal + t.provincial
  }
  const cuts = new Set<number>([0, taxableIncome])
  for (const component of ['federal', 'provincial'] as const) {
    const cut = incomeAtFirstPositiveTax(taxableIncome, (taxable) => annualAt(taxable)[component])
    if (cut > 0 && cut < taxableIncome) cuts.add(cut)
  }
  for (const b of FEDERAL_BRACKETS) if (b.upTo < taxableIncome) cuts.add(b.upTo)
  // Quebec's worker deduction shifts provincial bracket edges relative to federal taxable income.
  const provincialOffset = taxableIncome - at.provincialTaxableIncome
  for (const b of PROVINCIAL_TAX[province].brackets) {
    const cut = b.upTo + provincialOffset
    if (cut > 0 && cut < taxableIncome) cuts.add(cut)
  }
  // These federal BPA phaseout edges also happen to be federal bracket edges.
  for (const cut of [181_440, 258_482]) if (cut < taxableIncome) cuts.add(cut)
  if (province === 'MB') {
    for (const cut of [200_000, 400_000]) {
      if (cut > 0 && cut < taxableIncome) cuts.add(cut)
    }
  }
  if (province === 'ON') {
    // Starts, caps, and restarts of the annual Ontario Health Premium.
    for (const cut of [20_000, 25_000, 36_000, 38_500, 48_000, 48_600, 72_000, 72_600, 200_000, 200_600]) {
      if (cut < taxableIncome) cuts.add(cut)
    }
    for (const threshold of ON_SURTAX_THRESHOLDS) {
      const cut = incomeAtProvincialBase(threshold, gross, province, rrsp, fhsa, taxableIncome)
      if (cut > 0 && cut < taxableIncome) cuts.add(cut)
    }
    // The low-income tax reduction changes slope at $300 and ends at $600 basic tax.
    for (const threshold of [300, 600]) {
      const cut = incomeAtProvincialBase(threshold, gross, province, rrsp, fhsa, taxableIncome)
      if (cut > 0 && cut < taxableIncome) cuts.add(cut)
    }
  }
  if (province === 'BC') {
    for (const cut of [25_570, 44_952]) if (cut < taxableIncome) cuts.add(cut)
    const crossover = incomeAtBcReductionCrossover(gross, rrsp, fhsa, taxableIncome)
    if (crossover > 0 && crossover < taxableIncome) cuts.add(crossover)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const slices: MarginalSlice[] = []
  for (let i = points.length - 1; i > 0; i--) {
    const from = points[i - 1]
    const to = points[i]
    const amount = to - from
    if (amount <= 0) continue
    const taxSaved = taxAt(to) - taxAt(from)
    const rate = (taxSaved / amount) * 100
    const prev = slices[slices.length - 1]
    if (prev && Math.abs(prev.rate - rate) < 0.005) {
      // Same rate as the slice above: widen that one downward instead of
      // showing the reader two rungs with an identical percentage.
      prev.from = from
      prev.amount = prev.to - from
      prev.taxSaved = taxAt(prev.to) - taxAt(from)
      prev.rate = (prev.taxSaved / prev.amount) * 100
      continue
    }
    slices.push({ from, to, amount, rate, taxSaved })
  }
  return slices
}

export function effectiveRate(income: number, province: Province): number {
  if (income <= 0) return 0
  return (totalIncomeTax(income, province) / income) * 100
}

export type TakeHome = AnnualSalaryTax

export function takeHomePay(gross: number, province: Province): TakeHome {
  return annualSalaryTax(gross, province)
}

export interface TakeHomeWithDeductions extends AnnualSalaryTax {
  taxSavings: number
}

/** Take-home with optional deductions and tax savings from the same annual model. */
export function takeHomeWithDeductions(
  gross: number,
  province: Province,
  rrsp: number,
  fhsa: number,
): TakeHomeWithDeductions {
  const current = annualSalaryTax(gross, province, rrsp, fhsa)
  const baseline = annualSalaryTax(gross, province)
  return {
    ...current,
    taxSavings: (baseline.federal - current.federal) + (baseline.provincial - current.provincial),
  }
}
