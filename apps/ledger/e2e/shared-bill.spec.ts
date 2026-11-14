import { test, expect, type Locator } from '@playwright/test'
import { seedApp } from './seed'

for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
  test.describe(`shared bills at ${viewport.width}px`, () => {
    test.use({ viewport })
    test.beforeEach(async ({ page }) => { await seedApp(page) })

    // A phone puts shared bill controls behind the Details tabs and words them differently.
    const phone = viewport.width < 768
    const sharedTab = (panel: Locator) => panel.getByRole('group', { name: 'Details' }).getByRole('button', { name: 'Shared Bill', exact: true })
    const totalPaid = (panel: Locator) => panel.getByLabel(phone ? 'Total Paid' : 'Total I paid')

    test('percentage and manual shares persist and display after saving', async ({ page }) => {
      await page.goto('/#/budget')
      await page.getByRole('button', { name: 'Add Transaction', exact: true }).first().click()
      const panel = page.getByTestId('sheet-panel')
      await panel.getByLabel('Amount', { exact: true }).fill('120')
      if (phone) {
        await sharedTab(panel).click()
        await panel.getByRole('switch', { name: 'Paid for Others' }).check()
      } else {
        await panel.getByLabel('Shared bill', { exact: true }).check()
      }
      await expect(totalPaid(panel)).toHaveValue('120')
      if (phone) await panel.getByRole('group', { name: 'My share' }).getByRole('button', { name: '50%' }).click()
      else await panel.getByRole('button', { name: 'My share 50%' }).click()
      await expect(panel.getByLabel('Your share')).toHaveValue('60')
      await panel.getByLabel(phone ? 'Shared With' : 'Shared with', { exact: true }).fill('Alex')
      await panel.getByLabel('Description (Optional)', { exact: true }).fill('Split regression dinner')
      await panel.getByRole('button', { name: 'Add Transaction', exact: true }).click()
      await expect(panel).not.toBeVisible()

      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ledger-budget')!).state.transactions)
      const bill = Object.values(saved).find((tx) => (tx as { description: string }).description === 'Split regression dinner') as { amount: number; shared: { totalAmount: number } }
      expect(bill.amount).toBe(60)
      expect(bill.shared.totalAmount).toBe(120)

      // seedApp runs on reload, so reopen the persisted state in a fresh page.
      const persisted = await page.evaluate(() => ({ ...localStorage }))
      const fresh = await page.context().browser()!.newContext({ viewport })
      await fresh.addInitScript((data) => {
        for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value)
      }, persisted)
      const reloaded = await fresh.newPage()
      await reloaded.goto(page.url())
      await reloaded.getByRole('tab', { name: 'Transactions', exact: true }).click()
      await reloaded.locator('input[type=search]:visible').fill('Split regression dinner')
      await reloaded.getByRole('button', { name: 'Edit Split regression dinner', exact: true }).filter({ visible: true }).click()
      const editor = reloaded.getByTestId('sheet-panel')
      await expect(editor.getByLabel('Your share')).toHaveValue('60')
      if (phone) await sharedTab(editor).click()
      await expect(totalPaid(editor)).toHaveValue('120')
      await editor.getByLabel('Your share').fill('45')
      await editor.getByRole('button', { name: 'Save Changes' }).click()
      const editButton = reloaded.getByRole('button', { name: 'Edit Split regression dinner', exact: true }).filter({ visible: true })
      if (viewport.width >= 768) {
        await expect(editButton.locator('xpath=ancestor::tr')).toContainText('-$45')
      } else {
        await expect(editButton).toContainText('-$45')
      }
      await editButton.click()
      await expect(editor.getByLabel('Your share')).toHaveValue('45')
      if (phone) await sharedTab(editor).click()
      await expect(totalPaid(editor)).toHaveValue('120')
      await fresh.close()
    })
  })
}
