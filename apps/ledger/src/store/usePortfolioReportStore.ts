import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'
import type { PAReport } from '../utils/investments/ibkrPortfolioAnalyst'

interface PortfolioReportState {
  report: PAReport | null
  uploadedAt: string | null
  setReport: (report: PAReport) => void
  clearReport: () => void
}

/** Latest uploaded PortfolioAnalyst report; replaced wholesale on upload. */
export const usePortfolioReportStore = create<PortfolioReportState>()(
  persist(
    (set) => ({
      report: null,
      uploadedAt: null,
      setReport: (report) => set({ report, uploadedAt: new Date().toISOString() }),
      clearReport: () => set({ report: null, uploadedAt: null }),
    }),
    {
      name: STORAGE_KEYS.portfolioReport,
      version: 1,
      // Existing installs wrote version 0 with this exact shape, so v0 to v1
      // is an identity migration. It exists so the next schema change has a
      // hook instead of a silent reinterpretation of whatever is on disk.
      migrate: (persisted: unknown) => persisted,
    },
  ),
)
