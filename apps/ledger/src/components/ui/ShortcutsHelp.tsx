import React from 'react'
import { Keyboard } from 'lucide-react'
import { Sheet } from './Sheet'

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl K', description: 'Open the command palette' },
  { keys: '?', description: 'Show this help' },
  { keys: 'Esc', description: 'Close the open dialog' },
  { keys: 'Enter', description: 'Edit the focused transaction' },
]

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ open, onClose }) => (
  <Sheet
    open={open}
    onClose={onClose}
    desktop="modal"
    ariaLabel="Keyboard shortcuts"
    title={<><Keyboard className="w-5 h-5 text-accent" aria-hidden="true" /> Keyboard shortcuts</>}
    panelClassName="themed-menu desktop:rounded-lg w-full max-w-sm desktop:p-5"
    contentClassName="flex flex-col gap-3"
  >
    <h2 className="hidden desktop:flex items-center gap-2 text-[17px] font-semibold text-text-primary">
      <Keyboard className="w-5 h-5 text-accent" aria-hidden="true" /> Keyboard shortcuts
    </h2>
    <dl className="flex flex-col gap-2">
      {SHORTCUTS.map((s) => (
        <div key={s.keys} className="flex items-center justify-between gap-4">
          <dd className="text-[13px] text-text-secondary order-2">{s.description}</dd>
          <dt className="order-1">
            <kbd className="text-meta px-1.5 py-0.5 rounded border border-border text-text-secondary">{s.keys}</kbd>
          </dt>
        </div>
      ))}
    </dl>
  </Sheet>
)
