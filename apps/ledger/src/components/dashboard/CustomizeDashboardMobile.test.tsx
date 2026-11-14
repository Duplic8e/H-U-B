import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CustomizeDashboard } from './CustomizeDashboard'
import { useDashboardLayoutStore } from '../../store/useDashboardLayoutStore'
import { DASHBOARD_WIDGET_IDS } from '../../pages/dashboardWidgets'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

const initial = useDashboardLayoutStore.getState()

beforeEach(() => {
  setMatchMedia(false)
  useDashboardLayoutStore.setState(initial, true)
})
afterEach(() => resetMatchMedia())

const renderPanel = (ids: string[] = DASHBOARD_WIDGET_IDS) => render(<CustomizeDashboard open onClose={() => {}} orderedIds={ids} />)
const hidden = () => useDashboardLayoutStore.getState().hidden

describe('Customize Dashboard on a phone', () => {
  it('lists the cards the phone page has, not one row per desktop widget', () => {
    renderPanel()
    for (const name of ['Net Worth', 'This Month', 'Bank Accounts', 'Investment Accounts', 'Others', 'Receivables', 'Debts & Liabilities', 'Net Worth Over Time', 'Portfolio', 'Top Goal', 'Upcoming Vests']) {
      expect(screen.getByRole('switch', { name: `Show ${name}` })).toBeInTheDocument()
    }
    expect(screen.queryByRole('switch', { name: 'Show Income' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Show Expenses' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Show Monthly Summary' })).toBeNull()
  })

  it('is titled Customize Dashboard with the explanation behind an info button, not in the list', () => {
    renderPanel()
    expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument()
    expect(screen.queryByText('These always come first.')).toBeNull()
    expect(screen.queryByText('Use the arrows to reorder.')).toBeNull()
    expect(screen.queryByText(/This applies to this device only/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'About Customize Dashboard' }))
    expect(screen.getByText('Switch cards off and set their order. This applies to this device only.')).toBeInTheDocument()
  })

  it('switches This Month off and on as one card covering Income, Expenses and Monthly Summary', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('switch', { name: 'Show This Month' }))
    expect(hidden().sort()).toEqual(['expense', 'income', 'monthly-summary'])
    expect(screen.getByRole('switch', { name: 'Show This Month' })).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('switch', { name: 'Show This Month' }))
    expect(hidden()).toEqual([])
  })

  it('shows This Month as on while any one of its widgets is still on', () => {
    useDashboardLayoutStore.setState({ hidden: ['income', 'expense'] })
    renderPanel()
    expect(screen.getByRole('switch', { name: 'Show This Month' })).toHaveAttribute('aria-checked', 'true')
  })

  it('gives arrows only to the cards that can move, and moves one past its neighbour', () => {
    renderPanel()
    expect(screen.queryByLabelText('Move Net Worth up')).toBeNull()
    expect(screen.queryByLabelText('Move Bank Accounts down')).toBeNull()
    expect(screen.getByLabelText('Move Net Worth Over Time up')).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Move Portfolio up'))
    const order = useDashboardLayoutStore.getState().order
    expect(order.indexOf('portfolio')).toBeLessThan(order.indexOf('net-worth'))
    // Every id is still saved, the fixed ones where they were.
    expect([...order].sort()).toEqual([...DASHBOARD_WIDGET_IDS].sort())
    expect(order.indexOf('bank')).toBe(DASHBOARD_WIDGET_IDS.indexOf('bank'))
  })

  it('keeps a hidden card in the saved order when its neighbour moves', () => {
    useDashboardLayoutStore.setState({ hidden: ['top-goal'] })
    renderPanel()
    fireEvent.click(screen.getByLabelText('Move Upcoming Vests up'))
    const order = useDashboardLayoutStore.getState().order
    expect(order).toContain('top-goal')
    expect(order.indexOf('upcoming-vests')).toBeLessThan(order.indexOf('top-goal'))
  })
})
