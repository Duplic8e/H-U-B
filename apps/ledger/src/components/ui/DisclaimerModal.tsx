import React from 'react'
import { Info, X } from 'lucide-react'
import { DISCLAIMER_TEXT } from '../../utils/disclaimer'
import { Sheet } from './Sheet'

interface DisclaimerModalProps {
  isOpen: boolean
  /** First launch: "I Understand" ack button, no dismiss-on-backdrop. */
  requireAck: boolean
  onClose: () => void
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, requireAck, onClose }) => {
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      desktop="modal"
      dismissible={!requireAck}
      ariaLabel="Disclaimer"
      title={<><Info className="w-5 h-5 text-accent" aria-hidden="true" /> A Quick Note</>}
      panelClassName="themed-menu desktop:rounded-lg w-full max-w-md desktop:p-6"
      contentClassName="flex flex-col gap-4"
    >
      <div className="hidden desktop:flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-text-primary">
          <Info className="w-5 h-5 text-accent" /> A Quick Note
        </h2>
        {!requireAck && (
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-accent rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <p className="text-[13px] leading-relaxed text-text-secondary">{DISCLAIMER_TEXT}</p>
      <button
        onClick={onClose}
        className="self-end px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
      >
        {requireAck ? 'I Understand' : 'Close'}
      </button>
    </Sheet>
  )
}
