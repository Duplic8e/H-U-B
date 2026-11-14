import { buildActions, filterActions } from './commandActions'

describe('buildActions', () => {
  it('includes the five module routes and every planner tool', () => {
    const actions = buildActions()
    const paths = actions.map((a) => a.path)
    for (const p of ['/', '/budget', '/investments', '/planner', '/compensation']) {
      expect(paths).toContain(p)
    }
    expect(paths.some((p) => p.startsWith('/planner/'))).toBe(true)
  })
})

describe('filterActions', () => {
  const actions = buildActions()

  it('matches case-insensitively on label and hint', () => {
    expect(filterActions(actions, 'BUDG').some((a) => a.path === '/budget')).toBe(true)
    expect(filterActions(actions, 'zzz-no-match')).toHaveLength(0)
  })

  it('returns everything for an empty query', () => {
    expect(filterActions(actions, '')).toHaveLength(actions.length)
  })
})
