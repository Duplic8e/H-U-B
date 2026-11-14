import { useState } from 'react'
import { useTriageStore } from '../../store/useTriageStore'
import { captureTriageUndo } from '../../utils/budget/triageUndo'

export function ImportSummary({ onViewExcluded }: { onViewExcluded?: () => void }) {
  const report = useTriageStore(state => state.lastImport)
  const records = useTriageStore(state => state.importRecords)
  const sources = useTriageStore(state => state.importSources)
  const restore = useTriageStore(state => state.restoreImportRecord)
  const [limit, setLimit] = useState(50)
  if (!report) return null
  const skipped = report.skippedIds.map(id => records[id]).filter(Boolean)
  const excludedIds = report.excludedIds ?? []
  const autoAdded = report.autoAddedIds?.length ?? 0
  const reviewCount = report.addedIds.filter(id => !excludedIds.includes(id)).length - autoAdded
  const restoreWithUndo = (id: string) => {
    const offer = captureTriageUndo({pendingIds:[id],recordIds:[id]})
    restore(id)
    offer('Restored 1 transaction to review')
  }
  return <div className="min-w-0 rounded-lg border border-border bg-bg-secondary p-3 text-[14px]">
    <p role="status" aria-live="polite">
      {skipped.length} previously handled transaction{skipped.length === 1 ? '' : 's'} skipped.
      {autoAdded > 0 && <> {autoAdded} filed automatically from stores you have categorized.</>}
      {' '}{reviewCount} new transaction{reviewCount === 1 ? '' : 's'} sent to review.
      {excludedIds.length > 0 && <> {excludedIds.length} excluded by your rules.</>}
    </p>
    {excludedIds.length > 0 && onViewExcluded && <button onClick={onViewExcluded} className="min-h-11 px-3 mt-2 rounded-md border border-border text-accent">View excluded imports</button>}
    {report.changedDays.map(day => <p key={`${day.sourceId}:${day.date}`} className="mt-2 text-[13px] text-text-secondary">
      {sources[day.sourceId]?.name}, {day.date}: {day.missingCount} previously seen charge{day.missingCount === 1 ? '' : 's'} absent from this file. Your saved transactions were kept.
    </p>)}
    {skipped.length > 0 && <details className="mt-2">
      <summary className="min-h-11 flex items-center cursor-pointer text-accent">View skipped ({skipped.length})</summary>
      <ul className="max-h-72 overflow-y-auto space-y-2">
        {skipped.slice(0, limit).map((record, index) => <li key={`${record.id}:${index}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2">
          <div className="min-w-0 break-words">
            <p>{record.original.description} · ${record.original.amount.toFixed(2)}</p>
            <p className="text-[12px] text-text-secondary">{sources[record.sourceId]?.name} · {record.original.date} · {record.decision === 'ignored' ? 'Ignored' : record.decision === 'pending' ? 'Awaiting review' : record.decision === 'duplicate' ? 'Matched to an existing charge' : 'Accepted'}</p>
          </div>
          {record.decision === 'ignored' && <button onClick={() => restoreWithUndo(record.id)} className="min-h-11 px-3 text-accent border border-border rounded-md">Review again</button>}
        </li>)}
      </ul>
      {skipped.length > limit && <button onClick={() => setLimit(limit + 50)} className="min-h-11 text-accent">Show 50 more</button>}
    </details>}
  </div>
}
