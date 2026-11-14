import type { Page } from '@playwright/test'

/** Installs window.__contrast on the page: composited-background WCAG ratio
 *  maths, so a border declared with alpha is measured against what is
 *  actually behind it rather than against a guess. */
export async function installContrastHelpers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type C = { r: number; g: number; b: number; a: number }
    const parse = (s: string): C | null => {
      const m = s && s.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(',').map(Number)
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    const composite = (el: Element): C => {
      let cur: Element | null = el
      const stack: C[] = []
      while (cur) {
        const c = parse(getComputedStyle(cur).backgroundColor)
        if (c && c.a > 0) stack.push(c)
        if (c && c.a >= 1) break
        cur = cur.parentElement
      }
      stack.push({ r: 0, g: 0, b: 0, a: 1 })
      let out = stack[stack.length - 1]
      for (let i = stack.length - 2; i >= 0; i--) {
        const f = stack[i]
        out = { r: f.r * f.a + out.r * (1 - f.a), g: f.g * f.a + out.g * (1 - f.a), b: f.b * f.a + out.b * (1 - f.a), a: 1 }
      }
      return out
    }
    const lum = (c: C) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const ratio = (a: C, b: C) => {
      const l1 = lum(a), l2 = lum(b)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    ;(window as unknown as Record<string, unknown>).__contrast = {
      /** Ratio of an element's top border against the surface behind it.
       *  null means "nothing to measure" (no border at all), which is a
       *  legitimate skip for a control that identifies itself some other
       *  way. Used by the general interactive-control scan, which visits
       *  every button/input/select/textarea whether or not it opted into
       *  a strong border. */
      borderRatio(el: Element): number | null {
        const s = getComputedStyle(el)
        const bc = parse(s.borderTopColor)
        if (!bc || bc.a === 0 || parseFloat(s.borderTopWidth) === 0) return null
        const bg = composite(el.parentElement || document.body)
        const eff = { r: bc.r * bc.a + bg.r * (1 - bc.a), g: bc.g * bc.a + bg.g * (1 - bc.a), b: bc.b * bc.a + bg.b * (1 - bc.a), a: 1 }
        return ratio(eff, bg)
      },
      /** Same measurement, for an element that specifically opted into
       *  `.control-border`. That class exists to promise a 3:1 border, so an
       *  element carrying it with no visible border at all (width 0, or a
       *  transparent colour, typically from a missing `border` utility
       *  alongside it) is the defect this exists to catch, not a reason to
       *  skip: it returns 0 instead of null. */
      controlBorderRatio(el: Element): number {
        const s = getComputedStyle(el)
        const bc = parse(s.borderTopColor)
        if (!bc || bc.a === 0 || parseFloat(s.borderTopWidth) === 0) return 0
        const bg = composite(el.parentElement || document.body)
        const eff = { r: bc.r * bc.a + bg.r * (1 - bc.a), g: bc.g * bc.a + bg.g * (1 - bc.a), b: bc.b * bc.a + bg.b * (1 - bc.a), a: 1 }
        return ratio(eff, bg)
      },
      /** Ratio of an element's own composited background (its fill, as
       *  actually rendered) against the surface behind its parent. Used to
       *  decide whether a control identifies itself by fill rather than by
       *  border, e.g. a filled accent button, so a weak border on it is not
       *  a defect. */
      backgroundRatio(el: Element): number {
        const own = composite(el)
        const behind = composite(el.parentElement || document.body)
        return ratio(own, behind)
      },
    }
  })
}
