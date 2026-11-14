/** The default ceiling on any market data request. Ten seconds is well past
 *  a healthy Alpha Vantage or FX response and well short of a user deciding
 *  the app is broken. */
export const DEFAULT_TIMEOUT_MS = 10_000

/** fetch with a hard ceiling.
 *
 *  Nothing in this service used to set one, and the in-flight dedup map keys
 *  on the request: a hung request therefore never settled AND pinned its key,
 *  so every later caller for the same quote attached to a promise that would
 *  never resolve. The quote stayed on a loading skeleton until a reload. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  ms: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(input, { signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out', { cause: err })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
