import { test, expect } from '@playwright/test'

const card = '1234********5678'
const csvRow = (date: string, description: string, amount: number, identity = card) =>
  `${date},${description},${amount.toFixed(2)},,${identity}`
const first = [csvRow('2026-05-17', 'Old purchase', 12), csvRow('2026-06-10', 'Coffee', 5), csvRow('2026-06-10', 'Coffee', 5), csvRow('2026-06-10', 'Groceries', 42), csvRow('2026-06-16', 'Lunch', 9)].join('\n')
const overlap = [csvRow('2026-06-10', 'Groceries', 42), csvRow('2026-06-10', 'Coffee', 5), csvRow('2026-06-10', 'Coffee', 5), csvRow('2026-06-16', 'Lunch', 9), csvRow('2026-07-07', 'New purchase', 20)].join('\n')

for (const phone of [false, true]) {
  test(`overlapping imports remember occurrences and decisions ${phone ? 'on phone' : 'on desktop'}`, async ({ page }) => {
    if (phone) await page.setViewportSize({ width: 375, height: 812 })
    await page.addInitScript(() => {
      if (!localStorage.getItem('import-test-ready')) {
        localStorage.clear()
        localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString())
        localStorage.setItem('import-test-ready', '1')
      }
    })
    await page.goto('./#/budget')
    await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
    const upload = async (content: string, name: string) => {
      await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(content) })
    }
    await upload(first, 'may-june.csv')
    await expect(page.getByRole('button', { name: 'Accept All (5)' })).toBeVisible()
    if (phone) {
      await page.getByTestId('triage-inbox-mobile').getByText('Lunch', { exact: true }).click()
      await page.getByRole('dialog', { name: 'Review transaction' }).getByRole('button', { name: 'Ignore', exact: true }).click()
    } else await page.getByRole('button', { name: 'Ignore Lunch' }).click()
    await page.getByRole('button', { name: 'Accept All (4)' }).click()
    const count = async () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ledger-budget')!).state.transactions).length)
    expect(await count()).toBe(4)
    await page.reload()
    await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
    await upload(overlap, 'june-july.csv')
    if (phone) await expect(page.getByTestId('import-summary-mobile')).toContainText(/1\s*To Categorize[\s\S]*4\s*Skipped/)
    else await expect(page.getByRole('status').filter({ hasText: 'previously handled' })).toHaveText(/4 previously handled transactions skipped.*1 new transaction sent to review/)
    await expect(page.getByRole('button', { name: 'Accept All (1)' })).toBeVisible()
    if (phone) await page.getByTestId('import-summary-mobile').getByRole('button', { name: /Skipped/ }).click()
    else await page.getByText('View skipped (4)', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Review again' })).toBeVisible()
    await page.getByRole('button', { name: 'Review again' }).click()
    if (phone) await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Accept All (2)' })).toBeVisible()
    await page.getByRole('button', { name: 'Accept All (2)' }).click()
    expect(await count()).toBe(6)

    await upload(overlap.replaceAll(card, '1234********9999'), 'other-card.csv')
    await expect(page.getByRole('button', { name: 'Accept All (5)' })).toBeVisible()
    expect(await count()).toBe(6)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.reload()
    expect(errors).toEqual([])
  })
}

test('a source-free CSV can be cancelled and imported into a saved source using the keyboard', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString())
  })
  await page.goto('./#/budget')
  const file = { name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Amount,Description\n2026-06-10,-5,Coffee\n') }
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByRole('dialog', { name: 'Choose Import Source' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ledger-triage') || '{"state":{"pendingTransactions":{}}}').state.pendingTransactions)).toEqual({})
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByLabel('Card or account name').fill('My card')
  await page.getByRole('button', { name: 'Import transactions' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'previously handled' })).toHaveText(/1 new transaction sent to review/)
  await page.locator('input[type=file]').setInputFiles(file)
  const source = page.getByRole('button', { name: 'Import source', exact: true })
  // Keep the pointer from highlighting an option as the shorter sheet opens.
  await page.mouse.move(0, 0)
  await source.focus()
  await source.press('Enter')
  await expect(page.getByRole('listbox')).toBeVisible()
  await source.press('ArrowDown')
  await source.press('Enter')
  await expect(source).toHaveText(/My card/)
  await page.getByRole('button', { name: 'Import transactions' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'previously handled' })).toHaveText(/1 previously handled transaction skipped/)
})
