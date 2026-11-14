import { useEffect, useState } from 'react'
import { useAccountsStore } from '../../store/useAccountsStore'
import { useAccountFxStore } from '../../store/useAccountFxStore'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { getFxRate, type Resolved } from '../../services/marketData/marketDataService'
import type { FxRate } from '../../services/marketData/types'
import { fxKey } from '../../services/marketData/cacheKey'
import { todayKey } from '../../services/marketData/dateKey'

function usable(result: Resolved<FxRate> | undefined): result is Resolved<FxRate> {
  return !!result && Number.isFinite(result.value.rate) && result.value.rate > 0
}

export function AccountCurrencyCoordinator(): React.ReactNode {
  const accounts = useAccountsStore((state) => state.accounts)
  const pending = useAccountsStore((state) => state.pendingEditSnapshotDate)
  const hasUsd = accounts.some((account) => account.currency === 'USD')
  const override = useMarketDataStore((state) => state.overrides[fxKey('USD', 'CAD', todayKey())])
  const refreshRevision = useAccountFxStore((state) => state.refreshRevision)
  const rate = useAccountFxStore((state) => state.resolved?.value.rate)
  const [reconnectRevision, setReconnectRevision] = useState(0)

  useEffect(() => {
    const reconnect = () => setReconnectRevision((revision) => revision + 1)
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [])

  useEffect(() => {
    let active = true
    const fx = useAccountFxStore.getState()
    if (!hasUsd) {
      fx.publish(undefined, false)
      return () => { active = false }
    }

    // A removed or changed override is no longer an authorized valuation.
    // Clear it before the asynchronous automatic lookup can settle.
    const previous = fx.resolved
    const retained = previous?.source === 'override' && previous.value.rate !== override
      ? undefined : previous
    fx.publish(retained, true)
    void getFxRate('USD', 'CAD').then((resolved) => {
      if (!active) return
      if (!usable(resolved)) throw new Error('Invalid USD/CAD conversion rate')
      // The market service may fall back to a manual rate from an older date.
      // Clearing today's override must return account valuation to automatic data.
      if (resolved.source === 'override' && resolved.value.rate !== override) {
        throw new Error('No automatic USD/CAD conversion rate available')
      }
      if (resolved.status === 'error') {
        const fallback = usable(retained) ? retained : resolved
        useAccountFxStore.getState().publish(
          { ...fallback, stale: true },
          false,
          'Unable to refresh USD/CAD conversion rate',
        )
        return
      }
      useAccountFxStore.getState().publish(resolved, false)
    }).catch((cause: unknown) => {
      if (!active) return
      const message = cause instanceof Error ? cause.message : 'Unable to resolve USD/CAD conversion rate'
      useAccountFxStore.getState().publish(usable(retained) ? { ...retained, stale: true } : undefined, false, message)
    })
    return () => { active = false }
  }, [hasUsd, override, refreshRevision, reconnectRevision])

  useEffect(() => {
    useAccountsStore.getState().ensureDailySnapshot(rate)
  }, [accounts, pending, rate])

  return null
}
