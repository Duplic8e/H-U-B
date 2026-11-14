import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'
import type { PlannedBill, PlanPeriod } from '../utils/budget/cashPlan'

interface RecurringState {
  /** RecurringItem.key values ("expense:NETFLIX") the user has dismissed. */
  ignoredKeys: string[]
  ignore: (key: string) => void
  unignore: (key: string) => void
  /** Bills entered by hand: rent, phone, insurance. */
  plannedBills: PlannedBill[]
  /** The period the Cash Plan is shown in. */
  planPeriod: PlanPeriod
  saveBill: (bill: PlannedBill) => void
  removeBill: (id: string) => void
  setPlanPeriod: (period: PlanPeriod) => void
}

/** Detection is derived from transactions on every render, so the only thing
 *  worth persisting is the user's judgement about it. */
export const useRecurringStore = create<RecurringState>()(
  persist(
    (set) => ({
      ignoredKeys: [],
      ignore: (key) =>
        set((s) => (s.ignoredKeys.includes(key) ? s : { ignoredKeys: [...s.ignoredKeys, key] })),
      unignore: (key) => set((s) => ({ ignoredKeys: s.ignoredKeys.filter((k) => k !== key) })),
      plannedBills: [],
      planPeriod: 'monthly',
      saveBill: (bill) =>
        set((s) => ({
          plannedBills: s.plannedBills.some((b) => b.id === bill.id)
            ? s.plannedBills.map((b) => (b.id === bill.id ? bill : b))
            : [...s.plannedBills, bill],
        })),
      removeBill: (id) => set((s) => ({ plannedBills: s.plannedBills.filter((b) => b.id !== id) })),
      setPlanPeriod: (planPeriod) => set({ planPeriod }),
    }),
    {
      name: STORAGE_KEYS.recurring,
      version: 2,
      // v0 and v1 held only ignoredKeys. v2 adds hand-entered bills and the
      // Cash Plan period; older saves start with none.
      migrate: (persisted: unknown) => ({
        plannedBills: [],
        planPeriod: 'monthly',
        ...(persisted as object),
      }),
    },
  ),
)
