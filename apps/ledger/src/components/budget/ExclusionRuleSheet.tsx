import { useState } from 'react'
import { X } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Checkbox } from '../ui/Checkbox'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ExclusionRulePreview } from './ExclusionRulePreview'
import { useTriageStore } from '../../store/useTriageStore'
import type { ExclusionRuleDraft } from '../../types/exclusionRules'
import { cashMovementCents, evaluateExclusionRules, previewExclusionRule, validateExclusionDraft } from '../../utils/budget/exclusionRules'
import { captureTriageUndo } from '../../utils/budget/triageUndo'

export type ExclusionRuleSheetProps = { open: boolean; onClose: () => void; ruleId?: string; seedRecordId?: string; initialDraft?: ExclusionRuleDraft }
const inputClass = 'min-h-11 w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] font-normal text-[var(--color-text-primary)] focus:border-[var(--color-accent)] transition-colors'
function parseAmountCents(text: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim())) return null
  const value = Math.round(Number(text.trim()) * 100)
  return Number.isSafeInteger(value) ? value : null
}

// Mount the form afresh for each open/target, without writing to persisted state.
export function ExclusionRuleSheet(props: ExclusionRuleSheetProps) {
  return props.open ? <RuleForm key={`${props.ruleId ?? ''}:${props.seedRecordId ?? ''}`} {...props} /> : null
}
function RuleForm({ open, onClose, ruleId, seedRecordId, initialDraft }: ExclusionRuleSheetProps) {
  const sources = useTriageStore(s => s.importSources)
  const records = useTriageStore(s => s.importRecords)
  const pending = useTriageStore(s => s.pendingTransactions)
  const rules = useTriageStore(s => s.exclusionRules)
  const existing = ruleId ? rules[ruleId] : undefined
  const seed = seedRecordId ? records[seedRecordId] : undefined
  const unavailable = !!seedRecordId && (!seed || !sources[seed.sourceId])
  const initial: ExclusionRuleDraft = existing ?? initialDraft ?? {
    name: seed?.original.description ?? '', sourceId: seed?.sourceId ?? '',
    description: { operator: 'exact', value: seed?.original.description ?? '' },
    direction: seed ? (cashMovementCents(seed.original) > 0 ? 'in' : cashMovementCents(seed.original) < 0 ? 'out' : 'either') : 'either',
    amount: { operator: 'any' }, behavior: 'review',
  }
  // Retain invalid persisted choices as placeholders, never broaden a malformed rule.
  const [name, setName] = useState(typeof initial.name === 'string' ? initial.name : '')
  const [scope, setScope] = useState(initial.sourceId === null ? 'all' : typeof initial.sourceId === 'string' ? initial.sourceId : '')
  const [operator, setOperator] = useState(initial.description?.operator ?? '' as ExclusionRuleDraft['description']['operator'])
  const [text, setText] = useState(typeof initial.description?.value === 'string' ? initial.description.value : '')
  const [direction, setDirection] = useState(initial.direction ?? '' as ExclusionRuleDraft['direction'])
  const [behavior, setBehavior] = useState(initial.behavior ?? '' as ExclusionRuleDraft['behavior'])
  const [amountOperator, setAmountOperator] = useState(initial.amount?.operator ?? '' as ExclusionRuleDraft['amount']['operator'])
  const [amountText, setAmountText] = useState(initial.amount?.operator === 'exact' ? String(initial.amount.cents / 100) : initial.amount?.operator === 'between' ? String(initial.amount.minCents / 100) : '')
  const [maxAmountText, setMaxAmountText] = useState(initial.amount?.operator === 'between' ? String(initial.amount.maxCents / 100) : '')
  const [applyPending, setApplyPending] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(initial.direction !== 'either' || initial.amount?.operator !== 'any')
  const [saveError, setSaveError] = useState('')
  const [touched, setTouched] = useState<string[]>([])
  const [attemptedSave, setAttemptedSave] = useState(false)
  const touch = (field: string) => setTouched(previous => previous.includes(field) ? previous : [...previous, field])
  const cents = parseAmountCents(amountText), maxCents = parseAmountCents(maxAmountText)
  const amountError = amountOperator === 'exact' && cents === null ? 'Enter a valid amount' : amountOperator === 'between' && (cents === null || maxCents === null) ? 'Enter a valid amount range' : ''
  const draft: ExclusionRuleDraft = { name, sourceId: scope === 'all' ? null : scope,
    description: { operator, value: text }, direction, behavior,
    amount: amountOperator === 'exact' ? (cents === null ? {operator:'any'} : {operator:'exact', cents}) : amountOperator === 'between' ? (cents === null || maxCents === null ? {operator:'any'} : {operator:'between',minCents:cents,maxCents}) : { operator:amountOperator } as ExclusionRuleDraft['amount'] }
  const errors = validateExclusionDraft(draft, sources)
  if (amountError) errors.push(amountError)
  if (unavailable) errors.push('Source information unavailable')
  if (ruleId && !existing) errors.push('Choose an available exclusion rule')
  const draftValid = errors.length === 0
  const preview = draftValid ? previewExclusionRule(draft, Object.values(records).filter(r => !!sources[r.sourceId]), Object.values(pending)) : null
  const eligible = Object.values(pending).filter(tx => { const r = tx.importRecordId && records[tx.importRecordId]; return r && r.decision === 'pending' && !!sources[r.sourceId] })
  const nextRules = [...Object.entries(rules).filter(([id, rule]) => id !== ruleId && rule?.id === id && rule?.enabled === true && validateExclusionDraft(rule, sources).length === 0).map(([, rule]) => rule),
    ...(draftValid ? [{ ...draft, id: ruleId ?? 'preview-draft', revision: existing?.revision ?? 1, enabled: existing?.enabled ?? true }] : [])]
  const checked = eligible.filter(tx => records[tx.importRecordId!].exclusionOverride !== 'include')
  const matchingCount = draftValid ? checked.filter(tx => evaluateExclusionRules(nextRules, records[tx.importRecordId!].original, records[tx.importRecordId!].sourceId).length > 0).length : null
  const unavailableRecords = Object.values(records).filter(record => record.decision !== 'duplicate' && !sources[record.sourceId]).length
  const save = () => {
    setAttemptedSave(true)
    if (errors.length) return
    const offer = captureTriageUndo({ ruleIds: ruleId ? [ruleId] : [], pendingIds: applyPending ? eligible.map(tx => tx.id) : [], recordIds: applyPending ? eligible.map(tx => tx.importRecordId!) : [] })
    try {
      const id = useTriageStore.getState().saveExclusionRule(draft, {id:ruleId,applyPending})
      offer('Save exclusion rule', ruleId ? [] : [id]); onClose()
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to save rule') }
  }
  const select = (label: string, value: string, onChange: (value: string) => void, options: {value:string;label:string}[], showLabel = true) => <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-2">{showLabel && <span className="text-[12px] font-medium leading-none text-[var(--color-text-secondary)]">{label}</span>}<ThemedSelect ariaLabel={label} value={value} onChange={v => { onChange(v); touch(label) }} options={options} className="min-h-11" /></div>
  const visibleErrors = errors.filter(error => {
    if (attemptedSave || unavailable || (existing && validateExclusionDraft(existing, sources).length > 0)) return true
    if (error.includes('rule name')) return touched.includes('Rule Name')
    if (error.includes('description pattern')) return touched.includes('Bank Description')
    if (error.includes('card or account')) return touched.includes('Card or Account')
    if (error.includes('description operator')) return touched.includes('Description Match')
    if (error.includes('money direction')) return touched.includes('Money Direction')
    if (error.includes('rule behavior')) return touched.includes('Behavior')
    if (error.includes('amount')) return touched.some(field => ['Amount Match', 'Amount', 'Minimum Amount', 'Maximum Amount'].includes(field))
    return true
  })
  return <Sheet open={open} onClose={onClose} title="Exclusion Rule" ariaLabel="Exclusion Rule" panelClassName="w-full max-w-md bg-[var(--color-bg-primary)] desktop:rounded-xl shadow-lg border border-[var(--color-border)] desktop:overflow-hidden">
    <div className="hidden desktop:flex items-center justify-between p-4 border-b border-[var(--color-border)]">
      <h2 className="text-[18px] font-semibold leading-[1.2] text-[var(--color-text-primary)]">Exclusion Rule</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"><X size={20} /></button>
    </div>
    <div className="p-4 flex flex-col gap-4">
    {existing && validateExclusionDraft(existing,sources).length > 0 && <p role="alert">Needs correction. Choose valid criteria before saving.</p>}
    <label className="text-[12px] font-medium leading-none text-text-secondary flex flex-col gap-2">Rule Name<input className={inputClass} value={name} onChange={e=>{setName(e.target.value);touch('Rule Name')}} onBlur={()=>touch('Rule Name')} aria-describedby="exclusion-errors" /></label>
    {select('Card or Account',scope,setScope,[{value:'',label:'Choose Card or Account'},{value:'all',label:'All Cards/Accounts'},...Object.values(sources).map(s=>({value:s.id,label:s.name}))])}
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-medium leading-none text-text-secondary">Description Match</span>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-[180px_minmax(0,1fr)] gap-2">
        {select('Description Match',operator,v=>setOperator(v as typeof operator),[{value:'exact',label:'Exactly Matches'},{value:'contains',label:'Contains'},{value:'starts-with',label:'Starts with'}],false)}
        <input aria-label="Bank Description" className={inputClass} value={text} onChange={e=>{setText(e.target.value);touch('Bank Description')}} onBlur={()=>touch('Bank Description')} aria-describedby="exclusion-errors" />
      </div>
    </div>
    {select('Behavior',behavior,v=>setBehavior(v as typeof behavior),[{value:'review',label:'Review Matches'},{value:'automatic',label:'Automatically Exclude'}])}
    <details open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)} className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-[13px] text-text-secondary">More Filters</summary>
      <div className="mt-3 grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
        {select('Money Direction',direction,v=>setDirection(v as typeof direction),[{value:'in',label:'Money in'},{value:'out',label:'Money out'},{value:'either',label:'Either'}])}
        {select('Amount Match',amountOperator,v=>setAmountOperator(v as typeof amountOperator),[{value:'any',label:'Any Amount'},{value:'exact',label:'Exact Amount'},{value:'between',label:'Between Amounts'}])}
        {amountOperator !== 'any' && <label className="text-[12px] font-medium leading-none text-text-secondary flex flex-col gap-2">{amountOperator === 'exact' ? 'Amount' : 'Minimum Amount'}<input className={inputClass} inputMode="decimal" value={amountText} onChange={e=>{setAmountText(e.target.value);touch(amountOperator === 'exact' ? 'Amount' : 'Minimum Amount')}} onBlur={()=>touch(amountOperator === 'exact' ? 'Amount' : 'Minimum Amount')} aria-describedby="exclusion-errors" /></label>}
        {amountOperator === 'between' && <label className="text-[12px] font-medium leading-none text-text-secondary flex flex-col gap-2">Maximum Amount<input className={inputClass} inputMode="decimal" value={maxAmountText} onChange={e=>{setMaxAmountText(e.target.value);touch('Maximum Amount')}} onBlur={()=>touch('Maximum Amount')} aria-describedby="exclusion-errors" /></label>}
      </div>
    </details>
    {(visibleErrors.length > 0 || saveError) && <div id="exclusion-errors">{[...new Set([...visibleErrors, ...(saveError ? [saveError] : [])])].map(error=><p key={error} role="alert" className="text-[13px] text-error">{error}</p>)}</div>}
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-[13px]">Preview Matches <span className="text-text-secondary">{preview ? `(${preview.count})` : '(unavailable)'}</span></summary>
      <div className="mt-3">{preview ? <ExclusionRulePreview preview={preview} criteriaKey={JSON.stringify(draft) + amountText + maxAmountText} /> : <p className="text-[13px] text-text-secondary">Enter valid criteria to preview matching imports.</p>}</div>
    </details>
    {unavailableRecords > 0 && <p className="text-[13px] text-text-secondary">{unavailableRecords} saved imports have unavailable source information and are outside this preview.</p>}
    <label className="flex items-center gap-2 text-[13px] text-text-secondary"><Checkbox checked={applyPending} onChange={setApplyPending} ariaLabel="Also Apply to Pending" />Also Apply to Pending</label>
    {applyPending && (matchingCount === null ? <p className="text-[13px] text-text-secondary">Pending count unavailable until this rule is valid.</p> : <p className="text-[13px] text-text-secondary">{matchingCount} pending {matchingCount === 1 ? 'import matches' : 'imports match'} the enabled rule set.</p>)}
    {applyPending && <details className="text-[12px] text-text-secondary"><summary className="cursor-pointer">Pending application details</summary><p className="mt-2 leading-relaxed">This reapplies all current enabled rules, including this rule if enabled, to {checked.length} eligible pending imports. Existing holds may clear. Included overrides stay included. Possible duplicates remain for review.</p></details>}
    <details className="text-[12px] text-text-secondary"><summary className="cursor-pointer">How It Works</summary><p className="mt-2 leading-relaxed">Review holds matches for your decision and keeps them out of Accept All. Automatic exclusion keeps matches in Excluded Imports, where you can restore them. Possible duplicates still need review. Already accepted transactions stay unchanged.</p></details>
    <div className="pt-3 border-t border-[var(--color-border)]"><button type="button" className="w-full min-h-11 py-3 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity" onClick={save}>Save Rule</button></div>
    </div>
  </Sheet>
}
