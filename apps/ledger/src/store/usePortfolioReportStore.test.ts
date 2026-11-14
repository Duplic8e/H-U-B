import { usePortfolioReportStore } from './usePortfolioReportStore'
import type { PAReport } from '../utils/investments/ibkrPortfolioAnalyst'

const initialState = usePortfolioReportStore.getState()

beforeEach(() => {
  usePortfolioReportStore.setState(initialState, true)
})

const report = { openPositions: [] } as unknown as PAReport

describe('usePortfolioReportStore', () => {
  it('starts with no report', () => {
    expect(usePortfolioReportStore.getState().report).toBeNull()
    expect(usePortfolioReportStore.getState().uploadedAt).toBeNull()
  })

  it('stamps an upload time when a report is stored', () => {
    usePortfolioReportStore.getState().setReport(report)
    expect(usePortfolioReportStore.getState().report).toBe(report)
    expect(usePortfolioReportStore.getState().uploadedAt).not.toBeNull()
  })

  it('replaces the previous report wholesale', () => {
    const second = { openPositions: [{}] } as unknown as PAReport
    usePortfolioReportStore.getState().setReport(report)
    usePortfolioReportStore.getState().setReport(second)
    expect(usePortfolioReportStore.getState().report).toBe(second)
  })

  it('clears the report and its timestamp', () => {
    usePortfolioReportStore.getState().setReport(report)
    usePortfolioReportStore.getState().clearReport()
    expect(usePortfolioReportStore.getState().report).toBeNull()
    expect(usePortfolioReportStore.getState().uploadedAt).toBeNull()
  })
})
