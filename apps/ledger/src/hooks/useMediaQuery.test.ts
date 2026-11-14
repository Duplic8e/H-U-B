import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsDesktop } from './useMediaQuery'

afterEach(() => vi.unstubAllGlobals())

/** Per-query matchMedia, unlike the global boolean in test-utils/matchMedia. */
function stubMatchMedia(matcher: (query: string) => boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matcher(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

describe('useIsDesktop', () => {
  it('requires height as well as width, so a landscape phone is not desktop', () => {
    // 844x390: wide enough for the old width-only check, too short for the sidebar.
    stubMatchMedia((q) => q.includes('min-width: 768px') && !q.includes('min-height'))
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)
  })

  it('is desktop when the viewport is both wide and tall', () => {
    stubMatchMedia(() => true)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
  })
})
