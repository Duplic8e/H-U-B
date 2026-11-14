import { describe, expect, it, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'
import { PageTransition } from './PageTransition'

afterEach(() => resetMatchMedia())

describe('PageTransition', () => {
  it('uses min-h-full (not a fixed h-full) so page content can grow past the viewport and clear the bottom nav', () => {
    // matchMedia(false) -> not reduced-motion, so the animated wrapper renders
    setMatchMedia(false)
    const { container } = render(
      <MemoryRouter>
        <PageTransition>
          <div data-testid="child">x</div>
        </PageTransition>
      </MemoryRouter>,
    )
    const wrapper = container.querySelector('.min-h-full')
    expect(wrapper).toBeTruthy()
    // a fixed height on this wrapper is what clipped the last content behind the nav
    expect(container.querySelector('.h-full')).toBeNull()
  })
})
