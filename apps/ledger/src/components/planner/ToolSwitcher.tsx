import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { PLANNER_GROUPS, PLANNER_TOOLS, type PlannerTool } from './toolRegistry'
import { Sheet } from '../ui/Sheet'

interface ToolSwitcherProps {
  current: PlannerTool
  /** Phone top bar variant: one truncating line, no <h1> (the page keeps its
   *  own visually hidden one). */
  phone?: boolean
}

/** Page title that doubles as a grouped tool-switch dropdown, so moving
 *  between planner tools never requires a round-trip through the hub. */
export const ToolSwitcher: React.FC<ToolSwitcherProps> = ({ current, phone = false }) => {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  return (
    <div className={phone ? 'relative flex-1 min-w-0' : 'relative'}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          phone
            ? 'flex items-center gap-1 w-full min-h-[44px] min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded'
            : 'flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded'
        }
      >
        {phone ? (
          <span className="min-w-0 flex-1 truncate text-left text-[17px] font-semibold text-text-primary">{current.name}</span>
        ) : (
          <h1 className="text-[24px] font-semibold text-text-primary">{current.name}</h1>
        )}
        <ChevronDown className={`w-5 h-5 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        desktop="popover"
        anchorRef={btnRef}
        ariaLabel="Switch tool"
        scrollCue
        panelClassName="w-72 max-w-[calc(100vw-1rem)] themed-menu rounded-lg shadow-xl p-2 flex flex-col gap-1"
      >
        <div role="menu" className="desktop:max-h-[70vh] desktop:overflow-y-auto flex flex-col gap-1">
          {PLANNER_GROUPS.map((group) => {
              const tools = PLANNER_TOOLS.filter((t) => t.group === group)
              if (tools.length === 0) return null
              return (
                <div key={group} className="flex flex-col">
                  <span className="px-2 pt-2 pb-1 text-meta font-semibold uppercase tracking-wide text-text-secondary">{group}</span>
                  {tools.map((t) => {
                    const Icon = t.icon
                    const isCurrent = t.id === current.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpen(false)
                          if (!isCurrent) navigate(`/planner/${t.id}`)
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-[14px] transition-colors ${
                          isCurrent ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary hover:bg-accent/10 hover:text-accent'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {t.name}
                      </button>
                    )
                  })}
                </div>
              )
            })}
        </div>
      </Sheet>
    </div>
  )
}
