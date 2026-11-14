import { test, expect } from '@playwright/test'

const DISCLAIMER_ACK_KEY = 'ledger-disclaimer-ack'

// Acknowledge the disclaimer before first paint so specs start on the app.
test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString())
  }, DISCLAIMER_ACK_KEY)
})

test('loads the dashboard with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  expect(errors).toEqual([])
})

test('navigates to every primary route', async ({ page }) => {
  await page.goto('/')
  for (const [label, heading] of [
    ['Budgeting', 'Budgeting'],
    ['Investments', 'Investments'],
    ['Planner', 'Planner'],
    ['Compensation', 'Compensation'],
  ] as const) {
    await page.getByRole('link', { name: label, exact: true }).first().click()
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }
})

// This is the regression guard for the retracted audit finding. In a real
// browser the exit animation completes and the dialog leaves the DOM.
test('Escape closes the settings sheet and removes it from the DOM', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.locator('[data-testid="sheet-scrim"]')).toHaveCount(0)
})

test('closing a sheet leaves the page interactive', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Investments', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Investments', level: 1 })).toBeVisible()
})
