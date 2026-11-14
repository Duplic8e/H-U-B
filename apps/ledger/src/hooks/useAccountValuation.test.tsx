import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { useAccountValuation } from './useAccountValuation'
import { useAccountsStore } from '../store/useAccountsStore'
import { useAccountFxStore } from '../store/useAccountFxStore'

beforeEach(() => {
  useAccountsStore.setState({ accounts: [], history: [], pendingEditSnapshotDate: null })
  useAccountFxStore.setState({ resolved: undefined, loading: false, error: undefined, refreshRevision: 0 })
})

it('shares one rate across category and net worth values, then reacts to account changes', () => {
  useAccountsStore.setState({ accounts: [
    { id: 'a', name: 'USD bank', value: 100, type: 'bank', currency: 'USD' },
    { id: 'b', name: 'CAD debt', value: 40, type: 'debt', currency: 'CAD' },
  ] })
  const { result } = renderHook(() => useAccountValuation())
  expect(result.current.netWorth).toBeNull()
  act(() => useAccountFxStore.getState().publish({
    value: { from: 'USD', to: 'CAD', rate: 1.5, date: '2026-10-06', asOf: '2026-10-06T00:00:00Z' },
    source: 'live', status: 'success', asOf: '2026-10-06T00:00:00Z', stale: false,
  }, false))
  expect(result.current.totals.bank).toBe(150)
  expect(result.current.netWorth).toBe(110)
  act(() => useAccountsStore.getState().updateAccount('a', { value: 200 }))
  expect(result.current.netWorth).toBe(260)
})

it('exposes refresh, loading, and errors', () => {
  const { result } = renderHook(() => useAccountValuation())
  act(() => result.current.refresh())
  expect(useAccountFxStore.getState().refreshRevision).toBe(1)
  act(() => useAccountFxStore.getState().publish(undefined, true, 'waiting'))
  expect(result.current.loading).toBe(true)
  expect(result.current.error).toBe('waiting')
})
