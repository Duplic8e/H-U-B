import { useEffect, useState } from 'react'

/** Keeps a component mounted for `ms` after `open` goes false, so a CSS exit
 *  transition can finish. This is the whole of what AnimatePresence was doing
 *  in Sheet: there is no exit-animation orchestration beyond "wait, then
 *  unmount". Returns whether to render at all, and the state to stamp on the
 *  element so CSS can transition between them. */
export function useDeferredUnmount(open: boolean, ms: number): { mounted: boolean; state: 'open' | 'closed' } {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    // Syncing mounted state to the open prop, not a render loop: opening is
    // immediate, and closing either unmounts immediately (ms === 0, e.g.
    // reduced motion) or after the timer below lets the CSS exit run.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setMounted(true); return }
    if (ms === 0) { setMounted(false); return }
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open, ms])

  return { mounted, state: open ? 'open' : 'closed' }
}
