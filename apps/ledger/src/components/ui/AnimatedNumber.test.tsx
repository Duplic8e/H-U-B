import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { AnimatedNumber } from './AnimatedNumber'
import { setMatchMedia, resetMatchMedia } from '../../test-utils/matchMedia'

type FrameCallback = (now: number) => void

/** A controllable requestAnimationFrame/cancelAnimationFrame pair. Frames sit
 *  in a queue until a test calls flush() itself, so a tween's progress is
 *  driven by explicit timestamps instead of a real clock. This is chosen
 *  over vi.useFakeTimers() because the component also needs performance.now()
 *  pinned to those same timestamps, and stubbing both by hand keeps the two
 *  in lockstep without relying on how a fake-timer library schedules rAF. */
function stubRaf() {
  const queue = new Map<number, FrameCallback>()
  let nextId = 1
  const raf = vi.fn((cb: FrameCallback) => {
    const id = nextId++
    queue.set(id, cb)
    return id
  })
  const caf = vi.fn((id: number) => {
    queue.delete(id)
  })
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  return {
    raf,
    caf,
    /** Runs every frame queued right now, at the given timestamp, in one act()
     *  batch. A callback that reschedules itself lands in a fresh queue entry
     *  for the next flush() call rather than running again in this one. */
    flush(now: number) {
      const due = Array.from(queue.values())
      queue.clear()
      act(() => due.forEach((cb) => cb(now)))
    },
  }
}

afterEach(() => {
  resetMatchMedia()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  cleanup()
})

describe('AnimatedNumber', () => {
  it('bypasses the tween under reduced motion: the new value renders immediately with no frame ever scheduled', () => {
    setMatchMedia(true) // makes '(prefers-reduced-motion: reduce)' match
    const { raf } = stubRaf()

    const { getByText, queryByText, rerender } = render(<AnimatedNumber value={10} />)
    expect(getByText('10')).toBeTruthy()

    rerender(<AnimatedNumber value={20} />)

    // the new value is there right away, and the old one is gone -- there is
    // no frame in between where a stale number is shown
    expect(getByText('20')).toBeTruthy()
    expect(queryByText('10')).toBeNull()
    // the guarantee the component's own comment makes: reduced motion drops
    // the tween state entirely, so a frame is never scheduled for this change
    expect(raf).not.toHaveBeenCalled()
  })

  it('without reduced motion, the tween settles on the exact target value once it completes', () => {
    setMatchMedia(false) // '(prefers-reduced-motion: reduce)' does not match
    const { flush } = stubRaf()
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const { getByText, rerender } = render(<AnimatedNumber value={10} durationMs={100} />)
    rerender(<AnimatedNumber value={20} durationMs={100} />)

    // the prop changed but no frame has run yet, only been scheduled, so the
    // old value is still what's on screen
    expect(getByText('10')).toBeTruthy()

    // drive frames well past the duration so t clips to 1 and the tween ends
    for (let i = 0; i < 20; i++) {
      now += 20
      flush(now)
    }

    expect(getByText('20')).toBeTruthy()
  })

  it('cancels the pending frame on unmount so a mid tween teardown never leaves one running', () => {
    setMatchMedia(false)
    const { raf, caf } = stubRaf()
    // const, not let: this test unmounts before advancing the clock, so the
    // frozen value is the point. The tween test above reassigns its own.
    const now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const { rerender, unmount } = render(<AnimatedNumber value={10} durationMs={100} />)
    rerender(<AnimatedNumber value={20} durationMs={100} />)

    expect(raf).toHaveBeenCalledTimes(1)
    const scheduledId = raf.mock.results[0]!.value as number

    unmount()

    // the exact frame the effect scheduled must be the one cancelled, not
    // just any call to cancelAnimationFrame
    expect(caf).toHaveBeenCalledTimes(1)
    expect(caf).toHaveBeenCalledWith(scheduledId)
  })
})
