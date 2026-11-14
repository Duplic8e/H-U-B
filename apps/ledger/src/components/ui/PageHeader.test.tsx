import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { PageHeader, TopBarAction } from './PageHeader'
import { TopBarSlotContext } from '../topBarSlot'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'

afterEach(() => resetMatchMedia())

const action = <TopBarAction icon={Plus} label="Add Transaction" onClick={() => {}} />

describe('PageHeader on desktop', () => {
  it('renders the title, subtitle and desktop actions in the page', () => {
    render(
      <PageHeader
        title="Budgeting"
        subtitle="Track it all."
        actions={<button type="button">Desktop action</button>}
        phoneAction={action}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Budgeting' })).not.toHaveClass('sr-only')
    expect(screen.getByText('Track it all.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desktop action' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Transaction' })).toBeNull()
  })
})

describe('PageHeader on a phone', () => {
  it('portals the title and phone action into the top bar slot, keeping a hidden h1 in the page', () => {
    setMatchMedia(false)
    const slot = document.createElement('div')
    document.body.appendChild(slot)
    const { container } = render(
      <TopBarSlotContext.Provider value={slot}>
        <PageHeader title="Budgeting" subtitle="Track it all." actions={<button type="button">Desktop action</button>} phoneAction={action} />
      </TopBarSlotContext.Provider>,
    )
    expect(container.querySelector('h1')).toHaveClass('sr-only')
    expect(container.querySelector('h1')).toHaveTextContent('Budgeting')
    expect(slot.querySelector('[data-testid="topbar-title"]')).toHaveTextContent('Budgeting')
    expect(slot.querySelector('[data-testid="topbar-title"]')).toHaveAttribute('aria-hidden', 'true')
    expect(slot.querySelector('button[aria-label="Add Transaction"]')).not.toBeNull()
    expect(screen.queryByText('Track it all.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Desktop action' })).toBeNull()
    slot.remove()
  })

  it('falls back to a compact in-page header when there is no top bar slot', () => {
    setMatchMedia(false)
    render(<PageHeader title="Budgeting" subtitle="Track it all." phoneAction={action} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Budgeting' })).not.toHaveClass('sr-only')
    expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeInTheDocument()
    expect(screen.queryByText('Track it all.')).toBeNull()
  })
})

describe('TopBarAction', () => {
  it('is a labelled 44px button that calls onClick', () => {
    const onClick = vi.fn()
    render(<TopBarAction icon={Plus} label="Add Transaction" onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Add Transaction' })
    expect(button.className).toMatch(/min-h-\[44px\]/)
    expect(button.className).toMatch(/min-w-\[44px\]/)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('draws the primary tone as a soft accent tint with an accent icon, not a solid fill', () => {
    render(<TopBarAction icon={Plus} label="Add Transaction" onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Add Transaction' })
    const disc = button.querySelector('span')!
    expect(disc.className).toMatch(/w-\[34px\]/)
    expect(disc.className).toMatch(/h-\[34px\]/)
    expect(disc.className).toContain('color-mix(in_srgb,var(--color-accent)_14%,transparent)')
    expect(disc.className).toContain('hover:bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)]')
    expect(disc.className).toMatch(/text-accent/)
    expect(disc.className).not.toMatch(/bg-\[var\(--color-accent\)\]/)
    expect(disc.className).not.toMatch(/--color-bg-primary/)
    expect(button.querySelector('svg')).toHaveClass('w-5', 'h-5')
  })

  it('leaves the quiet tone as a plain icon with no tint', () => {
    render(<TopBarAction icon={Plus} label="Customize" tone="quiet" onClick={() => {}} />)
    const disc = screen.getByRole('button', { name: 'Customize' }).querySelector('span')!
    expect(disc.className).toMatch(/text-text-secondary/)
    expect(disc.className).not.toContain('color-mix')
  })
})
