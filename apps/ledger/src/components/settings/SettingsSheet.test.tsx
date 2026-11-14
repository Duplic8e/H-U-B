import { useThemeStore } from '../../store/useThemeStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsSheet } from './SettingsSheet'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'
import { useBudgetStore } from '../../store/useBudgetStore'

const noop = () => {}

describe('SettingsSheet', () => {
  it('reads and persists the Refunds & Payments preference directly', async () => {
    useBudgetStore.setState({ refundsAndPaymentsEnabled: true })
    const view = render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    expect(screen.getByLabelText('Refunds & Payments')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Refunds & Payments'))
    expect(useBudgetStore.getState().refundsAndPaymentsEnabled).toBe(false)
    await useBudgetStore.persist.rehydrate()
    expect(screen.getByLabelText('Refunds & Payments')).not.toBeChecked()
    view.unmount()
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    fireEvent.click(screen.getByLabelText('Refunds & Payments'))
    await useBudgetStore.persist.rehydrate()
    expect(useBudgetStore.getState().refundsAndPaymentsEnabled).toBe(true)
  })
  it('renders the section cards and the about footer', () => {
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Market Data')).toBeInTheDocument()
    expect(screen.getByText('Backup')).toBeInTheDocument()
    expect(screen.getByText('Sync')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /What's New/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Not financial advice/ })).toBeInTheDocument()
  })

  it('about footer buttons close the sheet and open their modals', () => {
    const onClose = vi.fn()
    const onOpenWhatsNew = vi.fn()
    const onOpenDisclaimer = vi.fn()
    render(<SettingsSheet open onClose={onClose} onOpenWhatsNew={onOpenWhatsNew} onOpenDisclaimer={onOpenDisclaimer} />)
    fireEvent.click(screen.getByRole('button', { name: /What's New/ }))
    expect(onClose).toHaveBeenCalled()
    expect(onOpenWhatsNew).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Not financial advice/ }))
    expect(onOpenDisclaimer).toHaveBeenCalled()
  })
})

describe('SettingsSheet phone layout', () => {
  beforeEach(() => {
    setMatchMedia(false)
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
  })
  afterEach(() => {
    resetMatchMedia()
    vi.unstubAllGlobals()
  })

  it('Reminders is a text block plus one real 44px button, centered on each other', () => {
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    const action = screen.getByRole('button', { name: 'Enable reminders' })
    expect(action.className).toMatch(/min-h-\[44px\]/)
    // A real bordered button like the other secondary actions, not a bare text link.
    expect(action.className).toMatch(/\bborder\b/)
    expect(action.className).toMatch(/\brounded-md\b/)
    const row = screen.getByTestId('reminders-row')
    expect(row.className).toMatch(/\bitems-center\b/)
    expect(row).toContainElement(action)
  })

  it('every section is a fold with a title, and only Appearance starts open', () => {
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    const folds = Array.from(document.querySelectorAll<HTMLDetailsElement>('details.themed-card'))
    expect(folds.map((d) => d.querySelector('summary > span:nth-child(2)')!.textContent)).toEqual([
      'Appearance', 'Market Data', 'Transactions', 'Backup', 'Sync', 'Reminders',
    ])
    expect(folds.map((d) => d.open)).toEqual([true, false, false, false, false, false])
  })

  it('shows each section state on its row: theme name, key status, refunds', () => {
    useBudgetStore.setState({ refundsAndPaymentsEnabled: true })
    useThemeStore.getState().setPreference('dark')
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    expect(screen.getAllByText('Dark').length).toBeGreaterThan(1) // the row summary and the picker
    expect(screen.getByText('No Key')).toBeInTheDocument()
    expect(screen.getByText('Refunds Enabled')).toBeInTheDocument()
  })

  it('turns Refunds & Payments on and off with a switch', () => {
    useBudgetStore.setState({ refundsAndPaymentsEnabled: true })
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    const toggle = screen.getByRole('switch', { name: 'Refunds & Payments' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)
    expect(useBudgetStore.getState().refundsAndPaymentsEnabled).toBe(false)
    expect(screen.getByText('Refunds Disabled')).toBeInTheDocument()
  })

  it('the full-width actions share the Reminders action height, radius and border', () => {
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    const reference = screen.getByRole('button', { name: 'Enable reminders' }).className
    for (const name of ['Load demo data', 'Save Client ID']) {
      const cls = screen.getByRole('button', { name }).className
      for (const token of ['min-h-[44px]', 'rounded-md', 'border', 'border-border', 'px-3']) {
        expect(cls.split(/\s+/)).toContain(token)
        expect(reference.split(/\s+/)).toContain(token)
      }
    }
  })

  it('Save Client ID reads as disabled without dropping below readable contrast', () => {
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    const save = screen.getByRole('button', { name: 'Save Client ID' })
    expect(save).toBeDisabled()
    expect(save.className).toMatch(/disabled:border-dashed/)
    expect(save.className).toMatch(/disabled:opacity-70/)
  })

  it('has no visible phone title but keeps its accessible name', () => {
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    // The desktop-only heading stays in the DOM (hidden by CSS); the phone header has none.
    expect(screen.getByTestId('sheet-header').querySelector('h2')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })

  it('has no section descriptions on a phone: the explanations sit behind info buttons', () => {
    const { unmount } = render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    expect(screen.queryByText('Pick a theme for the whole app.')).toBeNull()
    expect(screen.queryByText('Save, restore or try sample data.')).toBeNull()
    expect(screen.queryByText(/Sync through your own Google Drive/)).toBeNull()
    expect(screen.getByLabelText('About Google Client ID')).toBeInTheDocument()
    expect(screen.getByLabelText('About Refunds & Payments')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('About Google Client ID'))
    expect(screen.getByText(/Sync through your own Google Drive/)).toBeInTheDocument()
    unmount()
    setMatchMedia(true)
    render(<SettingsSheet open onClose={noop} onOpenWhatsNew={noop} onOpenDisclaimer={noop} />)
    expect(screen.getByText(/Sync through your own Google Drive/)).toBeInTheDocument()
    expect(screen.queryByLabelText('About Google Client ID')).toBeNull()
    expect(screen.getByRole('button', { name: 'Enable reminders' }).className).toMatch(/text-accent/)
  })
})
