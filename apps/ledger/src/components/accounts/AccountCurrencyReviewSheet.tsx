import { useState } from 'react'
import { useAccountsStore } from '../../store/useAccountsStore'
import type { AccountCurrency } from '../../store/useAccountsStore'
import { Sheet } from '../ui/Sheet'
import { CurrencyChangeConfirmation } from './CurrencyChangeConfirmation'

function ReviewForm({ onClose }: { onClose: () => void }): React.ReactNode {
  const accounts = useAccountsStore((state) => state.accounts)
  const pendingIds = useAccountsStore((state) => state.pendingCurrencyReviewIds)
  const confirm = useAccountsStore((state) => state.confirmCurrencyReview)
  const [draft, setDraft] = useState<Record<string, AccountCurrency>>(() =>
    Object.fromEntries(pendingIds.map((id) => [id, accounts.find((account) => account.id === id)?.currency ?? 'CAD'])))
  const [confirming, setConfirming] = useState(false)
  const pending = new Set(pendingIds)
  const rows = accounts.filter((account) => pending.has(account.id))
  const changes = rows.filter((account) => (draft[account.id] ?? account.currency) !== account.currency)
    .map((account) => ({ id: account.id, name: account.name, value: account.value,
      from: account.currency, to: draft[account.id] }))
  const apply = () => {
    // Re-read the live set before committing. A row may have been removed or
    // edited since this sheet opened, and no stale draft may restore it.
    const state = useAccountsStore.getState()
    const live = new Set(state.accounts.map((account) => account.id))
    const currencies = Object.fromEntries(state.pendingCurrencyReviewIds
      .filter((id) => live.has(id) && draft[id])
      .map((id) => [id, draft[id]]))
    if (Object.keys(currencies).length) confirm(currencies)
    onClose()
  }

  if (confirming && changes.length) return <CurrencyChangeConfirmation changes={changes} onConfirm={apply} onCancel={() => setConfirming(false)} />
  return <div className="flex flex-col gap-4">
    <div className="hidden desktop:block border-b border-border pb-3">
      <h2 className="text-lg font-semibold text-text-primary">Review Account Currencies</h2>
    </div>
    <p className="text-[13px] text-text-secondary">Check each balance's currency. The saved number stays the same when you change its currency.</p>
    {rows.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="break-words text-[14px] font-medium text-text-primary">{account.name}</p>
        <p className="text-[13px] text-text-secondary tabular-nums">{account.value.toLocaleString('en-CA', { maximumFractionDigits: 20 })} {account.currency}</p>
      </div>
      <label className="text-[12px] text-text-secondary">Currency for {account.name}
        <select aria-label={`Currency for ${account.name}`} value={draft[account.id] ?? account.currency}
          onChange={(event) => setDraft((current) => ({ ...current, [account.id]: event.target.value as AccountCurrency }))}
          className="ml-2 rounded-md border border-border bg-bg-secondary px-2 py-2 text-[14px] text-text-primary">
          <option value="CAD">CAD</option><option value="USD">USD</option>
        </select>
      </label>
    </div>)}
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[13px] text-text-secondary">Cancel Review</button>
      <button type="button" onClick={() => changes.length ? setConfirming(true) : apply()}
        disabled={!rows.length} className="rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-[var(--color-bg-primary)] disabled:opacity-50">Confirm Account Currencies</button>
    </div>
  </div>
}

export function AccountCurrencyReviewSheet({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactNode {
  return <Sheet open={open} onClose={onClose} desktop="modal" ariaLabel="Review account currencies"
    title="Review Account Currencies" panelClassName="w-full max-w-lg rounded-xl border border-border bg-bg-primary shadow-xl"
    contentClassName="p-4">
    {open && <ReviewForm onClose={onClose} />}
  </Sheet>
}
