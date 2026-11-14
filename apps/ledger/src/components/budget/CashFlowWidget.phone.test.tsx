import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { CashFlowWidget } from './CashFlowWidget'
import { useBudgetStore } from '../../store/useBudgetStore'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

// vi.mock factories are hoisted above every import and top-level const, so
// the capture array has to be created with vi.hoisted, and the factory must
// not use JSX (that would reach for the JSX runtime import before it exists).
type ChartData = { nodes: { name: string; kind: string }[]; links: { source: number; target: number; value: number }[] }
const { captured, nodeRenderers } = vi.hoisted(() => ({ captured: [] as ChartData[], nodeRenderers: [] as ((props: never) => ReactNode)[] }))

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
    Sankey: ({ data, node }: { data: ChartData; node: (props: never) => ReactNode }) => {
      captured.push(data)
      nodeRenderers.push(node)
      return null
    },
  }
})

const budgetInitial = useBudgetStore.getState()
const range = { from: '2026-08', to: '2026-08' }

function seedEightAndEight() {
  const categoryGroups: Record<string, { id: string; name: string; kind: 'income' | 'expense' }> = {
    gi: { id: 'gi', name: 'Income', kind: 'income' },
  }
  const categories: Record<string, { id: string; groupId: string; name: string; targetAmount: number }> = {}
  const transactions: Record<string, object> = {}
  for (let i = 1; i <= 8; i++) {
    categories[`i${i}`] = { id: `i${i}`, groupId: 'gi', name: `Income ${i}`, targetAmount: 0 }
    transactions[`ti${i}`] = { id: `ti${i}`, date: '2026-08-02', amount: 1000 - i, description: 'in', type: 'income', categoryId: `i${i}` }
    categoryGroups[`ge${i}`] = { id: `ge${i}`, name: `Spend ${i}`, kind: 'expense' }
    categories[`e${i}`] = { id: `e${i}`, groupId: `ge${i}`, name: `Cat ${i}`, targetAmount: 0 }
    transactions[`te${i}`] = { id: `te${i}`, date: '2026-08-03', amount: 100 - i, description: 'out', type: 'expense', categoryId: `e${i}` }
  }
  useBudgetStore.setState({ categoryGroups, categories, transactions } as never)
}

beforeEach(() => {
  captured.length = 0
  nodeRenderers.length = 0
  useBudgetStore.setState(budgetInitial, true)
})
afterEach(() => resetMatchMedia())

describe('CashFlowWidget on a phone', () => {
  it('draws the top three sources and top four spending groups, folding the rest', () => {
    setMatchMedia(false)
    seedEightAndEight()
    render(<CashFlowWidget range={range} />)
    const names = captured.at(-1)!.nodes.map((n) => n.name)
    expect(names).toEqual([
      'Income 1', 'Income 2', 'Income 3', 'Other sources',
      'Income',
      'Spend 1', 'Spend 2', 'Spend 3', 'Spend 4', 'Other spending',
      'Savings',
    ])
  })

  it('still describes the real counts to a screen reader', () => {
    setMatchMedia(false)
    seedEightAndEight()
    render(<CashFlowWidget range={range} />)
    expect(screen.getByRole('img', { name: /across 8 sources .* across 8 groups/ })).toBeInTheDocument()
  })

  it('draws every category on desktop', () => {
    seedEightAndEight()
    render(<CashFlowWidget range={range} />)
    expect(captured.at(-1)!.nodes).toHaveLength(8 + 1 + 8 + 1)
  })

  it('folds credits separately from income and preserves source indices and totals', () => {
    setMatchMedia(false)
    seedEightAndEight()
    const state = useBudgetStore.getState()
    const categoryGroups = { ...state.categoryGroups }
    const categories = { ...state.categories }
    const transactions = { ...state.transactions }
    for (let i = 1; i <= 8; i++) {
      categoryGroups[`gc${i}`] = { id: `gc${i}`, name: `Credit ${i}`, kind: 'expense' }
      categories[`c${i}`] = { id: `c${i}`, groupId: `gc${i}`, name: `Credit category ${i}`, targetAmount: 0 }
      transactions[`tc${i}`] = { id: `tc${i}`, date: '2026-08-03', amount: -(50 - i), description: 'offset', type: 'expense', categoryId: `c${i}` }
    }
    useBudgetStore.setState({ categoryGroups, categories, transactions })
    render(<CashFlowWidget range={range} />)
    const { nodes, links } = captured.at(-1)!
    expect(nodes.map((n) => n.name)).toEqual([
      'Income 1', 'Income 2', 'Income 3', 'Other sources',
      'Credit 1 credit', 'Credit 2 credit', 'Credit 3 credit', 'Other expense credits',
      'Available funds', 'Spend 1', 'Spend 2', 'Spend 3', 'Spend 4', 'Other spending', 'Net remaining',
    ])
    expect(nodes.slice(4, 8).every((n) => n.kind === 'credit')).toBe(true)
    expect(links.slice(0, 8).map((l) => [l.source, l.target])).toEqual(Array.from({ length: 8 }, (_, i) => [i, 8]))
    expect(links.slice(0, 4).reduce((sum, l) => sum + l.value, 0)).toBe(7964)
    expect(links.slice(4, 8).reduce((sum, l) => sum + l.value, 0)).toBe(364)
    expect(links.at(-1)).toEqual({ source: 8, target: 14, value: 7564 })
    expect(links.every((l) => l.value > 0 && l.source < nodes.length && l.target < nodes.length)).toBe(true)
    expect(screen.getByRole('img', { name: /income across 8 sources.*expense credits across 8 groups.*positive net expenses across 8 groups/ })).toBeInTheDocument()
  })

  it('labels each phone band with its amount and share of what came in', () => {
    setMatchMedia(false)
    seedEightAndEight()
    render(<CashFlowWidget range={range} />)
    const draw = nodeRenderers.at(-1)!
    const label = (name: string, kind: string, value: number) =>
      [...render(createElement('svg', null, draw({ x: 100, y: 10, width: 10, height: 20, payload: { name, kind, value } } as never))).container.querySelectorAll('tspan')].map((t) => t.textContent)
    // 7,964 of income came in across the eight sources.
    expect(label('Savings', 'savings', 3982)).toEqual(['Savings', '$3,982 · 50%'])
    expect(label('Spend 1', 'expense', 1991)).toEqual(['Spend 1', '$1,991 · 25%'])
    // Sources show the amount alone, since their share is always 100% of themselves.
    expect(label('Income 1', 'income', 999)).toEqual(['Income 1', '$999'])
  })
})
