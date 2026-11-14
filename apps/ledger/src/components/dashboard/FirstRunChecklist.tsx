import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle, X } from 'lucide-react'
import { STORAGE_KEYS } from '../../store/storageKeys'

interface FirstRunChecklistProps {
  accountCount: number
  transactionCount: number
}

/** Shown only until the user has both an account and a transaction, then it
 *  disappears for good. Presentational: counts are passed in so the dashboard
 *  owns the store subscriptions. */
export const FirstRunChecklist: React.FC<FirstRunChecklistProps> = ({
  accountCount,
  transactionCount,
}) => {
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.checklistDismissed) !== null,
  )

  const dismiss = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.checklistDismissed, new Date().toISOString())
    }
    setDismissed(true)
  }

  const steps = [
    { label: 'Add your first account', done: accountCount > 0, to: '/' },
    { label: 'Import or add a transaction', done: transactionCount > 0, to: '/budget' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (dismissed || doneCount === steps.length) return null

  return (
    <section
      aria-label="Getting started"
      className="mb-6 rounded-xl border border-accent/40 bg-accent/5 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-text-primary">Getting started</h2>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-secondary">
            {doneCount} of {steps.length} done
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss Getting started"
            className="p-1 rounded text-text-secondary hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[13px]">
            {s.done ? (
              <Check className="w-4 h-4 text-accent" aria-hidden="true" />
            ) : (
              <Circle className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            )}
            {s.done ? (
              <span className="text-text-secondary line-through">{s.label}</span>
            ) : (
              <Link
                to={s.to}
                className="inline-flex items-center px-3 py-1 rounded-md bg-[var(--color-accent)] text-[var(--color-bg-primary)] font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                {s.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
