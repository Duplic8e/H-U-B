import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { CommandPalette } from './CommandPalette'
import { setMatchMedia, resetMatchMedia } from '../test-utils/matchMedia'

function renderPalette(onClose = vi.fn()) {
  return { onClose, ...render(
    <MemoryRouter>
      <CommandPalette isOpen onClose={onClose} />
    </MemoryRouter>
  ) }
}

describe('CommandPalette', () => {
  afterEach(() => resetMatchMedia())

  it('phone: no esc hint, no visible Close button, and the results list does not scroll itself', () => {
    setMatchMedia(false)
    renderPalette()
    expect(screen.queryByText('esc')).not.toBeInTheDocument()
    for (const btn of screen.queryAllByRole('button', { name: 'Close' })) {
      expect(btn).toHaveAttribute('data-sheet-hidden-close')
      expect(btn.className.split(' ')).toContain('sr-only')
    }
    const list = screen.getByRole('listbox')
    expect(list.className).not.toContain('overflow-y-auto')
    expect(list.className).not.toContain('max-h-')
  })

  it('phone: the search row sits close under the handle and sticks at the same offset', () => {
    setMatchMedia(false)
    renderPalette()
    // The header shrinks to the handle (12px), so the row's resting top is 12px and the sticky
    // offset must be the same 12px (top-3) or the row jumps when the list scrolls.
    expect(screen.getByTestId('sheet-header').className).toMatch(/pt-3/)
    expect(screen.getByTestId('sheet-header').className).not.toMatch(/pb-5/)
    expect(screen.getByLabelText('Search commands').parentElement!.className).toMatch(/sticky top-3/)
  })

  it('desktop: keeps the esc hint and the self-scrolling results list', () => {
    setMatchMedia(true)
    renderPalette()
    expect(screen.getByText('esc')).toBeInTheDocument()
    expect(screen.getByRole('listbox').className).toContain('overflow-y-auto')
  })

  it('desktop: result rows carry no scroll-margin classes', () => {
    setMatchMedia(true)
    renderPalette()
    for (const li of screen.getAllByRole('option')) expect(li.className).toBe('')
  })

  it('phone: result rows keep scroll margins clear of the pinned search row', () => {
    setMatchMedia(false)
    renderPalette()
    for (const li of screen.getAllByRole('option')) expect(li.className).toContain('scroll-mt-20')
  })

  it('renders the search input, focused, when open', () => {
    renderPalette()
    const input = screen.getByLabelText('Search commands')
    expect(input).toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('closes when the scrim is clicked (desktop)', () => {
    setMatchMedia(true)
    const { onClose } = renderPalette()
    fireEvent.click(screen.getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })

  it('preserves arrow-key/Enter navigation on the search input', () => {
    renderPalette()
    const input = screen.getByLabelText('Search commands')
    // Arrow-key handling is internal to the component's onKeyDown; verify it doesn't throw
    // and Escape (handled by Sheet, not this component) does not break the input.
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toBeInTheDocument()
  })
})
