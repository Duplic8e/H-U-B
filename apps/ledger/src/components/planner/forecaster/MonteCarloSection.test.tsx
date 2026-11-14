import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonteCarloSection } from './MonteCarloSection'

const baseProps = {
  startBalance: 100000,
  monthlySavings: 2000,
  years: 10,
  meanReturnPct: 7,
  stdDevPct: 15,
  stepUpPct: 2,
  lumpSums: [],
  target: 1000000,
  onStdDevChange: () => {},
}

describe('MonteCarloSection layout', () => {
  it('keeps the footnote inside the auto-height card (no fixed card height)', () => {
    render(<MonteCarloSection {...baseProps} />)
    const note = screen.getByText(/500 seeded simulations/i)
    const card = note.closest('.themed-card') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.className).not.toMatch(/h-\[300px\]/)
    const chartWrapper = card.querySelector('.desktop\\:h-\\[300px\\]')
    expect(chartWrapper).toBeTruthy()
  })

  it('stacks the volatility control and stat cards in one column below md', () => {
    const { container } = render(
      <MonteCarloSection
        startBalance={100000} monthlySavings={1000} years={25}
        meanReturnPct={6} stdDevPct={15} stepUpPct={0}
        lumpSums={[]} target={1200000} onStdDevChange={() => {}}
      />,
    )
    const grid = container.querySelector('.grid') as HTMLElement
    const classes = grid.className.split(/\s+/)
    expect(classes).toContain('grid-cols-1') // stacked below md, no orphaned cell
    expect(classes).toContain('md:grid-cols-3')
    expect(classes).not.toContain('grid-cols-2')
  })
})
