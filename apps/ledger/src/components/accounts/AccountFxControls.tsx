import { useState } from 'react'
import { RefreshCw, Coins } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { TopBarAction } from '../ui/PageHeader'
import { NumberInput } from '../ui/NumberInput'
import { useAccountsStore } from '../../store/useAccountsStore'
import { useAccountFxStore } from '../../store/useAccountFxStore'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { fxKey } from '../../services/marketData/cacheKey'
import { todayKey } from '../../services/marketData/dateKey'

function ageLabel(asOf: string): string {
  const elapsed = Date.now() - Date.parse(asOf)
  if (!Number.isFinite(elapsed) || elapsed < 0) return asOf
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return `${asOf} (just now)`
  if (minutes < 60) return `${asOf} (${minutes} min ago)`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${asOf} (${hours} hr ago)`
  return `${asOf} (${Math.floor(hours / 24)} days ago)`
}

export function AccountFxControls({ phone = false }: { phone?: boolean }): React.ReactNode {
  const hasUsd = useAccountsStore((state) => state.accounts.some((account) => account.currency === 'USD'))
  const { resolved, loading, error: refreshError, requestRefresh } = useAccountFxStore()
  const override = useMarketDataStore((state) => state.overrides[fxKey('USD', 'CAD', todayKey())])
  const [manualRate, setManualRate] = useState(0)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  if (!hasUsd) return null
  const rate = resolved && Number.isFinite(resolved.value.rate) && resolved.value.rate > 0 ? resolved : undefined
  const source = rate?.source === 'override' ? 'Manual' : rate?.source === 'live' ? 'Live' : 'Cached'
  const save = () => {
    if (!Number.isFinite(manualRate) || manualRate <= 0) {
      setError('Enter a rate greater than zero.')
      return
    }
    useMarketDataStore.getState().setOverride(fxKey('USD', 'CAD', todayKey()), manualRate)
    setError('')
    requestRefresh()
  }
  const clear = () => {
    useMarketDataStore.getState().clearOverride(fxKey('USD', 'CAD', todayKey()))
    setManualRate(0)
    setError('')
    requestRefresh()
  }

  const show = () => { setManualRate(override ?? 0); setError(''); setOpen(true) }
  return <>
    {phone ? <TopBarAction icon={Coins} label="Currencies" tone="quiet" onClick={show} /> : <button type="button" onClick={show} aria-haspopup="dialog" aria-expanded={open}
      className="shrink-0 whitespace-nowrap px-4 py-2 rounded-md text-[14px] font-medium border control-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors">Currencies</button>}
    <Sheet open={open} onClose={() => setOpen(false)} desktop="modal" ariaLabel="Currencies" compactHeader
      panelClassName="themed-menu desktop:rounded-lg w-full max-w-lg desktop:p-6" contentClassName="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-bg-secondary p-3">
        <div className="min-w-0">
          <p className="text-[12px] text-text-secondary">USD Exchange Rate</p>
          <p className="mt-1 text-[20px] font-semibold text-text-primary tabular-nums break-words">{rate ? `1 USD = $${rate.value.rate.toFixed(4)}` : 'Conversion Needed'}</p>
          {rate && <p className="text-[12px] text-text-secondary" title={`Retrieved: ${ageLabel(rate.asOf)}`}>As of {rate.value.date}</p>}
        </div>
        {rate && <span className="rounded-full border border-border px-2 py-1 text-[12px] text-text-secondary">{source}{rate.stale ? ' (stale)' : ''}</span>}
      </div>
      {loading && <p role="status" className="text-[12px] text-text-secondary">Refreshing rate...</p>}
      {refreshError && <p role="alert" className="text-[12px] text-error">{refreshError}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[14px] font-medium text-text-primary">Automatic Rate</h3>
          <p className="mb-3 text-[13px] text-text-secondary">Use the latest available exchange rate.</p>
          <button type="button" onClick={() => { if (!loading) requestRefresh() }} aria-disabled={loading} autoFocus className="flex min-h-[44px] items-center gap-2 rounded-md border control-border px-3 text-[13px] text-text-secondary hover:text-text-primary aria-disabled:opacity-50"><RefreshCw size={14} aria-hidden="true" />Refresh Rate</button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); save() }}>
        <label htmlFor="manual-usd-cad-rate" className="block text-[13px] text-text-secondary">Manual Rate</label>
        <NumberInput id="manual-usd-cad-rate" value={manualRate} onCommit={setManualRate}
          aria-label="Manual USD to CAD rate"
          aria-invalid={error ? 'true' : 'false'} aria-describedby={error ? 'manual-usd-cad-error' : undefined}
          placeholder={rate?.value.rate.toFixed(4)}
          className="mt-2 w-full rounded-md border control-border bg-bg-secondary px-3 py-2 text-text-primary" />
        {error && <p id="manual-usd-cad-error" role="alert" className="mt-1 text-[12px] text-error">{error}</p>}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={clear} disabled={override === undefined} className="min-h-[44px] text-[12px] text-text-secondary hover:text-text-primary disabled:opacity-50">Use Automatic Rate</button>
          <button type="submit" className="min-h-[44px] rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-[var(--color-bg-primary)]">Save Rate</button>
        </div>
        </form>
      </div>
      <p className="border-t border-border pt-3 text-[12px] text-text-secondary">Used for account totals and Compensation.</p>
    </Sheet>
  </>
}
