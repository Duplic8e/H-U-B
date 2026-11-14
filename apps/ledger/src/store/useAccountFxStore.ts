import { create } from 'zustand'
import type { Resolved } from '../services/marketData/marketDataService'
import type { FxRate } from '../services/marketData/types'

interface AccountFxState {
  resolved: Resolved<FxRate> | undefined
  loading: boolean
  error: string | undefined
  refreshRevision: number
  requestRefresh: () => void
  publish: (resolved: Resolved<FxRate> | undefined, loading: boolean, error?: string) => void
}

export const useAccountFxStore = create<AccountFxState>((set) => ({
  resolved: undefined,
  loading: false,
  error: undefined,
  refreshRevision: 0,
  requestRefresh: () => set((state) => ({ refreshRevision: state.refreshRevision + 1 })),
  publish: (resolved, loading, error) => set({ resolved, loading, error }),
}))
