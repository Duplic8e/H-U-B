export type ExclusionRuleDraft = {
  name: string
  sourceId: string | null
  description: { operator: 'exact' | 'contains' | 'starts-with'; value: string }
  direction: 'in' | 'out' | 'either'
  amount: { operator: 'any' } | { operator: 'exact'; cents: number } |
    { operator: 'between'; minCents: number; maxCents: number }
  behavior: 'review' | 'automatic'
}

export type ExclusionRule = ExclusionRuleDraft & {
  id: string
  revision: number
  enabled: boolean
}

export type ExclusionMatch = {
  ruleId: string
  revision: number
  name: string
  behavior: 'review' | 'automatic'
}

export type ExclusionPreview = {
  rows: Array<{
    recordId: string; sourceId: string; description: string; date: string
    movementCents: number; decision: 'pending' | 'accepted' | 'ignored'
    identityNeedsReview: boolean; overridden: boolean
  }>
  count: number
  moneyInCents: number
  moneyOutCents: number
  pendingCount: number
  acceptedCount: number
  ignoredCount: number
  eligiblePendingCount: number
  legacyUnavailableCount: number
}
