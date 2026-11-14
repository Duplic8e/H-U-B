import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

type Account = { id: string; name: string; type: 'bank' | 'investment' | 'debt' | 'receivable' | 'other'; value: number; currency?: 'CAD' | 'USD' }

const today = () => new Date().toISOString().slice(0, 10)
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
const bank = (id: string, value: number, currency: 'CAD' | 'USD' = 'CAD'): Account =>
  ({ id, name: `${currency} ${id}`, type: 'bank', value, currency })

async function seed(page: Page, accounts: Account[], options: {
  rate?: number
  cached?: { rate: number; fetchedAt: string; quoteDate: string }
  history?: { date: string; value: number }[]
  legacy?: boolean
} = {}) {
  await page.route(/https?:\/\//, async (route) => {
    const host = new URL(route.request().url()).hostname
    if (host === 'api.frankfurter.dev' || host === 'open.er-api.com') await route.abort()
    else await route.continue()
  })
  await page.addInitScript(({ accounts, options }) => {
    const day = new Date().toISOString().slice(0, 10)
    localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString())
    localStorage.setItem('accounts-storage', JSON.stringify({ state: {
      accounts,
      history: options.history ?? [],
      ...(options.legacy ? {} : {
        pendingCurrencyReviewIds: [], currencySupportStartedAt: day, pendingEditSnapshotDate: null,
      }),
    } }))
    const fx = options.cached ? {
      [`USD-CAD@${options.cached.quoteDate}`]: {
        value: { from: 'USD', to: 'CAD', rate: options.cached.rate,
          date: options.cached.quoteDate, asOf: options.cached.fetchedAt },
        fetchedAt: options.cached.fetchedAt,
      },
    } : {}
    localStorage.setItem('ledger-market-data', JSON.stringify({ version: 1, state: {
      quotes: {}, historical: {}, fx,
      overrides: options.rate ? { [`USD-CAD@${day}`]: options.rate } : {},
    } }))
  }, { accounts, options })
  await page.goto('./')
}

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('accounts-storage')!).state as {
    accounts: Account[]; history: { date: string; value: number }[];
    pendingCurrencyReviewIds: string[]; currencySupportStartedAt: string;
  })
}

const widget = (page: Page, id: string) => page.locator(`[data-widget-id="${id}"]`)

// A phone shows each account group as a fold. This opens one on a phone and is the plain widget on
// desktop, so one assertion covers both.
const onPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768
const group = async (page: Page, id: 'bank' | 'debt') => {
  const card = widget(page, id)
  if (onPhone(page) && !(await card.evaluate((el) => (el as HTMLDetailsElement).open))) await card.locator('summary').click()
  return card
}
const addAccount = async (page: Page) => {
  await (await group(page, 'bank')).getByRole('button', { name: onPhone(page) ? 'Add Bank Account' : 'Add', exact: true }).click()
}

for (const width of [1280, 375]) {
  test(`currency popup opens with keyboard focus and restores it at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 })
    await seed(page, [bank('usd', 1000, 'USD')], { rate: 1.35 })
    const trigger = page.getByRole('button', { name: 'Currencies', exact: true })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Currencies', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Refresh Rate' })).toBeFocused()
    await expect(dialog.getByRole('heading', { name: 'Currencies', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}

test('shows the standard CAD and USD case at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await seed(page, [bank('cad', 1000), bank('usd', 1000, 'USD')], { rate: 1.35 })
  await expect(await group(page, 'bank')).toContainText('$2,350.00')
  await expect(page.getByTestId('account-row-usd')).toContainText('$1,000.00')
  await expect(page.getByTestId('account-row-usd')).toContainText('≈ $1,350.00')
  await page.evaluate(() => document.fonts.ready)
  const bankCard = await group(page, 'bank')
  await bankCard.scrollIntoViewIfNeeded()
  await bankCard.screenshot({ path: '.superpowers/sdd/browser-evidence/account-currencies-native-320.png' })
})

test('keeps native USD balances, CAD totals, and long rows readable at four widths', async ({ page }) => {
  const longName = 'Extra Long International Savings Account With A Descriptive Name'
  await seed(page, [
    bank('cad', 1000),
    { ...bank('usd', 1_000_000_000.25, 'USD'), name: longName },
    { id: 'debt', name: 'USD Credit Card', type: 'debt', value: 100, currency: 'USD' },
  ], { rate: 1.35 })
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(await group(page, 'bank')).toContainText('$1,350,001,000.34')
    await expect(page.getByTestId('account-row-usd')).toContainText('USD')
    await expect(page.getByTestId('account-row-usd')).toContainText('≈ $')
    await expect(page.getByTestId('account-name-usd')).toContainText(longName)
    await group(page, 'debt')
    await expect(page.getByTestId('account-row-debt')).toContainText('$100.00')
    await group(page, 'bank')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px horizontal overflow`).toBe(true)
    const keyFigureFits = await widget(page, 'trend').locator('[data-key-figure]').evaluate((figure) => {
      const parent = figure.getBoundingClientRect()
      const amount = figure.querySelector('span')?.getBoundingClientRect()
      return !!amount && amount.left >= parent.left - 1 && amount.right <= parent.right + 1
    })
    expect(keyFigureFits, `${width}px net worth clipped`).toBe(true)
    await page.screenshot({ path: `.superpowers/sdd/browser-evidence/account-currencies-${width}.png`, fullPage: true })
  }
})

test('compact row controls reveal on keyboard focus and remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await seed(page, [bank('usd', 1_000_000_000.25, 'USD')], { rate: 1.35 })
  const row = page.getByTestId('account-row-usd')
  const edit = row.getByRole('button', { name: 'Edit account' })
  await edit.focus()
  await expect(edit).toBeFocused()
  const fits = await edit.evaluate((button) => {
    const rect = button.getBoundingClientRect()
    const actions = button.parentElement!.getBoundingClientRect()
    return rect.width >= 32 && rect.left >= actions.left && rect.right <= actions.right
  })
  expect(fits).toBe(true)
  await page.setViewportSize({ width: 768, height: 900 })
  await edit.focus()
  const actionsFit = await row.evaluate((element) => {
    const list = element.parentElement!
    const bounds = list.getBoundingClientRect()
    const remove = element.querySelector('button[aria-label^="Delete"]')!.getBoundingClientRect()
    return list.scrollWidth <= list.clientWidth && remove.right <= bounds.right && remove.left >= bounds.left
  })
  expect(actionsFit).toBe(true)
  await edit.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Edit Account' })).toBeVisible()
})

test('creates USD on desktop and confirms edits only after explicit approval', async ({ page }) => {
  await seed(page, [bank('cad', 1000)], { rate: 1.35 })
  await widget(page, 'bank').getByRole('button', { name: onPhone(page) ? 'Add Bank Account' : 'Add', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Account' })
  await expect(dialog.getByRole('button', { name: 'Currency' })).toHaveText('CAD')
  await dialog.getByLabel('Name / Description').fill('New Dollar Account')
  await dialog.getByLabel('Balance').fill('1234.567')
  await dialog.getByRole('button', { name: 'Currency' }).click()
  await dialog.getByRole('option', { name: 'USD' }).click()
  await expect(dialog.getByLabel('Balance (USD)')).toHaveValue('1234.567')
  await dialog.getByRole('button', { name: 'Add Account' }).click()
  await expect(page.getByText('New Dollar Account')).toBeVisible()
  const created = (await saved(page)).accounts.find((a) => a.name === 'New Dollar Account')!
  expect(created).toMatchObject({ value: 1234.567, currency: 'USD' })
  await page.getByTestId(`account-row-${created.id}`).hover()
  await page.getByTestId(`account-row-${created.id}`).getByRole('button', { name: 'Edit account' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit Account' })
  await edit.getByRole('button', { name: 'Currency' }).click()
  await edit.getByRole('option', { name: 'CAD' }).click()
  await edit.getByRole('button', { name: 'Save Changes' }).click()
  await expect(edit.getByRole('group', { name: 'Confirm currency change' })).toContainText('1,234.567')
  expect((await saved(page)).accounts.find((a) => a.id === created.id)?.currency).toBe('USD')
  await edit.getByRole('button', { name: 'Keep Editing' }).click()
  expect((await saved(page)).accounts.find((a) => a.id === created.id)?.currency).toBe('USD')
  await edit.getByRole('button', { name: 'Save Changes' }).click()
  await edit.getByRole('button', { name: 'Confirm Currency Change' }).click()
  expect((await saved(page)).accounts.find((a) => a.id === created.id)).toMatchObject({ value: 1234.567, currency: 'CAD' })
})

test('narrow sheet selects USD, keeps its menu visible, and saves an unrounded balance', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await seed(page, [bank('cad', 100)], { rate: 1.35 })
  await addAccount(page)
  const dialog = page.getByRole('dialog', { name: 'Add Account' })
  await dialog.getByLabel('Name / Description').fill('Foreign Savings')
  await dialog.getByLabel('Balance').fill('987654321.09')
  await dialog.getByRole('button', { name: 'Currency' }).click()
  const option = page.getByRole('option', { name: 'USD' })
  await expect(option).toBeVisible()
  const bounds = await option.boundingBox()
  expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320).toBe(true)
  await option.click()
  await expect(dialog.getByLabel('Balance (USD)')).toHaveValue('987654321.09')
  await dialog.getByRole('button', { name: 'Add Account' }).click()
  const account = (await saved(page)).accounts.find((a) => a.name === 'Foreign Savings')!
  expect(account).toMatchObject({ currency: 'USD', value: 987654321.09 })
  const row = page.getByTestId(`account-row-${account.id}`)
  await expect(row).toContainText('≈ $')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('keeps USD debt and net worth unavailable until a manual rate restores complete valuation', async ({ page }) => {
  await seed(page, [bank('cad', 1000), bank('usd', 1000, 'USD'),
    { id: 'debt', name: 'USD Debt', type: 'debt', value: 100, currency: 'USD' }])
  await expect(widget(page, 'bank')).toContainText('Conversion Needed')
  await expect(widget(page, 'debt')).toContainText('Conversion Needed')
  await expect(widget(page, 'trend').locator('[data-key-figure]')).toHaveText('Conversion Needed')
  expect((await saved(page)).history).toEqual([])
  await page.getByRole('button', { name: 'Currencies', exact: true }).click()
  await page.getByLabel('Manual USD to CAD rate').fill('1.35')
  await page.getByRole('button', { name: 'Save Rate' }).click()
  await expect(widget(page, 'bank')).toContainText('$2,350.00')
  await expect(widget(page, 'debt')).toContainText('$135.00')
  await expect(widget(page, 'trend').locator('[data-key-figure]')).toContainText('2,215.00')
  await expect.poll(async () => (await saved(page)).history).toEqual([{ date: today(), value: 2215 }])
})

test('rate refresh changes display but preserves existing snapshots; account edit replaces today only', async ({ page }) => {
  const history = [{ date: yesterday(), value: 50 }, { date: today(), value: 777 }]
  await seed(page, [bank('usd', 1000, 'USD')], { rate: 1.35, history })
  await expect(widget(page, 'trend').locator('[data-key-figure]')).toContainText('1,350.00')
  expect((await saved(page)).history).toEqual(history)
  await page.getByRole('button', { name: 'Currencies', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh Rate' }).click()
  expect((await saved(page)).history).toEqual(history)
  await page.getByLabel('Manual USD to CAD rate').fill('1.4')
  await page.getByRole('button', { name: 'Save Rate' }).click()
  await expect(widget(page, 'trend').locator('[data-key-figure]')).toContainText('1,400.00')
  expect((await saved(page)).history).toEqual(history)
  if (await page.getByRole('dialog', { name: 'Currencies', exact: true }).isVisible()) await page.keyboard.press('Escape')
  await page.getByTestId('account-row-usd').hover()
  await page.getByTestId('account-row-usd').getByRole('button', { name: 'Edit account' }).click()
  await page.getByRole('dialog', { name: 'Edit Account' }).getByLabel('Balance (USD)').fill('2000')
  await page.getByRole('dialog', { name: 'Edit Account' }).getByRole('button', { name: 'Save Changes' }).click()
  await expect.poll(async () => (await saved(page)).history).toEqual([
    history[0], { date: today(), value: 2800 },
  ])
})

test('shows cached rate age and quote date after a provider failure', async ({ page }) => {
  const fetchedAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
  await seed(page, [bank('usd', 1000, 'USD')], {
    cached: { rate: 1.32, fetchedAt, quoteDate: yesterday() },
  })
  await page.getByRole('button', { name: 'Currencies', exact: true }).click()
  const rate = page.getByRole('dialog', { name: 'Currencies', exact: true })
  await expect(rate).toContainText('1 USD = $1.3200')
  await expect(rate).toContainText(`As of ${yesterday()}`)
  await expect(rate.getByText('As of', { exact: false })).toHaveAttribute('title', /hr ago/)
  await expect(widget(page, 'trend').locator('[data-key-figure]')).toContainText('1,320.00')
})

test('legacy review cancels drafts and confirms all CAD without changing prior history', async ({ page }) => {
  const accounts: Account[] = [{ id: 'old', name: 'Old Savings', type: 'bank', value: 1000 }]
  await seed(page, accounts, { legacy: true, rate: 1.35, history: [{ date: yesterday(), value: 900 }] })
  const review = page.getByRole('region', { name: 'Account currency review' })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Review Account Currencies' }).click()
  const dialog = page.getByRole('dialog', { name: 'Review account currencies' })
  await dialog.getByLabel('Currency for Old Savings').selectOption('USD')
  await dialog.getByRole('button', { name: 'Cancel Review' }).click()
  expect((await saved(page)).accounts[0].currency).toBe('CAD')
  expect((await saved(page)).pendingCurrencyReviewIds).toEqual(['old'])
  await review.getByRole('button', { name: 'Review Account Currencies' }).click()
  await dialog.getByRole('button', { name: 'Confirm Account Currencies' }).click()
  await expect(review).toHaveCount(0)
  expect((await saved(page)).accounts[0].currency).toBe('CAD')
  expect((await saved(page)).history[0]).toEqual({ date: yesterday(), value: 900 })
})

test('legacy USD correction requires confirmation and preserves native balance', async ({ page }) => {
  await seed(page, [{ id: 'old', name: 'Old Savings', type: 'bank', value: 1000 }], { legacy: true, rate: 1.35 })
  await page.getByRole('region', { name: 'Account currency review' }).getByRole('button').click()
  const dialog = page.getByRole('dialog', { name: 'Review account currencies' })
  await dialog.getByLabel('Currency for Old Savings').selectOption('USD')
  await dialog.getByRole('button', { name: 'Confirm Account Currencies' }).click()
  expect((await saved(page)).accounts[0].currency).toBe('CAD')
  await expect(dialog.getByRole('group', { name: 'Confirm currency change' })).toContainText('1,000')
  await dialog.getByRole('button', { name: 'Confirm Currency Change' }).click()
  expect((await saved(page)).accounts[0]).toMatchObject({ value: 1000, currency: 'USD' })
  await expect(widget(page, 'bank')).toContainText('$1,350.00')
})

test('keyboard currency selection and closing the sheet return focus to the edit control', async ({ page }) => {
  await seed(page, [bank('cad', 1000)])
  const editControl = page.getByTestId('account-row-cad').getByRole('button', { name: 'Edit account' })
  await editControl.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Edit Account' })
  await expect(dialog).toBeVisible()
  const currency = dialog.getByRole('button', { name: 'Currency' })
  await currency.focus()
  await page.keyboard.press('ArrowDown')
  await expect(dialog.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(currency).toHaveText('USD')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(editControl).toBeFocused()
  expect((await saved(page)).accounts[0].currency).toBe('CAD')
})

test('backup export and restore keep native currencies, marker, history, and rate override', async ({ page }) => {
  const history = [{ date: yesterday(), value: 1234 }]
  await seed(page, [bank('cad', 1000), bank('usd', 1000, 'USD')], { rate: 1.35, history })
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const downloadPromise = page.waitForEvent('download')
  await settings.getByRole('button', { name: 'Export data' }).click()
  const download = await downloadPromise
  const backup = await readFile(await download.path()!)
  const exported = JSON.parse(backup.toString())
  expect(exported.data['accounts-storage'].state.accounts).toMatchObject([
    { id: 'cad', currency: 'CAD', value: 1000 },
    { id: 'usd', currency: 'USD', value: 1000 },
  ])
  expect(exported.data['accounts-storage'].state.history).toEqual((await saved(page)).history)
  expect(exported.data['ledger-market-data'].state.overrides[`USD-CAD@${today()}`]).toBe(1.35)
  await page.evaluate(() => {
    localStorage.removeItem('accounts-storage')
    localStorage.removeItem('ledger-market-data')
  })
  await page.reload()
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  // Restoring reloads the page. Wait for that reload, or the reads below can
  // land in the page that is being torn down.
  const reloaded = page.waitForEvent('load')
  await page.getByRole('dialog', { name: 'Settings' }).locator('input[type="file"]').setInputFiles({
    name: 'ledger-backup.json', mimeType: 'application/json', buffer: backup,
  })
  await reloaded
  await expect(page.getByTestId('account-row-usd')).toContainText('$1,000.00')
  const restored = await saved(page)
  expect(restored.accounts).toEqual(exported.data['accounts-storage'].state.accounts)
  expect(restored.history).toEqual(exported.data['accounts-storage'].state.history)
  expect(restored.currencySupportStartedAt).toBe(exported.data['accounts-storage'].state.currencySupportStartedAt)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ledger-market-data')!).state.overrides[`USD-CAD@${new Date().toISOString().slice(0, 10)}`])).toBe(1.35)
})
