import type { TriageTransaction } from './triage'
import type { ExclusionMatch } from './exclusionRules'

export interface ImportSource {
  id: string
  name: string
  bankKey?: string
}

export interface ImportRecord {
  id: string
  sourceId: string
  original: TriageTransaction
  decision: 'pending' | 'accepted' | 'ignored' | 'duplicate'
  matchedRecordId?: string
  matchedTransactionId?: string
  exclusionMatches?: ExclusionMatch[]
  exclusionOverride?: 'include'
  ignoreReason?: 'rule' | 'card-payment' | 'manual'
}

export interface ImportDay {
  sourceId: string
  date: string
  signature: string
  recordIds: string[]
}

export interface ImportReport {
  excludedIds?: string[]
  /** Added straight to the budget because a learned rule matched. */
  autoAddedIds?: string[]
  addedIds: string[]
  skippedIds: string[]
  changedDays: Array<{ sourceId: string; date: string; missingCount: number }>
}
