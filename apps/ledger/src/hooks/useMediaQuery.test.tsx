import { describe, expect, it, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useIsDesktop } from './useMediaQuery'
import { setMatchMedia, resetMatchMedia } from '../test-utils/matchMedia'

function Probe() {
  const desktop = useIsDesktop()
  return <span data-testid="v">{desktop ? 'desktop' : 'mobile'}</span>
}

describe('useIsDesktop', () => {
  beforeEach(() => resetMatchMedia())

  it('reports desktop when the query matches', () => {
    setMatchMedia(true)
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('v').textContent).toBe('desktop')
  })

  it('reacts to media changes', () => {
    setMatchMedia(true)
    const { getByTestId } = render(<Probe />)
    act(() => setMatchMedia(false))
    expect(getByTestId('v').textContent).toBe('mobile')
  })
})
