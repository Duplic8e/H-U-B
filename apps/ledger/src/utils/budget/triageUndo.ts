import { useTriageStore } from '../../store/useTriageStore'
import { useUndoStore } from '../../store/useUndoStore'

/** Capture before the action. Install the returned offer AFTER the store action
 * (store actions invalidate the previous offer). Restore named IDs, or use
 * discard to capture all actual deletions, removed days and the cleared report.
 * New IDs can be supplied after save, so undo deletes newly created rules. */
export function captureTriageUndo(scope: { pendingIds?: string[]; recordIds?: string[]; ruleIds?: string[]; discard?: boolean }) {
  const state = useTriageStore.getState()
  const pending = Object.fromEntries((scope.pendingIds ?? []).map(id => [id, state.pendingTransactions[id]]))
  const records = Object.fromEntries((scope.recordIds ?? []).map(id => [id, state.importRecords[id]]))
  const rules = Object.fromEntries((scope.ruleIds ?? []).map(id => [id, state.exclusionRules[id]]))
  return (label: string, newRuleIds: string[] = []) => {
    if (scope.discard) {
      // Observe the completed action rather than duplicating clearAll's alias
      // traversal. Capture only entities it actually removed.
      const after = useTriageStore.getState()
      const removedPending = Object.entries(state.pendingTransactions).filter(([id]) => !after.pendingTransactions[id])
      const removedRecords = Object.entries(state.importRecords).filter(([id]) => !after.importRecords[id])
      const removedDays = state.importDays.flatMap((day, index) => after.importDays.includes(day) ? [] : [{ day, index }])
      const changedReport = state.lastImport !== after.lastImport
      useUndoStore.getState().offerUndo(label, () => useTriageStore.setState(current => {
        const pendingTransactions = { ...current.pendingTransactions }
        const importRecords = { ...current.importRecords }
        const importDays = [...current.importDays]
        // A new entry with the same ID is unrelated later state, so retain it.
        for (const [id, value] of removedPending) if (!pendingTransactions[id]) pendingTransactions[id] = value
        for (const [id, value] of removedRecords) if (!importRecords[id]) importRecords[id] = value
        for (const { day, index } of removedDays) {
          if (!importDays.includes(day)) importDays.splice(Math.min(index, importDays.length), 0, day)
        }
        return { pendingTransactions, importRecords, importDays,
          ...(changedReport && current.lastImport === after.lastImport ? { lastImport: state.lastImport } : {}) }
      }))
      return
    }
    useUndoStore.getState().offerUndo(label, () => useTriageStore.setState(current => {
      const pendingTransactions = { ...current.pendingTransactions }
      const importRecords = { ...current.importRecords }
      const exclusionRules = { ...current.exclusionRules }
      for (const [id, value] of Object.entries(pending)) { if (value) pendingTransactions[id] = value; else delete pendingTransactions[id] }
      for (const [id, value] of Object.entries(records)) { if (value) importRecords[id] = value; else delete importRecords[id] }
      for (const id of newRuleIds) delete exclusionRules[id]
      for (const [id, value] of Object.entries(rules)) { if (value) exclusionRules[id] = value; else delete exclusionRules[id] }
      return { pendingTransactions, importRecords, exclusionRules }
    }))
  }
}
