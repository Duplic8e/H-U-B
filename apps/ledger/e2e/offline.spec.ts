import { test, expect } from '@playwright/test'

const DISCLAIMER_ACK_KEY = 'ledger-disclaimer-ack'
const ACCOUNTS_STORAGE_KEY = 'accounts-storage'

// Acknowledge the disclaimer before first paint so this spec starts on the
// app, and seed two net worth history points so the Dashboard's
// NetWorthTrendWidget renders an actual chart instead of its empty state.
test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString())
  }, DISCLAIMER_ACK_KEY)
  await page.addInitScript((key) => {
    const state = {
      state: {
        accounts: [{ id: 'e2e-1', name: 'Checking', value: 1000, type: 'bank' }],
        history: [
          { date: '2026-08-01', value: 1000 },
          { date: '2026-08-15', value: 1200 },
        ],
      },
      version: 0,
    }
    window.localStorage.setItem(key, JSON.stringify(state))
  }, ACCOUNTS_STORAGE_KEY)
})

// Regression guard for the offline-blank-page bug: the PWA's precache used
// to deliberately exclude the recharts chart chunk, on the assumption that
// it was only fetched on demand. That assumption was wrong for this
// bundler: the entry chunk always statically imports the chart chunk
// regardless of manual chunking, so a first-time visitor who installed the
// PWA and went offline before a runtime cache could populate would see a
// blank page. The chart chunk is now included in the normal precache, so a
// single install visit is enough for everything the app needs, including
// charts, to be available offline with no race condition.
test('dashboard renders after going offline once the service worker is active', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()

  // Wait for the service worker to finish installing and reach the active
  // state so the precached assets are actually available for the next load.
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false
    const registration = await navigator.serviceWorker.ready
    return !!registration.active
  }, { timeout: 30_000 })

  // Go straight offline and reload with no further online visit. Everything
  // needed for first paint, including the chart chunk, was precached during
  // the single install visit above.
  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()

  // The Dashboard's NetWorthTrendWidget is a lazy-loaded chart, so its
  // rendering here, while still offline, confirms the chart chunk itself
  // (not just the app shell) came from the precache.
  await expect(page.locator('.recharts-wrapper').first()).toBeVisible()

  await context.setOffline(false)
})
