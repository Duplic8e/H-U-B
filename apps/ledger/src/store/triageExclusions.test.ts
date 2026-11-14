import { useTriageStore } from './useTriageStore'
import { useBudgetStore } from './useBudgetStore'
import { useUndoStore } from './useUndoStore'
import type { ExclusionRuleDraft } from '../types/exclusionRules'
import type { TriageTransaction } from '../types/triage'

const sources = { a: { id: 'a', name: 'Card A' } }
const draft: ExclusionRuleDraft = {
  name: 'Payments', sourceId: 'a', description: { operator: 'exact', value: 'PAYMENT' },
  direction: 'in', amount: { operator: 'any' }, behavior: 'review',
}
const row: TriageTransaction = { id: 'a', date: '2026-06-10', description: 'PAYMENT', amount: 50, type: 'income' }
const triageInitial = useTriageStore.getState(), budgetInitial = useBudgetStore.getState(), undoInitial = useUndoStore.getState()
beforeEach(() => {
  useTriageStore.setState(triageInitial, true)
  useBudgetStore.setState(budgetInitial, true)
  useUndoStore.setState(undoInitial, true)
  useTriageStore.setState({ importSources: sources })
})

it('keeps explicit inclusion across new and edited rules and preserves card flags', () => {
  const s = useTriageStore.getState(), ruleId = s.saveExclusionRule(draft)
  s.importTransactions([{ ...row, flag: 'card-payment' }], 'a')
  s.includeExclusionMatch('a')
  s.saveExclusionRule({ ...draft, behavior: 'automatic' }, { id: ruleId, applyPending: true })
  s.saveExclusionRule({ ...draft, behavior: 'automatic' }, { applyPending: true })
  expect(useTriageStore.getState().pendingTransactions.a).toMatchObject({ flag: 'card-payment' })
  expect(useTriageStore.getState().pendingTransactions.a.exclusionMatches).toBeUndefined()
  expect(useTriageStore.getState().importRecords.a.exclusionOverride).toBe('include')
})

it('restores the same occurrence without reapplying active rules', () => {
  const s = useTriageStore.getState()
  s.saveExclusionRule({ ...draft, behavior: 'automatic' })
  s.importTransactions([row], 'a')
  s.restoreImportRecord('a')
  s.applyExclusionRulesToPending()
  const current = useTriageStore.getState()
  expect(current.pendingTransactions.a.exclusionMatches).toBeUndefined()
  expect(current.importRecords.a).toMatchObject({ original: row, exclusionOverride: 'include', decision: 'pending' })
  expect(current.importRecords.a.ignoreReason).toBeUndefined()
  expect(Object.keys(current.pendingTransactions)).toEqual(['a'])
})

it('preserves history snapshots through pause edit and deletion', () => {
  const s = useTriageStore.getState(), id = s.saveExclusionRule(draft)
  s.importTransactions([row], 'a')
  s.rejectTransaction('a')
  const before = useTriageStore.getState().importRecords.a
  expect(before.ignoreReason).toBe('rule')
  s.setExclusionRuleEnabled(id, false)
  s.saveExclusionRule({ ...draft, name: 'Edited' }, { id })
  expect(useTriageStore.getState().exclusionRules[id].enabled).toBe(false)
  s.deleteExclusionRule(id)
  expect(useTriageStore.getState().importRecords.a).toEqual(before)
})

it('applies all current rules atomically only to pending rows and preserves accepted budget rows', () => {
  const s = useTriageStore.getState()
  s.importTransactions([row, { ...row, id: 'b', date: '2026-06-11' }], 'a')
  s.approveTransaction('a')
  const accepted = useTriageStore.getState().importRecords.a, budget = useBudgetStore.getState().transactions
  expect(() => s.saveExclusionRule({ ...draft, sourceId: 'missing' }, { applyPending: true })).toThrow()
  expect(Object.keys(useTriageStore.getState().exclusionRules)).toEqual([])
  s.saveExclusionRule({ ...draft, behavior: 'automatic' }, { applyPending: true })
  expect(useTriageStore.getState().importRecords.b.ignoreReason).toBe('rule')
  expect(useTriageStore.getState().importRecords.a).toEqual(accepted)
  expect(useBudgetStore.getState().transactions).toEqual(budget)
})

it('batch rule exclusion skips duplicates and inclusion preserves duplicate review', () => {
  const s = useTriageStore.getState()
  s.saveExclusionRule(draft)
  useBudgetStore.setState({ transactions: { legacy: { ...row, id: 'legacy' } } })
  s.importTransactions([row], 'a')
  expect(s.excludeExclusionMatches(['a'])).toEqual([])
  s.includeExclusionMatch('a')
  expect(useTriageStore.getState().pendingTransactions.a.duplicate).toBe('possible')
  expect(s.approveAll()).toEqual([])
})

it('restoring a manually ignored possible duplicate retains its identity review', () => {
  const s = useTriageStore.getState()
  useBudgetStore.setState({ transactions: { legacy: { ...row, id: 'legacy' } } })
  s.importTransactions([row], 'a')
  s.rejectTransaction('a'); s.restoreImportRecord('a')
  expect(useTriageStore.getState().pendingTransactions.a).toMatchObject({ duplicate: 'possible', duplicateTransactionId: 'legacy' })
  expect(s.approveAll()).toEqual([])
})

it('ordinary rejection learns no rule and chooses card or manual reasons', () => {
  const s = useTriageStore.getState()
  s.importTransactions([row, { ...row, id: 'b', date: '2026-06-11', flag: 'card-payment' }], 'a')
  s.rejectTransaction('a'); s.rejectTransaction('b')
  expect(useTriageStore.getState().importRecords.a.ignoreReason).toBe('manual')
  expect(useTriageStore.getState().importRecords.b.ignoreReason).toBe('card-payment')
  expect(useTriageStore.getState().exclusionRules).toEqual({})
})

it('dismisses stale Undo on rule actions and reimport', () => {
  const s = useTriageStore.getState()
  useUndoStore.getState().offerUndo('stale', () => { throw new Error('stale') })
  s.saveExclusionRule(draft)
  expect(useUndoStore.getState().pending).toBeNull()
  useUndoStore.getState().offerUndo('stale', () => { throw new Error('stale') })
  s.importTransactions([row], 'a')
  expect(useUndoStore.getState().pending).toBeNull()
})

it('preserves original metadata when a scoped Undo adds pending rows', () => {
  const s = useTriageStore.getState()
  s.saveExclusionRule(draft); s.importTransactions([row], 'a'); s.includeExclusionMatch('a')
  const tx = useTriageStore.getState().pendingTransactions.a
  s.rejectTransaction('a')
  s.addPending([{ ...tx, description: 'Edited' }])
  expect(useTriageStore.getState().importRecords.a).toMatchObject({ original: row, exclusionOverride: 'include', decision: 'pending' })
})

it('restoration then Discard All invalidates dependent aliases', () => {
  const s = useTriageStore.getState()
  s.importTransactions([row], 'a'); s.rejectTransaction('a')
  useTriageStore.setState(state => ({ importRecords: { ...state.importRecords, alias: { ...state.importRecords.a, id: 'alias', decision: 'duplicate', matchedRecordId: 'a' } } }))
  s.restoreImportRecord('a'); s.clearAll()
  expect(useTriageStore.getState().importRecords).toEqual({})
})

it('recalculates pending holds only on explicit apply and returns excluded IDs', () => {
  const s = useTriageStore.getState(), id = s.saveExclusionRule(draft)
  s.importTransactions([row], 'a')
  const before = useTriageStore.getState().pendingTransactions.a
  s.setExclusionRuleEnabled(id, false)
  expect(useTriageStore.getState().pendingTransactions.a).toBe(before)
  expect(s.applyExclusionRulesToPending()).toEqual([])
  expect(useTriageStore.getState().pendingTransactions.a.exclusionMatches).toBeUndefined()
  s.setExclusionRuleEnabled(id, true)
  s.applyExclusionRulesToPending()
  expect(s.excludeExclusionMatches(['a', 'a', 'missing'])).toEqual(['a'])
  expect(useTriageStore.getState().importRecords.a.ignoreReason).toBe('rule')
})

it('preserves exact absent optional fields when UI restores scoped Undo snapshots', () => {
  const s = useTriageStore.getState()
  s.saveExclusionRule(draft); s.importTransactions([row], 'a')
  const tx = useTriageStore.getState().pendingTransactions.a, record = useTriageStore.getState().importRecords.a
  s.includeExclusionMatch('a')
  useUndoStore.getState().offerUndo('Include', () => useTriageStore.setState(state => ({
    pendingTransactions: { ...state.pendingTransactions, a: tx },
    importRecords: { ...state.importRecords, a: record },
  })))
  useTriageStore.setState(state => ({ importRecords: { ...state.importRecords, unrelated: { ...record, id: 'unrelated' } } }))
  useUndoStore.getState().runUndo()
  expect(useTriageStore.getState().importRecords.a).toEqual(record)
  expect('exclusionOverride' in useTriageStore.getState().importRecords.a).toBe(false)
  expect(useTriageStore.getState().importRecords.unrelated).toBeDefined()
})

it('rehydrates paused rules and historical revisions with occurrence overrides', async () => {
  const s = useTriageStore.getState(), id = s.saveExclusionRule(draft)
  s.importTransactions([row], 'a'); s.rejectTransaction('a'); s.setExclusionRuleEnabled(id, false)
  s.importTransactions([{ ...row, id: 'b', date: '2026-06-11' }], 'a'); s.includeExclusionMatch('b')
  const state = useTriageStore.getState()
  const persisted = localStorage.getItem('ledger-triage')!
  useTriageStore.setState(triageInitial, true)
  localStorage.setItem('ledger-triage', persisted)
  await useTriageStore.persist.rehydrate()
  expect(useTriageStore.getState().exclusionRules).toEqual(state.exclusionRules)
  expect(useTriageStore.getState().importRecords).toEqual(state.importRecords)
})
