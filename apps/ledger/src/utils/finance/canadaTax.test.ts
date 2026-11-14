import {
  annualSalaryTax,
  cppContribution,
  employeeContributions,
  effectiveRate,
  eiPremium,
  federalTax,
  isTaxYearStale,
  marginalRate,
  marginalRateBreakdown,
  marginalSlices,
  salaryMarginalRate,
  provincialTax,
  provincialBpa,
  provincialTaxParts,
  takeHomePay,
  takeHomeWithDeductions,
  taxWithShelter,
  TAX_YEAR,
  totalIncomeTax,
} from './canadaTax'

describe('annual employee income tax', () => {
  it('deducts additional CPP and credits base CPP, EI, and employment', () => {
    const t = annualSalaryTax(100_000, 'ON')
    expect(t.taxableIncome).toBe(98_873)
    expect(t.federal).toBeCloseTo(13_301.5972, 4)
  })

  it('credits base QPP, EI, and QPIP before Quebec federal abatement', () => {
    const t = annualSalaryTax(100_000, 'QC')
    expect(t.federal).toBeCloseTo(11_054.05565, 4)
  })

  it('keeps pension and insurance contributions on gross when RRSP is entered', () => {
    const t = annualSalaryTax(100_000, 'ON', 10_000)
    expect(t.taxableIncome).toBe(88_873)
    expect(t.pension).toBeCloseTo(4_646.45, 2)
    expect(t.ei).toBeCloseTo(1_123.07, 2)
  })
})

describe('2026 annual PEI and NL parameters', () => {
  it('uses the PEI fourth ceiling and 20% top rate', () => {
    const t = annualSalaryTax(250_000, 'PE')
    expect(t.taxableIncome).toBe(248_873)
    expect(t.provincial).toBeCloseTo(39_444.399, 2)
    expect(annualSalaryTax(143_648, 'PE').provincial - annualSalaryTax(143_647, 'PE').provincial).toBeCloseTo(0.19, 6)
    expect(annualSalaryTax(201_128, 'PE').provincial - annualSalaryTax(201_127, 'PE').provincial).toBeCloseTo(0.20, 6)
  })

  it('uses the $13,094 NL annual BPA', () => {
    const t = annualSalaryTax(100_000, 'NL')
    expect(t.taxableIncome).toBe(98_873)
    expect(t.provincial).toBeCloseTo(10_325.93076, 2)
  })
})

describe('2026 Manitoba and Yukon basic personal amounts', () => {
  it('phases the Manitoba amount from $15,780 to zero', () => {
    expect(provincialBpa('MB', 200_000)).toBe(15_780)
    expect(provincialBpa('MB', 300_000)).toBe(7_890)
    expect(provincialBpa('MB', 400_000)).toBe(0)
    expect(provincialBpa('MB', 450_000)).toBe(0)
    expect(annualSalaryTax(300_000, 'MB').provincialBase).toBeCloseTo(45_074.2864476, 2)
  })

  it('mirrors the federal phaseout for Yukon', () => {
    expect(provincialBpa('YT', 181_440)).toBe(16_452)
    expect(provincialBpa('YT', 219_961)).toBeCloseTo(15_640.5, 6)
    expect(provincialBpa('YT', 258_482)).toBe(14_829)
    expect(annualSalaryTax(220_000, 'YT').provincialBase).toBeCloseTo(19_427.2868223, 2)
  })

  it('splits Manitoba RRSP savings at the BPA phaseout boundaries', () => {
    const gross = 405_000
    const slices = marginalSlices(gross, 'MB')
    expect(slices[0].from).toBeCloseTo(400_000, 6)
    expect(slices.some((slice) => Math.abs(slice.from - 200_000) < 1e-6)).toBe(true)
    const current = annualSalaryTax(gross, 'MB')
    const afterDollar = annualSalaryTax(gross, 'MB', 1)
    const nextDollarRate = current.federal + current.provincial - afterDollar.federal - afterDollar.provincial
    expect(slices[0].rate).toBeCloseTo(nextDollarRate * 100, 2)
    const fullShelter = annualSalaryTax(gross, 'MB', current.taxableIncome)
    expect(slices.reduce((sum, slice) => sum + slice.taxSaved, 0)).toBeCloseTo(
      current.federal + current.provincial - fullShelter.federal - fullShelter.provincial, 2)
  })
})

describe('2026 provincial salary adjustments', () => {
  it('includes the $750 Ontario premium at $100k salary', () => {
    const t = annualSalaryTax(100_000, 'ON')
    expect(t.provincialBase).toBeCloseTo(5_946.95674, 4)
    expect(t.surtax).toBeCloseTo(25.791348, 4)
    expect(t.provincial).toBeCloseTo(6_722.748088, 4)
    expect(t.net).toBeCloseTo(74_206.134712, 4)
  })

  it('keeps Ontario Health Premium separate from the low-income tax reduction', () => {
    const t = annualSalaryTax(30_000, 'ON')
    expect(t.provincial).toBeGreaterThanOrEqual(0)
    expect(t.provincialAdjustments).toBeGreaterThan(0)
  })

  it('uses the annual BC reduction and never makes provincial tax negative', () => {
    expect(annualSalaryTax(25_000, 'BC').provincial).toBe(0)
    expect(annualSalaryTax(30_000, 'BC').provincial).toBeCloseTo(282.496, 3)
  })

  it.each([
    [20_000, 0], [20_001, 0.06], [36_000, 300], [36_001, 300.06],
    [48_000, 450], [48_001, 450.25], [72_000, 600], [72_001, 600.25],
    [200_000, 750], [200_001, 750.25],
  ])('applies the Ontario premium at taxable income $%i', (taxable, premium) => {
    const t = annualSalaryTax(250_000, 'ON', 250_000 - 1_127 - taxable)
    expect(t.provincialTaxableIncome).toBe(taxable)
    const basicTax = t.provincialBase + t.surtax
    const reduction = Math.max(0, Math.min(basicTax, 600 - basicTax))
    expect(t.provincial).toBeCloseTo(basicTax - reduction + premium, 6)
  })

  it.each([25_570, 25_571, 44_951, 44_952, 44_953])(
    'applies the annual BC reduction at taxable income $%i', (taxable) => {
      const t = annualSalaryTax(100_000, 'BC', 100_000 - 1_127 - taxable)
      expect(t.provincialTaxableIncome).toBe(taxable)
      const reduction = Math.min(t.provincialBase, Math.max(0, 690 - Math.max(0, taxable - 25_570) * 0.0356))
      expect(t.provincial).toBeCloseTo(t.provincialBase - reduction, 6)
    },
  )

  it('ends the BC basic reduction immediately above $44,952 taxable income', () => {
    const taxable = 44_952.01
    const t = annualSalaryTax(100_000, 'BC', 100_000 - 1_127 - taxable)
    expect(t.provincialTaxableIncome).toBeCloseTo(taxable, 6)
    expect(t.provincialAdjustments).toBe(0)
    expect(t.provincial).toBe(t.provincialBase)
  })

  it('deducts the Quebec worker amount from provincial taxable income', () => {
    const t = annualSalaryTax(100_000, 'QC')
    expect(t.provincialTaxableIncome).toBe(97_423)
    expect(t.provincialBase).toBeCloseTo(13_139.84, 2)
  })

  it('applies the Yukon provincial employment credit at $100k salary', () => {
    // Tax: 58,523 × 6.4% + (98,873 − 58,523) × 9% = 7,376.972.
    // Credit: (16,452 BPA + 3,519.45 CPP base + 1,123.07 EI + 1,501 employment) × 6.4%.
    expect(annualSalaryTax(100_000, 'YT').provincial).toBeCloseTo(5_930.85872, 4)
  })
})

describe('federalTax', () => {
  it('is zero at or below the BPA', () => {
    expect(federalTax(16452, 'ON')).toBe(0)
    expect(federalTax(10000, 'ON')).toBe(0)
  })

  it('taxes $100k in ON correctly', () => {
    // $98,873 taxable after additional CPP; federal BPA, base CPP, EI, and employment credits.
    expect(federalTax(100_000, 'ON')).toBeCloseTo(13_301.5972, 4)
  })

  it('applies the 16.5% Quebec abatement', () => {
    expect(federalTax(100_000, 'QC')).toBeCloseTo(11_054.05565, 4)
  })
})

describe('provincialTax', () => {
  it('taxes $100k in ON correctly including surtax', () => {
    // Base $5,946.95674 + surtax $25.791348 + Ontario premium $750.
    expect(provincialTax(100_000, 'ON')).toBeCloseTo(6_722.748088, 4)
  })

  it('taxes $100k in AB correctly', () => {
    // $98,873 taxable with employee contribution credits and the supplemental credit.
    expect(provincialTax(100_000, 'AB')).toBeCloseTo(6_470.3784, 4)
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

describe('2026 annual employee contributions', () => {
  it('uses CPP outside Quebec', () => {
    const c = employeeContributions(100_000, 'ON')
    expect(c.plan).toBe('CPP')
    expect(c.pensionBase).toBeCloseTo(3_519.45, 2)
    expect(c.pensionAdditional).toBeCloseTo(1_127, 2)
    expect(c.pension).toBeCloseTo(4_646.45, 2)
    expect(c.ei).toBeCloseTo(1_123.07, 2)
    expect(c.qpip).toBe(0)
  })

  it('uses QPP and QPIP in Quebec', () => {
    const c = employeeContributions(100_000, 'QC')
    expect(c.plan).toBe('QPP')
    expect(c.pensionBase).toBeCloseTo(3_768.30, 2)
    expect(c.pensionAdditional).toBeCloseTo(1_127, 2)
    expect(c.pension).toBeCloseTo(4_895.30, 2)
    expect(c.ei).toBeCloseTo(895.70, 2)
    expect(c.qpip).toBeCloseTo(430, 2)
  })

  it('caps QPIP and returns zeros for nonpositive pay', () => {
    expect(employeeContributions(150_000, 'QC').qpip).toBeCloseTo(442.90, 2)
    expect(employeeContributions(0, 'QC').pension).toBe(0)
  })
})

describe('rates and take-home', () => {
  it('uses one annual model for total tax, take-home, and tax savings', () => {
    const full = annualSalaryTax(100_000, 'ON', 10_000, 8_000)
    const none = annualSalaryTax(100_000, 'ON')
    const shown = takeHomeWithDeductions(100_000, 'ON', 10_000, 8_000)
    expect(totalIncomeTax(100_000, 'ON')).toBeCloseTo(none.federal + none.provincial, 8)
    expect(shown.federal + shown.provincial).toBeCloseTo(full.federal + full.provincial, 8)
    expect(shown.taxSavings).toBeCloseTo(
      none.federal + none.provincial - full.federal - full.provincial, 8)
    expect(shown.net).toBeCloseTo(full.net, 8)
    expect(shown.gross - shown.net).toBeCloseTo(
      shown.federal + shown.provincial + shown.pension + shown.ei + shown.qpip, 8)
  })

  it('measures the salary marginal rate with contributions fixed', () => {
    const at = annualSalaryTax(100_000, 'ON', 10_000, 8_000)
    const next = annualSalaryTax(100_100, 'ON', 10_000, 8_000)
    expect(salaryMarginalRate(100_000, 'ON', 10_000, 8_000)).toBeCloseTo(
      next.federal + next.provincial - at.federal - at.provincial, 8)
  })

  it('decomposes the contribution-aware marginal rate including signed provincial adjustments', () => {
    const at = annualSalaryTax(72_100, 'ON', 0, 0)
    const next = annualSalaryTax(72_200, 'ON', 0, 0)
    const b = marginalRateBreakdown(72_100, 'ON')
    expect(b.adjustments).toBeCloseTo(next.provincialAdjustments - at.provincialAdjustments, 8)
    expect(b.federal + b.provincialBase + b.surtax + b.adjustments).toBeCloseTo(b.total, 8)
    expect(b.total).toBeCloseTo(salaryMarginalRate(72_100, 'ON'), 8)
  })

  it('marginal rate at $100k ON is fed 20.5 + ON 9.15×1.20 surtax = 31.48', () => {
    expect(marginalRate(100_000, 'ON')).toBeCloseTo(31.48, 1)
  })

  it('effective rate is total tax over income', () => {
    expect(effectiveRate(100_000, 'ON')).toBeCloseTo(((13_301.5972 + 6_722.748088) / 100_000) * 100, 6)
  })

  it('take-home for $100k ON nets all components', () => {
    const t = takeHomePay(100_000, 'ON')
    expect(t.federal).toBeCloseTo(13_301.5972, 4)
    expect(t.provincial).toBeCloseTo(6_722.748088, 4)
    expect(t.pension).toBeCloseTo(4_646.45, 2)
    expect(t.ei).toBeCloseTo(1_123.07, 2)
    expect(t.net).toBeCloseTo(74_206.134712, 4)
  })
})

describe('marginalRateBreakdown', () => {
  it('components sum to the headline marginal rate (ON, $200k)', () => {
    const b = marginalRateBreakdown(200_000, 'ON')
    expect(b.total).toBeCloseTo(marginalRate(200_000, 'ON'), 6)
    expect(b.federal + b.provincialBase + b.surtax + b.adjustments).toBeCloseTo(b.total, 10)
  })

  it('shows a positive surtax component once ON tax exceeds both thresholds ($200k)', () => {
    const b = marginalRateBreakdown(200_000, 'ON')
    // marginal surtax = 56% of the 12.16% ON bracket rate ≈ 6.81
    expect(b.surtax).toBeGreaterThan(6)
    expect(b.surtax).toBeLessThan(7.5)
  })

  it('has no surtax component at low ON income ($60k)', () => {
    expect(marginalRateBreakdown(60_000, 'ON').surtax).toBe(0)
  })

  it('has no surtax component outside Ontario (BC, $200k)', () => {
    expect(marginalRateBreakdown(200_000, 'BC').surtax).toBe(0)
  })

  it('provincialTaxParts sums to provincialTax', () => {
    for (const income of [40_000, 90_000, 150_000, 250_000]) {
      const parts = provincialTaxParts(income, 'ON')
      expect(parts.base + parts.surtax + parts.adjustments).toBeCloseTo(provincialTax(income, 'ON'), 8)
    }
  })
})

describe('takeHomeWithDeductions', () => {
  it('zero contributions matches takeHomePay', () => {
    const base = takeHomePay(100000, 'ON')
    const d = takeHomeWithDeductions(100000, 'ON', 0, 0)
    expect(d.net).toBeCloseTo(base.net, 6)
    expect(d.taxSavings).toBe(0)
    expect(d.taxableIncome).toBe(98_873)
  })

  it('contributions reduce taxable income and produce positive savings', () => {
    const d = takeHomeWithDeductions(100000, 'ON', 10000, 8000)
    expect(d.taxableIncome).toBe(80_873)
    expect(d.taxSavings).toBeGreaterThan(0)
    expect(d.taxSavings).toBeCloseTo(
      totalIncomeTax(100000, 'ON') - taxWithShelter(100000, 'ON', 18000), 6)
  })

  it('pension and EI are unaffected by deductions', () => {
    const base = takeHomePay(100000, 'ON')
    const d = takeHomeWithDeductions(100000, 'ON', 20000, 0)
    expect(d.pension).toBeCloseTo(base.pension, 6)
    expect(d.ei).toBeCloseTo(base.ei, 6)
  })

  it('contributions above gross clamp taxable income at zero', () => {
    const d = takeHomeWithDeductions(30000, 'ON', 40000, 8000)
    expect(d.taxableIncome).toBe(0)
  })
})

describe('marginalSlices', () => {
  it('holds gross fixed and reconciles savings as RRSP shelter increases', () => {
    const gross = 193_000
    const rrsp = 20_000
    const fhsa = 8_000
    const at = annualSalaryTax(gross, 'ON', rrsp, fhsa)
    const slices = marginalSlices(gross, 'ON', rrsp, fhsa)
    const saved = slices.reduce((sum, s) => sum + s.taxSaved, 0)
    const allSheltered = taxWithShelter(gross, 'ON', rrsp + at.taxableIncome + fhsa)
    expect(saved).toBeCloseTo(at.federal + at.provincial - allSheltered, 6)
    expect(slices[0].to).toBeCloseTo(at.taxableIncome, 6)
  })

  it('returns nothing for zero or negative income', () => {
    expect(marginalSlices(0, 'ON')).toEqual([])
    expect(marginalSlices(-5000, 'ON')).toEqual([])
  })

  it('covers the whole income with no gaps, highest slice first', () => {
    const slices = marginalSlices(193_000, 'ON')
    expect(slices.length).toBeGreaterThan(1)
    expect(slices[0].to).toBe(annualSalaryTax(193_000, 'ON').taxableIncome)
    expect(slices[slices.length - 1].from).toBe(0)
    for (let i = 0; i < slices.length - 1; i++) {
      expect(slices[i].from).toBe(slices[i + 1].to)
    }
    const covered = slices.reduce((sum, s) => sum + s.amount, 0)
    expect(covered).toBeCloseTo(annualSalaryTax(193_000, 'ON').taxableIncome, 6)
  })

  it('slice savings add up to the total income tax', () => {
    const slices = marginalSlices(193_000, 'ON')
    const saved = slices.reduce((sum, s) => sum + s.taxSaved, 0)
    expect(saved).toBeCloseTo(totalIncomeTax(193_000, 'ON'), 6)
  })

  it('each slice has finite savings and a rate derived from those savings', () => {
    const slices = marginalSlices(193_000, 'ON')
    for (const slice of slices) {
      expect(Number.isFinite(slice.rate)).toBe(true)
      expect(slice.rate).toBeCloseTo(slice.taxSaved / slice.amount * 100, 8)
    }
  })

  it('puts the top slice on the federal bracket edge and matches the marginal rate', () => {
    const slices = marginalSlices(193_000, 'ON')
    expect(slices[0].from).toBe(181_440)
    expect(slices[0].amount).toBeCloseTo(10_433, 6)
    expect(slices[0].rate).toBeCloseTo(marginalRate(193_000, 'ON'), 1)
  })

  it('splits on the Ontario surtax thresholds, not only on brackets', () => {
    const slices = marginalSlices(193_000, 'ON')
    const bracketEdges = new Set([53_891, 107_785, 150_000, 58_523, 117_045, 181_440, 0])
    const surtaxCuts = slices.map((s) => s.from).filter((f) => !bracketEdges.has(f))
    expect(surtaxCuts.length).toBeGreaterThanOrEqual(2)
  })

  it('merges neighbouring bands that share a rate into one slice', () => {
    // AB has a single 10% band spanning both the 61,200 and 154,259 edges only
    // once you are above them, so a mid-band income yields fewer slices than cuts.
    const slices = marginalSlices(120_000, 'AB')
    const rates = slices.map((s) => Math.round(s.rate * 100))
    expect(new Set(rates).size).toBe(rates.length)
  })

  it('handles a province with no surtax', () => {
    const slices = marginalSlices(90_000, 'BC')
    const saved = slices.reduce((sum, s) => sum + s.taxSaved, 0)
    expect(saved).toBeCloseTo(totalIncomeTax(90_000, 'BC'), 6)
  })

  it('splits BC low-income reduction crossover so the top rate matches the next RRSP dollar', () => {
    const gross = 30_000
    const current = annualSalaryTax(gross, 'BC')
    const afterOneDollar = annualSalaryTax(gross, 'BC', 1)
    const slices = marginalSlices(gross, 'BC')
    const nextDollarRate = (
      current.federal + current.provincial - afterOneDollar.federal - afterOneDollar.provincial
    ) * 100
    expect(slices[0].to).toBeCloseTo(current.taxableIncome, 8)
    expect(slices[0].rate).toBeCloseTo(nextDollarRate, 4)
    const saved = slices.reduce((sum, slice) => sum + slice.taxSaved, 0)
    const allSheltered = annualSalaryTax(gross, 'BC', current.taxableIncome)
    expect(saved).toBeCloseTo(
      current.federal + current.provincial - allSheltered.federal - allSheltered.provincial, 8)
  })

  it.each([
    ['BC', 20_000],
    ['AB', 25_000],
    ['QC', 20_000],
  ] as const)('splits tax-zero crossings for %s salary of $%i', (province, gross) => {
    const current = annualSalaryTax(gross, province)
    const afterOneDollar = annualSalaryTax(gross, province, 1)
    const slices = marginalSlices(gross, province)
    const nextDollarRate = (
      current.federal + current.provincial - afterOneDollar.federal - afterOneDollar.provincial
    ) * 100
    expect(slices[0].rate).toBeCloseTo(nextDollarRate, 4)
    const saved = slices.reduce((sum, slice) => sum + slice.taxSaved, 0)
    const allSheltered = annualSalaryTax(gross, province, current.taxableIncome)
    expect(saved).toBeCloseTo(
      current.federal + current.provincial - allSheltered.federal - allSheltered.provincial, 8)
  })

  it('returns a single zero-rate slice for income under every credit', () => {
    const slices = marginalSlices(10_000, 'ON')
    expect(slices).toHaveLength(1)
    expect(slices[0].rate).toBe(0)
    expect(slices[0].taxSaved).toBe(0)
  })
})

describe('tax year', () => {
  it('names the year these tables are for', () => {
    expect(TAX_YEAR).toBe(2026)
  })

  it('is not stale during its own year', () => {
    // Local constructors, not a Z-suffixed instant: the tax year is a local
    // calendar year, so a UTC literal would test a different day depending on
    // where the suite runs.
    expect(isTaxYearStale(new Date(2026, 11, 31, 23, 59, 59))).toBe(false)
  })

  it('is stale once the year has turned', () => {
    expect(isTaxYearStale(new Date(2027, 0, 1, 0, 0, 1))).toBe(true)
  })

  it('keeps the staleness trigger and the printed year in agreement', () => {
    // A UTC comparison here once made the banner print "not been updated
    // for 2026" while still showing 2026 rates, because isTaxYearStale used
    // the UTC year but the banner text used the local year. At the last
    // local moment of the tax year, both must agree it is still TAX_YEAR.
    const lastMomentOfTaxYear = new Date(2026, 11, 31, 23, 59, 59)
    expect(isTaxYearStale(lastMomentOfTaxYear)).toBe(false)
    expect(lastMomentOfTaxYear.getFullYear()).toBe(TAX_YEAR)
  })
})
