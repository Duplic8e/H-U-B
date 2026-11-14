import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WhatsNewModal } from './WhatsNewModal'
import { setMatchMedia } from '../../test-utils/matchMedia'
import { versionSeries } from '../../utils/whatsNew'

describe('WhatsNewModal disclaimer link', () => {
  it('renders the disclaimer button under Made by Mishat and fires the callback', () => {
    const onOpenDisclaimer = vi.fn()
    render(<WhatsNewModal isOpen onClose={() => {}} onOpenDisclaimer={onOpenDisclaimer} />)
    fireEvent.click(screen.getByRole('button', { name: /estimates only/i }))
    expect(onOpenDisclaimer).toHaveBeenCalled()
  })
})

describe('WhatsNewModal scrim dismissal', () => {
  it('closes when the scrim is clicked (desktop)', () => {
    setMatchMedia(true)
    const onClose = vi.fn()
    const { getByTestId } = render(<WhatsNewModal isOpen onClose={onClose} onOpenDisclaimer={() => {}} />)
    fireEvent.click(getByTestId('sheet-scrim'))
    expect(onClose).toHaveBeenCalled()
  })
})


describe('WhatsNewModal older versions disclosure', () => {
  // Derived from the running version rather than hardcoded, so cutting a new
  // minor release does not break these tests. An "[Unreleased]" heading has no
  // parseable version and is excluded by isVersionHeading.
  const currentSeries = versionSeries(__APP_VERSION__)
  const isVersionHeading = (b: HTMLElement) => /^\[\d+\.\d+\./.test(b.textContent || '')
  const inCurrentSeries = (b: HTMLElement) => versionSeries(b.textContent || '') === currentSeries
  const versionHeadings = () => screen.getAllByRole('button').filter(isVersionHeading)

  it('hides earlier series behind a collapsed disclosure', () => {
    render(<WhatsNewModal isOpen onClose={() => {}} onOpenDisclaimer={() => {}} />)
    const toggle = screen.getByRole('button', { name: /older versions/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    const before = versionHeadings()
    expect(before.length).toBeGreaterThan(0)
    expect(before.every(inCurrentSeries)).toBe(true)

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const after = versionHeadings()
    expect(after.length).toBeGreaterThan(before.length)
    expect(after.some((b) => !inCurrentSeries(b))).toBe(true)
  })

  it('expands only the newest entry of the current series by default', () => {
    render(<WhatsNewModal isOpen onClose={() => {}} onOpenDisclaimer={() => {}} />)
    const current = versionHeadings().filter(inCurrentSeries)
    expect(current.length).toBeGreaterThan(0)
    expect(current[0]).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: /older versions/i }))
    const older = versionHeadings().filter((b) => !inCurrentSeries(b))
    expect(older.length).toBeGreaterThan(0)
    expect(older.every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true)
  })
})
