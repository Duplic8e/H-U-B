import { useMemo } from 'react'
import { useAccountsStore } from '../store/useAccountsStore'
import { useAccountFxStore } from '../store/useAccountFxStore'
import { valueAccounts } from '../utils/accounts/accountValuation'

export function useAccountValuation() {
  const accounts = useAccountsStore((state) => state.accounts)
  const rate = useAccountFxStore((state) => state.resolved)
  const loading = useAccountFxStore((state) => state.loading)
  const error = useAccountFxStore((state) => state.error)
  const refresh = useAccountFxStore((state) => state.requestRefresh)
  const valuation = useMemo(() => valueAccounts(accounts, rate?.value.rate), [accounts, rate])
  return { ...valuation, rate, loading, error, refresh }
}
