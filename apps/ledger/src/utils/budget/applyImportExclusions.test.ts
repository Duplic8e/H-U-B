import { applyImportExclusions } from './applyImportExclusions'
import type { ExclusionRuleDraft, ExclusionRule } from '../../types/exclusionRules'
import type { ImportRecord } from '../../types/importHistory'
import type { TriageTransaction } from '../../types/triage'

const sources = { a: { id: 'a', name: 'Card A' } }
const draft: ExclusionRuleDraft = {
  name: 'Payments', sourceId: 'a', description: { operator: 'exact', value: 'PAYMENT' },
  direction: 'in', amount: { operator: 'any' }, behavior: 'review',
}
const row: TriageTransaction = {
  id: 'a', date: '2026-06-10', description: 'PAYMENT', amount: 50, type: 'income',
}
const rule = (behavior: ExclusionRule['behavior'] = 'automatic'): ExclusionRule => ({ ...draft, id: 'r', revision: 1, enabled: true, behavior })
const record: ImportRecord = { id: 'a', sourceId: sources.a.id, original: row, decision: 'pending' }
const pending = { ...row, importRecordId: 'a', importSourceId: 'a' }

it('excludes automatic matches without mutating bank originals or untouched records', () => {
  const accepted: ImportRecord = { ...record, id: 'accepted', decision: 'accepted' }
  const records = { a: record, accepted }
  const result = applyImportExclusions([pending], records, [rule()])
  expect(result.pending).toEqual([])
  expect(result.excludedIds).toEqual(['a'])
  expect(result.records.a).toMatchObject({ decision: 'ignored', ignoreReason: 'rule' })
  expect(result.records.a.original).toBe(row)
  expect(result.records.accepted).toBe(accepted)
  expect(records.a).toBe(record)
  expect(record.decision).toBe('pending')
})

it('keeps review overlaps and possible duplicates with every sorted reason snapshot', () => {
  const review = { ...rule('review'), id: 'a-review' }
  const result = applyImportExclusions([pending], { a: record }, [rule(), review])
  expect(result.pending[0].exclusionMatches?.map(m => m.ruleId)).toEqual(['a-review', 'r'])
  expect(result.excludedIds).toEqual([])
  const duplicate = applyImportExclusions([{ ...pending, duplicate: 'possible' }], { a: record }, [rule()])
  expect(duplicate.records.a.decision).toBe('pending')
  expect(duplicate.pending[0].exclusionMatches).toHaveLength(1)
})

it('matches bank originals while preserving edited review fields', () => {
  const result = applyImportExclusions([{ ...pending, description: 'Edited', amount: 10 }], { a: record }, [rule('review')])
  expect(result.pending[0]).toMatchObject({ description: 'Edited', amount: 10 })
  expect(result.pending[0].exclusionMatches).toHaveLength(1)
  expect(result.records.a.original).toBe(row)
})

it('bypasses included occurrences and leaves unscoped legacy rows in review', () => {
  const included = { ...record, exclusionOverride: 'include' as const }
  const result = applyImportExclusions([pending, { ...row, id: 'legacy' }], { a: included }, [rule()])
  expect(result.pending).toHaveLength(2)
  expect(result.excludedIds).toEqual([])
  expect(result.records.a).toBe(included)
})
