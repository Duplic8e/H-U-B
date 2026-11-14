import { describe, expect, it, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useScrollLock } from './useScrollLock'

function Locker({ active }: { active: boolean }) {
  useScrollLock(active)
  return null
}

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

  it('locks body scroll while active and restores on unmount', () => {
    const { rerender, unmount } = render(<Locker active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Locker active={false} />)
    expect(document.body.style.overflow).toBe('')
    rerender(<Locker active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('stays locked until the LAST consumer releases (reference counted)', () => {
    const a = render(<Locker active={true} />)
    const b = render(<Locker active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    a.unmount()
    expect(document.body.style.overflow).toBe('hidden') // b still active
    b.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
