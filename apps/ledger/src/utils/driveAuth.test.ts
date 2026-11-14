import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { requestAccessToken, getCachedToken, clearCachedToken, DRIVE_SCOPE, TOKEN_TIMEOUT_MS } from './driveAuth'

interface FakeTokenConfig {
  client_id: string
  scope: string
  callback: (r: { access_token?: string; error?: string }) => void
  error_callback?: (e: { type: string }) => void
}

function installGoogle(behaviour: (config: FakeTokenConfig) => void) {
  ;(window as unknown as { google: unknown }).google = {
    accounts: {
      oauth2: {
        initTokenClient: (config: FakeTokenConfig) => ({
          requestAccessToken: () => behaviour(config),
        }),
      },
    },
  }
}

describe('driveAuth', () => {
  beforeEach(() => {
    clearCachedToken()
    document.querySelectorAll('script').forEach((s) => s.remove())
    delete (window as unknown as { google?: unknown }).google
  })

  it('requests the narrow drive.file scope', async () => {
    let seen = ''
    installGoogle((config) => {
      seen = config.scope
      config.callback({ access_token: 'tok-1' })
    })
    await requestAccessToken('client-1')
    expect(seen).toBe(DRIVE_SCOPE)
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file')
  })

  it('resolves with the access token and caches it', async () => {
    installGoogle((config) => config.callback({ access_token: 'tok-2' }))
    await expect(requestAccessToken('client-1')).resolves.toBe('tok-2')
    expect(getCachedToken()).toBe('tok-2')
  })

  it('rejects when consent is denied', async () => {
    installGoogle((config) => config.error_callback?.({ type: 'popup_closed' }))
    await expect(requestAccessToken('client-1')).rejects.toThrow(/Google sign-in was cancelled/i)
  })

  it('rejects when the callback carries no token', async () => {
    installGoogle((config) => config.callback({ error: 'access_denied' }))
    await expect(requestAccessToken('client-1')).rejects.toThrow(/access_denied/)
  })

  it('clearCachedToken forgets the token', async () => {
    installGoogle((config) => config.callback({ access_token: 'tok-3' }))
    await requestAccessToken('client-1')
    clearCachedToken()
    expect(getCachedToken()).toBeUndefined()
  })

  it('rejects when the GIS script fails to load', async () => {
    const promise = requestAccessToken('client-1')
    const script = document.querySelector('script[src*="gsi/client"]') as HTMLScriptElement
    expect(script).toBeTruthy()
    script.onerror?.(new Event('error'))
    await expect(promise).rejects.toThrow(/Could not reach Google/i)
  })

  describe('timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('rejects with a timeout message when neither callback fires', async () => {
      installGoogle(() => {
        // neither callback nor error_callback is ever invoked
      })
      const promise = requestAccessToken('client-1')
      const assertion = expect(promise).rejects.toThrow(
        /Google did not respond\. The sign-in window may have been blocked\. Try again\./,
      )
      await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS)
      await assertion
    })

    it('leaves the module usable after a timeout, so a later call still resolves', async () => {
      installGoogle(() => {
        // hangs forever, like a blocked popup
      })
      const timedOut = requestAccessToken('client-1')
      const timedOutAssertion = expect(timedOut).rejects.toThrow(/Google did not respond/)
      await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS)
      await timedOutAssertion

      installGoogle((config) => config.callback({ access_token: 'tok-after-timeout' }))
      await expect(requestAccessToken('client-1')).resolves.toBe('tok-after-timeout')
      expect(getCachedToken()).toBe('tok-after-timeout')
    })

    it('the success path settles without leaving a pending timer', async () => {
      installGoogle((config) => config.callback({ access_token: 'tok-fast' }))
      await expect(requestAccessToken('client-1')).resolves.toBe('tok-fast')
      expect(vi.getTimerCount()).toBe(0)
    })

    it('the error path settles without leaving a pending timer', async () => {
      installGoogle((config) => config.error_callback?.({ type: 'popup_closed' }))
      await expect(requestAccessToken('client-1')).rejects.toThrow(/Google sign-in was cancelled/i)
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
