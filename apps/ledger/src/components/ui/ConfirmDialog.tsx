import React from 'react'
import { Sheet } from './Sheet'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'accent' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

/** Themed replacement for window.confirm. Escape / scrim click cancel via Sheet. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'accent',
  onConfirm,
  onCancel,
}) => (
  <Sheet
    open={open}
    onClose={onCancel}
    desktop="modal"
    ariaLabel={title}
    title={title}
    panelClassName="themed-menu desktop:rounded-lg w-full max-w-sm desktop:p-5"
    contentClassName="flex flex-col gap-3"
  >
    <h2 className="hidden desktop:block text-[16px] font-semibold text-text-primary">{title}</h2>
    <div className="text-[13px] text-text-secondary">{message}</div>
    <div className="flex justify-end gap-2 mt-1">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-text-primary transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-opacity hover:opacity-90 ${
          tone === 'danger'
            ? 'bg-error text-[var(--color-bg-primary)]'
            : 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  </Sheet>
)
