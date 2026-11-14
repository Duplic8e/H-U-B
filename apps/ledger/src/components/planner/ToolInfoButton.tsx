import React, { useRef, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import type { PlannerTool } from './toolRegistry'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { Sheet } from '../ui/Sheet'

/** The info content, shared by the desktop icon button and the phone notice and
 *  bottom button. Desktop anchors it to anchorRef; a phone shows it as a bottom sheet. */
export const ToolInfoSheet: React.FC<{
  tool: PlannerTool
  open: boolean
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
}> = ({ tool, open, onClose, anchorRef }) => {
  const isDesktop = useIsDesktop()
  return (
  <Sheet
    open={open}
    onClose={onClose}
    desktop="popover"
    anchorRef={anchorRef}
    ariaLabel={`${tool.name} help`}
    panelClassName="w-[32rem] max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-y-auto themed-menu rounded-lg shadow-xl p-4 flex flex-col gap-3"
  >
    {isDesktop ? (
      <>
        <h3 className="text-[15px] font-semibold text-text-primary">{tool.name}</h3>
        <p className="text-[13px] text-text-secondary">{tool.info.howTo}</p>
        <div className="flex flex-col gap-2">
          <span className="text-meta font-semibold uppercase tracking-wide text-text-secondary">Parameters</span>
          {tool.info.params.map((p) => (
            <div key={p.name} className="text-[13px]">
              <span className="font-medium text-text-primary">{p.name}</span>
              <span className="text-text-secondary"> : {p.description}</span>
            </div>
          ))}
        </div>
      </>
    ) : (
      // Phone: the how-to up front, each input a row that opens to its description, so a
      // long input list (the Forecaster has a dozen) stays short until you ask for one.
      <div className="flex flex-col gap-3">
        <h3 className="text-[18px] font-semibold text-text-primary">{tool.name}</h3>
        <p className="text-[14px] text-text-secondary">{tool.info.howTo}</p>
        <h4 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">Inputs</h4>
        <div className="rounded-2xl border border-border bg-bg-secondary divide-y divide-border overflow-hidden">
          {tool.info.params.map((p) => (
            <details key={p.name} className="group">
              <summary className="flex items-center gap-2 px-3 min-h-12 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="flex-1 text-[14px] font-medium text-text-primary">{p.name}</span>
                <ChevronDown className="w-4 h-4 text-text-secondary transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="px-3 pb-3 text-[13px] text-text-secondary">{p.description}</p>
            </details>
          ))}
        </div>
      </div>
    )}
  </Sheet>
  )
}

/** Desktop: the info icon beside the tool title. Phones use PhoneToolPage instead. */
export const ToolInfoButton: React.FC<{ tool: PlannerTool }> = ({ tool }) => {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label="Tool Overview"
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-full text-text-secondary hover:text-accent transition-colors min-h-[44px] min-w-[44px] desktop:min-h-0 desktop:min-w-0 flex items-center justify-center"
      >
        <Info className="w-4 h-4" />
      </button>
      <ToolInfoSheet tool={tool} open={open} onClose={() => setOpen(false)} anchorRef={btnRef} />
    </div>
  )
}
