import type { Position } from '../../store/useAnalysisStore'
import { currentValue } from './analysisMetrics'

export interface PlanRow {
  positionId: string
  ticker: string
  allocationPct: number
  plannedDollars: number
  startPrice: number
  shares: number
  currentPrice: number
  currentValue: number
  returnDollars: number
  returnPct: number | null
}

export function planRow(position: Position, plannedBudget: number, currentPrice: number): PlanRow {
  const allocationPct = position.allocationPct ?? 0
  const plannedDollars = (plannedBudget * allocationPct) / 100
  const shares = position.startPrice > 0 ? plannedDollars / position.startPrice : 0
  const value = shares * currentPrice
  const returnDollars = value - plannedDollars
  return {
    positionId: position.id,
    ticker: position.ticker,
    allocationPct,
    plannedDollars,
    startPrice: position.startPrice,
    shares,
    currentPrice,
    currentValue: value,
    returnDollars,
    returnPct: plannedDollars > 0 ? (returnDollars / plannedDollars) * 100 : null,
  }
}

export interface FundSummary {
  initialInvested: number    // actual: cost of lots on the earliest trade date; plan: plannedBudget
  extraInvested: number      // actual: cost of all later lots; plan: 0
  totalInvested: number      // initialInvested + extraInvested
  currentValue: number
  totalReturnDollars: number // currentValue - totalInvested
  totalReturnPct: number | null
}

export function planFundSummary(rows: PlanRow[], plannedBudget: number): FundSummary {
  const value = rows.reduce((s, r) => s + r.currentValue, 0)
  return {
    initialInvested: plannedBudget,
    extraInvested: 0,
    totalInvested: plannedBudget,
    currentValue: value,
    totalReturnDollars: value - plannedBudget,
    totalReturnPct: plannedBudget > 0 ? ((value - plannedBudget) / plannedBudget) * 100 : null,
  }
}

export function actualFundSummary(positions: Position[], priceFor: (p: Position) => number): FundSummary {
  const allLots = positions.flatMap((p) => p.lots)
  const firstDate = allLots.reduce<string | null>(
    (min, l) => (min === null || l.date < min ? l.date : min),
    null,
  )
  const initialInvested = allLots.filter((l) => l.date === firstDate).reduce((s, l) => s + l.amountInvested, 0)
  const invested = allLots.reduce((s, l) => s + l.amountInvested, 0)
  const value = positions.reduce((s, p) => s + currentValue(p.lots, priceFor(p)), 0)
  return {
    initialInvested,
    extraInvested: invested - initialInvested,
    totalInvested: invested,
    currentValue: value,
    totalReturnDollars: value - invested,
    totalReturnPct: invested > 0 ? ((value - invested) / invested) * 100 : null,
  }
}
