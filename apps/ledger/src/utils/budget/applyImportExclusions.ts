import type { ExclusionRule } from '../../types/exclusionRules'
import type { ImportRecord } from '../../types/importHistory'
import type { TriageTransaction } from '../../types/triage'
import { evaluateExclusionRules } from './exclusionRules'

export function applyImportExclusions(pending: TriageTransaction[], existing: Record<string, ImportRecord>, rules: ExclusionRule[]) {
  const records = { ...existing }, kept: TriageTransaction[] = [], excludedIds: string[] = []
  for (const tx of pending) {
    const record = tx.importRecordId ? records[tx.importRecordId] : undefined
    if (!record || record.exclusionOverride === 'include') {
      kept.push({ ...tx, exclusionMatches: undefined })
      continue
    }
    const matches = evaluateExclusionRules(rules, record.original, record.sourceId)
    const automatic = matches.length > 0 && !tx.duplicate && matches.every(match => match.behavior === 'automatic')
    records[record.id] = { ...record, exclusionMatches: matches.length ? matches : undefined,
      decision: automatic ? 'ignored' : 'pending', ignoreReason: automatic ? 'rule' : undefined }
    if (automatic) excludedIds.push(record.id)
    else kept.push({ ...tx, exclusionMatches: matches.length ? matches : undefined })
  }
  return { pending: kept, records, excludedIds }
}
