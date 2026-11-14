import React from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { useDashboardLayoutStore } from '../../store/useDashboardLayoutStore'
import { DASHBOARD_WIDGET_LABELS } from '../../pages/dashboardWidgets'
import { Checkbox } from '../ui/Checkbox'
import { InfoButton } from '../ui/InfoButton'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { CustomizeDashboardMobile } from './CustomizeDashboardMobile'

const NOTE = 'Switch cards off and set their order. This applies to this device only.'

interface CustomizeDashboardProps {
  open: boolean
  onClose: () => void
  /** Ids in their current display order, hidden ones included. */
  orderedIds: string[]
}

/** Show, hide and reorder dashboard widgets. The up/down buttons exist because
 *  dragging is desktop only, so this is the only way to reorder on a phone. */
export const CustomizeDashboard: React.FC<CustomizeDashboardProps> = ({ open, onClose, orderedIds }) => {
  const hidden = useDashboardLayoutStore((s) => s.hidden)
  const toggleHidden = useDashboardLayoutStore((s) => s.toggleHidden)
  const moveBy = useDashboardLayoutStore((s) => s.moveBy)
  const isDesktop = useIsDesktop()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      desktop="modal"
      ariaLabel="Customize Dashboard"
      title={
        <span className="flex items-center gap-1">
          Customize Dashboard
          <InfoButton label="About Customize Dashboard" inline><p>{NOTE}</p></InfoButton>
        </span>
      }
      panelClassName="w-full max-w-md bg-[var(--color-bg-primary)] desktop:rounded-xl shadow-lg border border-[var(--color-border)]"
      contentClassName="flex flex-col gap-1 p-4"
    >
      {!isDesktop && <CustomizeDashboardMobile orderedIds={orderedIds} />}
      {isDesktop && <p className="text-[13px] text-text-secondary mb-2">
        Switch widgets off and set their order. This applies to this device only.
      </p>}
      {isDesktop && orderedIds.map((id, i) => {
        const label = DASHBOARD_WIDGET_LABELS[id] ?? id
        return (
          <div key={id} className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-bg-secondary">
            <Checkbox
              ariaLabel={`Show ${label}`}
              checked={!hidden.includes(id)}
              onChange={() => toggleHidden(id)}
            />
            <span className="flex-1 text-[14px] text-text-primary truncate">{label}</span>
            <button
              type="button"
              aria-label={`Move ${label} up`}
              disabled={i === 0}
              onClick={() => moveBy(id, -1, orderedIds)}
              className="p-2 text-text-secondary hover:text-text-primary rounded-md disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              aria-label={`Move ${label} down`}
              disabled={i === orderedIds.length - 1}
              onClick={() => moveBy(id, 1, orderedIds)}
              className="p-2 text-text-secondary hover:text-text-primary rounded-md disabled:opacity-30"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        )
      })}
    </Sheet>
  )
}
