import { test, expect, type Page, type Locator } from '@playwright/test'

const card = '1234********5678'
const row = (date: string, description: string, amount = 50, source = card) => `${date},${description},${amount.toFixed(2)},,${source}`
const upload = (page: Page, content: string) => page.locator('input[type=file]').setInputFiles({ name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from(content) })
const accept = (page: Page, count: number) => page.getByRole('button', { name: `Accept All (${count})`, exact: true })
const editor = (page: Page) => page.getByRole('dialog', { name: 'Exclusion Rule', exact: true })
const pendingRow = (page: Page, description: string) => page.locator('[id^="import-review-"]').filter({ has: page.getByText(description, { exact: true }) })
const persistedRuleCount = (page: Page) => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ledger-triage')!).state.exclusionRules).length)
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768
// Desktop cards carry the Exclude button inline; on a phone it lives in the row's review sheet.
async function openExclude(page: Page, description: string) {
  if (isPhone(page)) {
    await pendingRow(page, description).first().getByText(description, { exact: true }).click()
    await page.getByRole('dialog', { name: 'Review transaction' }).getByRole('button', { name: 'Exclude Similar Transactions', exact: true }).click()
  } else {
    await pendingRow(page, description).first().getByRole('button', { name: 'Exclude similar transactions', exact: true }).click()
  }
}
// The phone Setup tab splits into Targets, Categories and Rules; the exclusion rules sit under Rules.
async function openRules(page: Page) {
  await page.getByRole('tab', { name: 'Plan', exact: true }).click()
  if (isPhone(page)) {
    await page.getByRole('tablist', { name: 'Setup sections' }).getByRole('tab', { name: 'Rules', exact: true }).click()
    // The undo toast floats over the rule buttons on a phone, so dismiss it first.
    const dismiss = page.getByRole('button', { name: 'Dismiss undo', exact: true })
    if (await dismiss.count()) await dismiss.click()
  }
}
async function start(page: Page, width = 1280, height = 812) {
  await page.setViewportSize({ width, height })
  await page.addInitScript(() => {
    if (!localStorage.getItem('exclusion-test-ready')) {
      localStorage.clear()
      localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString())
      localStorage.setItem('exclusion-test-ready', '1')
    }
  })
  await page.goto('./#/budget')
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
}
async function select(page: Page, label: string, option: string) {
  await editor(page).getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
async function rule(page: Page, description: string, name: string, automatic = false, apply = false) {
  await openExclude(page, description)
  await expect(editor(page).getByLabel('Bank Description')).toHaveValue(description)
  await editor(page).getByLabel('Rule Name').fill(name)
  if (automatic) await select(page, 'Behavior', 'Automatically Exclude')
  if (apply) await editor(page).getByLabel('Also Apply to Pending').check()
  await editor(page).getByRole('button', { name: 'Save Rule', exact: true }).click()
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
  await expect(editor(page)).toBeHidden()
}
async function reopen(page: Page) {
  await page.reload()
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function tabTo(page: Page, target: Locator) {
  // Desktop Setup lists every category with its own controls before the rules.
  for (let i = 0; i < 250; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('Target was not reachable through Tab navigation')
}
for (const width of [1280, 375]) {
  test(`exclusion rules preserve overlap decisions at ${width}px`, async ({ page }) => {
    await start(page, width)
    const file = [row('2026-06-10', 'TRANSFER TO SAVINGS'), row('2026-06-10', 'Coffee', 5)].join('\n')
    await upload(page, file)
    await rule(page, 'TRANSFER TO SAVINGS', 'Savings transfer')
    await expect(accept(page, 2)).toBeVisible()
    await openRules(page)
    await page.getByRole('button', { name: 'Edit Savings transfer', exact: true }).click()
    await select(page, 'Behavior', 'Automatically Exclude')
    await editor(page).getByLabel('Also Apply to Pending').check()
    await editor(page).getByRole('button', { name: 'Save Rule', exact: true }).click()
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
    await expect(accept(page, 1)).toBeVisible()
    await expect(page.locator('#excluded-imports summary')).toHaveText('Excluded imports (1)')
    await noOverflow(page)
    await page.locator('#excluded-imports summary').click()
    await expect(page.getByText('Rule exclusion: Savings transfer')).toBeVisible()
    await page.getByRole('button', { name: 'Restore TRANSFER TO SAVINGS to review', exact: true }).click()
    await expect(accept(page, 2)).toBeVisible()
    await reopen(page)
    await openRules(page)
    await page.getByRole('button', { name: 'Edit Savings transfer', exact: true }).click()
    await editor(page).getByLabel('Also Apply to Pending').check()
    await editor(page).getByRole('button', { name: 'Save Rule', exact: true }).click()
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
    await expect(accept(page, 2)).toBeVisible()
    await upload(page, file)
    if (isPhone(page)) await expect(page.getByTestId('import-summary-mobile').getByRole('button', { name: /Skipped/ })).toContainText('2')
    else await expect(page.getByRole('status').filter({ hasText: 'previously handled' })).toHaveText(/2 previously handled transactions skipped/)
    await expect(accept(page, 2)).toBeVisible()
    await accept(page, 2).click()
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ledger-budget')!).state.transactions).length)).toBe(2)
    await noOverflow(page)
  })
}
test('review-first exclusion batches Undo, Include override and Discard All Undo preserve originals', async ({ page }) => {
  await start(page)
  await upload(page, [row('2026-06-10', 'Savings'), row('2026-06-11', 'Savings'), row('2026-06-10', 'Coffee', 5)].join('\n'))
  await rule(page, 'Savings', 'Savings review', false, true)
  await expect(accept(page, 1)).toBeVisible()
  await page.getByRole('button', { name: 'Exclude matches (2)', exact: true }).click()
  await expect(page.locator('#excluded-imports summary')).toHaveText('Excluded imports (2)')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Exclude matches (2)', exact: true })).toBeVisible()
  await pendingRow(page, 'Savings').first().getByRole('button', { name: 'Include this transaction', exact: true }).click()
  await expect(accept(page, 2)).toBeVisible()
  await reopen(page)
  await openRules(page)
    await page.getByRole('button', { name: 'Edit Savings review', exact: true }).click()
  await editor(page).getByLabel('Also Apply to Pending').check()
  await editor(page).getByRole('button', { name: 'Save Rule', exact: true }).click()
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
  await expect(accept(page, 2)).toBeVisible()
  await page.getByRole('button', { name: 'Discard All', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard All', exact: true }).click()
  await expect(accept(page, 2)).toBeHidden()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(accept(page, 2)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exclude matches (1)', exact: true })).toBeVisible()
})
test('automatic matches on overlapping files stay in history while another source and repeated purchases remain reviewable', async ({ page }) => {
  await start(page)
  await upload(page, row('2026-06-10', 'Savings'))
  await rule(page, 'Savings', 'Savings auto', true, true)
  await upload(page, [row('2026-06-10', 'Savings'), row('2026-07-10', 'Savings'), row('2026-06-10', 'Coffee', 5), row('2026-06-10', 'Coffee', 5)].join('\n'))
  await expect(page.locator('#excluded-imports summary')).toHaveText('Excluded imports (2)')
  await expect(accept(page, 2)).toBeVisible()
  await accept(page, 2).click()
  await upload(page, row('2026-07-10', 'Savings', 50, '1234********9999'))
  await expect(accept(page, 1)).toBeVisible()
  await expect(page.locator('#excluded-imports summary')).toHaveText('Excluded imports (2)')
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ledger-budget')!).state.transactions).length)).toBe(2)
})
test('changed-day possible duplicates remain held despite automatic rules', async ({ page }) => {
  await start(page)
  await upload(page, row('2026-06-10', 'Savings'))
  await rule(page, 'Savings', 'Savings auto', true)
  await accept(page, 1).click()
  await upload(page, row('2026-06-11', 'Savings'))
  await expect(page.getByText('possible duplicate', { exact: true })).toBeVisible()
  await expect(accept(page, 0)).toBeDisabled()
  await expect(page.locator('#excluded-imports')).toHaveCount(0)
})
test('pausing and deleting rules affect future imports and retain exclusion reasons', async ({ page }) => {
  await start(page)
  await upload(page, row('2026-06-10', 'Savings'))
  await rule(page, 'Savings', 'Savings auto', true, true)
  await openRules(page)
  await page.getByRole('button', { name: 'Pause Savings auto', exact: true }).click()
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
  await upload(page, row('2026-07-10', 'Savings'))
  await expect(accept(page, 1)).toBeVisible()
  await openRules(page)
  await page.getByRole('button', { name: 'Delete Savings auto', exact: true }).click()
  await page.getByRole('dialog', { name: 'Delete Exclusion Rule' }).getByRole('button', { name: 'Delete Rule', exact: true }).click()
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
  await upload(page, row('2026-08-10', 'Savings'))
  await expect(accept(page, 2)).toBeVisible()
  await page.locator('#excluded-imports summary').click()
  await expect(page.getByText('Rule exclusion: Savings auto')).toBeVisible()
})
test('preview uses original bank labels and exact versus contains matching', async ({ page }) => {
  await start(page)
  await upload(page, [row('2026-06-10', 'Savings'), row('2026-07-10', 'Savings transfer')].join('\n'))
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('ledger-triage')!)
    for (const tx of Object.values(data.state.pendingTransactions) as { description: string }[]) tx.description = 'Edited merchant'
    localStorage.setItem('ledger-triage', JSON.stringify(data))
  })
  await reopen(page)
  const rulesBeforeCancel = await persistedRuleCount(page)
  await page.getByRole('button', { name: 'Exclude similar transactions', exact: true }).first().click()
  await editor(page).getByLabel('Bank Description').fill('Savings')
  await expect(editor(page).getByText('Preview Matches (1)', { exact: true })).toBeVisible()
  await select(page, 'Description Match', 'Contains')
  await expect(editor(page).getByText('Preview Matches (2)', { exact: true })).toBeVisible()
  await editor(page).getByText('Preview Matches (2)', { exact: true }).click()
  await expect(editor(page).getByText('2 matching imports', { exact: true })).toBeVisible()
  await expect(editor(page).getByText('Edited merchant', { exact: true })).toHaveCount(0)
  await editor(page).getByRole('button', { name: 'Close', exact: true }).click()
  expect(await persistedRuleCount(page)).toBe(rulesBeforeCancel)
})
for (const [width, height] of [[320, 700], [375, 812], [932, 430]]) {
  test(`keyboard create cancel and collapsed history restore at ${width}x${height}`, async ({ page }) => {
    await start(page, width, height)
    await upload(page, row('2026-06-10', 'Savings'))
    await expect(pendingRow(page, 'Savings')).toBeVisible()
    const rulesBeforeCancel = await persistedRuleCount(page)
    await page.mouse.move(0, 0)
    await openRules(page)
    await tabTo(page, page.getByRole('button', { name: 'Add exclusion rule', exact: true }))
    await page.keyboard.press('Enter')
    await expect(editor(page)).toBeVisible()
    await expect(editor(page).getByRole('button', { name: 'Card or Account', exact: true })).toBeFocused()
    await tabTo(page, editor(page).getByLabel('Rule Name'))
    await expect(editor(page).getByLabel('Rule Name')).toBeFocused()
    await page.keyboard.type('Unsaved')
    await noOverflow(page)
    await tabTo(page, editor(page).getByRole('button', { name: 'Close', exact: true }))
    await page.keyboard.press('Enter')
    await expect(editor(page)).toBeHidden()
    expect(await persistedRuleCount(page)).toBe(rulesBeforeCancel)
    await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
    if (isPhone(page)) {
      await openExclude(page, 'Savings')
    } else {
      await tabTo(page, pendingRow(page, 'Savings').getByRole('button', { name: 'Exclude similar transactions', exact: true }))
      await page.keyboard.press('Enter')
    }
    await expect(editor(page)).toBeVisible()
    await tabTo(page, editor(page).getByLabel('Rule Name'))
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('Keyboard savings')
    await tabTo(page, editor(page).getByRole('button', { name: 'Behavior', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toBeVisible()
    await tabTo(page, page.getByRole('option', { name: 'Automatically Exclude', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toBeHidden()
    await tabTo(page, editor(page).getByLabel('Also Apply to Pending'))
    await page.keyboard.press('Space')
    await tabTo(page, editor(page).getByRole('button', { name: 'Save Rule', exact: true }))
    await page.keyboard.press('Enter')
    await expect(editor(page)).toBeHidden()
    const summary = page.locator('#excluded-imports summary')
    await expect(page.locator('#excluded-imports')).not.toHaveAttribute('open', '')
    await page.getByRole('tab', { name: 'Transactions', exact: true }).focus()
    await tabTo(page, summary)
    await page.keyboard.press('Enter')
    await expect(page.locator('#excluded-imports')).toHaveAttribute('open', '')
    await page.keyboard.press('Space')
    await expect(page.locator('#excluded-imports')).not.toHaveAttribute('open', '')
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    // Restore All comes first, then each entry's own Restore.
    await expect(page.getByRole('button', { name: /^Restore All \(\d+\)$/ })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Restore Savings to review', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(accept(page, 1)).toBeVisible()
    await expect(pendingRow(page, 'Savings')).toBeFocused()
    await noOverflow(page)
  })
}

test('overlapping review and automatic rules show every matching reason and review wins', async ({ page }) => {
  await start(page)
  await upload(page, row('2026-06-10', 'Savings'))
  await rule(page, 'Savings', 'Auto savings', true)
  await rule(page, 'Savings', 'Review savings', false, true)
  await expect(accept(page, 0)).toBeDisabled()
  await expect(pendingRow(page, 'Savings').getByText(/Matches exclusion rule:/)).toContainText('Auto savings')
  await expect(pendingRow(page, 'Savings').getByText(/Matches exclusion rule:/)).toContainText('Review savings')
  await expect(page.locator('#excluded-imports')).toHaveCount(0)
  await upload(page, row('2026-07-10', 'Savings'))
  await expect(page.getByRole('button', { name: 'Exclude matches (2)', exact: true })).toBeVisible()
})
