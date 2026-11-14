import { classifyDuplicates, normalizeDescription } from './importDedupe'
import type { Transaction } from '../../types/budget'
import type { TriageTransaction } from '../../types/triage'

const existing: Transaction[] = [
  { id: 'e1', date: '2026-08-04', amount: 42.5, description: 'TIM HORTONS #123', type: 'expense' },
  { id: 'e2', date: '2026-08-05', amount: 1200, description: 'RENT', type: 'expense' },
]

const row = (over: Partial<TriageTransaction>): TriageTransaction => ({
  id: 'i1', date: '2026-08-04', amount: 42.5, description: 'Tim Hortons #123', type: 'expense', ...over,
})

describe('normalizeDescription', () => {
  it('lower-cases and collapses punctuation so bank formatting noise does not matter', () => {
    expect(normalizeDescription('TIM HORTONS  #123')).toBe('tim hortons 123')
    expect(normalizeDescription('Tim-Hortons #123')).toBe('tim hortons 123')
  })
})

describe('classifyDuplicates', () => {
  it('flags an exact match on date, amount, direction and normalized description', () => {
    expect(classifyDuplicates([row({})], existing)).toEqual({ i1: 'exact' })
  })

  it('flags a possible match when only the description differs', () => {
    expect(classifyDuplicates([row({ description: 'Coffee' })], existing)).toEqual({ i1: 'possible' })
  })

  it('does not flag a different amount', () => {
    expect(classifyDuplicates([row({ amount: 42.51 })], existing)).toEqual({})
  })

  it('does not flag a different date', () => {
    expect(classifyDuplicates([row({ date: '2026-08-06' })], existing)).toEqual({})
  })

  it('does not flag an income row against an expense of the same amount', () => {
    expect(classifyDuplicates([row({ type: 'income' })], existing)).toEqual({})
  })

  it('flags the second of two identical rows in the same file, not the first', () => {
    const rows = [
      row({ id: 'a', date: '2026-09-01', description: 'Gym', amount: 30 }),
      row({ id: 'b', date: '2026-09-01', description: 'Gym', amount: 30 }),
    ]
    expect(classifyDuplicates(rows, existing)).toEqual({ b: 'exact' })
  })

  it('returns an empty map when nothing matches', () => {
    expect(classifyDuplicates([row({ date: '2026-01-01', amount: 5 })], existing)).toEqual({})
  })
})
