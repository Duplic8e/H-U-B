import { test, expect } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 900 }, { width: 932, height: 430 }]) {
  test(`triage header exclusion and incoming controls fit at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.addInitScript(() => localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString()))
    await page.goto('./#/budget')
    await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
    await page.locator('input[type=file]').setInputFiles({ name: 'triage.csv', mimeType: 'text/csv', buffer: Buffer.from([
      '2026-10-06,INTERAC E-TRANSFER RECEIVED,,40.00,1234********5678',
      '2026-10-01,SQ *6IXTY WINGS KANATA Kanata ON,14.00,,1234********5678',
    ].join('\n')) })
    const receipt = page.locator('[id^="import-review-"]').filter({ hasText: 'INTERAC E-TRANSFER RECEIVED' })
    const treatment = receipt.getByRole('button', { name: 'Treatment for INTERAC E-TRANSFER RECEIVED' })
    const category = receipt.getByRole('button', { name: 'Category for INTERAC E-TRANSFER RECEIVED' })
    await expect(treatment).toBeVisible()
    await expect(category).toBeVisible()
    const treatmentBox = (await treatment.boundingBox())!
    const categoryBox = (await category.boundingBox())!
    expect(Math.abs(treatmentBox.y - categoryBox.y)).toBeLessThan(1)
    expect(treatmentBox.x + treatmentBox.width).toBeLessThanOrEqual(categoryBox.x)
    expect(treatmentBox.height).toBeGreaterThanOrEqual(44)
    expect(categoryBox.height).toBeGreaterThanOrEqual(44)
    const exclude = receipt.getByRole('button', { name: 'Exclude similar transactions', exact: true })
    const excludeBox = (await exclude.boundingBox())!
    const amountBox = (await receipt.getByText('+$40', { exact: true }).boundingBox())!
    if (viewport.width === 1280) {
      expect(Math.abs(excludeBox.y + excludeBox.height / 2 - amountBox.y - amountBox.height / 2)).toBeLessThan(1)
      expect(excludeBox.x + excludeBox.width).toBeLessThan(amountBox.x)
    } else {
      const dateBox = (await receipt.getByText('2026-10-06', { exact: true }).boundingBox())!
      expect(excludeBox.y).toBeGreaterThanOrEqual(dateBox.y + dateBox.height)
      expect(excludeBox.y + excludeBox.height).toBeLessThanOrEqual(treatmentBox.y)
      const approveBox = (await receipt.getByRole('button', { name: 'Approve INTERAC E-TRANSFER RECEIVED' }).boundingBox())!
      expect(approveBox.y).toBeGreaterThanOrEqual(categoryBox.y + categoryBox.height)
    }
    const outgoing = page.locator('[id^="import-review-"]').filter({ hasText: 'SQ *6IXTY WINGS KANATA Kanata ON' })
    await expect(outgoing.getByRole('button', { name: /^Treatment for/ })).toHaveCount(0)
    await expect(outgoing.getByRole('button', { name: /^Category for/ })).toBeVisible()
    expect(await receipt.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await treatment.click()
    await page.getByRole('option', { name: 'Refunds & Payments', exact: true }).click()
    await expect(receipt.getByText('Choose an expense category before accepting this payment')).toBeVisible()
    await expect(receipt.getByRole('button', { name: 'Approve INTERAC E-TRANSFER RECEIVED' })).toBeDisabled()
    await exclude.click()
    const editor = page.getByRole('dialog', { name: 'Exclusion Rule', exact: true })
    await expect(editor.getByLabel('Bank Description')).toHaveValue('INTERAC E-TRANSFER RECEIVED')
    await page.keyboard.press('Escape')
    await expect(editor).toBeHidden()
    // Expand only the test screenshot's scroll container so the whole card is reviewable.
    await receipt.evaluate(el => {
      const scroller = el.parentElement!
      scroller.style.maxHeight = 'none'
      scroller.style.overflow = 'visible'
    })
    await receipt.screenshot({ path: `.superpowers/sdd/screenshots/triage-B-${viewport.width}.png` })
  })
}

// Phones use the slim Triage Inbox: one line per charge, with the controls in a review sheet.
for (const viewport of [{ width: 320, height: 700 }, { width: 375, height: 812 }]) {
  test(`phone triage rows and review sheet fit at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.addInitScript(() => localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString()))
    await page.goto('./#/budget')
    await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
    await page.locator('input[type=file]').setInputFiles({ name: 'triage.csv', mimeType: 'text/csv', buffer: Buffer.from([
      '2026-10-06,INTERAC E-TRANSFER RECEIVED,,40.00,1234********5678',
      '2026-10-01,SQ *6IXTY WINGS KANATA Kanata ON,14.00,,1234********5678',
    ].join('\n')) })
    const inbox = page.getByTestId('triage-inbox-mobile')
    await expect(inbox.getByText('2 to Review')).toBeVisible()
    const receipt = page.locator('[id^="import-review-"]').filter({ hasText: 'INTERAC E-TRANSFER RECEIVED' })
    await expect(receipt).toBeVisible()
    expect(await receipt.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await receipt.getByText('INTERAC E-TRANSFER RECEIVED', { exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Review transaction' })
    const treatment = sheet.getByRole('button', { name: 'Treatment for INTERAC E-TRANSFER RECEIVED' })
    const category = sheet.getByRole('button', { name: 'Category for INTERAC E-TRANSFER RECEIVED' })
    await expect(treatment).toBeVisible()
    await expect(category).toBeVisible()
    expect((await treatment.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await category.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await treatment.click()
    await page.getByRole('option', { name: 'Refunds & Payments', exact: true }).click()
    await expect(sheet.getByText('Choose an expense category first')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled()
    await sheet.getByRole('button', { name: 'Exclude Similar Transactions', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Exclusion Rule', exact: true })
    await expect(editor.getByLabel('Bank Description')).toHaveValue('INTERAC E-TRANSFER RECEIVED')
    await page.keyboard.press('Escape')
    await expect(editor).toBeHidden()
  })
}
