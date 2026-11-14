import React, { useContext } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { TopBarSlotContext } from '../topBarSlot'

interface PageHeaderProps {
  title: string
  /** Desktop only. A phone has no room for a sentence above the data. */
  subtitle?: React.ReactNode
  /** Desktop only: the controls at the header's right edge. */
  actions?: React.ReactNode
  /** Phone only: the page's one main action, shown in the top bar. Use a
   *  TopBarAction whose label matches the desktop button's name. */
  phoneAction?: React.ReactNode
  className?: string
}

/** Rule 1 of docs/mobile-layout-rules.md. On a phone the title and main
 *  action move into Layout's top bar, so the first screen goes to data and
 *  the action stays reachable at any scroll depth. The <h1> stays in <main>,
 *  visually hidden, so the heading outline and the skip link are the same on
 *  every device; the visible top bar copy is aria-hidden so a screen reader
 *  does not hear the title twice. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, phoneAction, className = '' }) => {
  const isDesktop = useIsDesktop()
  const slot = useContext(TopBarSlotContext)

  if (isDesktop) {
    return (
      <header className={`flex flex-wrap justify-between items-center gap-4 ${className}`}>
        <div>
          <h1 className="text-[24px] font-semibold text-text-primary">{title}</h1>
          {subtitle && <p className="text-[14px] text-text-secondary mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-4 items-center">{actions}</div>}
      </header>
    )
  }

  // No slot means no Layout around the page (unit tests) or the frame before
  // Layout's ref attaches. A visible compact header keeps the page usable.
  if (!slot) {
    return (
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-[20px] font-semibold text-text-primary">{title}</h1>
        {phoneAction}
      </header>
    )
  }

  return (
    <>
      <h1 className="sr-only">{title}</h1>
      {createPortal(
        <>
          <span
            aria-hidden="true"
            data-testid="topbar-title"
            className="flex-1 min-w-0 truncate text-[clamp(22px,7.2vw,28px)] leading-tight font-bold tracking-tight text-text-primary"
          >
            {title}
          </span>
          {phoneAction}
        </>,
        slot,
      )}
    </>
  )
}

interface TopBarActionProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  /** primary for an action that creates something, quiet for one that only
   *  changes a preference, the same split the desktop header buttons make. */
  tone?: 'primary' | 'quiet'
}

/** A 44px hit area around a 34px visual, so it clears the tap-target guard
 *  without outweighing the Search and Settings icons beside it. The primary
 *  tone is a soft accent tint rather than a solid disc because a filled green
 *  circle next to two plain icons read as a different kind of control. */
export const TopBarAction: React.FC<TopBarActionProps> = ({ icon: Icon, label, onClick, tone = 'primary' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
  >
    <span
      className={`flex items-center justify-center w-[34px] h-[34px] rounded-full transition-colors ${
        tone === 'primary'
          ? 'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] text-accent'
          : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
    </span>
  </button>
)
