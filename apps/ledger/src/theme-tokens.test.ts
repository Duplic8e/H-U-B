import { readFileSync } from 'node:fs'
import { URL as NodeURL } from 'node:url'
import { THEME_BACKGROUNDS, type AppTheme } from './store/useThemeStore'

// Read the stylesheet as text, not through jsdom. jsdom does not resolve
// custom properties declared in a stylesheet (getComputedStyle returns ''),
// so any assertion made through the CSSOM here would pass no matter what the
// file said. Parsing the source is the only way this guard can actually fail.
//
// Explicitly import URL from node:url rather than using the ambient global:
// this suite runs under the jsdom test environment, which replaces the
// global URL constructor with its own implementation. jsdom's URL resolves
// a string base against its document location (http://localhost) rather
// than against this test file, so the relative path never becomes a file:
// URL. Node's own URL resolves it correctly, sidestepping jsdom entirely.
const css = readFileSync(new NodeURL('./index.css', import.meta.url), 'utf8')

const THEMES: AppTheme[] = ['light', 'dark']

// Generalized over blockFor so the bare :root block (which is not keyed by
// theme name) can be read the same way as a [data-theme='x'] block.
function rawBlockFor(selector: string): string {
  const marker = `${selector} {`
  const start = css.indexOf(marker)
  if (start === -1) throw new Error(`no ${selector} block in src/index.css`)
  const end = css.indexOf('\n}', start)
  if (end === -1) throw new Error(`unterminated ${selector} block in src/index.css`)
  return css.slice(start, end)
}

function blockFor(theme: string): string {
  return rawBlockFor(`[data-theme='${theme}']`)
}

function tokenFor(selector: string, token: string): string {
  const match = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{3,8})`).exec(rawBlockFor(selector))
  if (!match) throw new Error(`no ${token} in ${selector} block`)
  return match[1].toLowerCase()
}

function tokensIn(theme: string): string[] {
  return [...blockFor(theme).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1])
}

// Light is the reference set. Dark may declare extra tokens of its own; it
// may not be missing one.
const REQUIRED = tokensIn('light')

describe('theme token blocks', () => {
  it.each(THEMES)('%s declares every token light declares', (theme) => {
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

  it('the first paint (:root) is the light palette', () => {
    for (const token of ['--bg-primary', '--accent', '--text-primary', '--text-secondary']) {
      expect(tokenFor(':root', token)).toBe(tokenFor("[data-theme='light']", token))
    }
  })
})
