import React, { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { Sheet } from './Sheet'

interface ThemedDatePickerProps {
  id?: string
  ariaLabel?: string
  value: string // YYYY-MM-DD ('' allowed)
  onChange: (value: string) => void
  className?: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const pad = (n: number) => String(n).padStart(2, '0')

/** Theme-aware replacement for <input type="date">: themed month-grid
 *  calendar popover. */
export const ThemedDatePicker: React.FC<ThemedDatePickerProps> = ({ id, ariaLabel, value, onChange, className = '' }) => {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10)
  const [viewYear, setViewYear] = useState(Number(initial.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(Number(initial.slice(5, 7)) - 1) // 0-based

  useEffect(() => {
    if (!open || !isDesktop) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open, isDesktop])

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const pick = (day: number) => {
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`)
    setOpen(false)
  }

  const calendar = (
    <>
      <div className="flex items-center justify-between mb-2">
        <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-bg-primary/50 text-text-secondary hover:text-accent">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[14px] font-medium text-text-primary">{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-bg-primary/50 text-text-secondary hover:text-accent">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div role="grid" className="grid grid-cols-7 gap-0.5 text-center">
        {DOW.map((d) => (
          <span key={d} className="text-meta text-text-secondary py-1">{d}</span>
        ))}
        {Array.from({ length: firstDow }, (_, i) => <span key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const isSelected = iso === value
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              onClick={() => pick(day)}
              className={`text-[13px] rounded py-1 transition-colors ${
                isSelected ? 'bg-accent/20 text-accent font-semibold' : 'text-text-primary hover:bg-bg-primary/50'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        aria-label={ariaLabel}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 bg-bg-primary/50 border control-border rounded-lg px-3 py-2 text-text-primary text-[15px] focus:border-accent transition-colors ${className}`}
      >
        <span>{value || 'Select Date'}</span>
        <Calendar className="w-4 h-4 shrink-0 text-text-secondary" />
      </button>
      {open && isDesktop && (
          <div className="absolute left-0 top-full mt-1 z-40 w-64 max-w-[calc(100vw-1rem)] themed-menu border border-border rounded-lg shadow-xl p-3 animate-dropdown-in">
            {calendar}
          </div>
      )}
      {!isDesktop && (
        <Sheet open={open} onClose={() => setOpen(false)} desktop="modal" ariaLabel="Pick a date" panelClassName="w-full">
          {calendar}
        </Sheet>
      )}
    </div>
  )
}
