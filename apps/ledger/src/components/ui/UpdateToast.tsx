import React from 'react'
import { RefreshCw } from 'lucide-react'

/** Shows a refresh prompt when a new deploy is waiting. Update detection
 *  lives in useSWUpdate (owned by Layout). */
export const UpdateToast: React.FC<{ needRefresh: boolean; onRefresh: () => void }> = ({ needRefresh, onRefresh }) => {
  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed bottom-[calc(68px+var(--safe-bottom))] desktop:bottom-6 right-4 z-50 flex items-center gap-3 rounded-lg border border-border px-4 py-3 shadow-xl"
      style={{ backgroundColor: 'var(--dropdown-bg, var(--bg-secondary))' }}
    >
      <span className="text-[14px] text-text-primary">New version available</span>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:opacity-90 transition-opacity"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>
    </div>
  )
}
