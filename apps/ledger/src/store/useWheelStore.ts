import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'
import { mergeActivityRows, type RawRow } from '../utils/investments/wheel/ibkrActivityParser'

interface WheelState {
  rawRows: RawRow[]
  fileCount: number
  addRows: (newRows: RawRow[], numFiles: number) => void
  clearAll: () => void
}

/** Raw deduped IBKR activity rows are the source of truth; ticker states
 *  are derived via processIBKR so parser fixes apply retroactively. */
export const useWheelStore = create<WheelState>()(
  persist(
    (set) => ({
      rawRows: [],
      fileCount: 0,
      addRows: (newRows, numFiles) =>
        set((s) => ({
          rawRows: mergeActivityRows(s.rawRows, newRows),
          fileCount: s.fileCount + numFiles,
        })),
      clearAll: () => set({ rawRows: [], fileCount: 0 }),
    }),
    {
      name: STORAGE_KEYS.wheel,
      version: 1,
      // Existing installs wrote version 0 with this exact shape, so v0 to v1
      // is an identity migration. It exists so the next schema change has a
      // hook instead of a silent reinterpretation of whatever is on disk.
      migrate: (persisted: unknown) => persisted,
    },
  ),
)
