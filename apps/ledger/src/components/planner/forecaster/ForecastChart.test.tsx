import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { goalChip } from './goalLabel'
import { ForecastChart } from './ForecastChart'
import { buildForecast } from '../../../utils/finance/forecast'

const points = buildForecast({
  startBalance: 100000,
  monthlySavings: 1000,
  annualReturnPct: 7,
  annualInflationPct: 2.5,
  contributionStepUpPct: 0,
  years: 2,
  scenarioSpreadPct: 2,
})

describe('ForecastChart legend', () => {
  it('line view legend names projected, band and actual', () => {
    render(<ForecastChart points={points} history={[]} showReal={false} view="line" goalMarkers={[]} />)
    expect(screen.getByText('Projected')).toBeInTheDocument()
    expect(screen.getByText(/Conservative to Optimistic/i)).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
  })

  it('stacked view legend names contributed and growth', () => {
    render(<ForecastChart points={points} history={[]} showReal={false} view="stacked" goalMarkers={[]} />)
    expect(screen.getByText('Contributed')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
  })

  it('real mode legend labels the projected line as real', () => {
    render(<ForecastChart points={points} history={[]} showReal view="line" goalMarkers={[]} />)
    expect(screen.getByText('Projected (real)')).toBeInTheDocument()
  })
})

type Part = React.ReactElement<{ x: number; y: number; width: number; fontSize: number; children: string }>
type Chip = React.ReactElement<{ children: Part[] }>

describe('goalChip', () => {
  const chip = (flip: boolean, x = 100) => {
    const label = goalChip('Initial Milestone', flip)({ viewBox: { x, y: 8 } }) as Chip
    return label.props.children
  }

  it('draws the goal name at 12px on a chip inside the plot, below the top edge', () => {
    const [rect, text] = chip(false)
    expect(text.props.children).toBe('Initial Milestone')
    expect(text.props.fontSize).toBe(12)
    expect(rect.props.y).toBeGreaterThan(8)
  })

  it('sits right of the line by default and left of it when flipped', () => {
    const [right] = chip(false, 100)
    const [left] = chip(true, 100)
    expect(right.props.x).toBeGreaterThan(100)
    expect(left.props.x + left.props.width).toBeLessThan(100)
  })

  it('is as wide as its text needs', () => {
    const [short] = (goalChip('A', false)({ viewBox: { x: 0, y: 0 } }) as Chip).props.children
    const [long] = chip(false)
    expect(long.props.width).toBeGreaterThan(short.props.width)
  })
})

describe('ForecastChart legend with goals', () => {
  it('does not add the goal name to the legend; the chart labels it', () => {
    render(<ForecastChart centered points={points} history={[]} showReal={false} view="line" goalMarkers={[{ label: 'Initial Milestone', month: 6, amount: 106000 }]} />)
    expect(screen.queryByText('Goal: Initial Milestone')).toBeNull()
  })
})
