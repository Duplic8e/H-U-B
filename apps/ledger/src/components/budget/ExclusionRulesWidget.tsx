import { useState } from 'react'
import { Plus } from 'lucide-react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ExclusionRuleSheet } from './ExclusionRuleSheet'
import { useTriageStore } from '../../store/useTriageStore'
import { validateExclusionDraft } from '../../utils/budget/exclusionRules'
import { captureTriageUndo } from '../../utils/budget/triageUndo'
import { formatMoney } from '../planner/format'
import { ThemedSelect } from '../ui/ThemedSelect'
import type { ExclusionRuleDraft } from '../../types/exclusionRules'

export function ExclusionRulesWidget() {
  const rules = useTriageStore(s=>s.exclusionRules), sources = useTriageStore(s=>s.importSources)
  const [editor, setEditor] = useState<{ruleId?:string;initialDraft?:ExclusionRuleDraft} | null>(null)
  const [newDescription, setNewDescription] = useState('')
  const [newSource, setNewSource] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const lifecycle = (id: string, action: 'toggle' | 'delete') => {
    const offer = captureTriageUndo({ruleIds:[id]})
    try {
      if (action === 'delete') useTriageStore.getState().deleteExclusionRule(id)
      else useTriageStore.getState().setExclusionRuleEnabled(id,!rules[id].enabled)
      offer(action === 'delete' ? 'Delete exclusion rule' : 'Change exclusion rule status')
      setDeleting(null); setError('')
    } catch (e) {setError(e instanceof Error ? e.message : 'Unable to update rule')}
  }
  return <WidgetWrapper title={`Exclusion Rules (${Object.keys(rules).length})`} className="max-md:!bg-transparent max-md:!border-0 max-md:!shadow-none max-md:!p-0">
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-wrap max-md:flex-col gap-2">
        <label htmlFor="exclusion-description-input" className="sr-only">Exclusion Description Match</label>
        <input id="exclusion-description-input" type="text" placeholder="Description Match (e.g. TRANSFER TO SAVINGS)" value={newDescription} onChange={e=>setNewDescription(e.target.value)} className="flex-1 min-w-[140px] max-md:min-h-11 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-3 py-1.5 text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]" />
        <ThemedSelect ariaLabel="Exclusion Card or Account" value={newSource} onChange={setNewSource} className="w-full sm:w-48" options={[{value:'',label:'Select Account...'},{value:'all',label:'All Cards/Accounts'},...Object.values(sources).map(source=>({value:source.id,label:source.name}))]} />
        <button type="button" className="min-h-11 px-3 py-1.5 max-md:gap-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md hover:opacity-90 transition-opacity flex items-center justify-center" onClick={()=>setEditor({initialDraft:{name:newDescription.trim(),sourceId:newSource==='all'?null:newSource,description:{operator:'exact',value:newDescription.trim()},direction:'either',amount:{operator:'any'},behavior:'review'}})} aria-label="Add exclusion rule"><Plus size={16} aria-hidden="true" /><span className="md:hidden text-[14px] font-semibold">Add Rule</span></button>
      </div>
      {error && <p role="alert" className="text-error">{error}</p>}
      <div className="flex flex-col max-h-[240px] desktop:max-h-[300px] max-md:max-h-none overflow-y-auto border border-[var(--color-border)] rounded-md">
        {Object.keys(rules).length === 0 && <div className="p-4 text-center text-[13px] text-[var(--color-text-secondary)]">No rules created yet.</div>}
        {Object.entries(rules).map(([id,rule])=>{
          const invalid = !rule || rule.id!==id || !Number.isSafeInteger(rule.revision) || rule.revision<1 || validateExclusionDraft(rule,sources).length>0
          const name = typeof rule?.name === 'string' ? rule.name : 'Invalid rule'
          const amount = rule?.amount
          const condition = invalid ? 'Needs correction' : `${rule.description.operator === 'exact' ? 'Exactly matches' : rule.description.operator === 'contains' ? 'Contains' : 'Starts with'}: ${rule.description.value} · ${rule.direction === 'in' ? 'Money in' : rule.direction === 'out' ? 'Money out' : 'Either direction'} · ${amount.operator === 'any' ? 'Any amount' : amount.operator === 'exact' ? formatMoney(amount.cents / 100) : `${formatMoney(amount.minCents / 100)} to ${formatMoney(amount.maxCents / 100)}`}`
          return <div key={id} className="p-3 border-b border-[var(--color-border)] last:border-0 bg-[var(--color-bg-secondary)] flex flex-col gap-1">
            <p className="font-medium text-[14px] break-words">{name}</p>
            <p className="text-[13px] text-text-secondary">{rule?.sourceId === null ? 'All cards/accounts' : sources[rule?.sourceId]?.name ?? 'Source unavailable'}</p>
            <p className="text-[13px] break-words">{condition}</p>
            <p className="text-[13px]">{rule?.behavior === 'automatic' ? 'Automatic' : rule?.behavior === 'review' ? 'Review' : 'Behavior unavailable'} · <span>{rule?.enabled === true ? 'Active' : 'Paused'}</span></p>
            <div className="flex flex-wrap gap-2 text-[13px]">
              <button type="button" className="min-h-11 px-3 rounded-md border border-border" aria-label={`Edit ${name}`} onClick={()=>setEditor({ruleId:id})}>Edit</button>
              <button type="button" className="min-h-11 px-3 rounded-md border border-border disabled:opacity-50" aria-label={`${rule?.enabled ? 'Pause' : 'Resume'} ${name}`} disabled={!rule?.enabled && invalid} onClick={()=>lifecycle(id,'toggle')}>{rule?.enabled ? 'Pause' : 'Resume'}</button>
              <button type="button" className="min-h-11 px-3 rounded-md border border-border text-error" aria-label={`Delete ${name}`} onClick={()=>setDeleting(id)}>Delete</button>
            </div>
          </div>
        })}
      </div>
    </div>
    {editor && <ExclusionRuleSheet open onClose={()=>setEditor(null)} ruleId={editor.ruleId} initialDraft={editor.initialDraft} />}
    <ConfirmDialog open={deleting!==null} title="Delete Exclusion Rule" message="Deleting this rule stops future matches. Previous exclusions remain available to restore." confirmLabel="Delete Rule" tone="danger" onCancel={()=>setDeleting(null)} onConfirm={()=>deleting && lifecycle(deleting,'delete')} />
  </WidgetWrapper>
}
