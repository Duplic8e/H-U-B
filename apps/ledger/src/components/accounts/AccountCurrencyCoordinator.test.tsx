import { act, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AccountCurrencyCoordinator } from './AccountCurrencyCoordinator'
import { useAccountsStore, type Account } from '../../store/useAccountsStore'
import { useAccountFxStore } from '../../store/useAccountFxStore'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { getFxRate, type Resolved } from '../../services/marketData/marketDataService'
import type { FxRate } from '../../services/marketData/types'
import { fxKey } from '../../services/marketData/cacheKey'
import { todayKey } from '../../services/marketData/dateKey'
import { useAccountValuation } from '../../hooks/useAccountValuation'

vi.mock('../../services/marketData/marketDataService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/marketData/marketDataService')>(), getFxRate: vi.fn(),
}))
const getRate = vi.mocked(getFxRate)
const cad: Account = { id: 'cad', name: 'CAD', value: 100, type: 'bank', currency: 'CAD' }
const usd: Account = { id: 'usd', name: 'USD', value: 50, type: 'bank', currency: 'USD' }
const key = () => fxKey('USD', 'CAD', todayKey())
const today = () => todayKey()
const rate = (value: number, source: Resolved<FxRate>['source'] = 'live'): Resolved<FxRate> => ({
  value: { from: 'USD', to: 'CAD', rate: value, date: today(), asOf: new Date().toISOString() },
  source, status: 'success', asOf: new Date().toISOString(), stale: false,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => { resolve = yes })
  return { promise, resolve }
}

beforeEach(() => {
  getRate.mockReset()
  useAccountsStore.setState({ accounts: [], history: [], pendingEditSnapshotDate: null })
  useAccountFxStore.setState({ resolved: undefined, loading: false, error: undefined, refreshRevision: 0 })
  useMarketDataStore.setState({ overrides: {}, fx: {} })
})

it('skips FX for CAD-only accounts and immediately snapshots', () => {
  useAccountsStore.setState({ accounts: [cad] })
  render(<AccountCurrencyCoordinator />)
  expect(getRate).not.toHaveBeenCalled()
  expect(useAccountsStore.getState().history).toEqual([{ date: today(), value: 100 }])
})

it('resolves once for shared consumers and fills a missing daily snapshot', async () => {
  useAccountsStore.setState({ accounts: [cad, usd] })
  getRate.mockResolvedValue(rate(1.4))
  render(<AccountCurrencyCoordinator />)
  await waitFor(() => expect(useAccountFxStore.getState().resolved?.value.rate).toBe(1.4))
  expect(getRate).toHaveBeenCalledTimes(1)
  expect(useAccountsStore.getState().history).toEqual([{ date: today(), value: 170 }])
})

it('shares one resolved value across mounted account valuation consumers', async () => {
  useAccountsStore.setState({ accounts: [cad, usd] })
  getRate.mockResolvedValue(rate(1.4))
  function Consumers() {
    const first = useAccountValuation()
    const second = useAccountValuation()
    return <div>{first.totals.bank}:{second.totals.bank}:{first.rate?.value.rate}:{second.rate?.value.rate}</div>
  }
  const { findByText } = render(<><AccountCurrencyCoordinator /><Consumers /></>)
  await findByText('170:170:1.4:1.4')
  expect(getRate).toHaveBeenCalledTimes(1)
})

it('updates manual edits and clears an old manual value before automatic resolution', async () => {
  useAccountsStore.setState({ accounts: [usd] })
  const automatic = deferred<Resolved<FxRate>>()
  getRate.mockResolvedValueOnce(rate(1.3)).mockResolvedValueOnce(rate(2, 'override')).mockReturnValueOnce(automatic.promise)
  render(<AccountCurrencyCoordinator />)
  await waitFor(() => expect(useAccountFxStore.getState().resolved?.value.rate).toBe(1.3))
  act(() => useMarketDataStore.getState().setOverride(key(), 2))
  await waitFor(() => expect(useAccountFxStore.getState().resolved?.value.rate).toBe(2))
  act(() => useMarketDataStore.getState().clearOverride(key()))
  expect(useAccountFxStore.getState().resolved).toBeUndefined()
  act(() => automatic.resolve(rate(1.5)))
  await waitFor(() => expect(useAccountFxStore.getState().resolved?.value.rate).toBe(1.5))
})

it('refreshes and reconnects, and ignores a superseded request', async () => {
  useAccountsStore.setState({ accounts: [usd] })
  const first = deferred<Resolved<FxRate>>()
  getRate.mockReturnValueOnce(first.promise).mockResolvedValueOnce(rate(1.6)).mockResolvedValueOnce(rate(1.7))
  render(<AccountCurrencyCoordinator />)
  act(() => useAccountFxStore.getState().requestRefresh())
  await waitFor(() => expect(useAccountFxStore.getState().resolved?.value.rate).toBe(1.6))
  act(() => first.resolve(rate(9)))
  expect(useAccountFxStore.getState().resolved?.value.rate).toBe(1.6)
  act(() => window.dispatchEvent(new Event('online')))
  await waitFor(() => expect(useAccountFxStore.getState().resolved?.value.rate).toBe(1.7))
  expect(getRate).toHaveBeenCalledTimes(3)
})

it('pauses without a rate and retains a stale usable rate after failed refresh', async () => {
  useAccountsStore.setState({ accounts: [usd] })
  getRate.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(rate(1.4)).mockRejectedValueOnce(new Error('offline again'))
  render(<AccountCurrencyCoordinator />)
  await waitFor(() => expect(useAccountFxStore.getState().error).toBe('offline'))
  expect(useAccountsStore.getState().history).toEqual([])
  act(() => useAccountFxStore.getState().requestRefresh())
  await waitFor(() => expect(useAccountFxStore.getState().resolved?.value.rate).toBe(1.4))
  act(() => useAccountFxStore.getState().requestRefresh())
  await waitFor(() => expect(useAccountFxStore.getState().error).toBe('offline again'))
  expect(useAccountFxStore.getState().resolved).toMatchObject({ stale: true, value: { rate: 1.4 } })
})

it('treats a resolved error-status cache fallback as a failed refresh', async () => {
  useAccountsStore.setState({ accounts: [usd] })
  const cachedError: Resolved<FxRate> = { ...rate(1.42, 'cache'), status: 'error', stale: false }
  getRate.mockResolvedValueOnce(rate(1.4)).mockResolvedValueOnce(cachedError)
  render(<AccountCurrencyCoordinator />)
  await waitFor(() => expect(useAccountFxStore.getState().resolved?.value.rate).toBe(1.4))
  act(() => useAccountFxStore.getState().requestRefresh())
  await waitFor(() => expect(useAccountFxStore.getState().error).toBe('Unable to refresh USD/CAD conversion rate'))
  expect(useAccountFxStore.getState().resolved).toMatchObject({ status: 'success', source: 'live', stale: true, value: { rate: 1.4 } })
})

it('rejects invalid rates and older manual fallback after today\'s override is cleared', async () => {
  useAccountsStore.setState({ accounts: [usd] })
  getRate.mockResolvedValueOnce(rate(Number.NaN)).mockResolvedValueOnce(rate(2, 'override'))
  render(<AccountCurrencyCoordinator />)
  await waitFor(() => expect(useAccountFxStore.getState().error).toBe('Invalid USD/CAD conversion rate'))
  expect(useAccountsStore.getState().history).toEqual([])
  act(() => useAccountFxStore.getState().requestRefresh())
  await waitFor(() => expect(useAccountFxStore.getState().error).toBe('No automatic USD/CAD conversion rate available'))
  expect(useAccountFxStore.getState().resolved).toBeUndefined()
})

it('fulfills deferred edits using the latest accounts', async () => {
  useAccountsStore.setState({ accounts: [usd], history: [{ date: today(), value: 5 }] })
  const pendingRate = deferred<Resolved<FxRate>>()
  getRate.mockReturnValue(pendingRate.promise)
  render(<AccountCurrencyCoordinator />)
  act(() => { useAccountsStore.getState().updateAccount('usd', { value: 60 }); useAccountsStore.getState().updateAccount('usd', { value: 70 }) })
  expect(useAccountsStore.getState().pendingEditSnapshotDate).toBe(today())
  act(() => pendingRate.resolve(rate(2)))
  await waitFor(() => expect(useAccountsStore.getState().history).toEqual([{ date: today(), value: 140 }]))
})

it('preserves an existing daily point through rate refresh and manual edits', async () => {
  useAccountsStore.setState({ accounts: [usd], history: [{ date: today(), value: 777 }] })
  getRate.mockResolvedValue(rate(1.4))
  render(<AccountCurrencyCoordinator />)
  await waitFor(() => expect(useAccountFxStore.getState().resolved).toBeDefined())
  act(() => useAccountFxStore.getState().requestRefresh())
  await waitFor(() => expect(getRate).toHaveBeenCalledTimes(2))
  act(() => useMarketDataStore.getState().setOverride(key(), 2))
  await waitFor(() => expect(getRate).toHaveBeenCalledTimes(3))
  expect(useAccountsStore.getState().history).toEqual([{ date: today(), value: 777 }])
})

it('does not duplicate snapshots under StrictMode effects', () => {
  useAccountsStore.setState({ accounts: [cad] })
  render(<StrictMode><AccountCurrencyCoordinator /></StrictMode>)
  expect(useAccountsStore.getState().history).toEqual([{ date: today(), value: 100 }])
})
