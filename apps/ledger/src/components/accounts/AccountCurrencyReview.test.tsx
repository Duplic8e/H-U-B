import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { AccountCurrencyReview } from './AccountCurrencyReview'
import { useAccountsStore } from '../../store/useAccountsStore'

const account = { id: 'old', name: 'Old account', value: 1000, type: 'bank' as const, currency: 'CAD' as const }
beforeEach(() => useAccountsStore.setState({ accounts: [account], pendingCurrencyReviewIds: ['old'], history: [] }))

it('confirms an all-CAD review and clears the persistent notice', async () => {
  render(<AccountCurrencyReview />)
  fireEvent.click(screen.getByRole('button', { name: 'Review Account Currencies' }))
  await screen.findByLabelText('Currency for Old account')
  expect(screen.getByText(/1,000.*CAD/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Account Currencies' }))
  expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual([])
  expect(screen.queryByText(/assume CAD/)).toBeNull()
})

it('requires confirmation for USD and applies the entire draft once', async () => {
  render(<AccountCurrencyReview />)
  fireEvent.click(screen.getByRole('button', { name: 'Review Account Currencies' }))
  await screen.findByLabelText('Currency for Old account')
  fireEvent.change(screen.getByLabelText('Currency for Old account'), { target: { value: 'USD' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Account Currencies' }))
  expect(useAccountsStore.getState().accounts[0].currency).toBe('CAD')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Currency Change' }))
  expect(useAccountsStore.getState().accounts[0].currency).toBe('USD')
  expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual([])
})

it('discards a cancelled draft and ignores accounts removed while open', async () => {
  render(<AccountCurrencyReview />)
  fireEvent.click(screen.getByRole('button', { name: 'Review Account Currencies' }))
  await screen.findByLabelText('Currency for Old account')
  fireEvent.change(screen.getByLabelText('Currency for Old account'), { target: { value: 'USD' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Review' }))
  expect(useAccountsStore.getState().accounts[0].currency).toBe('CAD')
  expect(useAccountsStore.getState().pendingCurrencyReviewIds).toEqual(['old'])
  fireEvent.click(screen.getByRole('button', { name: 'Review Account Currencies' }))
  expect(screen.getByLabelText('Currency for Old account')).toHaveProperty('value', 'CAD')
  act(() => useAccountsStore.getState().removeAccount('old'))
  expect(screen.queryByText(/assume CAD/)).toBeNull()
})

it('shows current balance in confirmation if the account changes while review is open', async () => {
  render(<AccountCurrencyReview />)
  fireEvent.click(screen.getByRole('button', { name: 'Review Account Currencies' }))
  await screen.findByLabelText('Currency for Old account')
  fireEvent.change(screen.getByLabelText('Currency for Old account'), { target: { value: 'USD' } })
  act(() => useAccountsStore.setState({ accounts: [{ ...account, value: 1250 }] }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Account Currencies' }))
  expect(screen.getByText(/1,250/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }))
  expect(useAccountsStore.getState().accounts[0].currency).toBe('CAD')
})
