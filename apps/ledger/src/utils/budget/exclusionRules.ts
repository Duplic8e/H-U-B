import type { ExclusionMatch, ExclusionPreview, ExclusionRule, ExclusionRuleDraft } from '../../types/exclusionRules'
import type { ImportRecord, ImportSource } from '../../types/importHistory'
import type { TriageTransaction } from '../../types/triage'

export const cashMovementCents = (row: Pick<TriageTransaction, 'type' | 'amount'>) =>
  Math.round((row.type === 'income' ? row.amount : -row.amount) * 100)

// Persisted drafts can have malformed runtime values despite their TS contract.
export function validateExclusionDraft(draft: ExclusionRuleDraft,
  sources: Record<string, ImportSource>): string[] {
  const errors: string[] = []
  if (typeof draft?.name !== 'string' || !draft.name.trim()) errors.push('Enter a rule name')
  if (typeof draft?.description?.value !== 'string' || !draft.description.value.trim()) errors.push('Enter a description pattern')
  if (draft?.sourceId !== null && (typeof draft?.sourceId !== 'string' || !Object.hasOwn(sources, draft.sourceId))) {
    errors.push('Choose an available card or account')
  }
  if (!['exact', 'contains', 'starts-with'].includes(draft?.description?.operator)) errors.push('Choose a valid description operator')
  if (!['in', 'out', 'either'].includes(draft?.direction)) errors.push('Choose a valid money direction')
  if (!['review', 'automatic'].includes(draft?.behavior)) errors.push('Choose a valid rule behavior')
  const cents = (n: number) => Number.isSafeInteger(n) && n >= 0
  const amount = draft?.amount
  if (!amount || !['any', 'exact', 'between'].includes(amount.operator)) errors.push('Choose a valid amount operator')
  if (amount?.operator === 'exact' && !cents(amount.cents)) errors.push('Enter a valid amount')
  if (amount?.operator === 'between' && (!cents(amount.minCents) ||
    !cents(amount.maxCents) || amount.minCents > amount.maxCents)) errors.push('Enter a valid amount range')
  return errors
}

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

export function matchesExclusionRule(rule: ExclusionRule, original: TriageTransaction,
  sourceId: string): boolean {
  if (typeof sourceId !== 'string' || !sourceId.trim() || rule?.enabled !== true) return false
  if (typeof rule.id !== 'string' || !rule.id.trim() || !Number.isSafeInteger(rule.revision) || rule.revision < 1) return false
  // Only the supplied source can match here. Store actions separately validate
  // that a selected source still exists before saving or applying a draft.
  if (validateExclusionDraft(rule, { [sourceId]: { id: sourceId, name: sourceId } }).length) return false
  if (rule.sourceId !== null && rule.sourceId !== sourceId) return false
  if (typeof original?.description !== 'string' || typeof original.amount !== 'number' ||
    !['income', 'expense'].includes(original.type)) return false
  const movement = cashMovementCents(original)
  if (!Number.isSafeInteger(movement)) return false
  if (rule.direction === 'in' && movement <= 0) return false
  if (rule.direction === 'out' && movement >= 0) return false
  const text = normalize(original.description)
  const pattern = normalize(rule.description.value)
  const textMatches = rule.description.operator === 'exact' ? text === pattern :
    rule.description.operator === 'contains' ? text.includes(pattern) : text.startsWith(pattern)
  if (!textMatches) return false
  const amount = Math.abs(movement)
  return rule.amount.operator === 'any' || (rule.amount.operator === 'exact'
    ? amount === rule.amount.cents : amount >= rule.amount.minCents && amount <= rule.amount.maxCents)
}

export function evaluateExclusionRules(rules: ExclusionRule[], original: TriageTransaction,
  sourceId: string): ExclusionMatch[] {
  return rules.filter(rule => matchesExclusionRule(rule, original, sourceId))
    .sort((a, b) => compareIds(a.id, b.id))
    .map(({ id, revision, name, behavior }) => ({ ruleId: id, revision, name, behavior }))
}

export function previewExclusionRule(draft: ExclusionRuleDraft, records: ImportRecord[],
  pending: TriageTransaction[]): ExclusionPreview {
  const rule: ExclusionRule = { ...draft, id: 'preview', revision: 1, enabled: true }
  const pendingByRecord = new Map(pending.filter(tx => tx.importRecordId)
    .map(tx => [tx.importRecordId, tx]))
  const rows: ExclusionPreview['rows'] = records
    .filter(record => record.decision !== 'duplicate' && matchesExclusionRule(rule, record.original, record.sourceId))
    .map(record => ({
      recordId: record.id, sourceId: record.sourceId,
      description: record.original.description, date: record.original.date,
      movementCents: cashMovementCents(record.original),
      decision: record.decision as ExclusionPreview['rows'][number]['decision'],
      identityNeedsReview: record.decision === 'pending' && !!pendingByRecord.get(record.id)?.duplicate,
      overridden: record.exclusionOverride === 'include',
    }))
    .sort((a, b) => compareIds(b.date, a.date) || compareIds(a.recordId, b.recordId))
  const summary = rows.reduce((a, row) => ({
    count: a.count + 1,
    moneyInCents: a.moneyInCents + Math.max(0, row.movementCents),
    moneyOutCents: a.moneyOutCents + Math.max(0, -row.movementCents),
    pendingCount: a.pendingCount + Number(row.decision === 'pending'),
    acceptedCount: a.acceptedCount + Number(row.decision === 'accepted'),
    ignoredCount: a.ignoredCount + Number(row.decision === 'ignored'),
    eligiblePendingCount: a.eligiblePendingCount + Number(row.decision === 'pending' && !row.overridden),
  }), { count: 0, moneyInCents: 0, moneyOutCents: 0, pendingCount: 0,
    acceptedCount: 0, ignoredCount: 0, eligiblePendingCount: 0 })
  return { rows, ...summary, legacyUnavailableCount: pending.filter(tx => !tx.importRecordId).length }
}
