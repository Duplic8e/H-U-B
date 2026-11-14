import { describe, expect, it } from 'vitest'
import type { Category } from '../../types/budget'
import { chaseCategoryId } from './chaseCategoryMap'

const cats: Record<string, Category> = {
  c1: { id: 'c1', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
  c2: { id: 'c2', groupId: 'g1', name: 'Takeout', targetAmount: 0 },
}

describe('chaseCategoryId', () => {
  it('maps a Chase category to the ledger category of the same name', () => {
    expect(chaseCategoryId('Groceries', cats)).toBe('c1')
  })

  it('maps Food & Drink to Takeout', () => {
    expect(chaseCategoryId('Food & Drink', cats)).toBe('c2')
  })

  it('returns undefined for a Chase category with no mapping', () => {
    expect(chaseCategoryId('Health & Wellness', cats)).toBeUndefined()
  })

  it('returns undefined when the mapped ledger category does not exist', () => {
    expect(chaseCategoryId('Travel', cats)).toBeUndefined()
  })

  it('returns undefined for an empty or missing Chase category', () => {
    expect(chaseCategoryId('', cats)).toBeUndefined()
    expect(chaseCategoryId(undefined, cats)).toBeUndefined()
  })

  it('matches the ledger category name case-insensitively', () => {
    const renamed: Record<string, Category> = {
      c1: { id: 'c1', groupId: 'g1', name: 'groceries', targetAmount: 0 },
    }
    expect(chaseCategoryId('Groceries', renamed)).toBe('c1')
  })
})
