import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { STORAGE_KEYS } from './storageKeys'
import type { Trade } from '../types/trades'

interface TradesState {
  trades: Trade[]
  addTrade: (trade: Omit<Trade, 'id'>) => void
  removeTrade: (id: string) => void
  clearTrades: () => void
}

/** The trade log is deliberately independent of `usePortfolioStore`, which
 *  holds an imported snapshot of current positions. Holdings answer "what do I
 *  own now"; trades answer "what did I do and what did I realise". Task 17's
 *  reconciliation view is where the two are compared. */
export const useTradesStore = create<TradesState>()(
  persist(
    (set) => ({
      trades: [],
      addTrade: (trade) =>
        set((state) => ({
          trades: [
            ...state.trades,
            {
              ...trade,
              ticker: trade.ticker.trim().toUpperCase(),
              quantity: Math.abs(trade.quantity),
              price: Math.abs(trade.price),
              fees: Math.abs(trade.fees),
              id: uuidv4(),
            },
          ],
        })),
      removeTrade: (id) => set((state) => ({ trades: state.trades.filter((t) => t.id !== id) })),
      clearTrades: () => set({ trades: [] }),
    }),
    {
      name: STORAGE_KEYS.trades,
      version: 1,
      // Existing installs wrote version 0 with this exact shape, so v0 to v1
      // is an identity migration. It exists so the next schema change has a
      // hook instead of a silent reinterpretation of whatever is on disk.
      migrate: (persisted: unknown) => persisted,
    },
  ),
)
