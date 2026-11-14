import { act, renderHook } from '@testing-library/react'
import { useShowMore } from './useShowMore'

const items = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('useShowMore', () => {
  it('caps a long list until toggled', () => {
    const { result } = renderHook(() => useShowMore(items(7), 5))
    expect(result.current.visible).toEqual([0, 1, 2, 3, 4])
    expect(result.current.truncates).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.visible).toEqual(items(7))
    expect(result.current.expanded).toBe(true)
  })

  it('shows a list one over the cap whole', () => {
    const { result } = renderHook(() => useShowMore(items(6), 5))
    expect(result.current.visible).toEqual(items(6))
    expect(result.current.truncates).toBe(false)
  })

  it('shows everything when disabled', () => {
    const { result } = renderHook(() => useShowMore(items(20), 5, false))
    expect(result.current.visible).toHaveLength(20)
    expect(result.current.truncates).toBe(false)
  })
})
