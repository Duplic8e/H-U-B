import { useEffect } from 'react'

let lockCount = 0
let savedOverflow = ''
let savedPaddingRight = ''

function lock() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    const body = document.body
    savedOverflow = body.style.overflow
    savedPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
  }
  lockCount++
}

function unlock() {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow
    document.body.style.paddingRight = savedPaddingRight
  }
}

/** Freezes body scroll while `active`. Reference-counted so nested/stacked
 *  overlays don't unlock the page prematurely. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
