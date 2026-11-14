import React from 'react'
import { RefreshCw } from 'lucide-react'
import { timeAgo } from '../../utils/timeAgo'

interface DataFreshnessProps {
  source: 'override' | 'live' | 'cache'
  asOf: string
  stale: boolean
  /** Injectable clock, for tests. */
  now?: Date
  /** Shown when set, wired to a re-fetch. */
  onRefresh?: () => void
  /** What is being refreshed, used in the control's accessible name. */
  label?: string
}

const SOURCE_LABEL: Record<DataFreshnessProps['source'], string> = {
  live: 'Live',
  cache: 'Cached',
  override: 'Manual',
}

/** How old a market figure is, said where the figure is shown. A cached price
 *  and a live one look identical otherwise, which matters most offline. */
export const DataFreshness: React.FC<DataFreshnessProps> = ({ source, asOf, stale, now, onRefresh, label = 'data' }) => {
  const age = source === 'override' ? '' : timeAgo(asOf, now)
  const text = [SOURCE_LABEL[source], age, stale ? 'stale' : ''].filter(Boolean).join(' · ')

  return (
    <span className={`inline-flex items-center gap-1 text-meta ${stale ? 'text-error' : 'text-text-secondary'}`}>
      <span>{text}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          aria-label={`Refresh ${label}`}
          className="p-1 rounded hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent min-h-[44px] min-w-[44px] desktop:min-h-0 desktop:min-w-0 flex items-center justify-center"
        >
          <RefreshCw size={11} />
        </button>
      )}
    </span>
  )
}
