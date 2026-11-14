import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'
import type { Currency } from '../services/marketData/types'

export interface Holding {
  id: string
  ticker: string
  name?: string
  exchange?: string
  quantity: number
  /** Per-share cost basis in the holding's own currency. */
  avgCost: number
  /** null when the import gave a code we cannot map. Such holdings show
   *  native numbers and are excluded from CAD totals. */
  currency: Currency | null
  /** Broker account this row belongs to (user-supplied at import). */
  account: string
}

export type ImportMode = 'replace' | 'update' | 'add'

export const DEFAULT_ACCOUNT = 'Default'

/** Unique account names in first-seen order. */
export function accountNames(holdings: Holding[]): string[] {
  const seen: string[] = []
  for (const h of holdings) {
    if (!seen.includes(h.account)) seen.push(h.account)
  }
  return seen
}

interface PortfolioState {
  holdings: Holding[]
  importedAt: string | null
  /** Set by the v1 -> v2 migration: pre-0.7.3 imports may have wrong currencies. */
  currencyReviewPending: boolean
  importHoldings: (account: string, mode: ImportMode, rows: Omit<Holding, 'id' | 'account'>[]) => void
  setHoldingCurrency: (id: string, currency: Currency | null) => void
  dismissCurrencyReview: () => void
  clearHoldings: () => void
}

/** v0 -> v1: holdings predate accounts, so adopt them into Default.
 *  v1 -> v2: imports before v0.7.3 stored every foreign currency as CAD. The
 *  original code is unrecoverable, so flag a review rather than guess. */
export function migratePortfolioState(persisted: unknown, version: number): unknown {
  const state = persisted as {
    holdings?: Array<Record<string, unknown>>
    importedAt?: string | null
  }
  let next: Record<string, unknown> = { ...state }
  if (version < 1 && Array.isArray(state.holdings)) {
    next = { ...next, holdings: state.holdings.map((h) => ({ account: DEFAULT_ACCOUNT, ...h })) }
  }
  if (version < 2) {
    const holdings = next.holdings as unknown[] | undefined
    next = { ...next, currencyReviewPending: Array.isArray(holdings) && holdings.length > 0 }
  }
  return next
}

let importSeq = 0
function stamp(account: string, rows: Omit<Holding, 'id' | 'account'>[]): Holding[] {
  importSeq += 1
  return rows.map((r, i) => ({ ...r, account, id: `h-${importSeq}-${i}-${Date.now()}` }))
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      holdings: [],
      importedAt: null,
      currencyReviewPending: false,
      importHoldings: (account, mode, rows) =>
        set((state) => {
          const incoming = stamp(account, rows)
          let holdings: Holding[]
          if (mode === 'replace') {
            // Replace only this account's rows; other accounts untouched.
            holdings = [...state.holdings.filter((h) => h.account !== account), ...incoming]
          } else if (mode === 'update') {
            // Upsert by ticker within the account.
            const kept = state.holdings.filter(
              (h) => h.account !== account || !incoming.some((n) => n.ticker === h.ticker),
            )
            holdings = [...kept, ...incoming]
          } else {
            // 'add': append as-is (new account, or extra rows in an existing one).
            holdings = [...state.holdings, ...incoming]
          }
          return { holdings, importedAt: new Date().toISOString() }
        }),
      setHoldingCurrency: (id, currency) =>
        set((state) => ({
          holdings: state.holdings.map((h) => (h.id === id ? { ...h, currency } : h)),
        })),
      dismissCurrencyReview: () => set({ currencyReviewPending: false }),
      clearHoldings: () => set({ holdings: [], importedAt: null, currencyReviewPending: false }),
    }),
    {
      name: STORAGE_KEYS.portfolio,
      version: 2,
      migrate: migratePortfolioState,
    },
  ),
)
