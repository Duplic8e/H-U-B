// Rent-vs-buy on cumulative UNRECOVERABLE costs. Rent side: rent growing
// annually. Buy side: mortgage interest + property tax + maintenance +
// opportunity cost of the down payment. Principal repayment builds equity,
// so it is not a cost. Break-even = first year cumulative buy ≤ rent.

import { amortizationSchedule } from './amortization'

export interface RentVsBuyInputs {
  monthlyRent: number
  rentIncreasePct: number
  price: number
  downPct: number
  ratePct: number
  amortYears: number
  propertyTaxPct: number
  maintenancePct: number
  opportunityPct: number
  horizonYears: number
}

export interface RentVsBuyResult {
  series: { year: number; rentCost: number; buyCost: number }[]
  breakEvenYear: number | null
}

export function rentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResult {
  const down = inputs.price * (inputs.downPct / 100)
  const principal = inputs.price - down
  const schedule = amortizationSchedule(principal, inputs.ratePct, inputs.amortYears)
  const annualOwnFixed =
    inputs.price * (inputs.propertyTaxPct / 100) +
    inputs.price * (inputs.maintenancePct / 100) +
    down * (inputs.opportunityPct / 100)

  const series: RentVsBuyResult['series'] = []
  let rentCum = 0
  let buyCum = 0
  let breakEvenYear: number | null = null
  let annualRent = inputs.monthlyRent * 12

  for (let year = 1; year <= inputs.horizonYears; year++) {
    rentCum += annualRent
    annualRent *= 1 + inputs.rentIncreasePct / 100
    const yearInterest = schedule
      .slice((year - 1) * 12, year * 12)
      .reduce((s, p) => s + p.interestPaid, 0)
    buyCum += yearInterest + annualOwnFixed
    series.push({ year, rentCost: rentCum, buyCost: buyCum })
    if (breakEvenYear === null && buyCum <= rentCum) breakEvenYear = year
  }
  return { series, breakEvenYear }
}
