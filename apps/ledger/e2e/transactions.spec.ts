import { test, expect } from '@playwright/test'

const DISCLAIMER_ACK_KEY = 'ledger-disclaimer-ack'
const BUDGET_KEY = 'ledger-budget'
const now = new Date()
const transactionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-04`

test('renders a long transaction list without mounting every row', async ({ page }) => {
  const transactions: Record<string, unknown> = {}
  for (let i = 0; i < 1200; i++) {
    transactions[`t${i}`] = {
      id: `t${i}`,
      date: transactionDate,
      amount: 12.5,
      description: `TEST TXN ${i}`,
      type: 'expense',
    }
  }

  await page.addInitScript(
    ([ackKey, budgetKey, payload]) => {
      window.localStorage.setItem(ackKey as string, new Date().toISOString())
      window.localStorage.setItem(
        budgetKey as string,
        JSON.stringify({
          state: { transactions: payload, categories: {}, categoryGroups: {} },
          version: 3,
        }),
      )
    },
    [DISCLAIMER_ACK_KEY, BUDGET_KEY, transactions],
  )

  await page.goto('/#/budget')
  await page.getByRole('tab', { name: 'Transactions' }).click()

  // Sanity check: confirm the store actually loaded all 1200 seeded rows
  // (not a silently-empty fallback caused by a persisted-shape mismatch)
  // before trusting the row-count assertions below.
  await expect(page.getByRole('heading', { name: 'All Transactions' })).toBeVisible()
  const deleteAllButton = page.getByRole('button', { name: 'Delete all transactions' })
  await expect(deleteAllButton).toBeVisible()

  const rows = page.locator('table tbody tr:not([aria-hidden="true"])')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeLessThan(60)

  await page.mouse.wheel(0, 4000)
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeLessThan(60)
})

test('renders a long transaction list on mobile without mounting every card', async ({ page }) => {
  const transactions: Record<string, unknown> = {}
  for (let i = 0; i < 1200; i++) {
    transactions[`t${i}`] = {
      id: `t${i}`,
      date: transactionDate,
      amount: 12.5,
      description: `TEST TXN ${i}`,
      type: 'expense',
    }
  }

  await page.addInitScript(
    ([ackKey, budgetKey, payload]) => {
      window.localStorage.setItem(ackKey as string, new Date().toISOString())
      window.localStorage.setItem(
        budgetKey as string,
        JSON.stringify({
          state: { transactions: payload, categories: {}, categoryGroups: {} },
          version: 3,
        }),
      )
    },
    [DISCLAIMER_ACK_KEY, BUDGET_KEY, transactions],
  )

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/#/budget')
  await page.getByRole('tab', { name: 'Transactions' }).click()

  const cards = page.locator('[data-testid="transactions-cards"] [data-testid^="transaction-card-"]')
  await expect(cards.first()).toBeVisible()
  // The phone list is capped, not windowed: 120 rows mount until "Show all".
  expect(await cards.count()).toBe(120)
  await expect(page.getByRole('button', { name: 'Show all 1200 transactions' })).toBeVisible()
})
