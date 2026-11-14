import React, { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'

interface AnimatedNumberProps {
  value: number
  format?: (n: number) => string
  durationMs?: number
}

/** Counts from the previous value to the next one. Was the old animation
 *  library's `animate` helper; a rAF tween is a dozen lines and this was
 *  one of three reasons a 136 kB animation library sat in the eager entry
 *  graph. */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = (n) => n.toLocaleString('en-CA', { maximumFractionDigits: 0 }),
  durationMs = 600,
}) => {
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (reduced || prev.current === value) {
      prev.current = value
      return
    }

    const start = performance.now()
    const a = prev.current
    const b = value
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      // easeOutCubic, matching the feel of the previous spring closely enough
      // that no test asserted on the difference.
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(a + (b - a) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
      else prev.current = b
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, reduced, durationMs])

  // reduced bypasses the tween state entirely so a value change never
  // flashes a stale number for a frame while the effect above catches up.
  return <span>{format(reduced ? value : display)}</span>
}
