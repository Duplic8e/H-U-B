# Gilded Bloom Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth app theme, "Gilded Bloom" (`nouveau`): a warm light theme with real elevation and an art nouveau floral ornament drawn only inside the desktop sidebar.

**Architecture:** The app already has a complete theme seam: a `[data-theme='…']` custom-property block in `src/index.css`, a union type plus three registries in `src/store/useThemeStore.ts`, an optional full-viewport decoration branch in `src/components/theme/ThemeBackground.tsx`, and a picker tile in `src/components/theme/ThemeSwatchGrid.tsx`. This plan adds one entry at each of those points, plus one genuinely new piece: a `SidebarFloral` component rendered inside the desktop `<nav>` so the ornament is clipped to the sidebar and cannot bleed across the page. Two small pre-existing seams have to be widened: `.themed-card` gains a `background-image` so a theme can layer a gradient over its flat fill, and `App.tsx`'s hardcoded `theme === 'geometric'` light-mode check becomes a `LIGHT_THEMES` set, because it is the one place a second light theme silently breaks.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (`@theme` + custom properties), Zustand with `persist`, Vitest + Testing Library (jsdom), Playwright.

## Global Constraints

- Theme key is `nouveau`. Display name is `Gilded Bloom`. Both spellings are exact; do not rename either.
- **Fonts:** use only families already in the `@import url(...)` on `src/index.css:1`. This theme uses `Poppins` (body) and `Playfair Display` (display). Do not add a font request.
- **Contrast** against `--bg-primary` `#FDF6EA`. These are the values independently recomputed by Task 1's reviewer with the strict WCAG relative-luminance formula, and they supersede the slightly looser figures the plan was drafted with:
  - `--accent` `#2F6B5E` = 5.77:1
  - `--text-primary` `#22251F` = 14.45:1
  - `--text-secondary` `#65695E` = 5.23:1 on the page, 5.53:1 on a card, 4.74:1 on the darkest sidebar composite. CORRECTED after the final review: this token was originally `#6E7266`, chosen against `--bg-primary` alone at 4.59:1. It measured only 4.34:1 to 4.15:1 on `--bg-secondary` surfaces once Task 3's wash was composited under the sidebar, and 3.05:1 for the `kbd` at `Layout.tsx:182`. The binding surface for this token is the sidebar composite, not the page.
  - `--border-strong` `#8C866B` = 3.41:1 on the page, 3.60:1 on a card
  - `--error` `#B04A2E` = 5.06:1
  - `--ornament` `#C49E4A` = 2.34:1. **Decoration only.** It must never carry text or mark a control. `SidebarFloral` is its only consumer.
  - The comment block in `src/index.css` now carries these corrected figures and records the sidebar-composite constraint.
- Do not use em dashes in any code comment, changelog line, or commit message.
- **Existing tests are modified, never recreated.** `src/store/useThemeStore.test.ts` and `src/components/theme/ThemeSwatchGrid.test.tsx` both hardcode the count five. Edit those specific assertions in place; do not rewrite either file.
- **Known and accepted:** the desktop sidebar is `hidden desktop:flex`, so on a phone this theme renders its warm surfaces and depth with no floral ornament at all. That is the agreed scope, not a defect to fix.
- `npm run verify` must pass at the end. It runs lint, unit tests, build, three bundle scripts, and the full Playwright suite.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/index.css` | Modify (add block after line 220) | The `[data-theme='nouveau']` custom-property block: the whole palette, fonts, card surface, and `--ornament`. |
| ~~`src/App.css`~~ **`src/index.css`** | Modify (`.themed-card`, line 280) | Lets any theme layer a gradient over its flat card fill via `--card-gradient`. CORRECTED during Task 1: `.themed-card` lives in `src/index.css`, not `src/App.css`. `src/App.css` is untouched by this plan. |
| `src/store/useThemeStore.ts` | Modify | `AppTheme` union, `THEME_CYCLE`, `THEME_BACKGROUNDS`, and a new exported `LIGHT_THEMES`. |
| `src/theme-tokens.test.ts` | Create | Reads `src/index.css` as text and proves every theme block declares the same tokens, a `color-scheme`, and a `--bg-primary` matching its `THEME_BACKGROUNDS` entry. |
| `src/store/useThemeStore.test.ts` | Modify (cycle test only) | Cycle now visits six themes. |
| `src/App.tsx` | Modify (line 26) | Drives Tailwind's `dark` class off `LIGHT_THEMES` instead of a single hardcoded key. |
| `src/App.test.tsx` | Modify (append one test) | Proves `nouveau` is treated as light. |
| `src/components/theme/ThemeBackground.tsx` | Modify | Adds the `nouveau` branch: two static warm radial washes, no animation. |
| `src/components/theme/ThemeBackground.test.tsx` | Create | First test for this component. Covers which themes decorate and that `nouveau` runs no looping animation. |
| `src/components/theme/SidebarFloral.tsx` | Create | The art nouveau ornament. Renders `null` for every theme but `nouveau`. |
| `src/components/theme/SidebarFloral.test.tsx` | Create | Gating, `aria-hidden`, negative z-index, and that it draws from theme tokens. |
| `src/components/Layout.tsx` | Modify (desktop `<nav>`) | Mounts `SidebarFloral` inside the sidebar so it is clipped there. |
| `src/components/Layout.test.tsx` | Modify (append one describe) | Proves the ornament mounts inside the sidebar and only for `nouveau`. |
| `src/components/theme/ThemeSwatchGrid.tsx` | Modify | Sixth picker tile; `SWATCHES` becomes exported so a test can check it against the CSS. |
| `src/components/theme/ThemeSwatchGrid.test.tsx` | Modify (counts + one new test) | Six tiles, and swatch colours match `src/index.css`. |
| `e2e/desktop-guards.spec.ts` | Modify (line 101) | Runs the 3:1 interactive-border guard against the new theme. |
| `CHANGELOG.md` | Modify (`[Unreleased]`) | User-facing note. |

---

### Task 1: Theme tokens, store registration, and a token-parity guard

**Files:**
- Modify: `src/index.css` (insert a new block after the `[data-theme='aurora']` block ends at line 191, i.e. between `aurora` and `glass`, or after `glass` ends at line 220. either position works; put it after `glass` so the file reads in cycle order)
- Modify: `src/index.css:280` (the `.themed-card` rule). CORRECTED: the plan originally said `src/App.css:5-12`, which holds `.counter`, not `.themed-card`.
- Modify: `src/store/useThemeStore.ts`
- Modify: `src/store/useThemeStore.test.ts:19-27` (the cycle test only)
- Test: `src/theme-tokens.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AppTheme = 'geometric' | 'tactical' | 'luxury' | 'aurora' | 'glass' | 'nouveau'`
  - `export const LIGHT_THEMES: ReadonlySet<AppTheme>` containing `'geometric'` and `'nouveau'`
  - `THEME_BACKGROUNDS['nouveau'] === '#FDF6EA'`
  - CSS custom property `--ornament: #C49E4A`, read by Task 4
  - CSS custom property `--card-gradient`, read by `.themed-card`

- [ ] **Step 1: Write the failing test**

Create `src/theme-tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { THEME_BACKGROUNDS, type AppTheme } from './store/useThemeStore'

// Read the stylesheet as text, not through jsdom. jsdom does not resolve
// custom properties declared in a stylesheet (getComputedStyle returns ''),
// so any assertion made through the CSSOM here would pass no matter what the
// file said. Parsing the source is the only way this guard can actually fail.
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

const THEMES: AppTheme[] = ['geometric', 'tactical', 'luxury', 'aurora', 'glass', 'nouveau']

function blockFor(theme: string): string {
  const marker = `[data-theme='${theme}'] {`
  const start = css.indexOf(marker)
  if (start === -1) throw new Error(`no [data-theme='${theme}'] block in src/index.css`)
  const end = css.indexOf('\n}', start)
  if (end === -1) throw new Error(`unterminated [data-theme='${theme}'] block in src/index.css`)
  return css.slice(start, end)
}

function tokensIn(theme: string): string[] {
  return [...blockFor(theme).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1])
}

// Geometric is the reference set: it is the oldest block and every other
// theme has always mirrored it. A theme may declare extra tokens of its own
// (nouveau adds --ornament and --card-gradient); it may not be missing one.
const REQUIRED = tokensIn('geometric')

describe('theme token blocks', () => {
  it.each(THEMES)('%s declares every token geometric declares', (theme) => {
    const present = tokensIn(theme)
    expect(REQUIRED.filter((t) => !present.includes(t))).toEqual([])
  })

  it.each(THEMES)('%s declares a color-scheme', (theme) => {
    expect(blockFor(theme)).toMatch(/color-scheme:\s*(light|dark)/)
  })

  // THEME_BACKGROUNDS exists only because jsdom cannot read the stylesheet,
  // which means nothing but this test stops the two copies drifting apart.
  it.each(THEMES)('%s THEME_BACKGROUNDS entry matches its --bg-primary', (theme) => {
    const match = /--bg-primary:\s*(#[0-9a-fA-F]{3,8})/.exec(blockFor(theme))
    expect(match).not.toBeNull()
    expect(THEME_BACKGROUNDS[theme].toLowerCase()).toBe(match![1].toLowerCase())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme-tokens.test.ts`

Expected: FAIL. Three failing cases (`nouveau declares every token…`, `nouveau declares a color-scheme`, `nouveau THEME_BACKGROUNDS entry…`), each with `Error: no [data-theme='nouveau'] block in src/index.css`. The other fifteen cases pass.

Note: `AppTheme` does not include `'nouveau'` yet, so the `THEMES` array is a type error. Vitest strips types with esbuild and does not typecheck, so the test still runs and gives this RED. `npm run build` would reject it; that is fixed in Step 3.

- [ ] **Step 3: Register the theme in the store**

In `src/store/useThemeStore.ts`, change line 5:

```ts
export type AppTheme = 'geometric' | 'tactical' | 'luxury' | 'aurora' | 'glass' | 'nouveau'
```

Change line 13:

```ts
const THEME_CYCLE: AppTheme[] = ['geometric', 'tactical', 'luxury', 'aurora', 'glass', 'nouveau']
```

Add this export immediately below `THEME_CYCLE`:

```ts
/** Themes whose --bg-primary is light. App.tsx drives Tailwind's `dark`
 *  class off this set. A new light theme left out of it renders every
 *  dark-mode utility in the app over a cream background, and nothing else
 *  in the codebase would catch that. */
export const LIGHT_THEMES: ReadonlySet<AppTheme> = new Set<AppTheme>(['geometric', 'nouveau'])
```

Add the entry to `THEME_BACKGROUNDS` (after `glass: '#0b0910',`):

```ts
  nouveau: '#FDF6EA',
```

- [ ] **Step 4: Add the CSS token block**

In `src/index.css`, insert this immediately after the closing brace of the `[data-theme='glass']` block (which ends at line 220):

```css
/* Gilded Bloom: the second light theme, and the first with any depth to it.
   Where `geometric` is flat white on white, this one gets its elevation from
   four stacked things: a warm-tinted shadow rather than a grey one, a
   gradient card fill, a 1px white inner top highlight folded into the same
   box-shadow, and the wash ThemeBackground paints behind everything.

   Contrast against --bg-primary #FDF6EA: accent 5.80:1, text-primary
   14.57:1, text-secondary 4.65:1, border-strong 3.41:1 on the page and
   3.61:1 on a card, error 5.09:1.

   --ornament is 2.35:1 and is decoration only. It must never carry text or
   mark a control. SidebarFloral is its only consumer. */
[data-theme='nouveau'] {
  --bg-primary: #FDF6EA;
  --bg-secondary: #F5EDDD;
  --text-primary: #22251F;
  --text-secondary: #6E7266;
  --accent: #2F6B5E;
  --border-color: #EADFCB;
  --border-strong: #8C866B;   /* 3.41:1 on #FDF6EA, 3.61:1 on the card */
  --error: #B04A2E;
  --chart-1: #2F6B5E;
  --chart-2: #A8842F;
  --chart-3: #9A5A6B;
  --chart-4: #7B7F52;
  --chart-5: #46708F;
  --chart-6: #B04A2E;

  /* Gold leaf for the sidebar ornament. Not a text or control colour. */
  --ornament: #C49E4A;

  --font-family-body: 'Poppins', sans-serif;
  --font-family-display: 'Playfair Display', serif;

  --card-bg: #FFFDF9;
  --card-gradient: linear-gradient(172deg, #FFFDF9 0%, #FCF5E8 100%);
  --card-border: #EDE2CE;
  --card-shadow: 0 1px 2px rgba(60, 60, 30, 0.06), 0 12px 30px -14px rgba(60, 60, 30, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.95);
  --card-blur: none;
  --dropdown-bg: #FFFDF9;

  color-scheme: light;
  --calendar-filter: invert(0);
}
```

- [ ] **Step 5: Let a card carry a gradient**

In `src/index.css`, replace the `.themed-card` rule at line 280 with:

```css
.themed-card {
  background-color: var(--card-bg);
  /* A theme may layer a gradient over its flat fill. `background-color`
     cannot hold one, so a gradient assigned to --card-bg alone would be an
     invalid background-color and silently drop the card's fill entirely.
     Every theme that does not define --card-gradient falls through to
     `none` and paints exactly as it did before. */
  background-image: var(--card-gradient, none);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
}
```

- [ ] **Step 6: Run the parity test to verify it passes**

Run: `npx vitest run src/theme-tokens.test.ts`

Expected: PASS, 18 tests.

- [ ] **Step 7: Update the existing cycle test**

In `src/store/useThemeStore.test.ts`, edit **only** the `cycles forward through every theme` test (lines 19-27). Change the loop bound from `5` to `6` and add `'nouveau'` before `'geometric'` in the expectation:

```ts
  it('cycles forward through every theme', () => {
    useThemeStore.getState().setTheme('geometric')
    const seen: string[] = []
    for (let i = 0; i < 6; i++) {
      useThemeStore.getState().cycleTheme()
      seen.push(useThemeStore.getState().theme)
    }
    expect(seen).toEqual(['tactical', 'luxury', 'aurora', 'glass', 'nouveau', 'geometric'])
  })
```

Leave the other two tests in that file untouched.

- [ ] **Step 8: Run the store tests to verify they pass**

Run: `npx vitest run src/store/useThemeStore.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 9: Commit**

```bash
git add src/index.css src/store/useThemeStore.ts src/store/useThemeStore.test.ts src/theme-tokens.test.ts
git commit -m "feat(theme): add Gilded Bloom tokens and a theme token parity guard"
```

---

### Task 2: Treat Gilded Bloom as a light theme

`src/App.tsx:26` decides Tailwind's `dark` class with `theme === 'geometric'`. A second light theme not handled here gets every dark-mode utility in the app painted over a cream background.

**Files:**
- Modify: `src/App.tsx:19` (import) and `src/App.tsx:26`
- Test: `src/App.test.tsx` (append one test inside the existing top-level `describe`)

**Interfaces:**
- Consumes: `LIGHT_THEMES` and `THEME_BACKGROUNDS` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append this test to `src/App.test.tsx`, immediately after the existing `keeps the browser chrome colour in step with the active theme` test and inside the same `describe`:

```ts
  it('treats Gilded Bloom as a light theme, not a dark one', async () => {
    useThemeStore.getState().setTheme('luxury')
    render(<App />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await act(async () => { useThemeStore.getState().setTheme('nouveau') })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('nouveau')
    expect((document.querySelector('meta[name="theme-color"]') as HTMLMetaElement).content).toBe('#FDF6EA')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx -t "Gilded Bloom"`

Expected: FAIL at the first `nouveau` assertion, `expected true to be false`, because the `else` branch still adds `dark` for every theme that is not `geometric`.

- [ ] **Step 3: Drive the class off the set**

In `src/App.tsx`, change the import on line 19 (leave the rest of the import list alone):

```ts
import { useThemeStore, THEME_BACKGROUNDS, LIGHT_THEMES } from './store/useThemeStore'
```

Replace lines 26-30:

```ts
    if (LIGHT_THEMES.has(theme)) {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.test.tsx`

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "fix(theme): drive the dark class off LIGHT_THEMES so a second light theme works"
```

---

### Task 3: Warm background wash

`ThemeBackground` renders full-viewport decoration for `aurora` and `glass` and `null` for everything else. Gilded Bloom gets two static radial washes and no animation: `e2e/desktop-guards.spec.ts` waits on every finite running animation before measuring colour, and a looping one here would add nothing but flake risk.

**Files:**
- Modify: `src/components/theme/ThemeBackground.tsx`
- Test: `src/components/theme/ThemeBackground.test.tsx` (create)

**Interfaces:**
- Consumes: `AppTheme` from Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/components/theme/ThemeBackground.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeBackground } from './ThemeBackground'

describe('ThemeBackground', () => {
  it.each(['geometric', 'tactical', 'luxury'] as const)('draws nothing for %s', (theme) => {
    const { container } = render(<ThemeBackground theme={theme} />)
    expect(container).toBeEmptyDOMElement()
  })

  it.each(['aurora', 'glass', 'nouveau'] as const)('draws a fixed decoration layer for %s', (theme) => {
    const { container } = render(<ThemeBackground theme={theme} />)
    const root = container.firstElementChild!
    expect(root).not.toBeNull()
    expect(root.className).toMatch(/fixed/)
    expect(root.className).toMatch(/pointer-events-none/)
  })

  // The desktop contrast guard waits for finite animations to settle before
  // reading any colour, and skips infinite ones. A looping animation here
  // would buy nothing and could only add flake, so this theme has none.
  it('runs no looping animation for nouveau', () => {
    const { container } = render(<ThemeBackground theme="nouveau" />)
    // Assert the layer exists first. Without this line the "no animation"
    // half also passes against a component that renders nothing at all,
    // which is exactly the state this test starts from.
    expect(container.querySelector('[data-testid="nouveau-wash"]')).not.toBeNull()
    expect(container.querySelectorAll('[class*="animate-float"]')).toHaveLength(0)
  })

  it('paints the nouveau wash with warm radial gradients', () => {
    const { container } = render(<ThemeBackground theme="nouveau" />)
    const wash = container.querySelector('[data-testid="nouveau-wash"]') as HTMLElement
    expect(wash).not.toBeNull()
    expect(wash.style.backgroundImage).toMatch(/radial-gradient/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/theme/ThemeBackground.test.tsx`

Expected: FAIL, with all four `nouveau` cases failing because the component returns `null`: the decoration-layer case fails reading `className` of `null`, and the other three fail `expected null not to be null` on the wash lookup. The three `geometric`/`tactical`/`luxury` cases and the two `aurora`/`glass` cases pass.

- [ ] **Step 3: Add the nouveau branch**

In `src/components/theme/ThemeBackground.tsx`, insert this block immediately before the final `return null`:

```tsx
  if (theme === 'nouveau') {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#FDF6EA]">
        {/* Two static washes: warm light spilling in from the top right, and
            a cooler sand tone pooling at the bottom left, so a full-screen
            page is not one flat field of cream. Deliberately not animated,
            unlike aurora and glass. */}
        <div
          data-testid="nouveau-wash"
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(900px 440px at 92% -8%, rgba(255, 242, 214, 0.9), transparent 68%), ' +
              'radial-gradient(640px 440px at -4% 100%, rgba(222, 212, 182, 0.45), transparent 72%)',
          }}
        />
      </div>
    )
  }

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/theme/ThemeBackground.test.tsx`

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/ThemeBackground.tsx src/components/theme/ThemeBackground.test.tsx
git commit -m "feat(theme): add the Gilded Bloom background wash"
```

---

### Task 4: The SidebarFloral ornament

A self-contained SVG: three sweeping stems with leaves and tendrils in `--ornament` gold, and three stylised four-petal blooms in `--accent` peacock. It renders `null` for every other theme, so mounting it unconditionally in Task 5 costs nothing anywhere else.

The wrapper takes its z-index from an inline style rather than a Tailwind `-z-10` class. It has to paint behind the sidebar's in-flow nav links, and an inline value cannot be lost to a utility that was never generated. It is also the one thing here a jsdom test can assert truthfully, since jsdom keeps inline styles it can parse.

**Files:**
- Create: `src/components/theme/SidebarFloral.tsx`
- Test: `src/components/theme/SidebarFloral.test.tsx`

**Interfaces:**
- Consumes: `AppTheme` from Task 1; the `--ornament` and `--accent` custom properties from Task 1's CSS block.
- Produces: `export const SidebarFloral: React.FC<{ theme: AppTheme }>`, rendering a wrapper carrying `data-testid="sidebar-floral"`. Task 5 mounts this.

- [ ] **Step 1: Write the failing test**

Create `src/components/theme/SidebarFloral.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SidebarFloral } from './SidebarFloral'

describe('SidebarFloral', () => {
  it.each(['geometric', 'tactical', 'luxury', 'aurora', 'glass'] as const)(
    'renders nothing for %s',
    (theme) => {
      const { container } = render(<SidebarFloral theme={theme} />)
      expect(container).toBeEmptyDOMElement()
    },
  )

  it('renders an ornament for nouveau', () => {
    const { getByTestId } = render(<SidebarFloral theme="nouveau" />)
    expect(getByTestId('sidebar-floral').querySelector('svg')).not.toBeNull()
  })

  // Pure decoration with no text: it must be hidden from assistive tech and
  // must never swallow a click aimed at the nav links behind it.
  it('is hidden from assistive tech and not clickable', () => {
    const { getByTestId } = render(<SidebarFloral theme="nouveau" />)
    const wrapper = getByTestId('sidebar-floral')
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')
    expect(wrapper.className).toMatch(/pointer-events-none/)
  })

  // It paints inside the sidebar's own stacking context, behind the nav
  // links. A positive or auto z-index here would cover them.
  it('sits behind the sidebar content', () => {
    const { getByTestId } = render(<SidebarFloral theme="nouveau" />)
    const wrapper = getByTestId('sidebar-floral')
    expect(wrapper.style.zIndex).toBe('-10')
    expect(wrapper.className).toMatch(/absolute/)
    expect(wrapper.className).toMatch(/overflow-hidden/)
  })

  // The gold and the peacock green both come from the theme block, so
  // changing the palette in one place changes the ornament too.
  it('draws from theme tokens rather than hardcoded colours', () => {
    const { getByTestId } = render(<SidebarFloral theme="nouveau" />)
    const svg = getByTestId('sidebar-floral').querySelector('svg') as SVGSVGElement
    expect(svg.style.color).toBe('var(--ornament)')
    const blooms = getByTestId('sidebar-floral').querySelector('[data-testid="floral-blooms"]') as SVGGElement
    expect(blooms).not.toBeNull()
    expect(blooms.style.color).toBe('var(--accent)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/theme/SidebarFloral.test.tsx`

Expected: FAIL to collect, with `Failed to resolve import "./SidebarFloral"`.

- [ ] **Step 3: Write the component**

Create `src/components/theme/SidebarFloral.tsx`:

```tsx
import React from 'react'
import type { AppTheme } from '../../store/useThemeStore'

interface SidebarFloralProps {
  theme: AppTheme
}

/** The art nouveau ornament for the Gilded Bloom theme: whiplash stems in
 *  gold leaf sweeping up out of the bottom left, with stylised four-petal
 *  blooms in the theme accent.
 *
 *  It is mounted inside the desktop sidebar rather than in ThemeBackground
 *  on purpose. ThemeBackground paints the full viewport, and cards are
 *  opaque, so ornament placed there would be visible only in whatever gaps
 *  the page happened to leave. Confined to the sidebar it always has a
 *  reliable, uncluttered field to draw on, and it can never intrude on the
 *  data.
 *
 *  Sizes are fixed rather than responsive: the sidebar is a fixed w-64, so a
 *  256px drawing anchored to the bottom left lands the same way at every
 *  window height, and the wrapper's overflow-hidden clips it. On a phone
 *  there is no desktop sidebar and therefore no ornament, which is the
 *  intended scope for this theme.
 *
 *  Every id is prefixed `gb-` because these live in the main document, not a
 *  shadow root, and a bare `#leaf` would be one collision away from another
 *  component's defs. */
export const SidebarFloral: React.FC<SidebarFloralProps> = ({ theme }) => {
  if (theme !== 'nouveau') return null

  return (
    <div
      aria-hidden="true"
      data-testid="sidebar-floral"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      // Inline rather than a `-z-10` utility: this has to paint behind the
      // sidebar's in-flow nav links, and an inline value cannot go missing
      // because a utility was never generated.
      style={{ zIndex: -10 }}
    >
      <svg
        width="256"
        height="520"
        viewBox="0 0 256 520"
        className="absolute bottom-0 left-0"
        style={{ color: 'var(--ornament)' }}
      >
        <defs>
          <g id="gb-leaf">
            <path d="M0,0 C4,-5 12,-5.4 16.5,0 C12,5.4 4,5 0,0 Z" fill="none" stroke="currentColor" strokeWidth="1.15" />
            <path d="M1.5,0 L15,0" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.75" />
          </g>
          <g id="gb-bud">
            <path d="M0,0 C-3.4,-3 -3.2,-8.4 0,-11.4 C3.2,-8.4 3.4,-3 0,0 Z" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <path d="M0,0 L0,5.5" fill="none" stroke="currentColor" strokeWidth="1" />
          </g>
          <g id="gb-tendril">
            <path
              d="M0,0 C9,-7 19,-2.5 16.5,7 C14.6,14 6,14.6 4.6,7.6 C3.7,3.2 8.4,0.6 11,4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.05"
              strokeLinecap="round"
            />
          </g>
          <g id="gb-bloom">
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M0,-5 C11,-27 33,-22 27,-3 C23.6,8 8,9 0,-5 Z" />
              <path d="M0,-5 C11,-27 33,-22 27,-3 C23.6,8 8,9 0,-5 Z" transform="rotate(90)" />
              <path d="M0,-5 C11,-27 33,-22 27,-3 C23.6,8 8,9 0,-5 Z" transform="rotate(180)" />
              <path d="M0,-5 C11,-27 33,-22 27,-3 C23.6,8 8,9 0,-5 Z" transform="rotate(270)" />
            </g>
            <circle r="5.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </g>
        </defs>

        <g opacity="0.62">
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d="M40,520 C104,456 74,372 124,306 C168,248 148,166 196,110" strokeWidth="2.1" />
            <path d="M40,520 C82,474 136,448 170,392 C200,342 190,282 160,244" strokeWidth="1.4" opacity="0.8" />
            <path d="M96,520 C142,482 166,436 174,380" strokeWidth="1.1" opacity="0.6" />
          </g>

          <use href="#gb-leaf" transform="translate(78,450) rotate(-48) scale(1.9)" />
          <use href="#gb-leaf" transform="translate(88,394) rotate(196) scale(1.7)" />
          <use href="#gb-leaf" transform="translate(112,334) rotate(-36) scale(1.8)" />
          <use href="#gb-leaf" transform="translate(142,266) rotate(198) scale(1.6)" />
          <use href="#gb-leaf" transform="translate(166,198) rotate(-40) scale(1.5)" />
          <use href="#gb-tendril" transform="translate(168,442) rotate(-20) scale(1.6)" />
          <use href="#gb-tendril" transform="translate(60,296) rotate(152) scale(1.4)" />

          <g data-testid="floral-blooms" style={{ color: 'var(--accent)' }} opacity="0.55">
            <use href="#gb-bloom" transform="translate(202,96) scale(1.15)" />
            <use href="#gb-bloom" transform="translate(110,378) scale(0.82)" />
            <use href="#gb-bud" transform="translate(168,322) rotate(-30) scale(1.7)" />
          </g>
        </g>
      </svg>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/theme/SidebarFloral.test.tsx`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/SidebarFloral.tsx src/components/theme/SidebarFloral.test.tsx
git commit -m "feat(theme): add the Gilded Bloom sidebar ornament"
```

---

### Task 5: Mount the ornament in the desktop sidebar

**Files:**
- Modify: `src/components/Layout.tsx` (import list, and the desktop `<nav>` opening tag region)
- Test: `src/components/Layout.test.tsx` (append one `describe` at the end of the file)

**Interfaces:**
- Consumes: `SidebarFloral` from Task 4; `theme` from the `useThemeStore()` call already on `src/components/Layout.tsx:29`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Append this to the end of `src/components/Layout.test.tsx`. `useThemeStore` is not imported in that file yet, so add the import alongside the existing ones at the top:

```ts
import { useThemeStore } from '../store/useThemeStore'
```

Then append:

```tsx
describe('Layout sidebar ornament', () => {
  afterEach(() => useThemeStore.setState({ theme: 'luxury' }))

  it('draws the floral inside the sidebar for the Gilded Bloom theme', () => {
    useThemeStore.setState({ theme: 'nouveau' })
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    const sidebar = container.querySelector('nav.desktop\\:flex')!
    // Queried from the sidebar, not the document: the whole point of this
    // ornament is that it cannot escape into the page.
    expect(sidebar.querySelector('[data-testid="sidebar-floral"]')).not.toBeNull()
  })

  it('draws no floral for any other theme', () => {
    useThemeStore.setState({ theme: 'luxury' })
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)
    expect(container.querySelector('[data-testid="sidebar-floral"]')).toBeNull()
  })
})
```

Add `afterEach` to the existing `vitest` import on line 1 of that file:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Layout.test.tsx -t "sidebar ornament"`

Expected: FAIL on the first case, `expected null not to be null`. The second case passes already, which is correct: it is the regression half of the pair.

- [ ] **Step 3: Mount the component**

In `src/components/Layout.tsx`, add the import immediately after the existing `ThemeBackground` import on line 4:

```ts
import { SidebarFloral } from './theme/SidebarFloral'
```

Then, inside the desktop `<nav>`, add `<SidebarFloral theme={theme} />` as its first child, immediately above the `sidebar-divider` element:

```tsx
      <nav className="hidden desktop:flex w-64 shrink-0 relative border-r border-transparent bg-bg-secondary/70 backdrop-blur-[var(--card-blur)] flex-col justify-between overflow-y-auto transition-all duration-300 z-10">
        {/* Theme ornament, clipped to the sidebar. Renders null for every
            theme but Gilded Bloom. The nav is `relative z-10`, so it owns a
            stacking context and the ornament's negative z-index keeps it
            behind the links without escaping the sidebar. */}
        <SidebarFloral theme={theme} />
        {/* The divider fades in from the top rather than starting at a hard
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Layout.test.tsx`

Expected: PASS, every test in the file including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "feat(theme): mount the Gilded Bloom ornament in the desktop sidebar"
```

---

### Task 6: Theme picker tile

`ThemeSwatchGrid` draws a tiny caricature of the app per theme. Its `SWATCHES` colours are a hand-copy of `src/index.css`, with nothing checking they stay in step. This task adds the sixth tile and closes that gap.

Append `nouveau` at the **end** of the `SWATCHES` object. The existing test asserts `polyline[2]` has luxury's stroke; appending keeps luxury at index 2, inserting anywhere earlier breaks it.

**Files:**
- Modify: `src/components/theme/ThemeSwatchGrid.tsx:6-14`
- Test: `src/components/theme/ThemeSwatchGrid.test.tsx` (edit two existing assertions, append one test)

**Interfaces:**
- Consumes: `AppTheme` from Task 1.
- Produces: `export const SWATCHES: Record<AppTheme, { name: string; bg: string; accent: string; headerBg: string; light?: boolean; spark: string }>` previously module-private, exported so the parity test can read it.

- [ ] **Step 1: Write the failing test**

In `src/components/theme/ThemeSwatchGrid.test.tsx`, edit the existing assertions in place:

- In `renders all five themes with the active one marked`, rename the test to `renders every theme with the active one marked` and change `toHaveLength(5)` to `toHaveLength(6)`.
- In `renders a sparkline preview in every tile`, change `toHaveLength(5)` to `toHaveLength(6)`. Leave the `polyline[2]` stroke assertion exactly as it is.

Then add these imports at the top of the file:

```ts
import { readFileSync } from 'node:fs'
import { SWATCHES } from './ThemeSwatchGrid'
```

and append this `describe` at the end:

```ts
// The swatch colours are a hand-copy of src/index.css. Nothing but this
// stopped them drifting: a theme could be recoloured and its picker tile
// would keep advertising the old palette.
describe('ThemeSwatchGrid swatch parity with src/index.css', () => {
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

  const valueIn = (theme: string, token: string): string => {
    const start = css.indexOf(`[data-theme='${theme}'] {`)
    const block = css.slice(start, css.indexOf('\n}', start))
    const match = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{3,8})`).exec(block)
    if (!match) throw new Error(`no ${token} in [data-theme='${theme}']`)
    return match[1].toLowerCase()
  }

  it.each(Object.keys(SWATCHES))('%s tile mirrors the theme background', (theme) => {
    expect(SWATCHES[theme as keyof typeof SWATCHES].bg.toLowerCase()).toBe(valueIn(theme, '--bg-primary'))
  })

  it('names the sixth theme Gilded Bloom and marks it light', () => {
    expect(SWATCHES.nouveau.name).toBe('Gilded Bloom')
    expect(SWATCHES.nouveau.light).toBe(true)
    expect(SWATCHES.nouveau.accent.toLowerCase()).toBe(valueIn('nouveau', '--accent'))
  })
})
```

Note the `geometric` tile currently carries `accent: '#3b82f6'` while the CSS says `#2563eb`. That is a deliberate pre-existing choice for tile legibility, which is why the per-theme parity case checks `bg` only and the accent is asserted for `nouveau` alone. Do not "fix" the geometric accent.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/theme/ThemeSwatchGrid.test.tsx`

Expected: FAIL to collect, with `"SWATCHES" is not exported by "src/components/theme/ThemeSwatchGrid.tsx"`.

- [ ] **Step 3: Export SWATCHES and add the tile**

In `src/components/theme/ThemeSwatchGrid.tsx`, change line 6 from `const SWATCHES` to:

```tsx
export const SWATCHES: Record<AppTheme, { name: string; bg: string; accent: string; headerBg: string; light?: boolean; spark: string }> = {
```

and add this entry after the `glass` line, as the last property:

```tsx
  nouveau: { name: 'Gilded Bloom', bg: '#FDF6EA', accent: '#2F6B5E', headerBg: '#F5EDDD', light: true, spark: '0,13 12,11 24,7 36,9 48,4 60,2' },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/theme/ThemeSwatchGrid.test.tsx`

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/ThemeSwatchGrid.tsx src/components/theme/ThemeSwatchGrid.test.tsx
git commit -m "feat(theme): add the Gilded Bloom picker tile and a swatch parity guard"
```

---

### Task 7: Extend the interactive-border contrast guard

`e2e/desktop-guards.spec.ts:101` holds the list of themes the 3:1 border guard runs against. A theme left out of it ships unmeasured.

**Files:**
- Modify: `e2e/desktop-guards.spec.ts:101`

**Interfaces:**
- Consumes: the theme key `nouveau`, persisted under `financial-dashboard-theme` by the guard's own `addInitScript`.
- Produces: nothing.

- [ ] **Step 1: Add the theme to the guard list**

Change line 101 to:

```ts
const THEMES = ['geometric', 'tactical', 'luxury', 'aurora', 'glass', 'nouveau'] as const
```

- [ ] **Step 2: Run the guard for the new theme only**

Run: `npx playwright test e2e/desktop-guards.spec.ts --project=chromium -g "nouveau"`

Expected: PASS, 1 test (`interactive borders reach 3:1 in the nouveau theme`).

If it fails, the report lists each offending control with its measured ratio. `--border-strong` was computed at 3.41:1 against `#FDF6EA` and 3.61:1 against the card before this plan was written, so a failure means a control is drawing its border from `--border-color` (decorative, roughly 1.2:1) rather than `.control-border`. Fix the control by adding `control-border`, not by darkening the decorative token.

- [ ] **Step 3: Run the full desktop guard suite**

Run: `npx playwright test e2e/desktop-guards.spec.ts --project=chromium`

Expected: PASS. This confirms the new theme did not disturb the other five.

- [ ] **Step 4: Commit**

```bash
git add e2e/desktop-guards.spec.ts
git commit -m "test(theme): run the interactive border guard against Gilded Bloom"
```

---

### Task 8: Changelog, cleanup, and full verification

**Files:**
- Modify: `CHANGELOG.md` (the `[Unreleased]` section)
- Delete: `public/theme6-mockups.html`, `public/theme6-floral-mockups.html`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Remove the mockup scratch copies from public/**

Two throwaway mockup pages were copied into `public/` so the dev server could serve them during design. Anything in `public/` is copied verbatim into `dist/`, so leaving them there ships them. The originals stay in `docs/mockups/`.

```bash
git rm --cached --ignore-unmatch public/theme6-mockups.html public/theme6-floral-mockups.html
rm -f public/theme6-mockups.html public/theme6-floral-mockups.html
```

- [ ] **Step 2: Verify they are gone**

Run: `ls public`

Expected: `favicon.svg`, `icon-192x192-v2.png`, `icon-512x512-maskable-v2.png`, `icon-512x512-v2.png`, `icons.svg`. No `theme6-*.html`.

- [ ] **Step 3: Add the changelog entry**

In `CHANGELOG.md`, replace the line `## [Unreleased]` and the blank line under it with:

```markdown
## [Unreleased]

### Added
- A sixth theme, Gilded Bloom: a warm light theme with softly raised cards, peacock green accents, and an art nouveau floral drawn in gold down the desktop sidebar. Pick it in Settings alongside the other five
```

- [ ] **Step 4: Run the full verification**

Run: `npm run verify`

Expected: PASS end to end. Lint reports 0 problems, the unit suite passes with roughly 1285 tests (1240 before this work, plus the 45 added here: 18 token parity, 8 background, 9 floral, 7 swatch, 2 layout, 1 app), `tsc -b` and the Vite build succeed, the three check scripts pass, and the Playwright suite passes across all five projects.

If `check:bundle` fails, read its output before changing anything: this work adds one small component to the entry chunk and should move the budget by well under a kilobyte.

- [ ] **Step 5: Manual look, because no automated test can judge this**

Run: `npm run dev`

Open the app, go to Settings, and pick **Gilded Bloom**. Confirm all six of these, since none is covered by a test:

1. The sidebar ornament is visible behind the nav links and does not overlap or obscure any label.
2. The ornament is clipped at the sidebar's right edge and does not bleed into the page.
3. Nav links, the Search button, and the Settings dock are all fully clickable, i.e. the ornament is not intercepting pointer events.
4. Cards show the gradient fill and the warm shadow, not a flat white rectangle. A flat card with no fill means `--card-gradient` is not reaching `.themed-card`.
5. Headings render in Playfair Display and body text in Poppins.
6. Narrow the window below the desktop breakpoint: the sidebar and its ornament both disappear together, and the mobile top bar and tab bar render normally over the warm background.

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md public
git commit -m "docs(theme): note Gilded Bloom in the changelog and drop the mockup scratch files"
```

---

## Notes for the reviewer

Three things in this plan live between tasks, where a per-task review cannot see them:

1. **Task 2, corrected after the final review.** `src/App.tsx:26` read `theme === 'geometric'`, and driving it off `LIGHT_THEMES` is correct hygiene. But this plan claimed a second light theme would otherwise paint "every Tailwind dark-mode utility over a cream background", and that claim is FALSE: the final review grepped `src/` and found zero `dark:` utilities and no `@custom-variant dark`. The `dark` class currently has no consumer in this app. Task 2 prevents a future bug, not a present one. Recorded so the next maintainer is not misled by the original claim.
2. **Task 1's `.themed-card` change is load-bearing for Task 1's own CSS.** `--card-gradient` is read from `src/App.css`, not from `src/index.css`. If Step 5 of Task 1 is skipped, the token block still parses, the parity test still passes, and every card in the new theme silently loses its gradient. The manual check in Task 8 Step 5 item 4 is the only thing that catches it.
3. **The mockup's 16px card radius is deliberately not implemented.** Card corner radius in this app is a Tailwind class chosen per component, not a theme token. Matching the mockup exactly would mean adding a `--card-radius` token and touching every card call site, which is a much larger change than a theme and is not in this plan's scope. Cards keep whatever radius they already have. If that reads wrong once it is running, it is a separate piece of work.
4. **Task 6 depends on append order.** `ThemeSwatchGrid.test.tsx` asserts `polyline[2]` carries luxury's `#d4a853`. That index comes from `Object.keys(SWATCHES)`. Appending `nouveau` last preserves it; inserting it anywhere earlier breaks a test that has nothing to do with the new theme.
