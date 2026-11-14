import { useCallback, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // hourly

export type UpdateCheckStatus = 'idle' | 'checking' | 'upToDate' | 'updateAvailable' | 'error'

export interface SWUpdate {
  needRefresh: boolean
  /** Activate the waiting service worker and reload. */
  refresh: () => void
  checkStatus: UpdateCheckStatus
  /** Manual "Check for Updates". Resolves into checkStatus. */
  checkForUpdates: () => void
}

/** Single owner of the service-worker registration: checks for updates at
 *  launch, hourly, on tab focus, and on demand. Call once (in Layout) and
 *  pass the result down. */
export function useSWUpdate(): SWUpdate {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>()
  const [checkStatus, setCheckStatus] = useState<UpdateCheckStatus>('idle')

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      setRegistration(reg)
      // Launch-time check: an installed PWA otherwise waits for the hourly
      // timer or a focus event that never fires in standalone mode.
      reg?.update().catch(() => {})
    },
  })

  useEffect(() => {
    if (!registration) return
    const interval = setInterval(() => registration.update().catch(() => {}), CHECK_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [registration])

  // Derived rather than synced via an effect: once a new worker is waiting,
  // needRefresh flips true and checkStatus should reflect that immediately.
  const effectiveCheckStatus: UpdateCheckStatus = needRefresh ? 'updateAvailable' : checkStatus

  const checkForUpdates = useCallback(async () => {
    if (!registration) return
    setCheckStatus('checking')
    try {
      await registration.update()
      // If a new worker is installing/waiting, needRefresh will flip true and
      // effectiveCheckStatus derives 'updateAvailable' from it; otherwise
      // we're current.
      if (!registration.installing && !registration.waiting) setCheckStatus('upToDate')
    } catch {
      setCheckStatus('error')
    }
  }, [registration])

  return {
    needRefresh,
    refresh: () => updateServiceWorker(true),
    checkStatus: effectiveCheckStatus,
    checkForUpdates,
  }
}
