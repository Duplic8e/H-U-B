import { describe, expect, it } from 'vitest'
import { shouldDismissOnDragEnd } from './sheetGestures'

describe('shouldDismissOnDragEnd', () => {
  it('dismisses when dragged past the offset threshold', () => {
    expect(shouldDismissOnDragEnd(150, 0)).toBe(true)
  })
  it('dismisses on a fast downward flick even with small offset', () => {
    expect(shouldDismissOnDragEnd(20, 800)).toBe(true)
  })
  it('does not dismiss on a small, slow drag', () => {
    expect(shouldDismissOnDragEnd(40, 100)).toBe(false)
  })
  it('does not dismiss on upward drags', () => {
    expect(shouldDismissOnDragEnd(-200, -900)).toBe(false)
  })
})
