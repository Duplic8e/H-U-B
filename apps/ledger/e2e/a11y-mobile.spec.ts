import { test, expect, devices } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const DISCLAIMER_ACK_KEY = 'ledger-disclaimer-ack'
const BUDGET_KEY = 'ledger-budget'

// A small set of transactions with varied fields (categorized, tagged,
// neither) so the axe scan exercises the real populated mobile card list
// instead of the EmptyState that renders when txList.length === 0.
const SEED_TRANSACTIONS: Record<string, unknown> = {
  t1: { id: 't1', date: '2026-08-01', amount: 12.5, description: 'Coffee shop', type: 'expense', categoryId: 'groceries' },
  t2: { id: 't2', date: '2026-08-02', amount: 45, description: 'Gas station', type: 'expense', tags: ['car'] },
  t3: { id: 't3', date: '2026-08-03', amount: 2500, description: 'Paycheck', type: 'income' },
  t4: { id: 't4', date: '2026-08-04', amount: 89.99, description: 'Electric bill', type: 'expense', categoryId: 'utilities', tags: ['home'] },
  t5: { id: 't5', date: '2026-08-05', amount: 15, description: 'Streaming service', type: 'expense' },
  t6: { id: 't6', date: '2026-08-06', amount: 60, description: 'Restaurant', type: 'expense', categoryId: 'dining', note: 'Dinner with friends' },
}

// The desktop scan cannot see the mobile card list, the bottom tab bar, or
// anything a narrow viewport reveals, so those routes are scanned again here.
test.use({ ...devices['Pixel 5'] })

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString())
  }, DISCLAIMER_ACK_KEY)
})

const routes = [
  ['dashboard', ''],
  ['budgeting', '#/budget'],
  ['investments', '#/investments'],
  ['planner', '#/planner'],
  ['compensation', '#/compensation'],
] as const

for (const [name, hash] of routes) {
  test(`${name} has no serious or critical accessibility violations on mobile`, async ({ page }) => {
    if (name === 'budgeting') {
      await page.addInitScript(
        ([budgetKey, payload]) => {
          window.localStorage.setItem(
            budgetKey as string,
            JSON.stringify({
              state: { transactions: payload, categories: {}, categoryGroups: {} },
              version: 3,
            }),
          )
        },
        [BUDGET_KEY, SEED_TRANSACTIONS],
      )
    }
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    if (name === 'budgeting') {
      await page.getByRole('tab', { name: 'Transactions' }).click()
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
}
