import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ParadigmBanner } from './ParadigmBanner'
import { getMonthlyBudgetStats, useBudgetStore } from '../../store/useBudgetStore'

function seed(paradigm: string, incomeAmount: number) {
  useBudgetStore.setState({
    paradigm: paradigm as never,
    transactions: {
      i: { id: 'i', date: '2026-07-01', amount: incomeAmount, categoryId: 'inc', description: 'pay', type: 'income' },
      e: { id: 'e', date: '2026-07-02', amount: 300, categoryId: 'rent', description: 'rent', type: 'expense' },
    },
    categories: {
      inc: { id: 'inc', groupId: 'gi', name: 'Salary', targetAmount: 0 },
      rent: { id: 'rent', groupId: 'ge', name: 'Rent', targetAmount: 200 },
    },
    categoryGroups: {
      gi: { id: 'gi', name: 'Income', kind: 'income' },
      ge: { id: 'ge', name: 'Housing', kind: 'expense', budgetClass: 'need' },
    },
    reallocations: {},
  })
}

describe('ParadigmBanner', () => {
  it('subtracts signed split offsets from the correct 50/30/20 classes', () => {
    seed('50/30/20', 2000)
    useBudgetStore.setState({
      categoryGroups: {
        ge: { id: 'ge', name: 'Housing', kind: 'expense', budgetClass: 'need' },
        gw: { id: 'gw', name: 'Leisure', kind: 'expense', budgetClass: 'want' },
        gs: { id: 'gs', name: 'Saving', kind: 'expense', budgetClass: 'savings' },
      },
      categories: {
        rent: { id: 'rent', groupId: 'ge', name: 'Rent', targetAmount: 0 },
        fun: { id: 'fun', groupId: 'gw', name: 'Fun', targetAmount: 0 },
        saving: { id: 'saving', groupId: 'gs', name: 'Saving', targetAmount: 0 },
      },
      transactions: {
        i: { id: 'i', date: '2026-07-01', amount: 2000, description: 'Salary', type: 'income' },
        purchase: { id: 'purchase', date: '2026-07-02', amount: 120, description: 'Purchase', type: 'expense', categoryId: 'rent' },
        offset: { id: 'offset', date: '2026-07-03', amount: -40, description: 'Payment', type: 'expense', categoryId: 'rent', splits: [{ categoryId: 'fun', amount: -10 }, { categoryId: 'saving', amount: -10 }] },
      },
    })
    const f = getMonthlyBudgetStats(useBudgetStore.getState(), 2026, 6).fiftyThirtyTwenty
    expect(f).toMatchObject({ needsSpent: 100, wantsSpent: -10, savingsSpent: -10, needsPct: 5, wantsPct: -0.5, savingsPct: -0.5 })
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/Needs 5%/)).toBeInTheDocument()
  })
  beforeEach(() => seed('Ledger Custom', 1000))

  it('renders nothing for Ledger Custom', () => {
    const { container } = render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(container.firstChild).toBeNull()
  })

  it('Zero-Based: shows unassigned amount', () => {
    seed('Zero-Based', 1000) // targets 200, unassigned 800
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/\$800 unassigned/)).toBeInTheDocument()
  })

  it('Zero-Based: shows over-assigned message when negative', () => {
    seed('Zero-Based', 100) // targets 200, unassigned -100
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/assigned \$100 more than you earned/i)).toBeInTheDocument()
  })

  it('Target-Based: shows buffer, warns when negative', () => {
    seed('Target-Based', 1000) // buffer = 800 - overspend(rent 300>200 => 100) = 700
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/\$700 buffer/i)).toBeInTheDocument()
  })

  it('50/30/20: shows bucket percentages', () => {
    seed('50/30/20', 1000)
    render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(screen.getByText(/Needs 30%/)).toBeInTheDocument()
    expect(screen.getByText(/Wants 0%/)).toBeInTheDocument()
    expect(screen.getByText(/Savings 0%/)).toBeInTheDocument()
  })

  it('50/30/20: renders the ratio bar as a full-width sibling of the icon row', () => {
    seed('50/30/20', 1000)
    const { container } = render(<ParadigmBanner selectedMonth="2026-07" />)
    const bar = container.querySelector('[data-testid="ratio-bar"]') as HTMLElement
    expect(bar).not.toBeNull()
    // the bar must not be nested inside the icon+text flex row
    expect(bar.parentElement?.className).not.toContain('items-start')
  })

  it('50/30/20: bar track renders even when all buckets are 0%', () => {
    seed('50/30/20', 0) // no income: pcts all 0
    const { container } = render(<ParadigmBanner selectedMonth="2026-07" />)
    expect(container.querySelector('[data-testid="ratio-bar"]')).not.toBeNull()
  })

  it('50/30/20: a class whose refunds outweigh its spend clamps to a zero-width bucket, not a dropped/negative one', () => {
    // A refund is stored as a negative-amount expense-typed transaction, so a
    // budget class (need/want/savings) can net negative for the month. The
    // bucket must render at 0% width, not a negative or CSS-invalid width,
    // and the label must still show the truthful negative percent.
    useBudgetStore.setState({
      paradigm: '50/30/20',
      transactions: {
        i: { id: 'i', date: '2026-07-01', amount: 1000, categoryId: 'inc', description: 'pay', type: 'income' },
        // A big refund against Housing (a "need") outweighs any other need spend this month.
        r: { id: 'r', date: '2026-07-02', amount: -300, categoryId: 'rent', description: 'refund', type: 'expense' },
      },
      categories: {
        inc: { id: 'inc', groupId: 'gi', name: 'Salary', targetAmount: 0 },
        rent: { id: 'rent', groupId: 'ge', name: 'Rent', targetAmount: 200 },
      },
      categoryGroups: {
        gi: { id: 'gi', name: 'Income', kind: 'income' },
        ge: { id: 'ge', name: 'Housing', kind: 'expense', budgetClass: 'need' },
      },
      reallocations: {},
    })
    const { container } = render(<ParadigmBanner selectedMonth="2026-07" />)

    // Truthful negative label is preserved.
    expect(screen.getByText(/Needs -30%/)).toBeInTheDocument()

    // The Needs bucket bar (first bucket div in the ratio bar) must not have
    // a negative or dropped width.
    const bar = container.querySelector('[data-testid="ratio-bar"]') as HTMLElement
    const needsBucket = bar.firstElementChild as HTMLElement
    const width = needsBucket.style.width
    expect(width).not.toMatch(/^-/)
    expect(parseFloat(width)).toBe(0)
  })
})
