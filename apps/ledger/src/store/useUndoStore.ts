import { create } from 'zustand'

export interface UndoEntry {
  label: string
  undo: () => void
}

interface UndoState {
  pending: UndoEntry | null
  offerUndo: (label: string, undo: () => void) => void
  runUndo: () => void
  dismissUndo: () => void
}

/** Deliberately NOT persisted, and deliberately absent from STORAGE_KEYS: an
 *  undo entry holds a closure, which cannot survive serialisation, and an undo
 *  offer should not outlive the session that created it. Only the most recent
 *  offer is kept; there is no timer, so an offer stays until the user acts or
 *  another action replaces it. */
export const useUndoStore = create<UndoState>()((set, get) => ({
  pending: null,
  offerUndo: (label, undo) => set({ pending: { label, undo } }),
  runUndo: () => {
    const entry = get().pending
    if (!entry) return
    set({ pending: null })
    entry.undo()
  },
  dismissUndo: () => set({ pending: null }),
}))
