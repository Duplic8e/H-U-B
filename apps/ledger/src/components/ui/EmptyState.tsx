import React from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  message: string
  hint?: string
  /** Give `to` for navigation and `onClick` for an in-place action. Exactly
   *  one of the two: `to` wins if both are given. */
  action?: { label: string; onClick?: () => void; to?: string }
}

const ACTION_CLASS =
  'mt-2 inline-flex items-center justify-center min-h-11 px-5 rounded-xl text-[14px] font-medium border border-accent text-accent bg-accent/10 hover:opacity-90 transition-opacity'

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, message, hint, action }) => (
  <div className="flex flex-col items-center gap-2 py-8 text-center">
    {Icon && <Icon className="w-6 h-6 text-text-secondary" aria-hidden="true" />}
    <p className="text-[15px] font-medium text-text-primary">{message}</p>
    {hint && <p className="text-[13px] text-text-secondary">{hint}</p>}
    {action && (action.to
      ? <Link to={action.to} className={ACTION_CLASS}>{action.label}</Link>
      : <button type="button" onClick={action.onClick} className={ACTION_CLASS}>{action.label}</button>
    )}
  </div>
)
