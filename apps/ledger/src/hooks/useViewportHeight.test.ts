import { describe, expect, it, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useViewportHeight } from './useViewportHeight'

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--app-viewport-height')
})

function stubVisualViewport(height: number) {
  const listeners: Record<string, Array<() => void>> = {}
  const vv = {
    height,
    addEventListener: (type: string, cb: () => void) => {
      listeners[type] = [...(listeners[type] ?? []), cb]
    },
    removeEventListener: () => {},
    fire: (type: string, next: number) => {
      vv.height = next
      ;(listeners[type] ?? []).forEach((cb) => cb())
    },
  }
  vi.stubGlobal('visualViewport', vv)
  return vv
}

describe('useViewportHeight', () => {
  it('publishes the visual viewport height as a CSS variable', () => {
    stubVisualViewport(812)
    renderHook(() => useViewportHeight())
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('812px')
  })

  it('shrinks the variable when the keyboard opens', () => {
    const vv = stubVisualViewport(812)
    renderHook(() => useViewportHeight())
    act(() => vv.fire('resize', 476))
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('476px')
  })

  it('does nothing when visualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined)
    expect(() => renderHook(() => useViewportHeight())).not.toThrow()
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('')
  })
})
