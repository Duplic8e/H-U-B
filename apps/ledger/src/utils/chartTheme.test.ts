import { describe, expect, it } from 'vitest'
import { chartTooltipStyles, sliceColor } from './chartTheme'

describe('chartTooltipStyles', () => {
  it('stacks the tooltip above a chart overlay such as a donut centre label', () => {
    expect(chartTooltipStyles.wrapperStyle.zIndex).toBeGreaterThan(0)
  })
})

describe('sliceColor', () => {
  it('uses the raw theme colours for the first six slices', () => {
    expect(sliceColor(0)).toBe('var(--accent)')
    expect(sliceColor(5)).toBe('var(--chart-6)')
  })

  it('does not repeat a colour once the base palette runs out', () => {
    expect(sliceColor(6)).not.toBe(sliceColor(0))
    expect(sliceColor(12)).not.toBe(sliceColor(0))
    expect(sliceColor(12)).not.toBe(sliceColor(6))
  })

  it('keeps every fill distinct across a realistically large portfolio', () => {
    const colors = Array.from({ length: 30 }, (_, i) => sliceColor(i))
    expect(new Set(colors).size).toBe(30)
  })

  it('derives later slices from the base colour they extend', () => {
    expect(sliceColor(6)).toContain('var(--accent)')
    expect(sliceColor(6)).toContain('color-mix')
  })
})
