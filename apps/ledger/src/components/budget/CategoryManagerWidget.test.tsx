import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryManagerWidget } from './CategoryManagerWidget'
import { PARADIGM_DESCRIPTIONS } from './paradigmDescriptions'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useUndoStore } from '../../store/useUndoStore'

beforeEach(() => {
  useBudgetStore.setState({
    paradigm: '50/30/20',
    budgetSetupCollapsed: false,
    transactions: {},
    reallocations: {},
    categoryGroups: {
      g1: { id: 'g1', name: 'Housing', kind: 'expense', budgetClass: 'need' },
      g2: { id: 'g2', name: 'Income', kind: 'income' },
    },
    categories: {
      c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 100 },
    },
  })
})

describe('CategoryManagerWidget paradigm controls', () => {
  it('shows the description for the active paradigm', () => {
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    expect(screen.getByText(/50% of income on needs/i)).toBeInTheDocument()
  })

  it('shows class chips on expense groups only under 50/30/20 and updates the class', () => {
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    const wantChip = screen.getByRole('button', { name: 'Set Housing class to want' })
    fireEvent.click(wantChip)
    expect(useBudgetStore.getState().categoryGroups.g1.budgetClass).toBe('want')
    expect(screen.queryByRole('button', { name: /Set Income class/ })).toBeNull()
  })

  it('hides class chips under other paradigms', () => {
    useBudgetStore.setState({ paradigm: 'Zero-Based' })
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    expect(screen.queryByRole('button', { name: /class to want/ })).toBeNull()
  })

  it('every paradigm description is short enough for one line', () => {
    for (const desc of Object.values(PARADIGM_DESCRIPTIONS)) {
      expect(desc.length).toBeLessThanOrEqual(70)
    }
  })
})

describe('CategoryManagerWidget overspend gating', () => {
  it('Zero-Based: shows Cover button for a zero-target category with spending, and opens the dialog', () => {
    useBudgetStore.setState({
      paradigm: 'Zero-Based',
      budgetSetupCollapsed: false,
      transactions: {
        t1: { id: 't1', date: '2026-07-05', amount: 40, categoryId: 'c1', description: 'Groceries', type: 'expense' },
      },
      reallocations: {},
      categoryGroups: {
        g1: { id: 'g1', name: 'Housing', kind: 'expense', budgetClass: 'need' },
      },
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 0 },
      },
    })
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    const coverButton = screen.getByRole('button', { name: 'Cover' })
    expect(coverButton).toBeInTheDocument()
    fireEvent.click(coverButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Target-Based: shows "absorbed by buffer" and no Cover button for an overspent category', () => {
    useBudgetStore.setState({
      paradigm: 'Target-Based',
      budgetSetupCollapsed: false,
      transactions: {
        t1: { id: 't1', date: '2026-07-05', amount: 150, categoryId: 'c1', description: 'Groceries', type: 'expense' },
      },
      reallocations: {},
      categoryGroups: {
        g1: { id: 'g1', name: 'Housing', kind: 'expense', budgetClass: 'need' },
      },
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 100 },
      },
    })
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    expect(screen.getByText(/absorbed by buffer/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cover' })).toBeNull()
  })

  it('Ledger Custom: shows neither the Cover button nor the absorbed-by-buffer note', () => {
    useBudgetStore.setState({
      paradigm: 'Ledger Custom',
      budgetSetupCollapsed: false,
      transactions: {
        t1: { id: 't1', date: '2026-07-05', amount: 150, categoryId: 'c1', description: 'Groceries', type: 'expense' },
      },
      reallocations: {},
      categoryGroups: {
        g1: { id: 'g1', name: 'Housing', kind: 'expense', budgetClass: 'need' },
      },
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 100 },
      },
    })
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    expect(screen.queryByRole('button', { name: 'Cover' })).toBeNull()
    expect(screen.queryByText(/absorbed by buffer/i)).toBeNull()
  })
})

describe('cadence-aware group total and per-category target', () => {
  beforeEach(() => {
    useBudgetStore.setState({
      paradigm: 'Target-Based',
      budgetSetupCollapsed: false,
      transactions: {
        t1: { id: 't1', date: '2026-07-10', amount: 250, categoryId: 'annual-cat', description: 'Insurance', type: 'expense' },
      },
      reallocations: {},
      categoryGroups: {
        g1: { id: 'g1', name: 'Housing', kind: 'expense' },
      },
      categories: {
        'monthly-cat': { id: 'monthly-cat', groupId: 'g1', name: 'Rent', targetAmount: 300 },
        'annual-cat': { id: 'annual-cat', groupId: 'g1', name: 'Insurance', targetAmount: 2400, cadence: 'annual' },
      },
    });
  });

  it('shows the group total as the sum of monthly equivalents, not raw target amounts', () => {
    const { container } = render(<CategoryManagerWidget selectedMonth="2026-07" />);
    // 300/mo + (2400/yr -> 200/mo) = 500, not the raw 300 + 2400 = 2700.
    const badge = container.querySelector('h3 + span');
    expect(badge?.textContent).toBe('$500');
    expect(screen.queryByText('$2700')).toBeNull();
  });

  it('keeps the annual category over-budget text consistent with its buffer badge', () => {
    render(<CategoryManagerWidget selectedMonth="2026-07" />);
    // $250 spent against a $200/mo equivalent target is over by $50; the
    // Target-Based buffer badge is driven by the same cadence-aware stats,
    // so both signals must agree instead of contradicting each other.
    expect(screen.getByText(/absorbed by buffer/i)).toBeInTheDocument();
    expect(screen.getByText(/\$50 over/)).toBeInTheDocument();
  });
});

describe('split transaction attribution', () => {
  it('attributes only each category own slice, not the full transaction amount', () => {
    useBudgetStore.setState({
      paradigm: 'Ledger Custom',
      budgetSetupCollapsed: false,
      transactions: {
        t1: {
          id: 't1',
          date: '2026-07-05',
          amount: 100,
          categoryId: 'c1',
          description: 'Costco run',
          type: 'expense',
          splits: [{ categoryId: 'c2', amount: 40 }],
        },
      },
      reallocations: {},
      categoryGroups: {
        g1: { id: 'g1', name: 'Housing', kind: 'expense' },
      },
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        c2: { id: 'c2', groupId: 'g1', name: 'Household', targetAmount: 0 },
      },
    })
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    // Groceries (c1) keeps the uncovered remainder ($60), Household (c2) gets its slice ($40).
    // Neither should show the full $100.
    expect(screen.getByText('$60 spent')).toBeInTheDocument()
    expect(screen.getByText('$40 spent')).toBeInTheDocument()
    expect(screen.queryByText('$100 spent')).toBeNull()
  })
})

describe('refunds can make a category net negative', () => {
  it('shows net credit with purchases and payments detail and a zero-width progress bar', () => {
    useBudgetStore.setState({
      paradigm: 'Ledger Custom',
      budgetSetupCollapsed: false,
      transactions: {
        // A $60 purchase followed by a $100 refund nets -$40 for the category.
        t1: { id: 't1', date: '2026-07-05', amount: 60, categoryId: 'c1', description: 'Widget', type: 'expense' },
        t2: { id: 't2', date: '2026-07-10', amount: -100, categoryId: 'c1', description: 'Refund', type: 'expense' },
      },
      reallocations: {},
      categoryGroups: {
        g1: { id: 'g1', name: 'Housing', kind: 'expense' },
      },
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 100 },
      },
    })
    const { container } = render(<CategoryManagerWidget selectedMonth="2026-07" />)

    // Preserve the signed total while describing the credit as a magnitude.
    expect(screen.getByText('$40.00 net credit')).toBeInTheDocument()
    expect(screen.getByText('$60.00 purchases · $100.00 refunds & payments')).toBeInTheDocument()
    expect(screen.getByText('Spending details').tagName).toBe('SUMMARY')

    // The progress bar must never render a negative or CSS-invalid width.
    const bar = container.querySelector('.h-1.bg-bg-secondary .h-full') as HTMLElement
    expect(bar).not.toBeNull()
    const width = bar.style.width
    expect(width).not.toMatch(/^-/)
    const pct = parseFloat(width)
    expect(pct).toBeGreaterThanOrEqual(0)
    expect(pct).toBe(0)
  })
  it('keeps positive net spending and adds details only when payments exist', () => {
    useBudgetStore.setState({ transactions: {
      purchase: { id: 'purchase', date: '2026-07-05', amount: 120, categoryId: 'c1', description: 'Purchase', type: 'expense' },
      payment: { id: 'payment', date: '2026-07-10', amount: -40, categoryId: 'c1', description: 'Payment', type: 'expense' },
    } })
    const { rerender } = render(<CategoryManagerWidget selectedMonth="2026-07" />)
    expect(screen.getByText('$80 spent')).toBeInTheDocument()
    expect(screen.getByText('$120.00 purchases · $40.00 refunds & payments')).toBeInTheDocument()
    rerender(<CategoryManagerWidget selectedMonth="2026-06" />)
    expect(screen.queryByText('Spending details')).toBeNull()
  })
})

describe('cadence toggle', () => {
  it('switches an expense category to annual and persists it', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Travel', kind: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Vacation', targetAmount: 200 } },
      transactions: {},
      reallocations: {},
      budgetSetupCollapsed: false,
    })
    render(<CategoryManagerWidget selectedMonth="2026-04" />)
    fireEvent.click(screen.getByRole('button', { name: 'Budget Vacation annually' }))
    expect(useBudgetStore.getState().categories.c1.cadence).toBe('annual')
  })

  it('switches back to monthly', () => {
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Travel', kind: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Vacation', targetAmount: 2400, cadence: 'annual' } },
      transactions: {},
      reallocations: {},
      budgetSetupCollapsed: false,
    })
    render(<CategoryManagerWidget selectedMonth="2026-04" />)
    fireEvent.click(screen.getByRole('button', { name: 'Budget Vacation monthly' }))
    expect(useBudgetStore.getState().categories.c1.cadence).toBe('monthly')
  })
})

describe('category delete undo', () => {
  it('offers an undo that restores a deleted category', () => {
    useUndoStore.setState({ pending: null })
    useBudgetStore.setState({
      categoryGroups: { g1: { id: 'g1', name: 'Food', kind: 'expense' } },
      categories: { c1: { id: 'c1', groupId: 'g1', name: 'Groceries', targetAmount: 400 } },
      transactions: {},
    })
    render(<CategoryManagerWidget selectedMonth="2026-08" />)
    fireEvent.click(screen.getByLabelText('Delete category Groceries'))

    expect(useBudgetStore.getState().categories.c1).toBeUndefined()
    expect(useUndoStore.getState().pending?.label).toBe('Deleted category "Groceries"')

    useUndoStore.getState().runUndo()
    expect(useBudgetStore.getState().categories.c1.name).toBe('Groceries')
  })

  it('offers an undo that restores a deleted empty group', () => {
    useUndoStore.setState({ pending: null })
    useBudgetStore.setState({
      categoryGroups: {
        g1: { id: 'g1', name: 'Subscriptions', kind: 'expense' },
        g2: { id: 'g2', name: 'Housing', kind: 'expense' },
      },
      categories: { c1: { id: 'c1', groupId: 'g2', name: 'Rent', targetAmount: 400 } },
      transactions: {},
    })
    render(<CategoryManagerWidget selectedMonth="2026-08" />)
    fireEvent.click(screen.getByLabelText('Delete group Subscriptions'))

    expect(useBudgetStore.getState().categoryGroups.g1).toBeUndefined()
    expect(useUndoStore.getState().pending?.label).toBe('Deleted group "Subscriptions"')

    useUndoStore.getState().runUndo()
    expect(useBudgetStore.getState().categoryGroups.g1.name).toBe('Subscriptions')
  })
})

describe('CategoryManagerWidget bills', () => {
  it('marks a category as a bill and offers no control on an income category', () => {
    useBudgetStore.setState({ categories: { c1: { id: 'c1', groupId: 'g1', name: 'Rent', targetAmount: 100 }, c2: { id: 'c2', groupId: 'g2', name: 'Salary', targetAmount: 0 } } })
    render(<CategoryManagerWidget selectedMonth="2026-07" />)
    expect(screen.getByRole('button', { name: 'Rent payment Auto' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Rent payment Bill' }))
    expect(useBudgetStore.getState().categories.c1.billing).toBe('bill')
    expect(screen.queryByRole('group', { name: 'Salary payment type' })).toBeNull()
  })
})
