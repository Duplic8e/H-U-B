import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'

export interface BuyLot {
  id: string
  date: string // YYYY-MM-DD
  amountInvested: number
  price: number
}

export interface Position {
  id: string
  ticker: string
  exchange?: string
  plannedAmount: number
  allocationPct?: number
  extraPlanned?: number
  startPrice: number
  startPriceSource: 'auto' | 'manual'
  acted: boolean
  lots: BuyLot[]
}

export interface SwapScenario {
  id: string
  side: 'plan' | 'actual'
  outPositionId: string
  inTicker: string
  inExchange?: string
  inStartPrice: number
  inStartPriceSource: 'auto' | 'manual'
}

export interface InvestmentAnalysis {
  id: string
  name: string
  thesis?: string
  analysisDate: string // YYYY-MM-DD
  plannedBudget?: number
  positions: Position[]
  swaps: SwapScenario[]
}

interface AnalysisState {
  analyses: InvestmentAnalysis[]
  addAnalysis: (a: InvestmentAnalysis) => void
  updateAnalysis: (id: string, updates: Partial<InvestmentAnalysis>) => void
  removeAnalysis: (id: string) => void
  addPosition: (analysisId: string, position: Position) => void
  removePosition: (analysisId: string, positionId: string) => void
  updatePosition: (analysisId: string, positionId: string, updates: Partial<Position>) => void
  addLot: (analysisId: string, positionId: string, lot: BuyLot) => void
  removeLot: (analysisId: string, positionId: string, lotId: string) => void
  addSwap: (analysisId: string, swap: SwapScenario) => void
  removeSwap: (analysisId: string, swapId: string) => void
  updateSwap: (analysisId: string, swapId: string, updates: Partial<SwapScenario>) => void
}

function mapAnalysis(
  analyses: InvestmentAnalysis[],
  analysisId: string,
  fn: (a: InvestmentAnalysis) => InvestmentAnalysis,
): InvestmentAnalysis[] {
  return analyses.map((a) => (a.id === analysisId ? fn(a) : a))
}

function mapPosition(
  analyses: InvestmentAnalysis[],
  analysisId: string,
  positionId: string,
  fn: (p: Position) => Position,
): InvestmentAnalysis[] {
  return mapAnalysis(analyses, analysisId, (a) => ({
    ...a,
    positions: a.positions.map((p) => (p.id === positionId ? fn(p) : p)),
  }))
}

/** Shape persisted before positions existed (store version 0). */
interface LegacyAnalysis {
  id: string
  ticker: string
  exchange?: string
  thesis?: string
  plannedAmount: number
  analysisDate: string
  startPrice: number
  startPriceSource: 'auto' | 'manual'
  acted: boolean
  lots: BuyLot[]
}

/** Persisted-state migration chain, exported for direct testing. */
export function migrateAnalyses(persisted: unknown, version: number): unknown {
  let state = persisted as { analyses?: (LegacyAnalysis | InvestmentAnalysis)[] }

  if (version < 1) {
    if (!Array.isArray(state.analyses)) return persisted
    const analyses: InvestmentAnalysis[] = (state.analyses as LegacyAnalysis[]).map((old) => ({
      id: old.id,
      name: old.ticker,
      thesis: old.thesis,
      analysisDate: old.analysisDate,
      positions: [
        {
          id: `${old.id}-p1`,
          ticker: old.ticker,
          exchange: old.exchange,
          plannedAmount: old.plannedAmount,
          startPrice: old.startPrice,
          startPriceSource: old.startPriceSource,
          acted: old.acted,
          lots: old.lots ?? [],
        },
      ],
      swaps: [],
    }))
    state = { ...state, analyses }
  }

  if (version < 2) {
    if (!Array.isArray(state.analyses)) return state as unknown
    const analyses = (state.analyses as InvestmentAnalysis[]).map((a) => ({
      ...a,
      swaps: a.swaps ?? [],
    }))
    state = { ...state, analyses }
  }

  if (version < 3) {
    if (!Array.isArray(state.analyses)) return state as unknown
    const analyses = (state.analyses as (InvestmentAnalysis & { initialFund?: number; extraFund?: number })[]).map(
      (a) => ({
        ...a,
        plannedBudget: a.plannedBudget ?? (a.initialFund ?? 0) + (a.extraFund ?? 0),
      }),
    )
    state = { ...state, analyses }
  }

  if (version < 4) {
    if (!Array.isArray(state.analyses)) return state as unknown
    const analyses = (state.analyses as (InvestmentAnalysis & { initialFund?: number; extraFund?: number })[]).map(
      (a) => {
        const copy: Partial<InvestmentAnalysis & { initialFund?: number; extraFund?: number }> = { ...a }
        delete copy.initialFund
        delete copy.extraFund
        return copy as InvestmentAnalysis
      },
    )
    state = { ...state, analyses }
  }

  return state as unknown
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      analyses: [],
      addAnalysis: (a) => set((state) => ({ analyses: [...state.analyses, a] })),
      updateAnalysis: (id, updates) =>
        set((state) => ({ analyses: mapAnalysis(state.analyses, id, (a) => ({ ...a, ...updates })) })),
      removeAnalysis: (id) =>
        set((state) => ({ analyses: state.analyses.filter((a) => a.id !== id) })),
      addPosition: (analysisId, position) =>
        set((state) => ({
          analyses: mapAnalysis(state.analyses, analysisId, (a) => ({
            ...a,
            positions: [...a.positions, position],
          })),
        })),
      removePosition: (analysisId, positionId) =>
        set((state) => ({
          analyses: mapAnalysis(state.analyses, analysisId, (a) => ({
            ...a,
            positions: a.positions.filter((p) => p.id !== positionId),
          })),
        })),
      updatePosition: (analysisId, positionId, updates) =>
        set((state) => ({
          analyses: mapPosition(state.analyses, analysisId, positionId, (p) => ({ ...p, ...updates })),
        })),
      addLot: (analysisId, positionId, lot) =>
        set((state) => ({
          analyses: mapPosition(state.analyses, analysisId, positionId, (p) => ({
            ...p,
            acted: true,
            lots: [...p.lots, lot],
          })),
        })),
      removeLot: (analysisId, positionId, lotId) =>
        set((state) => ({
          analyses: mapPosition(state.analyses, analysisId, positionId, (p) => ({
            ...p,
            lots: p.lots.filter((l) => l.id !== lotId),
          })),
        })),
      addSwap: (analysisId, swap) =>
        set((state) => ({
          analyses: mapAnalysis(state.analyses, analysisId, (a) => ({ ...a, swaps: [...(a.swaps ?? []), swap] })),
        })),
      removeSwap: (analysisId, swapId) =>
        set((state) => ({
          analyses: mapAnalysis(state.analyses, analysisId, (a) => ({
            ...a,
            swaps: (a.swaps ?? []).filter((s) => s.id !== swapId),
          })),
        })),
      updateSwap: (analysisId, swapId, updates) =>
        set((state) => ({
          analyses: mapAnalysis(state.analyses, analysisId, (a) => ({
            ...a,
            swaps: (a.swaps ?? []).map((s) => (s.id === swapId ? { ...s, ...updates } : s)),
          })),
        })),
    }),
    {
      name: STORAGE_KEYS.analyses,
      version: 4,
      // v0: one flat ticker per analysis → wrap it as the single position.
      // v1: analyses gain a `swaps` scenario list.
      // v2→v3: plannedBudget defaults to initialFund + extraFund; funds become actual-side.
      // v3→v4: initialFund/extraFund removed from the model; actual side derives funds from trades.
      migrate: migrateAnalyses,
    },
  ),
)
