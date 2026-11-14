import { describe, beforeEach, it, expect } from 'vitest'
import { useTriageStore } from '../../store/useTriageStore'
import { useUndoStore } from '../../store/useUndoStore'
import { captureTriageUndo } from './triageUndo'
const initial=useTriageStore.getState()
describe('captureTriageUndo',()=>{
 beforeEach(()=>{useTriageStore.setState(initial,true);useUndoStore.getState().dismissUndo()})
 it('restores selected IDs and removes newly added fields, preserving unrelated IDs',()=>{
  const row={id:'a',date:'2026-06-10',description:'BANK',amount:50,type:'income' as const}
  useTriageStore.setState({pendingTransactions:{a:row}})
  const offer=captureTriageUndo({pendingIds:['a','new']})
  useTriageStore.setState({pendingTransactions:{a:{...row,exclusionMatches:[]},new:{...row,id:'new'},other:{...row,id:'other'}}})
  offer('Test'); useUndoStore.getState().runUndo()
  expect(useTriageStore.getState().pendingTransactions.a).toEqual(row)
  expect(useTriageStore.getState().pendingTransactions.new).toBeUndefined()
  expect(useTriageStore.getState().pendingTransactions.other).toBeDefined()
 })
})

it('captures actual deleted discard entities and preserves unrelated replacement state', () => {
 const row={id:'a',date:'2026-06-10',description:'BANK',amount:50,type:'income' as const,importRecordId:'a'}
 const record={id:'a',sourceId:'a',decision:'pending' as const,original:row}
 const day={sourceId:'a',date:row.date,signature:'original',recordIds:['a']}
 const report={addedIds:['a'],skippedIds:[],changedDays:[]}
 useTriageStore.setState({pendingTransactions:{a:row},importRecords:{a:record},importDays:[day],lastImport:report})
 const offer=captureTriageUndo({pendingIds:['a'],recordIds:['a'],discard:true})
 useTriageStore.getState().clearAll()
 offer('Discard')
 const replacement={...record,decision:'ignored' as const}
 const newDay={...day,signature:'new',recordIds:['new']}
 const newReport={addedIds:['new'],skippedIds:[],changedDays:[]}
 useTriageStore.setState({importRecords:{a:replacement},importDays:[newDay],lastImport:newReport})
 useUndoStore.getState().runUndo()
 expect(useTriageStore.getState().importRecords.a).toEqual(replacement)
 expect(useTriageStore.getState().importDays).toEqual([day,newDay])
 expect(useTriageStore.getState().lastImport).toEqual(newReport)
})

it('restores include override absence, deletes a new rule and replaces a dismissed offer',()=>{
 const row={id:'a',date:'2026-06-10',description:'BANK',amount:50,type:'income' as const}
 const record={id:'a',sourceId:'a',decision:'pending' as const,original:row}
 useTriageStore.setState({pendingTransactions:{},importRecords:{a:record},exclusionRules:{},importSources:{a:{id:'a',name:'Card A'}}})
 useUndoStore.getState().offerUndo('Old',()=>{throw new Error('Old offer invoked')})
 const offer=captureTriageUndo({recordIds:['a']})
 useTriageStore.setState(s=>({importRecords:{...s.importRecords,a:{...record,exclusionOverride:'include'}}}))
 const id=useTriageStore.getState().saveExclusionRule({name:'Payments',sourceId:'a',description:{operator:'exact',value:'BANK'},direction:'in',amount:{operator:'any'},behavior:'review'})
 expect(useUndoStore.getState().pending).toBeNull()
 offer('New', [id]);expect(useUndoStore.getState().pending?.label).toBe('New')
 useUndoStore.getState().runUndo()
 expect(useTriageStore.getState().importRecords.a).toEqual(record)
 expect(useTriageStore.getState().importRecords.a).not.toHaveProperty('exclusionOverride')
 expect(useTriageStore.getState().exclusionRules[id]).toBeUndefined()
})
