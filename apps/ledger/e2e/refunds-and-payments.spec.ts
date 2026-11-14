import { test, expect, type Page } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('refund-fixture')) return
    localStorage.clear()
    localStorage.setItem('refund-fixture', '1')
    localStorage.setItem('ledger-disclaimer-ack', new Date().toISOString())
    const month = new Date().toISOString().slice(0, 7)
    localStorage.setItem('ledger-budget', JSON.stringify({ version: 5, state: {
      refundsAndPaymentsEnabled: true,
      categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' }, income: { id: 'income', name: 'Income', kind: 'income' } },
      categories: { groceries: { id: 'groceries', groupId: 'food', name: 'Groceries', targetAmount: 100 }, dining: { id: 'dining', groupId: 'food', name: 'Dining', targetAmount: 100 }, salary: { id: 'salary', groupId: 'income', name: 'Salary', targetAmount: 0 } },
      transactions: {
        purchase: { id: 'purchase', date: `${month}-01`, description: 'Shared purchase', type: 'expense', amount: 60, categoryId: 'groceries', shared: { totalAmount: 100, sharedWith: 'Alex' } },
        income: { id: 'income', date: `${month}-02`, description: 'Ordinary receipt', type: 'income', amount: 40, categoryId: 'salary' },
        settlement: { id: 'settlement', date: `${month}-03`, description: 'Alex settlement', type: 'income', amount: 40, reimbursement: { from: 'Alex' } },
      },
    } }))
  })
  await page.goto('/#/budget')
})

const budget = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('ledger-budget')!).state)
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
async function edit(page: Page, description: string) {
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
  await page.getByRole('button', { name: `Edit ${description}`, exact: true }).filter({ visible: true }).click()
  return page.getByTestId('sheet-panel')
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 700 }, { width: 375, height: 812 }, { width: 750, height: 340 }]) {
  test(`actual net-credit chart and category disclosure at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    for (const creditOnly of [false, true]) {
      await page.evaluate(onlyCredit => {
        const now = new Date()
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-04`
        localStorage.setItem('ledger-budget', JSON.stringify({ version: 5, state: {
          refundsAndPaymentsEnabled: false,
          categoryGroups: { income: { id: 'income', name: 'Income', kind: 'income' }, housing: { id: 'housing', name: 'Housing', kind: 'expense' }, shopping: { id: 'shopping', name: 'Shopping', kind: 'expense' } },
          categories: { salary: { id: 'salary', groupId: 'income', name: 'Salary', targetAmount: 0 }, rent: { id: 'rent', groupId: 'housing', name: 'Rent', targetAmount: 500 }, shopping: { id: 'shopping', groupId: 'shopping', name: 'Shopping', targetAmount: 100 } },
          transactions: {
            ...(!onlyCredit ? { salary: { id: 'salary', date, type: 'income', amount: 1000, description: 'Salary', categoryId: 'salary' }, rent: { id: 'rent', date, type: 'expense', amount: 500, description: 'Rent', categoryId: 'rent' } } : {}),
            purchase: { id: 'purchase', date, type: 'expense', amount: 60, description: 'Shopping purchase', categoryId: 'shopping' },
            refund: { id: 'refund', date, type: 'expense', amount: -100, description: 'Shopping refund', categoryId: 'shopping' },
          },
        } }))
      }, creditOnly)
      await page.reload()
      await page.getByRole('tab', { name: 'This Month', exact: true }).click()
      // The phone Overview has no Income card; the In figure of its Net Change card carries the same number.
      const phone = viewport.width < 768 || viewport.height < 500
      const incomeCard = phone ? page.getByTestId('overview-in') : page.getByRole('heading', { name: 'Income', exact: true }).locator('xpath=../..')
      await expect(incomeCard).toContainText(creditOnly ? '$0' : '$1,000')
      await expect(incomeCard).not.toContainText('$1,040')
      // The Cash Flow chart lives in Insights, one tap from This Month.
      await page.getByRole('button', { name: /^Insights/ }).click()
      const flow = page.getByRole('img', { name: /^Cash flow this period:/ })
      await expect(flow).toHaveAttribute('aria-label', creditOnly
        ? 'Cash flow this period: $0 income across 0 sources plus $40 expense credits across 1 groups into $0 of positive net expenses across 0 groups, leaving $40 net remaining'
        : 'Cash flow this period: $1,000 income across 1 sources plus $40 expense credits across 1 groups into $500 of positive net expenses across 1 groups, leaving $540 net remaining')
      await flow.scrollIntoViewIfNeeded()
      const svg = flow.locator('svg.recharts-surface')
      await expect(svg).toBeVisible()
      await expect(svg.locator('text').filter({ hasText: /^Shopping c/ })).toBeVisible()
      await expect(svg.locator('text').filter({ hasText: /^Net remaining/ })).toBeVisible()
      await expect(svg.locator('g title')).toHaveText(creditOnly
        ? ['Shopping credit', 'Available funds', 'Net remaining']
        : ['Salary', 'Shopping credit', 'Available funds', 'Housing', 'Net remaining'])
      const links = svg.locator('path[stroke-width]')
      await expect(links).toHaveCount(creditOnly ? 2 : 4)
      const widths = await links.evaluateAll(paths => paths.map(path => Number(path.getAttribute('stroke-width'))))
      expect(widths.every(width => Number.isFinite(width) && width > 0)).toBe(true)
      expect(widths[0] / widths[1]).toBeCloseTo(creditOnly ? 1 : 25, 2)
      if (!creditOnly) expect(widths[3] / widths[2]).toBeCloseTo(540 / 500, 2)
      expect(await links.evaluateAll(paths => paths.every(path => !/NaN|Infinity/.test(path.getAttribute('d') || '')))).toBe(true)
      const flowCard = page.getByRole('heading', { name: 'Cash Flow', exact: true }).locator('xpath=../..')
      await expect(flowCard).not.toContainText('No transactions this month.')
      await expect.poll(() => flowCard.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      const clippedLabels = await svg.locator('text').evaluateAll(labels => labels.filter(label => {
        const bounds = label.ownerSVGElement!.getBoundingClientRect()
        const text = label.getBoundingClientRect()
        return text.left < bounds.left - 0.5 || text.right > bounds.right + 0.5
      }).map(label => label.textContent))
      expect(clippedLabels).toEqual([])
      await svg.locator('g title').filter({ hasText: /^Shopping credit$/ }).locator('..').locator('rect').hover()
      await expect(flow.locator('.recharts-tooltip-wrapper')).toContainText('$40')
      await svg.locator('g title').filter({ hasText: /^Net remaining$/ }).locator('..').locator('rect').hover()
      await expect(flow.locator('.recharts-tooltip-wrapper')).toContainText(creditOnly ? '$40' : '$540')
      await flowCard.screenshot({ path: `.superpowers/sdd/screenshots/refund-cashflow-${creditOnly ? 'credit-only' : 'mixed'}-${viewport.width}.png` })
      await page.getByRole('tab', { name: 'Plan', exact: true }).click()
      if (viewport.width < 768) {
        // Phone Setup shows the net credit and the purchases / refunds split inline on the category row.
        const row = page.getByTestId('budget-setup-mobile').locator('span.flex-1.min-w-0').filter({ hasText: /^Shopping/ })
        await expect(row).toContainText('$40.00 net credit')
        await expect(row).toContainText('$60.00 purchases · $100.00 refunds & payments')
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      } else {
        await page.getByRole('tab', { name: 'Plan', exact: true }).click()
        const shoppingInput = page.locator('input[value="Shopping"]')
        const category = shoppingInput.locator('xpath=../..')
        await expect(category).toContainText('$40.00 net credit')
        const disclosure = category.locator('summary')
        await disclosure.scrollIntoViewIfNeeded()
        await disclosure.focus()
        await disclosure.press('Enter')
        await expect(category.locator('details')).toHaveAttribute('open', '')
        await expect(category.locator('details p')).toHaveText('$60.00 purchases · $100.00 refunds & payments')
        await expect.poll(() => category.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        const disclosureBounds = await category.locator('details, details p, summary').evaluateAll(elements => elements.filter(el => {
          const bounds = el.getBoundingClientRect()
          return el.scrollWidth > el.clientWidth + 1 || bounds.left < -0.5 || bounds.right > innerWidth + 0.5
        }).map(el => ({ tag: el.tagName, text: el.textContent })))
        expect(disclosureBounds).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await disclosure.blur()
        const categoryGroup = shoppingInput.locator('xpath=ancestor::div[contains(@class,"break-inside-avoid")][1]')
        await expect.poll(() => categoryGroup.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        await categoryGroup.screenshot({ path: `.superpowers/sdd/screenshots/refund-category-${creditOnly ? 'credit-only' : 'mixed'}-${viewport.width}.png` })
      }
    }
  })
}

test('manual split payment saves signed amounts and stays editable after disabling and backup restore', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Transaction', exact: true }).first().click()
  const panel = page.getByTestId('sheet-panel')
  await panel.getByRole('button', { name: 'Refunds & Payments', exact: true }).click()
  await panel.getByLabel('Amount', { exact: true }).fill('100')
  await choose(page, 'Category', 'Groceries')
  await panel.getByLabel('Description (Optional)', { exact: true }).fill('Manual receipt')
  await panel.getByLabel('Split across categories').check()
  await choose(page, 'Slice category', 'Dining')
  await panel.getByLabel('Slice amount', { exact: true }).fill('30')
  await panel.getByLabel('Amount', { exact: true }).focus()
  await expect(panel).toContainText('Reduces Dining spending by $30.00')
  await expect(panel).toContainText('Reduces Groceries spending by $70.00')
  await panel.getByLabel('Amount', { exact: true }).blur()
  await panel.evaluate(el => {
    el.scrollTop = 0
    const scroller = el.closest('.fixed.overflow-y-auto')
    if (scroller) scroller.scrollTop = 0
  })
  await page.screenshot({ path: '.superpowers/sdd/screenshots/refund-form-desktop.png', fullPage: true })
  await panel.getByRole('button', { name: 'Add Transaction', exact: true }).click()
  await expect(panel).toBeHidden()
  const saved = await budget(page)
  const receipt = Object.values(saved.transactions).find(tx => (tx as { description: string }).description === 'Manual receipt')
  expect(receipt).toMatchObject({ type: 'expense', amount: -100, categoryId: 'groceries', splits: [{ categoryId: 'dining', amount: -30 }] })
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Manual receipt', exact: true }).filter({ visible: true }).locator('xpath=ancestor::tr')).toContainText('+$100')
  await page.screenshot({ path: '.superpowers/sdd/screenshots/refund-transactions-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Settings', exact: true }).filter({ visible: true }).click()
  await panel.getByLabel('Refunds & Payments', { exact: true }).uncheck()
  await panel.getByLabel('Refunds & Payments', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '.superpowers/sdd/screenshots/refund-settings-desktop.png', fullPage: true })
  const download = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Export data' }).click()
  const backupPath = await (await download).path()
  await panel.getByLabel('Refunds & Payments', { exact: true }).check()
  const restored = page.waitForEvent('load')
  await panel.locator('input[type=file]').setInputFiles(backupPath!)
  await restored
  await expect.poll(async () => (await budget(page)).refundsAndPaymentsEnabled).toBe(false)
  await page.reload()
  await page.getByRole('button', { name: 'Add Transaction', exact: true }).first().click()
  await expect(panel.getByRole('button', { name: 'Refunds & Payments', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  expect((await budget(page)).transactions).toEqual(saved.transactions)
  await page.getByRole('tab', { name: 'This Month', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true }).locator('xpath=../..')).toContainText('-$40')
  await edit(page, 'Manual receipt')
  await expect(panel.getByRole('button', { name: 'Refunds & Payments', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(panel).toContainText('This saved payment still counts.')
  await expect(panel.getByLabel('Amount', { exact: true })).toHaveValue('100')
  await panel.getByLabel('Amount', { exact: true }).fill('110')
  await panel.getByRole('button', { name: 'Save Changes' }).click()
  const changed = await budget(page)
  expect(Object.keys(changed.transactions)).toEqual(Object.keys(saved.transactions))
  expect(Object.values(changed.transactions).find(tx => (tx as { description: string }).description === 'Manual receipt')).toMatchObject({ amount: -110, splits: [{ amount: -30 }] })
})

test('converts ordinary income on the same ID with unchanged net result', async ({ page }) => {
  const before = await budget(page)
  const panel = await edit(page, 'Ordinary receipt')
  await panel.getByRole('button', { name: 'Refunds & Payments', exact: true }).click()
  await choose(page, 'Category', 'Groceries')
  await panel.getByRole('button', { name: 'Save Changes' }).click()
  await expect(panel).toBeHidden()
  const after = await budget(page)
  expect(Object.keys(after.transactions)).toEqual(Object.keys(before.transactions))
  expect(after.transactions.income).toMatchObject({ id: 'income', amount: -40, type: 'expense', date: before.transactions.income.date })
  const net = (state: typeof before) => Object.values(state.transactions).reduce((sum: number, tx) => {
    const t = tx as { type: string; amount: number; reimbursement?: unknown }
    return sum + (t.type === 'expense' ? -t.amount : t.reimbursement ? 0 : t.amount)
  }, 0)
  expect(net(after)).toBe(net(before))
})

test('shared settlement cancellation preserves the IOU and conversion requires exclusive acknowledgment', async ({ page }) => {
  let panel = await edit(page, 'Alex settlement')
  await panel.getByRole('button', { name: 'Refunds & Payments', exact: true }).click()
  await expect(panel).toContainText('will stop settling that balance')
  await page.keyboard.press('Escape')
  expect((await budget(page)).transactions.settlement.reimbursement).toEqual({ from: 'Alex' })
  panel = await edit(page, 'Alex settlement')
  await panel.getByRole('button', { name: 'Refunds & Payments', exact: true }).click()
  await choose(page, 'Category', 'Groceries')
  await panel.getByRole('button', { name: 'Save Changes' }).click()
  await expect(panel.getByRole('alert')).toContainText('Confirm')
  await panel.getByLabel('Use this payment to reduce expenses instead of settling the shared bill.').check()
  await panel.getByRole('button', { name: 'Save Changes' }).click()
  await expect(panel).toBeHidden()
  const after = await budget(page)
  expect(after.transactions.settlement).toMatchObject({ id: 'settlement', type: 'expense', amount: -40 })
  expect(after.transactions.settlement.reimbursement).toBeUndefined()
  expect(after.transactions.purchase.shared.totalAmount - after.transactions.purchase.amount).toBe(40)
  await page.getByRole('tab', { name: 'This Month', exact: true }).click()
  const owed = page.getByRole('heading', { name: 'Owed to Me', exact: true }).locator('xpath=../..')
  await expect(owed).toContainText('Alex')
  await expect(owed).toContainText('$40')
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true }).locator('xpath=../..')).toContainText('$20')
  await expect(page.getByRole('heading', { name: 'Income', exact: true }).locator('xpath=../..')).toContainText('$40')
})

test('import treatment and undo preserve the original bank identity through reimport', async ({ page }) => {
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
  const date = new Date().toISOString().slice(0, 7) + '-04'
  const file = { name: 'receipt.csv', mimeType: 'text/csv', buffer: Buffer.from(`${date},Bank refund,,40.00,1234********5678`) }
  await page.locator('input[type=file]').setInputFiles(file)
  await choose(page, 'Treatment for Bank refund', 'Income')
  await choose(page, 'Treatment for Bank refund', 'Refunds & Payments')
  await choose(page, 'Category for Bank refund', 'Groceries')
  const original = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('ledger-triage')!).state.importRecords)[0])
  expect(original).toMatchObject({ original: { description: 'Bank refund', type: 'expense', amount: -40, date,
    bankSource: { key: 'cibc:1234:5678' }, originalRowData: { '2': '', '3': '40.00', '4': '1234********5678' },
  } })
  await page.getByRole('button', { name: 'Approve Bank refund', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Treatment for Bank refund' })).toContainText('Refunds & Payments')
  expect(Object.keys((await budget(page)).transactions)).toHaveLength(3)
  await page.getByRole('button', { name: 'Approve Bank refund', exact: true }).click()
  const after = await budget(page)
  const receipt = Object.values(after.transactions).find(tx => (tx as { description: string }).description === 'Bank refund')
  expect(receipt).toMatchObject({ type: 'expense', amount: -40, categoryId: 'groceries' })
  await page.reload()
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByRole('status').filter({ hasText: 'previously handled' })).toContainText('1 previously handled transaction skipped')
  expect(Object.keys((await budget(page)).transactions)).toEqual(Object.keys(after.transactions))
  expect(await page.evaluate(() => (Object.values(JSON.parse(localStorage.getItem('ledger-triage')!).state.importRecords)[0] as { original: unknown }).original)).toEqual((original as { original: unknown }).original)
})
