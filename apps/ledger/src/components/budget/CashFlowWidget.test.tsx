import { render, screen } from '@testing-library/react'
import { CashFlowWidget } from './CashFlowWidget'
import { useBudgetStore } from '../../store/useBudgetStore'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

type ChartData = { nodes: { name: string; kind: string }[]; links: { source: number; target: number; value: number }[] }
const { captured } = vi.hoisted(() => ({ captured: [] as { data: ChartData; node: (props: never) => ReactNode; link: (props: never) => ReactNode }[] }))
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
    Sankey: (props: typeof captured[number]) => { captured.push(props); return null },
  }
})

const budgetInitial = useBudgetStore.getState()

beforeEach(() => {
  captured.length = 0
  useBudgetStore.setState(budgetInitial, true)
})

const range = { from: '2026-08', to: '2026-08' }

describe('CashFlowWidget', () => {
  it('renders its card without data', () => {
    render(<CashFlowWidget range={range} />)
    expect(screen.getByText('Cash Flow')).toBeInTheDocument()
    expect(screen.getByText('No transactions this month.')).toBeInTheDocument()
  })

  it('drops the empty-state message once income and expenses are present', () => {
    useBudgetStore.setState({
      categoryGroups: {
        gi: { id: 'gi', name: 'Income', kind: 'income' },
        ge: { id: 'ge', name: 'Housing', kind: 'expense' },
      },
      categories: {
        ci: { id: 'ci', groupId: 'gi', name: 'Salary', targetAmount: 0 },
        ce: { id: 'ce', groupId: 'ge', name: 'Rent', targetAmount: 0 },
      },
      transactions: {
        i1: { id: 'i1', date: '2026-08-01', amount: 4000, description: 'Pay', type: 'income', categoryId: 'ci' },
        e1: { id: 'e1', date: '2026-08-02', amount: 1500, description: 'Rent', type: 'expense', categoryId: 'ce' },
      },
    })
    render(<CashFlowWidget range={range} />)
    expect(screen.getByText('Cash Flow')).toBeInTheDocument()
    expect(screen.queryByText('No transactions this month.')).not.toBeInTheDocument()
  })
})

describe('CashFlowWidget negative group totals', () => {
  it('draws net credits separately from income and includes them in remaining funds', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Shopping', kind: 'expense' }, g2: { id: 'g2', name: 'Housing', kind: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Personal', targetAmount: 0 }, c2: { id: 'c2', groupId: 'g2', name: 'Rent', targetAmount: 0 } },
      transactions: {
        i1: { id: 'i1', date: '2026-08-01', amount: 1000, description: 'PAYROLL', type: 'income', categoryId: '' },
        s1: { id: 's1', date: '2026-08-02', amount: 20, description: 'BUY', type: 'expense', categoryId: 'c1' },
        r1: { id: 'r1', date: '2026-08-03', amount: -60, description: 'REFUND', type: 'expense', categoryId: 'c1' },
        e1: { id: 'e1', date: '2026-08-03', amount: 500, description: 'Rent', type: 'expense', categoryId: 'c2' },
      },
    })
    render(<CashFlowWidget range={range} />)
    const chart = captured.at(-1)!
    expect(chart.data).toEqual({
      nodes: [
        { name: 'Other income', kind: 'income' }, { name: 'Shopping credit', kind: 'credit' },
        { name: 'Available funds', kind: 'pool' }, { name: 'Housing', kind: 'expense' }, { name: 'Net remaining', kind: 'savings' },
      ],
      links: [
        { source: 0, target: 2, value: 1000 }, { source: 1, target: 2, value: 40 },
        { source: 2, target: 3, value: 500 }, { source: 2, target: 4, value: 540 },
      ],
    })
    expect(screen.getByRole('img', { name: /\$1,000 income across 1 sources.*\$40 expense credits across 1 groups.*\$500 of positive net expenses across 1 groups.*\$540 net remaining/ })).toBeInTheDocument()
    expect(screen.getByText('Expense credits reduce spending and are not income.')).toBeInTheDocument()
    const linkProps = { sourceX: 0, sourceY: 0, sourceControlX: 1, targetControlX: 2, targetX: 3, targetY: 4, linkWidth: 5 }
    const markup = (index: number) => renderToStaticMarkup(chart.link({ ...linkProps, index } as never))
    expect(markup(1)).toContain('stroke="var(--accent)"')
    expect(markup(2)).toContain('stroke="var(--error)"')
    expect(markup(3)).toContain('stroke-opacity="0.55"')
    // The savings flow, its bar and its label are green, not the accent that income uses.
    expect(markup(3)).toContain('stroke="var(--success)"')
    const savingsNode = renderToStaticMarkup(chart.node({ x: 100, y: 0, width: 10, height: 20, payload: chart.data.nodes[4] } as never))
    expect(savingsNode).toContain('fill="var(--success)"')
    expect(savingsNode).not.toContain('var(--accent)')
    expect(renderToStaticMarkup(chart.node({ x: 100, y: 0, width: 10, height: 20, payload: chart.data.nodes[1] } as never))).toContain('text-anchor="end"')
  })

  it('renders a credit-only period with no earned income', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Shopping', kind: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Personal', targetAmount: 0 } },
      transactions: {
        s1: { id: 's1', date: '2026-08-02', amount: 20, description: 'BUY', type: 'expense', categoryId: 'c1' },
        r1: { id: 'r1', date: '2026-08-03', amount: -50, description: 'REFUND', type: 'expense', categoryId: 'c1' },
      },
    })
    render(<CashFlowWidget range={range} />)
    expect(screen.queryByText('No transactions this month.')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /\$0 income across 0 sources.*\$30 expense credits.*\$30 net remaining/ })).toBeInTheDocument()
    expect(captured.at(-1)!.data.links).toEqual([{ source: 0, target: 1, value: 30 }, { source: 1, target: 2, value: 30 }])
  })

  it('does not draw an expense group that nets to exactly zero', () => {
    useBudgetStore.setState({
      categoryGroups: {
        gi: { id: 'gi', name: 'Income', kind: 'income' },
        g1: { id: 'g1', name: 'Shopping', kind: 'expense' },
      },
      categories: {
        ci: { id: 'ci', groupId: 'gi', name: 'Salary', targetAmount: 0 },
        c1: { id: 'c1', groupId: 'g1', name: 'Personal', targetAmount: 0 },
      },
      transactions: {
        i1: { id: 'i1', date: '2026-08-01', amount: 1000, description: 'PAYROLL', type: 'income', categoryId: 'ci' },
        s1: { id: 's1', date: '2026-08-02', amount: 20, description: 'BUY', type: 'expense', categoryId: 'c1' },
        r1: { id: 'r1', date: '2026-08-03', amount: -20, description: 'REFUND', type: 'expense', categoryId: 'c1' },
      },
    })
    render(<CashFlowWidget range={range} />)
    expect(screen.getByLabelText(/across 0 groups/)).toBeInTheDocument()
    expect(captured.at(-1)!.data.nodes.map((n) => n.name)).toEqual(['Salary', 'Income', 'Savings'])
    expect(captured.at(-1)!.data.links).toEqual([{ source: 0, target: 1, value: 1000 }, { source: 1, target: 2, value: 1000 }])
    expect(screen.queryByText('Expense credits reduce spending and are not income.')).not.toBeInTheDocument()
  })

  it('keeps underfunded periods free of negative links', () => {
    useBudgetStore.setState({
      transactions: {
        i: { id: 'i', date: '2026-08-01', amount: 100, description: 'Pay', type: 'income', categoryId: '' },
        e: { id: 'e', date: '2026-08-02', amount: 200, description: 'Spend', type: 'expense', categoryId: '' },
      },
    })
    render(<CashFlowWidget range={range} />)
    const { nodes, links } = captured.at(-1)!.data
    expect(nodes.map((n) => n.name)).toEqual(['Other income', 'Income', 'Uncategorized'])
    expect(links.map((l) => l.value)).toEqual([100, 200])
    expect(links.every((l) => l.value > 0 && l.source < nodes.length && l.target < nodes.length)).toBe(true)
    expect(screen.getByRole('img', { name: /leaving \$0 saved/ })).toBeInTheDocument()
  })

  it('keeps underfunded credit periods clamped at zero remaining', () => {
    useBudgetStore.setState({
      categoryGroups: { g: { id: 'g', name: 'Shopping', kind: 'expense' } },
      categories: { c: { id: 'c', groupId: 'g', name: 'Personal', targetAmount: 0 } },
      transactions: {
        i: { id: 'i', date: '2026-08-01', amount: 100, description: 'Pay', type: 'income', categoryId: '' },
        e: { id: 'e', date: '2026-08-02', amount: 200, description: 'Spend', type: 'expense', categoryId: '' },
        c: { id: 'c', date: '2026-08-03', amount: -40, description: 'Credit', type: 'expense', categoryId: 'c' },
      },
    })
    render(<CashFlowWidget range={range} />)
    const { nodes, links } = captured.at(-1)!.data
    expect(nodes.map((n) => n.name)).toEqual(['Other income', 'Shopping credit', 'Available funds', 'Uncategorized'])
    expect(links).toEqual([{ source: 0, target: 2, value: 100 }, { source: 1, target: 2, value: 40 }, { source: 2, target: 3, value: 200 }])
    expect(screen.getByRole('img', { name: /leaving \$0 net remaining/ })).toBeInTheDocument()
  })
})
