import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { resetMatchMedia, setMatchMedia } from '../../test-utils/matchMedia'
import { DisclaimerModal } from './DisclaimerModal'

describe('DisclaimerModal', () => {
  it('does not close on scrim click when ack is required', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<DisclaimerModal isOpen requireAck onClose={onClose} />)
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).not.toHaveBeenCalled()
  })
  it('closes on scrim click when ack is not required', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<DisclaimerModal isOpen requireAck={false} onClose={onClose} />)
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('DisclaimerModal mobile header (no double close)', () => {
  afterEach(() => resetMatchMedia())

  it('shows no visible sheet close control on mobile when requireAck is false', () => {
    setMatchMedia(false)
    render(<DisclaimerModal isOpen requireAck={false} onClose={() => {}} />)
    // The modal's own header row is desktop-only. Sheet renders via createPortal
    // to document.body, so query there rather than RTL's pre-portal `container`.
    const ownHeader = document.body.querySelector('.hidden.desktop\\:flex')
    expect(ownHeader?.className).toMatch(/\bhidden\b/)
    expect(ownHeader?.className).toMatch(/desktop:flex/)
    // jsdom fallback: no stylesheet is loaded in tests, so Tailwind's `hidden`
    // class has no visibility effect here and both close-icon buttons render
    // in the DOM. We already assert the gating class above, so scope the
    // "one close control" check to close-icon buttons (aria-label="Close")
    // outside the desktop-gated header, matching what a real mobile browser
    // renders. The footer action button (visible text "Close" when
    // requireAck is false) is excluded on purpose: it is the primary action
    // control, not part of the header close-icon chrome this fix targets.
    const closeIcons = screen
      .getAllByRole('button', { name: 'Close' })
      .filter((btn) => btn.getAttribute('aria-label') === 'Close')
    const closeButtons = closeIcons.filter((btn) => !ownHeader?.contains(btn))
    expect(closeButtons).toHaveLength(1)
    expect(closeButtons.every((btn) => btn.hasAttribute('data-sheet-hidden-close'))).toBe(true)
    expect(closeButtons.every((btn) => btn.className.split(' ').includes('sr-only'))).toBe(true)
  })
})
