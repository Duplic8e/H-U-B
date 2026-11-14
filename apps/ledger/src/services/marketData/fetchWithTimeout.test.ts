import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchWithTimeout } from './fetchWithTimeout'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('fetchWithTimeout', () => {
  it('resolves when the response arrives in time', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
    const res = await fetchWithTimeout('https://example.test', 1000)
    expect(await res.text()).toBe('ok')
  })

  it('rejects when the request outruns the timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: unknown, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
    ))
    const promise = fetchWithTimeout('https://example.test', 5000)
    vi.advanceTimersByTime(5001)
    await expect(promise).rejects.toThrow('Request timed out')
  })

  it('passes the caller signal through so an abort still works', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
    await fetchWithTimeout('https://example.test', 1000)
    const init = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('clears the timeout when the request succeeds, so a resolved fetch leaves no pending timer', async () => {
    // A reviewer proved all three existing tests pass with the success-path
    // clearTimeout deleted. This test pins that a timer is not leaked on the
    // happy path: a leaked timer holds an abort on a request that already
    // finished, and a future refactor could reintroduce the leak unseen.
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
    await fetchWithTimeout('https://example.test', 5000)
    expect(vi.getTimerCount()).toBe(0)
  })
})
