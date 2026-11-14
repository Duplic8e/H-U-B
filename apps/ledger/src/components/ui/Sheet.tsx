import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useIsDesktop, usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { useScrollLock } from '../../hooks/useScrollLock'
import { shouldDismissOnDragEnd } from './sheetGestures'
import { useDeferredUnmount } from './useDeferredUnmount'

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Desktop rendering. 'modal' = centered dialog; 'popover' = anchored to anchorRef. Default 'modal'. */
  desktop?: 'modal' | 'popover'
  /** Required when desktop='popover': the trigger element to anchor to on desktop. */
  anchorRef?: React.RefObject<HTMLElement | null>
  /** When false, scrim-tap / swipe / Esc do NOT close (caller-controlled dismissal, e.g. required disclaimer). Default true. */
  dismissible?: boolean
  ariaLabel?: string
  labelledBy?: string
  /** Optional title shown in the mobile sheet header row (desktop ignores it; callers keep their own headers). */
  title?: React.ReactNode
  /** DESKTOP-only panel classes (max-width, rounding, padding). NOT applied to the mobile
   *  bottom sheet, which is always full-width with its own chrome. Put content-layout classes
   *  (flex/gap) in contentClassName so they apply in both modes. */
  panelClassName?: string
  /** Classes for the content wrapper around children, applied in BOTH desktop and mobile
   *  (e.g. "flex flex-col gap-3"). This is where per-modal content spacing belongs. */
  contentClassName?: string
  /** Mobile bottom sheet only. Phone sheets dismiss by swipe, scrim tap and Escape and render
   *  no X. Pass true only for a sheet with no other way out; nothing does today. Default false. */
  showClose?: boolean
  /** Mobile bottom sheet only. Hides the panel scrollbar and shows a bottom fade while more
   *  content lies below, so the list still reads as scrollable. Default false. */
  scrollCue?: boolean
  /** Mobile bottom sheet only. For an untitled sheet whose first content row is its own
   *  sticky bar (the command palette): the header shrinks to the drag handle so that row
   *  sits close under it. Default false. */
  compactHeader?: boolean
  children: React.ReactNode
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'

// The hidden phone Close button (sr-only until focused). It is part of the Tab order but is
// never the element focused on open, or it would flash into view for every sheet.
const HIDDEN_CLOSE_ATTR = 'data-sheet-hidden-close'

// True when the element and every ancestor up to the panel is actually rendered. Callers keep
// desktop-only controls in the DOM as `hidden desktop:flex`; on a phone those are display:none
// and cannot take focus, so both the open-focus and the Tab trap must skip them. Walking
// computed styles (not getClientRects) keeps this working in jsdom, which has no layout.
function isRendered(el: HTMLElement, root: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    if (n === root) break
  }
  return true
}

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((n) => isRendered(n, root))
}

// Module-level stack of currently-open Sheet instance ids, topmost last.
// Mirrors useScrollLock's module-level ref-counting pattern so stacked
// Sheets (e.g. a ThemedSelect's own Sheet opened inside a modal Sheet) can
// tell which one is on top without any prop-drilled context.
const openStack: string[] = []

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  desktop = 'modal',
  anchorRef,
  dismissible = true,
  ariaLabel,
  labelledBy,
  title,
  panelClassName = '',
  contentClassName = '',
  showClose = false,
  scrollCue = false,
  compactHeader = false,
  children,
}) => {
  const isDesktop = useIsDesktop()
  const reduced = usePrefersReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)
  const instanceId = useId()
  useScrollLock(open)

  // Was AnimatePresence: keep the sheet mounted long enough for the CSS exit
  // transition to finish. The duration must match whichever panel variant is
  // about to render, since a mismatch would either cut the animation short or
  // hold the sheet mounted (and blocking pointer events via the scrim) after
  // it has visually finished closing.
  const exitMs = reduced ? 0 : isDesktop ? (desktop === 'popover' ? 120 : 150) : 220
  const { mounted, state } = useDeferredUnmount(open, exitMs)

  // Register/unregister this instance on the shared stacking-order stack
  // whenever it opens or closes (regardless of dismissibility: a
  // non-dismissible Sheet still occupies the top layer and should still
  // block Escape from reaching sheets stacked below it).
  useEffect(() => {
    if (!open) return
    openStack.push(instanceId)
    return () => {
      const i = openStack.indexOf(instanceId)
      if (i !== -1) openStack.splice(i, 1)
    }
  }, [open, instanceId])

  // Escape closes only the topmost stacked Sheet.
  useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (openStack[openStack.length - 1] !== instanceId) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose, instanceId])

  // Focus management: focus the panel on open, restore to trigger on close.
  // Desktop keeps its original behaviour: it looks for the panel at the moment `open` flips,
  // and when the sheet was closed (so not yet mounted) there is nothing to focus.
  const phoneFocused = useRef(false)
  useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement as HTMLElement
      if (!isDesktop) return
      const el = panelRef.current
      const focusable = el ? visibleFocusables(el)[0] : undefined
      ;(focusable ?? el)?.focus()
    } else {
      lastFocused.current?.focus?.()
    }
    // isDesktop is read only at the moment of opening; a breakpoint change must not refocus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Phone: the panel only exists once `mounted` catches up with `open` (one render later for a
  // sheet that was closed), so focus has to wait for it, or it never enters the sheet and the
  // next Tab starts from <body>.
  useEffect(() => {
    if (!open) {
      phoneFocused.current = false
      return
    }
    const el = panelRef.current
    if (isDesktop || !mounted || !el || phoneFocused.current) return
    phoneFocused.current = true
    // Something inside the sheet already took focus (the palette's search field), keep it.
    if (el.contains(document.activeElement)) return
    // Focus the first visible control, else the panel. The hidden Close button is skipped or it
    // would flash into view for every sheet, and so are text fields, where focusing one raises
    // the keyboard over a sheet the person has only just opened.
    const focusable = visibleFocusables(el).find(
      (n) =>
        !n.hasAttribute(HIDDEN_CLOSE_ATTR) &&
        !n.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea')
    )
    ;(focusable ?? el).focus()
  }, [open, mounted, isDesktop])

  // Focus trap: keep Tab/Shift+Tab cycling within the panel while open.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const el = panelRef.current
      if (!el) return
      const focusables = visibleFocusables(el)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Desktop popover anchor position.
  const POPOVER_MARGIN = 8
  const POPOVER_FALLBACK_WIDTH = 320
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    if (!open || !isDesktop || desktop !== 'popover' || !anchorRef?.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const panelWidth = panelRef.current?.getBoundingClientRect().width || POPOVER_FALLBACK_WIDTH
    const panelHeight = panelRef.current?.getBoundingClientRect().height || 0
    const maxLeft = window.innerWidth - POPOVER_MARGIN - panelWidth
    const left = Math.min(Math.max(r.left, POPOVER_MARGIN), Math.max(maxLeft, POPOVER_MARGIN))
    let top = r.bottom + POPOVER_MARGIN
    if (panelHeight && top + panelHeight > window.innerHeight) {
      const above = r.top - POPOVER_MARGIN - panelHeight
      if (above >= POPOVER_MARGIN) top = above
    }
    setPos({ top, left })
  }, [open, isDesktop, desktop, anchorRef])

  // Swipe-to-dismiss on the mobile panel. shouldDismissOnDragEnd is the same
  // pure, tested threshold function the old drag gesture used, so the
  // dismissal feel is unchanged by construction.
  const dragStart = useRef<{ y: number; t: number } | null>(null)
  const dragCaptured = useRef(false)
  const [dragY, setDragY] = useState(0)

  // Scroll cue: true while the panel has content below the visible area.
  const [moreBelow, setMoreBelow] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const updateMoreBelow = () => {
    const el = panelRef.current
    if (!el) return
    setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }
  // Top fade: true once the panel has scrolled, so content does not end in a hard cut under
  // the sheet's top edge. The mirror of the bottom cue, for every phone sheet.
  const [scrolledDown, setScrolledDown] = useState(false)
  const onPanelScroll = () => {
    const el = panelRef.current
    if (el) setScrolledDown(el.scrollTop > 4)
    if (scrollCue) updateMoreBelow()
  }
  // A sheet closed while scrolled would otherwise reopen with a stale top fade, so both cues
  // reset the moment it opens (adjusting state during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setScrolledDown(false)
      setMoreBelow(false)
    }
  }
  useEffect(() => {
    if (!open || !mounted || !scrollCue || isDesktop) return
    updateMoreBelow()
    const el = panelRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(updateMoreBelow)
    ro.observe(el)
    if (contentRef.current) ro.observe(contentRef.current)
    return () => ro.disconnect()
  }, [open, mounted, scrollCue, isDesktop])

  if (typeof document === 'undefined') return null

  const scrim = (
    <div
      data-testid="sheet-scrim"
      data-sheet="scrim"
      data-state={state}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
      onClick={() => dismissible && onClose()}
      aria-hidden="true"
    />
  )

  const commonPanelProps = {
    ref: panelRef,
    role: 'dialog',
    'aria-modal': true,
    'aria-label': ariaLabel,
    'aria-labelledby': labelledBy,
    tabIndex: -1,
    'data-testid': 'sheet-panel',
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  } as const

  // Desktop content wrapper: only wrap when a contentClassName is given, so modals
  // that don't need content-layout classes keep rendering children directly.
  const desktopContent = contentClassName ? <div className={contentClassName}>{children}</div> : children

  // ---- Desktop: modal (centered) ----
  if (isDesktop && desktop === 'modal') {
    return createPortal(
      mounted && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {scrim}
          {/* Centering lives on an inner min-h-full wrapper, NOT on the
              scroll container. `items-center` on a scroll container overflows
              a too-tall panel equally in both directions, and the part above
              the top edge cannot be scrolled back to, so the panel's header
              is permanently cut off. Growing this wrapper past the viewport
              instead keeps the whole panel reachable. */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              {...commonPanelProps}
              data-sheet="panel-desktop"
              data-state={state}
              className={`relative z-50 my-8 ${panelClassName}`}
            >
              {desktopContent}
            </div>
          </div>
        </div>
      ),
      document.body
    )
  }

  // ---- Desktop: popover (anchored) ----
  if (isDesktop && desktop === 'popover') {
    return createPortal(
      mounted && (
        <>
          {scrim}
          <div
            {...commonPanelProps}
            data-sheet="panel-desktop"
            data-state={state}
            className={`fixed z-50 ${panelClassName}`}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              maxWidth: 'calc(100vw - 16px)',
            }}
          >
            {desktopContent}
          </div>
        </>
      ),
      document.body
    )
  }

  // ---- Mobile: bottom sheet ----
  // Below this many px of vertical movement, a press-and-release is treated
  // as a tap, not a drag.
  const DRAG_CAPTURE_THRESHOLD = 4

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || !dismissible) return
    dragStart.current = { y: e.clientY, t: performance.now() }
    dragCaptured.current = false
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    const delta = e.clientY - dragStart.current.y
    // Only take pointer capture once real dragging is underway. Capturing
    // eagerly on pointerdown also retargets the compatibility mouse/click
    // event that follows a plain tap to this panel instead of whatever was
    // actually tapped, which silently broke every button and checkbox
    // inside the mobile sheet in real browsers. jsdom's fireEvent does not
    // reproduce that retargeting, so no unit test caught it; the desktop
    // e2e guards running against the short viewport's mobile-sheet layout
    // (submitting a transaction, saving an over-allocated split) did.
    if (!dragCaptured.current && Math.abs(delta) > DRAG_CAPTURE_THRESHOLD) {
      dragCaptured.current = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    // Downward only, matching the old dragElastic={{ top: 0, bottom: 0.6 }}.
    setDragY(Math.max(0, delta))
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    dragStart.current = null
    dragCaptured.current = false
    setDragY(0)
    if (!start) return
    const offsetY = e.clientY - start.y
    const seconds = Math.max(0.001, (performance.now() - start.t) / 1000)
    if (shouldDismissOnDragEnd(offsetY, offsetY / seconds)) onClose()
  }

  // The wrapper follows the visual viewport, not the layout one: with the keyboard open the
  // layout viewport is unchanged, so a bottom-anchored sheet would sit behind the keyboard.
  return createPortal(
    mounted && (
      <div
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        style={{ top: 'var(--app-viewport-top, 0px)', height: 'var(--app-viewport-height, 100%)' }}
      >
        {scrim}
        <div
          {...commonPanelProps}
          data-sheet="panel-mobile"
          data-state={state}
          className={`relative z-50 w-full overflow-y-auto rounded-t-2xl border-t border-border bg-[var(--dropdown-bg)] shadow-2xl${scrollCue ? ' phone-no-scrollbar' : ''}`}
          style={{
            paddingBottom: 'var(--safe-bottom)',
            // dvh does not shrink for the software keyboard, so a tall
            // sheet would put its lower fields behind it. The visual
            // viewport does shrink; dvh is the fallback where it is not
            // supported. See useViewportHeight.
            maxHeight: 'calc(0.9 * var(--app-viewport-height, 100dvh))',
            transform: dragY ? `translateY(${dragY}px)` : undefined,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onScroll={onPanelScroll}
        >
          {/* A zero-height sticky strip holds the drag handle and the top fade, so the handle
              stays pinned and the fade softens the edge where content scrolls away, without
              taking any layout height. */}
          <div data-testid="sheet-top-strip" className="sticky top-0 z-20 h-0">
            {scrolledDown && (
              <div
                data-testid="sheet-top-fade"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-[linear-gradient(to_bottom,var(--dropdown-bg)_50%,transparent)]"
              />
            )}
            <span className="absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
          </div>
          {/* Not sticky: a pinned title row costs phone screen height all the way down a long
              sheet, so it scrolls away with the content. The extra padding keeps the first
              content clear of the drag handle (about 24px handle-only). */}
          <div data-testid="sheet-header" className={`relative flex items-center gap-2 px-4 bg-[var(--dropdown-bg)] ${showClose || title != null ? 'pt-7 pb-2' : compactHeader ? 'pt-3' : 'pt-4 pb-5'}`}>
            {/* Sighted touch users never see this. It exists for screen readers and keyboards,
                which have no swipe or scrim: sr-only until focused, then a normal 44px control.
                It is the first focusable in the sheet so Tab reaches it at once. */}
            {dismissible && !showClose && (
              <button
                type="button"
                aria-label="Close"
                data-sheet-hidden-close=""
                onClick={onClose}
                className="tap-exempt sr-only focus:not-sr-only focus:absolute! focus:right-2 focus:top-1 focus:z-30 focus:flex focus:items-center focus:justify-center focus:min-h-[44px] focus:min-w-[44px] focus:bg-[var(--dropdown-bg)] text-text-secondary hover:text-text-primary rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            {title != null && (
              <h2 className="flex items-center gap-2 text-[16px] font-semibold text-text-primary">{title}</h2>
            )}
            {dismissible && showClose && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="ml-auto flex items-center justify-center min-h-[44px] min-w-[44px] desktop:min-h-0 desktop:min-w-0 desktop:p-1 text-text-secondary hover:text-text-primary rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div ref={contentRef} className={`px-4 pb-4 ${contentClassName}`}>{children}</div>
          {scrollCue && moreBelow && (
            <div
              data-testid="sheet-scroll-cue"
              aria-hidden="true"
              className="pointer-events-none sticky bottom-0 z-10 -mt-10 h-10 bg-gradient-to-t from-[var(--dropdown-bg)] to-transparent"
            />
          )}
        </div>
      </div>
    ),
    document.body
  )
}
