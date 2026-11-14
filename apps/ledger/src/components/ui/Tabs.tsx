import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useIsDesktop } from '../../hooks/useMediaQuery'

export interface TabItem<T extends string> {
  id: T
  label: string
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** Names the tablist for screen readers, for example "Budgeting sections". */
  ariaLabel: string
  className?: string
}

/** The app's tab strips were plain buttons: a screen reader announced all of
 *  them identically with no indication of which was active, and a keyboard
 *  user had to Tab through every one. This is the WAI-ARIA tabs pattern:
 *  roving tabindex, arrow keys with wraparound, Home and End.
 *
 *  Desktop keeps bordered pills. On a phone four bordered buttons in a row
 *  read as a set of actions rather than navigation, so the strip becomes an
 *  underline tab row that scrolls sideways when the labels do not fit. */
export function Tabs<T extends string>({ items, value, onChange, ariaLabel, className = '' }: TabsProps<T>) {
  const isDesktop = useIsDesktop()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const listRef = useRef<HTMLDivElement | null>(null)
  const [moreToRight, setMoreToRight] = useState(false)

  const selectedIndex = items.findIndex((t) => t.id === value)
  // If value matches no item, aria-selected is false on every tab, but the
  // strip still needs exactly one tab in the page tab order or a keyboard
  // user can never enter it. Tab 0 gets the roving tabindex by default.
  const rovingIndex = selectedIndex >= 0 ? selectedIndex : 0

  // The fade only belongs while content is hidden past the right edge, so it
  // is recomputed on scroll and whenever the strip or its tabs change size.
  const updateFade = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setMoreToRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1)
  }, [])

  useEffect(() => {
    if (isDesktop) return
    // jsdom has no scrollIntoView. The active tab must stay reachable when the
    // row is scrolled, and 'nearest' avoids moving the page vertically.
    const active = refs.current[value]
    if (typeof active?.scrollIntoView === 'function') {
      active.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }
  }, [isDesktop, value])

  useEffect(() => {
    if (isDesktop) return
    const el = listRef.current
    if (!el) return
    updateFade()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateFade)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isDesktop, items, updateFade])

  const focusAndSelect = (id: T) => {
    onChange(id)
    // Every tab button is always mounted (no tab is ever conditionally
    // rendered), so the node already exists and .focus() works synchronously
    // even though its tabIndex has not been re-rendered yet.
    refs.current[id]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = rovingIndex
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusAndSelect(items[(index + 1) % items.length].id)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      focusAndSelect(items[(index - 1 + items.length) % items.length].id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusAndSelect(items[0].id)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusAndSelect(items[items.length - 1].id)
    }
  }

  const listClass = isDesktop
    ? `flex flex-wrap gap-2 ${className}`
    : `tabs-scroll scroll-pr-8 flex flex-nowrap overflow-x-auto border-b border-border ${moreToRight ? 'tabs-fade-end' : ''} ${className}`

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onScroll={isDesktop ? undefined : updateFade}
      className={listClass}
    >
      {items.map((item, i) => {
        const active = item.id === value
        const buttonClass = isDesktop
          ? `px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active
                ? 'border-accent text-accent bg-accent/10'
                : 'control-border text-text-secondary hover:text-text-primary'
            }`
          : `flex-auto min-w-fit shrink-0 whitespace-nowrap text-center min-h-[44px] px-1.5 -mb-px text-[14px] font-medium bg-transparent border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`
        return (
          <button
            key={item.id}
            ref={(el) => { refs.current[item.id] = el }}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${item.id}`}
            tabIndex={i === rovingIndex ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={buttonClass}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
