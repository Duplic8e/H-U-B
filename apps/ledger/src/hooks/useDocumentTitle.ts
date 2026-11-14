import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PLANNER_TOOLS } from '../components/planner/toolRegistry'

const ROUTE_NAMES: Record<string, string> = {
  '/': 'Dashboard',
  '/budget': 'Budgeting',
  '/investments': 'Investments',
  '/planner': 'Planner',
  '/compensation': 'Compensation',
}

/** Every route shared one title, so browser tabs, history entries and
 *  bookmarks were indistinguishable (WCAG 2.4.2), and a screen reader had no
 *  signal that the view had changed. Returns the plain route name so Layout
 *  can also push it into the route live region. */
export function useDocumentTitle(): string {
  const { pathname } = useLocation()

  const toolId = pathname.startsWith('/planner/') ? pathname.slice('/planner/'.length) : null
  const tool = toolId ? PLANNER_TOOLS.find((t) => t.id === toolId) : undefined
  const name = tool?.name ?? ROUTE_NAMES[pathname] ?? null

  useEffect(() => {
    document.title = name ? `${name} - Ledger` : 'Ledger'
  }, [name])

  return name ?? 'Ledger'
}
