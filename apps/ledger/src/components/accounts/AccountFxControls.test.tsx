import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { AccountFxControls } from './AccountFxControls'
import { useAccountsStore } from '../../store/useAccountsStore'
import { useAccountFxStore } from '../../store/useAccountFxStore'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { fxKey } from '../../services/marketData/cacheKey'
import { todayKey } from '../../services/marketData/dateKey'

const account = { id: 'usd', name: 'USD cash', value: 100, type: 'bank' as const, currency: 'USD' as const }
const key = () => fxKey('USD', 'CAD', todayKey())

it('opens a labelled dialog from Currencies without a visible title or close icon', async () => {
  useAccountsStore.setState({ accounts: [account] })
  render(<AccountFxControls />)
  expect(screen.queryByRole('dialog')).toBeNull()
  screen.getByRole('button', { name: 'Currencies' }).focus()
  fireEvent.click(screen.getByRole('button', { name: 'Currencies' }))
  expect(screen.getByRole('dialog', { name: 'Currencies' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Refresh Rate' })).toHaveFocus()
  expect(screen.queryByRole('heading', { name: 'Currencies' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('button', { name: 'Currencies' })).toHaveFocus()
})

beforeEach(() => {
  useAccountsStore.setState({ accounts: [account], pendingCurrencyReviewIds: [] })
  useAccountFxStore.setState({ resolved: undefined, loading: false, error: undefined, refreshRevision: 0 })
  useMarketDataStore.setState({ overrides: {} })
})

it('rejects zero and negative rates before writing the shared override', () => {
  render(<AccountFxControls />)
  if (screen.queryByRole('button', { name: 'Currencies' })) fireEvent.click(screen.getByRole('button', { name: 'Currencies' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save Rate' }))
  expect(screen.getByRole('alert').textContent).toContain('greater than zero')
  expect(useMarketDataStore.getState().getOverride(key())).toBeUndefined()
  fireEvent.change(screen.getByLabelText('Manual USD to CAD rate'), { target: { value: '-2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Rate' }))
  expect(useMarketDataStore.getState().getOverride(key())).toBeUndefined()
  fireEvent.change(screen.getByLabelText('Manual USD to CAD rate'), { target: { value: '9'.repeat(400) } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Rate' }))
  expect(useMarketDataStore.getState().getOverride(key())).toBeUndefined()
})

it('writes and clears the shared override key and requests refresh', () => {
  render(<AccountFxControls />)
  if (screen.queryByRole('button', { name: 'Currencies' })) fireEvent.click(screen.getByRole('button', { name: 'Currencies' }))
  fireEvent.change(screen.getByLabelText('Manual USD to CAD rate'), { target: { value: '1.35' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Rate' }))
  expect(useMarketDataStore.getState().getOverride(key())).toBe(1.35)
  expect(useAccountFxStore.getState().refreshRevision).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: 'Use Automatic Rate' }))
  expect(useMarketDataStore.getState().getOverride(key())).toBeUndefined()
  expect(useAccountFxStore.getState().refreshRevision).toBe(2)
})

it('shows the quote date separately from recent retrieval time for a stale cached rate', async () => {
  const retrievedAt = new Date().toISOString()
  useAccountFxStore.setState({ resolved: { value: { from: 'USD', to: 'CAD', rate: 1.32, date: '2026-10-01', asOf: retrievedAt }, source: 'cache', status: 'error', asOf: retrievedAt, stale: true }, error: 'Unable to refresh USD/CAD conversion rate' })
  render(<AccountFxControls />)
  if (screen.queryByRole('button', { name: 'Currencies' })) fireEvent.click(screen.getByRole('button', { name: 'Currencies' }))
  expect(screen.getByText(/1 USD = \$1.3200/)).toBeTruthy()
  expect(screen.getByText(/As of 2026-10-01/)).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('Unable to refresh')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh Rate' }))
  await waitFor(() => expect(useAccountFxStore.getState().refreshRevision).toBe(1))
  expect(screen.getByText(/1 USD = \$1.3200/)).toBeTruthy()
})

it('is absent for CAD-only accounts', () => {
  useAccountsStore.setState({ accounts: [{ ...account, currency: 'CAD' }] })
  render(<AccountFxControls />)
  if (screen.queryByRole('button', { name: 'Currencies' })) fireEvent.click(screen.getByRole('button', { name: 'Currencies' }))
  expect(screen.queryByText(/USD to CAD rate/i)).toBeNull()
})
