import type { ExclusionRule, ExclusionRuleDraft } from '../../types/exclusionRules'
import type { ImportRecord } from '../../types/importHistory'
import type { TriageTransaction } from '../../types/triage'
import { cashMovementCents, evaluateExclusionRules, matchesExclusionRule, previewExclusionRule, validateExclusionDraft } from './exclusionRules'

const sources = { a: { id: 'a', name: 'Card A' } }
const draft: ExclusionRuleDraft = {
  name: 'Payments', sourceId: 'a', description: { operator: 'exact', value: 'PAYMENT' },
  direction: 'in', amount: { operator: 'any' }, behavior: 'review',
}
const row: TriageTransaction = {
  id: 'a', date: '2026-06-10', description: 'PAYMENT', amount: 50, type: 'income',
}
const rule: ExclusionRule = { ...draft, id: 'r', revision: 1, enabled: true }

describe('exclusion matching', () => {
  it('matches original text with precise scope and normalized whitespace', () => {
    const original = { ...row, description: '  PAYMENT   THANK YOU / MERCI ' }
    const starts = { ...rule, description: { operator: 'starts-with' as const, value: 'payment thank you' } }
    expect(matchesExclusionRule(starts, original, 'a')).toBe(true)
    expect(matchesExclusionRule(starts, original, 'b')).toBe(false)
    expect(matchesExclusionRule({ ...starts, description: { operator: 'exact', value: 'payment thank you' } }, original, 'a')).toBe(false)
  })

  it('requires contiguous contains phrases and the correct starts-with position', () => {
    const original = { ...row, description: 'BANK PAYMENT THANK YOU' }
    expect(matchesExclusionRule({ ...rule, description: { operator: 'contains', value: 'payment thank' } }, original, 'a')).toBe(true)
    expect(matchesExclusionRule({ ...rule, description: { operator: 'contains', value: 'bank thank' } }, original, 'a')).toBe(false)
    expect(matchesExclusionRule({ ...rule, description: { operator: 'starts-with', value: 'payment' } }, original, 'a')).toBe(false)
  })

  it('preserves punctuation and accents', () => {
    const original = { ...row, description: 'CAFÉ / PAYMENT' }
    expect(matchesExclusionRule({ ...rule, description: { operator: 'exact', value: 'café / payment' } }, original, 'a')).toBe(true)
    for (const value of ['cafe / payment', 'café payment']) {
      expect(matchesExclusionRule({ ...rule, description: { operator: 'exact', value } }, original, 'a')).toBe(false)
    }
  })

  it('only matches enabled rules and explicit global scope', () => {
    expect(matchesExclusionRule({ ...rule, enabled: false }, row, 'a')).toBe(false)
    expect(matchesExclusionRule({ ...rule, sourceId: null }, row, 'b')).toBe(true)
    expect(matchesExclusionRule({ ...rule, sourceId: null }, row, '')).toBe(false)
  })

  it('uses signed cash movement for refunds and zero direction', () => {
    expect(matchesExclusionRule(rule, { ...row, type: 'expense', amount: -50 }, 'a')).toBe(true)
    expect(matchesExclusionRule({ ...rule, direction: 'out' }, { ...row, type: 'expense' }, 'a')).toBe(true)
    expect(matchesExclusionRule(rule, { ...row, amount: 0 }, 'a')).toBe(false)
    expect(matchesExclusionRule({ ...rule, direction: 'out' }, { ...row, amount: 0 }, 'a')).toBe(false)
    expect(matchesExclusionRule({ ...rule, direction: 'either' }, { ...row, amount: 0 }, 'a')).toBe(true)
  })

  it('compares absolute rounded cents with inclusive boundaries', () => {
    const exact = { ...rule, amount: { operator: 'exact' as const, cents: 1235 } }
    expect(matchesExclusionRule(exact, { ...row, amount: 12.345 }, 'a')).toBe(true)
    expect(matchesExclusionRule(exact, { ...row, amount: 12.34 }, 'a')).toBe(false)
    const range = { ...rule, amount: { operator: 'between' as const, minCents: 100, maxCents: 200 } }
    for (const amount of [1, 2]) expect(matchesExclusionRule(range, { ...row, amount }, 'a')).toBe(true)
    for (const amount of [0.99, 2.01, Infinity, NaN]) expect(matchesExclusionRule(range, { ...row, amount }, 'a')).toBe(false)
  })

  it.each([null, { ...rule, description: null }, { ...rule, amount: null },
    { ...rule, description: { operator: 'regex', value: 'PAYMENT' } },
    { ...rule, amount: { operator: 'unknown', minCents: 0, maxCents: 10000 } },
    { ...rule, direction: 'unknown' }, { ...rule, behavior: 'unknown' },
    { ...rule, sourceId: undefined }, { ...rule, enabled: 'yes' },
    { ...rule, amount: { operator: 'exact', cents: NaN } },
    { ...rule, amount: { operator: 'between', minCents: 6000, maxCents: 5000 } },
  ])('makes malformed persisted rules inert: %j', invalid => {
    expect(matchesExclusionRule(invalid as unknown as ExclusionRule, row, 'a')).toBe(false)
  })

  it('returns every match sorted by stable ID without mutating rules', () => {
    const rules = [{ ...rule, id: 'z', behavior: 'automatic' as const }, { ...rule, id: 'a' }, { ...rule, id: 'x', enabled: false }]
    expect(evaluateExclusionRules(rules, row, 'a')).toEqual([
      { ruleId: 'a', revision: 1, name: 'Payments', behavior: 'review' },
      { ruleId: 'z', revision: 1, name: 'Payments', behavior: 'automatic' },
    ])
    expect(rules.map(r => r.id)).toEqual(['z', 'a', 'x'])
  })
})

describe('exclusion preview', () => {
  const coffeeDraft: ExclusionRuleDraft = { ...draft, description: { operator: 'exact', value: 'COFFEE' }, direction: 'either' }
  const coffee = { ...row, description: 'COFFEE', amount: 5, type: 'expense' as const }
  const record = (id: string, patch: Partial<ImportRecord> = {}): ImportRecord => ({
    id, sourceId: 'a', original: { ...coffee, id }, decision: 'pending', ...patch,
  })

  it('counts distinct occurrences, excludes aliases and uses originals despite pending edits', () => {
    const records = [record('b'), record('a'), record('alias', { decision: 'duplicate', matchedRecordId: 'a' })]
    const pending = [{ ...coffee, id: 'edited', importRecordId: 'a', description: 'Edited merchant', amount: 999 }]
    const before = JSON.stringify({ records, pending })
    const preview = previewExclusionRule(coffeeDraft, records, pending)
    expect(preview.count).toBe(2)
    expect(preview.moneyOutCents).toBe(1000)
    expect(preview.rows.map(r => r.recordId)).toEqual(['a', 'b'])
    expect(preview.rows[0].description).toBe('COFFEE')
    expect(JSON.stringify({ records, pending })).toBe(before)
  })

  it('separates directional totals and accepted, ignored and eligible pending counts', () => {
    const records = [record('accepted', { decision: 'accepted' }), record('ignored', { decision: 'ignored', original: { ...coffee, amount: -5 } }),
      record('include', { exclusionOverride: 'include' }), record('possible'), record('plain')]
    const preview = previewExclusionRule(coffeeDraft, records, [{ ...coffee, importRecordId: 'possible', duplicate: 'possible' }])
    expect(preview).toMatchObject({ count: 5, moneyInCents: 500, moneyOutCents: 2000,
      acceptedCount: 1, ignoredCount: 1, pendingCount: 3, eligiblePendingCount: 2 })
    expect(preview.rows.find(r => r.recordId === 'possible')).toMatchObject({ identityNeedsReview: true, overridden: false })
    expect(preview.rows.find(r => r.recordId === 'include')).toMatchObject({ identityNeedsReview: false, overridden: true })
    expect(preview.rows.find(r => r.recordId === 'accepted')).toMatchObject({ identityNeedsReview: false, decision: 'accepted' })
  })

  it('uses current pending duplicate state only for pending ambiguity', () => {
    const records = [record('cleared', { original: { ...coffee, duplicate: 'possible' } }), record('accepted', { decision: 'accepted' })]
    const pending = [{ ...coffee, importRecordId: 'cleared' }, { ...coffee, importRecordId: 'accepted', duplicate: 'possible' as const }]
    expect(previewExclusionRule(coffeeDraft, records, pending).rows.every(r => !r.identityNeedsReview)).toBe(true)
  })

  it('sorts dates descending then IDs and explicitly counts unavailable legacy rows', () => {
    const records = [record('old', { original: { ...coffee, date: '2026-06-09' } }), record('new'), record('other', { sourceId: 'b' }), record('unscoped', { sourceId: '' })]
    const preview = previewExclusionRule(coffeeDraft, records, [coffee, { ...coffee, id: 'legacy2' }, { ...coffee, importRecordId: 'new' }])
    expect(preview.rows.map(r => r.recordId)).toEqual(['new', 'old'])
    expect(preview.legacyUnavailableCount).toBe(2)
  })

  it('returns no matches for invalid drafts', () => {
    expect(previewExclusionRule({ ...coffeeDraft, description: { operator: 'exact', value: ' ' } }, [record('a')], [coffee]))
      .toMatchObject({ count: 0, rows: [], legacyUnavailableCount: 1 })
  })
})

describe('exclusion rule money and validation', () => {
  it('distinguishes refunds from purchases and rejects inverted cent ranges', () => {
    expect(cashMovementCents({ type: 'expense', amount: -12.5 })).toBe(1250)
    expect(cashMovementCents({ type: 'expense', amount: 12.5 })).toBe(-1250)
    expect(cashMovementCents({ type: 'income', amount: 12.5 })).toBe(1250)
    expect(validateExclusionDraft({ ...draft,
      amount: { operator: 'between', minCents: 2000, maxCents: 1000 } }, sources))
      .toContain('Enter a valid amount range')
  })

  it('requires a name, description and an available or explicit all-source scope', () => {
    expect(validateExclusionDraft({ ...draft, name: ' ', sourceId: 'missing',
      description: { operator: 'exact', value: '\t' } }, sources)).toEqual([
      'Enter a rule name', 'Enter a description pattern', 'Choose an available card or account',
    ])
    expect(validateExclusionDraft({ ...draft, sourceId: null }, sources)).toEqual([])
    expect(validateExclusionDraft({ ...draft, sourceId: undefined } as unknown as ExclusionRuleDraft, sources))
      .toContain('Choose an available card or account')
  })

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid exact cents %s', cents => {
    expect(validateExclusionDraft({ ...draft, amount: { operator: 'exact', cents } }, sources))
      .toContain('Enter a valid amount')
  })

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid range cents %s', cents => {
    expect(validateExclusionDraft({ ...draft, amount: { operator: 'between', minCents: cents, maxCents: 100 } }, sources))
      .toContain('Enter a valid amount range')
    expect(validateExclusionDraft({ ...draft, amount: { operator: 'between', minCents: 0, maxCents: cents } }, sources))
      .toContain('Enter a valid amount range')
  })

  it('allows zero and inclusive safe cent boundaries', () => {
    expect(cashMovementCents({ type: 'income', amount: 0 })).toBe(0)
    expect(cashMovementCents({ type: 'income', amount: 12.345 })).toBe(1235)
    for (const cents of [0, 100, Number.MAX_SAFE_INTEGER]) {
      expect(validateExclusionDraft({ ...draft, amount: { operator: 'exact', cents } }, sources)).toEqual([])
      expect(validateExclusionDraft({ ...draft, amount: { operator: 'between', minCents: cents, maxCents: cents } }, sources)).toEqual([])
    }
  })

  it.each([
    { description: { operator: 'regex', value: 'PAYMENT' } },
    { direction: 'sideways' }, { behavior: 'unknown' }, { amount: { operator: 'unknown' } },
    { description: null }, { amount: null }, { name: 123 }, { sourceId: 42 },
  ])('rejects malformed restored draft %j', patch => {
    expect(validateExclusionDraft({ ...draft, ...patch } as unknown as ExclusionRuleDraft, sources).length).toBeGreaterThan(0)
  })
})
