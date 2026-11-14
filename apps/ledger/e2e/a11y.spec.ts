import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedApp } from './seed'

const DISCLAIMER_ACK_KEY = 'ledger-disclaimer-ack'
const BUDGET_KEY = 'ledger-budget'

// A small set of transactions with varied fields (categorized, tagged,
// neither) so the axe scan exercises the real populated transaction table
// instead of the EmptyState that renders when txList.length === 0.
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
})

const routes = [
  ['dashboard', ''],
  ['budgeting', '#/budget'],
  ['investments', '#/investments'],
  ['planner', '#/planner'],
  ['compensation', '#/compensation'],
] as const

for (const [name, hash] of routes) {
  test(`${name} has no serious or critical accessibility violations`, async ({ page }) => {
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

// Every theme, not just the default. The contrast helpers in e2e/contrast.ts
// measure borders, and a composited text helper measures text against the
// element's own background, which is right for text on an opaque surface and
// wrong for `bg-accent/10`: a translucent fill layered over a card. Neither
// can see that pattern, and the 2026-08-28 audit found it failing on all
// eight routes in the geometric theme. Only axe catches it, and only when
// axe is actually pointed at each theme.
const THEMES = ['light', 'dark'] as const

const THEME_ROUTES = [
  ['dashboard', ''],
  ['budget', '#/budget'],
  ['investments', '#/investments'],
  ['salary-tax', '#/planner/salary-tax'],
  ['mortgage', '#/planner/mortgage'],
  ['forecaster', '#/planner/forecaster'],
  ['compensation', '#/compensation'],
  ['planner', '#/planner'],
] as const

// Scans one route with axe and returns one formatted string per offending
// node (not per rule), matching the accounting used below: a single rule
// broken by several elements is several distinct defects, and collapsing
// them to v.nodes[0] previously hid a whole family of bg-accent/text-accent
// failures behind one kbd line.
async function collectBlockingViolations(page: Page, name: string, hash: string): Promise<string[]> {
  await page.goto(`/${hash}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  // The aurora and glass themes render continuously animating, blurred
  // background blobs (ThemeBackground.tsx's animate-float-1/2, 18s and 22s
  // infinite alternate). axe measures color contrast against the composited
  // background, so a translucent card over a moving blob has a different
  // effective background from one instant to the next, and the page settles
  // on an unpredictable frame under parallel worker load. That produced a
  // real intermittent failure (compensation: color-contrast in aurora) that
  // does not reproduce in isolation. Freezing animation here makes the
  // composite the same every run, in every theme, without touching the
  // reduced-motion behavior the app ships to real users.
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  })
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const found: string[] = []
  for (const v of results.violations) {
    if (v.impact !== 'serious' && v.impact !== 'critical') continue
    for (const node of v.nodes) {
      found.push(`${name}: ${v.id} (${v.impact}) - ${node.target?.[0] ?? ''}`)
    }
  }
  return found
}

for (const theme of THEMES) {
  test(`no serious or critical accessibility violations in the ${theme} theme`, async ({ page }) => {
    // Eight routes means eight navigations plus axe passes in one test.
    // The default 30s budget is enough for that in isolation, but under
    // verify's parallel workers (five projects, eight workers) the same
    // test twice hit the 30s wall on the glass theme with no assertion
    // failure at all, just contention. Give it real headroom without
    // letting it run long enough to mask an actual hang.
    test.setTimeout(75_000)
    // Without seeding, several routes render an empty state instead of the
    // populated UI (e.g. Investments defaults to an empty journal tab, not
    // the portfolio tab), so an unseeded scan misses the surfaces the
    // defects actually live on. seedApp matches what desktop-guards.spec.ts
    // already does for the same reason.
    await seedApp(page)
    await page.addInitScript((t) => {
      window.localStorage.setItem('financial-dashboard-theme', JSON.stringify({ state: { preference: t }, version: 2 }))
    }, theme)

    const found: string[] = []
    for (const [name, hash] of THEME_ROUTES) {
      found.push(...(await collectBlockingViolations(page, name, hash)))
    }
    expect(found).toEqual([])
  })
}

// The 9 registry ids from src/components/planner/toolRegistry.tsx that
// THEME_ROUTES above does not already reach (forecaster, salary-tax, and
// mortgage are covered there). Read straight from the registry rather than
// guessed, since the registry is the single source of truth the /planner/:toolId
// route itself reads from.
const UNCOVERED_PLANNER_TOOL_IDS = [
  'compound-interest',
  'savings-goal',
  'emergency-fund',
  'currency-converter',
  'raise-inflation',
  'debt-payoff',
  'rent-vs-buy',
  'inflation-adjuster',
  'rate-converter',
] as const

// Built from THEME_ROUTES plus the ids above rather than a second literal
// list of the eight core routes, so the two route lists cannot drift apart.
const WIDE_ROUTES = [
  ...THEME_ROUTES,
  ...UNCOVERED_PLANNER_TOOL_IDS.map((id) => [id, `#/planner/${id}`] as const),
]

// Scanning both themes across all planner tools would double this suite's
// e2e time. The contrast family is a theme token problem, and the light
// theme's tinted fills over white cards are where it has always shown up, so
// only light gets the wide sweep.
test('every planner tool has no serious or critical accessibility violations in the light theme', async ({ page }) => {
  // 17 routes means 17 full navigations plus axe passes in one test, more
  // than double the 8-route theme tests above. The default 30s budget is
  // fine for one of those in isolation but flakes under the same worker
  // contention the rest of this file already runs with, so this test alone
  // gets a larger, fixed budget rather than raising it file-wide.
  test.setTimeout(90_000)
  await seedApp(page)
  await page.addInitScript((t) => {
    window.localStorage.setItem('financial-dashboard-theme', JSON.stringify({ state: { preference: t }, version: 2 }))
  }, 'light')

  const found: string[] = []
  for (const [name, hash] of WIDE_ROUTES) {
    found.push(...(await collectBlockingViolations(page, name, hash)))
  }
  expect(found).toEqual([])
})


// Heading level is the outline a screen reader user navigates a page by, so
// a jump from h1 straight to h3 makes that outline lie about the page's
// structure. This is a different kind of check from the axe scans above (it
// is not a rule axe itself flags), so it gets its own goto rather than going
// through collectBlockingViolations.
for (const [name, hash] of [['investments', '#/investments'], ['compensation', '#/compensation']] as const) {
  test(`${name} has no heading-level skip`, async ({ page }) => {
    // Both pages only render the heading in question once populated:
    // Investments opens on an empty Plan vs Actual tab with no holdings, and
    // Compensation shows a placeholder instead of "Total Compensation" with
    // no package saved. Unseeded, this test would pass for the wrong reason.
    await seedApp(page)
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
    const skips = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter((h) => !h.closest('.sr-only') && h.getBoundingClientRect().height > 0)
        .map((h) => ({ lvl: Number(h.tagName[1]), text: (h.textContent || '').trim().slice(0, 30) }))
      const out: string[] = []
      let prev = 0
      for (const h of hs) {
        if (prev && h.lvl > prev + 1) out.push(`h${prev} to h${h.lvl} at "${h.text}"`)
        prev = h.lvl
      }
      return out
    })
    expect(skips).toEqual([])
  })
}
