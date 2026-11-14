import React from 'react'
import type { AccountCurrency } from '../../store/useAccountsStore'

interface Change {
  id: string
  name: string
  value: number
  from: AccountCurrency
  to: AccountCurrency
}

export const CurrencyChangeConfirmation: React.FC<{
  changes: Change[]
  onConfirm: () => void
  onCancel: () => void
}> = ({ changes, onConfirm, onCancel }) => (
  <div role="group" aria-label="Confirm currency change" className="p-4 flex flex-col gap-4">
    <h3 className="text-lg font-semibold text-text-primary">Confirm Currency Change</h3>
    {changes.map((change) => (
      <p key={change.id} className="text-sm text-text-secondary">
        {change.name}: The balance will remain {change.value.toLocaleString('en-CA', { maximumFractionDigits: 20 })} and change from {change.from} to {change.to}. Its CAD value and your net worth will change.
      </p>
    ))}
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md text-sm text-text-secondary hover:bg-bg-secondary">Keep Editing</button>
      <button type="button" onClick={onConfirm} className="px-4 py-2 rounded-md text-sm font-medium bg-accent text-[var(--color-bg-primary)]">Confirm Currency Change</button>
    </div>
  </div>
)
