import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({
  title,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="themed-card rounded-lg p-4">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="w-4 h-4 text-text-secondary" /> : <ChevronRight className="w-4 h-4 text-text-secondary" />}
        <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}
