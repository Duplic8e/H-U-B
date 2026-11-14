import React, { useContext } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getTool } from '../components/planner/toolRegistry'
import { PLANNER_TOOL_COMPONENTS } from '../components/planner/toolComponents'
import { ToolSwitcher } from '../components/planner/ToolSwitcher'
import { ToolInfoButton } from '../components/planner/ToolInfoButton'
import { PhoneToolPage } from '../components/planner/PhoneToolPage'
import { TopBarSlotContext } from '../components/topBarSlot'
import { useIsDesktop } from '../hooks/useMediaQuery'

export const PlannerTool: React.FC = () => {
  const { toolId } = useParams()
  const isDesktop = useIsDesktop()
  const slot = useContext(TopBarSlotContext)
  const navigate = useNavigate()
  const tool = getTool(toolId)
  if (!tool) return <Navigate to="/planner" replace />
  const Component = PLANNER_TOOL_COMPONENTS[tool.id]
  if (!Component) return <Navigate to="/planner" replace />

  if (!isDesktop) {
    // Rule 1 of docs/mobile-layout-rules.md: the back control and the tool
    // switcher replace the Ledger mark in the top bar, and the breadcrumb
    // header (about 110px of the first screen) is gone. The h1 stays in
    // <main>, visually hidden. Without a slot (unit tests, or the frame before
    // Layout's ref attaches) the same controls render in the page instead.
    const bar = (
      <>
        <button
          type="button"
          onClick={() => navigate('/planner')}
          aria-label="Back to Planner"
          className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 rounded-full text-text-secondary hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <ToolSwitcher current={tool} phone />
      </>
    )
    return (
      <div className="flex flex-col gap-3 w-full min-h-full animate-fade-in">
        <h1 className="sr-only">{tool.name}</h1>
        {slot ? (
          createPortal(bar, slot)
        ) : (
          <header className="flex items-center gap-2">{bar}</header>
        )}
        <PhoneToolPage key={tool.id} tool={tool}>
          <Component />
        </PhoneToolPage>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full min-h-full animate-fade-in">
      <header className="flex items-center gap-2">
        <Link
          to="/planner"
          aria-label="Back to Planner"
          className="text-[24px] font-semibold text-text-secondary hover:text-accent transition-colors"
        >
          Planner
        </Link>
        <span className="text-[24px] text-text-secondary">/</span>
        <ToolSwitcher current={tool} />
        <ToolInfoButton tool={tool} />
      </header>
      <Component />
    </div>
  )
}
