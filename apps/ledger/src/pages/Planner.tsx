import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { PLANNER_GROUPS, PLANNER_TOOLS } from '../components/planner/toolRegistry'
import { useIsDesktop } from '../hooks/useMediaQuery'

export const Planner: React.FC = () => {
  const isDesktop = useIsDesktop()
  return (
    <div className={`flex flex-col ${isDesktop ? 'gap-8' : 'gap-5'} w-full min-h-full animate-fade-in`}>
      <PageHeader
        title="Planner"
        subtitle="Financial tools and calculators. Every input is saved automatically."
      />
      {PLANNER_GROUPS.map((group) => {
        const tools = PLANNER_TOOLS.filter((t) => t.group === group)
        if (tools.length === 0) return null
        if (!isDesktop) {
          // Phone: one divided list per section, name only. The descriptions live
          // in each tool's own info button, so the hub stays a short scannable list.
          return (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{group}</h2>
              <div className="themed-card rounded-2xl divide-y divide-border overflow-hidden">
                {tools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <Link
                      key={tool.id}
                      to={`/planner/${tool.id}`}
                      className="flex items-center gap-3 px-4 min-h-14 hover:bg-bg-secondary transition-colors"
                    >
                      <Icon className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-[16px] font-medium text-text-primary">{tool.name}</span>
                      <ChevronRight className="w-4 h-4 text-text-secondary" aria-hidden="true" />
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        }
        // One expression for every section, so all sections always agree with
        // each other. They used to pick 2 or 3 columns from how many tools they
        // held, so card widths changed halfway down a page of otherwise
        // identical cards. The count still steps with the viewport: forcing 3
        // columns from md up puts 133px cards on a 768px tablet and wraps the
        // longer tool names onto four lines.
        const gridCols = 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        return (
          <section key={group} className="flex flex-col gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{group}</h2>
            <div className={`grid gap-6 ${gridCols}`}>
              {tools.map((tool) => {
                const Icon = tool.icon
                return (
                  <Link
                    key={tool.id}
                    to={`/planner/${tool.id}`}
                    className="themed-card rounded-lg p-4 flex flex-col gap-2 hover:border-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-accent" />
                      <h3 className="text-[16px] font-semibold text-text-primary">{tool.name}</h3>
                    </div>
                    <p className="text-[13px] text-text-secondary">{tool.description}</p>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
