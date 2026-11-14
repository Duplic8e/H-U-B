import { describe, it, expect } from 'vitest'
import { pct, share } from './holdingMetrics'

describe('pct signs a change', () => {
  it('prefixes a plus for a gain', () => expect(pct(15)).toBe('+15.0%'))
  it('keeps the minus for a loss', () => expect(pct(-4.2)).toBe('-4.2%'))
  it('dashes a null', () => expect(pct(null)).toBe('-'))
})

describe('share does not sign a weight', () => {
  it('has no sign', () => expect(share(15)).toBe('15.0%'))
  it('dashes a null', () => expect(share(null)).toBe('-'))
  it('never renders a negative weight as positive', () => expect(share(-1)).toBe('-1.0%'))
})
