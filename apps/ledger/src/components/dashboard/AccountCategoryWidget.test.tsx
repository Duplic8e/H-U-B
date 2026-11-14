import { fireEvent, render, screen, within } from '@testing-library/react'
import { AccountCategoryWidget } from './AccountCategoryWidget'
import { useAccountsStore } from '../../store/useAccountsStore'
import { useUndoStore } from '../../store/useUndoStore'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'
import { useAccountFxStore } from '../../store/useAccountFxStore'

const initialState = useAccountsStore.getState()

beforeEach(() => {
  useAccountsStore.setState(initialState, true)
  useAccountFxStore.setState({ resolved: undefined, loading: false, error: undefined })
})

describe('AccountCategoryWidget mobile tap targets', () => {
  it('renders touch-visible edit/remove buttons with >=44px hit areas', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Chequing', value: 1200, type: 'bank', currency: 'CAD' }],
    })
    render(<AccountCategoryWidget title="Bank" type="bank" />)
    const edit = screen.getByLabelText('Edit account')
    const remove = screen.getByLabelText('Delete Chequing')
    for (const btn of [edit, remove]) {
      const classes = btn.className.split(/\s+/)
      expect(classes).toContain('min-h-[44px]')
      expect(classes).toContain('min-w-[44px]')
      expect(classes).toContain('sm:min-h-0')
      expect(classes).toContain('sm:min-w-0')
      expect(classes).not.toContain('opacity-0') // bare opacity-0 would hide it on touch
      expect(classes).not.toContain('sm:opacity-0') // width is the wrong gate, hover capability is the right one
      expect(classes).toContain('reveal-on-hover')
    }
  })

  it('lets a long account name wrap rather than truncate, at every width', () => {
    // Truncation was safe only while the row had room. On a 2-column tablet
    // grid the name column measured 11px, so `truncate` cut every name to one
    // or two characters.
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Joint Savings for the Big 2026 Vacation Fund', value: 1200, type: 'bank', currency: 'CAD' }],
    })
    render(<AccountCategoryWidget title="Bank" type="bank" />)
    const name = screen.getByText(/Joint Savings/)
    const classes = name.className.split(/\s+/)
    expect(classes).toContain('break-words')
    expect(classes).toContain('flex-1')
    expect(classes).toContain('min-w-0')
    expect(classes).not.toContain('truncate')
    expect(classes).not.toContain('desktop:truncate')
  })

  it('gives the name a width floor so the row can fall back to a stacked layout on a narrow desktop card', () => {
    // On the narrowest single-column tablet card the value block (amount plus
    // two icon buttons) is nearly the whole row width by itself. Without a
    // floor, flex-1/min-w-0 alone still let the name get squeezed to 0
    // instead of wrapping the row to a second line.
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Mortgage - 12 Maplewood Crescent', value: 412500, type: 'debt', currency: 'CAD' }],
    })
    const { container } = render(<AccountCategoryWidget title="Debts & Liabilities" type="debt" />)
    const row = container.querySelector('[data-testid="account-row-a1"]')!
    const name = container.querySelector('[data-testid="account-name-a1"]')!
    expect(row.className).toMatch(/desktop:flex-wrap/)
    expect(name.className).toMatch(/desktop:min-w-\[70px\]/)
  })
})

describe('AccountCategoryWidget mobile name layout', () => {
  it('stacks a long account name above its value on mobile so it does not truncate', () => {
    // The name column measured 111px while "Mortgage - 12 Maplewood Crescent"
    // needs 220px, so the name was cut mid-word on every phone.
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Mortgage - 12 Maplewood Crescent', value: 412000, type: 'debt', currency: 'CAD' }],
    })
    const { container } = render(<AccountCategoryWidget title="Debts & Liabilities" type="debt" />)
    const row = container.querySelector('[data-testid="account-row-a1"]')!
    expect(row).not.toBeNull()
    expect(row.className).toMatch(/flex-col/)
    expect(row.className).toMatch(/desktop:flex-row/)
  })
})

describe('AccountCategoryWidget empty state', () => {
  it('invites the user to add their first account instead of showing a bare sentence', () => {
    useAccountsStore.setState({ accounts: [] })
    render(<AccountCategoryWidget title="Bank Accounts" type="bank" />)
    expect(screen.getByText('No accounts yet')).toBeInTheDocument()
    const cta = screen.getByRole('button', { name: 'Add account' })
    expect(cta).toBeInTheDocument()
  })

  it('uses an explicit singular noun for the debt widget instead of a mangled title', () => {
    useAccountsStore.setState({ accounts: [] })
    render(<AccountCategoryWidget title="Debts & Liabilities" type="debt" />)
    expect(screen.getByText('Add your first debt to start tracking.')).toBeInTheDocument()
  })
})

describe('AccountCategoryWidget account delete undo', () => {
  it('offers an undo that restores a deleted account with its value', () => {
    useUndoStore.setState({ pending: null })
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Chequing', value: 2500, type: 'bank', currency: 'CAD' }],
      history: [],
    })
    render(<AccountCategoryWidget title="Bank Accounts" type="bank" />)
    fireEvent.click(screen.getByLabelText('Delete Chequing'))

    expect(useAccountsStore.getState().accounts).toEqual([])
    expect(useUndoStore.getState().pending?.label).toBe('Deleted account "Chequing"')

    useUndoStore.getState().runUndo()
    const restored = useAccountsStore.getState().accounts
    expect(restored).toHaveLength(1)
    expect(restored[0].name).toBe('Chequing')
    expect(restored[0].value).toBe(2500)
    expect(restored[0].currency).toBe('CAD')
  })

  it('restores a deleted USD account with its native currency', () => {
    useUndoStore.setState({ pending: null })
    useAccountsStore.setState({ accounts: [{ id: 'usd', name: 'US Bank', value: 100, type: 'bank', currency: 'USD' }] })
    render(<AccountCategoryWidget title="Bank" type="bank" />)
    fireEvent.click(screen.getByLabelText('Delete US Bank'))
    useUndoStore.getState().runUndo()
    expect(useAccountsStore.getState().accounts[0]).toMatchObject({ value: 100, currency: 'USD' })
  })
})

describe('AccountCategoryWidget valuation', () => {
  it('shows native USD, approximate CAD, and a converted category total', () => {
    useAccountFxStore.setState({ resolved: { value: { from: 'USD', to: 'CAD', rate: 1.35, date: '2026-10-06', asOf: '2026-10-06T00:00:00Z' }, source: 'live', status: 'success', asOf: '2026-10-06T00:00:00Z', stale: false } })
    useAccountsStore.setState({ accounts: [
      { id: 'cad', name: 'Chequing', value: 1000, type: 'bank', currency: 'CAD' },
      { id: 'usd', name: 'US Savings', value: 1000, type: 'bank', currency: 'USD' },
    ] })
    render(<AccountCategoryWidget title="Bank" type="bank" />)
    expect(screen.getByText(/\$2,350\.00/)).toBeInTheDocument()
    expect(within(screen.getByTestId('account-row-usd')).getByText('$1,000.00')).toBeInTheDocument()
    expect(within(screen.getByTestId('account-name-usd')).getByText('USD')).toBeInTheDocument()
    expect(screen.getByText('≈ $1,350.00')).toBeInTheDocument()
    expect(within(screen.getByTestId('account-row-cad')).queryByText('CAD')).toBeNull()
  })

  it('withholds only the category with an unavailable conversion', () => {
    useAccountFxStore.setState({ resolved: undefined })
    useAccountsStore.setState({ accounts: [
      { id: 'cad', name: 'Chequing', value: 1000, type: 'bank', currency: 'CAD' },
      { id: 'usd', name: 'US Savings', value: 1000, type: 'debt', currency: 'USD' },
    ] })
    const { rerender } = render(<AccountCategoryWidget title="Bank" type="bank" />)
    expect(screen.getAllByText(/\$1,000\.00/)).toHaveLength(2)
    rerender(<AccountCategoryWidget title="Debt" type="debt" />)
    expect(screen.getAllByText('Conversion Needed').length).toBeGreaterThan(0)
    expect(within(screen.getByTestId('account-row-usd')).getByText('$1,000.00')).toBeInTheDocument()
    expect(within(screen.getByTestId('account-name-usd')).getByText('USD')).toBeInTheDocument()
  })
})

it('opens the deferred account editor with the selected account and currency', async () => {
  useAccountsStore.setState({ accounts: [
    { id: 'usd', name: 'USD cash', value: 100, type: 'bank', currency: 'USD' },
  ] })
  render(<AccountCategoryWidget title="Bank" type="bank" />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit account' }))
  expect(await screen.findByRole('dialog', { name: 'Edit Account' })).toBeInTheDocument()
  expect(screen.getByLabelText('Name / Description')).toHaveProperty('value', 'USD cash')
  expect(screen.getByLabelText('Currency')).toHaveTextContent('USD')
})

it('opens the deferred account editor with the selected account and currency', async () => {
  useAccountsStore.setState({ accounts: [
    { id: 'usd', name: 'USD cash', value: 100, type: 'bank', currency: 'USD' },
  ] })
  render(<AccountCategoryWidget title="Bank" type="bank" />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit account' }))
  expect(await screen.findByRole('dialog', { name: 'Edit Account' })).toBeInTheDocument()
  expect(screen.getByLabelText('Name / Description')).toHaveProperty('value', 'USD cash')
  expect(screen.getByLabelText('Currency')).toHaveTextContent('USD')
})

describe('AccountCategoryWidget list on a phone', () => {
  afterEach(() => resetMatchMedia())

  it('shows five accounts and a Show all button instead of a scroll area', () => {
    setMatchMedia(false)
    useAccountsStore.setState({
      accounts: Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, name: `Account ${i}`, value: 100 * (i + 1), type: 'bank' as const, currency: 'CAD' as const })),
    })
    const { container } = render(<AccountCategoryWidget title="Bank" type="bank" />)
    expect(container.querySelectorAll('[data-testid^="account-row-"]')).toHaveLength(5)
    expect(container.querySelector('.max-h-\\[150px\\]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7 accounts' }))
    expect(container.querySelectorAll('[data-testid^="account-row-"]')).toHaveLength(7)
  })
})

describe('AccountCategoryWidget empty on a phone', () => {
  afterEach(() => resetMatchMedia())

  it('is one sentence under the title, with the header Add as its only action', () => {
    setMatchMedia(false)
    useAccountsStore.setState({ accounts: [] })
    render(<AccountCategoryWidget title="Receivables" type="receivable" />)
    expect(screen.getByText('No receivables yet.')).toBeInTheDocument()
    expect(screen.queryByText(/\$0\.00/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add account' })).toBeNull()
    expect(screen.getByRole('button', { name: /Add/ })).toBeInTheDocument()
  })

  it('keeps the full empty state on desktop', () => {
    useAccountsStore.setState({ accounts: [] })
    render(<AccountCategoryWidget title="Receivables" type="receivable" />)
    expect(screen.getByText(/\$0\.00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument()
  })
})
