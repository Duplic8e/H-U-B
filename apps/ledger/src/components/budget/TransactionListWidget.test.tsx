import { Profiler } from 'react'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { TransactionListWidget } from './TransactionListWidget'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useUndoStore } from '../../store/useUndoStore'
import type { Transaction } from '../../types/budget'

const initialState = useBudgetStore.getState()

describe('Refunds & Payments list behavior', () => {
  const seed = (includeIncome = false) => useBudgetStore.setState({
    categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' }, inc: { id: 'inc', name: 'Income', kind: 'income' } },
    categories: {
      groceries: { id: 'groceries', groupId: 'food', name: 'Groceries', targetAmount: 0 },
      house: { id: 'house', groupId: 'food', name: 'Household', targetAmount: 0 },
      salary: { id: 'salary', groupId: 'inc', name: 'Salary', targetAmount: 0 },
    },
    transactions: {
      payment: { id: 'payment', date: '2026-10-02', amount: -40, categoryId: 'groceries', type: 'expense', description: 'Returned order', splits: [{ categoryId: 'house', amount: -10 }] },
      ...(includeIncome ? { income: { id: 'income', date: '2026-10-03', amount: 2000, type: 'income' as const, description: 'Pay' } } : {}),
    },
  })
  it('finds offsets by their treatment label on desktop and phone', () => {
    seed()
    render(<TransactionListWidget range={{ from: '2026-10', to: '2026-10' }} />)
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'refunds & payments' } })
    expect(within(screen.getByRole('table')).getByText('Returned order')).toBeInTheDocument()
    expect(within(screen.getByTestId('transactions-cards')).getByText('+$40')).toBeInTheDocument()
  })
  it('finds split offsets by slice attribution', () => {
    seed()
    render(<TransactionListWidget range={{ from: '2026-10', to: '2026-10' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'All Categories' }))
    fireEvent.click(screen.getByRole('option', { name: 'Household' }))
    expect(within(screen.getByRole('table')).getByText('Returned order')).toBeInTheDocument()
  })
  it('offers expense categories only for payments and preserves their signed splits when applying', () => {
    seed()
    render(<TransactionListWidget range={{ from: '2026-10', to: '2026-10' }} />)
    fireEvent.click(screen.getByLabelText('Select all transactions'))
    fireEvent.click(screen.getByLabelText('Category for selected'))
    expect(screen.queryByRole('option', { name: 'Salary' })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'Household' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(useBudgetStore.getState().transactions.payment).toMatchObject({ type: 'expense', amount: -40, categoryId: 'house', splits: [{ categoryId: 'house', amount: -10 }] })
  })
  it('disables recategorization for mixed income and expense selections while keeping deletion', () => {
    seed(true)
    render(<TransactionListWidget range={{ from: '2026-10', to: '2026-10' }} />)
    fireEvent.click(screen.getByLabelText('Select all transactions'))
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(screen.queryByLabelText('Category for selected')).toBeNull()
    expect(screen.getByText('Select only income or only expenses to change categories.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeEnabled()
  })
})

beforeEach(() => {
  useBudgetStore.setState(initialState, true)
  useUndoStore.setState({ pending: null })
})

describe('TransactionListWidget mobile layout', () => {
  it('lets the header row wrap instead of overflowing the card', () => {
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const headerRow = screen.getByText('All Transactions').parentElement as HTMLElement
    expect(headerRow.className).toContain('flex-wrap')
  })

  it('shows the delete button without hover on mobile, hover-revealed from sm up', () => {
    useBudgetStore.setState({
      transactions: {
        tx1: {
          id: 'tx1',
          date: '2026-07-03',
          amount: 42,
          description: 'Coffee',
          type: 'expense',
        },
      },
    })
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const table = screen.getByRole('table')
    const del = within(table).getByLabelText('Delete transaction')
    const classes = del.className.split(/\s+/)
    expect(classes).not.toContain('opacity-0') // bare opacity-0 would hide it on touch
    expect(classes).toContain('reveal-on-hover')
  })

  it('renders a day-grouped phone list alongside the desktop table, with the edit action reachable', () => {
    useBudgetStore.setState({
      transactions: {
        tx1: { id: 'tx1', date: '2026-07-03', amount: 42, description: 'Coffee', type: 'expense' },
        tx2: { id: 'tx2', date: '2026-07-03', amount: 8, description: 'Bagel', type: 'expense' },
      },
    })
    const { container } = render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)

    const list = container.querySelector('[data-testid="transactions-cards"]')
    expect(list).not.toBeNull()
    const scope = within(list as HTMLElement)
    expect(scope.getByText('Coffee')).toBeInTheDocument()
    expect(scope.getByText(/\$42/)).toBeInTheDocument()
    // One header per day, carrying that day's net.
    expect(scope.getAllByRole('region').length).toBe(1)
    expect(scope.getByText(/\$50/)).toBeInTheDocument()

    // The phone list has no per-row controls; the edit modal is the action surface.
    expect(scope.queryByLabelText('Delete transaction')).toBeNull()
    fireEvent.click(scope.getByRole('button', { name: /Edit Coffee/ }))
    expect(screen.getByDisplayValue('Coffee')).toBeInTheDocument()
  })

  it('filters the phone list with category chips built from the period', () => {
    useBudgetStore.setState({
      categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' } },
      categories: {
        groceries: { id: 'groceries', groupId: 'food', name: 'Groceries', targetAmount: 0 },
        dining: { id: 'dining', groupId: 'food', name: 'Dining', targetAmount: 0 },
      },
      transactions: {
        a: { id: 'a', date: '2026-07-03', amount: 42, categoryId: 'groceries', description: 'Loblaws', type: 'expense' },
        b: { id: 'b', date: '2026-07-04', amount: 9, categoryId: 'dining', description: 'Cafe', type: 'expense' },
      },
    })
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const phone = within(screen.getByTestId('transactions-cards'))
    fireEvent.click(phone.getByRole('button', { name: 'Dining' }))
    expect(phone.getByText('Cafe')).toBeInTheDocument()
    expect(phone.queryByText('Loblaws')).toBeNull()
    // The other chips stay put so the user can switch without clearing first.
    expect(phone.getByRole('button', { name: 'Groceries' })).toBeInTheDocument()
    fireEvent.click(phone.getByRole('button', { name: 'All' }))
    expect(phone.getByText('Loblaws')).toBeInTheDocument()
  })
})

describe('TransactionListWidget search', () => {
  const seedThree = () => {
    useBudgetStore.setState({
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
      },
      transactions: {
        t1: { id: 't1', date: '2026-07-03', amount: 42, description: 'Coffee Bar', type: 'expense' },
        t2: { id: 't2', date: '2026-07-04', amount: 9, description: 'Netflix', type: 'expense' },
        t3: { id: 't3', date: '2026-07-05', amount: 80, description: 'Loblaws', type: 'expense', categoryId: 'c1' },
      },
    })
  }

  it('filters by description, case insensitively', () => {
    seedThree()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'netfl' } })
    const table = screen.getByRole('table')
    expect(within(table).getByText('Netflix')).toBeInTheDocument()
    expect(within(table).queryByText('Coffee Bar')).not.toBeInTheDocument()
  })

  it('matches on the category name too', () => {
    seedThree()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'grocer' } })
    const table = screen.getByRole('table')
    expect(within(table).getByText('Loblaws')).toBeInTheDocument()
    expect(within(table).queryByText('Netflix')).not.toBeInTheDocument()
  })

  it('says so when nothing matches instead of showing an empty table', () => {
    seedThree()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'zzzz' } })
    // Desktop and phone layouts both render in jsdom; each shows its own message.
    expect(screen.getAllByText('No matching transactions').length).toBeGreaterThan(0)
  })

  it('states the full transaction count in the Delete all confirmation, not the filtered count', () => {
    seedThree()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'netfl' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete all transactions' }))
    expect(screen.getByText(/Every transaction \(3\) will be deleted/)).toBeInTheDocument()
    expect(screen.getByText(/hidden by the current search or filter/)).toBeInTheDocument()
  })

  it('replaces the row-delete undo offer with the Delete all undo offer', () => {
    seedThree()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    fireEvent.click(screen.getAllByLabelText('Delete transaction')[0])
    expect(useUndoStore.getState().pending?.label).toMatch(/^Deleted "/)
    fireEvent.click(screen.getByRole('button', { name: 'Delete all transactions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
    expect(useUndoStore.getState().pending?.label).toMatch(/^Cleared /)
  })
})

describe('TransactionListWidget bulk actions', () => {
  const seedTwo = () => {
    useBudgetStore.setState({
      categories: {
        c1: { id: 'c1', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
      },
      categoryGroups: { g1: { id: 'g1', name: 'Food', kind: 'expense' } },
      transactions: {
        t1: { id: 't1', date: '2026-07-03', amount: 42, description: 'Coffee Bar', type: 'expense' },
        t2: { id: 't2', date: '2026-07-04', amount: 9, description: 'Netflix', type: 'expense' },
      },
    })
  }

  it('shows how many rows are selected once one is ticked', () => {
    seedTwo()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const table = screen.getByRole('table')
    fireEvent.click(within(table).getAllByLabelText('Select transaction')[0])
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('selects and clears every visible row from the header checkbox', () => {
    seedTwo()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const selectAll = screen.getByLabelText('Select all transactions')
    fireEvent.click(selectAll)
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    fireEvent.click(selectAll)
    expect(screen.queryByText(/^\d+ selected$/)).not.toBeInTheDocument()
  })

  // ThemedSelect is a custom listbox, not a native <select>: open the trigger by
  // its aria-label, then click the option. fireEvent.change does nothing here.
  it('applies a category to every selected row', () => {
    seedTwo()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    fireEvent.click(screen.getByLabelText('Select all transactions'))
    fireEvent.click(screen.getByLabelText('Category for selected'))
    fireEvent.click(screen.getByRole('option', { name: 'Groceries' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    const txs = useBudgetStore.getState().transactions
    expect(txs.t1.categoryId).toBe('c1')
    expect(txs.t2.categoryId).toBe('c1')
  })

  it('deletes the selected rows only after the confirmation is accepted', () => {
    seedTwo()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const table = screen.getByRole('table')
    fireEvent.click(within(table).getAllByLabelText('Select transaction')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }))
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(1)
  })

  it('does not open the edit modal when the row checkbox is clicked', () => {
    seedTwo()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const table = screen.getByRole('table')
    fireEvent.click(within(table).getAllByLabelText('Select transaction')[0])
    expect(screen.queryByDisplayValue('Netflix')).not.toBeInTheDocument()
  })
})

describe('TransactionListWidget undo', () => {
  const seedOne = () => {
    useBudgetStore.setState({
      transactions: {
        t1: { id: 't1', date: '2026-07-03', amount: 42, description: 'Coffee Bar', type: 'expense' },
      },
    })
  }

  it('restores a single deleted transaction, with its fields intact', () => {
    seedOne()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const table = screen.getByRole('table')
    fireEvent.click(within(table).getByLabelText('Delete transaction'))
    expect(useBudgetStore.getState().transactions.t1).toBeUndefined()

    useUndoStore.getState().runUndo()
    expect(useBudgetStore.getState().transactions.t1).toEqual({
      id: 't1',
      date: '2026-07-03',
      amount: 42,
      description: 'Coffee Bar',
      type: 'expense',
    })
  })

  it('names what was deleted', () => {
    seedOne()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const table = screen.getByRole('table')
    fireEvent.click(within(table).getByLabelText('Delete transaction'))
    expect(useUndoStore.getState().pending?.label).toBe('Deleted "Coffee Bar"')
  })

  it('drops the offer once dismissed', () => {
    seedOne()
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    const table = screen.getByRole('table')
    fireEvent.click(within(table).getByLabelText('Delete transaction'))
    useUndoStore.getState().dismissUndo()
    expect(useUndoStore.getState().pending).toBeNull()
    expect(useBudgetStore.getState().transactions.t1).toBeUndefined()
  })

  it('restores every row from a bulk delete', () => {
    useBudgetStore.setState({
      transactions: {
        t1: { id: 't1', date: '2026-07-03', amount: 42, description: 'Coffee Bar', type: 'expense' },
        t2: { id: 't2', date: '2026-07-04', amount: 9, description: 'Netflix', type: 'expense' },
      },
    })
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    fireEvent.click(screen.getByLabelText('Select all transactions'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(Object.keys(useBudgetStore.getState().transactions)).toHaveLength(0)

    useUndoStore.getState().runUndo()
    expect(Object.keys(useBudgetStore.getState().transactions).sort()).toEqual(['t1', 't2'])
  })

  it('does not delete selected rows that the search has filtered out', () => {
    useBudgetStore.setState({
      transactions: {
        t1: { id: 't1', date: '2026-07-03', amount: 42, description: 'Coffee Bar', type: 'expense' },
        t2: { id: 't2', date: '2026-07-04', amount: 9, description: 'Netflix', type: 'expense' },
        t3: { id: 't3', date: '2026-07-05', amount: 15, description: 'Groceries', type: 'expense' },
      },
    })
    render(<TransactionListWidget range={{ from: '2026-07', to: '2026-07' }} />)
    fireEvent.click(screen.getByLabelText('Select all transactions'))
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'Groceries' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    const remaining = useBudgetStore.getState().transactions
    expect(remaining.t3).toBeUndefined()
    expect(remaining.t1).toBeDefined()
    expect(remaining.t2).toBeDefined()
  })
})

describe('TransactionListWidget splits and tags', () => {
  const split = {
    id: 'tx1',
    date: '2026-08-04',
    amount: 180,
    description: 'Costco',
    type: 'expense' as const,
    categoryId: 'groceries',
    splits: [
      { categoryId: 'groceries', amount: 120 },
      { categoryId: 'household', amount: 60 },
    ],
    tags: ['trip'],
    note: 'weekly shop',
  }

  it('labels a split row with the number of slices instead of one category', () => {
    useBudgetStore.setState({
      categories: {
        groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 },
        household: { id: 'household', groupId: 'g1', name: 'Household', targetAmount: 0 },
      },
      transactions: { tx1: split },
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Split · 2')).toBeInTheDocument()
  })

  it('finds a transaction by tag', () => {
    useBudgetStore.setState({
      categories: { groceries: { id: 'groceries', groupId: 'g1', name: 'Groceries', targetAmount: 0 } },
      transactions: {
        tx1: split,
        tx2: { id: 'tx2', date: '2026-08-05', amount: 9, description: 'Coffee', type: 'expense' as const },
      },
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'trip' } })
    const table = screen.getByRole('table')
    expect(within(table).getByText('Costco')).toBeInTheDocument()
    expect(within(table).queryByText('Coffee')).toBeNull()
  })

  it('finds a transaction by note text', () => {
    useBudgetStore.setState({
      categories: {},
      transactions: { tx1: split },
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'weekly' } })
    expect(within(screen.getByRole('table')).getByText('Costco')).toBeInTheDocument()
  })
})

describe('undo via the global store', () => {
  beforeEach(() => {
    useUndoStore.setState({ pending: null })
  })

  it('offers an undo through the undo store when a row is deleted', () => {
    useBudgetStore.setState({
      categories: {},
      transactions: { tx1: { id: 'tx1', date: '2026-08-03', amount: 42, description: 'Coffee', type: 'expense' } },
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)
    fireEvent.click(within(screen.getByRole('table')).getByLabelText('Delete transaction'))

    expect(useBudgetStore.getState().transactions).toEqual({})
    expect(useUndoStore.getState().pending?.label).toBe('Deleted "Coffee"')

    useUndoStore.getState().runUndo()
    expect(useBudgetStore.getState().transactions.tx1.description).toBe('Coffee')
  })

  it('offers an undo after Delete all that restores every transaction', () => {
    useBudgetStore.setState({
      categories: {},
      transactions: {
        tx1: { id: 'tx1', date: '2026-08-03', amount: 42, description: 'Coffee', type: 'expense' },
        tx2: { id: 'tx2', date: '2026-08-04', amount: 10, description: 'Tea', type: 'expense' },
      },
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete all transactions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))

    expect(useBudgetStore.getState().transactions).toEqual({})
    expect(useUndoStore.getState().pending?.label).toBe('Cleared 2 transactions')

    useUndoStore.getState().runUndo()
    expect(Object.keys(useBudgetStore.getState().transactions).sort()).toEqual(['tx1', 'tx2'])
  })
})

describe('TransactionListWidget keyboard access', () => {
  it('opens a row for editing with Enter and with Space', () => {
    useBudgetStore.setState({
      transactions: {
        a1: { id: 'a1', date: '2026-08-04', amount: 20, description: 'KEYBOARD ROW', type: 'expense' },
      },
      categories: {},
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)

    const table = screen.getByRole('table')
    const row = within(table).getByRole('button', { name: /KEYBOARD ROW/ })
    row.focus()
    expect(row).toHaveFocus()

    fireEvent.keyDown(row, { key: 'Enter' })
    expect(screen.getByTestId('sheet-panel')).toBeInTheDocument()
  })
})

describe('TransactionListWidget mobile card keyboard access', () => {
  it('exposes each card as a button and opens it with Enter', () => {
    useBudgetStore.setState({
      transactions: {
        m1: { id: 'm1', date: '2026-08-04', amount: 20, description: 'CARD ROW', type: 'expense' },
      },
      categories: {},
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)

    const cards = screen.getAllByRole('button', { name: /Edit CARD ROW/ })
    expect(cards.length).toBeGreaterThan(0)
    fireEvent.keyDown(cards[0], { key: 'Enter' })
    expect(screen.getByTestId('sheet-panel')).toBeInTheDocument()
  })
})

describe('TransactionListWidget selection at scale', () => {
  it(
    'keeps selection scoped to visible rows when the search narrows',
    async () => {
      const transactions: Record<string, Transaction> = {}
      for (let i = 0; i < 600; i++) {
        transactions[`t${i}`] = {
          id: `t${i}`,
          date: '2026-08-04',
          amount: 10,
          description: i < 100 ? `COFFEE ${i}` : `GROCERY ${i}`,
          type: 'expense',
        }
      }
      useBudgetStore.setState({ transactions, categories: {} })

      // jsdom never lays out elements, so the scroll container's real
      // clientHeight is always 0. Left alone, computeWindow's "not measured
      // yet" fallback renders all 600 (then 100) rows into jsdom on every
      // assertion below, which is slow enough under load to flirt with the
      // test timeout. Stub a realistic viewport height so the widget windows
      // rows the same way it would in a real browser, keeping this test's
      // cost proportional to what's actually on screen rather than to the
      // full dataset.
      const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 480 })

      try {
        render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)

        fireEvent.click(screen.getByLabelText('Select all transactions'))
        expect(screen.getByText('600 selected')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'COFFEE' } })
        expect(screen.getByText('100 selected')).toBeInTheDocument()
      } finally {
        if (clientHeightDescriptor) {
          Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightDescriptor)
        } else {
          delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
        }
      }
    },
    30000
  )
})

describe('TransactionListWidget negative expenses', () => {
  it('renders a refund without a double minus', () => {
    useBudgetStore.setState({
      ...useBudgetStore.getState(),
      transactions: {
        r: {
          id: 'r', date: '2026-08-15', amount: -39.99, description: 'AMAZON MKTPLACE PMTS',
          type: 'expense', categoryId: '',
        },
      },
    })
    render(<TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />)
    expect(screen.queryByText('-$-40')).not.toBeInTheDocument()
    expect(screen.getAllByText('+$40').length).toBe(2)
    expect(screen.getAllByText('Refunds & Payments')).toHaveLength(2)
  })
})

describe('TransactionListWidget row-height measurement loop safety', () => {
  it('stops re-rendering once the measured row height stabilizes, instead of looping forever', async () => {
    // jsdom never lays out elements, so getBoundingClientRect on a real row
    // always reports 0, which would trivially (and misleadingly) satisfy the
    // "no infinite loop" property since the effect's `h &&` guard would never
    // even fire. Stub a fixed, non-nominal height (taller than the 48px
    // fallback, as a row wrapping several tag chips would be) so the
    // measurement effect actually exercises its update-then-stabilize path.
    const rectDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect')
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { height: 64, width: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }
    }
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 480 })

    const transactions: Record<string, Transaction> = {}
    for (let i = 0; i < 30; i++) {
      transactions[`t${i}`] = {
        id: `t${i}`,
        date: '2026-08-04',
        amount: 10,
        description: `TX ${i}`,
        type: 'expense',
        tags: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
      }
    }
    useBudgetStore.setState({ transactions, categories: {} })

    let renderCount = 0
    const onRender = () => {
      renderCount += 1
    }

    try {
      render(
        <Profiler id="txlist" onRender={onRender}>
          <TransactionListWidget range={{ from: '2026-08', to: '2026-08' }} />
        </Profiler>
      )

      // Let the measurement effect run its course across microtask/paint
      // cycles, then confirm the render count has stopped climbing: a real
      // infinite loop would keep incrementing renderCount without bound.
      await waitFor(() => {
        expect(renderCount).toBeGreaterThan(0)
      })
      const countAfterSettle = renderCount
      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(renderCount).toBe(countAfterSettle)
      // Bounded and small: initial mount + at most one measurement-driven
      // update, never dozens of renders from a runaway effect.
      expect(renderCount).toBeLessThanOrEqual(5)
    } finally {
      if (rectDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', rectDescriptor)
      } else {
        delete (HTMLElement.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect
      }
      if (clientHeightDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightDescriptor)
      } else {
        delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
      }
    }
  })
})
