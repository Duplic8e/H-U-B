import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTriageStore } from '../../store/useTriageStore'
import { captureTriageUndo } from '../../utils/budget/triageUndo'

export const EXCLUDED_IMPORTS_ID = 'excluded-imports'

export function ExcludedImportsWidget({ focusRequest = 0 }: { focusRequest?: number }) {
  const records = useTriageStore(state => state.importRecords)
  const sources = useTriageStore(state => state.importSources)
  const [limit, setLimit] = useState(50)
  const [announcement, setAnnouncement] = useState('')
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const excluded = Object.values(records).filter(record => record.decision === 'ignored')
    .sort((a, b) => b.original.date.localeCompare(a.original.date) || a.id.localeCompare(b.id))
  const hasExcluded = excluded.length > 0
  useEffect(() => {
    if (!focusRequest || !detailsRef.current) return
    detailsRef.current.open = true
    summaryRef.current?.focus()
    detailsRef.current.scrollIntoView?.({ block: 'nearest' })
  }, [focusRequest, hasExcluded])
  const restore = (id: string) => {
    const offer = captureTriageUndo({pendingIds:[id], recordIds:[id]})
    useTriageStore.getState().restoreImportRecord(id)
    offer('Restored 1 transaction to review')
    setAnnouncement(`${records[id].original.description} restored to review`)
    requestAnimationFrame(() => document.getElementById(`import-review-${id}`)?.focus())
  }
  const restoreAll = () => {
    const ids = excluded.map(record => record.id)
    const offer = captureTriageUndo({ pendingIds: ids, recordIds: ids })
    const restored = useTriageStore.getState().restoreAllExcluded()
    if (!restored.length) return
    offer(`Restored ${restored.length} transaction${restored.length === 1 ? '' : 's'} to review`)
    setAnnouncement(`${restored.length} transactions restored to review`)
  }
  return <>
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    {hasExcluded && <details id={EXCLUDED_IMPORTS_ID} ref={detailsRef} className="group min-w-0 rounded-lg border border-border bg-bg-secondary p-3">
      <summary ref={summaryRef} tabIndex={0} className="min-h-11 flex items-center gap-2 list-none cursor-pointer text-[14px] font-medium text-text-primary"><ChevronRight size={16} aria-hidden="true" className="transition-transform group-open:rotate-90" />Excluded imports ({excluded.length})</summary>
      <p className="text-[13px] text-text-secondary mb-3">Excluded and ignored bank entries stay in your import history. Restore sends an entry back to review.</p>
      <button onClick={restoreAll} className="min-h-11 px-4 mb-3 rounded-md bg-accent text-bg-primary text-[14px] font-semibold">Restore All ({excluded.length})</button>
      <ul className="space-y-2 min-w-0">
        {excluded.slice(0, limit).map(record => <li key={record.id} className="min-w-0 rounded-md border border-border p-3 flex flex-col gap-2">
          <div className="min-w-0 break-words">
            <p className="text-[14px] font-medium text-text-primary">{record.original.description}</p>
            <p className="text-[13px] text-text-secondary">{sources[record.sourceId]?.name ?? 'Source information unavailable'} · {record.original.date} · {(record.original.type === 'income' ? record.original.amount : -record.original.amount).toLocaleString('en-CA', {style:'currency',currency:'CAD'})}</p>
            <p className="text-[13px] text-text-secondary">{record.ignoreReason === 'rule' ? `Rule exclusion: ${record.exclusionMatches?.map(match => match.name).join(', ') ?? 'Saved rule'}` : record.ignoreReason === 'card-payment' ? 'Card payment' : 'Ignored once'}</p>
          </div>
          <button aria-label={`Restore ${record.original.description} to review`} onClick={() => restore(record.id)} className="min-h-11 px-3 self-start rounded-md border border-border text-accent text-[13px]">Restore to review</button>
        </li>)}
      </ul>
      {excluded.length > limit && <button onClick={() => setLimit(limit + 50)} className="min-h-11 px-3 text-accent">Show 50 more</button>}
    </details>}
  </>
}
