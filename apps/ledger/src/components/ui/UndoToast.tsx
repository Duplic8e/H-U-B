import React from 'react'
import { X } from 'lucide-react'
import { useUndoStore } from '../../store/useUndoStore'

/** One global undo offer, rendered above the mobile nav bar. Mounted once in
 *  Layout so any action anywhere can offer an undo without owning a toast. */
export const UndoToast: React.FC = () => {
  const pending = useUndoStore((s) => s.pending)
  const runUndo = useUndoStore((s) => s.runUndo)
  const dismissUndo = useUndoStore((s) => s.dismissUndo)

  if (!pending) return null

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 bottom-[calc(76px+var(--safe-bottom))] desktop:bottom-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-bg-secondary shadow-xl max-w-[calc(100vw-2rem)]"
    >
      <span className="text-[13px] text-text-primary truncate">{pending.label}</span>
      <button
        type="button"
        onClick={runUndo}
        className="text-[13px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={dismissUndo}
        aria-label="Dismiss undo"
        className="p-1 text-text-secondary hover:text-text-primary rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <X size={14} />
      </button>
    </div>
  )
}
