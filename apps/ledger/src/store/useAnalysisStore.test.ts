import { useAnalysisStore, migrateAnalyses, type InvestmentAnalysis, type Position } from './useAnalysisStore'

const initialState = useAnalysisStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAnalysisStore.setState(initialState, true)
})

const position: Position = {
  id: 'p1', ticker: 'AAPL', plannedAmount: 10_000,
  startPrice: 200, startPriceSource: 'auto', acted: false, lots: [],
}

const analysis: InvestmentAnalysis = {
  id: 'a1', name: 'Big Tech 2026', analysisDate: '2026-01-15', positions: [position], swaps: [],
}

describe('useAnalysisStore', () => {
  it('adds, updates and removes analyses', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    expect(useAnalysisStore.getState().analyses).toHaveLength(1)
    s.updateAnalysis('a1', { name: 'Renamed' })
    expect(useAnalysisStore.getState().analyses[0].name).toBe('Renamed')
    s.removeAnalysis('a1')
    expect(useAnalysisStore.getState().analyses).toHaveLength(0)
  })

  it('adds, updates and removes positions within an analysis', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    s.addPosition('a1', { ...position, id: 'p2', ticker: 'MSFT' })
    expect(useAnalysisStore.getState().analyses[0].positions.map((p) => p.ticker)).toEqual(['AAPL', 'MSFT'])
    s.updatePosition('a1', 'p2', { acted: true })
    expect(useAnalysisStore.getState().analyses[0].positions[1].acted).toBe(true)
    s.removePosition('a1', 'p1')
    expect(useAnalysisStore.getState().analyses[0].positions.map((p) => p.id)).toEqual(['p2'])
  })

  it('manages lots per position and marks acted', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    s.addLot('a1', 'p1', { id: 'l1', date: '2026-01-20', amountInvested: 5_000, price: 205 })
    s.addLot('a1', 'p1', { id: 'l2', date: '2026-02-20', amountInvested: 3_500, price: 190 })
    const p = useAnalysisStore.getState().analyses[0].positions[0]
    expect(p.lots).toHaveLength(2)
    expect(p.acted).toBe(true) // adding a lot implies acted
    s.removeLot('a1', 'p1', 'l1')
    expect(useAnalysisStore.getState().analyses[0].positions[0].lots.map((l) => l.id)).toEqual(['l2'])
  })

  it('persists under the ledger-analyses key', () => {
    useAnalysisStore.getState().addAnalysis(analysis)
    expect(localStorage.getItem('ledger-analyses')).toContain('"AAPL"')
  })

  it('migrates v0 single-ticker analyses into positions', async () => {
    localStorage.setItem(
      'ledger-analyses',
      JSON.stringify({
        state: {
          analyses: [{
            id: 'old1', ticker: 'SHOP', exchange: 'TSX', thesis: 'e-comm rebound',
            plannedAmount: 5_000, analysisDate: '2025-11-01', startPrice: 95,
            startPriceSource: 'manual', acted: true,
            lots: [{ id: 'l1', date: '2025-11-05', amountInvested: 2_000, price: 97 }],
          }],
        },
        version: 0,
      }),
    )
    await useAnalysisStore.persist.rehydrate()
    const a = useAnalysisStore.getState().analyses[0]
    expect(a.name).toBe('SHOP')
    expect(a.thesis).toBe('e-comm rebound')
    expect(a.positions).toHaveLength(1)
    expect(a.positions[0]).toMatchObject({
      ticker: 'SHOP', exchange: 'TSX', plannedAmount: 5_000,
      startPrice: 95, startPriceSource: 'manual', acted: true,
    })
    expect(a.positions[0].lots).toHaveLength(1)
  })

  it('migrates v1 analyses (no swaps field) by adding an empty swaps array', async () => {
    localStorage.setItem(
      'ledger-analyses',
      JSON.stringify({
        state: {
          analyses: [{
            id: 'a1', name: 'Big Tech 2026', analysisDate: '2026-01-15',
            positions: [position],
          }],
        },
        version: 1,
      }),
    )
    await useAnalysisStore.persist.rehydrate()
    const a = useAnalysisStore.getState().analyses[0]
    expect(a.swaps).toEqual([])
  })

  it('adds, updates and removes swap scenarios', () => {
    const s = useAnalysisStore.getState()
    s.addAnalysis(analysis)
    s.addSwap('a1', {
      id: 'sw1', side: 'plan', outPositionId: 'p1',
      inTicker: 'GFS', inStartPrice: 40, inStartPriceSource: 'manual',
    })
    expect(useAnalysisStore.getState().analyses[0].swaps).toHaveLength(1)
    s.updateSwap('a1', 'sw1', { inStartPrice: 42 })
    expect(useAnalysisStore.getState().analyses[0].swaps[0].inStartPrice).toBe(42)
    s.removeSwap('a1', 'sw1')
    expect(useAnalysisStore.getState().analyses[0].swaps).toHaveLength(0)
  })

  it('migrates v2 analyses by defaulting plannedBudget to initialFund + extraFund', async () => {
    localStorage.setItem(
      'ledger-analyses',
      JSON.stringify({
        state: {
          analyses: [{
            id: 'a1', name: 'Big Tech 2026', analysisDate: '2026-01-15',
            initialFund: 10_000, extraFund: 2_000,
            positions: [position], swaps: [],
          }],
        },
        version: 2,
      }),
    )
    await useAnalysisStore.persist.rehydrate()
    const a = useAnalysisStore.getState().analyses[0]
    expect(a.plannedBudget).toBe(12_000)
  })

  it('v3 -> v4 strips manual fund fields', () => {
    const persisted = {
      analyses: [{
        id: 'a1', name: 'X', analysisDate: '2026-01-01',
        initialFund: 5000, extraFund: 1000, plannedBudget: 6000,
        positions: [], swaps: [],
      }],
    }
    const out = migrateAnalyses(persisted, 3) as { analyses: Record<string, unknown>[] }
    expect(out.analyses[0]).not.toHaveProperty('initialFund')
    expect(out.analyses[0]).not.toHaveProperty('extraFund')
    expect(out.analyses[0]).toHaveProperty('plannedBudget', 6000)
  })

  it('migrates v3 analyses (with fund fields) via rehydrate by stripping initialFund/extraFund', async () => {
    localStorage.setItem(
      'ledger-analyses',
      JSON.stringify({
        state: {
          analyses: [{
            id: 'a1', name: 'Big Tech 2026', analysisDate: '2026-01-15',
            initialFund: 10_000, extraFund: 2_000, plannedBudget: 12_000,
            positions: [position], swaps: [],
          }],
        },
        version: 3,
      }),
    )
    await useAnalysisStore.persist.rehydrate()
    const a = useAnalysisStore.getState().analyses[0]
    expect(a).not.toHaveProperty('initialFund')
    expect(a).not.toHaveProperty('extraFund')
    expect(a.plannedBudget).toBe(12_000)
  })
})

describe('analysis store plannedBudget', () => {
  it('accepts plannedBudget on an analysis', () => {
    const a: InvestmentAnalysis = {
      id: 'a1', name: 'Test', analysisDate: '2026-01-01',
      plannedBudget: 12000,
      positions: [], swaps: [],
    }
    useAnalysisStore.setState({ analyses: [] })
    useAnalysisStore.getState().addAnalysis(a)
    expect(useAnalysisStore.getState().analyses[0].plannedBudget).toBe(12000)
  })
})
