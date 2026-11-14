import { useState } from 'react'
import type { ExclusionPreview } from '../../types/exclusionRules'
import { useTriageStore } from '../../store/useTriageStore'
import { formatMoney } from '../planner/format'

export function ExclusionRulePreview({ preview, criteriaKey = '' }: { preview: ExclusionPreview; criteriaKey?: string }) {
  const signature = criteriaKey + JSON.stringify(preview)
  const [pagination, setPagination] = useState({ signature, limit: 20 })
  if (pagination.signature !== signature) setPagination({ signature, limit: 20 })
  const limit = pagination.signature === signature ? pagination.limit : 20
  const sources = useTriageStore(s => s.importSources)
  return <section aria-label="Rule preview" className="rounded-md border border-border p-3 text-[13px] flex flex-col gap-2">
    <p className="font-medium">{preview.count} matching {preview.count === 1 ? 'import' : 'imports'}</p>
    <p>Money in: {formatMoney(preview.moneyInCents / 100)} · Money out: {formatMoney(preview.moneyOutCents / 100)}</p>
    <p>{preview.pendingCount} pending · {preview.acceptedCount} accepted · {preview.ignoredCount} ignored</p>
    <p className="text-text-secondary">Preview covers saved original bank imports, including accepted and ignored records. Duplicate aliases are not counted.</p>
    {preview.count === 0 && <p>No matching imports.</p>}
    {preview.legacyUnavailableCount > 0 && <p className="text-text-secondary">{preview.legacyUnavailableCount} legacy pending imports unavailable for source and original-bank preview.</p>}
    <div className="max-h-48 overflow-y-auto divide-y divide-border">
      {preview.rows.slice(0, limit).map(row => <div key={row.recordId} className="py-2">
        <p className="break-words font-medium">{row.description}</p>
        <p className="text-text-secondary">{row.date} · {sources[row.sourceId]?.name ?? 'Source unavailable'} · {row.decision}</p>
        {row.identityNeedsReview && <span className="text-warning">Identity needs review</span>}
        {row.overridden && <span className="text-text-secondary"> Included override</span>}
      </div>)}
    </div>
    {limit < preview.rows.length && <button type="button" className="min-h-11 text-accent" onClick={() => setPagination({ signature, limit: limit + 20 })}>Show 20 more</button>}
  </section>
}
