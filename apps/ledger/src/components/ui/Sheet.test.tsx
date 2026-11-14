import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Sheet } from './Sheet.tsx'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

beforeEach(() => resetMatchMedia())

// Phone sheets carry no visible X. Every Close button left in the tree must be the screen
// reader one, which is sr-only until focused. (jsdom has no stylesheet, so the class stands
// in for the size check the e2e does for real.)
function expectNoVisibleClose() {
  for (const btn of screen.queryAllByRole('button', { name: 'Close' })) {
    expect(btn).toHaveAttribute('data-sheet-hidden-close')
    expect(btn.className.split(' ')).toContain('sr-only')
  }
}

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(
      <Sheet open={false} onClose={() => {}} ariaLabel="x">body</Sheet>
    )
    expect(queryByTestId('sheet-panel')).toBeNull()
  })

  it('renders a dialog panel when open', () => {
    const { getByTestId, getByText } = render(
      <Sheet open onClose={() => {}} ariaLabel="x">hello</Sheet>
    )
    expect(getByTestId('sheet-panel').getAttribute('role')).toBe('dialog')
    expect(getByText('hello')).toBeInTheDocument()
  })

  it('closes on scrim click when dismissible', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(
      <Sheet open onClose={onClose} ariaLabel="x">c</Sheet>
    )
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape when dismissible', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose} ariaLabel="x">c</Sheet>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT close on scrim/Escape when dismissible=false', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(
      <Sheet open onClose={onClose} dismissible={false} ariaLabel="x">c</Sheet>
    )
    fireEvent.click(getByTestId('sheet-scrim'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows no visible Close button on mobile, and scrim and Escape still dismiss', () => {
    setMatchMedia(false) // mobile
    const onClose = vi.fn()
    const { queryByLabelText, getByTestId } = render(
      <Sheet open onClose={onClose} ariaLabel="x">c</Sheet>
    )
    // The only Close is the screen reader one: sr-only until focused. jsdom loads no
    // stylesheet, so the class contract stands in for the e2e's real size check.
    const hidden = queryByLabelText('Close')!
    expect(hidden).toHaveAttribute('data-sheet-hidden-close')
    expect(hidden.className.split(' ')).toContain('sr-only')
    expect(hidden.className.split(' ')).toContain('focus:not-sr-only')
    expect(hidden.className.split(' ')).toContain('focus:min-h-[44px]')
    fireEvent.click(getByTestId('sheet-scrim'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('the hidden phone Close button is the first focusable, closes the sheet, and is not focused on open', () => {
    setMatchMedia(false) // mobile
    const onClose = vi.fn()
    const { getByTestId, getByLabelText } = render(
      <Sheet open onClose={onClose} ariaLabel="x">
        <button>content</button>
      </Sheet>
    )
    const panel = getByTestId('sheet-panel')
    const close = getByLabelText('Close')
    const first = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    expect(first).toBe(close)
    expect(document.activeElement).not.toBe(close)
    expect(document.activeElement).toBe(screen.getByText('content'))
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders the always-visible X, and not the hidden one, when showClose is true', () => {
    setMatchMedia(false) // mobile
    const { getAllByLabelText } = render(
      <Sheet open onClose={() => {}} showClose ariaLabel="x">c</Sheet>
    )
    const closes = getAllByLabelText('Close')
    expect(closes).toHaveLength(1)
    expect(closes[0]).not.toHaveAttribute('data-sheet-hidden-close')
    expect(closes[0].className).not.toMatch(/sr-only/)
  })

  it('focuses the first visible control on open, skipping display:none ones', () => {
    setMatchMedia(false) // mobile
    render(
      <Sheet open onClose={() => {}} ariaLabel="x">
        <button style={{ display: 'none' }}>desktop only</button>
        <div style={{ display: 'none' }}>
          <button>inside hidden parent</button>
        </div>
        <button>visible</button>
      </Sheet>
    )
    expect(document.activeElement).toBe(screen.getByText('visible'))
  })

  it('moves focus into a sheet that was closed and then opened, once it has mounted', () => {
    setMatchMedia(false) // mobile
    const ui = (open: boolean) => (
      <Sheet open={open} onClose={() => {}} ariaLabel="x">
        <button>visible</button>
      </Sheet>
    )
    const { rerender } = render(ui(false))
    rerender(ui(true))
    expect(document.activeElement).toBe(screen.getByText('visible'))
  })

  it('focuses the panel when no control is visible', () => {
    setMatchMedia(false) // mobile
    const { getByTestId } = render(
      <Sheet open onClose={() => {}} dismissible={false} ariaLabel="x">
        <button style={{ display: 'none' }}>desktop only</button>
      </Sheet>
    )
    expect(document.activeElement).toBe(getByTestId('sheet-panel'))
  })

  it('does not focus a text field on open on a phone', () => {
    setMatchMedia(false) // mobile
    render(
      <Sheet open onClose={() => {}} ariaLabel="x">
        <input aria-label="amount" />
        <button>save</button>
      </Sheet>
    )
    expect(document.activeElement).toBe(screen.getByText('save'))
  })

  it('the Tab trap cycles over visible controls only', () => {
    setMatchMedia(false) // mobile
    const { getByTestId } = render(
      <Sheet open onClose={() => {}} dismissible={false} ariaLabel="x">
        <button>first</button>
        <button>last</button>
        <button style={{ display: 'none' }}>hidden tail</button>
      </Sheet>
    )
    const panel = getByTestId('sheet-panel')
    screen.getByText('last').focus()
    fireEvent.keyDown(panel, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByText('first'))
    screen.getByText('first').focus()
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByText('last'))
  })

  it('locks body scroll while open', () => {
    const { unmount } = render(<Sheet open onClose={() => {}} ariaLabel="x">c</Sheet>)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('does not render any mobile Close button when dismissible=false, even with showClose', () => {
    setMatchMedia(false) // mobile
    const onClose = vi.fn()
    const { queryByLabelText } = render(
      <Sheet open onClose={onClose} dismissible={false} showClose ariaLabel="x">c</Sheet>
    )
    expect(queryByLabelText('Close')).toBeNull()
  })

  it('traps focus: Tab from last element cycles to first, Shift+Tab from first cycles to last', () => {
    const { getByTestId, getByText } = render(
      <Sheet open onClose={() => {}} ariaLabel="x">
        <button>first</button>
        <button>middle</button>
        <button>last</button>
      </Sheet>
    )
    const panel = getByTestId('sheet-panel')
    const first = getByText('first')
    const last = getByText('last')

    last.focus()
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(panel, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('Escape closes only the topmost of two stacked dismissible Sheets', () => {
    const onCloseFirst = vi.fn()
    const onCloseSecond = vi.fn()
    render(
      <>
        <Sheet open onClose={onCloseFirst} ariaLabel="first">first</Sheet>
        <Sheet open onClose={onCloseSecond} ariaLabel="second">second</Sheet>
      </>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCloseSecond).toHaveBeenCalledOnce()
    expect(onCloseFirst).not.toHaveBeenCalled()
  })

  it('a non-dismissible Sheet on top blocks Escape from reaching a dismissible Sheet below', () => {
    const onCloseFirst = vi.fn()
    const onCloseSecond = vi.fn()
    render(
      <>
        <Sheet open onClose={onCloseFirst} ariaLabel="first">first</Sheet>
        <Sheet open onClose={onCloseSecond} dismissible={false} ariaLabel="second">second</Sheet>
      </>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCloseSecond).not.toHaveBeenCalled()
    expect(onCloseFirst).not.toHaveBeenCalled()
  })

  it('clamps popover position within the viewport near the right edge', () => {
    setMatchMedia(true) // desktop
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 })

    const anchor = document.createElement('button')
    anchor.getBoundingClientRect = () =>
      ({ left: 380, right: 400, top: 50, bottom: 70, width: 20, height: 20 }) as DOMRect
    document.body.appendChild(anchor)
    const anchorRef = { current: anchor }

    const { getByTestId } = render(
      <Sheet open onClose={() => {}} desktop="popover" anchorRef={anchorRef} ariaLabel="x">
        popover body
      </Sheet>
    )
    const panel = getByTestId('sheet-panel')
    const left = parseFloat(panel.style.left)
    expect(left).toBeGreaterThanOrEqual(8)
    expect(left).toBeLessThanOrEqual(window.innerWidth)

    document.body.removeChild(anchor)
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth })
  })

  it('caps the mobile sheet against the visual viewport, not just dvh', () => {
    setMatchMedia(false) // mobile
    render(<Sheet open onClose={() => {}} ariaLabel="Test sheet"><p>body</p></Sheet>)
    const panel = screen.getByTestId('sheet-panel')
    expect(panel.style.maxHeight).toContain('--app-viewport-height')
  })

  it('keeps the mobile sheet inside the visual viewport so the keyboard cannot cover it', () => {
    setMatchMedia(false) // mobile
    render(<Sheet open onClose={() => {}} ariaLabel="Test sheet"><p>body</p></Sheet>)
    const wrapper = screen.getByTestId('sheet-panel').parentElement!
    expect(wrapper.style.top).toContain('--app-viewport-top')
    expect(wrapper.style.height).toContain('--app-viewport-height')
  })

  it('gives an opted-in close button a 44px hit area', () => {
    setMatchMedia(false)
    render(<Sheet open onClose={() => {}} showClose ariaLabel="Test sheet"><p>body</p></Sheet>)
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close.className).toMatch(/min-h-\[44px\]/)
    expect(close.className).toMatch(/min-w-\[44px\]/)
  })
})

describe('Sheet mobile header ownership', () => {
  afterEach(() => resetMatchMedia())

  it('renders the title and no close control on mobile', () => {
    setMatchMedia(false) // mobile => bottom sheet
    render(
      <Sheet open onClose={() => {}} title="Add account">
        <div>body</div>
      </Sheet>,
    )
    expectNoVisibleClose()
    expect(screen.getByRole('heading', { name: 'Add account' })).toBeInTheDocument()
  })

  it('does not pin the header row, so a long sheet scrolls it away', () => {
    setMatchMedia(false)
    render(
      <Sheet open onClose={() => {}} title="Add account">
        <div>body</div>
      </Sheet>,
    )
    expect(screen.getByTestId('sheet-header').className).not.toMatch(/sticky/)
  })

  it('leaves room under the drag handle: more padding than the old 16px top / 0 bottom', () => {
    setMatchMedia(false)
    const { unmount } = render(
      <Sheet open onClose={() => {}} ariaLabel="x">
        <div>body</div>
      </Sheet>,
    )
    expect(screen.getByTestId('sheet-header').className).toMatch(/pb-5/)
    unmount()
    render(
      <Sheet open onClose={() => {}} title="T">
        <div>body</div>
      </Sheet>,
    )
    expect(screen.getByTestId('sheet-header').className).toMatch(/pt-7/)
  })
})

describe('Sheet mobile panel isolation', () => {
  afterEach(() => resetMatchMedia())

  it('keeps desktop panelClassName (max-width) off the full-width mobile sheet and routes contentClassName to the content', () => {
    setMatchMedia(false) // mobile bottom sheet
    render(
      <Sheet open onClose={() => {}} ariaLabel="x" panelClassName="max-w-md leak-marker" contentClassName="flex flex-col gap-3">
        <div>body</div>
      </Sheet>,
    )
    const panel = screen.getByTestId('sheet-panel')
    // the desktop width cap must not leak onto the mobile sheet (it made popups narrow + left-aligned)
    expect(panel.className).not.toContain('leak-marker')
    expect(panel.className).not.toContain('max-w-md')
    expect(panel.className).toContain('w-full')
    // per-modal content spacing must reach the mobile content wrapper
    expect(panel.querySelector('.flex.flex-col.gap-3')).toBeTruthy()
  })

  it('applies panelClassName on desktop and still wraps content with contentClassName', () => {
    setMatchMedia(true) // desktop modal
    render(
      <Sheet open onClose={() => {}} ariaLabel="x" panelClassName="max-w-md keep-marker" contentClassName="flex flex-col gap-3">
        <div>body</div>
      </Sheet>,
    )
    const panel = screen.getByTestId('sheet-panel')
    expect(panel.className).toContain('keep-marker')
    expect(panel.querySelector('.flex.flex-col.gap-3')).toBeTruthy()
  })

  // A panel taller than the viewport used to be centred by the scroll
  // container itself, which overflows it equally top and bottom and leaves the
  // top unreachable. Centring must sit on an inner min-h-full wrapper instead.
  it('keeps a too-tall desktop panel scrollable to its top edge', () => {
    setMatchMedia(true)
    render(
      <Sheet open onClose={() => {}} ariaLabel="x" panelClassName="max-w-md">
        <div>body</div>
      </Sheet>,
    )
    const panel = screen.getByTestId('sheet-panel')
    const centering = panel.parentElement!
    const scroller = centering.parentElement!

    expect(centering.className).toContain('min-h-full')
    expect(centering.className).toContain('items-center')
    expect(scroller.className).toMatch(/overflow-y-auto/)
    expect(scroller.className).not.toMatch(/items-center/)
  })

  describe('mobile showClose / scrollCue', () => {
    afterEach(() => resetMatchMedia())

    const setLayout = (panel: HTMLElement, layout: { scrollHeight: number; clientHeight: number; scrollTop: number }) => {
      Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: layout.scrollHeight })
      Object.defineProperty(panel, 'clientHeight', { configurable: true, value: layout.clientHeight })
      Object.defineProperty(panel, 'scrollTop', { configurable: true, writable: true, value: layout.scrollTop })
    }

    it('drops the Close button by default on mobile', () => {
      setMatchMedia(false)
      render(<Sheet open onClose={() => {}} ariaLabel="x">c</Sheet>)
      expectNoVisibleClose()
    })

    it('showClose is an explicit opt-in that renders the Close button', () => {
      setMatchMedia(false)
      const onClose = vi.fn()
      render(<Sheet open onClose={onClose} showClose ariaLabel="x">c</Sheet>)
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('explicit showClose=false drops the Close button but scrim and Escape still dismiss', () => {
      setMatchMedia(false)
      const onClose = vi.fn()
      render(<Sheet open onClose={onClose} showClose={false} ariaLabel="x">c</Sheet>)
      expectNoVisibleClose()
      fireEvent.click(screen.getByTestId('sheet-scrim'))
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('showClose=false still renders a title', () => {
      setMatchMedia(false)
      render(<Sheet open onClose={() => {}} showClose={false} title="Pick one" ariaLabel="x">c</Sheet>)
      expect(screen.getByRole('heading', { name: 'Pick one' })).toBeInTheDocument()
    })

    it('has no scroll cue or no-scrollbar class by default', () => {
      setMatchMedia(false)
      render(<Sheet open onClose={() => {}} ariaLabel="x">c</Sheet>)
      expect(screen.getByTestId('sheet-panel').className).not.toContain('phone-no-scrollbar')
      expect(screen.queryByTestId('sheet-scroll-cue')).toBeNull()
    })

    it('scrollCue hides the scrollbar and shows the fade only while more content is below', () => {
      setMatchMedia(false)
      render(<Sheet open onClose={() => {}} scrollCue ariaLabel="x">c</Sheet>)
      const panel = screen.getByTestId('sheet-panel')
      expect(panel.className).toContain('phone-no-scrollbar')

      setLayout(panel, { scrollHeight: 600, clientHeight: 300, scrollTop: 0 })
      fireEvent.scroll(panel)
      expect(screen.getByTestId('sheet-scroll-cue')).toBeInTheDocument()

      setLayout(panel, { scrollHeight: 600, clientHeight: 300, scrollTop: 300 })
      fireEvent.scroll(panel)
      expect(screen.queryByTestId('sheet-scroll-cue')).toBeNull()
    })

    it('shows a top fade only while the panel is scrolled down, and the handle stays in the pinned strip', () => {
      setMatchMedia(false)
      render(<Sheet open onClose={() => {}} ariaLabel="x">c</Sheet>)
      const panel = screen.getByTestId('sheet-panel')
      const strip = screen.getByTestId('sheet-top-strip')
      expect(strip.className).toMatch(/sticky/)
      expect(strip.className).toMatch(/h-0/)
      expect(strip.querySelector('span.absolute')).not.toBeNull()
      expect(screen.getByTestId('sheet-header').querySelector('span.absolute')).toBeNull()
      expect(screen.queryByTestId('sheet-top-fade')).toBeNull()

      setLayout(panel, { scrollHeight: 600, clientHeight: 300, scrollTop: 2 })
      fireEvent.scroll(panel)
      expect(screen.queryByTestId('sheet-top-fade')).toBeNull()

      setLayout(panel, { scrollHeight: 600, clientHeight: 300, scrollTop: 120 })
      fireEvent.scroll(panel)
      const fade = screen.getByTestId('sheet-top-fade')
      expect(fade.className).toMatch(/pointer-events-none/)
      expect(strip).toContainElement(fade)

      setLayout(panel, { scrollHeight: 600, clientHeight: 300, scrollTop: 0 })
      fireEvent.scroll(panel)
      expect(screen.queryByTestId('sheet-top-fade')).toBeNull()
    })

    it('a sheet closed while scrolled reopens without the stale top fade', () => {
      setMatchMedia(false)
      const ui = (open: boolean) => (
        <Sheet open={open} onClose={() => {}} ariaLabel="x">c</Sheet>
      )
      const { rerender } = render(ui(true))
      const panel = screen.getByTestId('sheet-panel')
      setLayout(panel, { scrollHeight: 600, clientHeight: 300, scrollTop: 120 })
      fireEvent.scroll(panel)
      expect(screen.getByTestId('sheet-top-fade')).toBeInTheDocument()
      rerender(ui(false))
      rerender(ui(true))
      expect(screen.queryByTestId('sheet-top-fade')).toBeNull()
    })

    it('scrollCue shows no fade when the content fits', () => {
      setMatchMedia(false)
      render(<Sheet open onClose={() => {}} scrollCue ariaLabel="x">c</Sheet>)
      const panel = screen.getByTestId('sheet-panel')
      setLayout(panel, { scrollHeight: 300, clientHeight: 300, scrollTop: 0 })
      fireEvent.scroll(panel)
      expect(screen.queryByTestId('sheet-scroll-cue')).toBeNull()
    })
  })
})
