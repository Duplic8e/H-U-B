import { PLANNER_TOOLS } from './planner/toolRegistry'

export interface CommandAction {
  id: string
  label: string
  hint: string
  path: string
}

const MODULES: CommandAction[] = [
  { id: 'nav-dashboard', label: 'Dashboard', hint: 'Overview, net worth, rollups', path: '/' },
  { id: 'nav-budget', label: 'Budgeting', hint: 'Transactions, CSV import, insights', path: '/budget' },
  { id: 'nav-investments', label: 'Investments', hint: 'Plan vs actual, portfolio', path: '/investments' },
  { id: 'nav-planner', label: 'Planner', hint: 'Calculators and forecaster', path: '/planner' },
  { id: 'nav-compensation', label: 'Compensation', hint: 'Salary, RSU, ESPP', path: '/compensation' },
]

export function buildActions(): CommandAction[] {
  return [
    ...MODULES,
    ...PLANNER_TOOLS.map((t) => ({
      id: `tool-${t.id}`,
      label: t.name,
      hint: t.description,
      path: `/planner/${t.id}`,
    })),
  ]
}

export function filterActions(actions: CommandAction[], query: string): CommandAction[] {
  const q = query.trim().toLowerCase()
  if (!q) return actions
  return actions.filter((a) => a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q))
}
