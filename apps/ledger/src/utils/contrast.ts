/** WCAG 2.1 relative luminance and contrast ratio. Six-digit hex only, which
 *  is what every theme token in index.css uses for text and background. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function luminance(rgb: [number, number, number]): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return NaN
  const la = luminance(ca)
  const lb = luminance(cb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Flattens a partly transparent foreground onto an opaque background, which
 *  is what a Tailwind opacity modifier such as text-white/50 actually renders.
 *  Contrast math needs the flattened colour, not the token's own value. */
export function compositeOver(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg)
  const b = parseHex(bg)
  if (!f || !b) return fg
  const mix = (i: number) => Math.round(f[i] * alpha + b[i] * (1 - alpha))
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(mix(0))}${hex(mix(1))}${hex(mix(2))}`
}
