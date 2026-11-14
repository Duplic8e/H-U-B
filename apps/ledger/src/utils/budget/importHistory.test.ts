import { describe, expect, it } from 'vitest'
import { matchImport } from './importHistory'
import type { TriageTransaction } from '../../types/triage'

const row = (id: string, over: Partial<TriageTransaction> = {}): TriageTransaction => ({
  id, date: '2026-06-10', amount: 5, description: 'Coffee', type: 'expense', ...over,
})
const firstImport = () => matchImport([row('a'), row('b'), row('g', { amount: 42, description: 'Groceries' })], 'card-a', {}, [], [])

describe('daily import history', () => {
  it('keeps two identical purchases on the first upload and skips both when that day repeats in another order', () => {
    const first = firstImport()
    expect(first.pending).toHaveLength(3)
    expect(first.pending.every(tx => !tx.duplicate)).toBe(true)
    const repeat = matchImport([row('g2', { amount: 42, description: 'Groceries' }), row('c'), row('d')], 'card-a', first.records, first.days, [])
    expect(repeat.pending).toEqual([])
    expect(repeat.report.skippedIds.sort()).toEqual(['a', 'b', 'g'])
    expect(repeat.days).toHaveLength(1)
  })

  it('does not share occurrence history between cards', () => {
    const first = firstImport()
    expect(matchImport([row('c'), row('d')], 'card-b', first.records, first.days, []).pending).toHaveLength(2)
  })

  it('consumes each prior occurrence once and holds a third identical purchase for review', () => {
    const first = firstImport()
    const next = matchImport([row('c'), row('d'), row('e')], 'card-a', first.records, first.days, [])
    expect(next.report.skippedIds).toHaveLength(2)
    expect(next.pending).toHaveLength(1)
    expect(next.pending[0]).toMatchObject({ id: 'e', duplicate: 'possible' })
    expect(next.report.changedDays[0]).toMatchObject({ date: '2026-06-10', missingCount: 1 })
    expect(Object.keys(first.records)).toHaveLength(3)
  })

  it('preserves ignored and pending originals and skips them again', () => {
    const first = firstImport()
    first.records.a.decision = 'ignored'
    const next = matchImport([row('c'), row('d')], 'card-a', first.records, first.days, [])
    expect(next.pending).toEqual([])
    expect(next.records.a.decision).toBe('ignored')
    expect(next.records.b.decision).toBe('pending')
  })

  it('adds genuinely new overlapping-day rows and new days', () => {
    const first = firstImport()
    const next = matchImport([row('c'), row('d'), row('g2', { amount: 42, description: 'Groceries' }), row('n', { amount: 99, description: 'New' }), row('j', { date: '2026-07-07' })], 'card-a', first.records, first.days, [])
    expect(next.pending.map(tx => tx.id)).toEqual(['n', 'j'])
    expect(next.pending.every(tx => !tx.duplicate)).toBe(true)
  })

  it('holds changed descriptions or nearby dates instead of suppressing them', () => {
    const first = firstImport()
    const next = matchImport([row('c', { description: 'COFFEE SHOP' }), row('d', { date: '2026-06-11' })], 'card-a', first.records, first.days, [])
    expect(next.pending).toHaveLength(2)
    expect(next.pending.every(tx => tx.duplicate === 'possible')).toBe(true)
  })

  it('never silently skips legacy rows without known card provenance', () => {
    const next = matchImport([row('a')], 'card-a', {}, [], [row('legacy')])
    expect(next.report.skippedIds).toEqual([])
    expect(next.pending[0]).toMatchObject({ duplicate: 'possible', duplicateTransactionId: 'legacy' })
  })

  it('distinguishes refunds and punctuation while supporting Unicode and harmless whitespace', () => {
    const first = matchImport([row('a', { description: ' café   A&B ' }), row('r', { amount: -5 })], 'card-a', {}, [], [])
    const next = matchImport([row('b', { description: 'CAFÉ A&B' }), row('c', { description: 'café A B' }), row('r2', { amount: -5 })], 'card-a', first.records, first.days, [])
    expect(next.report.skippedIds.sort()).toEqual(['a', 'r'])
    expect(next.pending).toHaveLength(1)
    expect(next.pending[0].description).toBe('café A B')
  })

  it('does not let a confirmed duplicate increase the real occurrence count', () => {
    const first = firstImport()
    const second = matchImport([row('c'), row('d'), row('e')], 'card-a', first.records, first.days, [])
    second.records.e.decision = 'duplicate'
    const next = matchImport([row('x'), row('y'), row('z'), row('q')], 'card-a', second.records, second.days, [])
    expect(next.report.skippedIds).toHaveLength(2)
    expect(next.pending).toHaveLength(2)
  })

  it('remembers a matched merchant alias when a later file adds another charge to that day', () => {
    const first = matchImport([row('a')], 'card-a', {}, [], [])
    const alias = matchImport([row('alias', { description: 'Coffee shop' })], 'card-a', first.records, first.days, [])
    alias.records.alias = { ...alias.records.alias, decision: 'duplicate', matchedRecordId: 'a' }
    const next = matchImport([row('b', { description: 'Coffee shop' }), row('new', { amount: 42 })], 'card-a', alias.records, alias.days, [])
    expect(next.pending.map(tx => tx.id)).toEqual(['new'])
    expect(next.report.skippedIds).toEqual(['alias'])
  })

  it('uses a deliberate legacy match as bank identity on subsequent changed-day imports', () => {
    const first = matchImport([row('alias')], 'card-a', {}, [], [row('legacy')])
    first.records.alias = { ...first.records.alias, decision: 'duplicate', matchedTransactionId: 'legacy' }
    const next = matchImport([row('b'), row('new', { amount: 42 })], 'card-a', first.records, first.days, [row('legacy')])
    expect(next.pending.map(tx => tx.id)).toEqual(['new'])
    expect(next.report.skippedIds).toEqual(['alias'])
  })
})
