import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'
import { AddAccountModal } from './AddAccountModal'
import { useAccountsStore } from '../../store/useAccountsStore'

describe('AddAccountModal', () => {
  it('renders when open and closes via scrim', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<AddAccountModal isOpen onClose={onClose} />)
    expect(getByTestId('sheet-panel')).toBeInTheDocument()
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('AddAccountModal mobile header (no double close)', () => {
  afterEach(() => resetMatchMedia())

  it('shows no visible sheet close control on mobile and hides its own header there', () => {
    setMatchMedia(false)
    render(<AddAccountModal isOpen onClose={() => {}} defaultType="bank" editingAccount={null} />)
    // the modal's own header row is desktop-only. Sheet renders via createPortal
    // to document.body, so query there rather than RTL's pre-portal `container`.
    const ownHeader = document.body.querySelector('.border-b')
    expect(ownHeader?.className).toMatch(/\bhidden\b/)
    expect(ownHeader?.className).toMatch(/desktop:flex/)
    // jsdom fallback: no stylesheet is loaded in tests, so Tailwind's `hidden`
    // class has no visibility effect here and both Close buttons render in the
    // DOM. We already assert the gating class above, so scope the "one close
    // control" check to buttons outside the desktop-gated header, matching
    // what a real mobile browser renders.
    const closeButtons = screen
      .getAllByRole('button', { name: 'Close' })
      .filter((btn) => !ownHeader?.contains(btn))
    expect(closeButtons).toHaveLength(1)
    expect(closeButtons.every((btn) => btn.hasAttribute('data-sheet-hidden-close'))).toBe(true)
    expect(closeButtons.every((btn) => btn.className.split(' ').includes('sr-only'))).toBe(true)
  })
})

describe('AddAccountModal form state', () => {
  it('starts blank when opened to add, after having been opened to edit', () => {
    const editing = { id: 'a1', name: 'Chequing', value: 1200, type: 'bank' as const, currency: 'CAD' as const }
    const { rerender } = render(
      <AddAccountModal isOpen onClose={() => {}} editingAccount={editing} />,
    )
    expect(screen.getByDisplayValue('Chequing')).toBeInTheDocument()

    rerender(<AddAccountModal isOpen={false} onClose={() => {}} editingAccount={editing} />)
    rerender(<AddAccountModal isOpen onClose={() => {}} editingAccount={null} />)

    expect(screen.queryByDisplayValue('Chequing')).not.toBeInTheDocument()
  })

  it('loads the edited account into the form', () => {
    const editing = { id: 'a1', name: 'Chequing', value: 1200, type: 'bank' as const, currency: 'CAD' as const }
    render(<AddAccountModal isOpen onClose={() => {}} editingAccount={editing} />)
    expect(screen.getByDisplayValue('Chequing')).toBeInTheDocument()
  })
})

describe('account currency selection', () => {
  const initialState = useAccountsStore.getState()
  afterEach(() => useAccountsStore.setState(initialState, true))

  it.each(['bank', 'investment', 'debt', 'receivable', 'other'] as const)('saves default CAD for a new %s account', (type) => {
    render(<AddAccountModal isOpen onClose={() => {}} defaultType={type} />)
    fireEvent.change(screen.getByLabelText('Name / Description'), { target: { value: 'CAD account' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Account' }))
    expect(useAccountsStore.getState().accounts.at(-1)).toMatchObject({ name: 'CAD account', type, currency: 'CAD' })
  })

  it.each(['bank', 'investment', 'debt', 'receivable', 'other'] as const)('defaults %s to CAD and saves USD without changing the balance', (type) => {
    render(<AddAccountModal isOpen onClose={() => {}} defaultType={type} />)
    expect(screen.getByRole('button', { name: 'Currency' })).toHaveTextContent('CAD')
    fireEvent.change(screen.getByLabelText('Name / Description'), { target: { value: 'Test account' } })
    fireEvent.change(screen.getByLabelText('Balance'), { target: { value: '123.456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Currency' }))
    expect(screen.getByRole('option', { name: 'CAD' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'USD' }))
    expect(screen.getByLabelText('Balance (USD)')).toHaveValue('123.456')
    fireEvent.click(screen.getByRole('button', { name: 'Add Account' }))
    expect(useAccountsStore.getState().accounts.at(-1)).toMatchObject({ name: 'Test account', value: 123.456, type, currency: 'USD' })
  })

  it('keeps a currency edit as a draft until confirmed, including after cancellation', () => {
    const account = { id: 'a1', name: 'Savings', value: 1000.125, type: 'bank' as const, currency: 'USD' as const }
    useAccountsStore.setState({ accounts: [account] })
    render(<AddAccountModal isOpen onClose={() => {}} editingAccount={account} />)
    expect(screen.getByRole('button', { name: 'Currency' })).toHaveTextContent('USD')
    fireEvent.click(screen.getByRole('button', { name: 'Currency' }))
    fireEvent.click(screen.getByRole('option', { name: 'CAD' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(useAccountsStore.getState().accounts[0].currency).toBe('USD')
    expect(screen.getByText(/balance will remain 1,000.125/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }))
    expect(screen.getByRole('button', { name: 'Currency' })).toHaveTextContent('CAD')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Currency Change' }))
    expect(useAccountsStore.getState().accounts[0]).toMatchObject({ value: 1000.125, currency: 'CAD' })
  })
})
