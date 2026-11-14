import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setMatchMedia, resetMatchMedia } from '../test-utils/matchMedia'
import { Dashboard, DASHBOARD_WIDGET_LABELS, DASHBOARD_WIDGET_IDS } from './Dashboard'
import { useDashboardLayoutStore } from '../store/useDashboardLayoutStore'

afterEach(() => resetMatchMedia())

describe('Dashboard widget drag gating', () => {
  it('does not mark widgets draggable on mobile', () => {
    setMatchMedia(false) // mobile: useIsDesktop() === false
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const draggables = container.querySelectorAll('[draggable="true"]')
    expect(draggables.length).toBe(0)
  })

  it('marks widgets draggable on desktop', () => {
    setMatchMedia(true) // desktop
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const draggables = container.querySelectorAll('[draggable="true"]')
    expect(draggables.length).toBeGreaterThan(0)
  })

  it('does not render a widget the user has switched off', () => {
    useDashboardLayoutStore.setState({ order: [], hidden: ['top-goal'] })
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Top Goal')).toBeNull()
  })

  it('has a label for every widget id it renders', () => {
    expect(Object.keys(DASHBOARD_WIDGET_LABELS).sort()).toEqual([...DASHBOARD_WIDGET_IDS].sort())
  })
})

describe('Dashboard header on a phone', () => {
  it('offers Customize as one labelled action and drops the subtitle', () => {
    setMatchMedia(false)
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getAllByRole('button', { name: 'Customize' })).toHaveLength(1)
    expect(screen.queryByText('All your accounts, balances, and trends in one place.')).toBeNull()
  })
})

it('opens the deferred Customize panel from its visible header action', async () => {
  setMatchMedia(true)
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Customize' }))
  // The deferred module can take longer than the DOM query's default window
  // under the full suite. Wait for that actual prerequisite, not a larger timer.
  await vi.dynamicImportSettled()
  expect(await screen.findByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Show Net Worth Over Time' })).toBeInTheDocument()
})

describe('Dashboard key figure on a phone', () => {
  it('puts the net worth figure first on a phone, whatever the saved order', () => {
    setMatchMedia(false)
    useDashboardLayoutStore.setState({ order: ['top-goal', 'trend'], hidden: [] })
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const first = container.querySelector('[data-widget-id]')
    expect(first?.getAttribute('data-widget-id')).toBe('trend')
    expect(first?.querySelector('[data-key-figure]')).not.toBeNull()
  })

  it('keeps the saved order on desktop', () => {
    useDashboardLayoutStore.setState({ order: [], hidden: [] })
    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const ids = [...container.querySelectorAll('[data-widget-id]')].map((el) => el.getAttribute('data-widget-id'))
    expect(ids[0]).toBe('net-worth')
  })
})
