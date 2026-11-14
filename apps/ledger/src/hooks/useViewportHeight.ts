import { useEffect } from 'react'

/** Publishes the visual viewport height to --app-viewport-height.
 *
 *  Bottom sheets are sized in dvh, and dvh does not shrink when the iOS
 *  software keyboard opens: the layout viewport is unchanged and only the
 *  visual viewport shrinks. A tall sheet therefore keeps its full height
 *  and puts its lower fields behind the keyboard. visualViewport reports
 *  the real usable height on both iOS and Android, so sheets can cap
 *  and position themselves against it (--app-viewport-top is its offset).
 *
 *  Mount once, from Layout. No-op where visualViewport is unsupported, in
 *  which case the sheet's dvh fallback applies. */
export function useViewportHeight(): void {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined
    if (!vv) return

    const publish = () => {
      document.documentElement.style.setProperty('--app-viewport-height', `${vv.height}px`)
      // iOS also scrolls the layout viewport when a field is focused, so the visible area can start below 0.
      document.documentElement.style.setProperty('--app-viewport-top', `${vv.offsetTop}px`)
    }

    publish()
    vv.addEventListener('resize', publish)
    vv.addEventListener('scroll', publish)
    return () => {
      vv.removeEventListener('resize', publish)
      vv.removeEventListener('scroll', publish)
    }
  }, [])
}
