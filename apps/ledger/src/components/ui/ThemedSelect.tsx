import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { Sheet } from './Sheet'
import { menuPlacement } from './menuPlacement'

export interface ThemedSelectOption {
  value: string
  label: string
}

interface ThemedSelectProps {
  id?: string
  value: string
  options: ThemedSelectOption[]
  onChange: (value: string) => void
  className?: string
  /** Accessible name for the trigger, for selects with no visible label. */
  ariaLabel?: string
}

/** Theme-aware replacement for native <select>. Styled like the planner
 *  ToolSwitcher menu: themed card, accent highlight. */
export const ThemedSelect: React.FC<ThemedSelectProps> = ({ id, value, options, onChange, className = '', ariaLabel }) => {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [placement, setPlacement] = useState({ openUp: false, maxHeight: 256 })
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  const openListbox = () => {
    if (rootRef.current) {
      setPlacement(menuPlacement(rootRef.current.getBoundingClientRect(), window.innerHeight))
    }
    setHighlight(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  useEffect(() => {
    if (!open || !isDesktop) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open, isDesktop])

  const commit = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault(); openListbox(); return
    }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[highlight]) commit(options[highlight].value) }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openListbox())}
        onKeyDown={onKeyDown}
        className={`w-full flex items-center justify-between gap-2 bg-bg-primary/50 border control-border rounded-lg px-3 py-2 text-text-primary text-[15px] focus:border-accent transition-colors ${className}`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && isDesktop && (
          <div
            role="listbox"
            style={{ maxHeight: placement.maxHeight }}
            className={`absolute left-0 right-0 z-40 overflow-y-auto themed-menu border border-border rounded-lg shadow-xl p-1 flex flex-col animate-dropdown-in ${
              placement.openUp ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => commit(o.value)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-[14px] transition-colors ${
                  i === highlight ? 'bg-accent/10 text-accent' : 'text-text-primary'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
      )}
      {!isDesktop && (
        <Sheet open={open} onClose={() => setOpen(false)} desktop="modal" ariaLabel="Select an option" panelClassName="w-full">
          <div role="listbox" className="flex flex-col">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => commit(o.value)}
                className={`flex items-center justify-between gap-2 px-3 py-3 text-left text-[15px] rounded ${
                  o.value === value ? 'text-accent' : 'text-text-primary'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
