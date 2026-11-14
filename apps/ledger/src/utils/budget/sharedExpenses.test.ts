import { describe, expect, it } from 'vitest'
import { countsAsIncome, iouBalances, sharedPeople } from './sharedExpenses'
import type { Transaction } from '../../types/budget'

const tx = (partial: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  date: '2026-07-10',
  amount: 0,
  description: '',
  type: 'expense',
  ...partial,
})

describe('sharedExpenses selectors', () => {
  it('countsAsIncome excludes reimbursements', () => {
    expect(countsAsIncome(tx({ type: 'income', amount: 100 }))).toBe(true)
    expect(countsAsIncome(tx({ type: 'income', amount: 100, reimbursement: { from: 'Alex' } }))).toBe(false)
    expect(countsAsIncome(tx({ type: 'expense', amount: 100 }))).toBe(false)
  })

  it('iouBalances sums shared remainders per person minus reimbursements', () => {
    const transactions = {
      a: tx({ id: 'a', amount: 40, shared: { totalAmount: 120, sharedWith: 'Alex' } }),
      b: tx({ id: 'b', amount: 50, shared: { totalAmount: 100, sharedWith: 'Alex' } }),
      c: tx({ id: 'c', amount: 30, shared: { totalAmount: 90, sharedWith: 'Sam' } }),
      d: tx({ id: 'd', type: 'income', amount: 80, reimbursement: { from: 'Alex' } }),
      e: tx({ id: 'e', type: 'income', amount: 500 }), // plain income, ignored
    }
    expect(iouBalances(transactions)).toEqual({ Alex: 50, Sam: 60 })
  })

  it('iouBalances keeps negative balances (overpaid)', () => {
    const transactions = {
      a: tx({ id: 'a', amount: 40, shared: { totalAmount: 100, sharedWith: 'Alex' } }),
      d: tx({ id: 'd', type: 'income', amount: 90, reimbursement: { from: 'Alex' } }),
    }
    expect(iouBalances(transactions)).toEqual({ Alex: -30 })
  })

  it('sharedPeople returns unique names from shared and reimbursement fields', () => {
    const transactions = {
      a: tx({ id: 'a', amount: 40, shared: { totalAmount: 100, sharedWith: 'Alex' } }),
      b: tx({ id: 'b', type: 'income', amount: 10, reimbursement: { from: 'Sam' } }),
      c: tx({ id: 'c', amount: 10, shared: { totalAmount: 20, sharedWith: 'Alex' } }),
    }
    expect(sharedPeople(transactions).sort()).toEqual(['Alex', 'Sam'])
  })
})
