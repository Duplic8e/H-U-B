import { test, expect } from '@playwright/test'
import { seedApp } from './seed'

const DISCLAIMER_ACK_KEY = 'ledger-disclaimer-ack'
const BUDGET_KEY = 'ledger-budget'

test('Refunds & Payments phone entry, cards, import review and Settings stay usable', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const date = new Date().toISOString().slice(0, 7) + '-04'
    localStorage.setItem('ledger-budget', JSON.stringify({ version: 5, state: {
      refundsAndPaymentsEnabled: true,
      categoryGroups: { food: { id: 'food', name: 'Food', kind: 'expense' } },
      categories: { groceries: { id: 'groceries', groupId: 'food', name: 'Household groceries and pantry supplies', targetAmount: 100 } },
      transactions: { receipt: { id: 'receipt', date, amount: -100, description: 'Phone receipt', categoryId: 'groceries', type: 'expense' } },
    } }))
  })
  await page.goto('/#/budget')
  const originalViewport = page.viewportSize()!
  const viewports = originalViewport.height < 500 ? [originalViewport] : [{ width: 320, height: 700 }, { width: 375, height: 812 }]
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.getByRole('tab', { name: 'Transactions', exact: true }).click()
    const card = page.getByRole('button', { name: 'Edit Phone receipt', exact: true }).filter({ visible: true })
    await expect(card).toContainText('+$100')
    const cardContainer = page.getByTestId('transaction-card-receipt')
    await expect(cardContainer).toContainText('Refunds & Payments')
    await expect.poll(() => cardContainer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `.superpowers/sdd/screenshots/refund-card-${testInfo.project.name}-${viewport.width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Add Transaction', exact: true }).first().click()
    const panel = page.locator('[data-testid="sheet-panel"][data-state="open"]')
    for (const name of ['Expense', 'Income', 'Refunds & Payments']) {
      const choice = panel.getByRole('button', { name, exact: true })
      expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(43.9)
    }
    const payment = panel.getByRole('button', { name: 'Refunds & Payments', exact: true })
    await payment.focus()
    await payment.press('Enter')
    await expect(payment).toBeFocused()
    await expect(payment).toHaveAttribute('aria-pressed', 'true')
    await panel.getByLabel('Amount', { exact: true }).fill('40')
    await panel.evaluate(el => { el.scrollTop = 0 })
    await page.screenshot({ path: `.superpowers/sdd/screenshots/refund-form-${testInfo.project.name}-${viewport.width}.png`, fullPage: true })
    await panel.getByRole('button', { name: 'Split', exact: true }).click()
    await panel.getByLabel('Split across categories').check()
    await panel.getByLabel('Slice amount', { exact: true }).fill('20')
    await panel.getByRole('button', { name: 'Slice category', exact: true }).click()
    await page.getByRole('option', { name: 'Household groceries and pantry supplies', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Select an option', exact: true })).toBeHidden()
    await expect(panel.getByText('Reduces Household groceries and pantry supplies spending by $40.00', { exact: true })).toHaveCount(1)
    await expect(panel.getByText('Reduces Household groceries and pantry supplies spending by $20.00', { exact: true })).toHaveCount(0)
    await expect.poll(() => panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await panel.getByLabel('Slice amount', { exact: true }).scrollIntoViewIfNeeded()
    for (const name of ['Add a Slice', 'Remove slice']) {
      const box = (await panel.getByRole('button', { name, exact: true }).boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: `.superpowers/sdd/screenshots/refund-split-${testInfo.project.name}-${viewport.width}.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await page.getByTestId('mobile-topbar').getByRole('button', { name: 'Settings', exact: true }).tap()
    const toggle = panel.getByLabel('Refunds & Payments', { exact: true })
    await panel.getByText('Transactions', { exact: true }).click()
    await toggle.focus()
    await toggle.press('Space')
    await expect(toggle).not.toBeChecked()
    await expect.poll(() => panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `.superpowers/sdd/screenshots/refund-settings-${testInfo.project.name}-${viewport.width}.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Add Transaction', exact: true }).first().click()
    await expect(panel.getByRole('button', { name: 'Refunds & Payments', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await card.click()
    await expect(panel).toContainText('This saved payment still counts.')
    await page.keyboard.press('Escape')
    await page.getByTestId('mobile-topbar').getByRole('button', { name: 'Settings', exact: true }).click()
    await panel.getByText('Transactions', { exact: true }).click()
    await toggle.check()
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  const date = new Date().toISOString().slice(0, 7) + '-05'
  await page.locator('input[type=file][accept=".csv"]').setInputFiles({ name: 'phone.csv', mimeType: 'text/csv', buffer: Buffer.from(`${date},Phone bank receipt,,40.00,1234********5678`) })
  // The phone Triage Inbox keeps rows slim; treatment, category and Approve live in the row's review sheet.
  await page.getByTestId('triage-inbox-mobile').getByText('Phone bank receipt', { exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Review transaction' })
  const treatment = sheet.getByRole('button', { name: 'Treatment for Phone bank receipt', exact: true })
  await treatment.click()
  await page.getByRole('option', { name: 'Refunds & Payments', exact: true }).click()
  await sheet.getByRole('button', { name: 'Category for Phone bank receipt', exact: true }).click()
  await page.getByRole('option', { name: 'Household groceries and pantry supplies', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Select an option', exact: true })).toBeHidden()
  const approve = sheet.getByRole('button', { name: 'Approve', exact: true })
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expect(treatment).toContainText('Refunds & Payments')
    await approve.scrollIntoViewIfNeeded()
    await expect(approve).toBeInViewport()
    expect((await approve.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect.poll(() => sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expect.poll(() => sheet.evaluate(el => {
      const bounds = el.getBoundingClientRect()
      return [...el.querySelectorAll('button')].filter(button => {
        const rect = button.getBoundingClientRect()
        return rect.left < bounds.left - 0.5 || rect.right > bounds.right + 0.5
          || rect.left < -0.5 || rect.right > innerWidth + 0.5
      }).map(button => button.getAttribute('aria-label') || button.textContent?.trim())
    })).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `.superpowers/sdd/screenshots/refund-import-${testInfo.project.name}-${viewport.width}.png`, fullPage: true })
  }
  await page.screenshot({ path: `.superpowers/sdd/screenshots/refund-import-${testInfo.project.name}.png`, fullPage: true })
  await approve.click()
  await expect(sheet).toBeHidden()
})

// Same shape as e2e/a11y-mobile.spec.ts's SEED_TRANSACTIONS, so both suites
// exercise the same populated card list instead of an empty state.
const SEED_TRANSACTIONS: Record<string, unknown> = {
  t1: { id: 't1', date: '2026-08-01', amount: 12.5, description: 'Coffee shop', type: 'expense', categoryId: 'groceries' },
  t2: { id: 't2', date: '2026-08-02', amount: 45, description: 'Gas station', type: 'expense', tags: ['car'] },
  t3: { id: 't3', date: '2026-08-03', amount: 2500, description: 'Paycheck', type: 'income' },
  t4: { id: 't4', date: '2026-08-04', amount: 89.99, description: 'Electric bill', type: 'expense', categoryId: 'utilities', tags: ['home'] },
  t5: { id: 't5', date: '2026-08-05', amount: 15, description: 'Streaming service', type: 'expense' },
  t6: { id: 't6', date: '2026-08-06', amount: 60, description: 'Restaurant', type: 'expense', categoryId: 'dining', note: 'Dinner with friends' },
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString())
  }, DISCLAIMER_ACK_KEY)
  await page.addInitScript(({ key, transactions }) => {
    window.localStorage.setItem(key, JSON.stringify({
      state: { transactions, categories: {}, categoryGroups: {} },
      version: 3,
    }))
  }, { key: BUDGET_KEY, transactions: SEED_TRANSACTIONS })
  await page.addInitScript(() => {
    window.localStorage.setItem('accounts-storage', JSON.stringify({
      state: {
        accounts: [
          { id: 'a1', name: 'EQ Bank High Interest Savings', value: 32150, type: 'bank', currency: 'CAD' },
          { id: 'a2', name: 'Mortgage - 12 Maplewood Crescent', value: 412000, type: 'debt', currency: 'CAD' },
        ],
        history: [],
        pendingCurrencyReviewIds: [],
        currencySupportStartedAt: new Date().toISOString().slice(0, 10),
        pendingEditSnapshotDate: null,
      },
    }))
  })
})

const ROUTES = [
  ['dashboard', ''],
  ['budgeting', '#/budget'],
  ['investments', '#/investments'],
  ['planner', '#/planner'],
  ['mortgage', '#/planner/mortgage'],
  ['compensation', '#/compensation'],
] as const

// iOS Safari zooms the page whenever a focused field computes below 16px,
// and never zooms back out. Every input in the app was 12px to 15px.
for (const [name, hash] of ROUTES) {
  test(`${name} has no input below 16px`, async ({ page }) => {
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll('input, textarea, select')]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          const cs = getComputedStyle(el)
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' &&
            (el as HTMLInputElement).type !== 'checkbox' &&
            (el as HTMLInputElement).type !== 'radio' &&
            parseFloat(cs.fontSize) < 16
        })
        .map((el) => `${el.tagName}[${(el as HTMLInputElement).type || ''}] ${getComputedStyle(el).fontSize}`),
    )
    expect(offenders).toEqual([])
  })
}

// Everything a finger can hit must clear 44x44 on a phone. The audit found
// 10 of 31 controls under that on the dashboard alone, and 21 of 34 on the
// transaction list. Anything that genuinely must stay smaller opts out with
// the .tap-exempt class, and the exemption is visible in this failure list.
// Phone sheets carry no visible X. The only Close button left is the screen reader one, which
// is clipped to a pixel until it takes keyboard focus.
async function expectNoVisibleClose(panel: import('@playwright/test').Locator) {
  await expect
    .poll(() =>
      panel.getByRole('button', { name: 'Close' }).evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          return r.width <= 1 && r.height <= 1
        })
      )
    )
    .not.toContain(false)
}

const TAP_SELECTOR =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="switch"]'

for (const [name, hash] of ROUTES) {
  test(`${name} has no tap target under 44px`, async ({ page }) => {
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    const offenders = await page.evaluate((selector) => {
      const label = (el: Element) =>
        (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
      return [...document.querySelectorAll(selector)]
        .filter((el) => {
          if (el.classList.contains('tap-exempt')) return false
          if (el.closest('.sr-only')) return false
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false
          // The shared Checkbox component keeps a deliberately small (20px)
          // visible box inside a dedicated 44x44 hit-area wrapper <span>, so
          // a checkbox's own tap target is that wrapper, not the input.
          const target = (el as HTMLInputElement).type === 'checkbox' && el.parentElement
            ? el.parentElement
            : el
          const r = target.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return false
          // The skip link is visually hidden until focused.
          if (r.width <= 1 && r.height <= 1) return false
          return r.height < 44 || r.width < 44
        })
        .map((el) => {
          const r = el.getBoundingClientRect()
          return `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`
        })
    }, TAP_SELECTOR)
    expect(offenders).toEqual([])
  })
}

// The transaction list and the customize sheet are the two densest control
// surfaces in the app and neither is on a route's first paint, so they get
// their own pass.
test('the transaction card list has no tap target under 44px', async ({ page }) => {
  await page.goto('/#/budget')
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: 'Transactions' }).click()
  const offenders = await page.evaluate((selector) => {
    return [...document.querySelectorAll(selector)]
      .filter((el) => {
        if (el.classList.contains('tap-exempt')) return false
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none') return false
        // The shared Checkbox component keeps a deliberately small (20px)
        // visible box inside a dedicated 44x44 hit-area wrapper <span>, so a
        // checkbox's own tap target is that wrapper, not the input itself.
        const target = (el as HTMLInputElement).type === 'checkbox' && el.parentElement
          ? el.parentElement
          : el
        const r = target.getBoundingClientRect()
        if (r.width <= 1 || r.height <= 1) return false
        return r.height < 44 || r.width < 44
      })
      .map((el) => {
        const r = el.getBoundingClientRect()
        const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)
        return `${label} ${Math.round(r.width)}x${Math.round(r.height)}`
      })
  }, TAP_SELECTOR)
  expect(offenders).toEqual([])
})

// Truncated account names were the single most visible mobile complaint:
// nine text nodes were cut at 320px on the dashboard alone.
test('no dashboard text is clipped by its own container', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('accounts-storage', JSON.stringify({
      state: {
        accounts: [
          { id: 'a1', name: 'EQ Bank High Interest Savings', value: 32150, type: 'bank', currency: 'CAD' },
          { id: 'a2', name: 'Mortgage - 12 Maplewood Crescent', value: 412000, type: 'debt', currency: 'CAD' },
        ],
        history: [],
        pendingCurrencyReviewIds: [],
        currencySupportStartedAt: new Date().toISOString().slice(0, 10),
        pendingEditSnapshotDate: null,
      },
    }))
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => {
        if (el.children.length > 0) return false
        if (el.closest('.sr-only')) return false
        const cs = getComputedStyle(el)
        if (cs.overflow === 'visible' && cs.overflowX === 'visible') return false
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && el.scrollWidth > el.clientWidth + 1
      })
      .map((el) => `${(el.textContent || '').trim().slice(0, 30)} needs ${el.scrollWidth} has ${el.clientWidth}`),
  )
  expect(clipped).toEqual([])
})

// The audit could not verify this and flagged it as an open question: if a
// series value is only readable from a hover tooltip, it is unreadable on a
// phone. Playwright's iPhone fixture has hasTouch, so page.tap exercises the
// real touch path.
test('a chart reveals its values on tap', async ({ page }) => {
  await page.goto('/#/planner/mortgage')
  await page.waitForLoadState('networkidle')
  const chart = page.locator('.recharts-wrapper').first()
  await expect(chart).toBeVisible()
  // The mortgage chart sits below three stacked result cards on a 375px-wide
  // phone, so it starts outside the viewport. A real thumb would scroll down
  // to it before tapping; page.touchscreen.tap uses raw viewport coordinates
  // and does not scroll on its own, so do it explicitly first.
  await chart.scrollIntoViewIfNeeded()
  const box = (await chart.boundingBox())!
  await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.5)
  await expect(page.locator('.recharts-tooltip-wrapper')).toBeVisible({ timeout: 2000 })
})

// Task 10's desktop guard for this same defect measured a chart label
// against the document viewport, but main's overflow-x-hidden clips a
// label's paint before its un-clipped getBoundingClientRect() ever reaches
// the document edge at desktop widths, so that guard could pass even while
// a label had escaped the app. The escape is real; it just needs a phone
// width to reach the true document edge, and mobile-narrow (320px) and
// mobile-landscape both land in that range.
test('no chart text escapes the document viewport', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ledger-compensation', JSON.stringify({
      state: {
        primaryPackage: {
          id: 'p1', name: 'Current Offer', companyTicker: 'MSFT', companyCurrentPrice: 428.5,
          baseSalary: 165000, pastSalaryChanges: [], cashBonusPercent: 12, cashBonusMonth: 2,
          esppContributionPercent: 10, esppDiscountPercent: 15, esppLockedInPrice: 0,
          rrspMatchPercent: 5, rrspMatchCap: 12000,
          rsuGrants: [{
            id: 'g1', grantName: '2024 Refresh', grantShares: 1200, grantPrice: 310,
            grantStartDate: '2024-03-01',
            vestingSchedule: { preset: '4yr-1yr-cliff', totalVestMonths: 48, cliffMonths: 12, frequency: 'quarterly' },
          }],
        },
        comparePackage: null, compareMode: false, timeMode: 'current-year',
        useCadConversion: false, showAfterTax: false,
      },
      version: 0,
    }))
  })
  await page.goto('/#/compensation')
  await page.waitForLoadState('networkidle')
  // The pie animates in; measure only once it has settled.
  await page.waitForTimeout(1500)
  const escaped = await page.evaluate(() => {
    const w = document.documentElement.clientWidth
    return [...document.querySelectorAll('svg text')]
      .map((t) => ({ txt: t.textContent, r: t.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > w + 1))
      .map(({ txt, r }) => ({ txt, left: Math.round(r.left), right: Math.round(r.right), viewport: w }))
  })
  expect(escaped).toEqual([])
})

// The whole app cleared this at 375px and 320px when the audit ran, and
// exactly one screen did not: the Compensation toggle row. This keeps the
// zero at both widths and in landscape.
for (const [name, hash] of ROUTES) {
  test(`${name} never scrolls sideways`, async ({ page }) => {
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    const { scrollW, clientW, past } = await page.evaluate(() => {
      const de = document.documentElement
      const past = [...document.querySelectorAll('*')]
        .filter((el) => {
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none') return false
          // A phone tab strip scrolls sideways on purpose, so tabs past its
          // right edge are clipped by it. The strip itself is still checked.
          const strip = el.closest('[role="tablist"]')
          if (strip && strip !== el && strip.getBoundingClientRect().right <= de.clientWidth + 1) return false
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.right > de.clientWidth + 1
        })
        .map((el) => `${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)} right=${Math.round(el.getBoundingClientRect().right)}`)
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, past: past.slice(0, 10) }
    })
    expect(past).toEqual([])
    expect(scrollW).toBe(clientW)
  })
}

// The blocker this plan opened with: at 844x390 the sidebar appeared, the
// tab bar vanished, and Settings sat at y=410 in a 390px viewport with
// nothing to scroll. Settings must be tappable at every phone size.
test('settings is reachable and inside the viewport', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const settings = page.locator('[data-testid="mobile-topbar"] button[aria-label="Settings"]')
  await expect(settings).toBeVisible()
  const box = (await settings.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  await settings.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

// The phone Settings sheet is organized: every section is a fold, every action is
// a 44px button, and the Reminders row centres its text and action on each other.
test('the Settings sheet is organized: 44px actions, centred Reminders row, nothing clipped', async ({ page }) => {
  await page.addInitScript(() => {
    // Some engines have no Notification and headless Chromium reports 'denied'; either
    // hides the Enable reminders action, so stand in a not-yet-asked Notification.
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission: () => Promise.resolve('default') },
    })
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Settings"]').click()
  const panel = page.getByTestId('sheet-panel')
  await expect(panel).toBeVisible()
  // Every section is a fold; open them all so each action can be measured.
  await panel.evaluate((el) => el.querySelectorAll('details').forEach((d) => { d.open = true }))
  const row = panel.getByTestId('reminders-row')
  await expect(row).toBeVisible()

  const actions = ['Save Client ID', 'Load demo data', 'Enable reminders', 'Export data', 'Import backup', 'Save']
  for (const name of actions) {
    // Import backup is a label wrapping a file input, not a button, and wraps to two lines
    // at 320px, so measure the label's own box like the others.
    const target =
      name === 'Import backup'
        ? panel.locator('label', { hasText: 'Import backup' })
        : panel.getByRole('button', { name, exact: true })
    await expect(target).toBeVisible()
    const box = (await target.boundingBox())!
    expect(box.height, name + ' height').toBeGreaterThanOrEqual(44)
  }

  // Measure both centres in one frame so the sheet's entrance animation cannot
  // move the row between two separate browser calls.
  const centreDifference = await row.evaluate((el) => {
    const text = el.querySelector('p')!.getBoundingClientRect()
    const action = el.querySelector('button')!.getBoundingClientRect()
    return Math.abs(text.y + text.height / 2 - (action.y + action.height / 2))
  })
  expect(centreDifference).toBeLessThanOrEqual(2)

  const overflow = await panel.evaluate((el) => {
    const p = el.getBoundingClientRect()
    const clipped = [...el.querySelectorAll('details, details button, details input, details p, footer, summary')]
      .filter((n) => {
        const r = n.getBoundingClientRect()
        return r.width > 0 && (r.left < p.left - 0.5 || r.right > p.right + 0.5)
      })
      .map((n) => (n.textContent || n.tagName).trim().slice(0, 30))
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, clipped, doc: document.documentElement.scrollWidth, win: window.innerWidth }
  })
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)
  expect(overflow.doc).toBeLessThanOrEqual(overflow.win)
  expect(overflow.clipped).toEqual([])
})

// Callers keep desktop-only header buttons in the DOM as display:none on a phone. Focus must
// skip them: it enters the sheet on open and Tab and Shift+Tab never leave the panel.
const insidePanel = (page: import('@playwright/test').Page) =>
  page.evaluate(() => !!document.activeElement?.closest('[data-testid="sheet-panel"]'))

for (const [label, open] of [
  ['Settings', async (page: import('@playwright/test').Page) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.locator('[data-testid="mobile-topbar"] button[aria-label="Settings"]').click()
  }],
  ['Add Transaction', async (page: import('@playwright/test').Page) => {
    await seedApp(page)
    await page.goto('/#/budget')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add Transaction' }).first().click()
  }],
] as const) {
  test(`phone focus: ${label} sheet takes focus on open and Tab stays inside it`, async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('sheet-panel')).toBeVisible()
    await expect.poll(() => insidePanel(page)).toBe(true)
    // The hidden Close button must not be what opens focused, or it would flash into view.
    await expect(page.getByTestId('sheet-panel').locator('[data-sheet-hidden-close]')).not.toBeFocused()
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      expect(await insidePanel(page), 'Tab ' + i).toBe(true)
    }
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Shift+Tab')
      expect(await insidePanel(page), 'Shift+Tab ' + i).toBe(true)
    }
  })
}

test('phone sheets give keyboard users a close button that shows on focus only', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Settings"]').click()
  const panel = page.getByTestId('sheet-panel')
  await expect(panel).toBeVisible()
  const close = panel.getByRole('button', { name: 'Close' })
  await expect(close).toHaveCount(1)
  await expectNoVisibleClose(panel)
  await expect.poll(() => insidePanel(page)).toBe(true)
  await expect(close).not.toBeFocused()
  // Shift+Tab from the first control reaches it, since it is the first focusable in the sheet.
  await page.keyboard.press('Shift+Tab')
  await expect(close).toBeFocused()
  await expect.poll(async () => (await close.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect((await close.boundingBox())!.width).toBeGreaterThanOrEqual(44)
  // The app's global :focus-visible rule draws the ring as a 2px outline.
  await expect(close).toHaveCSS('outline-style', 'solid')
  await expect(close).toHaveCSS('outline-width', '2px')
  await page.keyboard.press('Enter')
  await expect(panel).toHaveCount(0)
})

// Phone sheets carry no visible X: they dismiss by swipe, scrim tap and Escape.
test('phone sheets show no visible Close button and still dismiss on Escape and scrim', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const panel = page.getByTestId('sheet-panel')
  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Settings"]').click()
  await expect(panel).toBeVisible()
  await expectNoVisibleClose(panel)
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)

  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Settings"]').click()
  await expect(panel).toBeVisible()
  await page.getByTestId('sheet-scrim').click({ position: { x: 5, y: 5 } })
  await expect(panel).toHaveCount(0)

  await page.goto('/#/planner/mortgage')
  // First visit shows the notice and the bottom button; either opens the same sheet.
  await page.getByRole('button', { name: /Tool Overview/ }).first().click()
  await expect(panel).toBeVisible()
  await expectNoVisibleClose(panel)
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
})

test('search is reachable without a keyboard', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Search"]').click()
  await expect(page.getByPlaceholder('Jump to a page or tool…')).toBeVisible()
})

// The search sheet spends its height on results: no esc hint, no Close button,
// no scrollbar, a bottom fade while more results lie below, and the input stays
// reachable while the list scrolls.
test('the search sheet has no esc hint, visible close button or scrollbar and keeps its input', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Search"]').click()
  const panel = page.getByTestId('sheet-panel')
  const input = page.getByPlaceholder('Jump to a page or tool…')
  await expect(input).toBeVisible()
  await expectNoVisibleClose(panel)
  await expect(panel.getByText('esc', { exact: true })).toHaveCount(0)
  await expect
    .poll(() => panel.evaluate((el) => el.offsetWidth - el.clientWidth))
    .toBe(0)

  // The input sits about 12px under the drag handle (it was 36px).
  const handleToInput = await panel.evaluate((el) =>
    Math.round(el.querySelector('input')!.getBoundingClientRect().top - el.querySelector('span.absolute')!.getBoundingClientRect().bottom))
  test.info().annotations.push({ type: 'palette-handle-to-input-px', description: String(handleToInput) })
  expect(handleToInput).toBeGreaterThanOrEqual(10)
  expect(handleToInput).toBeLessThanOrEqual(14)
  const restingRowTop = await panel.evaluate((el) =>
    Math.round(el.querySelector('input')!.parentElement!.getBoundingClientRect().top - el.getBoundingClientRect().top))

  const cue = page.getByTestId('sheet-scroll-cue')
  await expect(cue).toBeVisible()
  await panel.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await expect(cue).toHaveCount(0)
  await expect(input).toBeInViewport()
  // The row sticks at the offset it rests at, 12px under the panel top (just below the
  // handle), so it does not jump when the list starts to scroll.
  await expect
    .poll(() =>
      panel.evaluate((el) => {
        const row = el.querySelector('input')!.parentElement!
        return Math.round(row.getBoundingClientRect().top - el.getBoundingClientRect().top)
      }))
    .toBe(restingRowTop)

  await input.fill('budget')
  await expect(panel.getByRole('option').first()).toBeVisible()
  expect(await panel.getByRole('option').count()).toBeGreaterThan(0)
  expect(await panel.getByRole('option').count()).toBeLessThan(10)

  await page.getByTestId('sheet-scrim').click({ position: { x: 5, y: 5 } })
  await expect(panel).toBeHidden()
})

// 0.9.7 made the Dashboard's Customize button the same size as other header
// buttons, which left it 5px too narrow for its own label at 320px: it
// rendered a 76px box for an 81px label, hard against the screen edge with
// its right padding eaten.
test('no header button is squeezed below its own label', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const squeezed = await page.evaluate(() =>
    [...document.querySelectorAll('header button, main button')]
      .filter((b) => b.getBoundingClientRect().width > 0)
      .filter((b) => b.scrollWidth > b.clientWidth + 1)
      .map((b) => ({ text: (b.textContent || '').trim(), shown: b.clientWidth, needs: b.scrollWidth })),
  )
  expect(squeezed).toEqual([])
})

// Rule 2 of docs/mobile-layout-rules.md. <main> is the scroll container, so
// nothing reset it between routes and the next page opened partway down.
test('switching tabs starts the new page at the top', async ({ page }) => {
  await seedApp(page)
  await page.goto('/#/budget')
  await page.waitForLoadState('networkidle')
  // While the next route mounts, <main> briefly holds almost no content and
  // the browser clamps scrollTop to 0 by itself, which would make this guard
  // pass with no reset in place. A tall pseudo-element keeps the scroll range
  // alive through that window, so only a real reset can bring it back to 0.
  await page.addStyleTag({ content: 'main::after { content: ""; display: block; height: 3000px; }' })
  await page.evaluate(() => { document.querySelector('main')!.scrollTop = 600 })
  expect(await page.evaluate(() => document.querySelector('main')!.scrollTop)).toBe(600)
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Planner' }).click()
  await expect(page).toHaveURL(/#\/planner$/)
  // The URL changes before the lazy route renders, so poll for the reset.
  await expect.poll(() => page.evaluate(() => document.querySelector('main')!.scrollTop)).toBe(0)
})

// Rule 1 of docs/mobile-layout-rules.md: on a phone the top bar names the
// page, and the page's h1 is still there for screen readers. Tool pages put
// the tool name and a back button there.
const TITLED_ROUTES = [
  ['dashboard', '', 'Dashboard'],
  ['budgeting', '#/budget', 'Budgeting'],
  ['investments', '#/investments', 'Investments'],
  ['planner', '#/planner', 'Planner'],
  ['compensation', '#/compensation', 'Compensation'],
] as const

for (const [name, hash, title] of TITLED_ROUTES) {
  test(`${name} names itself in the top bar`, async ({ page }) => {
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    const bar = page.getByTestId('mobile-topbar')
    await expect(bar.getByTestId('topbar-title')).toHaveText(title)
    await expect(bar.locator('[data-topbar-brand]')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1, name: title })).toHaveCount(1)
  })
}

test('a planner tool names itself in the top bar and frees the first screen', async ({ page }) => {
  await page.goto('/#/planner/mortgage')
  await page.waitForLoadState('networkidle')
  const bar = page.getByTestId('mobile-topbar')
  await expect(bar.locator('[data-topbar-brand]')).toBeHidden()
  const switcher = bar.getByRole('button', { name: /Mortgage/ })
  await expect(switcher).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Mortgage/)

  // The in-page breadcrumb and big title are gone, so the form starts high.
  // The old header put the first field 236px below the bar at 375px wide. The
  // mortgage form opens with two rows of mode toggles of its own (96px). The
  // permanent 44px "Tool Overview" row is gone: the first visit shows a
  // dismissible notice, which is measured separately below, and once it is
  // dismissed the form is 230 minus that row's height or less below the bar.
  await expect(page.getByRole('link', { name: 'Back to Planner' })).toHaveCount(0)
  const barBox = (await bar.boundingBox())!
  const field = page.locator('main input').first()
  await expect(field).toBeVisible()
  const withNotice = Math.round((await field.boundingBox())!.y - (barBox.y + barBox.height))
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0)
  const offset = (await field.boundingBox())!.y - (barBox.y + barBox.height)
  test.info().annotations.push({ type: 'first-field-offset-below-bar', description: `dismissed ${Math.round(offset)}, with notice ${withNotice}` })
  expect(offset).toBeLessThan(190)

  await switcher.click()
  await expect(page.getByRole('menuitem', { name: /Debt/ }).first()).toBeVisible()
  await page.getByTestId('sheet-scrim').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('menuitem').first()).toBeHidden()

  await bar.getByRole('button', { name: 'Back to Planner' }).click()
  await expect(page).toHaveURL(/#\/planner$/)
})

// "Tool Overview" shows once per tool as a dismissible notice, then lives after the
// results: centred, 44px tall, the last interactive element of the page, same sheet.
test('tool overview: first-visit notice, then a centred button after the results', async ({ page }) => {
  await page.goto('/#/planner/mortgage')
  await page.waitForLoadState('networkidle')
  const notice = page.getByText('New Here? Read the Tool Overview')
  await expect(notice).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(notice).toHaveCount(0)
  // The notice's own buttons are gone, so focus must land on the bottom button, not <body>.
  await expect(page.getByRole('button', { name: /Tool Overview/ })).toBeFocused()

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: /Tool Overview/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0)
  await expect(notice).toHaveCount(0)

  // Another tool still shows its own first-visit notice.
  await page.goto('/#/planner/savings-goal')
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible()
  await page.goto('/#/planner/mortgage')

  const bottom = page.getByRole('button', { name: /Tool Overview/ })
  await bottom.scrollIntoViewIfNeeded()
  await expect(bottom).toBeInViewport()
  const box = (await bottom.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  const main = page.locator('main')
  const mainBox = (await main.boundingBox())!
  const viewportCentre = mainBox.x + mainBox.width / 2
  expect(Math.abs(box.x + box.width / 2 - viewportCentre)).toBeLessThanOrEqual(2)
  test.info().annotations.push({ type: 'bottom-button-centre-delta', description: String(Math.round((box.x + box.width / 2 - viewportCentre) * 10) / 10) })

  // Last interactive element inside <main>.
  const isLast = await main.evaluate((el) => {
    const interactive = [...el.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=tab]')]
      .filter((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    const last = interactive[interactive.length - 1]
    return (last?.textContent || '').trim()
  })
  expect(isLast).toBe('Tool Overview')

  await bottom.click()
  const panel = page.getByTestId('sheet-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Mortgage')
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
})

// Opening the info from the first-visit notice and closing it must not drop focus on <main>.
test('tool overview: focus returns to the bottom button after the notice path closes', async ({ page }) => {
  await page.goto('/#/planner/mortgage')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Tool Overview/ }).first().click()
  const panel = page.getByTestId('sheet-panel')
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0)
  const bottom = page.getByRole('button', { name: /Tool Overview/ })
  await expect(bottom).toHaveCount(1)
  await expect(bottom).toBeFocused()
})

// The planner tool switcher sheet spends its height on tools: no Close row, no
// scrollbar, and a bottom fade while more tools lie below.
test('the planner tool sheet has no visible close row or scrollbar and cues more below', async ({ page }) => {
  await page.goto('/#/planner/mortgage')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('mobile-topbar').getByRole('button', { name: /Mortgage/ }).click()
  const panel = page.getByTestId('sheet-panel')
  await expect(panel).toBeVisible()
  await expectNoVisibleClose(panel)

  await expect
    .poll(() => panel.evaluate((el) => el.offsetWidth - el.clientWidth))
    .toBe(0)

  await expect(panel.getByRole('menuitem').first()).toBeVisible()
  // Measure panel and first item in one frame, once the slide-in has settled
  // (the panel's bottom edge reaches the viewport bottom).
  await expect
    .poll(() => panel.evaluate((el) => Math.round(innerHeight - el.getBoundingClientRect().bottom)))
    .toBe(0)
  const offset = await panel.evaluate((el) =>
    Math.round(el.querySelector('[role=menuitem]')!.getBoundingClientRect().top - el.getBoundingClientRect().top))
  test.info().annotations.push({ type: 'first-item-offset-in-sheet', description: String(offset) })
  expect(offset).toBeLessThan(100)

  const cue = page.getByTestId('sheet-scroll-cue')
  await expect(cue).toBeVisible()
  await panel.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await expect(cue).toHaveCount(0)

  await page.getByTestId('sheet-scrim').click({ position: { x: 5, y: 5 } })
  await expect(panel).toBeHidden()
})

// Phone sheet headers are calm: no title row stays pinned while the content scrolls, the
// Settings sheet has no visible title, and the first content sits 24px or more under the
// drag handle (it was 4px).
test('phone sheet headers scroll away and leave room under the handle', async ({ page }) => {
  const gaps: Record<string, number> = {}
  const handleGap = (panel: import('@playwright/test').Locator) =>
    panel.evaluate((el) => {
      const handle = el.querySelector('span.absolute')!.getBoundingClientRect()
      const header = el.querySelector('[data-testid=sheet-header]')!
      // Skip the desktop-only header that stays display:none on a phone.
      const first = [...(header.nextElementSibling as HTMLElement).children].find((c) => c.getBoundingClientRect().height > 0)!
      const firstTop = first.getBoundingClientRect().top
      // A titled sheet's title is the first content under the handle.
      const title = header.querySelector('h2')
      const top = title ? title.getBoundingClientRect().top : firstTop
      return Math.round(top - handle.bottom)
    })

  await page.goto('/#/planner/mortgage')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('mobile-topbar').getByRole('button', { name: /Mortgage/ }).click()
  let panel = page.getByTestId('sheet-panel')
  await expect(panel.getByRole('menuitem').first()).toBeVisible()
  await expect.poll(() => handleGap(panel)).toBeGreaterThanOrEqual(24)
  gaps.toolSwitcher = await handleGap(panel)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  await page.getByRole('button', { name: /Tool Overview/ }).first().click()
  panel = page.getByTestId('sheet-panel')
  await expect(panel).toBeVisible()
  await expect.poll(() => handleGap(panel)).toBeGreaterThanOrEqual(24)
  gaps.aboutTool = await handleGap(panel)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Settings"]').click()
  panel = page.getByTestId('sheet-panel')
  await expect(panel).toBeVisible()
  // With every section open the sheet is taller than the screen, which is what this checks.
  await panel.locator('details').evaluateAll((folds) => folds.forEach((d) => { (d as HTMLDetailsElement).open = true }))
  await expect(panel.getByRole('heading', { name: 'Settings', exact: true })).toBeHidden()
  await expect(panel).toHaveAttribute('aria-label', 'Settings')
  await expect.poll(() => handleGap(panel)).toBeGreaterThanOrEqual(24)
  gaps.settings = await handleGap(panel)
  // Not pinned: after scrolling down, the header has left the top of the panel.
  await panel.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await expect
    .poll(() => panel.evaluate((el) => el.querySelector('[data-testid=sheet-header]')!.getBoundingClientRect().bottom <= el.getBoundingClientRect().top))
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  await page.keyboard.press('?')
  panel = page.getByTestId('sheet-panel')
  await expect(panel.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
  // Titled sheets gained 12px (4 to 16) so the title is clear of the handle.
  await expect.poll(() => handleGap(panel)).toBeGreaterThanOrEqual(16)
  gaps.shortcuts = await handleGap(panel)
  test.info().annotations.push({ type: 'handle-to-first-content-px', description: JSON.stringify(gaps) })
})

// A scrolled phone sheet fades out under its top edge instead of cutting content hard, with
// the drag handle still pinned above the fade.
test('a scrolled phone sheet softens its top edge and keeps the handle pinned', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Settings"]').click()
  const panel = page.getByTestId('sheet-panel')
  await expect(panel).toBeVisible()
  // Open every section so the sheet has something to scroll.
  await panel.locator('details').evaluateAll((folds) => folds.forEach((d) => { (d as HTMLDetailsElement).open = true }))
  await expect(page.getByTestId('sheet-top-fade')).toHaveCount(0)
  await panel.evaluate((el) => { el.scrollTop = 200 })
  const fade = page.getByTestId('sheet-top-fade')
  await expect(fade).toBeVisible()
  await expect
    .poll(() => panel.evaluate((el) => {
      const f = el.querySelector('[data-testid=sheet-top-fade]')!.getBoundingClientRect()
      const h = el.querySelector('span.absolute')!.getBoundingClientRect()
      const p = el.getBoundingClientRect()
      return [Math.round(f.top - p.top), Math.round(f.height), Math.round(h.top - p.top)]
    }))
    .toEqual([1, 24, 9])
  await expect(page.getByTestId('sheet-top-fade')).toHaveCSS('pointer-events', 'none')
})

// The Search and Settings icons sit 24px apart (they were 32px): the 44px hit areas touch
// but never overlap. Checked with a page action present, at the narrowest width.
test('top bar Search and Settings are close together with 44px non-overlapping targets', async ({ page }) => {
  for (const hash of ['/', '/#/budget']) {
    await page.goto(hash)
    await page.waitForLoadState('networkidle')
    const bar = page.getByTestId('mobile-topbar')
    const search = (await bar.getByRole('button', { name: 'Search' }).boundingBox())!
    const settings = (await bar.getByRole('button', { name: 'Settings' }).boundingBox())!
    expect(search.width).toBeGreaterThanOrEqual(44)
    expect(search.height).toBeGreaterThanOrEqual(44)
    expect(settings.width).toBeGreaterThanOrEqual(44)
    expect(settings.height).toBeGreaterThanOrEqual(44)
    expect(settings.x - (search.x + search.width)).toBeGreaterThanOrEqual(-0.5)
    const iconToIcon = settings.x + settings.width / 2 - (search.x + search.width / 2)
    expect(iconToIcon).toBeLessThanOrEqual(46)
    const clipped = await bar.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(clipped).toBe(false)
  }
})

// Rule 3 of docs/mobile-layout-rules.md: each page leads with its one key
// number, and on a portrait phone it is on the first screen without
// scrolling. The bottom 60px are the tab bar and its margin. seedApp is the
// realistic dataset the desktop guards use; its init script runs after this
// file's beforeEach, so its stores win.
const KEY_FIGURE_ROUTES = [
  ['dashboard', ''],
  ['budgeting', '#/budget'],
  ['investments', '#/investments?tab=portfolio'],
  ['compensation', '#/compensation'],
] as const

for (const [name, hash] of KEY_FIGURE_ROUTES) {
  test(`${name} shows its key figure in the first screen`, async ({ page }) => {
    const viewport = page.viewportSize()!
    test.skip(viewport.height < 600, 'Landscape phones are scroll-first; rule 3 is for portrait.')
    await seedApp(page)
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    const figure = page.locator('[data-key-figure]').first()
    await expect(figure).toBeVisible()
    const box = (await figure.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 60)
  })
}

// Rule 4 of docs/mobile-layout-rules.md: on a phone no list scrolls inside
// the page. seedApp's eight income sources and eight expense groups are what
// made the Income and Expenses cards scroll inside the page before.
for (const [name, hash] of [['dashboard', ''], ['budgeting', '#/budget']] as const) {
  test(`${name} has no list that scrolls inside the page`, async ({ page }) => {
    await seedApp(page)
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    // Prove the guard inspects real lists: wait for the cards it polices so
    // an empty or still-loading main cannot pass vacuously.
    if (name === 'budgeting') {
      // The donut legend is capped and the category budgets are the one list, so wait for it.
      await expect(page.getByRole('group', { name: 'Category budgets' })).toBeVisible()
    } else {
      // The account folds start closed, so open them or there are no rows to inspect.
      const folds = page.locator('details[data-widget-id] > summary')
      for (let i = 0; i < await folds.count(); i++) {
        if (!(await folds.nth(i).evaluate((el) => (el.parentElement as HTMLDetailsElement).open))) await folds.nth(i).click()
      }
      await expect(page.locator('[data-testid^="account-row-"]').first()).toBeVisible()
    }
    const nested = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((el) => {
          const cs = getComputedStyle(el)
          return /(auto|scroll)/.test(cs.overflowY) &&
            el.getBoundingClientRect().height > 0 &&
            el.scrollHeight > el.clientHeight + 1
        })
        .map((el) => (el.getAttribute('aria-label') || el.className.toString()).slice(0, 60)),
    )
    expect(nested).toEqual([])
  })
}

// Rule 1 of docs/mobile-layout-rules.md: the secondary controls share one row.
// Stepping back a month adds the Today button, which widens the stepper. The
// row must wrap rather than push Import CSV past the right edge of main,
// where main's overflow-x-hidden would clip it silently.
test('budgeting phone controls stay inside the page after stepping to another month', async ({ page }) => {
  await seedApp(page)
  await page.goto('/#/budget')
  await page.waitForLoadState('networkidle')
  const controls = page.getByTestId('budget-phone-controls')
  await expect(controls).toBeVisible()
  await page.getByRole('button', { name: 'Previous Month' }).click()
  await expect(controls.getByRole('button', { name: 'Today' })).toBeVisible()
  const buttons = controls.getByRole('button')
  await expect.poll(() => buttons.count()).toBeGreaterThanOrEqual(4)
  // Poll until the whole row is inside main's content box: left edge no
  // further left than main's, right edge no further right than main's.
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const main = document.querySelector('main')!.getBoundingClientRect()
        const row = document.querySelector('[data-testid="budget-phone-controls"]')!
        return [...row.querySelectorAll('button')]
          .map((b) => {
            const r = b.getBoundingClientRect()
            return { label: (b.getAttribute('aria-label') || b.textContent || '').trim(), left: r.left, right: r.right }
          })
          .filter((b) => b.left < main.left - 0.5 || b.right > main.right + 0.5)
      })
    })
    .toEqual([])
})

// The controls row is chrome, not content: no card around the stepper and an
// icon-only import button, so the row is one 44px tap-target line tall. The
// visible chrome is small but every button keeps a 44x44 hit area.
test('budgeting phone controls row is compact and keeps 44px tap targets', async ({ page }) => {
  await seedApp(page)
  await page.goto('/#/budget')
  await page.waitForLoadState('networkidle')
  const controls = page.getByTestId('budget-phone-controls')
  await expect(controls).toBeVisible()
  await expect.poll(async () => (await controls.boundingBox())?.height ?? 999).toBeLessThanOrEqual(52)
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="budget-phone-controls"] button')]
          .map((b) => {
            const r = b.getBoundingClientRect()
            return { label: b.getAttribute('aria-label') || b.textContent, w: r.width, h: r.height }
          })
          .filter((b) => b.w < 43.5 || b.h < 43.5),
      ),
    )
    .toEqual([])
})

// Phone tab strips are underline tabs, not four bordered buttons that read as
// actions. They share one row, keep the 44px tap target, and selecting a tab
// must not make the document scroll sideways.
for (const [name, hash, labels, pick] of [
  ['budgeting', '#/budget', ['This Month', 'Transactions', 'Plan'], 'Transactions'],
  ['investments', '#/investments', ['Portfolio', 'Options', 'Trades', 'Plan vs Actual'], 'Trades'],
] as const) {
  test(`${name} tabs are one row of underline tabs`, async ({ page }) => {
    await seedApp(page)
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(labels.length)
    for (const label of labels) {
      await expect(page.getByRole('tab', { name: label })).toBeVisible()
    }
    const boxes = await Promise.all(
      labels.map(async (label) => (await page.getByRole('tab', { name: label }).boundingBox())!),
    )
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(Math.abs(box.y - boxes[0].y)).toBeLessThanOrEqual(1)
    }
    // At 375px the labels fit, so the tabs share the strip with no scrolling
    // and together span its full width.
    await page.setViewportSize({ width: 375, height: 700 })
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const strip = document.querySelector('[role="tablist"]')!
          const r = [...strip.querySelectorAll('[role="tab"]')].map((t) => t.getBoundingClientRect())
          const s = strip.getBoundingClientRect()
          return {
            gapLeft: Math.round(Math.abs(r[0].left - s.left)),
            gapRight: Math.round(Math.abs(s.right - r[r.length - 1].right)),
            scrolls: strip.scrollWidth > strip.clientWidth + 1,
          }
        })
      })
      .toEqual({ gapLeft: 0, gapRight: 0, scrolls: false })
    await page.getByRole('tab', { name: pick }).click()
    await expect(page.getByRole('tab', { name: pick })).toHaveAttribute('aria-selected', 'true')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
  })
}

// Phones hide the page scrollbar; scrolling itself still works.
test('main has no visible scrollbar on a phone', async ({ page }) => {
  await seedApp(page)
  await page.goto('/#/budget')
  await page.waitForLoadState('networkidle')
  await expect
    .poll(() => page.evaluate(() => {
      const m = document.querySelector('main')!
      return { bar: m.offsetWidth - m.clientWidth, scrollable: m.scrollHeight > m.clientHeight }
    }))
    .toEqual({ bar: 0, scrollable: true })
})
