import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { DashboardMobile } from './DashboardMobile'
import { useAccountsStore } from '../../store/useAccountsStore'
import type { Account } from '../../store/useAccountsStore'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useUndoStore } from '../../store/useUndoStore'
import { useAccountFxStore } from '../../store/useAccountFxStore'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

const initialAccounts = useAccountsStore.getState()

const acc = (id: string, name: string, type: Account['type'], value: number): Account => ({ id, name, value, type, currency: 'CAD' })

function seed(accounts: Account[]) {
  useAccountsStore.setState({ accounts, history: [] })
}
function renderCards(hidden: string[] = []) {
  return render(<MemoryRouter><DashboardMobile hidden={hidden} rest={<p>Other widgets</p>} /></MemoryRouter>)
}

beforeEach(() => {
  setMatchMedia(false)
  useAccountsStore.setState(initialAccounts, true)
  useAccountFxStore.setState({ resolved: undefined, loading: false, error: undefined })
})
afterEach(() => resetMatchMedia())

describe('DashboardMobile', () => {
  it('shows the month net beside the title, a bar of money out against money in, and In and Out under it', () => {
    const ym = new Date().toISOString().slice(0, 7)
    const t = (id: string, day: string, amount: number, type: 'income' | 'expense') => ({ id, date: `${ym}-${day}`, amount, description: id, type, categoryId: '' })
    useBudgetStore.setState({ transactions: Object.fromEntries([t('i', '01', 4000, 'income'), t('e', '02', 1000, 'expense')].map((x) => [x.id, x])) as never })
    seed([acc('b1', 'Chequing', 'bank', 10)])
    renderCards()
    const card = screen.getByRole('region', { name: 'This Month' })
    expect(card.querySelector('[data-key-figure]')).toHaveTextContent('+$3,000')
    expect(within(card).getByText('Projected Net')).toBeInTheDocument()
    expect(within(card).getByText('$4,000')).toBeInTheDocument()
    expect(within(card).getByText('$1,000')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: '25 percent of money in has gone out' })).toBeInTheDocument()
    useBudgetStore.setState({ transactions: {} })
  })

  it('shows the net worth, the month band and one fold per account group, then the other widgets', () => {
    seed([acc('b1', 'Chequing', 'bank', 1200), acc('d1', 'Visa', 'debt', 200)])
    const { container } = renderCards()
    expect(container.querySelector('[data-key-figure]')).toHaveTextContent('$1,000.00')
    expect(screen.getByRole('heading', { name: 'This Month' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
    expect(screen.getByText('Other widgets')).toBeInTheDocument()
  })

  it('keeps every group folded with its total showing', () => {
    seed([acc('i1', 'TFSA', 'investment', 5000), acc('d1', 'Visa', 'debt', 200)])
    const { container } = renderCards()
    const fold = (id: string) => container.querySelector(`details[data-widget-id="${id}"]`) as HTMLDetailsElement
    expect(fold('investment-accounts').open).toBe(false)
    expect(fold('debt').open).toBe(false)
    expect(fold('debt').querySelector('summary')).toHaveTextContent('Debts & Liabilities')
    expect(fold('debt').querySelector('summary')).toHaveTextContent('$200.00')
    expect(fold('investment-accounts').querySelector('summary')).toHaveTextContent('$5,000.00')
  })

  it('says a group is empty in one line and still offers to add to it', () => {
    seed([acc('b1', 'Chequing', 'bank', 10)])
    renderCards()
    expect(screen.getByText('No receivables yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Receivable' })).toBeInTheDocument()
  })

  it('follows the Customize switches of the widgets it replaces', () => {
    seed([acc('b1', 'Chequing', 'bank', 10), acc('d1', 'Visa', 'debt', 5)])
    const { container } = renderCards(['trend', 'income', 'expense', 'monthly-summary', 'debt'])
    expect(container.querySelector('[data-key-figure]')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'This Month' })).toBeNull()
    expect(screen.queryByText('Debts & Liabilities')).toBeNull()
    expect(screen.getByText('Bank Accounts')).toBeInTheDocument()
  })

  it('keeps the month band while any one of its three widgets is on', () => {
    seed([acc('b1', 'Chequing', 'bank', 10)])
    renderCards(['income', 'expense'])
    expect(screen.getByRole('heading', { name: 'This Month' })).toBeInTheDocument()
  })

  it('drops the whole accounts card when every group is switched off', () => {
    seed([acc('b1', 'Chequing', 'bank', 10)])
    renderCards(['bank', 'investment-accounts', 'other', 'receivable', 'debt'])
    expect(screen.queryByRole('heading', { name: 'Accounts' })).toBeNull()
  })

  it('caps a long group and reveals the rest on request', () => {
    seed(Array.from({ length: 8 }, (_, i) => acc(`b${i}`, `Account ${i}`, 'bank', 10 + i)))
    renderCards()
    expect(screen.getAllByTestId(/^account-row-/)).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8 accounts' }))
    expect(screen.getAllByTestId(/^account-row-/)).toHaveLength(8)
  })

  it('edits an account in the real account sheet', async () => {
    seed([acc('b1', 'Chequing', 'bank', 10)])
    renderCards()
    fireEvent.click(screen.getByLabelText('Edit account'))
    await vi.dynamicImportSettled()
    expect(await screen.findByRole('dialog', { name: 'Edit Account' })).toBeInTheDocument()
  })

  it('adds to a group and deletes with an undo offer', async () => {
    seed([acc('b1', 'Chequing', 'bank', 10)])
    renderCards()
    fireEvent.click(screen.getByRole('button', { name: 'Add Bank Account' }))
    await vi.dynamicImportSettled()
    expect(await screen.findByRole('dialog', { name: 'Add Account' })).toBeInTheDocument()

    fireEvent.click(within(screen.getByTestId('account-row-b1')).getByLabelText('Delete Chequing'))
    expect(useAccountsStore.getState().accounts).toHaveLength(0)
    expect(useUndoStore.getState().pending?.label).toContain('Chequing')
  })
})
