import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Tabs } from './Tabs'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

const ITEMS = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
] as const

function Harness() {
  const [value, setValue] = useState<'one' | 'two' | 'three'>('one')
  return <Tabs items={ITEMS} value={value} onChange={setValue} ariaLabel="Sections" />
}

// A value that matches nothing in items, forced past the type checker. This
// happens for real when a stale value (persisted state, a filtered list)
// no longer lines up with the current items.
function MismatchHarness() {
  return (
    <Tabs
      items={ITEMS}
      value={'missing' as unknown as 'one' | 'two' | 'three'}
      onChange={() => {}}
      ariaLabel="Sections"
    />
  )
}

describe('Tabs', () => {
  it('exposes tablist and tab roles with the active tab selected', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'One', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Two', selected: false })).toBeInTheDocument()
  })

  it('keeps only the active tab in the tab order', () => {
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves selection with ArrowRight and wraps at the end', () => {
    render(<Harness />)
    const first = screen.getByRole('tab', { name: 'One' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Two', selected: true })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Two' }), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Three' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'One', selected: true })).toBeInTheDocument()
  })

  it('wraps backwards from the first tab with ArrowLeft', () => {
    render(<Harness />)
    const first = screen.getByRole('tab', { name: 'One' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Three', selected: true })).toBeInTheDocument()
  })

  it('moves DOM focus to the newly selected tab', () => {
    render(<Harness />)
    const first = screen.getByRole('tab', { name: 'One' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Two' }))
  })

  it('jumps to the first and last tab with Home and End', () => {
    render(<Harness />)
    const first = screen.getByRole('tab', { name: 'One' })
    first.focus()
    fireEvent.keyDown(first, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Three', selected: true })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Three' }), { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'One', selected: true })).toBeInTheDocument()
  })

  it('links each tab to its panel', () => {
    render(<Harness />)
    const tab = screen.getByRole('tab', { name: 'Two' })
    expect(tab).toHaveAttribute('id', 'tab-two')
    expect(tab).toHaveAttribute('aria-controls', 'panel-two')
  })

  it('keeps the tablist keyboard reachable when value matches no item', () => {
    render(<MismatchHarness />)
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('tabindex', '-1')
    expect(screen.queryByRole('tab', { selected: true })).not.toBeInTheDocument()
  })

  describe('on desktop', () => {
    it('keeps the bordered pill markup', () => {
      render(<Harness />)
      expect(screen.getByRole('tablist').className).toContain('flex flex-wrap gap-2')
      const active = screen.getByRole('tab', { name: 'One' })
      expect(active.className).toContain('px-3 py-1.5 rounded-md')
      expect(active.className).toContain('font-medium border transition-colors')
      expect(active.className).toContain('border-accent text-accent bg-accent/10')
      expect(active.className).not.toContain('min-h-[44px]')
    })
  })

  describe('on a phone', () => {
    beforeEach(() => setMatchMedia(false))
    afterEach(() => resetMatchMedia())

    it('renders one non-wrapping scrollable row with a bottom divider', () => {
      render(<Harness />)
      const list = screen.getByRole('tablist', { name: 'Sections' })
      expect(list.className).not.toContain('flex-wrap')
      expect(list.className).toContain('flex-nowrap')
      expect(list.className).toContain('overflow-x-auto')
      expect(list.className).toContain('border-b')
    })

    it('gives every tab a 44px tap target and no box border', () => {
      render(<Harness />)
      for (const tab of screen.getAllByRole('tab')) {
        expect(tab.className).toContain('min-h-[44px]')
        expect(tab.className).toContain('shrink-0')
        expect(tab.className).toContain('flex-auto')
        expect(tab.className).toContain('min-w-fit')
        expect(tab.className).not.toContain('rounded-md')
      }
    })

    it('marks the active tab with an accent underline', () => {
      render(<Harness />)
      const active = screen.getByRole('tab', { name: 'One' })
      expect(active).toHaveAttribute('aria-selected', 'true')
      expect(active.className).toContain('border-accent')
      expect(active.className).toContain('text-accent')
      const inactive = screen.getByRole('tab', { name: 'Two' })
      expect(inactive.className).toContain('border-transparent')
      expect(inactive.className).not.toContain('border-accent')
    })

    it('keeps roving tabindex and arrow key behaviour', () => {
      render(<Harness />)
      expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '0')
      expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1')
      const first = screen.getByRole('tab', { name: 'One' })
      first.focus()
      fireEvent.keyDown(first, { key: 'ArrowRight' })
      expect(screen.getByRole('tab', { name: 'Two', selected: true })).toBeInTheDocument()
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Two' }))
      fireEvent.keyDown(screen.getByRole('tab', { name: 'Two' }), { key: 'End' })
      expect(screen.getByRole('tab', { name: 'Three', selected: true })).toBeInTheDocument()
    })

    it('scrolls the active tab into view when it changes', () => {
      const spy = vi.fn()
      const original = HTMLElement.prototype.scrollIntoView
      HTMLElement.prototype.scrollIntoView = spy
      try {
        render(<Harness />)
        spy.mockClear()
        fireEvent.click(screen.getByRole('tab', { name: 'Three' }))
        expect(spy).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' })
      } finally {
        HTMLElement.prototype.scrollIntoView = original
      }
    })
  })
})
