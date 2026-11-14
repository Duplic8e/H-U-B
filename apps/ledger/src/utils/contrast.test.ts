import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { contrastRatio, compositeOver } from './contrast'

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

/** Pulls every theme block out of index.css so a newly added theme is covered
 *  by this test automatically instead of silently shipping unreadable text. */
function themeBlocks(): Array<{ name: string; tokens: Record<string, string> }> {
  const blocks: Array<{ name: string; tokens: Record<string, string> }> = []
  const re = /(:root|\[data-theme='([a-z]+)'\])\s*\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    const name = m[2] ?? 'root'
    const tokens: Record<string, string> = {}
    for (const line of m[3].split(';')) {
      const kv = line.match(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*$/)
      if (kv) tokens[kv[1]] = kv[2]
    }
    if (tokens['bg-primary']) blocks.push({ name, tokens })
  }
  return blocks
}

describe('theme token contrast', () => {
  const blocks = themeBlocks()

  // Pinned to the exact set, not a count, and not a minimum. This used to
  // assert `blocks.length >= 6`, which still passed with a whole theme block
  // deleted once a sixth theme existed. `root` belongs in this list: the
  // regex above deliberately matches the `:root` fallback palette and names
  // it that, so its contrast is checked alongside the real themes.
  it('finds every theme defined in index.css', () => {
    const names = blocks.map((b) => b.name).sort()
    expect(names).toEqual(['dark', 'light', 'root'])
  })

  it.each(blocks.map((b) => [b.name, b] as const))(
    '%s meets AA for accent text on the primary background',
    (_name, block) => {
      expect(contrastRatio(block.tokens.accent, block.tokens['bg-primary'])).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(blocks.map((b) => [b.name, b] as const))(
    '%s meets AA for the success green on the primary and secondary backgrounds',
    (_name, block) => {
      expect(contrastRatio(block.tokens.success, block.tokens['bg-primary'])).toBeGreaterThanOrEqual(4.5)
      // Glass declares its secondary background as a translucent rgba, which this parser skips.
      if (block.tokens['bg-secondary']) expect(contrastRatio(block.tokens.success, block.tokens['bg-secondary'])).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(blocks.map((b) => [b.name, b] as const))(
    '%s meets AA for secondary text on the primary background',
    (_name, block) => {
      expect(contrastRatio(block.tokens['text-secondary'], block.tokens['bg-primary'])).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(blocks.map((b) => [b.name, b] as const))(
    '%s meets AA for primary text on the primary background',
    (_name, block) => {
      expect(contrastRatio(block.tokens['text-primary'], block.tokens['bg-primary'])).toBeGreaterThanOrEqual(4.5)
    },
  )
})

describe('opacity-modified text', () => {
  it('composites a colour over a background at an alpha', () => {
    expect(compositeOver('#ffffff', '#000000', 0.5)).toBe('#808080')
    expect(compositeOver('#ffffff', '#000000', 1)).toBe('#ffffff')
    expect(compositeOver('#ffffff', '#000000', 0)).toBe('#000000')
  })

  // Tailwind's /50 modifier on a text token fell below AA in every theme.
  // Anything reintroducing it should fail here rather than reaching users.
  it.each(themeBlocks().map((b) => [b.name, b] as const))(
    '%s secondary text at 50 percent opacity is below AA, so the modifier must not be used',
    (_name, block) => {
      const faded = compositeOver(block.tokens['text-secondary'], block.tokens['bg-primary'], 0.5)
      expect(contrastRatio(faded, block.tokens['bg-primary'])).toBeLessThan(4.5)
    },
  )
})

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return p.endsWith('.tsx') || p.endsWith('.ts') ? [p] : []
  })
}

describe('opacity modifiers on text tokens', () => {
  it('never uses an alpha low enough to break AA', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(resolve(__dirname, '..'))) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/text-text-secondary\/(\d+)/g)) {
        if (Number(m[1]) < 80) offenders.push(`${file}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
