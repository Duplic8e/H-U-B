# Mobile Audit 64 to 100 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take every section of the 2026-08-19 mobile audit (`MOBILE_AUDIT_2026-08-19.md`) from its measured score to 10/10, moving the total from 64/100 to 100/100.

**Architecture:** Three of the ten deductions are reachability bugs where a control exists but cannot be touched on a phone, and they are fixed at their single source each. The two systemic deductions (sub-16px inputs and undersized tap targets) are fixed once in CSS rather than at 67 call sites, because a per-site sweep would miss future code and cannot be enforced. Everything after that is a narrow, measured fix. The plan ends by converting each finding into an executable guard: a Playwright mobile suite that fails the build if overflow, tap-size, or input-zoom regressions ever return, so the score cannot silently decay.

**Tech Stack:** React 19, TypeScript, Vite (rolldown), Tailwind 4, Zustand 5, Vitest 4, Testing Library, Playwright, axe-core. No new dependencies.

## Global Constraints

- **No em dashes anywhere:** source, comments, tests, UI copy, commit messages, this plan's follow-ups. Standing project rule from `CLAUDE.md`.
- `src/store/storageKeys.ts` is append-only. Never edit an existing value.
- No app version series hardcoded into test assertions.
- Every task must pass all gates before its commit: `npx eslint .` (0 problems), `npx tsc -b` (0 errors), `npx vitest run` (all green), and for any task touching layout, DOM structure, or CSS, `npm run e2e`.
- Stage explicit file paths. Never `git add -A`; this checkout carries untracked scratch directories (`.superpowers/`, a stray `C:Usersmisha...` file).
- Commit trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Baseline at plan start:** 1143 tests / 177 files passing, eslint 0, tsc 0, e2e green. Version 0.9.3-beta. The sidebar sync chip removal (deleting `SyncStatusChip` and `syncStatus`) is already applied in the working tree.
- Tailwind 4 is configured entirely in `src/index.css` via `@theme`. There is no `tailwind.config.js`. New variants and utilities go in that file with `@custom-variant` and `@utility`.
- The mobile breakpoint everywhere in this codebase is `md` = 768px. Do not introduce a second, different mobile breakpoint.
- **Every plain CSS media query this plan adds must be written as the exact negation, or exact match, of the `desktop` custom variant** (`(min-width: 768px) and (min-height: 500px)`), never a bare `min-width`/`max-width`. The mobile-side floors (Task 4, Task 6) use `@media (max-width: 767px), (max-height: 499px)`; the desktop-side step-downs (Task 12) use `@media (min-width: 768px) and (min-height: 500px)`. This exists because a landscape phone (e.g. 844x390) is wide enough to pass a bare `min-width: 768px` check while still showing the mobile top/bottom bar under the `desktop` variant's height clause, and a query that disagreed with `desktop` would silently un-fix whatever Task 4, 6, or 12 fixed, only for landscape.
- **Responsive prefix convention for this plan.** Existing touch-target code uses `sm:` to undo a mobile floor (`min-h-[44px] sm:min-h-0`, see `AccountCategoryWidget.tsx:85`). All code written by this plan uses `desktop:` instead, because Task 6's CSS floor is a `@media (max-width: 767px)` rule and `sm:` is 640px, which would leave a 640 to 767px band where the utility says one thing and the floor says another. Do not retrofit the two existing `sm:` sites; they are harmless (the CSS floor wins on specificity in that band, which is the behaviour we want anyway) and changing them is churn. Just do not add new ones.

## Research Findings This Plan Is Built On

Measured during the audit. Implementers should not re-derive them; the guards added here keep them true.

1. **The sidebar is gated on width only.** `hidden md:flex` at `Layout.tsx:142`. A phone in landscape is 812 to 932px wide, so it gets the desktop sidebar and loses the `md:hidden` bottom bar. The sidebar needs 462px of height, does not scroll, and sits in an `h-dvh overflow-hidden` root, so at 844x390 the Settings button lands at y=410 and is clipped with nothing to scroll. Verified with `elementFromPoint`, which returns the Compensation link at the bottom edge.
2. **`CompHeroWidget.tsx:177` nests a non-wrapping flex row inside a wrapping one.** The outer `flex justify-between items-center mb-4 flex-wrap gap-4` wraps; the inner `flex items-center gap-3` holding three toggle groups does not. It measures 430px, so at 375px the Gross/After-Tax group spans x=348 to x=458, entirely past the edge, clipped by `main`'s `overflow-x-hidden`. This is the only horizontal overflow in the app.
3. **`setPaletteOpen(true)` has exactly two callers:** the `Cmd/Ctrl+K` handler at `Layout.tsx:53` and the sidebar Search button at `Layout.tsx:163`, which is inside the desktop-only `<nav>`. There is no mobile entry point for search. The `?` shortcuts modal is unreachable the same way.
4. **Every text input in the app renders below 16px on mobile,** which makes iOS Safari zoom the page on focus. Measured: Add Transaction 14px, mortgage fields 15px, Settings API key 14px, Drive client ID 13px, transaction search 13px, Compensation manual price 12px. There is no global input font rule in `src/index.css`.
5. **All nine `<input type="checkbox">` render at the browser default 13x13.** None carries a sizing class; only two carry `accent-[var(--color-accent)]`. Sites: `TransactionListWidget.tsx:279,308,400`, `TransactionModal.tsx:210,258,298`, `CustomizeDashboard.tsx:39`, `DriveSyncControls.tsx:204`, `SettingsSheet.tsx:69`.
6. **The repo already has a tap-target idiom:** `AccountCategoryWidget.tsx:85` uses `p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0`. It was applied to two buttons and never generalised. 67 other sites use `px-3 py-1.5`, `px-2.5 py-1` or `px-2 py-1` and land between 18px and 37px tall.
7. **Charts are already responsive in width and never overflow;** only their heights are fixed (`h-[400px]` at `CompHeroWidget.tsx:228` and two others, `h-[300px]` at five sites). Whether Recharts tooltips open on touch could not be verified in the audit environment and is still an open question.
8. **`index.html` has no `<meta name="theme-color">` and no `apple-touch-icon`.** The manifest hardcodes `theme_color: '#000000'` while the app ships a light theme. `data-theme` is applied in one place, `App.tsx:24`.
9. **Toasts ignore the safe area.** `UpdateToast.tsx:12` sits at `bottom-16` (64px) while the bottom bar occupies 52px plus `env(safe-area-inset-bottom)`, which is 86px on a home-indicator iPhone. `UndoToast.tsx:17` at `bottom-24` (96px) clears it by only 10px.
10. **The smallest type tiers are tractable:** only 8 uses of `text-[10px]` and 47 of `text-[11px]` in non-test source.
11. **`e2e/a11y-mobile.spec.ts` already exists** and scans five routes with `devices['Pixel 5']` plus axe. It is the natural home for new mobile guards, and its seeding pattern (`page.addInitScript` writing zustand persist payloads) is the pattern to copy.
12. **`src/test-utils/matchMedia.ts` exports `installMatchMedia`, `setMatchMedia(boolean)` and `resetMatchMedia`.** jsdom tests simulate mobile with `setMatchMedia(false)`. It is a single global boolean, not per-query, so a test cannot distinguish two different media queries. Any new hook that needs independent control in tests must not rely on a second `matchMedia` query alone.

## File Structure

**New files**

- `src/components/ui/Checkbox.tsx`: the one checkbox in the app. Renders a 20px box inside a 44px mobile hit area, forwards `checked`, `onChange`, `aria-label` and `disabled`.
- `src/components/ui/Checkbox.test.tsx`: unit tests for the above.
- `src/hooks/useViewportHeight.ts`: publishes the visual viewport height to a CSS custom property so sheets shrink when the software keyboard opens.
- `src/hooks/useViewportHeight.test.ts`: unit tests for the above.
- `e2e/mobile-guards.spec.ts`: the permanent regression suite. Overflow, tap-size, input font-size and landscape-reachability checks across every route at 320px, 375px and landscape.
- `scripts/check-type-scale.mjs`: fails the build if `text-[10px]` or `text-[11px]` reappear in source after Task 12 replaces them.

**Modified files**

- `src/components/Layout.tsx`: `desktop` variant on the chrome, new mobile top bar, bottom bar drops to five tabs, sidebar scrolls.
- `src/hooks/useMediaQuery.ts`: `useIsDesktop` gains the height clause so it agrees with the CSS.
- `src/index.css`: `@custom-variant desktop`, mobile input font-size floor, mobile tap-target floor, `text-micro` and `text-meta` utilities, `overscroll-behavior`.
- `src/components/compensation/CompHeroWidget.tsx`: wrap the toggle row, responsive chart height.
- `src/components/ui/Sheet.tsx`: 44px close button, keyboard-aware max height.
- `src/components/dashboard/AccountCategoryWidget.tsx`: account rows stack name over value on mobile.
- `src/components/ui/UpdateToast.tsx`, `src/components/ui/UndoToast.tsx`: safe-area offsets.
- `src/App.tsx`: sync `<meta name="theme-color">` to the active theme.
- `index.html`: `theme-color` and `apple-touch-icon` tags.
- `vite.config.ts`: manifest `theme_color`.
- The nine checkbox call sites listed in Finding 5.
- The eight `text-[10px]` and 47 `text-[11px]` call sites from Finding 10.
- `MOBILE_AUDIT_2026-08-19.md`: rescored at the end.

---

## Task 1: Phone landscape keeps the mobile chrome

Fixes blocker B1. Audit section 1 (Navigation) and section 10 (Platform).

**Files:**
- Modify: `src/index.css` (add `@custom-variant desktop` after the `@theme` block)
- Modify: `src/hooks/useMediaQuery.ts:24`
- Modify: `src/components/Layout.tsx:142` and `:253`
- Test: `src/components/Layout.test.tsx`, `src/hooks/useMediaQuery.test.ts` (create if absent)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `useIsDesktop(): boolean` now means "wide AND tall enough for the sidebar". The `desktop:` Tailwind variant becomes available to every later task and means exactly the same thing. Tasks 3 and 9 rely on both.

**Why a height clause and not just `overflow-y-auto`:** making the sidebar scroll restores reachability but leaves a phone in landscape with a 256px sidebar eating 31% of the width and a 390px-tall scrolling column. Gating on height gives landscape phones the bottom bar they should have had, and the scroll is added as well so any short-and-wide desktop window stays usable.

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/useMediaQuery.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsDesktop } from './useMediaQuery'

afterEach(() => vi.unstubAllGlobals())

/** Per-query matchMedia, unlike the global boolean in test-utils/matchMedia. */
function stubMatchMedia(matcher: (query: string) => boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matcher(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

describe('useIsDesktop', () => {
  it('requires height as well as width, so a landscape phone is not desktop', () => {
    // 844x390: wide enough for the old width-only check, too short for the sidebar.
    stubMatchMedia((q) => q.includes('min-width: 768px') && !q.includes('min-height'))
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)
  })

  it('is desktop when the viewport is both wide and tall', () => {
    stubMatchMedia(() => true)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/hooks/useMediaQuery.test.ts`
Expected: FAIL. The first case asserts `false` but the current single-query hook returns `true`, because the stub matches `(min-width: 768px)`.

- [ ] **Step 3: Add the `desktop` variant to CSS**

In `src/index.css`, immediately after the closing `}` of the `@theme { ... }` block (currently around line 30), add:

```css
/* Desktop chrome needs width for the 256px sidebar and height for its
   nav list plus settings dock, which together need 462px. A phone in
   landscape clears the width test and fails the height test, so it keeps
   the mobile top bar and bottom tab bar instead of losing Settings off
   the bottom of a sidebar that cannot scroll into view. Kept in sync by
   hand with useIsDesktop in src/hooks/useMediaQuery.ts. */
@custom-variant desktop (@media (min-width: 768px) and (min-height: 500px));
```

- [ ] **Step 4: Update the hook**

In `src/hooks/useMediaQuery.ts`, replace the last line:

```ts
export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 768px)')
```

with:

```ts
/** Must stay identical to the `desktop` custom variant in src/index.css.
 *  Height matters because the sidebar cannot scroll into a short viewport. */
export const DESKTOP_QUERY = '(min-width: 768px) and (min-height: 500px)'

export const useIsDesktop = (): boolean => useMediaQuery(DESKTOP_QUERY)
```

- [ ] **Step 5: Run the hook test to verify it passes**

Run: `npx vitest run src/hooks/useMediaQuery.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Write the failing Layout test**

Append to `src/components/Layout.test.tsx`:

```tsx
describe('Layout landscape chrome', () => {
  it('gates the sidebar on the desktop variant, not on width alone', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const sidebar = container.querySelector('nav.desktop\\:flex')
    expect(sidebar).not.toBeNull()
    // The width-only gate must be gone, or a landscape phone loses Settings.
    expect(container.querySelector('nav.md\\:flex')).toBeNull()
  })

  it('lets the sidebar scroll so its settings dock is reachable in a short window', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const sidebar = container.querySelector('nav.desktop\\:flex')!
    expect(sidebar.className).toMatch(/overflow-y-auto/)
  })

  it('gates the bottom tab bar on the desktop variant', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    expect(container.querySelector('nav.desktop\\:hidden')).not.toBeNull()
    expect(container.querySelector('nav.md\\:hidden')).toBeNull()
  })
})
```

- [ ] **Step 7: Run it to make sure it fails**

Run: `npx vitest run src/components/Layout.test.tsx`
Expected: FAIL on the first case, "expected null not to be null", because the sidebar still uses `md:flex`.

- [ ] **Step 8: Update Layout's chrome**

In `src/components/Layout.tsx:142`, change the sidebar's class from:

```
"hidden md:flex w-64 relative border-r border-transparent bg-bg-secondary/70 backdrop-blur-[var(--card-blur)] flex-col justify-between transition-all duration-300 z-10"
```

to:

```
"hidden desktop:flex w-64 shrink-0 relative border-r border-transparent bg-bg-secondary/70 backdrop-blur-[var(--card-blur)] flex-col justify-between overflow-y-auto transition-all duration-300 z-10"
```

In `src/components/Layout.tsx:253`, change the bottom bar's class from `"md:hidden fixed bottom-0 ..."` to `"desktop:hidden fixed bottom-0 ..."`.

In the same file, find the `<main>` element and change its bottom padding from `pb-[calc(52px+env(safe-area-inset-bottom)+16px)] md:pb-8` to `pb-[calc(52px+env(safe-area-inset-bottom)+16px)] desktop:pb-8`, so the reserved space follows the bar that is actually rendered.

- [ ] **Step 9: Run the Layout tests to verify they pass**

Run: `npx vitest run src/components/Layout.test.tsx`
Expected: PASS. Existing cases that query `nav.md\\:flex` will now fail; update those selectors to `nav.desktop\\:flex` in the same edit. Do not delete assertions, only retarget the selector.

- [ ] **Step 10: Run the full suite and the other gates**

Run: `npx vitest run`
Expected: 1143+ passing, 0 failing.
Run: `npx eslint .` then `npx tsc -b`
Expected: no output from either.

- [ ] **Step 11: Commit**

```bash
git add src/index.css src/hooks/useMediaQuery.ts src/hooks/useMediaQuery.test.ts src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "fix(mobile): keep phone chrome in landscape so Settings stays reachable

The sidebar was gated on width alone, so a landscape phone got the
desktop sidebar, lost the bottom tab bar, and had its Settings button
clipped off the bottom of a column that cannot scroll. The desktop
variant now requires height too, and the sidebar scrolls.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Compensation toggle row wraps

Fixes blocker B2. Audit section 2 (Layout and viewport fit).

**Files:**
- Modify: `src/components/compensation/CompHeroWidget.tsx:177`
- Test: `src/components/compensation/CompHeroWidget.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the failing test**

Append to `src/components/compensation/CompHeroWidget.test.tsx`. The file's existing cases render inside `<MemoryRouter>` and rely on its `beforeEach` store reset, so use the same wrapper.

```tsx
describe('CompHeroWidget mobile layout', () => {
  it('lets the toggle groups wrap so none is pushed off a narrow screen', () => {
    // The three segmented groups share one row that measures 430px. Without
    // wrapping, the Gross/After-Tax group starts at x=348 on a 375px screen
    // and is clipped by main's overflow-x-hidden, so after-tax comp cannot
    // be turned on at all on a phone.
    render(
      <MemoryRouter>
        <CompHeroWidget />
      </MemoryRouter>,
    )
    const group = screen.getByText('After-Tax').closest('div')!.parentElement!
    expect(group.className).toMatch(/flex-wrap/)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: FAIL, "expected 'flex items-center gap-3' to match /flex-wrap/".

- [ ] **Step 3: Make the inner row wrap**

In `src/components/compensation/CompHeroWidget.tsx:177`, change:

```tsx
        <div className="flex items-center gap-3">
```

to:

```tsx
        {/* Three segmented groups totalling 430px. Without flex-wrap the
            Gross/After-Tax group starts past the right edge of a 375px
            screen and is clipped by main's overflow-x-hidden, which made
            the after-tax view unreachable on a phone. */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/compensation/CompHeroWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run gates**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b`
Expected: all green, no output from lint or tsc.

- [ ] **Step 6: Commit**

```bash
git add src/components/compensation/CompHeroWidget.tsx src/components/compensation/CompHeroWidget.test.tsx
git commit -m "fix(compensation): wrap the toggle row so After-Tax is reachable on mobile

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Mobile top bar gives search and settings a home

Fixes blocker B3 and the truncated tab labels. Audit section 1 (Navigation).

**Files:**
- Modify: `src/components/Layout.tsx`
- Test: `src/components/Layout.test.tsx`

**Interfaces:**
- Consumes: the `desktop` variant from Task 1.
- Produces: a `desktop:hidden` header element with `data-testid="mobile-topbar"`. Task 14's e2e guard asserts against that test id.

**Design decision:** Settings moves out of the bottom bar and into the new top bar. That leaves the bottom bar with exactly the five routes at 75px each on a 375px screen, so "Compensation" (68px of text) stops truncating, and it gives search the entry point it never had on mobile.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/Layout.test.tsx`:

```tsx
import { setMatchMedia, resetMatchMedia } from '../test-utils/matchMedia'

describe('Layout mobile top bar', () => {
  afterEach(() => resetMatchMedia())

  it('opens the command palette from a mobile-reachable button', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const topbar = container.querySelector('[data-testid="mobile-topbar"]')!
    expect(topbar).not.toBeNull()
    expect(topbar.className).toMatch(/desktop:hidden/)
    const search = topbar.querySelector('button[aria-label="Search"]') as HTMLButtonElement
    fireEvent.click(search)
    expect(screen.getByPlaceholderText('Jump to a page or tool…')).toBeInTheDocument()
  })

  it('opens settings from the top bar', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const topbar = container.querySelector('[data-testid="mobile-topbar"]')!
    fireEvent.click(topbar.querySelector('button[aria-label="Settings"]') as HTMLButtonElement)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('leaves the bottom bar with exactly the five routes', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const bar = container.querySelector('nav.desktop\\:hidden')!
    expect(bar.querySelectorAll('a').length).toBe(5)
    // Settings lives in the top bar now, so the bar has no buttons at all.
    expect(bar.querySelectorAll('button').length).toBe(0)
  })
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/components/Layout.test.tsx`
Expected: FAIL on the first case, "expected null not to be null", because no top bar exists.

- [ ] **Step 3: Add the top bar**

In `src/components/Layout.tsx`, inside the main content column, immediately above the `{demoActive && (...)}` banner block, insert:

```tsx
        {/* Mobile top bar. The sidebar's brand, search and settings have no
            home on a phone: the command palette had no touch entry point at
            all, and settings was crowding the tab bar into six slots that
            truncated "Compensation". Both live here now, and the bar below
            keeps five roomy tabs. */}
        <header
          data-testid="mobile-topbar"
          className="desktop:hidden shrink-0 flex items-center gap-2 px-4 h-12 border-b border-border bg-bg-secondary/70 backdrop-blur-[var(--card-blur)]"
        >
          <LedgerMark size={20} className="text-accent shrink-0" />
          <span className="text-[17px] font-bold tracking-tighter text-accent font-display">Ledger</span>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="ml-auto flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <Settings className="w-5 h-5" />
          </button>
        </header>
```

- [ ] **Step 4: Remove Settings from the bottom bar**

In `src/components/Layout.tsx`, delete the entire trailing `<button type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" ...>` block inside the `desktop:hidden` `<nav>` (the one containing `<Settings className="w-5 h-5" />` and `<span ...>Settings</span>`). The `navItems.map(...)` above it stays untouched.

Then add `tracking-tight` to the remaining label span so the longest label fits at 320px too. Change:

```tsx
              <span className="max-w-full truncate px-0.5">{item.name}</span>
```

to:

```tsx
              <span className="max-w-full truncate px-0.5 tracking-tight">{item.name}</span>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/Layout.test.tsx`
Expected: PASS. If an existing test asserted a Settings button inside the bottom bar, retarget it to the top bar rather than deleting it.

- [ ] **Step 6: Run gates**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "feat(mobile): add a top bar with search and settings

Search had no touch entry point: the palette opened only from Cmd+K or
the desktop-only sidebar button. Moving settings up here also drops the
tab bar to five slots, so Compensation stops truncating.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Inputs stop triggering iOS zoom

Audit section 4 (Forms and data entry).

**Files:**
- Modify: `src/index.css`
- Test: `e2e/mobile-guards.spec.ts` (created here, extended by Tasks 8 and 14)

**Interfaces:**
- Consumes: nothing.
- Produces: `e2e/mobile-guards.spec.ts` with a `test.use({ ...devices['iPhone 12'] })` block and a `seedDisclaimer` helper. Tasks 8 and 14 append to this file.

**Why CSS and not per-site:** the offending font sizes come from at least six different components with no shared input primitive, and any new form would reintroduce the bug. One media query fixes every current and future input. iOS Safari zooms whenever a focused field computes below 16px; there is no way to opt out without `maximum-scale`, which would break pinch-zoom and is not acceptable.

- [ ] **Step 1: Write the failing e2e guard**

Create `e2e/mobile-guards.spec.ts`:

```ts
import { test, expect, devices } from '@playwright/test'

const DISCLAIMER_ACK_KEY = 'ledger-disclaimer-ack'

test.use({ ...devices['iPhone 12'] })

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, new Date().toISOString())
  }, DISCLAIMER_ACK_KEY)
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx playwright test e2e/mobile-guards.spec.ts`
Expected: FAIL on `mortgage` and `compensation` at least, listing entries such as `INPUT[text] 15px`.

- [ ] **Step 3: Add the mobile input floor**

In `src/index.css`, after the `input[type="date"]::-webkit-calendar-picker-indicator` rule (currently around line 258), add:

```css
/* iOS Safari zooms the page whenever a focused field computes below 16px,
   and it never zooms back out, so the user is left panning a magnified
   layout. Every input in this app was 12px to 15px. The floor is mobile
   only: the desktop sizes are deliberate and unaffected. Checkboxes and
   radios are excluded because their font-size does not drive the control
   size and they are handled by the Checkbox component instead.

   The query is `(max-width: 767px), (max-height: 499px)`, not a plain
   max-width, because it must be the exact negation of the `desktop`
   custom variant in this file (min-width: 768px AND min-height: 500px).
   A landscape phone (e.g. 844x390) fails the height half of `desktop` and
   so renders the mobile top/bottom bar, but a plain `max-width: 767px`
   query would miss it entirely and leave its inputs at their unfloored
   size. Keep this in sync with the tap-target floor below and with the
   `desktop` variant; all three must partition the viewport the same way. */
@media (max-width: 767px), (max-height: 499px) {
  input:not([type='checkbox']):not([type='radio']):not([type='hidden']),
  textarea,
  select {
    font-size: 16px;
  }
}
```

- [ ] **Step 4: Run the guard to verify it passes**

Run: `npx playwright test e2e/mobile-guards.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Check the size bump did not push anything sideways**

Run: `npx playwright test e2e/a11y-mobile.spec.ts`
Expected: PASS, 5 tests. Larger text in fixed-width inputs (`w-28` on the Compensation manual price, `w-40` on the transaction search) is the main risk. If any route now overflows, give those two inputs `w-full sm:w-28` rather than reverting the floor.

- [ ] **Step 6: Run remaining gates**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/index.css e2e/mobile-guards.spec.ts
git commit -m "fix(mobile): floor input font size at 16px so iOS stops zooming

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: One checkbox component, 44px hit area

Audit section 3 (Touch targets) and section 9 (Accessibility, WCAG 2.5.8).

**Files:**
- Create: `src/components/ui/Checkbox.tsx`
- Create: `src/components/ui/Checkbox.test.tsx`
- Modify: `src/components/budget/TransactionListWidget.tsx` (3 sites), `src/components/budget/TransactionModal.tsx` (3 sites), `src/components/dashboard/CustomizeDashboard.tsx` (1 site), `src/components/settings/DriveSyncControls.tsx` (1 site), `src/components/settings/SettingsSheet.tsx` (1 site)

**Interfaces:**
- Consumes: nothing.
- Produces: `Checkbox`, a named export from `src/components/ui/Checkbox.tsx` with this exact signature. Task 8's guard depends on the rendered wrapper carrying the hit area, not the input.

```tsx
interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
  disabled?: boolean
  className?: string
}
```

- [ ] **Step 1: Write the failing component test**

Create `src/components/ui/Checkbox.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('renders an accessible checkbox that reports its checked state', () => {
    render(<Checkbox checked onChange={() => {}} ariaLabel="Select transaction" />)
    const box = screen.getByRole('checkbox', { name: 'Select transaction' })
    expect(box).toBeChecked()
  })

  it('reports the next value, not the event', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} ariaLabel="Split across categories" />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Split across categories' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('wraps the 20px box in a 44px hit area on mobile', () => {
    const { container } = render(<Checkbox checked={false} onChange={() => {}} ariaLabel="Show Net Worth" />)
    const hit = container.querySelector('span')!
    // The browser default is 13x13, well under the WCAG 2.5.8 floor of 24px.
    expect(hit.className).toMatch(/min-h-\[44px\]/)
    expect(hit.className).toMatch(/min-w-\[44px\]/)
    expect(screen.getByRole('checkbox').className).toMatch(/h-5/)
    expect(screen.getByRole('checkbox').className).toMatch(/w-5/)
  })

  it('does not fire when disabled', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} ariaLabel="Sync automatically" disabled />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/ui/Checkbox.test.tsx`
Expected: FAIL, "Failed to resolve import ./Checkbox".

- [ ] **Step 3: Write the component**

Create `src/components/ui/Checkbox.tsx`:

```tsx
import React from 'react'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
  disabled?: boolean
  /** Extra classes for the hit area, not the box. */
  className?: string
}

/** The one checkbox in the app.
 *
 *  A bare <input type="checkbox"> renders at the browser default 13x13,
 *  which is below the WCAG 2.5.8 floor of 24px and far below the 44px
 *  platform guidance. Every one of the nine call sites used the bare
 *  element. The visual box is 20px so it still reads as a checkbox, and
 *  the surrounding span carries a 44px hit area on mobile only, so
 *  desktop density is unchanged. */
export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  className = '',
}) => (
  <span
    className={`inline-flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] desktop:min-h-0 desktop:min-w-0 ${className}`}
  >
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-5 w-5 accent-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
    />
  </span>
)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ui/Checkbox.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Replace all nine call sites**

Each replacement swaps the bare input for `<Checkbox>` and changes the handler from an event to a boolean. Add `import { Checkbox } from '../ui/Checkbox'` to each file (path is `'../ui/Checkbox'` from `budget/`, `dashboard/` and `settings/`; `'./Checkbox'` is not used by any of them).

`src/components/budget/TransactionListWidget.tsx:279` (select all, desktop table header):

```tsx
                    <Checkbox
                      ariaLabel="Select all transactions"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                    />
```

`src/components/budget/TransactionListWidget.tsx:308` (desktop row):

```tsx
                      <Checkbox
                        ariaLabel="Select transaction"
                        checked={selectedSet.has(tx.id)}
                        onChange={() => toggleRow(tx.id)}
                      />
```

`src/components/budget/TransactionListWidget.tsx:400` (mobile card). The old element carried `onClick={(e) => e.stopPropagation()}` and `mt-1 shrink-0`; keep the stop-propagation by wrapping, since `Checkbox` does not take `onClick`:

```tsx
                  <span onClick={(e) => e.stopPropagation()} className="mt-1 shrink-0">
                    <Checkbox
                      ariaLabel="Select transaction"
                      checked={selectedSet.has(tx.id)}
                      onChange={() => toggleRow(tx.id)}
                    />
                  </span>
```

`src/components/budget/TransactionModal.tsx:210`:

```tsx
                <Checkbox checked={isShared} onChange={setIsShared} ariaLabel="Shared bill" />
```

`src/components/budget/TransactionModal.tsx:258`:

```tsx
                <Checkbox checked={isReimbursement} onChange={setIsReimbursement} ariaLabel="Reimbursement for a shared bill" />
```

`src/components/budget/TransactionModal.tsx:298`:

```tsx
                <Checkbox checked={isSplit} onChange={setIsSplit} ariaLabel="Split across categories" />
```

`src/components/dashboard/CustomizeDashboard.tsx:39`:

```tsx
            <Checkbox
              ariaLabel={`Show ${label}`}
              checked={!hidden.includes(id)}
              onChange={() => toggleHidden(id)}
            />
```

`src/components/settings/DriveSyncControls.tsx:204`:

```tsx
        <Checkbox
          checked={autoSync}
          ariaLabel="Sync automatically"
          onChange={(next) => {
            setAutoSyncEnabled(next)
            setAutoSync(next)
          }}
        />
```

`src/components/settings/SettingsSheet.tsx:69`:

```tsx
        <Checkbox
          checked={enabled}
          ariaLabel="Remind me before upcoming recurring bills"
          onChange={(next) => {
            setRemindersEnabled(next)
            setEnabled(next)
          }}
        />
```

- [ ] **Step 6: Run the affected suites**

Run: `npx vitest run src/components/budget src/components/dashboard src/components/settings`
Expected: PASS. Tests that queried the checkbox by `container.querySelector('input[type=checkbox]')` still work. Tests that fired `fireEvent.change(input, { target: { checked: true } })` still work, because the component reads `e.target.checked`.

- [ ] **Step 7: Verify no bare checkboxes remain**

Run: `npx grep -rn 'type="checkbox"' src --include=*.tsx` (or `grep -rn 'type="checkbox"' src --include=*.tsx`)
Expected: exactly one hit, `src/components/ui/Checkbox.tsx`.

- [ ] **Step 8: Run all gates**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/Checkbox.tsx src/components/ui/Checkbox.test.tsx src/components/budget/TransactionListWidget.tsx src/components/budget/TransactionModal.tsx src/components/dashboard/CustomizeDashboard.tsx src/components/settings/DriveSyncControls.tsx src/components/settings/SettingsSheet.tsx
git commit -m "fix(a11y): replace nine 13px checkboxes with one 44px-target component

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Mobile tap-target floor for buttons and links

Audit section 3 (Touch targets) and section 9 (Accessibility, WCAG 2.5.5).

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/ui/Sheet.tsx` (drag handle exemption)
- Test: `e2e/mobile-guards.spec.ts` (extended in Task 8; this task's proof is the visual-regression-free gate below)

**Interfaces:**
- Consumes: nothing.
- Produces: a `.tap-exempt` escape-hatch class. Task 8's guard treats any element matching `.tap-exempt` as intentionally exempt and every other undersized control as a failure.

**Why CSS and not 67 edits:** the audit found 67 call sites using `px-3 py-1.5`, `px-2.5 py-1` or `px-2 py-1` across 30 files, landing between 18px and 37px tall. Editing each one is a large diff that still would not stop the next component from shipping a 26px pill. A mobile-only floor on the element types that actually receive taps fixes all of them at once and holds for future code. Desktop is untouched, so no density regression there.

- [ ] **Step 1: Add the floor and the escape hatch**

In `src/index.css`, directly after the input rule added in Task 4, add:

```css
/* Tap-target floor. Apple and Android both put the minimum comfortable
   touch target at 44px; WCAG 2.5.5 agrees and 2.5.8 sets a hard floor of
   24px. The audit found 67 controls between 18px and 37px tall, spread
   over 30 files with no shared primitive, so this is enforced here rather
   than at each call site: a new 26px pill in a new component is covered
   automatically. Mobile only, so desktop density is unchanged.

   min-width is deliberately not applied to <a>, because a link inside a
   sentence must stay inline and would otherwise stretch the line box.
   Anything that genuinely must stay smaller opts out with .tap-exempt.

   Same compound query as the input floor above, for the same reason: it
   must be the exact negation of `desktop`, or a landscape phone (wide
   enough to fail a plain max-width check, short enough to still show the
   mobile bars) keeps its sub-44px controls. */
@media (max-width: 767px), (max-height: 499px) {
  button:not(.tap-exempt),
  [role='button']:not(.tap-exempt),
  summary:not(.tap-exempt) {
    min-height: 44px;
    min-width: 44px;
  }

  a[href]:not(.tap-exempt),
  input:not([type='hidden']):not(.tap-exempt),
  textarea:not(.tap-exempt),
  select:not(.tap-exempt) {
    min-height: 44px;
  }
}
```

- [ ] **Step 2: Exempt the sheet drag handle**

The grab handle in `src/components/ui/Sheet.tsx` is a decorative `<span>`, not a control, so it is already unaffected. The sheet's own scrim is a `<div>`, also unaffected. No change is needed here, but confirm by running:

Run: `grep -n "h-1 w-10 rounded-full" src/components/ui/Sheet.tsx`
Expected: one hit on a `<span>` with `aria-hidden="true"`. If it is ever a `<button>`, add `tap-exempt` to it.

- [ ] **Step 3: Check nothing overflowed**

The floor grows controls, and growth is the one thing that can push a tight flex row past the viewport.

Run: `npx playwright test e2e/mobile-guards.spec.ts e2e/a11y-mobile.spec.ts`
Expected: PASS. If a row now overflows, add `flex-wrap` to that row (the Task 2 fix pattern). Do not narrow the floor.

- [ ] **Step 4: Run remaining gates**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b`
Expected: all green. jsdom has no layout engine, so unit tests are unaffected by this change.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "fix(a11y): floor mobile tap targets at 44px

67 controls measured between 18px and 37px tall across 30 files with no
shared primitive. Enforced in one place so new components inherit it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Icon-only controls get real hit areas

Audit section 3 (Touch targets). Task 6's floor covers height and width for `<button>`, but three controls are not plain buttons or sit inside containers that clip them.

**Files:**
- Modify: `src/components/investments/PortfolioView.tsx` (currency selector, "Refresh exchange rate")
- Modify: `src/components/planner/ToolInfoButton.tsx` ("About this tool")
- Test: `src/components/planner/ToolInfoButton.test.tsx`

**Interfaces:**
- Consumes: the `desktop` variant from Task 1.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Find the three sites**

Run: `grep -n "Currency for\|Refresh exchange rate" src/components/investments/PortfolioView.tsx`
Run: `grep -n "About this tool" src/components/planner/ToolInfoButton.tsx`
Expected: one hit each for the two labels in PortfolioView, one in ToolInfoButton.

The currency selector measured 61x18 because it is a `ThemedSelect` trigger inside `span.inline-block.align-middle`; the inline-block wrapper collapses the button's min-height. The refresh icon measured 19x19 inside `p.text-[12px] > span.inline-flex`, same cause.

- [ ] **Step 2: Write the failing test**

Append to `src/components/planner/ToolInfoButton.test.tsx`. The component takes `tool: PlannerTool`, and the file already imports `getTool` from `./toolRegistry`, so reuse that:

```tsx
  it('gives the info button a mobile hit area', () => {
    render(<ToolInfoButton tool={getTool('mortgage')!} />)
    // Measured 24x24 in the audit, on a control that opens the only
    // explanation of what the tool does.
    const button = screen.getByRole('button', { name: 'About this tool' })
    expect(button.className).toMatch(/min-h-\[44px\]/)
    expect(button.className).toMatch(/min-w-\[44px\]/)
  })
```

Put it inside the existing `describe('ToolInfoButton', ...)` block so it inherits the `resetMatchMedia` teardown.

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run src/components/planner/ToolInfoButton.test.tsx`
Expected: FAIL, the class does not contain `min-h-[44px]`.

- [ ] **Step 4: Fix the three sites**

In `src/components/planner/ToolInfoButton.tsx`, add to the trigger button's className:

```
min-h-[44px] min-w-[44px] desktop:min-h-0 desktop:min-w-0 flex items-center justify-center
```

In `src/components/investments/PortfolioView.tsx`, change the currency selector's wrapper from `inline-block align-middle` to `inline-flex align-middle items-center` so the button's floor is not collapsed by the inline-block context. Do the same for the refresh-rate wrapper: change `inline-flex items-center` to `inline-flex items-center gap-1` and give the button inside it `min-h-[44px] min-w-[44px] desktop:min-h-0 desktop:min-w-0 flex items-center justify-center`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/planner/ToolInfoButton.test.tsx src/components/investments`
Expected: PASS.

- [ ] **Step 6: Run gates**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b` then `npx playwright test e2e/mobile-guards.spec.ts`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/investments/PortfolioView.tsx src/components/planner/ToolInfoButton.tsx src/components/planner/ToolInfoButton.test.tsx
git commit -m "fix(a11y): give icon-only controls real hit areas on mobile

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Permanent tap-size guard

Audit section 3 and section 9. This is what makes the previous three tasks stick.

**Files:**
- Modify: `e2e/mobile-guards.spec.ts`

**Interfaces:**
- Consumes: `e2e/mobile-guards.spec.ts` and its `ROUTES` and `DISCLAIMER_ACK_KEY` from Task 4; `.tap-exempt` from Task 6.
- Produces: nothing.

- [ ] **Step 1: Add the guard**

Append to `e2e/mobile-guards.spec.ts`:

```ts
// Everything a finger can hit must clear 44x44 on a phone. The audit found
// 10 of 31 controls under that on the dashboard alone, and 21 of 34 on the
// transaction list. Anything that genuinely must stay smaller opts out with
// the .tap-exempt class, and the exemption is visible in this failure list.
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
          const r = el.getBoundingClientRect()
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
  await page.getByRole('button', { name: 'Transactions' }).click()
  const offenders = await page.evaluate((selector) => {
    return [...document.querySelectorAll(selector)]
      .filter((el) => {
        if (el.classList.contains('tap-exempt')) return false
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none') return false
        const r = el.getBoundingClientRect()
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
```

This is the densest surface in the app: the audit measured 21 of 34 controls under 44px here, including the 13x13 select checkbox and the 196x21 edit button on every card.

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/mobile-guards.spec.ts`
Expected: PASS if Tasks 5 to 7 are complete. If it fails, the failure message names each control and its measured size. Fix the control, do not widen the exemption, unless the control is genuinely decorative.

- [ ] **Step 3: Wire the guard into `verify`**

`npm run verify` already runs `npm run e2e`, which runs every spec in `e2e/`. Confirm:

Run: `npx playwright test --list | grep mobile-guards | head -3`
Expected: the new tests are listed.

- [ ] **Step 4: Commit**

```bash
git add e2e/mobile-guards.spec.ts
git commit -m "test(mobile): guard against tap targets under 44px

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Sheets survive the software keyboard

Audit section 5 (Modals and sheets). The sheet is `max-h-[90dvh]`, and `dvh` does not shrink when the iOS keyboard opens, so a field low in a tall sheet can sit behind it.

**Files:**
- Create: `src/hooks/useViewportHeight.ts`
- Create: `src/hooks/useViewportHeight.test.ts`
- Modify: `src/components/ui/Sheet.tsx`
- Modify: `src/components/Layout.tsx` (mount the hook once)
- Test: `src/components/ui/Sheet.test.tsx`

**Interfaces:**
- Consumes: the `desktop` variant from Task 1.
- Produces:

```ts
/** Publishes window.visualViewport.height to --app-viewport-height on
 *  documentElement. Call once, from Layout. */
export function useViewportHeight(): void
```

and the CSS custom property `--app-viewport-height`, which `Sheet` reads.

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/useViewportHeight.test.ts`:

```ts
import { describe, expect, it, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useViewportHeight } from './useViewportHeight'

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--app-viewport-height')
})

function stubVisualViewport(height: number) {
  const listeners: Record<string, Array<() => void>> = {}
  const vv = {
    height,
    addEventListener: (type: string, cb: () => void) => {
      listeners[type] = [...(listeners[type] ?? []), cb]
    },
    removeEventListener: () => {},
    fire: (type: string, next: number) => {
      vv.height = next
      ;(listeners[type] ?? []).forEach((cb) => cb())
    },
  }
  vi.stubGlobal('visualViewport', vv)
  return vv
}

describe('useViewportHeight', () => {
  it('publishes the visual viewport height as a CSS variable', () => {
    stubVisualViewport(812)
    renderHook(() => useViewportHeight())
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('812px')
  })

  it('shrinks the variable when the keyboard opens', () => {
    const vv = stubVisualViewport(812)
    renderHook(() => useViewportHeight())
    act(() => vv.fire('resize', 476))
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('476px')
  })

  it('does nothing when visualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined)
    expect(() => renderHook(() => useViewportHeight())).not.toThrow()
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/hooks/useViewportHeight.test.ts`
Expected: FAIL, "Failed to resolve import ./useViewportHeight".

- [ ] **Step 3: Write the hook**

Create `src/hooks/useViewportHeight.ts`:

```ts
import { useEffect } from 'react'

/** Publishes the visual viewport height to --app-viewport-height.
 *
 *  Bottom sheets are sized in dvh, and dvh does not shrink when the iOS
 *  software keyboard opens: the layout viewport is unchanged and only the
 *  visual viewport shrinks. A tall sheet therefore keeps its full height
 *  and puts its lower fields behind the keyboard. visualViewport reports
 *  the real usable height on both iOS and Android, so sheets can cap
 *  themselves against it.
 *
 *  Mount once, from Layout. No-op where visualViewport is unsupported, in
 *  which case the sheet's dvh fallback applies. */
export function useViewportHeight(): void {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined
    if (!vv) return

    const publish = () => {
      document.documentElement.style.setProperty('--app-viewport-height', `${vv.height}px`)
    }

    publish()
    vv.addEventListener('resize', publish)
    vv.addEventListener('scroll', publish)
    return () => {
      vv.removeEventListener('resize', publish)
      vv.removeEventListener('scroll', publish)
    }
  }, [])
}
```

- [ ] **Step 4: Run the hook test to verify it passes**

Run: `npx vitest run src/hooks/useViewportHeight.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing Sheet test**

Append to `src/components/ui/Sheet.test.tsx`:

```tsx
it('caps the mobile sheet against the visual viewport, not just dvh', () => {
  setMatchMedia(false) // mobile
  render(<Sheet open onClose={() => {}} ariaLabel="Test sheet"><p>body</p></Sheet>)
  const panel = screen.getByTestId('sheet-panel')
  expect(panel.style.maxHeight).toContain('--app-viewport-height')
})

it('gives the close button a 44px hit area', () => {
  setMatchMedia(false)
  render(<Sheet open onClose={() => {}} ariaLabel="Test sheet"><p>body</p></Sheet>)
  const close = screen.getByRole('button', { name: 'Close' })
  expect(close.className).toMatch(/min-h-\[44px\]/)
  expect(close.className).toMatch(/min-w-\[44px\]/)
})
```

Import `setMatchMedia` from `'../../test-utils/matchMedia'` if the file does not already, and reset it in an `afterEach`.

- [ ] **Step 6: Run it to make sure it fails**

Run: `npx vitest run src/components/ui/Sheet.test.tsx`
Expected: FAIL on both new cases.

- [ ] **Step 7: Update the Sheet**

In `src/components/ui/Sheet.tsx`, in the mobile bottom-sheet branch, change the panel's className from:

```
"relative z-50 w-full max-h-[90dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-[var(--dropdown-bg)] shadow-2xl"
```

to:

```
"relative z-50 w-full overflow-y-auto rounded-t-2xl border-t border-border bg-[var(--dropdown-bg)] shadow-2xl"
```

and change its `style` prop from:

```tsx
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
```

to:

```tsx
            style={{
              paddingBottom: 'env(safe-area-inset-bottom)',
              // dvh does not shrink for the software keyboard, so a tall
              // sheet would put its lower fields behind it. The visual
              // viewport does shrink; dvh is the fallback where it is not
              // supported. See useViewportHeight.
              maxHeight: 'calc(0.9 * var(--app-viewport-height, 90dvh))',
            }}
```

In the same file, change the close button's className from `"ml-auto p-1 text-text-secondary hover:text-text-primary"` to:

```
"ml-auto flex items-center justify-center min-h-[44px] min-w-[44px] desktop:min-h-0 desktop:min-w-0 desktop:p-1 text-text-secondary hover:text-text-primary rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
```

- [ ] **Step 8: Mount the hook**

In `src/components/Layout.tsx`, add the import:

```tsx
import { useViewportHeight } from '../hooks/useViewportHeight'
```

and call it near the top of the component body, next to the other hooks:

```tsx
  useViewportHeight()
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/components/ui/Sheet.test.tsx src/components/Layout.test.tsx`
Expected: PASS.

Note on the `calc(0.9 * var(...))` fallback: when `--app-viewport-height` is unset the fallback `90dvh` is substituted whole, giving `calc(0.9 * 90dvh)` which is 81dvh, not 90dvh. That is deliberate and safe (it errs smaller), but if you prefer exactness, set the fallback to `100dvh` so the unsupported path lands on 90dvh.

- [ ] **Step 10: Run gates**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b` then `npx playwright test e2e/mobile-guards.spec.ts`
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add src/hooks/useViewportHeight.ts src/hooks/useViewportHeight.test.ts src/components/ui/Sheet.tsx src/components/ui/Sheet.test.tsx src/components/Layout.tsx
git commit -m "fix(mobile): size sheets against the visual viewport and grow the close button

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Account names stop truncating on mobile

Audit section 6 (Dense data). The name column measured 111px to 127px, so "Mortgage - 12 Maplewood Crescent" (220px) rendered as roughly "Mortgage - 12 Ma...".

**Files:**
- Modify: `src/components/dashboard/AccountCategoryWidget.tsx:77-82`
- Test: `src/components/dashboard/AccountCategoryWidget.test.tsx`

**Interfaces:**
- Consumes: the `desktop` variant from Task 1.
- Produces: `data-testid="account-row-<id>"` and `data-testid="account-name-<id>"` on each row.

**This reverses an earlier deliberate decision, on purpose.** `AccountCategoryWidget.test.tsx` already contains a case called "truncates long account names so the row cannot break", which asserts the `truncate` class is present. That decision was right for the desktop single-line row and wrong for mobile, where the name column collapses to about 115px. The fix keeps truncation on desktop and drops it on mobile, so that test is retargeted rather than deleted. Do not simply delete it.

- [ ] **Step 1: Write the failing test**

Append to `src/components/dashboard/AccountCategoryWidget.test.tsx`. The file seeds state with `useAccountsStore.setState({ accounts: [...] })` in each case and has a `beforeEach` that resets the store; follow that pattern rather than adding a helper.

```tsx
describe('AccountCategoryWidget mobile name layout', () => {
  it('stacks a long account name above its value on mobile so it does not truncate', () => {
    // The name column measured 111px while "Mortgage - 12 Maplewood Crescent"
    // needs 220px, so the name was cut mid-word on every phone.
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Mortgage - 12 Maplewood Crescent', value: 412000, type: 'debt' }],
    })
    const { container } = render(<AccountCategoryWidget title="Debts & Liabilities" type="debt" />)
    const row = container.querySelector('[data-testid="account-row-a1"]')!
    expect(row).not.toBeNull()
    expect(row.className).toMatch(/flex-col/)
    expect(row.className).toMatch(/desktop:flex-row/)
  })
})
```

- [ ] **Step 1b: Retarget the existing truncation case**

In the same file, change the body of `it('truncates long account names so the row cannot break', ...)` so it asserts the desktop-only variant, and rename it to say so:

```tsx
  it('truncates long account names on desktop, where the row is a single line', () => {
    useAccountsStore.setState({
      accounts: [{ id: 'a1', name: 'Joint Savings for the Big 2026 Vacation Fund', value: 1200, type: 'bank' }],
    })
    render(<AccountCategoryWidget title="Bank" type="bank" />)
    const name = screen.getByText(/Joint Savings/)
    const classes = name.className.split(/\s+/)
    // Desktop keeps the one-line row; mobile stacks and wraps instead,
    // because the mobile name column is only about 115px wide.
    expect(classes).toContain('desktop:truncate')
    expect(classes).not.toContain('truncate')
  })
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/dashboard/AccountCategoryWidget.test.tsx`
Expected: FAIL, no element with `data-testid="account-row-a1"`.

- [ ] **Step 3: Restructure the row**

In `src/components/dashboard/AccountCategoryWidget.tsx`, change lines 77 to 82 from:

```tsx
                <div key={acc.id} className="flex justify-between items-center gap-2 group">
                  <span className="text-sm text-text-secondary truncate min-w-0">{acc.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-medium text-text-primary">
```

to:

```tsx
                {/* On a phone the name column collapsed to about 115px while
                    real account names need 140px to 220px, so every name was
                    cut mid-word. Stacking name over value on mobile gives the
                    name the full card width; desktop keeps the single row. */}
                <div
                  key={acc.id}
                  data-testid={`account-row-${acc.id}`}
                  className="flex flex-col items-start gap-0.5 desktop:flex-row desktop:justify-between desktop:items-center desktop:gap-2 group"
                >
                  <span
                    data-testid={`account-name-${acc.id}`}
                    className="text-sm text-text-secondary min-w-0 break-words desktop:truncate"
                  >
                    {acc.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 self-stretch justify-between desktop:self-auto desktop:justify-normal">
                    <span className="text-sm font-medium text-text-primary">
```

Leave the two icon buttons below unchanged; they already carry the 44px idiom.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/dashboard/AccountCategoryWidget.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add a truncation guard to the e2e suite**

Append to `e2e/mobile-guards.spec.ts`:

```ts
// Truncated account names were the single most visible mobile complaint:
// nine text nodes were cut at 320px on the dashboard alone.
test('no dashboard text is clipped by its own container', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('accounts-storage', JSON.stringify({
      state: {
        accounts: [
          { id: 'a1', name: 'EQ Bank High Interest Savings', value: 32150, type: 'bank' },
          { id: 'a2', name: 'Mortgage - 12 Maplewood Crescent', value: 412000, type: 'debt' },
        ],
        history: [],
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
```

- [ ] **Step 6: Run the guard**

Run: `npx playwright test e2e/mobile-guards.spec.ts`
Expected: PASS. If the bottom-bar labels appear in the failure list, revisit the `tracking-tight` change from Task 3; if a chart axis label appears, exclude `svg text` from the filter, since SVG text is not clipped by CSS overflow.

- [ ] **Step 7: Run gates and commit**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b`

```bash
git add src/components/dashboard/AccountCategoryWidget.tsx src/components/dashboard/AccountCategoryWidget.test.tsx e2e/mobile-guards.spec.ts
git commit -m "fix(dashboard): stop truncating account names on mobile

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Charts fit a phone and answer to touch

Audit section 7 (Charts). Heights are fixed at 300px and 400px, and 400px is 49% of a 375x812 viewport for one widget. Whether Recharts tooltips open on touch is the audit's open question.

**Files:**
- Modify: `src/components/compensation/CompHeroWidget.tsx:228`, `src/components/investments/report/ReportContributors.tsx:53`, `src/components/budget/TriageInboxWidget.tsx:67`
- Modify: `src/components/planner/forecaster/MonteCarloSection.tsx:55`, `src/components/planner/MortgageCalculator.tsx:176`, `src/components/budget/TransactionListWidget.tsx:166`, `src/components/budget/CategorizationRulesWidget.tsx:57`, `src/components/budget/CashFlowWidget.tsx:130`
- Modify: `e2e/mobile-guards.spec.ts`

**Interfaces:**
- Consumes: `ROUTES` and the device fixture from Task 4.
- Produces: nothing.

- [ ] **Step 1: Make the heights responsive**

At each of the eight sites, replace the fixed height with a mobile-first pair. For the three `h-[400px]` sites:

```
h-[280px] sm:h-[400px]
```

For the five `h-[300px]` sites:

```
h-[240px] sm:h-[300px]
```

Change only the height class. Do not touch the `ResponsiveContainer` inside, which already handles width.

- [ ] **Step 2: Verify no unit test asserted a fixed height**

Run: `npx vitest run`
Expected: PASS. If a test asserts `h-[400px]`, update it to assert `sm:h-[400px]` rather than deleting the assertion.

- [ ] **Step 3: Write the touch-tooltip test**

Append to `e2e/mobile-guards.spec.ts`:

```ts
// The audit could not verify this and flagged it as an open question: if a
// series value is only readable from a hover tooltip, it is unreadable on a
// phone. Playwright's iPhone fixture has hasTouch, so page.tap exercises the
// real touch path.
test('a chart reveals its values on tap', async ({ page }) => {
  await page.goto('/#/planner/mortgage')
  await page.waitForLoadState('networkidle')
  const chart = page.locator('.recharts-wrapper').first()
  await expect(chart).toBeVisible()
  const box = (await chart.boundingBox())!
  await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.5)
  await expect(page.locator('.recharts-tooltip-wrapper')).toBeVisible({ timeout: 2000 })
})
```

- [ ] **Step 4: Run it**

Run: `npx playwright test e2e/mobile-guards.spec.ts -g "reveals its values"`

Two outcomes, both actionable:

- **PASS:** Recharts already handles touch. Keep the test as the permanent guard and move on.
- **FAIL:** the tooltip never appears on touch, confirming the audit's suspicion. Fix it by giving the chart's `<Tooltip>` a `trigger="click"` prop and adding `onClick` handling, or by rendering an inline value readout below the chart on mobile. Whichever you choose, the test above must pass afterwards. Record which outcome occurred in the commit message.

- [ ] **Step 5: Run gates**

Run: `npx vitest run` then `npx eslint .` then `npx tsc -b` then `npx playwright test e2e/mobile-guards.spec.ts`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/compensation/CompHeroWidget.tsx src/components/investments/report/ReportContributors.tsx src/components/budget/TriageInboxWidget.tsx src/components/planner/forecaster/MonteCarloSection.tsx src/components/planner/MortgageCalculator.tsx src/components/budget/TransactionListWidget.tsx src/components/budget/CategorizationRulesWidget.tsx src/components/budget/CashFlowWidget.tsx e2e/mobile-guards.spec.ts
git commit -m "fix(charts): shorten charts on phones and pin touch tooltips under test

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Lift the smallest type tiers on mobile

Audit section 8 (Typography). The 10px tier carries the tab labels and the 11px tier carries dates, category names and pacing hints.

**Files:**
- Create: `scripts/check-type-scale.mjs`
- Modify: `src/index.css`
- Modify: the 8 files using `text-[10px]` and the 30 files using `text-[11px]` (Finding 10)
- Modify: `package.json` (add the check to `verify`)

**Interfaces:**
- Consumes: nothing.
- Produces: two Tailwind utilities, `text-micro` and `text-meta`, and `npm run check:type-scale`.

- [ ] **Step 1: Add the utilities**

In `src/index.css`, after the tap-target rule from Task 6, add:

```css
/* Two semantic tiers replace the raw 10px and 11px arbitrary values. Both
   step up one pixel on phones, where the audit found the smallest tier
   carrying real data (dates, category names, pacing hints) and not just
   decoration, and step back down on desktop where the original sizes were
   deliberate. Enforced by scripts/check-type-scale.mjs.

   The inner query matches the `desktop` custom variant exactly (width AND
   height), not a plain min-width, so a landscape phone keeps the larger
   mobile size instead of falling back to the tighter desktop tier the
   moment its width alone crosses 768px. */
@utility text-micro {
  font-size: 11px;
  @media (min-width: 768px) and (min-height: 500px) {
    font-size: 10px;
  }
}

@utility text-meta {
  font-size: 12px;
  @media (min-width: 768px) and (min-height: 500px) {
    font-size: 11px;
  }
}
```

- [ ] **Step 2: Write the failing guard**

Create `scripts/check-type-scale.mjs`:

```js
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

// Fails if the raw 10px or 11px arbitrary type values reappear. They were
// replaced by the text-micro and text-meta utilities, which step up one
// pixel on phones. A new text-[10px] would silently reintroduce a tier the
// audit found too small to read on a handset, and nothing else would catch
// it: jsdom has no layout engine and the e2e guards check geometry, not
// font size.
//
// Plain readdirSync recursion rather than a glob helper, to match
// scripts/check-eager-graph.mjs and to stay off Node-version-specific APIs.

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full)
  }
  return out
}

const cwd = process.cwd()
const files = walk(join(cwd, 'src'))
const offenders = []

for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/text-\[1[01]px\]/.test(line)) {
      const rel = relative(cwd, file).split('\\').join('/')
      offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`)
    }
  })
}

if (offenders.length > 0) {
  console.error('Raw 10px/11px type found. Use text-micro or text-meta instead:\n')
  offenders.forEach((o) => console.error('  ' + o))
  process.exit(1)
}

console.log(`check:type-scale OK (${files.length} files)`)
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `node scripts/check-type-scale.mjs`
Expected: FAIL, exit 1, listing 55 offenders.

- [ ] **Step 4: Replace every site**

Run this from the repo root:

```bash
grep -rl 'text-\[10px\]\|text-\[11px\]' src --include=*.tsx --include=*.ts | grep -v '\.test\.' | xargs sed -i 's/text-\[10px\]/text-micro/g; s/text-\[11px\]/text-meta/g'
```

Then check the diff by eye for any site where the class was inside a template literal that also builds a conditional, which `sed` handles fine but is worth a glance:

Run: `git diff --stat`
Expected: about 38 files changed.

- [ ] **Step 5: Run the guard to verify it passes**

Run: `node scripts/check-type-scale.mjs`
Expected: `check:type-scale OK (...)`, exit 0.

- [ ] **Step 6: Wire it into verify**

In `package.json`, add to `scripts`:

```json
    "check:type-scale": "node scripts/check-type-scale.mjs",
```

and extend `verify` to include `&& npm run check:type-scale` immediately after `npm run check:eager`.

- [ ] **Step 7: Run gates**

Run: `npx vitest run`
Expected: PASS. Any test asserting `text-[11px]` in a className must be updated to `text-meta`.
Run: `npx eslint .` then `npx tsc -b` then `npx playwright test e2e/mobile-guards.spec.ts`
Expected: all green. The type bump slightly widens labels, so the truncation guard from Task 10 is the one to watch.

- [ ] **Step 8: Commit**

```bash
git add src/index.css scripts/check-type-scale.mjs package.json src
git commit -m "refactor(type): replace raw 10px/11px with text-micro and text-meta

Both step up a pixel on phones, where the smallest tier carries dates,
category names and pacing hints rather than decoration.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Platform chrome, safe areas and scroll containment

Audit section 10 (Platform integration).

**Files:**
- Modify: `index.html`
- Modify: `src/App.tsx`
- Modify: `vite.config.ts`
- Modify: `src/components/ui/UpdateToast.tsx`, `src/components/ui/UndoToast.tsx`
- Modify: `src/index.css`
- Test: `src/App.test.tsx`, `src/components/ui/UndoToast.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Write the failing theme-color test**

Append to `src/App.test.tsx`:

```tsx
it('keeps the browser chrome colour in step with the active theme', async () => {
  useThemeStore.getState().setTheme('geometric')
  render(<App />)
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
  expect(meta).not.toBeNull()
  // Geometric is the light theme; a hardcoded black bar over a white app
  // is exactly what the manifest was doing.
  expect(meta.content).toBe('#ffffff')

  await act(async () => { useThemeStore.getState().setTheme('luxury') })
  expect((document.querySelector('meta[name="theme-color"]') as HTMLMetaElement).content).toBe('#000000')
})
```

Import `useThemeStore` and `act` at the top of the file if not already imported.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL, "expected null not to be null".

- [ ] **Step 3: Add the static tags**

In `index.html`, inside `<head>`, after the existing `<link rel="icon" ...>`:

```html
    <meta name="theme-color" content="#000000" />
    <link rel="apple-touch-icon" href="icon-192x192-v2.png" />
    <meta name="description" content="A private, offline-first personal finance dashboard: budgeting, investments, planning and compensation." />
```

Note the `apple-touch-icon` href is deliberately relative, so Vite resolves it against the `/ledger/` base the same way it rewrites the favicon.

- [ ] **Step 4: Sync theme-color from the theme effect**

In `src/App.tsx`, inside the existing theme `useEffect`, after `root.setAttribute('data-theme', theme)` and the `dark` class handling, add:

```tsx
    // The manifest can only carry one theme_color, and it was hardcoded
    // black while the app ships a light theme, so an installed light-theme
    // app got black system bars. The meta tag wins over the manifest at
    // runtime, so keep it in step with whichever theme is active.
    const bg = getComputedStyle(root).getPropertyValue('--bg-primary').trim()
    if (bg) {
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'theme-color'
        document.head.appendChild(meta)
      }
      meta.content = bg
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS. jsdom resolves custom properties set by the stylesheet; if it returns an empty string in this environment, the guard `if (bg)` keeps the effect a no-op and the assertion will fail loudly rather than silently. In that case, set the meta from a small `THEME_BACKGROUNDS` record in `useThemeStore.ts` keyed by `AppTheme` instead of reading computed styles, and assert against that record.

- [ ] **Step 6: Fix the manifest default**

In `vite.config.ts`, in the `manifest` block, leave `background_color: '#000000'` and change:

```
        theme_color: '#000000',
```

to:

```
        // Only the install-time default. The runtime value is kept in step
        // with the active theme by the theme effect in src/App.tsx.
        theme_color: '#000000',
```

No value change is required, only the comment, because black matches the default `luxury` theme and the meta tag overrides it at runtime.

- [ ] **Step 7: Write the failing toast test**

Append to `src/components/ui/UndoToast.test.tsx`:

```tsx
it('sits above the tab bar including the home indicator', () => {
  useUndoStore.getState().offerUndo('Deleted account', () => {})
  const { container } = render(<UndoToast />)
  const toast = container.querySelector('[role="status"]')!
  // The bar is 52px plus env(safe-area-inset-bottom), which is 34px on a
  // home-indicator iPhone. A fixed 96px cleared it by only 10px, and the
  // update toast's fixed 64px did not clear it at all.
  expect(toast.className).toMatch(/safe-area-inset-bottom/)
})
```

- [ ] **Step 8: Run it to make sure it fails**

Run: `npx vitest run src/components/ui/UndoToast.test.tsx`
Expected: FAIL, the class contains `bottom-24` and no `safe-area-inset-bottom`.

- [ ] **Step 9: Fix both toasts**

In `src/components/ui/UndoToast.tsx:17`, change `bottom-24 md:bottom-6` to:

```
bottom-[calc(76px+env(safe-area-inset-bottom))] desktop:bottom-6
```

In `src/components/ui/UpdateToast.tsx:12`, change `bottom-16 md:bottom-6` to:

```
bottom-[calc(68px+env(safe-area-inset-bottom))] desktop:bottom-6
```

76px and 68px are the 52px bar plus a 24px and 16px gap respectively, so the two toasts still stack in the same visual order they did before.

- [ ] **Step 10: Contain overscroll**

In `src/components/Layout.tsx`, add `overscroll-contain` to the `<main>` element's className, next to `overflow-auto`. This stops a scroll that reaches the end of the page from chaining to the document and triggering the browser's pull-to-refresh over an app shell.

- [ ] **Step 11: Run the tests and gates**

Run: `npx vitest run src/components/ui/UndoToast.test.tsx src/components/Layout.test.tsx`
Expected: PASS.
Run: `npx vitest run` then `npx eslint .` then `npx tsc -b` then `npm run build`
Expected: all green. Confirm the built `dist/index.html` carries the new meta tags:

Run: `grep -c "theme-color\|apple-touch-icon" dist/index.html`
Expected: `2`.

- [ ] **Step 12: Commit**

```bash
git add index.html src/App.tsx src/App.test.tsx vite.config.ts src/components/ui/UpdateToast.tsx src/components/ui/UndoToast.tsx src/components/ui/UndoToast.test.tsx src/components/Layout.tsx
git commit -m "fix(pwa): match browser chrome to the theme and clear the home indicator

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: The full mobile regression suite

Audit sections 1, 2, 9 and 10. Everything the audit measured by hand becomes a build gate.

**Files:**
- Modify: `e2e/mobile-guards.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: `mobile-topbar` from Task 3, `ROUTES` from Task 4.
- Produces: nothing.

- [ ] **Step 1: Add a narrow-phone and a landscape project**

In `playwright.config.ts`, replace the single `projects` entry with:

```ts
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // 320px is the narrowest screen still in real use and the width at
    // which the audit found nine clipped strings on the dashboard.
    {
      name: 'mobile-narrow',
      testMatch: /mobile-guards\.spec\.ts/,
      use: { ...devices['iPhone 12'], viewport: { width: 320, height: 700 } },
    },
    // Landscape is where the sidebar used to appear and swallow Settings.
    {
      name: 'mobile-landscape',
      testMatch: /mobile-guards\.spec\.ts/,
      use: { ...devices['iPhone 12 landscape'] },
    },
  ],
```

Because `mobile-guards.spec.ts` sets its own `test.use({ ...devices['iPhone 12'] })`, remove that line from the spec so the project's viewport wins. Keep the `test.beforeEach` disclaimer seeding.

- [ ] **Step 2: Add the overflow guard**

Append to `e2e/mobile-guards.spec.ts`:

```ts
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
```

- [ ] **Step 3: Add the landscape reachability guard**

Append to `e2e/mobile-guards.spec.ts`:

```ts
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

test('search is reachable without a keyboard', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-testid="mobile-topbar"] button[aria-label="Search"]').click()
  await expect(page.getByPlaceholder('Jump to a page or tool…')).toBeVisible()
})
```

- [ ] **Step 4: Run the whole suite across all three projects**

Run: `npx playwright test`
Expected: PASS on every project. The narrow and landscape projects run only `mobile-guards.spec.ts`; `a11y-mobile.spec.ts`, `smoke.spec.ts`, `offline.spec.ts` and `transactions.spec.ts` still run under `chromium` only, unchanged.

If the landscape project fails the tap-size guard because 44px controls no longer fit in a 390px-tall viewport, that is a real finding: fix the layout, do not relax the guard.

- [ ] **Step 5: Run the full verify**

Run: `npm run verify`
Expected: lint clean, all unit tests pass, build succeeds, bundle check passes, eager-graph check passes, type-scale check passes, every e2e project passes.

- [ ] **Step 6: Commit**

```bash
git add e2e/mobile-guards.spec.ts playwright.config.ts
git commit -m "test(mobile): guard overflow, tap size and reachability at three phone sizes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15: Re-measure and rescore

The audit was measured, not estimated, so the new score must be measured too.

**Files:**
- Modify: `MOBILE_AUDIT_2026-08-19.md`
- Delete: `MOBILE_AUDIT.md` (the v0.7.4-beta audit, now two generations stale and already marked superseded)

**Interfaces:**
- Consumes: everything.
- Produces: the final scorecard.

- [ ] **Step 1: Re-measure**

Start the dev server and, at 375x812, 320x700 and 844x390, collect the same six numbers per route that the audit collected: `documentElement.scrollWidth` vs `clientWidth`, the count of elements crossing the right edge, the count of clipped text nodes, the count of interactive elements under 44px, the count of inputs under 16px, and the composited contrast failure count.

Every one of those counts must be zero except contrast, which was already zero.

- [ ] **Step 2: Confirm each section's deduction is gone**

Walk the ten sections of `MOBILE_AUDIT_2026-08-19.md` and confirm every "Problems" bullet is either fixed or has a guard. Any bullet that is neither is a task this plan missed; add it rather than scoring around it.

- [ ] **Step 3: Rewrite the scorecard**

Update the score table to 10 across the board and the total to 100/100. Replace each section's "Problems" paragraph with a "Fixed" paragraph naming the task and the guard that now protects it. Keep the "Good" paragraphs, they are still true. Update the header's Method line to note that the scores are now enforced by `e2e/mobile-guards.spec.ts` rather than measured once.

- [ ] **Step 4: Remove the superseded audit**

Run: `git rm MOBILE_AUDIT.md`

Its highest-severity finding was fixed two releases ago and it now contradicts the current state of the app, which is worse than having no old audit at all. It stays in git history.

- [ ] **Step 5: Final gate**

Run: `npm run verify`
Expected: everything green.

- [ ] **Step 6: Commit**

```bash
git add MOBILE_AUDIT_2026-08-19.md
git rm MOBILE_AUDIT.md
git commit -m "docs(mobile): rescore the audit at 100 and retire the v0.7.4 one

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Score Attribution

Which task closes which deduction, so a reviewer can check the arithmetic.

| Section | Was | Deductions closed by | Now |
|---|---|---|---|
| 1. Navigation | 5 | Task 1 (landscape), Task 3 (search entry, label truncation) | 10 |
| 2. Layout and viewport fit | 7 | Task 2 (overflow), Task 13 (overscroll), Task 14 (guard) | 10 |
| 3. Touch targets | 4 | Task 5 (checkboxes), Task 6 (floor), Task 7 (icon buttons), Task 8 (guard) | 10 |
| 4. Forms and data entry | 5 | Task 4 (16px), Task 6 (field height), Task 9 (keyboard) | 10 |
| 5. Modals and sheets | 8 | Task 9 (close button, keyboard) | 10 |
| 6. Dense data | 8 | Task 10 (truncation) | 10 |
| 7. Charts | 7 | Task 11 (heights, touch tooltips) | 10 |
| 8. Typography | 7 | Task 12 (type tiers) | 10 |
| 9. Accessibility | 7 | Tasks 5 to 8 (target size), Task 14 (landscape and 320px axe coverage) | 10 |
| 10. Platform integration | 6 | Task 1 (orientation), Task 13 (theme-color, apple-touch-icon, toast safe area) | 10 |
| **Total** | **64** | | **100** |

## Risks and How This Plan Handles Them

1. **The tap-target floor grows controls and could push rows off-screen.** This is the plan's largest blast radius. It is why Task 6 runs the overflow guard immediately, and why Task 14's overflow guard runs at 320px and in landscape as well. The prescribed fix when a row overflows is `flex-wrap`, never relaxing the floor.
2. **The 16px input floor changes the look of dense forms.** Accepted deliberately: iOS zoom is the worse defect, and there is no way to keep both without breaking pinch-zoom. Fixed-width inputs (`w-28`, `w-40`) are called out in Task 4 Step 5 as the two likely casualties.
3. **The `desktop` variant and `useIsDesktop` must stay identical.** They are separate declarations in separate files and nothing enforces the match. Both carry a comment pointing at the other. If this drifts twice, add a guard script; do not add one pre-emptively.
4. **Task 12's `sed` sweep touches 38 files at once.** It is mechanical and the guard script proves completeness, but the diff should be skimmed before committing.
5. **The chart touch tooltip may need real work.** Task 11 Step 4 is explicitly branched: the plan does not assume Recharts handles touch, and it names the two acceptable fixes if it does not.
6. **`npm run verify` gets slower** with three Playwright projects. The two new projects run one spec file each, so the added cost is roughly one extra spec run per project, not a full suite.
