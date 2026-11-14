import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { BudgetSetupMobile } from './BudgetSetupMobile'
import { useBudgetStore } from '../../store/useBudgetStore'

const initial = useBudgetStore.getState()

beforeEach(() => {
  useBudgetStore.setState(initial, true)
  useBudgetStore.setState({
    categoryGroups: { g1: { id: 'g1', name: 'Food', kind: 'expense' }, g2: { id: 'g2', name: 'Empty', kind: 'expense' } },
    categories: { c1: { id: 'c1', groupId: 'g1', name: 'Groceries', targetAmount: 300 } },
    transactions: {},
    reallocations: {},
  })
})

const open = (name: 'Targets' | 'Categories' | 'Rules') => {
  render(<BudgetSetupMobile selectedMonth="2026-10" />)
  fireEvent.click(screen.getByRole('tab', { name }))
}
const type = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('BudgetSetupMobile', () => {
  it('shows targets by default with the paradigm and total', () => {
    render(<BudgetSetupMobile selectedMonth="2026-10" />)
    expect(screen.getByRole('tab', { name: 'Targets' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText(/Total Monthly Budget/)).toBeInTheDocument()
  })

  it('adds a category from the group card', () => {
    open('Categories')
    const card = screen.getByText('Food').closest('div')!.parentElement!
    fireEvent.click(within(card).getByRole('button', { name: 'Add Category' }))
    type('Add Category name', 'Dining Out')
    expect(Object.values(useBudgetStore.getState().categories).some((c) => c.name === 'Dining Out' && c.groupId === 'g1')).toBe(true)
  })

  it('renames a category and a group', async () => {
    open('Categories')
    fireEvent.click(screen.getByRole('button', { name: 'Rename category Groceries' }))
    let sheet = await screen.findByRole('dialog', { name: 'Rename category' })
    fireEvent.change(within(sheet).getByLabelText('Category name'), { target: { value: 'Supermarket' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(useBudgetStore.getState().categories.c1.name).toBe('Supermarket')

    fireEvent.click(screen.getByRole('button', { name: 'Rename group Food' }))
    sheet = await screen.findByRole('dialog', { name: 'Rename group' })
    expect(within(sheet).getByRole('button', { name: 'Save' })).toBeDisabled() // unchanged name
    fireEvent.change(within(sheet).getByLabelText('Group name'), { target: { value: 'Food & Dining' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(useBudgetStore.getState().categoryGroups.g1.name).toBe('Food & Dining')
  })

  it('adds a group', () => {
    open('Categories')
    fireEvent.click(screen.getByRole('button', { name: 'Add Group' }))
    type('Add Group name', 'Fun')
    expect(Object.values(useBudgetStore.getState().categoryGroups).some((g) => g.name === 'Fun')).toBe(true)
  })

  it('asks before removing a category and keeps it on cancel', () => {
    open('Categories')
    fireEvent.click(screen.getByRole('button', { name: 'Remove category Groceries' }))
    expect(screen.getByText('Remove Category?')).toBeInTheDocument()
    expect(screen.getByText('Its transactions stay, but become uncategorized.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(useBudgetStore.getState().categories.c1).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Remove category Groceries' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(useBudgetStore.getState().categories.c1).toBeUndefined()
  })

  it('only offers group removal for an empty group', () => {
    open('Categories')
    expect(screen.getByRole('button', { name: 'Remove group Empty' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove group Food' })).not.toBeInTheDocument()
  })

  it('lists both rule cards on the Rules section', () => {
    open('Rules')
    expect(screen.getByText(/Categorization Rules/)).toBeInTheDocument()
    expect(screen.getByText(/Exclusion Rules/)).toBeInTheDocument()
  })

  it('moves the paradigm description behind an info button that lists every paradigm', () => {
    render(<BudgetSetupMobile selectedMonth="2026-10" />)
    expect(screen.queryByText(/Freeform tracking/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'About budgeting paradigms' }))
    const dialog = screen.getByRole('dialog', { name: 'Budgeting paradigms' })
    expect(within(dialog).getByText(/Freeform tracking/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Every dollar gets a job/)).toBeInTheDocument()
    expect(within(dialog).getByText('Ledger Custom')).toHaveClass('text-accent')
    expect(within(dialog).queryByText(/current/)).not.toBeInTheDocument()
  })

  it('opens a category options sheet with Target Covers and Payment', () => {
    render(<BudgetSetupMobile selectedMonth="2026-10" />)
    expect(screen.queryByRole('button', { name: 'Budget Groceries annually' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Groceries options' }))
    const dialog = screen.getByRole('dialog', { name: 'Groceries options' })
    expect(within(dialog).getByRole('button', { name: 'Budget Groceries monthly' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Budget Groceries annually' }))
    expect(useBudgetStore.getState().categories.c1.cadence).toBe('annual')
  })

  it('lets a category be marked as a bill, everyday or auto', () => {
    render(<BudgetSetupMobile selectedMonth="2026-10" />)
    fireEvent.click(screen.getByRole('button', { name: 'Groceries options' }))
    const group = screen.getByRole('group', { name: 'Groceries payment type' })
    expect(within(group).getByRole('button', { name: 'Groceries payment Auto' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'Groceries payment Bill' }))
    expect(useBudgetStore.getState().categories.c1.billing).toBe('bill')
    expect(within(group).getByRole('button', { name: 'Groceries payment Bill' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'Groceries payment Everyday' }))
    expect(useBudgetStore.getState().categories.c1.billing).toBe('everyday')
  })

  it('explains the payment choices behind an info button, including what Auto found', () => {
    render(<BudgetSetupMobile selectedMonth="2026-10" />)
    fireEvent.click(screen.getByRole('button', { name: 'Groceries options' }))
    expect(screen.queryByText(/nearly all of it is monthly recurring payments/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'About Payment' }))
    expect(screen.getByText(/nearly all of it is monthly recurring payments. Right now it is Everyday./)).toBeInTheDocument()
  })

  it('badges a category as a Bill when Auto finds one, and hides the badge for Everyday', () => {
    useBudgetStore.setState({
      transactions: Object.fromEntries(['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((d, i) => [`t${i}`, { id: `t${i}`, date: d, amount: 300, categoryId: 'c1', description: 'Meal Plan', type: 'expense' as const }])),
    })
    render(<BudgetSetupMobile selectedMonth="2026-10" />)
    expect(screen.getByText('Bill')).toBeInTheDocument()
    act(() => useBudgetStore.getState().updateCategory('c1', { billing: 'everyday' }))
    expect(screen.queryByText('Bill')).toBeNull()
  })
})
